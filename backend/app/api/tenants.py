from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.audit import log_audit
from app.core.database import get_db
from app.core.security import hash_api_key
from app.models.fraud_log import FraudLog
from app.models.schemas import (
    AlertResponse,
    BatchEventRequest,
    FraudScoreResponse,
    MetricsResponse,
    PolicyConfig,
    TenantRequest,
    TenantResponse,
    WebhookConfig,
)
from app.models.tenant import Tenant
from app.models.tenant_policy import TenantPolicy
from app.models.tenant_webhook import TenantWebhook

router = APIRouter()


@router.post("/tenants", status_code=201, dependencies=[Depends(require_admin)])
def create_tenant(payload: TenantRequest, db: Session = Depends(get_db)) -> dict:
    hashed = hash_api_key(payload.api_key)
    if db.query(Tenant).filter(Tenant.api_key == hashed).first():
        raise HTTPException(status_code=409, detail="Cette clé API existe déjà")
    tenant = Tenant(
        name=payload.name,
        country=payload.country,
        environment=payload.environment,
        api_key=hashed,
    )
    db.add(tenant)
    db.flush()
    log_audit(
        db,
        action_type="CREATE_TENANT",
        actor_type="admin",
        resource_type="tenant",
        resource_id=str(tenant.id),
        details={"name": payload.name, "country": payload.country, "environment": payload.environment},
    )
    return {"id": tenant.id, "status": "created"}


@router.get("/tenants", response_model=List[TenantResponse], dependencies=[Depends(require_admin)])
def list_tenants(db: Session = Depends(get_db)) -> List[TenantResponse]:
    rows = db.query(Tenant).all()
    return [TenantResponse.model_validate(row) for row in rows]


@router.get("/tenants/{tenant_id}/policies", response_model=PolicyConfig)
def get_policy(tenant_id: int, db: Session = Depends(get_db)) -> PolicyConfig:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    row = db.query(TenantPolicy).filter(TenantPolicy.tenant_id == tenant_id).first()
    if not row:
        return PolicyConfig()
    return PolicyConfig(
        score_threshold=row.score_threshold,
        auto_reject_threshold=row.auto_reject_threshold,
        max_amount_xof=row.max_amount_xof,
        max_amount_usd=row.max_amount_usd,
        allowed_channels=row.allowed_channels or [],
        blocked_channels=row.blocked_channels or [],
        model_id=row.model_id,
    )


@router.post(
    "/tenants/{tenant_id}/policies",
    response_model=PolicyConfig,
    dependencies=[Depends(require_admin)],
)
def update_policy(
    tenant_id: int, policy: PolicyConfig, db: Session = Depends(get_db)
) -> PolicyConfig:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    row = db.query(TenantPolicy).filter(TenantPolicy.tenant_id == tenant_id).first()
    if row:
        row.score_threshold = policy.score_threshold
        row.auto_reject_threshold = policy.auto_reject_threshold
        row.max_amount_xof = policy.max_amount_xof
        row.max_amount_usd = policy.max_amount_usd
        row.allowed_channels = policy.allowed_channels
        row.blocked_channels = policy.blocked_channels
        row.model_id = policy.model_id
    else:
        db.add(TenantPolicy(
            tenant_id=tenant_id,
            score_threshold=policy.score_threshold,
            auto_reject_threshold=policy.auto_reject_threshold,
            max_amount_xof=policy.max_amount_xof,
            max_amount_usd=policy.max_amount_usd,
            allowed_channels=policy.allowed_channels,
            blocked_channels=policy.blocked_channels,
            model_id=policy.model_id,
        ))
    db.flush()
    log_audit(
        db,
        action_type="UPDATE_POLICY",
        actor_type="admin",
        resource_type="policy",
        resource_id=str(tenant_id),
        details={"score_threshold": policy.score_threshold, "model_id": policy.model_id},
    )
    return policy


@router.post("/tenants/{tenant_id}/events", response_model=List[FraudScoreResponse])
async def batch_score(
    tenant_id: int, batch: BatchEventRequest, db: Session = Depends(get_db)
) -> List[FraudScoreResponse]:
    from app.services.evaluation import score_transaction

    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    results: List[FraudScoreResponse] = []
    for event in batch.events:
        result = await score_transaction(event)
        db.add(FraudLog(
            transaction_id=event.transaction_id,
            tenant_id=tenant_id,
            amount=event.amount,
            currency=event.currency,
            channel=event.channel,
            country=event.country,
            score=result.score,
            is_fraud=result.is_fraud,
            model_version=result.model_version,
        ))
        results.append(result)
    db.flush()
    return results


@router.get("/tenants/{tenant_id}/metrics", response_model=MetricsResponse)
def get_tenant_metrics(
    tenant_id: int, hours: int = 24, db: Session = Depends(get_db)
) -> MetricsResponse:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    since = datetime.utcnow() - timedelta(hours=hours)
    logs = (
        db.query(FraudLog)
        .filter(FraudLog.tenant_id == tenant_id, FraudLog.created_at >= since)
        .all()
    )
    total = len(logs)
    fraud_count = sum(1 for log in logs if log.is_fraud)

    return MetricsResponse(
        period_start=since,
        period_end=datetime.utcnow(),
        transaction_count=total,
        fraud_count=fraud_count,
        detection_rate=fraud_count / total if total > 0 else 0.0,
        false_positive_rate=0.0,
        model_version="v1-lgbm",
        tenant_id=tenant_id,
    )


@router.get("/tenants/{tenant_id}/alerts", response_model=List[AlertResponse])
def get_alerts(
    tenant_id: int, limit: int = 50, db: Session = Depends(get_db)
) -> List[AlertResponse]:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    logs = (
        db.query(FraudLog)
        .filter(FraudLog.tenant_id == tenant_id, FraudLog.is_fraud.is_(True))
        .order_by(FraudLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AlertResponse(
            id=log.id,
            transaction_id=log.transaction_id,
            tenant_id=log.tenant_id,
            score=log.score,
            channel=log.channel,
            amount=log.amount,
            currency=log.currency,
            timestamp=log.created_at,
            status=log.status,
        )
        for log in logs
    ]


@router.post(
    "/tenants/{tenant_id}/webhooks",
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def configure_webhook(
    tenant_id: int, config: WebhookConfig, db: Session = Depends(get_db)
) -> dict:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    row = db.query(TenantWebhook).filter(TenantWebhook.tenant_id == tenant_id).first()
    if row:
        row.url = config.url
        row.events = config.events
        row.secret = config.secret
    else:
        db.add(TenantWebhook(
            tenant_id=tenant_id,
            url=config.url,
            events=config.events,
            secret=config.secret,
        ))
    db.flush()
    log_audit(
        db,
        action_type="CONFIGURE_WEBHOOK",
        actor_type="admin",
        resource_type="webhook",
        resource_id=str(tenant_id),
        details={"url": config.url, "events": config.events},
    )
    return {"status": "configured", "tenant_id": tenant_id, "url": config.url}


@router.get("/metrics", response_model=MetricsResponse, include_in_schema=False)
def metrics_legacy(tenant_id: int, db: Session = Depends(get_db)) -> MetricsResponse:
    return get_tenant_metrics(tenant_id=tenant_id, db=db)
