import os
import subprocess
from datetime import datetime, timedelta

from app.database.database import SessionLocal
from app.models.scan_result import ScanResult

SQLMAP_PATH = os.path.join("C:\\", "Users", "omkar", "sqlmap", "sqlmap.py")


def process_sqlmap_scan(scan_id: int):
    db = SessionLocal()

    try:
        scan = db.query(ScanResult).filter(ScanResult.id == scan_id).first()

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
                scan.status = "COMPLETED"
                scan.findings = result.stdout[:4000]
            else:
                scan.status = "FAILED"
                scan.findings = result.stderr[:4000]

        except Exception as error:
            db.refresh(scan)

            if scan.status == "CANCELLED":
                return

            scan.status = "FAILED"
            scan.findings = str(error)[:4000]

        scan.completed_at = (
            datetime.utcnow() + timedelta(hours=5, minutes=30)
        )

        db.commit()

    finally:
        db.close()

