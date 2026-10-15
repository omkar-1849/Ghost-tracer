"""Evidence Bundle Builder for Scanner Investigations.

Deterministic, bounded context construction enforcing strict token/character caps
and prompt-injection safety (§7.3 of Sentinel Scanner Intelligence Plan).
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.investigation import Investigation
from app.models.scan import Scan
from app.models.scanner_finding import ScannerFinding
from app.models.scanner_finding_observation import ScannerFindingObservation


SEVERITY_ORDER = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
    "info": 0,
}

MAX_BUNDLE_FINDINGS = 15
MAX_EXCERPT_CHARS = 400


def _clean_excerpt(text: str | None, max_len: int = MAX_EXCERPT_CHARS) -> str:
    if not text:
        return ""
    # Strip non-printable and control characters except basic whitespace
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(text))
    cleaned = " ".join(cleaned.split())
    if len(cleaned) > max_len:
        return cleaned[:max_len] + "... [truncated]"
    return cleaned


def build_evidence_bundle(investigation_id: int, db: Session) -> dict[str, Any]:
    """Build a deterministic, bounded evidence bundle for an investigation."""
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        raise ValueError(f"Investigation {investigation_id} not found")

    trigger_scan = None
    if inv.trigger_scan_id:
        trigger_scan = db.query(Scan).filter(Scan.id == inv.trigger_scan_id).first()

    target = trigger_scan.target if trigger_scan else (inv.website.url if inv.website else "unknown")
    engine = trigger_scan.engine if trigger_scan else "unknown"

    # Query all findings linked to this trigger scan or open on this website
    findings_query = (
        db.query(ScannerFinding)
        .filter(
            ScannerFinding.website_id == inv.website_id,
            ScannerFinding.organization_id == inv.organization_id,
        )
    )
    if inv.trigger_scan_id:
        findings_query = findings_query.filter(
            (ScannerFinding.last_seen_scan_id == inv.trigger_scan_id) |
            (ScannerFinding.status == "open")
        )

    all_findings = findings_query.all()

    # Sort deterministically by severity weight DESC, confidence DESC, id ASC
    sorted_findings = sorted(
        all_findings,
        key=lambda f: (
            SEVERITY_ORDER.get((f.severity or "").lower(), 0),
            f.confidence or 0.0,
            -(f.id or 0),
        ),
        reverse=True,
    )

    selected_findings = sorted_findings[:MAX_BUNDLE_FINDINGS]
    omitted_findings = sorted_findings[MAX_BUNDLE_FINDINGS:]

    omitted_by_sev: dict[str, int] = {}
    for om in omitted_findings:
        sev = (om.severity or "unknown").lower()
        omitted_by_sev[sev] = omitted_by_sev.get(sev, 0) + 1

    bundle_items = []
    for f in selected_findings:
        obs_count = (
            db.query(ScannerFindingObservation)
            .filter(ScannerFindingObservation.finding_id == f.id)
            .count()
        )
        bundle_items.append({
            "finding_id": f.id,
            "engine": f.engine,
            "category": f.category,
            "title": f.title,
            "severity": f.severity,
            "severity_basis": f.severity_basis or "scanner_declared",
            "confidence": f.confidence,
            "status": f.status,
            "affected_asset": f.affected_asset or {"type": "target", "value": target},
            "description_excerpt": _clean_excerpt(f.description),
            "observations_count": obs_count,
            "seen_count": f.seen_count,
            "first_seen_at": f.first_seen_at.isoformat() if f.first_seen_at else None,
            "last_seen_at": f.last_seen_at.isoformat() if f.last_seen_at else None,
        })

    bundle_data = {
        "investigation_id": inv.id,
        "website_id": inv.website_id,
        "organization_id": inv.organization_id,
        "target": target,
        "engine": engine,
        "scan_id": inv.trigger_scan_id,
        "total_findings_count": len(all_findings),
        "selected_findings_count": len(bundle_items),
        "findings": bundle_items,
        "omitted": {
            "omitted_count": len(omitted_findings),
            "by_severity": omitted_by_sev,
        },
    }

    bundle_bytes = json.dumps(bundle_data, sort_keys=True).encode("utf-8")
    bundle_data["bundle_sha256"] = hashlib.sha256(bundle_bytes).hexdigest()
    return bundle_data
