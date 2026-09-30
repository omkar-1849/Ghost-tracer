from app.services.audit_log_service import create_audit_log
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.scanner_mixin import ScannerJobMixin
from app.services.scanners.sqlmap.parser import SQLMapParser
from app.services.scanners.sqlmap.report import SQLMapReportGenerator
from app.utils.scanner_utils import (
    clean_output, resolve_binary, run_subprocess,
)


class SQLMapScanner(BaseScanner, ScannerJobMixin):
    name = "SQLMap"

    def start_scan(self, scan_id: int, worker_id: str | None = None) -> None:
        db, scan = self.begin_job(scan_id, worker_id)
        if db is None:
            return
        try:
            binary = resolve_binary("sqlmap")
            if not binary:
                self.fail_job(db, scan, self.missing_binary_error("sqlmap"))
                return

            cmd = [binary, "-u", scan.target, "--batch", "--flush-session"]
            self.set_command(db, scan, " ".join(cmd))

            result = run_subprocess(cmd, timeout=1800, cancelled=lambda: self.is_cancelled(db, scan))
            if self.is_cancelled(db, scan):
                return

            if result["success"]:
                raw_output = clean_output(result["stdout"])
                parsed = self.parse_output(raw_output)
                report = self.generate_report(raw_output)

                # Count findings from parsed data
                finding_count = 0
                parsed_findings = parsed.get("findings", {})
                if isinstance(parsed_findings, dict):
                    if parsed_findings.get("injectable"):
                        finding_count += 1
                    finding_count += len(parsed_findings.get("warnings", []))
                    finding_count += len(parsed_findings.get("critical", []))
                    finding_count += len(parsed_findings.get("databases", []))

                # A parse failure is never reported as a clean completed scan.
                if parsed.get("parse_error") or result["stdout_truncated"]:
                    self.fail_job(
                        db, scan,
                        "sqlmap output could not be fully parsed (possibly truncated).",
                        raw_output=raw_output,
                        truncated=result["stdout_truncated"],
                    )
                    return

                # Risk score based on parsed summary
                risk_label = parsed.get("summary", {}).get("risk", "Low")
                risk_map = {"High": 85, "Medium": 50, "Low": 15}

                self.complete_job(
                    db, scan,
                    findings=finding_count,
                    risk_score=risk_map.get(risk_label, 15),
                    raw_output=raw_output,
                    parsed_output=report,
                    truncated=result["stdout_truncated"],
                )
            else:
                # Nonzero exit / timeout / spawn failure: explicit Failed with
                # redacted error; raw output retained for evidence.
                raw_output = clean_output(result["stderr"]) or clean_output(result["stdout"])
                message = (
                    f"sqlmap exited with code {result['returncode']}."
                    if result["error"] is None
                    else result["error"]
                )
                self.fail_job(db, scan, message,
                              raw_output=raw_output,
                              truncated=result["stdout_truncated"] or result["stderr_truncated"])
        except Exception:
            self.fail_job(db, scan, "Unexpected scanner failure.")
        finally:
            db.close()

    def parse_output(self, raw_output: str) -> dict:
        parser = SQLMapParser()
        return parser.parse(raw_output)

    def generate_report(self, raw_output: str) -> dict:
        report = SQLMapReportGenerator()
        return report.generate(raw_output)
