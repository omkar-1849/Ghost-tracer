from sqlalchemy.orm import Session

from app.models.event import Event

from app.services.event_normalizer import normalize_security_event
from app.services.deduplication_service import (
    generate_event_fingerprint,
    is_duplicate_event,
)
from app.services.enrichment_service import enrich_event
from app.services.detection_service import detect_event
from app.services.risk_service import calculate_risk
from app.services.alert_service import create_alert
from app.services.ai_analyst_service import analyze_security_event
from app.schemas.ai_analyst_schema import AIAnalystInput
from app.services.response_policy_service import validate_response_action
from app.services.response_action_service import create_response_action


def create_event(
    db: Session,
    integration,
    event_data,
):
    fingerprint = generate_event_fingerprint(
        {
            "source": event_data.source,
            "event_type": event_data.event_type,
            "ip_address": event_data.ip_address,
            "title": event_data.title,
            "event_metadata": event_data.event_metadata,
        }
    )

    existing_event = (
        db.query(Event)
        .filter(
            Event.website_id == integration.website_id,
        )
        .order_by(Event.created_at.desc())
        .all()
    )

    if existing_event:
        latest_event = existing_event[0]

        duplicate = is_duplicate_event(
            db=db,
            website_id=integration.website_id,
            fingerprint=fingerprint,
            timestamp=latest_event.created_at,
        )

        if duplicate:
            print("DUPLICATE EVENT DETECTED")
            print("RETURNING EXISTING EVENT:", latest_event.id)
            return latest_event
    print("NEW EVENT - CONTINUING SECURITY PIPELINE")
    event = Event(
        website_id=integration.website_id,
        integration_id=integration.id,
        event_type=event_data.event_type,
        severity=event_data.severity,
        source=event_data.source,
        title=event_data.title,
        description=event_data.description,
        ip_address=event_data.ip_address,
        user_agent=event_data.user_agent,
        event_metadata=event_data.event_metadata,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    canonical_event = normalize_security_event(
        {
            "event_id": event.id,
            "timestamp": event.created_at,
            "source": event.source,
            "source_type": event.source,
            "event_type": event.event_type,
            "severity": event.severity,
            "ip_address": event.ip_address,
            "user_agent": event.user_agent,
            "title": event.title,
            "description": event.description,
            "event_metadata": event.event_metadata,
        }
    )

    enriched_event = enrich_event(canonical_event)

    detection_result = detect_event(enriched_event)

    risk_input = {
        "event": (
            f"{enriched_event.event_type} "
            f"{enriched_event.title or ''} "
            f"{enriched_event.description or ''}"
        ),
        "status_code": enriched_event.status_code,
        "url": enriched_event.url or "",
        "user_agent": enriched_event.user_agent or "",
        "attempts": enriched_event.metadata.get("attempts", 0),
    }

    risk_result = calculate_risk(risk_input)

    ai_input = AIAnalystInput(
        event=enriched_event.model_dump(),
        detection=detection_result,
        risk=risk_result,
        context={
            "website_id": integration.website_id,
            "integration_id": integration.id,
            "fingerprint": fingerprint,
        },
    )

    ai_result = analyze_security_event(ai_input)

    print("CANONICAL EVENT:", canonical_event.model_dump())
    print("ENRICHED EVENT:", enriched_event.model_dump())
    print("DETECTION RESULT:", detection_result)
    print("RISK RESULT:", risk_result)
    print("AI ANALYST RESULT:", ai_result.model_dump())
    print("EVENT FINGERPRINT:", fingerprint)
    print("DUPLICATE EVENT: False")

    if detection_result["detected"]:
        message_parts = []

        for detection in detection_result["detections"]:
            message_parts.append(
                detection.get(
                    "reason",
                    "Security threat detected.",
                )
            )

        message = " | ".join(message_parts)

        alert, incident = create_alert(
            db=db,
            ip_address=enriched_event.src_ip or "Unknown",
            threat_level=risk_result["threat_level"],
            message=message,
        )

        print("ALERT CREATED:", alert.id)

        if (
            ai_result.decision == "RESPOND"
            and ai_result.action_type
            and ai_result.target
        ):
            policy_result = validate_response_action(
                action_type=ai_result.action_type,
                target=ai_result.target,
                confidence=ai_result.confidence,
                threat_level=ai_result.threat_level,
            )

            print(
                "RESPONSE POLICY RESULT:",
                policy_result,
            )

            if policy_result["allowed"]:
                response_action = create_response_action(
                    db=db,
                    incident_id=incident.id,
                    action_type=ai_result.action_type,
                    target=ai_result.target,
                    reason=ai_result.reason,
                )

                print(
                    "RESPONSE ACTION CREATED:",
                    response_action.id,
                )
            else:
                print(
                    "RESPONSE ACTION BLOCKED:",
                    policy_result["reason"],
                )

    return event


def get_events(
    db: Session,
    website_id: int,
):
    return (
        db.query(Event)
        .filter(Event.website_id == website_id)
        .order_by(Event.created_at.desc())
        .all()
    )


def get_event(
    db: Session,
    event_id: int,
):
    return (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )