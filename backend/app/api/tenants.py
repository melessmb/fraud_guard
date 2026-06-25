import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.auth import get_current_tenant, require_tenant_access
from app.core.rate_limit import enforce_batch
from app.core.audit import log_audit
from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.core.roles import ADMIN, TENANT_ADMIN
from app.core.security import hash_api_key
from app.models.fraud_log import FraudLog
from app.models.schemas import (
    AlertResponse,
    AlertStatusUpdate,
    AnalyticsResponse,
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


# ── Tenant courant (portal client) ───────────────────────────────────────────

@router.get("/my-tenant", response_model=TenantResponse)
def get_my_tenant(
    tenant: Tenant = Depends(get_current_tenant),
) -> TenantResponse:
    """Retourne le tenant de l'utilisateur connecté (rôle tenant/compliance/tenant_admin)."""
    return TenantResponse.model_validate(tenant)


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


@router.get("/tenants/{tenant_id}", response_model=TenantResponse, dependencies=[Depends(require_tenant_access)])
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


# ── API Keys ──────────────────────────────────────────────────────────────────

def _require_api_key_access(
    tenant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """Autorise admin FraudGuard OU tenant_admin du tenant concerné."""
    payload = decode_keycloak_token(token)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    if ADMIN in roles:
        return payload
    if TENANT_ADMIN not in roles:
        raise HTTPException(status_code=403, detail="Rôle 'admin' ou 'tenant_admin' requis")
    from app.core.auth import _resolve_tenant
    caller_tenant = _resolve_tenant(payload.get("sub", ""), db)
    if not caller_tenant or caller_tenant.id != tenant_id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez gérer que votre propre API key")
    return payload


@router.post("/tenants/{tenant_id}/api-key")
def generate_api_key(
    tenant_id: int,
    payload: dict = Depends(_require_api_key_access),
    db: Session = Depends(get_db),
) -> dict:
    """Génère une nouvelle API key pour le tenant. La clé en clair est retournée une
    seule fois — seul son hash HMAC est stocké en base."""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    plain_key = f"fg_{secrets.token_urlsafe(32)}"
    t.api_key = hash_api_key(plain_key)
    db.flush()
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    log_audit(
        db,
        action_type="GENERATE_API_KEY",
        actor_type="admin" if ADMIN in roles else "tenant_admin",
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={"name": t.name},
    )
    return {"api_key": plain_key, "tenant_id": tenant_id}


@router.delete("/tenants/{tenant_id}/api-key", status_code=204)
def revoke_api_key(
    tenant_id: int,
    payload: dict = Depends(_require_api_key_access),
    db: Session = Depends(get_db),
) -> None:
    """Révoque l'API key du tenant (met api_key à NULL)."""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    t.api_key = None
    db.flush()
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    log_audit(
        db,
        action_type="REVOKE_API_KEY",
        actor_type="admin" if ADMIN in roles else "tenant_admin",
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={"name": t.name},
    )


@router.get("/tenants/{tenant_id}/api-key/status", dependencies=[Depends(require_tenant_access)])
def get_api_key_status(tenant_id: int, db: Session = Depends(get_db)) -> dict:
    """Indique si le tenant possède une API key active (sans révéler le hash)."""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return {"has_key": t.api_key is not None, "tenant_id": tenant_id}


# ── Policies ──────────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/policies", response_model=PolicyConfig, dependencies=[Depends(require_tenant_access)])
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


@router.post("/tenants/{tenant_id}/policies", response_model=PolicyConfig, dependencies=[Depends(require_tenant_access)])
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

@router.get("/tenants/{tenant_id}/metrics", response_model=MetricsResponse, dependencies=[Depends(require_tenant_access)])
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


@router.get("/tenants/{tenant_id}/analytics", response_model=AnalyticsResponse, dependencies=[Depends(require_tenant_access)])
def get_tenant_analytics(
    tenant_id: int,
    days: int = Query(default=30, ge=7, le=365),
    db: Session = Depends(get_db),
) -> AnalyticsResponse:
    """Données agrégées pour le dashboard enrichi."""
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    now        = datetime.utcnow()
    cur_start  = now - timedelta(days=days)
    prev_start = cur_start - timedelta(days=days)

    def _load(since: datetime, until: datetime) -> list:
        return (db.query(FraudLog)
                .filter(FraudLog.tenant_id == tenant_id,
                        FraudLog.created_at >= since,
                        FraudLog.created_at < until)
                .order_by(FraudLog.created_at)
                .yield_per(500)
                .all())

    current_logs  = _load(cur_start, now)
    previous_logs = _load(prev_start, cur_start)

    def _summary(logs: list) -> dict:
        total = len(logs)
        fraud = sum(1 for l in logs if l.is_fraud)
        avg   = sum(l.score for l in logs) / total if total else 0.0
        return {"total": total, "fraud": fraud,
                "fraud_rate": fraud / total if total else 0.0,
                "avg_score": round(avg, 4)}

    # By day (current period)
    day_map: dict = {}
    for l in current_logs:
        key = l.created_at.strftime("%Y-%m-%d")
        if key not in day_map:
            day_map[key] = {"total": 0, "fraud": 0}
        day_map[key]["total"] += 1
        if l.is_fraud:
            day_map[key]["fraud"] += 1
    by_day = [{"date": d, "total": v["total"], "fraud": v["fraud"]}
              for d, v in sorted(day_map.items())]

    # By channel
    ch_map: dict = {}
    for l in current_logs:
        ch = (l.channel or "unknown").lower()
        if ch not in ch_map:
            ch_map[ch] = {"total": 0, "fraud": 0}
        ch_map[ch]["total"] += 1
        if l.is_fraud:
            ch_map[ch]["fraud"] += 1
    by_channel = sorted(
        [{"channel": k, **v} for k, v in ch_map.items()],
        key=lambda x: x["total"], reverse=True,
    )

    # By risk level
    by_risk = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for l in current_logs:
        if l.score >= 0.8:   by_risk["critical"] += 1
        elif l.score >= 0.5: by_risk["high"]     += 1
        elif l.score >= 0.3: by_risk["medium"]   += 1
        else:                by_risk["low"]       += 1

    # Top 10 countries
    co_map: dict = {}
    for l in current_logs:
        cc = l.country or "N/A"
        if cc not in co_map:
            co_map[cc] = {"total": 0, "fraud": 0}
        co_map[cc]["total"] += 1
        if l.is_fraud:
            co_map[cc]["fraud"] += 1
    by_country = sorted(
        [{"country": k, **v} for k, v in co_map.items()],
        key=lambda x: x["fraud"], reverse=True,
    )[:10]

    # Score distribution (5 buckets)
    buckets = [
        ("0–20%",  0.0,  0.2),
        ("20–40%", 0.2,  0.4),
        ("40–60%", 0.4,  0.6),
        ("60–80%", 0.6,  0.8),
        ("80–100%",0.8,  1.01),
    ]
    score_dist = []
    for label, lo, hi in buckets:
        score_dist.append({"bucket": label,
                           "count": sum(1 for l in current_logs if lo <= l.score < hi)})

    return AnalyticsResponse(
        period_days=days,
        current=_summary(current_logs),
        previous=_summary(previous_logs),
        by_day=by_day,
        by_channel=by_channel,
        by_risk=by_risk,
        by_country=by_country,
        score_distribution=score_dist,
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
        explanations=l.explanations,
    )


@router.get("/tenants/{tenant_id}/alerts", dependencies=[Depends(require_tenant_access)])
def get_alerts(
    tenant_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status: Optional[str] = Query(default=None, description="open | under_review | validated | rejected"),
    risk_level: Optional[str] = Query(default=None, description="low | medium | high | critical"),
    db: Session = Depends(get_db),
) -> dict:
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    q = db.query(FraudLog).filter(FraudLog.tenant_id == tenant_id, FraudLog.is_fraud.is_(True))
    if status:
        q = q.filter(FraudLog.status == status)
    if risk_level:
        q = q.filter(FraudLog.risk_level == risk_level)
    total = q.count()
    logs = q.order_by(FraudLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_to_alert_response(l) for l in logs],
    }


@router.get("/tenants/{tenant_id}/alerts/{alert_id}", response_model=AlertResponse, dependencies=[Depends(require_tenant_access)])
def get_alert(tenant_id: int, alert_id: int, db: Session = Depends(get_db)) -> AlertResponse:
    row = db.query(FraudLog).filter(
        FraudLog.id == alert_id, FraudLog.tenant_id == tenant_id, FraudLog.is_fraud.is_(True)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    return _to_alert_response(row)


@router.patch("/tenants/{tenant_id}/alerts/{alert_id}", response_model=AlertResponse, dependencies=[Depends(require_tenant_access)])
def update_alert_status(
    tenant_id: int,
    alert_id: int,
    body: AlertStatusUpdate,
    db: Session = Depends(get_db),

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
        actor_id=None, resource_type="alert", resource_id=str(alert_id),
        tenant_id=tenant_id,
        details={"from": old_status, "to": body.status, "comment": body.comment},
    )
    db.commit()
    db.refresh(row)
    return _to_alert_response(row)


# ── Webhooks ──────────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/webhooks", dependencies=[Depends(require_tenant_access)])
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


# ── Admin overview (multi-tenant comparatif) ─────────────────────────────────

@router.get("/admin/overview", dependencies=[Depends(require_admin)])
def get_admin_overview(
    days: int = Query(default=30, ge=7, le=365),
    db: Session = Depends(get_db),
) -> dict:
    """Statistiques agrégées pour tous les tenants — dashboard comparatif admin."""
    now       = datetime.utcnow()
    cur_start = now - timedelta(days=days)
    prv_start = cur_start - timedelta(days=days)

    tenants = db.query(Tenant).order_by(Tenant.id).all()

    tenant_stats = []
    totals = {"transactions": 0, "fraud": 0}

    for t in tenants:
        cur_logs = (
            db.query(FraudLog)
            .filter(FraudLog.tenant_id == t.id,
                    FraudLog.created_at >= cur_start,
                    FraudLog.created_at < now)
            .all()
        )
        prv_logs = (
            db.query(FraudLog)
            .filter(FraudLog.tenant_id == t.id,
                    FraudLog.created_at >= prv_start,
                    FraudLog.created_at < cur_start)
            .all()
        )

        cur_total = len(cur_logs)
        cur_fraud = sum(1 for l in cur_logs if l.is_fraud)
        prv_total = len(prv_logs)
        prv_fraud = sum(1 for l in prv_logs if l.is_fraud)

        cur_rate  = cur_fraud / cur_total if cur_total else 0.0
        prv_rate  = prv_fraud / prv_total if prv_total else 0.0
        avg_score = sum(l.score for l in cur_logs) / cur_total if cur_total else 0.0

        # Trend : delta taux de fraude
        trend_delta = cur_rate - prv_rate

        # By day (sparkline — 14 derniers jours)
        day_map: dict = {}
        cutoff = now - timedelta(days=14)
        for l in cur_logs:
            if l.created_at < cutoff:
                continue
            key = l.created_at.strftime("%Y-%m-%d")
            if key not in day_map:
                day_map[key] = {"total": 0, "fraud": 0}
            day_map[key]["total"] += 1
            if l.is_fraud:
                day_map[key]["fraud"] += 1
        sparkline = [
            {"date": d, "fraud": v["fraud"], "total": v["total"]}
            for d, v in sorted(day_map.items())
        ]

        totals["transactions"] += cur_total
        totals["fraud"]        += cur_fraud

        tenant_stats.append({
            "id":          t.id,
            "name":        t.name,
            "country":     t.country,
            "environment": t.environment,
            "transactions": cur_total,
            "fraud":        cur_fraud,
            "fraud_rate":   round(cur_rate, 4),
            "avg_score":    round(avg_score, 4),
            "trend_delta":  round(trend_delta, 4),
            "sparkline":    sparkline,
        })

    # Tri par fraud_rate desc
    tenant_stats.sort(key=lambda x: x["fraud_rate"], reverse=True)

    global_fraud_rate = totals["fraud"] / totals["transactions"] if totals["transactions"] else 0.0

    return {
        "period_days": days,
        "tenant_count": len(tenants),
        "totals": {
            "transactions": totals["transactions"],
            "fraud":        totals["fraud"],
            "fraud_rate":   round(global_fraud_rate, 4),
        },
        "tenants": tenant_stats,
    }


# ── Batch score ───────────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/events", response_model=List[FraudScoreResponse],
             responses={429: {"description": "Limite de requêtes dépassée"}})
async def batch_score(
    request: Request,
    tenant_id: int,
    batch: BatchEventRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
) -> List[FraudScoreResponse]:
    enforce_batch(request, tenant.id)
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
    _access: None = Depends(require_tenant_access),
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
    _access: None = Depends(require_tenant_access),
) -> TransactionResponse:
    row = db.query(FraudLog).filter(
        FraudLog.tenant_id == tenant_id,
        FraudLog.transaction_id == transaction_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    return _to_txn_response(row)
