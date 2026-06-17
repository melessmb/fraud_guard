from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.cache import add_to_blacklist
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, hash_api_key
from app.models.schemas import RevokeRequest, TokenRequest, TokenResponse
from app.models.tenant import Tenant

router = APIRouter()


@router.post("/auth/token", response_model=TokenResponse)
def get_token(payload: TokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    hashed = hash_api_key(payload.api_key)
    tenant = db.query(Tenant).filter(Tenant.api_key == hashed).first()
    if not tenant:
        raise HTTPException(status_code=401, detail="Clé API invalide")

    token = create_access_token(subject=str(tenant.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/auth/revoke", dependencies=[Depends(require_admin)])
def revoke_token(body: RevokeRequest) -> dict:
    """Révoque un JWT immédiatement — le JTI est blacklisté dans Redis jusqu'à expiration naturelle."""
    try:
        payload = decode_access_token(body.token, skip_blacklist=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    jti: str | None = payload.get("jti")
    exp: int | None = payload.get("exp")

    if not jti or not exp:
        raise HTTPException(status_code=400, detail="Token sans JTI ou EXP — non révocable")

    remaining = int(exp - datetime.utcnow().timestamp())
    if remaining <= 0:
        return {"status": "already_expired", "jti": jti}

    add_to_blacklist(jti, remaining)
    return {"status": "revoked", "jti": jti}
