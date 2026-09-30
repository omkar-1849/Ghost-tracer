import json
import os
import time
import urllib.request
import urllib.parse
from urllib.parse import urlsplit
from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id
from app.services.scanners.base_scanner import BaseScanner
from app.services.scanners.scanner_mixin import ScannerJobMixin
from app.utils.destination import validate_destination
from app.utils.scanner_utils import (
    clean_output, calculate_risk_score, ist_now,
)

class ZapScanner(BaseScanner, ScannerJobMixin):
    name = "ZAP"

    def start_scan(self, scan_id: int, worker_id=None) -> None:
        """Legacy ZAP flow preserved behind explicit operator isolation config.

        Residual limitation: ZAP performs its own network activity that this
        application cannot pin or sandbox. It must run on an isolated, dedicated
        daemon instance (SENTINEL_ZAP_API_URL) and never against shared state;
        alerts are fetched scoped to this scan's target only. No global
        purge/shutdown actions are ever called.
        """
        db, scan = self.begin_job(scan_id, worker_id)
        if db is None:
            return
        spider_id = ascan_id = None
        api_request = None
        try:
            validate_destination(scan.target)
            if os.getenv("SENTINEL_SCANNER_EGRESS_ISOLATED") != "1":
                self.fail_job(db, scan,
                    "ZAP requires operator-configured egress isolation; set SENTINEL_SCANNER_EGRESS_ISOLATED=1 and run ZAP on an isolated daemon.")
                return
            zap_url = os.getenv("SENTINEL_ZAP_API_URL", "")
            zap_key = os.getenv("SENTINEL_ZAP_API_KEY", "")
            if not zap_url:
                self.fail_job(db, scan, "Set SENTINEL_ZAP_API_URL to the isolated ZAP daemon endpoint.")
                return
            parsed_url = urlsplit(zap_url)
            if parsed_url.scheme not in ("http", "https") or (parsed_url.hostname or "") not in ("127.0.0.1", "localhost", "::1"):
                self.fail_job(db, scan, "The ZAP daemon endpoint must be a local isolated instance.")
                return
            self.set_command(db, scan, "ZAP isolated instance")
            if self.is_cancelled(db, scan):
                return

            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, *args, **kwargs):
                    raise ValueError('ZAP daemon redirects are denied.')
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

            def api_request(path, params=None):
                params = dict(params or {})
                if zap_key:
                    params["apikey"] = zap_key
                url = f"{zap_url.rstrip('/')}{path}?{urllib.parse.urlencode(params)}"
                with opener.open(urllib.request.Request(url), timeout=10) as response:
                    body = response.read(50001)
                    if len(body) > 50000:
                        raise ValueError('ZAP response exceeded the capture limit.')
                    return json.loads(body.decode("utf-8"))

            try:
                api_request("/JSON/core/view/version/")
            except Exception:
                self.fail_job(db, scan, "The isolated ZAP daemon is not reachable.")
                return

            try:
                spider_id = api_request("/JSON/spider/action/scan/", {"url": scan.target}).get("scan")
                for _ in range(60):
                    if self.is_cancelled(db, scan):
                        return
                    if int(api_request("/JSON/spider/view/status/", {"scanId": spider_id}).get("status", 0)) >= 100:
                        break
                    time.sleep(2)
                else:
                    raise ValueError('ZAP spider did not reach a terminal state.')
                ascan_id = api_request("/JSON/ascan/action/scan/", {"url": scan.target}).get("scan")
                for _ in range(120):
                    if self.is_cancelled(db, scan):
                        return
                    if int(api_request("/JSON/ascan/view/status/", {"scanId": ascan_id}).get("status", 0)) >= 100:
                        break
                    time.sleep(5)
                else:
                    raise ValueError('ZAP scan did not reach a terminal state.')
                raw_output = json.dumps(api_request("/JSON/core/view/alerts/", {"baseurl": scan.target}))
            except Exception:
                self.fail_job(db, scan, "The isolated ZAP instance reported an error during the scan.")
                return
            if self.is_cancelled(db, scan):
                return

            parsed = self.parse_output(raw_output)
            if parsed.get("parse_error"):
                self.fail_job(db, scan, "ZAP output could not be parsed.", raw_output=raw_output)
                return
            self.complete_job(db, scan, findings=len(parsed["findings"]),
                risk_score=calculate_risk_score(parsed["findings"]),
                raw_output=raw_output, parsed_output=self.generate_report(parsed))
        except Exception:
            self.fail_job(db, scan, "ZAP scan failed securely.")
        finally:
            # Only this job's IDs; never stop all scans or purge shared state.
            if api_request is not None:
                for component, job_id in (("spider", spider_id), ("ascan", ascan_id)):
                    if job_id is not None and str(job_id).isdigit():
                        try:
                            api_request(f"/JSON/{component}/action/stop/", {"scanId": job_id})
                        except Exception:
                            pass
            db.close()

    def parse_output(self, raw_output: str) -> dict:
        parsed_data = {"findings": []}
        try:
            data = json.loads(raw_output)
            alerts = data.get("alerts", [])
            for alert in alerts:
                risk_level = alert.get("risk", "0")
                risk_map = {"0": "info", "1": "low", "2": "medium", "3": "high"}
                severity = risk_map.get(str(risk_level), "info")
                
                parsed_data["findings"].append({
                    "name": alert.get("alert", "Unknown Alert"),
                    "description": alert.get("description", ""),
                    "solution": alert.get("solution", ""),
                    "cweid": alert.get("cweid", ""),
                    "wascid": alert.get("wascid", ""),
                    "url": alert.get("url", ""),
                    "severity": severity,
                    "confidence": alert.get("confidence", "")
                })
        except json.JSONDecodeError:
            parsed_data["parse_error"] = "ZAP JSON output could not be parsed (possibly truncated)."
        return parsed_data

    def generate_report(self, parsed_data: dict) -> dict:
        findings = parsed_data.get("findings", [])
        risk_breakdown = {"high": 0, "medium": 0, "low": 0, "info": 0}
        for finding in findings:
            sev = finding.get("severity", "info")
            if sev in risk_breakdown:
                risk_breakdown[sev] += 1
                
        return {
            "scanner": self.name,
            "summary": "OWASP ZAP Active Scan Results",
            "total_alerts": len(findings),
            "risk_breakdown": risk_breakdown,
            "findings": findings,
            "recommendations": [
                "Review high and medium risk alerts immediately.",
                "Apply recommended solutions provided in the findings."
            ]
        }
