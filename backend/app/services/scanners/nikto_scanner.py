import json
import re
from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.scanners.base_scanner import BaseScanner
from app.utils.scanner_utils import (
    run_subprocess, check_binary, extract_hostname, extract_host_port,
    clean_output, normalize_severity, calculate_risk_score, ist_now,
)

class NiktoScanner(BaseScanner):
    name = "Nikto"

    def start_scan(self, scan_id: int) -> None:
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if not scan or scan.status == "Cancelled":
                return
            scan.status = "Running"
            db.commit()

            if not check_binary("nikto"):
                scan.status = "Failed"
                scan.error = "nikto is not installed."
                scan.completed_at = ist_now()
                db.commit()
                return

            cmd = ["nikto", "-h", scan.target, "-Format", "json", "-output", "-"]
            scan.command = " ".join(cmd)
            db.commit()

            result = run_subprocess(cmd, timeout=300)
            raw_output = clean_output(result["stdout"])

            if not result["success"] and result["error"] and not raw_output:
                scan.status = "Failed"
                scan.error = result["error"]
                scan.raw_output = raw_output or clean_output(result["stderr"])
                scan.completed_at = ist_now()
                db.commit()
                return

            parsed = self.parse_output(raw_output)
            report = self.generate_report(parsed)
            findings_list = parsed.get("findings", [])

            scan.status = "Completed"
            scan.findings = len(findings_list)
            scan.risk_score = calculate_risk_score(findings_list)
            scan.raw_output = raw_output
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
        parsed_data = {"findings": [], "server_info": "Unknown"}
        
        try:
            data = json.loads(raw_output)
            vulnerabilities = data.get("vulnerabilities", [])
            for vuln in vulnerabilities:
                msg = vuln.get("msg", "")
                osvdb = vuln.get("OSVDB", "")
                finding_id = vuln.get("id", "")
                severity = self._assess_severity(msg, osvdb)
                
                parsed_data["findings"].append({
                    "id": finding_id,
                    "osvdb": osvdb,
                    "method": vuln.get("method", ""),
                    "url": vuln.get("url", ""),
                    "message": msg,
                    "severity": severity
                })
        except json.JSONDecodeError:
            for line in raw_output.splitlines():
                if line.startswith("+"):
                    msg = line[1:].strip()
                    osvdb_match = re.search(r'OSVDB-?(\d+)', msg, re.IGNORECASE)
                    osvdb = osvdb_match.group(1) if osvdb_match else ""
                    severity = self._assess_severity(msg, osvdb)
                    
                    parsed_data["findings"].append({
                        "id": "",
                        "osvdb": osvdb,
                        "method": "",
                        "url": "",
                        "message": msg,
                        "severity": severity
                    })
                    
        return parsed_data

    def _assess_severity(self, msg: str, osvdb: str) -> str:
        msg_lower = msg.lower()
        if "xss" in msg_lower or "injection" in msg_lower:
            return "critical"
        elif "default" in msg_lower or "config" in msg_lower:
            return "high"
        elif osvdb or "directory" in msg_lower or "index" in msg_lower:
            return "medium"
        elif "server" in msg_lower or "version" in msg_lower:
            return "low"
        return "info"

    def generate_report(self, parsed_data: dict) -> dict:
        findings = parsed_data.get("findings", [])
        return {
            "scanner": self.name,
            "summary": "Nikto Web Server Scanner Results",
            "total_findings": len(findings),
            "findings": findings,
            "server_info": parsed_data.get("server_info", "Unknown"),
            "recommendations": [
                "Review all reported default files and configurations.",
                "Ensure server versions are not unnecessarily exposed.",
                "Investigate any identified XSS or injection vulnerabilities immediately."
            ]
        }
