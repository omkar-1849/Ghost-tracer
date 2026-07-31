from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.log_schema import LogCreate, LogResponse

from app.database.database import SessionLocal
from app.services.log_service import create_log,get_recent_logs

router = APIRouter(prefix="/logs", tags=["Logs"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/recent")
def recent_logs(db: Session = Depends(get_db)):
    return get_recent_logs(db)

@router.post("", response_model=LogResponse)
def add_log(log: LogCreate, db: Session = Depends(get_db)):
    return create_log(db, log)
