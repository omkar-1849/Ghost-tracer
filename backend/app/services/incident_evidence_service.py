from sqlalchemy.orm import Session

from app.models.incident_evidence import IncidentEvidence


def create_evidence(
    db: Session,
    incident_id: int,
    filename: str,
    file_type: str,
    description: str,
    url: str = None,
    method: str = None,
    status_code: int = None,
    user_agent: str = None,
    ip_address: str = None,
    risk_score: int = None,
    detection_reason: str = None,
):
    evidence = IncidentEvidence(
        incident_id=incident_id,
        filename=filename,
        file_type=file_type,
        description=description,
        url=url,
        method=method,
        status_code=status_code,
        user_agent=user_agent,
        ip_address=ip_address,
        risk_score=risk_score,
        detection_reason=detection_reason,
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return evidence


def get_incident_evidence(
    db: Session,
    incident_id: int
):
    return (
        db.query(IncidentEvidence)
        .filter(IncidentEvidence.incident_id == incident_id)
        .order_by(IncidentEvidence.created_at.asc())
        .all()
    )