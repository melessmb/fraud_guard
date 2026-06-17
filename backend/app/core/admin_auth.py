import hmac as _hmac

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings

_admin_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


def require_admin(admin_key: str | None = Security(_admin_header)) -> None:
    """Dépendance FastAPI — bloque les endpoints d'administration si la clé est absente ou fausse."""
    if not admin_key:
        raise HTTPException(status_code=403, detail="Accès administrateur requis (X-Admin-Key)")
    # compare_digest() est résistant aux attaques par timing (pas de court-circuit sur premier octet différent)
    if not _hmac.compare_digest(admin_key.encode(), settings.admin_api_key.encode()):
        raise HTTPException(status_code=403, detail="Accès administrateur requis (X-Admin-Key)")
