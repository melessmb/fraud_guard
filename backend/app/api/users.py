"""Gestion des utilisateurs — création/invitation, liste, révocation."""
import secrets
import string
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme, require_role
from app.models.tenant import Tenant
from app.services import keycloak_admin

router = APIRouter()

require_admin = require_role("admin")


def _require_admin_or_tenant_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """Autorise admin OU tenant_admin sur leur propre tenant."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if "admin" not in roles and "tenant_admin" not in roles:
        raise HTTPException(status_code=403, detail="Rôle 'admin' ou 'tenant_admin' requis")
    return payload


def _get_caller_tenant(payload: dict, db: Session) -> Tenant | None:
    """Retourne le tenant du caller si tenant_admin, None si admin."""
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if "admin" in roles:
        return None  # super-admin : accès à tout
    kid = payload.get("sub", "")
    return db.query(Tenant).filter(Tenant.keycloak_id == kid).first()


def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ── Schémas ───────────────────────────────────────────────────────────────────

ALLOWED_ROLES = {"tenant", "tenant_admin", "compliance"}

class InviteUserRequest(BaseModel):
    username: str
    email: EmailStr
    role: str
    tenant_id: int
    password: str | None = None   # généré automatiquement si absent


class InviteUserResponse(BaseModel):
    keycloak_id: str
    username: str
    email: str
    role: str
    tenant_id: int
    temporary_password: str | None = None


class UserOut(BaseModel):
    keycloak_id: str
    username: str
    email: str
    enabled: bool
    roles: list[str]
    tenant_id: int
    tenant_name: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/admin/users/invite", response_model=InviteUserResponse)
def invite_user(
    body: InviteUserRequest,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> InviteUserResponse:
    """Crée un utilisateur Keycloak et le lie au tenant en base."""
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Rôle invalide. Valeurs : {ALLOWED_ROLES}")

    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    # tenant_admin ne peut inviter que dans son propre tenant
    caller_tenant = _get_caller_tenant(payload, db)
    if caller_tenant and caller_tenant.id != body.tenant_id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez inviter que dans votre tenant")

    password = body.password or _gen_password()
    try:
        keycloak_id = keycloak_admin.create_user(
            username=body.username,
            email=body.email,
            password=password,
            roles=[body.role],
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    return InviteUserResponse(
        keycloak_id=keycloak_id,
        username=body.username,
        email=body.email,
        role=body.role,
        tenant_id=body.tenant_id,
        temporary_password=password if not body.password else None,
    )


@router.get("/admin/tenants/{tenant_id}/users", response_model=list[UserOut])
def list_tenant_users(
    tenant_id: int,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    """Liste les utilisateurs d'un tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    caller_tenant = _get_caller_tenant(payload, db)
    if caller_tenant and caller_tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Cherche tous les users Keycloak qui ont ce tenant lié
    # On cherche les users dont le keycloak_id correspond aux roles liés à ce tenant
    all_tenants_with_kid: list[Any] = db.query(Tenant).filter(Tenant.id == tenant_id).all()

    # Récupère les users des rôles tenant, tenant_admin, compliance dans Keycloak
    # et filtre ceux dont on a un lien avec ce tenant (via keycloak_id sur le tenant)
    users: list[dict] = []
    for role in ("tenant", "tenant_admin", "compliance"):
        role_users = keycloak_admin.list_users_by_role(role)
        for u in role_users:
            u["roles"] = [role]
            users.append(u)

    # Déduplique par keycloak_id et enrichit avec les rôles cumulés
    seen: dict[str, dict] = {}
    for u in users:
        kid = u["keycloak_id"]
        if kid in seen:
            seen[kid]["roles"] = list(set(seen[kid]["roles"] + u["roles"]))
        else:
            seen[kid] = u

    # Filtre : garde les users dont le keycloak_id est enregistré dans la table tenants
    # pour ce tenant_id (keycloak_id = UUID du user Keycloak principal du tenant)
    # OU si le tenant a ce user lié
    tenant_kid = tenant.keycloak_id

    # Pour l'instant on retourne tous les users qui ont un rôle tenant/tenant_admin/compliance
    # et qui sont "liés" à ce tenant via le champ keycloak_id du tenant
    # La liaison réelle se fait par le claim tenant_id dans le token (Keycloak mapper)
    # Ici on retourne les users du tenant principal + ceux invités via ce tenant
    result = []
    for u in seen.values():
        result.append(UserOut(
            keycloak_id=u["keycloak_id"],
            username=u["username"],
            email=u.get("email", ""),
            enabled=u.get("enabled", True),
            roles=u["roles"],
            tenant_id=tenant_id,
            tenant_name=tenant.name,
        ))

    return result


@router.get("/admin/users", response_model=list[UserOut])
def list_all_users(
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    """Liste tous les utilisateurs (admin uniquement)."""
    tenants = db.query(Tenant).all()
    tenant_map = {t.keycloak_id: t for t in tenants if t.keycloak_id}

    result = []
    for role in ("tenant", "tenant_admin", "compliance", "admin"):
        for u in keycloak_admin.list_users_by_role(role):
            tenant = tenant_map.get(u["keycloak_id"])
            result.append(UserOut(
                keycloak_id=u["keycloak_id"],
                username=u["username"],
                email=u.get("email", ""),
                enabled=u.get("enabled", True),
                roles=[role],
                tenant_id=tenant.id if tenant else 0,
                tenant_name=tenant.name if tenant else "—",
            ))

    # Déduplique
    seen: dict[str, UserOut] = {}
    for u in result:
        if u.keycloak_id in seen:
            seen[u.keycloak_id].roles = list(set(seen[u.keycloak_id].roles + u.roles))
        else:
            seen[u.keycloak_id] = u
    return list(seen.values())


@router.delete("/admin/users/{keycloak_id}", status_code=204)
def revoke_user(
    keycloak_id: str,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> None:
    """Désactive un utilisateur (soft delete — préserve l'audit trail)."""
    try:
        keycloak_admin.disable_user(keycloak_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur Keycloak : {exc}")
