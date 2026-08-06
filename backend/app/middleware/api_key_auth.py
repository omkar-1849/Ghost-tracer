import hashlib

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services.integration_service import validate_api_key


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
):
    integration = validate_api_key(db, x_api_key)

    if not integration:
        raise HTTPException(
            status_code=401,
            detail="Invalid API Key",
        )

    return integration