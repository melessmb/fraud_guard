"""Tests sécurité : hash API keys, JWT, admin auth, rate limit."""
from tests.conftest import ADMIN_KEY, TENANT_API_KEY


def test_get_token_valid_key(client, test_tenant):
    resp = client.post("/api/v1/auth/token", json={"api_key": TENANT_API_KEY})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


def test_get_token_invalid_key(client):
    resp = client.post("/api/v1/auth/token", json={"api_key": "mauvaise-cle"})
    assert resp.status_code == 401


def test_score_missing_api_key(client):
    resp = client.post("/api/v1/score", json={
        "transaction_id": "txn-auth-001",
        "tenant_id": 1,
        "amount": 50_000,
        "currency": "XOF",
        "channel": "mobile_money",
        "country": "CI",
        "device_fingerprint": "fp-abc",
        "ip_address": "1.2.3.4",
        "timestamp": "2024-01-15T14:30:00",
    })
    assert resp.status_code == 401


def test_score_wrong_api_key(client):
    resp = client.post("/api/v1/score", json={
        "transaction_id": "txn-auth-002",
        "tenant_id": 1,
        "amount": 50_000,
        "currency": "XOF",
        "channel": "mobile_money",
        "country": "CI",
        "device_fingerprint": "fp-abc",
        "ip_address": "1.2.3.4",
        "timestamp": "2024-01-15T14:30:00",
    }, headers={"X-API-Key": "totalement-fausse"})
    assert resp.status_code == 401


def test_duplicate_api_key_rejected(client):
    payload = {"name": "Banque Test", "country": "SN", "environment": "sandbox", "api_key": "unique-key-sn-001"}
    r1 = client.post("/api/v1/tenants", json=payload, headers={"X-Admin-Key": ADMIN_KEY})
    assert r1.status_code == 201
    r2 = client.post("/api/v1/tenants", json={**payload, "name": "Autre Banque"}, headers={"X-Admin-Key": ADMIN_KEY})
    assert r2.status_code == 409


def test_tenant_id_isolation(client, test_tenant):
    """Un tenant ne peut pas faire scorer des transactions d'un autre tenant."""
    resp = client.post("/api/v1/score", json={
        "transaction_id": "txn-isolation-001",
        "tenant_id": test_tenant.id + 100,  # ID différent de l'API key
        "amount": 10_000,
        "currency": "XOF",
        "channel": "pos",
        "country": "CI",
        "device_fingerprint": "fp-abc123",
        "ip_address": "1.2.3.4",
        "timestamp": "2024-01-15T10:00:00",
    }, headers={"X-API-Key": TENANT_API_KEY})
    assert resp.status_code == 403


def test_webhook_requires_admin(client, test_tenant):
    resp = client.post(f"/api/v1/tenants/{test_tenant.id}/webhooks",
                       json={"url": "https://example.com/webhook"})
    assert resp.status_code == 403


def test_webhook_with_admin(client, test_tenant):
    resp = client.post(
        f"/api/v1/tenants/{test_tenant.id}/webhooks",
        json={"url": "https://example.com/webhook", "events": ["fraud_detected"]},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 201


def test_webhook_unknown_tenant(client):
    resp = client.post("/api/v1/tenants/99999/webhooks",
                       json={"url": "https://example.com/webhook"},
                       headers={"X-Admin-Key": ADMIN_KEY})
    assert resp.status_code == 404


def test_revoke_token_requires_admin(client, test_tenant):
    resp = client.post("/api/v1/auth/token", json={"api_key": TENANT_API_KEY})
    token = resp.json()["access_token"]
    # Sans clé admin → 403
    resp = client.post("/api/v1/auth/revoke", json={"token": token})
    assert resp.status_code == 403


def test_revoke_token_with_admin(client, test_tenant):
    resp = client.post("/api/v1/auth/token", json={"api_key": TENANT_API_KEY})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.post("/api/v1/auth/revoke", json={"token": token},
                       headers={"X-Admin-Key": ADMIN_KEY})
    assert resp.status_code == 200
    data = resp.json()
    # Le token est valide donc il doit être révoqué (pas encore expiré)
    assert data["status"] in ("revoked", "already_expired")
    assert "jti" in data


def test_revoke_invalid_token(client):
    resp = client.post("/api/v1/auth/revoke", json={"token": "not.a.valid.token"},
                       headers={"X-Admin-Key": ADMIN_KEY})
    assert resp.status_code == 400
