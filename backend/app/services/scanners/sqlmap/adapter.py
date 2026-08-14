import os
import subprocess
from datetime import datetime, timedelta

from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.sqlmap.parser import SQLMapParser
from app.services.scanners.sqlmap.report import SQLMapReportGenerator
from app.utils.scanner_utils import clean_output, calculate_risk_score, ist_now

SQLMAP_PATH = os.path.join(
    "C:\\",
    "Users",
    "omkar",
    "sqlmap",
    "sqlmap.py",
)


class SQLMapScanner(BaseScanner):
    name = "SQLMap"

    def start_scan(self, scan_id: int) -> None:
        db = SessionLocal()

        try:
            scan = (
                db.query(Scan)
                .filter(Scan.id == scan_id)
                .first()
            )

            if not scan or scan.status == "Cancelled":
                return

            scan.status = "Running"
            cmd = [
                "python",
                SQLMAP_PATH,
                "-u",
                scan.target,
                "--batch",
                "--flush-session",
            ]
            scan.command = " ".join(cmd)
            db.commit()

            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=1800,
                )

                db.refresh(scan)

                if scan.status == "Cancelled":
                    return

                if result.returncode == 0:
                    raw_output = clean_output(result.stdout)
                    parsed = self.parse_output(raw_output)
                    report = self.generate_report(raw_output)

                    # Count findings from parsed data
                    finding_count = 0
                    parsed_findings = parsed.get("findings", {})
                    if parsed_findings.get("injectable"):
                        finding_count += 1
                    finding_count += len(parsed_findings.get("warnings", []))
                    finding_count += len(parsed_findings.get("critical", []))
                    finding_count += len(parsed_findings.get("databases", []))

                    scan.status = "Completed"
                    scan.findings = finding_count
                    scan.raw_output = raw_output
                    scan.parsed_output = report

                    # Risk score based on parsed summary
                    risk_label = parsed.get("summary", {}).get("risk", "Low")
                    risk_map = {"High": 85, "Medium": 50, "Low": 15}
                    scan.risk_score = risk_map.get(risk_label, 15)

                else:
                    raw_output = clean_output(result.stderr)

                    scan.status = "Failed"
                    scan.raw_output = raw_output
                    scan.error = raw_output[:4000]
                    scan.parsed_output = self.generate_report(raw_output)
                    scan.findings = 0
                    scan.risk_score = 0

            except subprocess.TimeoutExpired:
                db.refresh(scan)
                if scan.status == "Cancelled":
                    return
                scan.status = "Failed"
                scan.error = "SQLMap scan timed out after 1800 seconds."
                scan.findings = 0
                scan.risk_score = 0

            except FileNotFoundError:
                db.refresh(scan)
                if scan.status == "Cancelled":
                    return
                scan.status = "Failed"
                scan.error = (
                    f"SQLMap not found at {SQLMAP_PATH}. "
                    "Please verify the installation path."
                )
                scan.findings = 0
                scan.risk_score = 0

            except Exception as error:
                db.refresh(scan)
                if scan.status == "Cancelled":
                    return
                scan.status = "Failed"
                scan.error = str(error)[:4000]
                scan.findings = 0
                scan.risk_score = 0

            scan.completed_at = ist_now()
            db.commit()

            org_id = resolve_audit_organization_id(db)
            if scan.status == "Completed":
                create_audit_log(
                    db=db,
                    organization_id=org_id if org_id is not None else 1,
                    user_id=None,
                    action="SCAN_COMPLETED",
                    resource_type="SCAN",
                    resource_id=str(scan.id),
                    description=f"Scan ({scan.engine}) on {scan.target} completed with {scan.findings} findings.",
                )
            elif scan.status == "Failed":
                create_audit_log(
                    db=db,
                    organization_id=org_id if org_id is not None else 1,
                    user_id=None,
                    action="SCAN_FAILED",
                    resource_type="SCAN",
                    resource_id=str(scan.id),
                    description=f"Scan ({scan.engine}) on {scan.target} failed: {scan.error[:200] if scan.error else 'Unknown error'}.",
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
        parser = SQLMapParser()
        return parser.parse(raw_output)

    def generate_report(self, raw_output: str) -> dict:
        report = SQLMapReportGenerator()
        return report.generate(raw_output)