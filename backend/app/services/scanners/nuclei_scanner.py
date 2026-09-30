import json
import re

from app.services.audit_log_service import create_audit_log
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.scanner_mixin import ScannerJobMixin
from app.utils.scanner_utils import (
    clean_output, normalize_severity, calculate_risk_score,
    resolve_binary, run_subprocess,
)

class NucleiScanner(BaseScanner, ScannerJobMixin):
    name = "Nuclei"

    def start_scan(self, scan_id: int, worker_id: str | None = None) -> None:
        db, scan = self.begin_job(scan_id, worker_id)
        if db is None:
            return
        try:
            binary = resolve_binary("nuclei")
            if not binary:
                self.fail_job(db, scan, self.missing_binary_error("nuclei"))
                return

            cmd = [binary, "-u", scan.target, "-jsonl", "-silent", "-nc"]
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
        except Exception:
            self.fail_job(db, scan, "Unexpected scanner failure.")
        finally:
            db.close()

    def parse_output(self, raw_output: str) -> dict:
        parsed_data = {
            "findings": [],
            "cve_list": [],
            "templates_matched": [],
            "severities": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        }
        if not raw_output:
            return parsed_data

        cve_pattern = re.compile(r'CVE-\d{4}-\d+', re.IGNORECASE)
        malformed_lines = 0

        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                template_id = data.get("template-id", "")
                info = data.get("info", {})
                name = info.get("name", "")
                severity_raw = info.get("severity", "info")
                severity = normalize_severity(severity_raw)

                finding = {
                    "type": data.get("type", ""),
                    "name": name,
                    "template_id": template_id,
                    "severity": severity,
                    "matched_at": data.get("matched-at", ""),
                    "matcher_name": data.get("matcher-name", ""),
                    "extracted_results": data.get("extracted-results", []),
                    "description": info.get("description", "")
                }
                parsed_data["findings"].append(finding)

                cves = cve_pattern.findall(template_id) + cve_pattern.findall(name)
                for cve in cves:
                    cve_upper = cve.upper()
                    if cve_upper not in parsed_data["cve_list"]:
                        parsed_data["cve_list"].append(cve_upper)

                if template_id not in parsed_data["templates_matched"]:
                    parsed_data["templates_matched"].append(template_id)

                parsed_data["severities"][severity.lower()] = parsed_data["severities"].get(severity.lower(), 0) + 1
            except Exception:
                malformed_lines += 1
                continue

        if malformed_lines:
            # Surface truncation/parse damage instead of a silent clean result.
            parsed_data["parse_error"] = (
                f"{malformed_lines} nuclei output line(s) could not be parsed "
                "(output may be truncated)."
            )

        return parsed_data

    def generate_report(self, parsed_data: dict) -> dict:
        recommendations = []
        if parsed_data.get("parse_error"):
            recommendations.append("Scanner output could not be fully parsed; re-run the scan.")
        if parsed_data.get("severities", {}).get("critical", 0) > 0 or parsed_data.get("severities", {}).get("high", 0) > 0:
            recommendations.append("Address critical and high severity findings immediately.")
        if parsed_data.get("cve_list"):
            recommendations.append(f"Patch or mitigate identified CVEs: {', '.join(parsed_data.get('cve_list'))}")
        if not recommendations and not parsed_data.get("findings"):
            recommendations.append("No vulnerabilities found by Nuclei.")
        elif not recommendations:
            recommendations.append("Review findings and address as per risk tolerance.")

        return {
            "scanner": self.name,
            "summary": {
                "total_findings": len(parsed_data.get("findings", [])),
                "severity_breakdown": parsed_data.get("severities", {})
            },
            "findings": parsed_data.get("findings", []),
            "cve_list": parsed_data.get("cve_list", []),
            "templates_matched": parsed_data.get("templates_matched", []),
            "recommendations": recommendations
        }
