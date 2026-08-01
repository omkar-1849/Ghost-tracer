from sqlalchemy.orm import Session
from app.models.log import Log
from app.models.alert import Alert
from sqlalchemy import func



def get_dashboard_stats(db: Session):
    total_logs = db.query(Log).count()

    total_alerts = db.query(Alert).count()

    critical_alerts = (
        db.query(Alert)
        .filter(Alert.threat_level == "CRITICAL")
        .count()
    )

    high_alerts = (
        db.query(Alert)
        .filter(Alert.threat_level == "HIGH")
        .count()
    )

    return {
        "total_logs": total_logs,
        "total_alerts": total_alerts,
        "critical_alerts": critical_alerts,
        "high_alerts": high_alerts,
    }

def get_top_attacking_ips(db):
    """
    Returns the top 10 IP addresses with the highest number of log entries.
    """

    results = (
        db.query(
            Log.ip_address,
            func.count(Log.id).label("attack_count")
        )
        .group_by(Log.ip_address)
        .order_by(func.count(Log.id).desc())
        .limit(10)
        .all()
    )

    return [
        {
            "ip_address": row.ip_address,
            "attack_count": row.attack_count
        }
        for row in results
    ]

def get_threat_activity(db):
    results = (
        db.query(
            func.hour(Log.timestamp).label("hour"),
            func.count(Log.id).label("threats")
        )
        .group_by(func.hour(Log.timestamp))
        .order_by(func.hour(Log.timestamp))
        .all()
    )

    return [
        {
            "time": f"{row.hour}:00",
            "threats": row.threats
        }
        for row in results
    ]

def get_threat_distribution(db):
    results = (
        db.query(
            Log.threat_level,
            func.count(Log.id).label("count")
        )
        .group_by(Log.threat_level)
        .all()
    )

    return [
        {
            "name": row.threat_level,
            "value": row.count
        }
        for row in results
    ]

def get_top_targeted_urls(db):
    results = (
        db.query(
            Log.url,
            func.count(Log.id).label("count")
        )
        .group_by(Log.url)
        .order_by(func.count(Log.id).desc())
        .limit(10)
        .all()
    )

    return [
        {
            "url": row.url,
            "count": row.count
        }
        for row in results
    ]

def get_security_score(db):
    total_logs = db.query(Log).count()

    if total_logs == 0:
        return {"score": 100}

    critical = db.query(Log).filter(Log.threat_level == "CRITICAL").count()
    high = db.query(Log).filter(Log.threat_level == "HIGH").count()
    medium = db.query(Log).filter(Log.threat_level == "MEDIUM").count()

    penalty = (
        critical * 5 +
        high * 3 +
        medium * 1
    )

    score = max(0, 100 - penalty)

    return {"score": score}

def get_attack_types(db):
    logs = db.query(Log).all()

    attacks = {
        "SQL Injection": 0,
        "Brute Force": 0,
        "XSS": 0,
        "Path Traversal": 0,
        "Admin Access": 0,
    }

    for log in logs:
        reason = (log.detection_reason or "").lower()

        if "sql" in reason:
            attacks["SQL Injection"] += 1

        if "brute force" in reason:
            attacks["Brute Force"] += 1

        if "xss" in reason:
            attacks["XSS"] += 1

        if "path traversal" in reason:
            attacks["Path Traversal"] += 1

        if "admin" in reason:
            attacks["Admin Access"] += 1

    return [
        {
            "attack": attack,
            "count": count
        }
        for attack, count in attacks.items()
        if count > 0
    ]

def get_live_attack_feed(db):
    logs = (
        db.query(Log)
        .filter(Log.threat_level.in_(["HIGH", "CRITICAL"]))
        .order_by(Log.timestamp.desc())
        .limit(10)
        .all()
    )

    return [
        {
            "ip_address": log.ip_address,
            "threat_level": log.threat_level,
            "reason": log.detection_reason,
            "timestamp": log.timestamp,
        }
        for log in logs
    ]