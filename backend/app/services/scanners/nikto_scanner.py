import json
import re

from app.services.audit_log_service import create_audit_log
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.scanner_mixin import ScannerJobMixin
from app.utils.scanner_utils import (
    clean_output, normalize_severity, calculate_risk_score,
    resolve_binary, run_subprocess,
)

class NiktoScanner(BaseScanner, ScannerJobMixin):
    name = "Nikto"

    def start_scan(self, scan_id: int, worker_id: str | None = None) -> None:
        db, scan = self.begin_job(scan_id, worker_id)
        if db is None:
            return
        try:
            binary = resolve_binary("nikto")
            if not binary:
                self.fail_job(db, scan, self.missing_binary_error("nikto"))
                return

            cmd = [binary, "-h", scan.target, "-Format", "json", "-output", "-"]
            self.set_command(db, scan, " ".join(cmd))

            result = run_subprocess(cmd, timeout=300, cancelled=lambda: self.is_cancelled(db, scan))
            raw_output = clean_output(result["stdout"])

            if not result["success"]:
                self.fail_job(db, scan, result["error"],
                              raw_output=clean_output(result["stderr"]),
                              truncated=result["stdout_truncated"] or result["stderr_truncated"])
                return

            parsed = self.parse_output(raw_output)
            if parsed.get("parse_error"):
                self.fail_job(db, scan, "Scanner output could not be parsed.", raw_output=raw_output)
                return
            report = self.generate_report(parsed)
            findings_list = parsed.get("findings", [])

            # Nonzero exit with partial output: record parse_error and fail
            # rather than presenting truncated data as a clean result.
            if not result["success"] and result["returncode"] != 0:
                if parsed.get("parse_error") or result["stdout_truncated"]:
                    self.fail_job(db, scan,
                                  f"nikto exited with code {result['returncode']} and output was incomplete.",
                                  raw_output=raw_output,
                                  truncated=result["stdout_truncated"])
                    return

            self.complete_job(
                db, scan,
                findings=len(findings_list),
                risk_score=calculate_risk_score(findings_list),
                raw_output=raw_output,
                parsed_output=report,
                truncated=result["stdout_truncated"],
            )
        except Exception:
            self.fail_job(db, scan, "Unexpected scanner failure.")
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
            if raw_output.strip():
                # Parse failure is surfaced, never presented as a clean result.
                parsed_data["parse_error"] = (
                    "nikto JSON output could not be parsed (possibly truncated)."
                )
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
        recommendations = []
        if parsed_data.get("parse_error"):
            recommendations.append("Scanner output could not be fully parsed; re-run the scan.")
        recommendations.extend([
            "Review all reported default files and configurations.",
            "Ensure server versions are not unnecessarily exposed.",
            "Investigate any identified XSS or injection vulnerabilities immediately."
        ])
        return {
            "scanner": self.name,
            "summary": "Nikto Web Server Scanner Results",
            "total_findings": len(findings),
            "findings": findings,
            "server_info": parsed_data.get("server_info", "Unknown"),
            "recommendations": recommendations
        }
