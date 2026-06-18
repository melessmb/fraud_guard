from fastapi import Depends, HTTPException

from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme


def require_admin(token: str = Depends(oauth2_scheme)) -> dict:
    """Dépendance FastAPI — vérifie le rôle realm 'admin' dans le token Keycloak."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if "admin" not in roles:
        raise HTTPException(
            status_code=403,
            detail="Accès administrateur requis (rôle 'admin' Keycloak)",
        )
    return payload
