import xml.etree.ElementTree as ET

from app.models.scan import Scan
from app.services.audit_log_service import create_audit_log
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.scanner_mixin import ScannerJobMixin
from app.utils.scanner_utils import (
    extract_hostname, clean_output, normalize_severity,
    calculate_risk_score, resolve_binary, run_subprocess,
)


class NmapScanner(BaseScanner, ScannerJobMixin):
    name = "Nmap"

    def start_scan(self, scan_id: int, worker_id: str | None = None) -> None:
        db, scan = self.begin_job(scan_id, worker_id)
        if db is None:
            return
        try:
            binary = resolve_binary("nmap")
            if not binary:
                self.fail_job(db, scan, self.missing_binary_error("nmap"))
                return

            hostname = extract_hostname(scan.target)
            cmd = [binary, "-sV", "-sC", "--open", "-oX", "-", hostname]
            self.set_command(db, scan, " ".join(cmd))

            result = run_subprocess(cmd, timeout=300, cancelled=lambda: self.is_cancelled(db, scan))
            raw_output = clean_output(result["stdout"])

            if not result["success"]:
                self.fail_job(db, scan, result["error"],
                              raw_output=raw_output or clean_output(result["stderr"]),
                              truncated=result["stdout_truncated"] or result["stderr_truncated"])
                return

            parsed = self.parse_output(raw_output)
            if parsed.get("parse_error"):
                self.fail_job(db, scan, "Scanner output could not be parsed.", raw_output=raw_output)
                return
            report = self.generate_report(parsed)
            findings_list = parsed.get("findings", [])

            self.complete_job(
                db, scan,
                findings=len(findings_list),
                risk_score=calculate_risk_score(findings_list),
                raw_output=raw_output,
                parsed_output=report,
                truncated=result["stdout_truncated"],
            )
        except Exception as exc:
            self.fail_job(db, scan, str(exc))
        finally:
            db.close()

    def parse_output(self, raw_output: str) -> dict:
        parsed_data = {
            "hosts": [],
            "findings": []
        }
        if not raw_output:
            return parsed_data

        try:
            root = ET.fromstring(raw_output)
            for host in root.findall('host'):
                host_info = {"status": "", "ports": []}
                status = host.find('status')
                if status is not None:
                    host_info["status"] = status.get('state', '')

                ports = host.find('ports')
                if ports is not None:
                    for port in ports.findall('port'):
                        state = port.find('state')
                        if state is not None and state.get('state') == 'open':
                            port_id = port.get('portid', '')
                            protocol = port.get('protocol', '')

                            service = port.find('service')
                            service_name = service.get('name', '') if service is not None else ''
                            service_version = service.get('version', '') if service is not None else ''
                            service_product = service.get('product', '') if service is not None else ''

                            scripts = []
                            for script in port.findall('script'):
                                scripts.append({
                                    "id": script.get('id', ''),
                                    "output": script.get('output', '')
                                })

                            port_info = {
                                "port": port_id,
                                "protocol": protocol,
                                "service": service_name,
                                "product": service_product,
                                "version": service_version,
                                "scripts": scripts
                            }
                            host_info["ports"].append(port_info)

                            try:
                                port_num = int(port_id)
                            except ValueError:
                                port_num = -1

                            severity = "Low"
                            if port_num in [21, 23, 445, 3389, 5900]:
                                severity = "Critical"
                            elif port_num in [22, 25, 110, 143, 3306, 5432, 6379, 27017]:
                                severity = "High"
                            elif port_num in [80, 443, 8080, 8443]:
                                severity = "Medium"

                            parsed_data["findings"].append({
                                "type": "Open Port",
                                "name": f"Open Port: {port_id}/{protocol} ({service_name})",
                                "severity": normalize_severity(severity),
                                "description": f"The port {port_id} is open running {service_name} {service_version}.",
                                "details": port_info
                            })

                parsed_data["hosts"].append(host_info)
        except ET.ParseError:
            # Parse failure is never reported as a clean completed scan.
            parsed_data["parse_error"] = "nmap XML output could not be parsed (possibly truncated)."
        except Exception:
            parsed_data["parse_error"] = "nmap output could not be parsed."
        return parsed_data

    def generate_report(self, parsed_data: dict) -> dict:
        total_ports = sum(len(h.get("ports", [])) for h in parsed_data.get("hosts", []))

        recommendations = []
        findings = parsed_data.get("findings", [])
        if parsed_data.get("parse_error"):
            recommendations.append("Scanner output could not be fully parsed; re-run the scan.")
        if findings:
            recommendations.append("Review all open ports and close unnecessary ones.")
            for f in findings:
                if f.get("severity") in ["critical", "high"]:
                    recommendations.append(f"Investigate high/critical finding: {f.get('name')}")
        else:
            recommendations.append("No open ports found or scan failed.")

        return {
            "scanner": self.name,
            "summary": {
                "total_hosts": len(parsed_data.get("hosts", [])),
                "total_ports": total_ports,
                "total_findings": len(findings)
            },
            "findings": findings,
            "hosts": parsed_data.get("hosts", []),
            "recommendations": recommendations
        }
