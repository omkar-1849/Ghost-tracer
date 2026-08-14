import json
import re
from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id
from app.services.scanners.base_scanner import BaseScanner
from app.utils.scanner_utils import (
    run_subprocess, check_binary,
    clean_output, normalize_severity, calculate_risk_score, ist_now,
)

class NucleiScanner(BaseScanner):
    name = "Nuclei"

    def start_scan(self, scan_id: int) -> None:
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if not scan or scan.status == "Cancelled":
                return
            scan.status = "Running"
            db.commit()

            if not check_binary("nuclei"):
                scan.status = "Failed"
                scan.error = "nuclei is not installed."
                scan.completed_at = ist_now()
                db.commit()
                return

            cmd = ["nuclei", "-u", scan.target, "-jsonl", "-silent", "-nc"]
            scan.command = " ".join(cmd)
            db.commit()

            result = run_subprocess(cmd, timeout=300)
            raw_output = clean_output(result["stdout"])

            if not result["success"] and result["error"]:
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

            org_id = resolve_audit_organization_id(db)
            create_audit_log(
                db=db,
                organization_id=org_id if org_id is not None else 1,
                user_id=None,
                action="SCAN_COMPLETED",
                resource_type="SCAN",
                resource_id=str(scan.id),
                description=f"Scan ({scan.engine}) on {scan.target} completed with {scan.findings} findings.",
            )
        except Exception as e:
            try:
                scan.status = "Failed"
                scan.error = str(e)[:4000]
                scan.completed_at = ist_now()
                db.commit()

                org_id = resolve_audit_organization_id(db)
                create_audit_log(
                    db=db,
                    organization_id=org_id if org_id is not None else 1,
                    user_id=None,
                    action="SCAN_FAILED",
                    resource_type="SCAN",
                    resource_id=str(scan.id),
                    description=f"Scan ({scan.engine}) on {scan.target} failed: {scan.error[:200] if scan.error else 'Unknown error'}.",
                )
            except Exception:
                pass
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
                continue
                
        return parsed_data

    def generate_report(self, parsed_data: dict) -> dict:
        recommendations = []
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
