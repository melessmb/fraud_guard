import httpx
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

_jwks_cache: dict | None = None

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=(
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/token"
    )
)


def _get_jwks() -> dict:
    """Récupère les clés publiques Keycloak (JWKS). Cache en mémoire par processus."""
    global _jwks_cache
    if _jwks_cache is None:
        url = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            "/protocol/openid-connect/certs"
        )
        try:
            resp = httpx.get(url, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Keycloak inaccessible — vérifiez que le service tourne: {exc}",
            )
    return _jwks_cache


def invalidate_jwks_cache() -> None:
    """Force le rechargement des clés publiques au prochain appel (rotation de clés)."""
    global _jwks_cache
    _jwks_cache = None


def decode_keycloak_token(token: str) -> dict:
    """Valide un JWT Keycloak (RS256) et retourne son payload."""
    jwks = _get_jwks()
    try:
        return jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Token invalide: {exc}")


def require_role(role: str):
    """Factory de dépendance FastAPI — lève 403 si le rôle realm est absent."""
    def _check(token: str = Depends(oauth2_scheme)) -> dict:
        payload = decode_keycloak_token(token)
        roles: list[str] = payload.get("realm_access", {}).get("roles", [])
        if role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Rôle '{role}' requis",
            )
        return payload
    return _check
