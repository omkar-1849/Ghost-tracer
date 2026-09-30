import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.runtime import get_runtime_config
from app.database.database import engine

# Models
from app.models.log import Log
from app.models.alert import Alert
from app.models.scan_result import ScanResult
from app.models.incident import Incident
from app.models.incident_timeline import IncidentTimeline
from app.models.incident_evidence import IncidentEvidence
from app.models.incident_note import IncidentNote
from app.models.settings import Settings
from app.models.website import Website
from app.models.integration import Integration
from app.models.user import User
from app.models.scan import Scan
from app.models.password_reset_token import PasswordResetToken
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.session import Session
from app.models.response_action import ResponseAction

# Routers
from app.routers.log_router import router as log_router
from app.routers.alert_router import router as alert_router
from app.routers.dashboard_router import router as dashboard_router
from app.routers.scanner_router import router as scanner_router
from app.routers.incident_router import router as incident_router
from app.routers.incident_timeline_router import router as incident_timeline_router
from app.routers.incident_evidence_router import router as incident_evidence_router
from app.routers.incident_note_router import router as incident_note_router
from app.routers.settings_router import router as settings_router
from app.routers.website_router import router as website_router
from app.routers.integration_router import router as integration_router
from app.routers.event_router import router as event_router
from app.routers.profile_router import router as profile_router
from app.routers.session_router import router as session_router
from app.routers.auth_router import router as auth_router
from app.routers.audit_log_router import router as audit_log_router
from app.routers.organization_router import router as organization_router
from app.routers.scan_router import router as scan_router
from app.routers.response_action_router import router as response_action_router

from app.middleware.http_security import SecurityMiddleware
from app.services.scanner_worker import start_scan_workers, stop_scan_workers

config = get_runtime_config()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


app = FastAPI(
    title="Sentinel AI",
    description="Intelligent Website Security Monitoring and Threat Detection Platform",
    version="1.0.0",
)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, _exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Request validation failed. Check the submitted fields."})


@app.on_event("startup")
def start_background_services():
    from app.database.migrations import check_schema
    check_schema(engine)
    if config.environment != "test":
        start_scan_workers()


@app.on_event("shutdown")
def stop_background_services():
    stop_scan_workers()


app.add_middleware(SecurityMiddleware, max_body_bytes=262144)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Organization-ID"],
)


# Routers
app.include_router(log_router)
app.include_router(dashboard_router)
app.include_router(alert_router)
app.include_router(scanner_router)

app.include_router(incident_router)
app.include_router(incident_timeline_router)
app.include_router(incident_evidence_router)
app.include_router(incident_note_router)

app.include_router(settings_router)
app.include_router(website_router)
app.include_router(integration_router)
app.include_router(event_router)

app.include_router(organization_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(session_router)
app.include_router(scan_router)
app.include_router(audit_log_router)

app.include_router(response_action_router)


@app.get("/")
def home():
    return {
        "status": "running",
        "project": "Sentinel AI",
        "message": "Backend is running successfully 🚀",
    }
