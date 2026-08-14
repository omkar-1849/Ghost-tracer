import json
import os
import time
import urllib.request
import urllib.parse
from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id
from app.services.scanners.base_scanner import BaseScanner
from app.utils.scanner_utils import (
    clean_output, calculate_risk_score, ist_now,
)

class ZapScanner(BaseScanner):
    name = "ZAP"

    def start_scan(self, scan_id: int) -> None:
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if not scan or scan.status == "Cancelled":
                return
            scan.status = "Running"
            db.commit()

            zap_url = os.environ.get("ZAP_API_URL", "http://localhost:8080")
            zap_key = os.environ.get("ZAP_API_KEY", "")
            target = scan.target

            scan.command = f"ZAP API Request to {zap_url}"
            db.commit()

            def api_request(path, params=None):
                if params is None:
                    params = {}
                if zap_key:
                    params["apikey"] = zap_key
                query = urllib.parse.urlencode(params)
                url = f"{zap_url.rstrip('/')}{path}?{query}"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=15) as response:
                    return json.loads(response.read().decode('utf-8'))

            try:
                api_request("/JSON/core/view/version/")
            except Exception as e:
                scan.status = "Failed"
                scan.error = f"OWASP ZAP daemon is not reachable at {zap_url}. Please start ZAP in daemon mode."
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
                return

            try:
                # Start spider
                spider_resp = api_request("/JSON/spider/action/scan/", {"url": target})
                spider_id = spider_resp.get("scan")
                
                # Poll spider
                for _ in range(60):
                    status_resp = api_request("/JSON/spider/view/status/", {"scanId": spider_id})
                    if int(status_resp.get("status", 0)) >= 100:
                        break
                    time.sleep(2)

                # Start active scan
                ascan_resp = api_request("/JSON/ascan/action/scan/", {"url": target})
                ascan_id = ascan_resp.get("scan")

                # Poll active scan
                for _ in range(120):
                    status_resp = api_request("/JSON/ascan/view/status/", {"scanId": ascan_id})
                    if int(status_resp.get("status", 0)) >= 100:
                        break
                    time.sleep(5)

                # Get alerts
                alerts_resp = api_request("/JSON/core/view/alerts/", {"baseurl": target})
                raw_output = json.dumps(alerts_resp)

            except Exception as e:
                scan.status = "Failed"
                scan.error = f"Error during ZAP API interaction: {str(e)}"
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
                return

            parsed = self.parse_output(raw_output)
            report = self.generate_report(parsed)
            findings_list = parsed.get("findings", [])

            scan.status = "Completed"
            scan.findings = len(findings_list)
            scan.risk_score = calculate_risk_score(findings_list)
            scan.raw_output = clean_output(raw_output)
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
            pass
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
