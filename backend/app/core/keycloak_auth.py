import logging
import time

import httpx
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

log = logging.getLogger(__name__)

# JWKS cache avec TTL 1h (rotation de clés Keycloak)
_jwks_cache: dict | None = None
_jwks_cache_ts: float = 0.0
_JWKS_TTL = 3600  # secondes

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=(
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/token"
    )
)


def _get_jwks() -> dict:
    """Récupère les clés publiques Keycloak (JWKS) avec cache TTL 1h."""
    global _jwks_cache, _jwks_cache_ts
    if _jwks_cache is None or (time.monotonic() - _jwks_cache_ts) > _JWKS_TTL:
        url = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            "/protocol/openid-connect/certs"
        )
        try:
            resp = httpx.get(url, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_cache_ts = time.monotonic()
        except httpx.RequestError as exc:
            log.error("Keycloak JWKS endpoint unreachable: %s", exc)
            if _jwks_cache is not None:
                log.warning("Utilisation du cache JWKS expiré suite à une panne Keycloak")
                return _jwks_cache
            raise HTTPException(
                status_code=503,
                detail="Service d'authentification temporairement indisponible",
            )
    return _jwks_cache


def invalidate_jwks_cache() -> None:
    """Force le rechargement des clés publiques au prochain appel (rotation de clés)."""
    global _jwks_cache, _jwks_cache_ts
    _jwks_cache = None
    _jwks_cache_ts = 0.0


def decode_keycloak_token(token: str) -> dict:
    """Valide un JWT Keycloak (RS256) et retourne son payload."""
    from app.core.cache import is_blacklisted

    jwks = _get_jwks()
    try:
        # Vérification audience activée si keycloak_client_id est configuré
        decode_opts: dict = {}
        if not settings.keycloak_client_id:
            decode_opts["options"] = {"verify_aud": False}

        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.keycloak_client_id or None,
            **decode_opts,
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

    # Vérification blacklist Redis (tokens révoqués)
    jti = payload.get("jti")
    if jti and is_blacklisted(jti):
        raise HTTPException(status_code=401, detail="Token révoqué")

    return payload


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
