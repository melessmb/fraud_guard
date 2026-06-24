from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.models.tenant import Tenant

_CLIENT_ROLES = {"tenant", "tenant_admin", "compliance"}


def require_tenant_access(
    tenant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> None:
    """Autorise admin (tous tenants) ou les rôles clients (leur propre tenant)."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])

    if "admin" in roles:
        return  # super-admin : accès total

    if not _CLIENT_ROLES.intersection(roles):
        raise HTTPException(status_code=403, detail="Accès refusé")

    keycloak_id: str = payload.get("sub", "")
    tenant = db.query(Tenant).filter(Tenant.keycloak_id == keycloak_id).first()
    if not tenant or tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès refusé à ce tenant")


async def get_current_tenant(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Tenant:
    """Résout le tenant courant depuis un token Keycloak valide.

    Le token doit contenir le rôle realm 'tenant' ou 'admin'.
    Le tenant est identifié par le claim 'sub' (Keycloak user UUID).
    """
    payload = decode_keycloak_token(token)

    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if "tenant" not in roles and "admin" not in roles:
        raise HTTPException(status_code=403, detail="Rôle 'tenant' requis")

    keycloak_id: str = payload.get("sub", "")
    tenant = db.query(Tenant).filter(Tenant.keycloak_id == keycloak_id).first()

    if not tenant:
        # Fallback : cherche par preferred_username pour les comptes créés avant Keycloak
        username: str = payload.get("preferred_username", "")
        tenant = db.query(Tenant).filter(Tenant.name == username).first()

    if not tenant:
        raise HTTPException(
            status_code=403,
            detail=(
                "Aucun tenant associé à ce compte Keycloak. "
                "Demandez à un administrateur de lier votre compte."
            ),
        )
    return tenant
