"""CRUD + test des scoring hooks — endpoints réservés à tenant_admin et admin."""
from __future__ import annotations

import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.core.roles import ADMIN, TENANT_ADMIN
from app.models.schemas import (
    HookTestRequest, HookTestResponse,
    ScoringHookRequest, ScoringHookResponse,
)
from app.models.tenant import Tenant
from app.models.tenant_scoring_hook import TenantScoringHook

router = APIRouter()

_ALLOWED_HOOK_TYPES = {"pre_score", "post_score"}


def _assert_tenant_access(tenant_id: int, token: str, db: Session) -> None:
    """Lève 403 si le token n'a pas accès au tenant donné."""
    payload = decode_keycloak_token(token)
    roles   = set(payload.get("realm_access", {}).get("roles", []))
    if ADMIN in roles:
        return
    keycloak_id = payload.get("sub", "")
    linked = db.query(Tenant).filter(Tenant.keycloak_id == keycloak_id).first()
    if not linked or linked.id != tenant_id:
        raise HTTPException(403, "Accès refusé — vous ne pouvez accéder qu'à votre propre tenant.")


def _assert_write_role(token: str) -> None:
    """Lève 403 si le token n'a pas le rôle admin ou tenant_admin."""
    payload = decode_keycloak_token(token)
    roles   = set(payload.get("realm_access", {}).get("roles", []))
    if not roles.intersection({ADMIN, TENANT_ADMIN}):
        raise HTTPException(403, f"Rôle requis : {ADMIN} ou {TENANT_ADMIN}")


def _get_hook_or_404(hook_id: int, tenant_id: int, db: Session) -> TenantScoringHook:
    hook = db.query(TenantScoringHook).filter(
        TenantScoringHook.id == hook_id,
        TenantScoringHook.tenant_id == tenant_id,
    ).first()
    if not hook:
        raise HTTPException(404, "Hook introuvable")
    return hook


@router.get("/tenants/{tenant_id}/hooks", response_model=List[ScoringHookResponse])
def list_hooks(
    tenant_id: int,
    db:    Session = Depends(get_db),
    token: str     = Depends(oauth2_scheme),
) -> List[ScoringHookResponse]:
    _assert_tenant_access(tenant_id, token, db)
    rows = db.query(TenantScoringHook).filter(
        TenantScoringHook.tenant_id == tenant_id
    ).all()
    return [ScoringHookResponse.model_validate(r) for r in rows]


@router.post("/tenants/{tenant_id}/hooks", response_model=ScoringHookResponse, status_code=201)
def create_hook(
    tenant_id: int,
    payload:   ScoringHookRequest,
    db:        Session = Depends(get_db),
    token:     str     = Depends(oauth2_scheme),
) -> ScoringHookResponse:
    _assert_tenant_access(tenant_id, token, db)
    _assert_write_role(token)

    if payload.hook_type not in _ALLOWED_HOOK_TYPES:
        raise HTTPException(400, f"hook_type doit être : {', '.join(_ALLOWED_HOOK_TYPES)}")
    if not 100 <= payload.timeout_ms <= 5_000:
        raise HTTPException(400, "timeout_ms doit être entre 100 et 5 000 ms")

    hook = TenantScoringHook(
        tenant_id=tenant_id, name=payload.name, hook_type=payload.hook_type,
        url=payload.url, secret=payload.secret,
        timeout_ms=payload.timeout_ms, enabled=payload.enabled,
    )
    db.add(hook)
    db.flush()
    log_audit(db, action_type="CREATE_HOOK", actor_type="tenant_admin",
              resource_type="scoring_hook", resource_id=str(hook.id),
              details={"name": hook.name, "hook_type": hook.hook_type, "url": hook.url})
    return ScoringHookResponse.model_validate(hook)


@router.put("/tenants/{tenant_id}/hooks/{hook_id}", response_model=ScoringHookResponse)
def update_hook(
    tenant_id: int, hook_id: int,
    payload:   ScoringHookRequest,
    db:        Session = Depends(get_db),
    token:     str     = Depends(oauth2_scheme),
) -> ScoringHookResponse:
    _assert_tenant_access(tenant_id, token, db)
    _assert_write_role(token)
    hook = _get_hook_or_404(hook_id, tenant_id, db)
    for field, value in payload.model_dump().items():
        setattr(hook, field, value)
    db.flush()
    return ScoringHookResponse.model_validate(hook)


@router.delete("/tenants/{tenant_id}/hooks/{hook_id}", status_code=204)
def delete_hook(
    tenant_id: int, hook_id: int,
    db:    Session = Depends(get_db),
    token: str     = Depends(oauth2_scheme),
) -> None:
    _assert_tenant_access(tenant_id, token, db)
    _assert_write_role(token)
    hook = _get_hook_or_404(hook_id, tenant_id, db)
    db.delete(hook)
    db.flush()
    log_audit(db, action_type="DELETE_HOOK", actor_type="tenant_admin",
              resource_type="scoring_hook", resource_id=str(hook_id),
              details={"name": hook.name})


@router.post("/tenants/{tenant_id}/hooks/{hook_id}/test", response_model=HookTestResponse)
async def test_hook(
    tenant_id: int, hook_id: int,
    body:  HookTestRequest,
    db:    Session = Depends(get_db),
    token: str     = Depends(oauth2_scheme),
) -> HookTestResponse:
    """Envoie un payload de test au hook et retourne la réponse brute — utile pour le débogage."""
    _assert_tenant_access(tenant_id, token, db)
    hook = _get_hook_or_404(hook_id, tenant_id, db)

    from app.services.hook_executor import call_hook

    payload = (
        {
            "hook_type": "pre_score", "transaction_id": body.transaction_id,
            "tenant_id": tenant_id, "amount": body.amount, "currency": body.currency,
            "channel": body.channel, "country": body.country,
            "device_fingerprint": body.device_fingerprint,
            "timestamp": "2026-01-01T00:00:00",
        }
        if hook.hook_type == "pre_score" else
        {
            "hook_type": "post_score", "transaction_id": body.transaction_id,
            "tenant_id": tenant_id, "score": body.score, "is_fraud": body.is_fraud,
            "amount": body.amount, "channel": body.channel, "context": {},
        }
    )

    t0   = time.monotonic()
    resp = await call_hook(hook.url, payload, secret=hook.secret, timeout_ms=hook.timeout_ms)
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if resp is None:
        return HookTestResponse(
            hook_id=hook.id, url=hook.url, status="error",
            response_ms=elapsed_ms,
            error="Le hook n'a pas répondu (timeout ou erreur réseau)",
        )
    return HookTestResponse(
        hook_id=hook.id, url=hook.url, status="success",
        response_ms=elapsed_ms, response_body=resp,
    )
