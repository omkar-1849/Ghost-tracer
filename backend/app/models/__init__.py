# Auto-load all SQLAlchemy models to ensure registries and relationships are completely resolved
from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.session import Session
from app.models.password_reset_token import PasswordResetToken
from app.models.website import Website
from app.models.integration import Integration
from app.models.enrollment_token import EnrollmentToken
from app.models.event import Event
from app.models.log import Log
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.incident_timeline import IncidentTimeline
from app.models.incident_evidence import IncidentEvidence
from app.models.incident_note import IncidentNote
from app.models.response_action import ResponseAction
from app.models.scan import Scan
from app.models.scan_result import ScanResult
from app.models.scanner_finding import ScannerFinding
from app.models.scanner_finding_observation import ScannerFindingObservation
from app.models.investigation import Investigation
from app.models.investigation_job import InvestigationJob
from app.models.ai_analysis_job import AiAnalysisJob
from app.models.audit_log import AuditLog
from app.models.settings import Settings

__all__ = [
    "User",
    "Organization",
    "OrganizationMember",
    "Session",
    "PasswordResetToken",
    "Website",
    "Integration",
    "EnrollmentToken",
    "Event",
    "Log",
    "Alert",
    "Incident",
    "IncidentTimeline",
    "IncidentEvidence",
    "IncidentNote",
    "ResponseAction",
    "Scan",
    "ScanResult",
    "ScannerFinding",
    "ScannerFindingObservation",
    "Investigation",
    "InvestigationJob",
    "AiAnalysisJob",
    "AuditLog",
    "Settings",
]
