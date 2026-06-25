"""CRUD des règles personnalisées par tenant."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_tenant, require_tenant_access
from app.core.database import get_db
from app.models.schemas import CustomRuleCreate, CustomRuleResponse, CustomRuleUpdate
from app.models.tenant import Tenant
from app.models.tenant_custom_rule import TenantCustomRule

router = APIRouter()

_MAX_RULES_PER_TENANT = 50


def _get_rule_or_404(rule_id: int, tenant_id: int, db: Session) -> TenantCustomRule:
    rule = (
        db.query(TenantCustomRule)
        .filter(TenantCustomRule.id == rule_id, TenantCustomRule.tenant_id == tenant_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Règle introuvable")
    return rule


@router.get("/tenants/{tenant_id}/rules", response_model=List[CustomRuleResponse],
            dependencies=[Depends(require_tenant_access)])
def list_rules(tenant_id: int, db: Session = Depends(get_db)) -> List[CustomRuleResponse]:
    rules = (
        db.query(TenantCustomRule)
        .filter(TenantCustomRule.tenant_id == tenant_id)
        .order_by(TenantCustomRule.priority, TenantCustomRule.id)
        .all()
    )
    return [CustomRuleResponse.model_validate(r) for r in rules]


@router.post("/tenants/{tenant_id}/rules", response_model=CustomRuleResponse, status_code=201)
def create_rule(
    tenant_id: int,
    payload: CustomRuleCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
) -> CustomRuleResponse:
    if tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès interdit")

    count = db.query(TenantCustomRule).filter(TenantCustomRule.tenant_id == tenant_id).count()
    if count >= _MAX_RULES_PER_TENANT:
        raise HTTPException(
            status_code=422,
            detail=f"Limite de {_MAX_RULES_PER_TENANT} règles atteinte pour ce tenant",
        )

    rule = TenantCustomRule(tenant_id=tenant_id, **payload.model_dump())
    db.add(rule)
    db.flush()
    return CustomRuleResponse.model_validate(rule)


@router.put("/tenants/{tenant_id}/rules/{rule_id}", response_model=CustomRuleResponse)
def update_rule(
    tenant_id: int,
    rule_id: int,
    payload: CustomRuleUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
) -> CustomRuleResponse:
    if tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès interdit")

    rule = _get_rule_or_404(rule_id, tenant_id, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.flush()
    return CustomRuleResponse.model_validate(rule)


@router.delete("/tenants/{tenant_id}/rules/{rule_id}", status_code=204)
def delete_rule(
    tenant_id: int,
    rule_id: int,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
) -> None:
    if tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès interdit")

    rule = _get_rule_or_404(rule_id, tenant_id, db)
    db.delete(rule)
    db.flush()
