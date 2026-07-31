from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.services.alert_service import get_recent_alerts

router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/recent")
def recent_alerts(db: Session = Depends(get_db)):
    return get_recent_alerts(db)