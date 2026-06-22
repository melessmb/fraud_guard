from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_tenant
from app.core.cache import check_rate_limit
from app.core.database import get_db
from app.models.fraud_log import FraudLog
from app.models.schemas import FraudEvent, FraudScoreResponse
from app.models.tenant import Tenant
from app.services.evaluation import score_transaction

router = APIRouter()


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
    ))
    return result
