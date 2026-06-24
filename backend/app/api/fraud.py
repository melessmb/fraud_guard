from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core import task_registry
from app.core.auth import get_current_tenant
from app.core.cache import check_rate_limit
from app.core.database import get_db
from app.core.pubsub import publish_fraud_alert
from app.models.fraud_log import FraudLog
from app.models.schemas import FraudEvent, FraudScoreResponse
from app.models.tenant import Tenant
from app.models.tenant_webhook import TenantWebhook
from app.services.evaluation import score_transaction
from app.services.hook_executor import call_hook

router = APIRouter()

_FRAUD_EVENT = "fraud_detected"


def _risk_level(score: float) -> str:
    if score >= 0.8: return "critical"
    if score >= 0.5: return "high"
    if score >= 0.3: return "medium"
    return "low"


@router.post("/score", response_model=FraudScoreResponse)
async def score_transaction_endpoint(
    event: FraudEvent,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
) -> FraudScoreResponse:
    # Rate limiting : 200 req/min par tenant
    if not check_rate_limit(tenant.id):
        raise HTTPException(status_code=429, detail="Limite de requêtes dépassée — réessayez dans 60s")

    # Isolation tenant : le tenant_id du payload doit correspondre à l'API key utilisée
    if event.tenant_id != tenant.id:
        raise HTTPException(
            status_code=403,
            detail="tenant_id ne correspond pas à votre clé API",
        )

    try:
        result = await score_transaction(event, tenant_id=tenant.id, db=db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    db.add(FraudLog(
        transaction_id=event.transaction_id,
        tenant_id=tenant.id,
        amount=event.amount,
        currency=event.currency,
        channel=event.channel,
        country=event.country,
        score=result.score,
        is_fraud=result.is_fraud,
        model_version=result.model_version,
        status="open" if result.is_fraud else "reviewed",
        explanations=result.explanations,
    ))
    db.commit()

    if result.is_fraud:
        risk = _risk_level(result.score)

        alert_payload = {
            "event":          _FRAUD_EVENT,
            "transaction_id": event.transaction_id,
            "tenant_id":      tenant.id,
            "score":          result.score,
            "risk_level":     risk,
            "amount":         event.amount,
            "currency":       event.currency,
            "channel":        event.channel,
            "country":        event.country,
            "model_version":  result.model_version,
            "timestamp":      event.timestamp.isoformat(),
        }

        # Notification SSE (dashboard temps réel)
        await publish_fraud_alert(tenant.id, alert_payload)

        # Webhook tenant — fire-and-forget, n'impacte pas le temps de réponse
        webhook: TenantWebhook | None = (
            db.query(TenantWebhook)
            .filter(TenantWebhook.tenant_id == tenant.id)
            .first()
        )
        if webhook and _FRAUD_EVENT in (webhook.events or []):
            task_registry.track(
                call_hook(webhook.url, alert_payload, secret=webhook.secret)
            )

    return result
