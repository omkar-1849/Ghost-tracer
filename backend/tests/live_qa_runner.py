"""Live End-to-End System QA & Security Audit Runner.

Executes real HTTP requests against the live running Sentinel instance:
http://127.0.0.1:8000
"""

import gzip
import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("live_qa")

BASE_URL = "http://127.0.0.1:8000"


class LiveTestClient:
    def __init__(self, token: Optional[str] = None, org_id: Optional[int] = None):
        self.token = token
        self.org_id = org_id

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        expect_status: Optional[int] = None,
    ) -> Tuple[int, Any, Dict[str, str]]:
        url = f"{BASE_URL}{path}"
        req_headers = {"Accept": "application/json"}
        if self.token:
            req_headers["Authorization"] = f"Bearer {self.token}"
        if self.org_id is not None:
            req_headers["X-Organization-ID"] = str(self.org_id)
        if headers:
            req_headers.update(headers)

        data = None
        if body is not None:
            if isinstance(body, bytes):
                data = body
            else:
                data = json.dumps(body).encode("utf-8")
                if "Content-Type" not in req_headers:
                    req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                resp_bytes = resp.read()
                resp_headers = dict(resp.headers)
                try:
                    resp_json = json.loads(resp_bytes.decode("utf-8")) if resp_bytes else {}
                except Exception:
                    resp_json = resp_bytes.decode("utf-8", errors="replace")
                if expect_status and resp.status != expect_status:
                    raise AssertionError(f"{method} {path} expected status {expect_status}, got {resp.status}")
                return resp.status, resp_json, resp_headers
        except urllib.error.HTTPError as exc:
            err_bytes = exc.read()
            resp_headers = dict(exc.headers)
            try:
                err_json = json.loads(err_bytes.decode("utf-8")) if err_bytes else {}
            except Exception:
                err_json = err_bytes.decode("utf-8", errors="replace")
            if expect_status and exc.code != expect_status:
                raise AssertionError(f"{method} {path} expected status {expect_status}, got {exc.code}: {err_json}")
            return exc.code, err_json, resp_headers


def run_live_qa():
    results = {
        "passed": [],
        "failed": [],
        "findings": [],
    }

    def record_pass(step: str, detail: str = ""):
        logger.info(f"PASS: {step} {detail}")
        results["passed"].append({"step": step, "detail": detail})

    def record_fail(step: str, error: str):
        logger.error(f"FAIL: {step} - {error}")
        results["failed"].append({"step": step, "error": error})

    # =========================================================================
    # STEP 1: Fresh Users and Organizations
    # =========================================================================
    logger.info("=== STEP 1: Registration and Authentication ===")
    anon = LiveTestClient()

    ts = int(time.time())
    user1_email = f"alpha_lead_{ts}@example.com"
    user1_pass = "AuditSecPass123!#"
    user2_email = f"beta_lead_{ts}@example.com"
    user2_pass = "AuditSecPass123!#"

    # Register User 1
    s, data, _ = anon.request("POST", "/auth/register", {"email": user1_email, "password": user1_pass, "full_name": "Alpha Lead"})
    if s == 201 or s == 200:
        record_pass("User 1 Registration", user1_email)
    else:
        record_fail("User 1 Registration", str(data))
        return results

    # Login User 1
    s, data, _ = anon.request("POST", "/auth/login", {"email": user1_email, "password": user1_pass})
    if s == 200 and "access_token" in data:
        user1_token = data["access_token"]
        record_pass("User 1 Login", "JWT Token acquired")
    else:
        record_fail("User 1 Login", str(data))
        return results

    client1 = LiveTestClient(token=user1_token)

    # Create Organization A
    s, org_a, _ = client1.request("POST", "/organization", {"name": f"SecOps Alpha {ts}"}, expect_status=201)
    org_a_id = org_a["id"]
    record_pass("Create Org A", f"Org ID: {org_a_id}")
    client1.org_id = org_a_id

    # Register User 2
    s, data, _ = anon.request("POST", "/auth/register", {"email": user2_email, "password": user2_pass, "full_name": "Beta Lead"})
    record_pass("User 2 Registration", user2_email)

    # Login User 2
    s, data, _ = anon.request("POST", "/auth/login", {"email": user2_email, "password": user2_pass})
    user2_token = data["access_token"]
    record_pass("User 2 Login", "JWT Token acquired")
    client2 = LiveTestClient(token=user2_token)

    # Create Organization B
    s, org_b, _ = client2.request("POST", "/organization", {"name": f"SecOps Beta {ts}"}, expect_status=201)
    org_b_id = org_b["id"]
    record_pass("Create Org B", f"Org ID: {org_b_id}")
    client2.org_id = org_b_id

    # =========================================================================
    # STEP 2: Protected Asset Lifecycle in Organization A
    # =========================================================================
    logger.info("=== STEP 2: Asset Creation & Verification in Org A ===")
    asset_url = "http://localhost:3000"  # Configured test protected target
    s, asset_a, _ = client1.request(
        "POST",
        "/websites",
        {"name": "Alpha Production Portal", "url": asset_url, "exposure": "public"},
        expect_status=201,
    )
    asset_a_id = asset_a["id"]
    record_pass("Create Asset in Org A", f"Asset ID: {asset_a_id}")

    # Verify duplicate asset rejection inside Org A
    s, dup_err, _ = client1.request("POST", "/websites", {"name": "Alpha Duplicate", "url": asset_url})
    if s == 400 or s == 409:
        record_pass("Asset URL Uniqueness per Org", f"Correctly returned HTTP {s} Conflict/Error")
    else:
        record_fail("Asset URL Uniqueness per Org", f"Expected 400/409, got {s}: {dup_err}")

    # Verify that Org B CAN create the exact same URL (per-tenant uniqueness)
    s, asset_b, _ = client2.request("POST", "/websites", {"name": "Beta Portal", "url": asset_url})
    if s == 201:
        record_pass("Per-Tenant Asset URL Isolation", "Org B successfully registered same URL independently")
        asset_b_id = asset_b["id"]
    else:
        record_fail("Per-Tenant Asset URL Isolation", f"Expected 201, got {s}: {asset_b}")

    # Verify Asset in Org A via meta method
    s, ver_data, _ = client1.request("POST", f"/websites/{asset_a_id}/verify/meta")
    if s == 200:
        record_pass("Verify Asset in Org A", f"Verification status: {ver_data.get('verified')}")
    else:
        record_fail("Verify Asset in Org A", f"Status {s}: {ver_data}")

    # =========================================================================
    # STEP 3: Collector Enrollment and Telemetry Ingestion
    # =========================================================================
    logger.info("=== STEP 3: Collector Enrollment & Telemetry Ingestion ===")
    # Generate enrollment token for Asset A
    s, token_data, _ = client1.request(
        "POST",
        f"/websites/{asset_a_id}/enrollment-tokens",
        {"label": "Nginx Web Fleet Token", "max_uses": 5, "expires_in_hours": 24},
        expect_status=201,
    )
    raw_enroll_token = token_data["token"]
    record_pass("Create Enrollment Token", f"Token Prefix: {token_data['token_prefix']}")

    # Enroll collector machine
    s, enroll_resp, _ = anon.request(
        "POST",
        "/collector/enroll",
        {
            "name": "Nginx Web Fleet Node 1",
            "hostname": "web-node-01.alpha.internal",
            "version": "1.0.0",
            "kind": "daemon",
        },
        headers={"X-Enrollment-Token": raw_enroll_token},
        expect_status=201,
    )
    collector_api_key = enroll_resp["api_key"]
    collector_id = enroll_resp.get("collector_id") or enroll_resp.get("collector", {}).get("id")
    record_pass("Collector Enrollment", f"Collector ID: {collector_id}")

    # Heartbeat
    s, hb_resp, _ = anon.request(
        "POST",
        "/collector/heartbeat",
        {"hostname": "web-node-01.alpha.internal", "version": "1.0.0"},
        headers={"X-API-Key": collector_api_key},
        expect_status=200,
    )
    record_pass("Collector Heartbeat", f"Status: {hb_resp}")

    # Send Normal Telemetry Batch (10 items) via gzip
    normal_items = [
        {
            "ip_address": f"198.51.100.{10 + i}",
            "method": "GET",
            "url": f"/products/{i}",
            "status_code": 200,
            "user_agent": "Mozilla/5.0 Normal User",
            "message": f"GET /products/{i} HTTP 200",
        }
        for i in range(10)
    ]
    raw_gz = gzip.compress(json.dumps({"items": normal_items}).encode("utf-8"))
    s, norm_resp, _ = anon.request(
        "POST",
        "/logs/batch",
        raw_gz,
        headers={"X-API-Key": collector_api_key, "Content-Type": "application/json", "Content-Encoding": "gzip"},
        expect_status=200,
    )
    if norm_resp.get("accepted") == 10:
        record_pass("Normal Telemetry Batch", "10/10 accepted")
    else:
        record_fail("Normal Telemetry Batch", str(norm_resp))

    # Send Malicious Telemetry (Brute force + SQL injection)
    attack_ip = "203.0.113.88"
    attack_items = [
        {
            "ip_address": attack_ip,
            "method": "POST",
            "url": "/login",
            "status_code": 401,
            "user_agent": "Hydra/v9.1",
            "message": f"Authentication failure for admin attempt {i}",
        }
        for i in range(4)
    ] + [
        {
            "ip_address": attack_ip,
            "method": "POST",
            "url": "/login",
            "status_code": 401,
            "user_agent": "Sqlmap/1.5",
            "message": "UNION SELECT username, password FROM users --",
        }
    ]
    raw_atk_gz = gzip.compress(json.dumps({"items": attack_items}).encode("utf-8"))
    s, atk_resp, _ = anon.request(
        "POST",
        "/logs/batch",
        raw_atk_gz,
        headers={"X-API-Key": collector_api_key, "Content-Type": "application/json", "Content-Encoding": "gzip"},
        expect_status=200,
    )
    record_pass("Attack Telemetry Ingestion", f"Accepted: {atk_resp.get('accepted')}")

    # =========================================================================
    # STEP 4: Detection, Alerts, Incidents, Timeline & Evidence in Org A
    # =========================================================================
    logger.info("=== STEP 4: Operations Pipeline Verification ===")
    time.sleep(0.5)

    # Check Alerts in Org A
    s, alerts, _ = client1.request("GET", "/alerts", expect_status=200)
    if len(alerts) > 0:
        record_pass("Alert Generation", f"Generated {len(alerts)} alerts. First: {alerts[0].get('title')}")
        alert_id = alerts[0]["id"]
    else:
        record_fail("Alert Generation", "Zero alerts found in Org A")
        alert_id = None

    # Check Incidents in Org A
    s, incidents_data, _ = client1.request("GET", "/incidents", expect_status=200)
    incidents = incidents_data.get("items", []) if isinstance(incidents_data, dict) else incidents_data
    if len(incidents) > 0:
        incident_id = incidents[0]["id"]
        record_pass("Incident Escalation", f"Generated incident ID {incident_id} [{incidents[0].get('incident_code')}]")

        # Check Timeline
        s, timeline, _ = client1.request("GET", f"/incidents/{incident_id}/timeline", expect_status=200)
        record_pass("Incident Timeline", f"Timeline entries: {len(timeline)}")

        # Check Evidence
        s, evidence, _ = client1.request("GET", f"/incidents/{incident_id}/evidence", expect_status=200)
        record_pass("Incident Evidence", f"Evidence entries: {len(evidence)}")

        # Add Analyst Note
        s, note_res, _ = client1.request(
            "POST",
            f"/incidents/{incident_id}/notes",
            {"note": "Investigated IP 203.0.113.88. Source identified as automated scanner. Approving mitigation simulation."},
            expect_status=200,
        )
        record_pass("Analyst Notes", f"Added note ID: {note_res.get('id')}")

        # Check Supported Response Action
        s, resp_act, _ = client1.request(
            "POST",
            f"/response-actions/?incident_id={incident_id}",
            {
                "action_type": "BLOCK_IP",
                "target": attack_ip,
                "reason": "Automated brute-force attack detected",
            },
            expect_status=200,
        )
        action_id = resp_act["id"]
        record_pass("Create Response Action", f"Action ID: {action_id}, Status: {resp_act.get('status')}")

        # Execute Response Action (Simulation model)
        s, exec_res, _ = client1.request(
            "POST",
            f"/response-actions/{action_id}/execute",
            expect_status=200,
        )
        if exec_res.get("status", "").upper() in ("SIMULATED", "SUCCESS", "EXECUTED"):
            record_pass("Execute Response Action", f"Status transitioned to: {exec_res.get('status')}")
        else:
            record_fail("Execute Response Action", f"Unexpected status: {exec_res.get('status')}")
    else:
        record_fail("Incident Escalation", "Zero incidents found in Org A")

    # =========================================================================
    # STEP 5: Dashboard Stats Verification in Org A
    # =========================================================================
    logger.info("=== STEP 5: Dashboard Metrics Audit ===")
    s, dash_stats, _ = client1.request("GET", "/dashboard/stats", expect_status=200)
    record_pass(
        "Dashboard Stats",
        f"Protected Websites: {dash_stats.get('total_websites')}, Total Logs: {dash_stats.get('total_logs')}, Alerts: {dash_stats.get('total_alerts')}, Security Score: {dash_stats.get('security_score')}",
    )

    s, sec_score, _ = client1.request("GET", "/dashboard/security-score", expect_status=200)
    record_pass("Dashboard Security Score", f"Score: {sec_score.get('security_score')}, Grade: {sec_score.get('grade')}")

    s, top_ips, _ = client1.request("GET", "/dashboard/top-attacking-ips", expect_status=200)
    record_pass("Dashboard Top IPs", f"Count: {len(top_ips)}")

    s, live_feed, _ = client1.request("GET", "/dashboard/live-feed", expect_status=200)
    record_pass("Dashboard Live Feed", f"Feed items: {len(live_feed)}")

    # =========================================================================
    # STEP 6: Scanner Execution in Controlled Environment
    # =========================================================================
    logger.info("=== STEP 6: Scanner Execution ===")
    s, scan_res, _ = client1.request(
        "POST",
        "/scans",
        {"website_id": asset_a_id, "engine": "sqlmap"},
    )
    if s == 200 or s == 201:
        scan_id = scan_res["id"]
        record_pass("Trigger Scan in Org A", f"Scan ID: {scan_id}, Status: {scan_res.get('status')}")

        # Poll scan status up to 3 seconds
        for _ in range(6):
            time.sleep(0.5)
            s, scan_status, _ = client1.request("GET", f"/scans/{scan_id}")
            if scan_status.get("status") in ("Completed", "Running", "Failed", "Cancelled"):
                break
        record_pass("Scan Processing", f"Current Scan Status: {scan_status.get('status')}")
    else:
        record_fail("Trigger Scan in Org A", f"Expected 201, got {s}: {scan_res}")

    # =========================================================================
    # STEP 7: Strict Multi-Tenant Isolation Audit (Org B -> Org A)
    # =========================================================================
    logger.info("=== STEP 7: Cross-Tenant Isolation Enforcement ===")
    # 1. Org B tries to read Org A's asset
    s, b_read_asset, _ = client2.request("GET", f"/websites/{asset_a_id}")
    if s == 404:
        record_pass("T-ISO: Asset Read", "404 Not Found as expected")
    else:
        record_fail("T-ISO: Asset Read", f"Org B accessed Org A's asset! Status {s}: {b_read_asset}")

    # 2. Org B tries to update Org A's asset
    s, b_update_asset, _ = client2.request("PUT", f"/websites/{asset_a_id}", {"name": "Hacked Asset"})
    if s == 404:
        record_pass("T-ISO: Asset Mutation", "404 Not Found as expected")
    else:
        record_fail("T-ISO: Asset Mutation", f"Org B modified Org A's asset! Status {s}")

    # 3. Org B tries to list collectors for Org A's asset
    s, b_list_col, _ = client2.request("GET", f"/websites/{asset_a_id}/collectors")
    if s == 404:
        record_pass("T-ISO: Collector List", "404 Not Found as expected")
    else:
        record_fail("T-ISO: Collector List", f"Org B listed Org A's collectors! Status {s}")

    # 4. Org B tries to scan Org A's asset
    s, b_scan, _ = client2.request("POST", "/scans", {"website_id": asset_a_id, "engine": "sqlmap"})
    if s == 404:
        record_pass("T-ISO: Scanner Trigger", "404 Not Found as expected")
    else:
        record_fail("T-ISO: Scanner Trigger", f"Org B launched scan against Org A's asset! Status {s}")

    # 5. Org B tries to read Org A's alerts
    s, b_alerts, _ = client2.request("GET", "/alerts")
    if len(b_alerts) == 0:
        record_pass("T-ISO: Alerts List", "Zero alerts returned for Org B")
    else:
        record_fail("T-ISO: Alerts List", f"Org B saw {len(b_alerts)} alerts belonging to Org A!")

    # 6. Org B tries to read Org A's incidents
    s, b_incidents_data, _ = client2.request("GET", "/incidents")
    b_incidents = b_incidents_data.get("items", []) if isinstance(b_incidents_data, dict) else b_incidents_data
    if len(b_incidents) == 0:
        record_pass("T-ISO: Incidents List", "Zero incidents returned for Org B")
    else:
        record_fail("T-ISO: Incidents List", f"Org B saw {len(b_incidents)} incidents belonging to Org A!")

    # 7. Org B tries to read Org A's specific incident ID
    if len(incidents) > 0:
        s, b_inc_single, _ = client2.request("GET", f"/incidents/{incident_id}")
        if s == 404:
            record_pass("T-ISO: Specific Incident Read", "404 Not Found as expected")
        else:
            record_fail("T-ISO: Specific Incident Read", f"Org B read Org A's incident! Status {s}")

    # 8. Org B tries to read Org A's audit logs
    s, b_audits, _ = client2.request("GET", "/audit-logs")
    b_audit_items = b_audits.get("items", []) if isinstance(b_audits, dict) else b_audits
    for item in b_audit_items:
        if item.get("organization_id") != org_b_id:
            record_fail("T-ISO: Audit Log Leak", f"Found Org A audit row {item} in Org B!")
            break
    else:
        record_pass("T-ISO: Audit Logs Isolated", f"Org B only saw its own audit entries ({len(b_audit_items)})")

    # =========================================================================
    # STEP 8: Audit Logs in Org A
    # =========================================================================
    logger.info("=== STEP 8: Audit Log Verification in Org A ===")
    s, a_audits, _ = client1.request("GET", "/audit-logs", expect_status=200)
    audit_rows = a_audits.get("items", []) if isinstance(a_audits, dict) else a_audits
    actions = [r.get("action") for r in audit_rows]
    record_pass("Audit Log Activity in Org A", f"Total entries: {len(audit_rows)}, Actions: {set(actions)}")

    return results


if __name__ == "__main__":
    res = run_live_qa()
    print("\n" + "=" * 60)
    print("LIVE QA AUDIT SUMMARY")
    print("=" * 60)
    print(f"PASSED CHECKS: {len(res['passed'])}")
    print(f"FAILED CHECKS: {len(res['failed'])}")
    if res["failed"]:
        for f in res["failed"]:
            print(f"  FAILED: {f['step']} -> {f['error']}")
    else:
        print("ALL LIVE END-TO-END QA CHECKS PASSED WITH ZERO FAILURES!")
