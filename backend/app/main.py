from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.base import Base
from app.database.database import engine

# Models
from app.models.log import Log
from app.models.alert import Alert
from app.models.scan_result import ScanResult
from app.models.incident import Incident
from app.models.incident_timeline import IncidentTimeline
from app.models.incident_evidence import IncidentEvidence
from app.models.incident_note import IncidentNote

# Routers
from app.routers.log_router import router as log_router
from app.routers.alert_router import router as alert_router
from app.routers.dashboard_router import router as dashboard_router
from app.routers.scanner_router import router as scanner_router
from app.routers.incident_router import router as incident_router
from app.routers.incident_timeline_router import router as incident_timeline_router
from app.routers.incident_evidence_router import router as incident_evidence_router
from app.routers.incident_note_router import router as incident_note_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sentinel AI",
    description="Intelligent Website Security Monitoring and Threat Detection Platform",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def home():
    return {
        "status": "running",
        "project": "Sentinel AI",
        "message": "Backend is running successfully 🚀"
    }