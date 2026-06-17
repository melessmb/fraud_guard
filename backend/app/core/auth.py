from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_api_key
from app.models.tenant import Tenant

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_tenant(
    api_key: str | None = Security(api_key_header),
    db: Session = Depends(get_db),
) -> Tenant:
    if not api_key:
        raise HTTPException(status_code=401, detail="Clé API manquante")

    hashed = hash_api_key(api_key)
    tenant = db.query(Tenant).filter(Tenant.api_key == hashed).first()
    if not tenant:
        raise HTTPException(status_code=401, detail="Clé API invalide")

    return tenant
