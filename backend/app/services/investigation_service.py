"""Investigation Service for Sentinel Scanner Intelligence.

Coordinates evidence bundle compilation, GT-Beta AI inference (when enabled)
with guaranteed deterministic rule-based fallback, schema-level validation,
and automated scanner-specific alert/incident generation (§7.5 - §7.7 of Plan).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
import httpx

from app.config.runtime import get_runtime_config
from app.database.database import SessionLocal
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.investigation import Investigation
from app.models.investigation_job import InvestigationJob
from app.services.evidence_bundle_service import build_evidence_bundle

logger = logging.getLogger(__name__)


def deterministic_analyze_investigation(bundle: dict[str, Any]) -> dict[str, Any]:
    """Purely deterministic, rule-based security assessment of a scanner evidence bundle.
    
    Guarantees reliable, unhallucinated analysis when AI Analyst is disabled or unavailable.
    """
    findings = bundle.get("findings", [])
    total_count = bundle.get("total_findings_count", len(findings))
    engine = (bundle.get("engine") or "scanner").upper()
    target = bundle.get("target") or "target"

    crit_count = sum(1 for f in findings if (f.get("severity") or "").lower() == "critical")
    high_count = sum(1 for f in findings if (f.get("severity") or "").lower() == "high")
    med_count = sum(1 for f in findings if (f.get("severity") or "").lower() == "medium")
    low_count = sum(1 for f in findings if (f.get("severity") or "").lower() == "low")

    if crit_count > 0:
        risk_level = "CRITICAL"
        confidence = 0.95
        evidence_status = "confirmed_by_scanner"
        summary = f"{engine} detected {crit_count} critical and {high_count} high severity vulnerabilities on {target}. Immediate remediation required."
    elif high_count > 0:
        risk_level = "HIGH"
        confidence = 0.90
        evidence_status = "confirmed_by_scanner"
        summary = f"{engine} identified {high_count} high severity security issues on {target}. Remediation recommended."
    elif med_count > 0:
        risk_level = "MEDIUM"
        confidence = 0.85
        evidence_status = "confirmed_by_scanner"
        summary = f"{engine} identified {med_count} medium severity configuration or service exposures on {target}."
    elif total_count > 0:
        risk_level = "LOW"
        confidence = 0.80
        evidence_status = "confirmed_by_scanner"
        summary = f"{engine} reported {total_count} low or informational observations on {target}. Posture is acceptable."
    else:
        risk_level = "LOW"
        confidence = 1.0
        evidence_status = "insufficient_evidence"
        summary = f"{engine} scan completed on {target} with zero vulnerabilities identified."

    prioritized = []
    remediation_plan = []
    for rank, f in enumerate(findings, start=1):
        f_id = f.get("finding_id")
        f_title = f.get("title", "Finding")
        f_sev = (f.get("severity") or "info").upper()
        f_cat = f.get("category", "general")

        prioritized.append({
            "finding_id": f_id,
            "priority_rank": rank,
            "severity": f_sev,
            "title": f_title,
            "why_it_matters": f"Severity {f_sev}: {f.get('description_excerpt') or f_title}",
            "evidence_refs": [f"obs_finding_{f_id}"],
        })

        # Suggest standard remediation per category
        if "tls" in f_cat or "ssl" in f_cat:
            rec_action = f"Renew or replace certificate for {f.get('affected_asset', {}).get('value', target)} with a valid CA-signed certificate."
            verification = "Re-run SSL/TLS inspection scan to verify TLS handshake and trust chain."
        elif "injection" in f_cat:
            rec_action = f"Implement parameterized queries and input validation on affected endpoint."
            verification = "Run follow-up targeted inspection to confirm injection mitigation."
        elif "service" in f_cat or "port" in f_cat:
            rec_action = f"Restrict firewall access or close unnecessary port {f.get('affected_asset', {}).get('value')}."
            verification = "Run Nmap port verification to ensure port is closed or filtered."
        else:
            rec_action = f"Review and patch {f_title} following vendor security advisories."
            verification = "Execute follow-up scanner test to confirm finding resolution."

        remediation_plan.append({
            "step": rank,
            "finding_id": f_id,
            "title": f_title,
            "action": rec_action,
            "verification": verification,
        })

    should_alert = risk_level in {"HIGH", "CRITICAL"}

    return {
        "schema_version": 1,
        "investigation_id": bundle.get("investigation_id"),
        "generated_by": "deterministic",
        "overall_assessment": {
            "risk_level": risk_level,
            "summary": summary,
            "confidence": confidence,
            "evidence_status": evidence_status,
        },
        "prioritized_findings": prioritized,
        "remediation_plan": remediation_plan,
        "alert_recommendation": {
            "should_alert": should_alert,
            "threat_level": risk_level,
            "reason": summary if should_alert else "Risk level does not exceed alert threshold.",
        },
    }


def validate_investigation_report(data: dict[str, Any], bundle: dict[str, Any]) -> bool:
    """Validate external model response against strict schema and hallucination guards (§7.5)."""
    if not isinstance(data, dict):
        return False

    overall = data.get("overall_assessment")
    if not isinstance(overall, dict):
        return False

    risk_level = str(overall.get("risk_level", "")).upper()
    if risk_level not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        return False

    valid_finding_ids = {f["finding_id"] for f in bundle.get("findings", []) if "finding_id" in f}

    # Verify prioritized findings do NOT contain hallucinated finding IDs
    prioritized = data.get("prioritized_findings", [])
    if isinstance(prioritized, list):
        for pf in prioritized:
            if not isinstance(pf, dict):
                return False
            fid = pf.get("finding_id")
            if fid is not None and fid not in valid_finding_ids:
                logger.warning("Rejected AI report: hallucinated finding_id %s not in bundle manifest", fid)
                return False

    return True


def _call_gt_beta_scanner_inference(config, bundle: dict[str, Any]) -> tuple[bool, dict[str, Any] | None, str]:
    """Execute HTTP call to GT-Beta inference server for a scanner evidence bundle."""
    url = config.ai_analyst_url
    timeout = config.ai_analyst_timeout
    payload = {
        "task": "scanner_investigation",
        "schema_version": 1,
        "investigation_id": bundle.get("investigation_id"),
        "bundle": bundle,
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            if 400 <= resp.status_code < 500:
                logger.warning("AI Analyst returned client error %d", resp.status_code)
                return False, None, f"HTTP_{resp.status_code}"
            resp.raise_for_status()
            data = resp.json()

            if not isinstance(data, dict):
                return False, None, "BAD_RESPONSE"

            # Validate against hallucination and schema guards
            if not validate_investigation_report(data, bundle):
                return False, None, "FAILED_VALIDATION"

            data["generated_by"] = "main_analyst"
            return True, data, "OK"

    except httpx.TimeoutException:
        logger.warning("GT-Beta scanner inference timed out after %ds", timeout)
        return False, None, "TIMEOUT"
    except httpx.ConnectError:
        logger.warning("GT-Beta scanner inference connection refused")
        return False, None, "UNAVAILABLE"
    except Exception as exc:
        logger.warning("GT-Beta scanner inference failed: %s", exc)
        return False, None, "INFERENCE_ERROR"


def process_investigation_job(job_id: int) -> bool:
    """Process an InvestigationJob from the queue with safe retries and deterministic fallback."""
    db = SessionLocal()
    try:
        db.info["system_scope"] = True
        job = db.query(InvestigationJob).filter(InvestigationJob.id == job_id).first()
        if not job or job.status in {"SUCCEEDED", "FAILED"}:
            return False

        now = datetime.utcnow()
        job.status = "RUNNING"
        job.attempts = (job.attempts or 0) + 1
        job.started_at = now
        db.commit()

        inv = db.query(Investigation).filter(Investigation.id == job.investigation_id).first()
        if not inv:
            job.status = "FAILED"
            job.last_error_code = "INVESTIGATION_NOT_FOUND"
            job.completed_at = now
            db.commit()
            return False

        inv.status = "RUNNING"
        db.commit()

        # Build bounded evidence bundle
        bundle = build_evidence_bundle(inv.id, db)
        inv.evidence_bundle = bundle
        db.commit()

        config = get_runtime_config()
        report = None

        # Attempt AI analysis if enabled
        if config.ai_analyst_enabled:
            success, ai_report, err_code = _call_gt_beta_scanner_inference(config, bundle)
            if success and ai_report:
                report = ai_report
            else:
                logger.info("AI Analyst unavailable or invalid (%s); falling back to deterministic report", err_code)
                report = deterministic_analyze_investigation(bundle)
        else:
            report = deterministic_analyze_investigation(bundle)

        # Persist investigation outcome
        overall = report.get("overall_assessment", {})
        inv.report = report
        inv.summary = overall.get("summary")
        inv.risk_level = overall.get("risk_level")
        inv.confidence = float(overall.get("confidence", 0.9))
        inv.evidence_status = overall.get("evidence_status")
        inv.generated_by = report.get("generated_by", "deterministic")
        inv.status = "COMPLETED"
        inv.completed_at = now

        job.status = "SUCCEEDED"
        job.completed_at = now
        db.commit()

        # Check alert recommendation
        alert_rec = report.get("alert_recommendation", {})
        if alert_rec.get("should_alert"):
            # Check if alert already exists for this investigation
            existing_alert = (
                db.query(Alert)
                .filter(
                    Alert.investigation_id == inv.id,
                    Alert.organization_id == inv.organization_id,
                )
                .first()
            )
            if not existing_alert:
                alert = Alert(
                    organization_id=inv.organization_id,
                    website_id=inv.website_id,
                    source_type="scanner",
                    scan_id=inv.trigger_scan_id,
                    investigation_id=inv.id,
                    threat_level=overall.get("risk_level", "HIGH"),
                    message=f"[{bundle.get('engine', 'SCANNER').upper()}] {overall.get('summary')}",
                    created_at=now,
                )
                db.add(alert)
                db.flush()

                # If Critical, also create an Incident
                if overall.get("risk_level") == "CRITICAL":
                    inc_code = f"INC-SCN-{inv.id:04d}"
                    existing_inc = db.query(Incident).filter(Incident.incident_code == inc_code).first()
                    if not existing_inc:
                        incident = Incident(
                            organization_id=inv.organization_id,
                            website_id=inv.website_id,
                            alert_id=alert.id,
                            investigation_id=inv.id,
                            incident_code=inc_code,
                            title=f"Critical Scanner Finding: {bundle.get('target')}",
                            description=overall.get("summary"),
                            threat_level="CRITICAL",
                            priority="P1",
                            status="Open",
                            target=bundle.get("target"),
                            confidence=int(float(overall.get("confidence", 0.9)) * 100),
                            created_at=now,
                            updated_at=now,
                        )
                        db.add(incident)

                db.commit()

        return True

    except Exception as exc:
        db.rollback()
        logger.error("Error processing investigation job %s: %s", job_id, exc)
        try:
            job = db.query(InvestigationJob).filter(InvestigationJob.id == job_id).first()
            if job:
                job.status = "FAILED"
                job.last_error_code = str(exc)[:50]
                job.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
        return False
    finally:
        db.close()
