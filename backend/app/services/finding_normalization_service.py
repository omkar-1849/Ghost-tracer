"""Finding Normalization Service.

Normalizes raw scanner outputs into queryable ScannerFinding and
ScannerFindingObservation records with deterministic deduplication fingerprints,
and schedules an Investigation with an InvestigationJob (§8.1 of Implementation Plan).
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any

from app.database.database import SessionLocal
from app.models.investigation import Investigation
from app.models.investigation_job import InvestigationJob
from app.models.scan import Scan
from app.models.scanner_finding import ScannerFinding
from app.models.scanner_finding_observation import ScannerFindingObservation
from app.utils.scanner_utils import extract_host_port

logger = logging.getLogger(__name__)


def compute_finding_fingerprint(
    website_id: int,
    engine: str,
    category: str,
    title: str,
    asset_value: str,
) -> str:
    """Deterministic fingerprint to match recurring findings across scans."""
    raw = f"{website_id}:{engine.lower()}:{category.lower()}:{title.strip().lower()}:{asset_value.strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def normalize_finding_item(engine: str, item: dict[str, Any], scan: Scan) -> dict[str, Any]:
    """Map scanner-specific finding dict into normalized fields."""
    engine_lower = (engine or "unknown").lower()
    title = item.get("title") or item.get("name") or "Security Finding"
    description = item.get("description") or item.get("desc") or ""
    severity = (item.get("severity") or "info").lower()
    if severity not in {"critical", "high", "medium", "low", "info"}:
        severity = "info"

    # Default category & severity_basis based on engine
    if engine_lower == "ssl":
        category = item.get("category") or "tls_configuration"
        severity_basis = "deterministic_rule"
        host, port = extract_host_port(scan.target)
        asset = {"type": "host_port", "value": f"{host}:{port or 443}", "host": host, "port": port or 443}
    elif engine_lower == "nmap":
        category = item.get("category") or "exposed_service"
        severity_basis = "heuristic_exposure"
        port = item.get("port")
        host, _ = extract_host_port(scan.target)
        asset = {"type": "host_port", "value": f"{host}:{port}" if port else host, "host": host, "port": port}
    elif engine_lower == "nuclei":
        category = item.get("category") or "vulnerability"
        severity_basis = "scanner_declared"
        url = item.get("matched_at") or scan.target
        host, port = extract_host_port(url)
        asset = {"type": "url", "value": url, "host": host, "port": port}
    elif engine_lower == "nikto":
        category = item.get("category") or "configuration_exposure"
        severity_basis = "scanner_declared"
        uri = item.get("uri") or item.get("url") or scan.target
        host, port = extract_host_port(scan.target)
        asset = {"type": "url", "value": uri, "host": host, "port": port}
    elif engine_lower == "zap":
        category = item.get("category") or "web_application_vulnerability"
        severity_basis = "scanner_declared"
        url = item.get("url") or scan.target
        host, port = extract_host_port(url)
        asset = {"type": "url", "value": url, "host": host, "port": port}
    elif engine_lower == "sqlmap":
        category = item.get("category") or "injection"
        severity_basis = "scanner_declared"
        host, port = extract_host_port(scan.target)
        asset = {"type": "url", "value": scan.target, "host": host, "port": port}
    else:
        category = item.get("category") or "general_finding"
        severity_basis = "scanner_declared"
        host, port = extract_host_port(scan.target)
        asset = {"type": "target", "value": scan.target, "host": host, "port": port}

    cwe = item.get("cwe")
    if isinstance(cwe, str):
        cwe = [cwe]
    elif not isinstance(cwe, list):
        cwe = []

    cve = item.get("cve")
    if isinstance(cve, str):
        cve = [cve]
    elif not isinstance(cve, list):
        cve = []

    confidence = float(item.get("confidence", 1.0) or 1.0)
    rule_id = str(item.get("template_id") or item.get("rule_id") or item.get("id") or "")

    return {
        "title": title,
        "description": description,
        "category": category,
        "severity": severity,
        "severity_basis": severity_basis,
        "confidence": confidence,
        "affected_asset": asset,
        "cwe": cwe,
        "cve": cve,
        "scanner_rule_id": rule_id,
        "raw_evidence": item,
    }


def process_completed_scan(scan_id: int) -> int | None:
    """Ingest and normalize findings from a completed scan into the database.

    Returns the created Investigation.id, or None if skipped.
    """
    db = SessionLocal()
    try:
        db.info["system_scope"] = True
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan or scan.status != "Completed":
            logger.info("Scan %s is not in Completed status; skipping normalization", scan_id)
            return None

        if scan.normalization_status == "COMPLETED":
            logger.info("Scan %s already normalized; skipping duplicate run", scan_id)
            return None

        scan.normalization_status = "RUNNING"
        db.commit()

        parsed_output = scan.parsed_output or {}
        raw_findings = parsed_output.get("findings", [])
        if not isinstance(raw_findings, list):
            raw_findings = []

        now = datetime.utcnow()
        max_severity = "info"
        created_or_updated_finding_ids = []

        for item in raw_findings:
            if not isinstance(item, dict):
                continue
            norm = normalize_finding_item(scan.engine, item, scan)

            # Track highest severity for investigation risk level
            sev = norm["severity"]
            if sev == "critical":
                max_severity = "critical"
            elif sev == "high" and max_severity not in {"critical"}:
                max_severity = "high"
            elif sev == "medium" and max_severity not in {"critical", "high"}:
                max_severity = "medium"
            elif sev == "low" and max_severity not in {"critical", "high", "medium"}:
                max_severity = "low"

            fp = compute_finding_fingerprint(
                website_id=scan.website_id,
                engine=scan.engine,
                category=norm["category"],
                title=norm["title"],
                asset_value=norm["affected_asset"].get("value", ""),
            )

            # Query existing open finding for deduplication
            existing = (
                db.query(ScannerFinding)
                .filter(
                    ScannerFinding.website_id == scan.website_id,
                    ScannerFinding.organization_id == scan.organization_id,
                    ScannerFinding.fingerprint == fp,
                    ScannerFinding.status == "open",
                )
                .first()
            )

            if existing:
                existing.last_seen_at = now
                existing.seen_count = (existing.seen_count or 1) + 1
                existing.last_seen_scan_id = scan.id
                existing.description = norm["description"] or existing.description
                existing.severity = norm["severity"]
                existing.severity_basis = norm["severity_basis"]
                existing.confidence = norm["confidence"]
                finding_id = existing.id
            else:
                new_finding = ScannerFinding(
                    organization_id=scan.organization_id,
                    website_id=scan.website_id,
                    scan_id=scan.id,
                    fingerprint=fp,
                    engine=scan.engine.lower(),
                    category=norm["category"],
                    title=norm["title"],
                    description=norm["description"],
                    severity=norm["severity"],
                    severity_basis=norm["severity_basis"],
                    confidence=norm["confidence"],
                    affected_asset=norm["affected_asset"],
                    cwe=norm["cwe"],
                    cve=norm["cve"],
                    status="open",
                    first_seen_at=now,
                    last_seen_at=now,
                    seen_count=1,
                    first_seen_scan_id=scan.id,
                    last_seen_scan_id=scan.id,
                    created_at=now,
                    updated_at=now,
                )
                db.add(new_finding)
                db.flush()  # populate new_finding.id
                finding_id = new_finding.id

            created_or_updated_finding_ids.append(finding_id)

            # Record observation
            obs = ScannerFindingObservation(
                organization_id=scan.organization_id,
                finding_id=finding_id,
                scan_id=scan.id,
                engine=scan.engine.lower(),
                scanner_rule_id=norm["scanner_rule_id"],
                raw_severity=item.get("severity"),
                confidence=norm["confidence"],
                evidence_data=norm["raw_evidence"],
                observed_at=now,
            )
            db.add(obs)

        # Mark scan normalization completed
        scan.normalization_status = "COMPLETED"

        # Create Investigation record
        inv = Investigation(
            organization_id=scan.organization_id,
            website_id=scan.website_id,
            trigger_scan_id=scan.id,
            status="PENDING",
            title=f"Security Investigation: {scan.engine.upper()} scan on {scan.target}",
            risk_level=max_severity.upper(),
            created_at=now,
            updated_at=now,
        )
        db.add(inv)
        db.flush()
        inv_id = inv.id

        # Enqueue InvestigationJob
        job = InvestigationJob(
            organization_id=scan.organization_id,
            investigation_id=inv_id,
            status="PENDING",
            priority=100,
            attempts=0,
            created_at=now,
            updated_at=now,
        )
        db.add(job)
        db.flush()
        job_id = job.id
        db.commit()

        # Attempt immediate processing or trigger worker
        try:
            from app.services.investigation_service import process_investigation_job
            process_investigation_job(job_id)
        except Exception as inv_err:
            logger.warning("Investigation job %s execution deferred to background: %s", job_id, inv_err)

        return inv_id

    except Exception as exc:
        db.rollback()
        logger.error("Error processing completed scan %s: %s", scan_id, exc)
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if scan:
                scan.normalization_status = "FAILED"
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()
