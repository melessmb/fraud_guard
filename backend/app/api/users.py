"""Gestion des utilisateurs — création/invitation, liste, révocation."""
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme, require_role
from app.core.roles import ADMIN, TENANT_ADMIN, TENANT_ADMIN_ASSIGNABLE
from app.models.tenant import Tenant
from app.models.tenant_user import TenantUser
from app.services import keycloak_admin

router = APIRouter()

require_admin = require_role(ADMIN)


def _require_admin_or_tenant_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN not in roles and TENANT_ADMIN not in roles:
        raise HTTPException(status_code=403, detail="Rôle 'admin' ou 'tenant_admin' requis")
    return payload


def _get_caller_tenant(payload: dict, db: Session) -> Tenant | None:
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN in roles:
        return None
    kid = payload.get("sub", "")
    from app.core.auth import _resolve_tenant
    return _resolve_tenant(kid, db)


def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ── Schémas ───────────────────────────────────────────────────────────────────

class InviteUserRequest(BaseModel):
    username: str
    email: EmailStr
    role: str
    tenant_id: int
    password: str | None = None


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/admin/users/invite", response_model=InviteUserResponse,
             responses={403: {"description": "Rôle non autorisé ou accès cross-tenant"}, 404: {"description": "Tenant introuvable"}})
def invite_user(
    body: InviteUserRequest,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> InviteUserResponse:
    """Crée un utilisateur Keycloak et le lie au tenant en base.

    - admin FraudGuard → peut assigner n'importe quel rôle y compris tenant_admin
    - tenant_admin → peut assigner uniquement developer, compliance, tenant
    """
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    caller_is_admin = ADMIN in roles

    allowed_roles = ({TENANT_ADMIN} | TENANT_ADMIN_ASSIGNABLE) if caller_is_admin else TENANT_ADMIN_ASSIGNABLE

    if body.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Vous ne pouvez pas attribuer le rôle '{body.role}'. "
                   f"Rôles autorisés : {sorted(allowed_roles)}",
        )

    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

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

    # Lier le nouvel utilisateur au tenant
    existing = db.query(TenantUser).filter(
        TenantUser.keycloak_user_id == keycloak_id,
        TenantUser.tenant_id == body.tenant_id,
    ).first()
    if not existing:
        db.add(TenantUser(
            tenant_id=body.tenant_id,
            keycloak_user_id=keycloak_id,
            role=body.role,
        ))
        db.commit()

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
    """Liste les utilisateurs d'un tenant (via tenant_users + owner du tenant)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    caller_tenant = _get_caller_tenant(payload, db)
    if caller_tenant and caller_tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    links = db.query(TenantUser).filter(TenantUser.tenant_id == tenant_id).all()
    kid_role_map = {link.keycloak_user_id: link.role for link in links}

    # Inclut l'owner du tenant s'il n'est pas déjà dans la liste
    if tenant.keycloak_id and tenant.keycloak_id not in kid_role_map:
        kid_role_map[tenant.keycloak_id] = TENANT_ADMIN

    if not kid_role_map:
        return []

    kc_users = keycloak_admin.list_users_by_ids(list(kid_role_map.keys()))
    return [
        UserOut(
            keycloak_id=u["keycloak_id"],
            username=u["username"],
            email=u.get("email", ""),
            enabled=u.get("enabled", True),
            roles=[kid_role_map.get(u["keycloak_id"], "tenant")],
            tenant_id=tenant_id,
            tenant_name=tenant.name,
        )
        for u in kc_users
    ]


@router.get("/admin/users", response_model=list[UserOut])
def list_all_users(
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    """Liste tous les utilisateurs (admin uniquement)."""
    tenants = db.query(Tenant).all()
    tenant_id_map = {t.id: t for t in tenants}
    owner_map = {t.keycloak_id: t for t in tenants if t.keycloak_id}

    all_links = db.query(TenantUser).all()
    tenant_user_map: dict[str, tuple[int, str]] = {
        link.keycloak_user_id: (link.tenant_id, link.role)
        for link in all_links
    }

    all_kids = set(owner_map.keys()) | set(tenant_user_map.keys())
    if not all_kids:
        return []

    kc_users = keycloak_admin.list_users_by_ids(list(all_kids))
    result = []
    seen: set[str] = set()
    for u in kc_users:
        kid = u["keycloak_id"]
        if kid in seen:
            continue
        seen.add(kid)

        if kid in tenant_user_map:
            tid, role = tenant_user_map[kid]
            t = tenant_id_map.get(tid)
        elif kid in owner_map:
            t = owner_map[kid]
            role = TENANT_ADMIN
            tid = t.id
        else:
            continue

        result.append(UserOut(
            keycloak_id=kid,
            username=u["username"],
            email=u.get("email", ""),
            enabled=u.get("enabled", True),
            roles=[role],
            tenant_id=tid,
            tenant_name=t.name if t else "—",
        ))
    return result


@router.delete("/admin/users/{keycloak_id}", status_code=204,
               responses={403: {"description": "Utilisateur non trouvé dans votre tenant"}, 500: {"description": "Erreur Keycloak"}})
def revoke_user(
    keycloak_id: str,
    payload: dict = Depends(_require_admin_or_tenant_admin),
    db: Session = Depends(get_db),
) -> None:
    """Désactive un utilisateur (soft delete — préserve l'audit trail)."""
    caller_tenant = _get_caller_tenant(payload, db)
    if caller_tenant:
        link = db.query(TenantUser).filter(
            TenantUser.keycloak_user_id == keycloak_id,
            TenantUser.tenant_id == caller_tenant.id,
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="Utilisateur non trouvé dans votre tenant")

    try:
        keycloak_admin.disable_user(keycloak_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur Keycloak : {exc}")
