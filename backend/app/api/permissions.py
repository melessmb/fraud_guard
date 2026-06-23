"""Gestion des permissions pages par tenant et par rôle."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.models.tenant import Tenant
from app.models.tenant_permission import TenantPagePermission

router = APIRouter()

# Pages déclarées — label + clé + rôles concernés
PAGES = [
    {"key": "dashboard",    "label": "Tableau de bord",  "icon": "LayoutDashboard"},
    {"key": "alertes",      "label": "Alertes",           "icon": "AlertTriangle"},
    {"key": "transactions", "label": "Transactions",      "icon": "ArrowLeftRight"},
    {"key": "analytique",   "label": "Analytique",        "icon": "BarChart2"},
    {"key": "scoring",      "label": "Scoring",           "icon": "Zap"},
    {"key": "conformite",   "label": "Conformité BCEAO",  "icon": "FileText"},
    {"key": "export",       "label": "Export de données", "icon": "Download"},
]

ROLES = ["tenant_admin", "compliance", "tenant"]

# Permissions par défaut (toutes activées)
_DEFAULT: dict[tuple[str, str], bool] = {
    (page["key"], role): True
    for page in PAGES
    for role in ROLES
}
# Restrictions par défaut : tenant ne voit pas la conformité ni l'export
_DEFAULT[("conformite", "tenant")] = False
_DEFAULT[("export",     "tenant")] = False


def _require_admin_or_tenant_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if "admin" not in roles and "tenant_admin" not in roles:
        raise HTTPException(status_code=403, detail="Rôle 'admin' ou 'tenant_admin' requis")
    return payload


def _caller_tenant(payload: dict, db: Session) -> Tenant | None:
    """None = super-admin (accès total). Sinon retourne le tenant du caller."""
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if "admin" in roles:
        return None
    kid = payload.get("sub", "")
    return db.query(Tenant).filter(Tenant.keycloak_id == kid).first()


def _get_permissions(tenant_id: int, db: Session) -> dict[tuple[str, str], bool]:
    """Fusionne les défauts avec les overrides stockés en base."""
    perms = dict(_DEFAULT)
    rows = db.query(TenantPagePermission).filter(
        TenantPagePermission.tenant_id == tenant_id
    ).all()
    for row in rows:
        perms[(row.page_key, row.role)] = row.allowed
    return perms


# ── Schémas ───────────────────────────────────────────────────────────────────

class PermissionMatrix(BaseModel):
    tenant_id: int
    pages: list[dict[str, Any]]   # [{key, label, icon, perms: {role: bool}}]


class SetPermissionRequest(BaseModel):
    page_key: str
    role: str
    allowed: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/admin/tenants/{tenant_id}/permissions", response_model=PermissionMatrix)
def get_permissions(
    tenant_id: int,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> PermissionMatrix:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    caller_tenant = _caller_tenant(payload, db)
    if caller_tenant and caller_tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    perms = _get_permissions(tenant_id, db)
    pages_out = []
    for page in PAGES:
        pages_out.append({
            **page,
            "perms": {role: perms.get((page["key"], role), True) for role in ROLES},
        })

    return PermissionMatrix(tenant_id=tenant_id, pages=pages_out)


@router.put("/admin/tenants/{tenant_id}/permissions", status_code=204)
def set_permission(
    tenant_id: int,
    body: SetPermissionRequest,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> None:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    caller_tenant = _caller_tenant(payload, db)
    if caller_tenant and caller_tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    if body.page_key not in {p["key"] for p in PAGES}:
        raise HTTPException(status_code=400, detail=f"Page inconnue : {body.page_key}")
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rôle invalide : {body.role}")

    row = db.query(TenantPagePermission).filter(
        TenantPagePermission.tenant_id == tenant_id,
        TenantPagePermission.page_key == body.page_key,
        TenantPagePermission.role == body.role,
    ).first()

    if row:
        row.allowed = body.allowed
    else:
        db.add(TenantPagePermission(
            tenant_id=tenant_id,
            page_key=body.page_key,
            role=body.role,
            allowed=body.allowed,
        ))
    db.commit()


@router.get("/tenants/{tenant_id}/permissions/me")
def get_my_permissions(
    tenant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Retourne {page_key: allowed} pour le rôle principal du caller."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])

    # Admin et tenant_admin ont toujours accès à tout
    if "admin" in roles or "tenant_admin" in roles:
        return {p["key"]: True for p in PAGES}

    role = next((r for r in ("compliance", "tenant") if r in roles), None)
    if not role:
        raise HTTPException(status_code=403, detail="Rôle non reconnu")

    perms = _get_permissions(tenant_id, db)
    return {p["key"]: perms.get((p["key"], role), True) for p in PAGES}
