import socket
import ssl
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List

from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.scanners.base_scanner import BaseScanner
from app.utils.scanner_utils import (
    extract_host_port,
    clean_output,
    normalize_severity,
    calculate_risk_score,
    ist_now,
)

class SSLScanner(BaseScanner):
    name = "SSL"

    def _parse_cert_date(self, date_str: str) -> datetime:
        """Parses cert date formats like 'May 16 00:00:00 2024 GMT'"""
        if not date_str:
            return datetime.min
        try:
            return datetime.strptime(date_str, "%b %d %H:%M:%S %Y %Z")
        except ValueError:
            try:
                return datetime.strptime(date_str, "%b %d %H:%M:%S %Y GMT")
            except ValueError:
                return datetime.utcnow()

    def _parse_name_tuples(self, name_tuples: tuple) -> str:
        """Helper to parse Subject/Issuer tuples into a readable string."""
        parts = []
        for field in name_tuples:
            for k, v in field:
                parts.append(f"{k}={v}")
        return ", ".join(parts)

    def _extract_cn(self, name_tuples: tuple) -> str:
        for field in name_tuples:
            for k, v in field:
                if k == 'commonName':
                    return v
        return ""

    def start_scan(self, scan_id: int) -> None:
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if not scan or scan.status == "Cancelled":
                return
            scan.status = "Running"
            scan.command = "Internal SSL/socket connect"
            db.commit()

            hostname, port = extract_host_port(scan.target)
            if not port:
                port = 443

            cert = {}
            cipher_info = None
            tls_version = None

            # Attempt 1: verified connection (gets full cert details)
            try:
                ctx_verified = ssl.create_default_context()
                with socket.create_connection((hostname, port), timeout=15) as sock:
                    with ctx_verified.wrap_socket(sock, server_hostname=hostname) as ssock:
                        cert = ssock.getpeercert() or {}
                        cipher_info = ssock.cipher()
                        tls_version = ssock.version()
            except ssl.SSLCertVerificationError:
                # Attempt 2: unverified connection (self-signed / invalid certs)
                try:
                    ctx_unverified = ssl.create_default_context()
                    ctx_unverified.check_hostname = False
                    ctx_unverified.verify_mode = ssl.CERT_NONE
                    with socket.create_connection((hostname, port), timeout=15) as sock:
                        with ctx_unverified.wrap_socket(sock, server_hostname=hostname) as ssock:
                            cert = ssock.getpeercert() or {}
                            cipher_info = ssock.cipher()
                            tls_version = ssock.version()
                except (socket.timeout, socket.gaierror, ssl.SSLError, ConnectionRefusedError, OSError) as e:
                    scan.status = "Failed"
                    scan.error = f"Connection failed: {str(e)}"
                    scan.completed_at = ist_now()
                    db.commit()
                    return
            except (socket.timeout, socket.gaierror, ssl.SSLError, ConnectionRefusedError, OSError) as e:
                scan.status = "Failed"
                scan.error = f"Connection failed: {str(e)}"
                scan.completed_at = ist_now()
                db.commit()
                return

            raw_data = {
                "cert": cert,
                "cipher_info": cipher_info,
                "tls_version": tls_version,
                "hostname": hostname,
                "port": port
            }
            raw_output_str = json.dumps(raw_data, default=str)

            parsed = self.parse_output(raw_output_str)
            report = self.generate_report(parsed)
            findings_list = parsed.get("findings", [])

            # Generate human-readable raw output
            hr_output = []
            hr_output.append(f"Host: {hostname}:{port}")
            hr_output.append(f"TLS Version: {tls_version}")
            if cipher_info:
                hr_output.append(f"Cipher: {cipher_info[0]} ({cipher_info[2]} bits)")
            if cert:
                hr_output.append(f"Subject: {self._parse_name_tuples(cert.get('subject', ()))}")
                hr_output.append(f"Issuer: {self._parse_name_tuples(cert.get('issuer', ()))}")
                hr_output.append(f"Not Before: {cert.get('notBefore')}")
                hr_output.append(f"Not After: {cert.get('notAfter')}")
            
            scan.status = "Completed"
            scan.findings = len(findings_list)
            scan.risk_score = calculate_risk_score(findings_list)
            scan.raw_output = clean_output("\n".join(hr_output))
            scan.parsed_output = report
            scan.completed_at = ist_now()
            db.commit()

        except Exception as e:
            try:
                scan.status = "Failed"
                scan.error = str(e)[:4000]
                scan.completed_at = ist_now()
                db.commit()
            except Exception:
                pass
        finally:
            db.close()

    def parse_output(self, raw_output: str) -> dict:
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError:
            return {"findings": [], "cert_details": {}, "cipher_details": {}}

        cert = data.get("cert", {})
        cipher_info = data.get("cipher_info")
        tls_version = data.get("tls_version", "")
        hostname = data.get("hostname", "")

        findings = []
        cert_details = {}
        cipher_details = {}

        # TLS / Cipher checks
        if cipher_info:
            c_name, c_proto, c_bits = cipher_info
            cipher_details = {
                "name": c_name,
                "protocol": c_proto,
                "bits": c_bits
            }
            if c_bits and int(c_bits) < 128:
                findings.append({
                    "title": "Weak Cipher Suite Supported",
                    "description": f"The server supports a weak cipher: {c_name} ({c_bits} bits).",
                    "severity": normalize_severity("high")
                })
        
        if tls_version:
            cipher_details["tls_version"] = tls_version
            if tls_version in ["TLSv1.0", "TLSv1.1", "SSLv2", "SSLv3", "TLSv1"]:
                findings.append({
                    "title": f"Weak Protocol Supported ({tls_version})",
                    "description": f"The server supports an outdated and insecure protocol: {tls_version}.",
                    "severity": normalize_severity("critical")
                })
            elif tls_version == "TLSv1.2":
                findings.append({
                    "title": "TLS 1.2 Supported",
                    "description": "TLS 1.2 is acceptable but TLS 1.3 is preferred for better security and performance.",
                    "severity": normalize_severity("info")
                })

        # Cert checks
        if cert:
            subject = self._parse_name_tuples(cert.get("subject", ()))
            issuer = self._parse_name_tuples(cert.get("issuer", ()))
            subject_cn = self._extract_cn(cert.get("subject", ()))
            issuer_cn = self._extract_cn(cert.get("issuer", ()))
            
            serial = cert.get("serialNumber", "")
            not_before_str = cert.get("notBefore", "")
            not_after_str = cert.get("notAfter", "")
            
            not_after_dt = self._parse_cert_date(not_after_str)
            now = datetime.utcnow()
            days_until_expiry = (not_after_dt - now).days
            
            is_expired = days_until_expiry < 0
            is_expiring_soon = 0 <= days_until_expiry < 30
            
            sans = cert.get("subjectAltName", ())
            san_list = [v for k, v in sans]
            
            cert_details = {
                "subject": subject,
                "issuer": issuer,
                "serial_number": serial,
                "not_before": not_before_str,
                "not_after": not_after_str,
                "days_until_expiry": days_until_expiry,
                "is_expired": is_expired,
                "is_expiring_soon": is_expiring_soon,
                "sans": san_list
            }

            if is_expired:
                findings.append({
                    "title": "SSL Certificate Expired",
                    "description": f"The SSL certificate expired on {not_after_str} ({-days_until_expiry} days ago).",
                    "severity": normalize_severity("critical")
                })
            elif is_expiring_soon:
                findings.append({
                    "title": "SSL Certificate Expiring Soon",
                    "description": f"The SSL certificate will expire in {days_until_expiry} days on {not_after_str}.",
                    "severity": normalize_severity("high")
                })
            elif 30 <= days_until_expiry <= 90:
                findings.append({
                    "title": "SSL Certificate Expiring",
                    "description": f"The SSL certificate will expire in {days_until_expiry} days.",
                    "severity": normalize_severity("medium")
                })

            if subject and (subject == issuer or subject_cn == issuer_cn):
                findings.append({
                    "title": "Self-Signed Certificate",
                    "description": "The certificate is self-signed, which is not trusted by default by clients.",
                    "severity": normalize_severity("high")
                })

            if not san_list:
                findings.append({
                    "title": "Missing Subject Alternative Names (SANs)",
                    "description": "The certificate does not contain any Subject Alternative Names (SANs).",
                    "severity": normalize_severity("low")
                })

            if not is_expired and not is_expiring_soon and (subject != issuer and subject_cn != issuer_cn):
                findings.append({
                    "title": "Valid SSL Certificate",
                    "description": f"The SSL certificate is valid and expires in {days_until_expiry} days.",
                    "severity": normalize_severity("info")
                })

        return {
            "cert_details": cert_details,
            "cipher_details": cipher_details,
            "findings": findings
        }

    def generate_report(self, parsed_data: dict) -> dict:
        cert_details = parsed_data.get("cert_details", {})
        cipher_details = parsed_data.get("cipher_details", {})
        findings = parsed_data.get("findings", [])

        is_valid = False
        if cert_details and not cert_details.get("is_expired"):
            is_valid = True
            for f in findings:
                if f.get("title") == "Self-Signed Certificate" or f.get("title") == "SSL Certificate Expired":
                    is_valid = False

        return {
            "scanner": self.name,
            "summary": f"Found {len(findings)} issues during SSL/TLS analysis.",
            "certificate_details": cert_details,
            "cipher_info": cipher_details,
            "findings": findings,
            "validity_status": "Valid" if is_valid else "Invalid",
            "recommendations": [
                "Ensure SSL/TLS certificates are renewed at least 30 days before expiration.",
                "Avoid using self-signed certificates in production environments.",
                "Disable weak TLS versions (1.0, 1.1) and older SSL versions.",
                "Ensure strong cipher suites are configured (>128 bits)."
            ]
        }
