"""Tests du pipeline ML et du moteur de scoring."""
from datetime import datetime

import pytest

from app.models.schemas import FraudEvent
from app.services.risk import _derive_velocity_features, _heuristic_fallback, evaluate_risk


def _make_event(**kwargs) -> FraudEvent:
    defaults = dict(
        transaction_id="txn-test-001",
        tenant_id=1,
        amount=50_000,
        currency="XOF",
        channel="mobile_money",
        country="CI",
        device_fingerprint="fp-abc123def456",
        ip_address="41.203.72.1",
        timestamp=datetime(2024, 1, 15, 14, 30),
    )
    defaults.update(kwargs)
    return FraudEvent(**defaults)


def test_evaluate_risk_returns_required_keys():
    event = _make_event()
    result = evaluate_risk(event)
    assert "score" in result
    assert "is_fraud" in result
    assert "model_version" in result
    assert "explanations" in result


def test_evaluate_risk_score_bounds():
    for amount in [100, 50_000, 5_000_000, 50_000_000]:
        event = _make_event(amount=amount)
        result = evaluate_risk(event)
        assert 0.0 <= result["score"] <= 1.0


def test_heuristic_high_risk():
    features = {
        "amount": 9_000_000,
        "channel": "mobile_money",
        "country": "CI",
        "device_fingerprint": "fp",
        "hour": 2,
        "velocity_1h": 1,
        "velocity_24h": 5,
    }
    result = _heuristic_fallback(features)
    assert result["is_fraud"] is True
    assert result["score"] >= 0.7


def test_heuristic_low_risk():
    features = {
        "amount": 500,
        "channel": "pos",
        "country": "CI",
        "device_fingerprint": "fp",
        "hour": 10,
        "velocity_1h": 1,
        "velocity_24h": 5,
    }
    result = _heuristic_fallback(features)
    assert result["is_fraud"] is False
    assert result["score"] < 0.7


def test_derive_velocity_features():
    event = _make_event(amount=12_000, features={"velocity_1h": 3, "velocity_24h": 15})
    features = _derive_velocity_features(event)
    assert features["amount"] == 12_000
    assert features["hour"] == 14
    assert features["channel"] == "mobile_money"
    assert features["velocity_1h"] == 3
    assert features["velocity_24h"] == 15


def test_evaluate_risk_night_transaction():
    event = _make_event(
        amount=2_000_000,
        channel="mobile_money",
        timestamp=datetime(2024, 1, 15, 2, 0),
    )
    result = evaluate_risk(event)
    assert 0.0 <= result["score"] <= 1.0


def test_evaluate_risk_consistent():
    event = _make_event()
    result1 = evaluate_risk(event)
    result2 = evaluate_risk(event)
    assert result1["score"] == result2["score"]
    assert result1["is_fraud"] == result2["is_fraud"]
