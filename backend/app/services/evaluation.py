from app.models.schemas import FraudEvent, FraudScoreResponse
from app.services.risk import evaluate_risk


async def score_transaction(event: FraudEvent) -> FraudScoreResponse:
    result = evaluate_risk(event)
    return FraudScoreResponse(
        transaction_id=event.transaction_id,
        score=result["score"],
        is_fraud=result["is_fraud"],
        model_version=result.get("model_version", "v1"),
        explanations=result.get("explanations"),
    )
