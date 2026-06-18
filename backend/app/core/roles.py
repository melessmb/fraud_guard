"""Constantes de rôles et helpers de permission."""
from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme

# ── Constantes ────────────────────────────────────────────────────────────────
ADMIN        = "admin"
TENANT_ADMIN = "tenant_admin"
COMPLIANCE   = "compliance"
TENANT       = "tenant"

PLATFORM_ROLES      = frozenset({ADMIN})
TENANT_COMPANY_ROLES = frozenset({TENANT_ADMIN, COMPLIANCE, TENANT})
ALL_ROLES           = PLATFORM_ROLES | TENANT_COMPANY_ROLES

# Rôles qui peuvent déclencher des actions d'écriture sur un tenant
TENANT_WRITE_ROLES = frozenset({ADMIN, TENANT_ADMIN})

# Rôles qui peuvent voir les données conformité
COMPLIANCE_READ_ROLES = frozenset({ADMIN, TENANT_ADMIN, COMPLIANCE})


def get_user_role(payload: dict) -> str:
    """Retourne le rôle principal de l'utilisateur (ordre de priorité)."""
    roles = set(payload.get("realm_access", {}).get("roles", []))
    for role in (ADMIN, TENANT_ADMIN, COMPLIANCE, TENANT):
        if role in roles:
            return role
    return TENANT


def require_any_role(*roles: str):
    """Dépendance FastAPI — lève 403 si aucun des rôles n'est présent."""
    def _check(token: str = Depends(oauth2_scheme)) -> dict:
        payload = decode_keycloak_token(token)
        user_roles = set(payload.get("realm_access", {}).get("roles", []))
        if not user_roles.intersection(roles):
            raise HTTPException(
                status_code=403,
                detail=f"Accès refusé — rôle requis : {' ou '.join(roles)}",
            )
        return payload
    return _check


def get_tenant_for_user(token: str, db: Session):
    """Retourne le tenant lié au token Keycloak, ou None si admin plateforme."""
    from app.models.tenant import Tenant

    payload  = decode_keycloak_token(token)
    roles    = set(payload.get("realm_access", {}).get("roles", []))

    if ADMIN in roles:
        return None  # admin voit tout, pas de restriction tenant

    keycloak_id = payload.get("sub", "")
    tenant = db.query(Tenant).filter(Tenant.keycloak_id == keycloak_id).first()
    if not tenant:
        username = payload.get("preferred_username", "")
        tenant = db.query(Tenant).filter(Tenant.name == username).first()
    if not tenant:
        raise HTTPException(
            status_code=403,
            detail="Aucun tenant lié à ce compte. Contactez un administrateur.",
        )
    return tenant


def require_tenant_scope(tenant_id: int):
    """Vérifie que l'utilisateur a le droit d'accéder au tenant donné.

    - admin → accès à tous les tenants
    - tenant_admin / compliance / tenant → accès uniquement à leur tenant lié
    """
    def _check(
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ) -> dict:
        from app.models.tenant import Tenant

        payload = decode_keycloak_token(token)
        roles   = set(payload.get("realm_access", {}).get("roles", []))

        if ADMIN in roles:
            return payload  # admin : pas de restriction

        keycloak_id = payload.get("sub", "")
        linked = db.query(Tenant).filter(Tenant.keycloak_id == keycloak_id).first()
        if not linked or linked.id != tenant_id:
            raise HTTPException(
                status_code=403,
                detail="Accès refusé — vous ne pouvez accéder qu'à votre propre tenant.",
            )
        return payload
    return _check
