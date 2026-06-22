from __future__ import annotations

from typing import Any, Dict

from app.models.schemas import FraudEvent


def _derive_velocity_features(event: FraudEvent) -> Dict[str, Any]:
    return {
        "amount": float(event.amount),
        "hour": event.timestamp.hour,
        "channel": event.channel,
        "country": event.country,
        "device_fingerprint": event.device_fingerprint,
        "velocity_1h": int(event.features.get("velocity_1h", 1)),
        "velocity_24h": int(event.features.get("velocity_24h", 5)),
    }


def evaluate_risk(event: FraudEvent, extra_context: Dict[str, Any] | None = None) -> Dict[str, Any]:
    features = _derive_velocity_features(event)
    # Injecte les features customs fournies par les pre-score hooks
    if extra_context:
        for k, v in extra_context.items():
            if isinstance(v, (int, float)):
                features[k] = v
    try:
        from app.ml.serve import predict
        return predict(features)
    except Exception:
        return _heuristic_fallback(features)


def _heuristic_fallback(features: Dict[str, Any]) -> Dict[str, Any]:
    score = 0.0
    amount = features.get("amount", 0.0)
    score += 0.4 * min(amount / 1_000_000.0, 1.0)

    channel_risk = {"mobile_money": 0.3, "web": 0.25, "pos": 0.2, "atm": 0.15}.get(
        features.get("channel", "web"), 0.2
    )
    score += channel_risk
    score = float(max(0.0, min(1.0, score)))
    return {
        "score": score,
        "is_fraud": score >= 0.7,
        "model_version": "v1-heuristic",
        "explanations": {"rule_version": "v1", "features": features},
    }
