from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.auth import get_current_tenant
from app.core.audit import log_audit
from app.core.database import get_db
from app.models.fraud_log import FraudLog
from app.models.schemas import (
    AlertResponse,
    AlertStatusUpdate,
    BatchEventRequest,
    FraudScoreResponse,
    MetricsResponse,
    PolicyConfig,
    TenantRequest,
    TenantResponse,
    TenantUpdateRequest,
    TransactionListResponse,
    TransactionResponse,
    WebhookConfig,
)
from app.models.tenant import Tenant
from app.models.tenant_policy import TenantPolicy
from app.models.tenant_webhook import TenantWebhook

router = APIRouter()


# ── CRUD tenants ──────────────────────────────────────────────────────────────

@router.post("/tenants", status_code=201, dependencies=[Depends(require_admin)])
def create_tenant(payload: TenantRequest, db: Session = Depends(get_db)) -> dict:
    if payload.keycloak_id:
        existing = db.query(Tenant).filter(Tenant.keycloak_id == payload.keycloak_id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Ce Keycloak ID est déjà associé à un tenant")
    tenant = Tenant(
        name=payload.name,
        country=payload.country,
        environment=payload.environment,
        keycloak_id=payload.keycloak_id,
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
    return [TenantResponse.model_validate(t) for t in db.query(Tenant).all()]


@router.get("/tenants/{tenant_id}", response_model=TenantResponse, dependencies=[Depends(require_admin)])
def get_tenant(tenant_id: int, db: Session = Depends(get_db)) -> TenantResponse:
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return TenantResponse.model_validate(t)


@router.put("/tenants/{tenant_id}", response_model=TenantResponse, dependencies=[Depends(require_admin)])
def update_tenant(tenant_id: int, payload: TenantUpdateRequest, db: Session = Depends(get_db)) -> TenantResponse:
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    if payload.keycloak_id and payload.keycloak_id != t.keycloak_id:
        conflict = db.query(Tenant).filter(Tenant.keycloak_id == payload.keycloak_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Ce Keycloak ID est déjà utilisé")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    db.flush()
    log_audit(
        db,
        action_type="UPDATE_TENANT",
        actor_type="admin",
        resource_type="tenant",
        resource_id=str(tenant_id),
        details=payload.model_dump(exclude_none=True),
    )
    return TenantResponse.model_validate(t)


@router.delete("/tenants/{tenant_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)) -> None:
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    db.delete(t)
    db.flush()
    log_audit(
        db,
        action_type="DELETE_TENANT",
        actor_type="admin",
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={"name": t.name},
    )


# ── Policies ──────────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/policies", response_model=PolicyConfig, dependencies=[Depends(require_admin)])
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


@router.post("/tenants/{tenant_id}/policies", response_model=PolicyConfig, dependencies=[Depends(require_admin)])
def update_policy(tenant_id: int, policy: PolicyConfig, db: Session = Depends(get_db)) -> PolicyConfig:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    row = db.query(TenantPolicy).filter(TenantPolicy.tenant_id == tenant_id).first()
    if row:
        for f, v in policy.model_dump().items():
            setattr(row, f, v)
    else:
        db.add(TenantPolicy(tenant_id=tenant_id, **policy.model_dump()))
    db.flush()
    log_audit(db, action_type="UPDATE_POLICY", actor_type="admin",
              resource_type="policy", resource_id=str(tenant_id),
              details={"score_threshold": policy.score_threshold, "model_id": policy.model_id})
    return policy


# ── Metrics & Alerts ──────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/metrics", response_model=MetricsResponse, dependencies=[Depends(require_admin)])
def get_tenant_metrics(tenant_id: int, hours: int = Query(default=24, ge=1, le=168), db: Session = Depends(get_db)) -> MetricsResponse:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    since = datetime.utcnow() - timedelta(hours=hours)
    logs  = db.query(FraudLog).filter(FraudLog.tenant_id == tenant_id, FraudLog.created_at >= since).all()
    total       = len(logs)
    fraud_count = sum(1 for l in logs if l.is_fraud)
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


def _to_alert_response(l: FraudLog) -> AlertResponse:
    score = l.score
    if score >= 0.8:   risk = "critical"
    elif score >= 0.5: risk = "high"
    elif score >= 0.3: risk = "medium"
    else:              risk = "low"
    return AlertResponse(
        id=l.id, transaction_id=l.transaction_id, tenant_id=l.tenant_id,
        score=score, risk_level=risk, channel=l.channel, country=l.country,
        amount=l.amount, currency=l.currency, model_version=l.model_version,
        timestamp=l.created_at, status=l.status,
    )


@router.get("/tenants/{tenant_id}/alerts", response_model=List[AlertResponse], dependencies=[Depends(require_admin)])
def get_alerts(
    tenant_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    status: Optional[str] = Query(default=None, description="open | under_review | validated | rejected"),
    db: Session = Depends(get_db),
) -> List[AlertResponse]:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    q = db.query(FraudLog).filter(FraudLog.tenant_id == tenant_id, FraudLog.is_fraud.is_(True))
    if status:
        q = q.filter(FraudLog.status == status)
    logs = q.order_by(FraudLog.created_at.desc()).limit(limit).all()
    return [_to_alert_response(l) for l in logs]


@router.get("/tenants/{tenant_id}/alerts/{alert_id}", response_model=AlertResponse, dependencies=[Depends(require_admin)])
def get_alert(tenant_id: int, alert_id: int, db: Session = Depends(get_db)) -> AlertResponse:
    row = db.query(FraudLog).filter(
        FraudLog.id == alert_id, FraudLog.tenant_id == tenant_id, FraudLog.is_fraud.is_(True)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    return _to_alert_response(row)


@router.patch("/tenants/{tenant_id}/alerts/{alert_id}", response_model=AlertResponse, dependencies=[Depends(require_admin)])
def update_alert_status(
    tenant_id: int,
    alert_id: int,
    body: AlertStatusUpdate,
    db: Session = Depends(get_db),
    token: dict = Depends(require_admin),
) -> AlertResponse:
    row = db.query(FraudLog).filter(
        FraudLog.id == alert_id, FraudLog.tenant_id == tenant_id, FraudLog.is_fraud.is_(True)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    old_status = row.status
    row.status = body.status
    log_audit(
        db, action_type="ALERT_STATUS_UPDATE", actor_type="user",
        actor_id=token.get("sub"), resource_type="alert", resource_id=str(alert_id),
        tenant_id=tenant_id,
        details={"from": old_status, "to": body.status, "comment": body.comment},
    )
    db.commit()
    db.refresh(row)
    return _to_alert_response(row)


# ── Webhooks ──────────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/webhooks", dependencies=[Depends(require_admin)])
def get_webhook(tenant_id: int, db: Session = Depends(get_db)) -> dict:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    row = db.query(TenantWebhook).filter(TenantWebhook.tenant_id == tenant_id).first()
    if not row:
        return {"configured": False}
    return {"configured": True, "url": row.url, "events": row.events}


@router.post("/tenants/{tenant_id}/webhooks", status_code=201, dependencies=[Depends(require_admin)])
def configure_webhook(tenant_id: int, config: WebhookConfig, db: Session = Depends(get_db)) -> dict:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    row = db.query(TenantWebhook).filter(TenantWebhook.tenant_id == tenant_id).first()
    if row:
        row.url, row.events, row.secret = config.url, config.events, config.secret
    else:
        db.add(TenantWebhook(tenant_id=tenant_id, url=config.url, events=config.events, secret=config.secret))
    db.flush()
    log_audit(db, action_type="CONFIGURE_WEBHOOK", actor_type="admin",
              resource_type="webhook", resource_id=str(tenant_id),
              details={"url": config.url, "events": config.events})
    return {"status": "configured", "tenant_id": tenant_id, "url": config.url}


# ── Batch score ───────────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/events", response_model=List[FraudScoreResponse])
async def batch_score(
    tenant_id: int,
    batch: BatchEventRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
) -> List[FraudScoreResponse]:
    from app.services.evaluation import score_transaction
    if tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Accès interdit à ce tenant")
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    results: List[FraudScoreResponse] = []
    for event in batch.events:
        result = await score_transaction(event)
        db.add(FraudLog(
            transaction_id=event.transaction_id, tenant_id=tenant_id,
            amount=event.amount, currency=event.currency, channel=event.channel,
            country=event.country, score=result.score, is_fraud=result.is_fraud,
            model_version=result.model_version,
        ))
        results.append(result)
    db.flush()
    return results


@router.get("/metrics", response_model=MetricsResponse, include_in_schema=False)
def metrics_legacy(tenant_id: int, db: Session = Depends(get_db)) -> MetricsResponse:
    return get_tenant_metrics(tenant_id=tenant_id, db=db)


def _risk_level(score: float) -> str:
    if score >= 0.8:  return "critical"
    if score >= 0.5:  return "high"
    if score >= 0.3:  return "medium"
    return "low"


def _to_txn_response(row: FraudLog) -> TransactionResponse:
    return TransactionResponse(
        id=row.id,
        transaction_id=row.transaction_id,
        tenant_id=row.tenant_id,
        amount=row.amount,
        currency=row.currency,
        channel=row.channel,
        country=row.country,
        score=row.score,
        is_fraud=row.is_fraud,
        risk_level=_risk_level(row.score),
        model_version=row.model_version,
        status=row.status,
        created_at=row.created_at,
        data_expires_at=row.data_expires_at,
        is_anonymized=row.is_anonymized,
    )


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/transactions", response_model=TransactionListResponse)
def list_transactions(
    tenant_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    risk_level: Optional[str] = Query(default=None, description="low | medium | high | critical"),
    is_fraud: Optional[bool] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    _token: dict = Depends(require_admin),
) -> TransactionListResponse:
    q = db.query(FraudLog).filter(FraudLog.tenant_id == tenant_id)
    if is_fraud is not None:
        q = q.filter(FraudLog.is_fraud == is_fraud)
    if channel:
        q = q.filter(FraudLog.channel == channel)
    if country:
        q = q.filter(FraudLog.country == country)
    if date_from:
        q = q.filter(FraudLog.created_at >= date_from)
    if date_to:
        q = q.filter(FraudLog.created_at <= date_to)
    if risk_level:
        thresholds = {"critical": (0.8, 1.1), "high": (0.5, 0.8), "medium": (0.3, 0.5), "low": (0.0, 0.3)}
        if risk_level in thresholds:
            lo, hi = thresholds[risk_level]
            q = q.filter(FraudLog.score >= lo, FraudLog.score < hi)
    total = q.count()
    rows = q.order_by(FraudLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return TransactionListResponse(total=total, page=page, page_size=page_size, items=[_to_txn_response(r) for r in rows])


@router.get("/tenants/{tenant_id}/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    tenant_id: int,
    transaction_id: str,
    db: Session = Depends(get_db),
    _token: dict = Depends(require_admin),
) -> TransactionResponse:
    row = db.query(FraudLog).filter(
        FraudLog.tenant_id == tenant_id,
        FraudLog.transaction_id == transaction_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    return _to_txn_response(row)
