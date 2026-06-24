from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.core.roles import ADMIN, TENANT_COMPANY_ROLES
from app.models.tenant import Tenant

_CLIENT_ROLES = TENANT_COMPANY_ROLES


def require_tenant_access(
    tenant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> None:
    """Autorise admin (tous tenants) ou les rôles clients (leur propre tenant)."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])

    if ADMIN in roles:
        return  # super-admin : accès total

    if not _CLIENT_ROLES.intersection(roles):
        raise HTTPException(status_code=403, detail="Accès refusé")

    keycloak_id: str = payload.get("sub", "")
    tenant = _resolve_tenant(keycloak_id, db)
    if not tenant or tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès refusé à ce tenant")


async def get_current_tenant(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Tenant:
    """Résout le tenant courant depuis un token Keycloak valide.

    Cherche d'abord dans tenant_users (users invités), puis sur keycloak_id
    du tenant (utilisateur principal/owner).
    """
    payload = decode_keycloak_token(token)

    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    allowed = _CLIENT_ROLES | {ADMIN}
    if not allowed.intersection(roles):
        raise HTTPException(status_code=403, detail="Accès refusé")

    keycloak_id: str = payload.get("sub", "")
    tenant = _resolve_tenant(keycloak_id, db)

    if not tenant:
        raise HTTPException(
            status_code=403,
            detail=(
                "Aucun tenant associé à ce compte Keycloak. "
                "Demandez à un administrateur de lier votre compte."
            ),
        )
    return tenant


def _resolve_tenant(keycloak_user_id: str, db: Session) -> Tenant | None:
    """Résout le tenant d'un user Keycloak.

    Priorité :
    1. Table tenant_users (users invités par tenant_admin)
    2. Champ keycloak_id sur le tenant (owner historique)
    """
    from app.models.tenant_user import TenantUser

    link = db.query(TenantUser).filter(
        TenantUser.keycloak_user_id == keycloak_user_id
    ).first()
    if link:
        return db.query(Tenant).filter(Tenant.id == link.tenant_id).first()

    # Fallback : owner du tenant
    return db.query(Tenant).filter(Tenant.keycloak_id == keycloak_user_id).first()
