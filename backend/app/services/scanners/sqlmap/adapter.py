import os
import subprocess
from datetime import datetime, timedelta

from app.database.database import SessionLocal
from app.models.scan_result import ScanResult
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.sqlmap.parser import SQLMapParser
from app.services.scanners.sqlmap.report import SQLMapReportGenerator

SQLMAP_PATH = os.path.join(
    "C:\\",
    "Users",
    "omkar",
    "sqlmap",
    "sqlmap.py",
)


class SQLMapScanner(BaseScanner):
    name = "SQLMap"

    def start_scan(self, scan_id: int):
        db = SessionLocal()

        try:
            scan = (
                db.query(ScanResult)
                .filter(ScanResult.id == scan_id)
                .first()
            )

            if not scan or scan.status == "CANCELLED":
                return

            scan.status = "RUNNING"
            db.commit()

            try:
                result = subprocess.run(
                    [
                        "python",
                        SQLMAP_PATH,
                        "-u",
                        scan.target,
                        "--batch",
                        "--flush-session",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=1800,
                )

                db.refresh(scan)

                if scan.status == "CANCELLED":
                    return

                if result.returncode == 0:
                    raw_output = result.stdout[:4000]

                    scan.status = "COMPLETED"
                    scan.findings = raw_output
                    scan.report = self.generate_report(raw_output)

                else:
                    raw_output = result.stderr[:4000]

                    scan.status = "FAILED"
                    scan.findings = raw_output
                    scan.report = self.generate_report(raw_output)

            except Exception as error:
                db.refresh(scan)

                if scan.status == "CANCELLED":
                    return

                raw_output = str(error)[:4000]

                scan.status = "FAILED"
                scan.findings = raw_output
                scan.report = self.generate_report(raw_output)

            scan.completed_at = (
                datetime.utcnow() + timedelta(hours=5, minutes=30)
            )

            db.commit()

        finally:
            db.close()

    def parse_output(self, raw_output: str):
        parser = SQLMapParser()
        return parser.parse(raw_output)

    def generate_report(self, raw_output: str):
        report = SQLMapReportGenerator()
        return report.generate(raw_output)