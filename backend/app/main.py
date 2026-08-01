from fastapi import FastAPI
from app.routers.log_router import router as log_router
from app.database.database import engine
from app.database.base import Base
from app.models.alert import Alert
from app.routers.dashboard_router import router as dashboard_router
from fastapi.middleware.cors import CORSMiddleware
from app.models.scan_result import ScanResult
from app.routers.scanner_router import router as scanner_router
# Import all models
from app.models.log import Log
from app.routers.alert_router import router as alert_router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sentinel AI",
    description="Intelligent Website Security Monitoring and Threat Detection Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(log_router)
app.include_router(dashboard_router)
app.include_router(alert_router)
app.include_router(scanner_router)


@app.get("/")
def home():
    return {
        "status": "running",
        "project": "Sentinel AI",
        "message": "Backend is running successfully 🚀"
    }