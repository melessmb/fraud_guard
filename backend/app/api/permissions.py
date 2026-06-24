"""Gestion des permissions pages par tenant et par rôle."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.core.roles import ADMIN, TENANT_ADMIN, DEVELOPER, COMPLIANCE, TENANT
from app.models.tenant import Tenant
from app.models.tenant_feature import TenantFeature
from app.models.tenant_permission import TenantPagePermission

router = APIRouter()

# Pages déclarées
PAGES = [
    {"key": "dashboard",    "label": "Tableau de bord",  "icon": "LayoutDashboard"},
    {"key": "transactions", "label": "Transactions",      "icon": "ArrowLeftRight"},
    {"key": "alertes",      "label": "Alertes",           "icon": "AlertTriangle"},
    {"key": "analytique",   "label": "Analytique",        "icon": "BarChart2"},
    {"key": "scoring",      "label": "Scoring",           "icon": "Zap"},
    {"key": "conformite",   "label": "Conformité BCEAO",  "icon": "FileText"},
    {"key": "configuration","label": "Configuration",     "icon": "Settings"},
    {"key": "equipe",       "label": "Équipe",            "icon": "Users"},
]

ROLES = [TENANT_ADMIN, DEVELOPER, COMPLIANCE, TENANT]

# Permissions par défaut par rôle
_DEFAULT: dict[tuple[str, str], bool] = {
    ("dashboard",     TENANT_ADMIN): True,
    ("dashboard",     DEVELOPER):    True,
    ("dashboard",     COMPLIANCE):   True,
    ("dashboard",     TENANT):       True,

    ("transactions",  TENANT_ADMIN): True,
    ("transactions",  DEVELOPER):    True,
    ("transactions",  COMPLIANCE):   True,
    ("transactions",  TENANT):       True,

    ("alertes",       TENANT_ADMIN): True,
    ("alertes",       DEVELOPER):    False,
    ("alertes",       COMPLIANCE):   True,
    ("alertes",       TENANT):       True,

    ("analytique",    TENANT_ADMIN): True,
    ("analytique",    DEVELOPER):    False,
    ("analytique",    COMPLIANCE):   True,
    ("analytique",    TENANT):       True,

    ("scoring",       TENANT_ADMIN): True,
    ("scoring",       DEVELOPER):    True,
    ("scoring",       COMPLIANCE):   False,
    ("scoring",       TENANT):       True,

    ("conformite",    TENANT_ADMIN): True,
    ("conformite",    DEVELOPER):    False,
    ("conformite",    COMPLIANCE):   True,
    ("conformite",    TENANT):       False,

    ("configuration", TENANT_ADMIN): True,
    ("configuration", DEVELOPER):    True,
    ("configuration", COMPLIANCE):   False,
    ("configuration", TENANT):       False,

    ("equipe",        TENANT_ADMIN): True,
    ("equipe",        DEVELOPER):    False,
    ("equipe",        COMPLIANCE):   False,
    ("equipe",        TENANT):       False,
}


def _require_admin_or_tenant_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN not in roles and TENANT_ADMIN not in roles:
        raise HTTPException(status_code=403, detail="Rôle 'admin' ou 'tenant_admin' requis")
    return payload


def _caller_tenant(payload: dict, db: Session) -> Tenant | None:
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN in roles:
        return None
    kid = payload.get("sub", "")
    from app.core.auth import _resolve_tenant
    return _resolve_tenant(kid, db)


def _get_role_permissions(tenant_id: int, db: Session) -> dict[tuple[str, str], bool]:
    """Fusionne les défauts avec les overrides stockés en base."""
    perms = dict(_DEFAULT)
    rows = db.query(TenantPagePermission).filter(
        TenantPagePermission.tenant_id == tenant_id
    ).all()
    for row in rows:
        perms[(row.page_key, row.role)] = row.allowed
    return perms


def _get_features(tenant_id: int, db: Session) -> dict[str, bool]:
    """Retourne le plafond features pour ce tenant (défaut: tout activé)."""
    rows = db.query(TenantFeature).filter(TenantFeature.tenant_id == tenant_id).all()
    features = {p["key"]: True for p in PAGES}  # tout activé par défaut
    for row in rows:
        features[row.feature_key] = row.enabled
    return features


# ── Schémas ───────────────────────────────────────────────────────────────────

class PermissionMatrix(BaseModel):
    tenant_id: int
    pages: list[dict[str, Any]]


class SetPermissionRequest(BaseModel):
    page_key: str
    role: str
    allowed: bool


class FeatureMatrix(BaseModel):
    tenant_id: int
    features: dict[str, bool]


class SetFeatureRequest(BaseModel):
    feature_key: str
    enabled: bool


# ── Endpoints permissions par rôle ────────────────────────────────────────────

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

    perms = _get_role_permissions(tenant_id, db)
    features = _get_features(tenant_id, db)

    pages_out = []
    for page in PAGES:
        key = page["key"]
        pages_out.append({
            **page,
            "feature_enabled": features.get(key, True),
            "perms": {role: perms.get((key, role), True) for role in ROLES},
        })

    return PermissionMatrix(tenant_id=tenant_id, pages=pages_out)


@router.put("/admin/tenants/{tenant_id}/permissions", status_code=204,
            responses={403: {"description": "Accès refusé"}, 404: {"description": "Tenant introuvable"}, 400: {"description": "Page ou rôle invalide"}})
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

    # tenant_admin ne peut pas modifier les permissions du rôle tenant_admin
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN not in roles and body.role == TENANT_ADMIN:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas modifier les permissions tenant_admin")

    # Vérifie que la feature est activée par FraudGuard avant d'autoriser
    features = _get_features(tenant_id, db)
    if not features.get(body.page_key, True) and body.allowed:
        raise HTTPException(
            status_code=403,
            detail=f"La feature '{body.page_key}' est désactivée par FraudGuard pour ce tenant",
        )

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


# ── Endpoints features (plafond FraudGuard — admin uniquement) ────────────────

@router.get("/admin/tenants/{tenant_id}/features", response_model=FeatureMatrix,
            responses={403: {"description": "Réservé à l'admin FraudGuard"}, 404: {"description": "Tenant introuvable"}})
def get_features(
    tenant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> FeatureMatrix:
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN not in roles:
        raise HTTPException(status_code=403, detail="Réservé à l'admin FraudGuard")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    return FeatureMatrix(tenant_id=tenant_id, features=_get_features(tenant_id, db))


@router.put("/admin/tenants/{tenant_id}/features", status_code=204,
            responses={403: {"description": "Réservé à l'admin FraudGuard"}, 404: {"description": "Tenant ou feature introuvable"}, 400: {"description": "Feature inconnue"}})
def set_feature(
    tenant_id: int,
    body: SetFeatureRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> None:
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN not in roles:
        raise HTTPException(status_code=403, detail="Réservé à l'admin FraudGuard")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    if body.feature_key not in {p["key"] for p in PAGES}:
        raise HTTPException(status_code=400, detail=f"Feature inconnue : {body.feature_key}")

    row = db.query(TenantFeature).filter(
        TenantFeature.tenant_id == tenant_id,
        TenantFeature.feature_key == body.feature_key,
    ).first()

    if row:
        row.enabled = body.enabled
    else:
        db.add(TenantFeature(
            tenant_id=tenant_id,
            feature_key=body.feature_key,
            enabled=body.enabled,
        ))
    db.commit()

    # Si on désactive une feature, on désactive aussi toutes les permissions de rôle pour cette page
    if not body.enabled:
        db.query(TenantPagePermission).filter(
            TenantPagePermission.tenant_id == tenant_id,
            TenantPagePermission.page_key == body.feature_key,
        ).delete()
        db.commit()


# ── Endpoint "mes permissions" (portail client) ───────────────────────────────

@router.get("/tenants/{tenant_id}/permissions/me")
def get_my_permissions(
    tenant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Retourne {page_key: allowed} pour le rôle principal du caller."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])

    if ADMIN in roles or TENANT_ADMIN in roles:
        return {p["key"]: True for p in PAGES}

    role = next((r for r in (DEVELOPER, COMPLIANCE, TENANT) if r in roles), None)
    if not role:
        raise HTTPException(status_code=403, detail="Rôle non reconnu")

    features = _get_features(tenant_id, db)
    perms = _get_role_permissions(tenant_id, db)

    return {
        p["key"]: features.get(p["key"], True) and perms.get((p["key"], role), True)
        for p in PAGES
    }
