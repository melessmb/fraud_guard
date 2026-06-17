"""Tests d'intégration des endpoints API."""
from tests.conftest import ADMIN_KEY, TENANT_API_KEY


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_create_tenant_requires_admin(client):
    resp = client.post("/api/v1/tenants", json={
        "name": "No Auth Bank",
        "country": "CI",
        "environment": "sandbox",
        "api_key": "some-key",
    })
    assert resp.status_code == 403


def test_create_tenant_with_admin(client):
    resp = client.post(
        "/api/v1/tenants",
        json={"name": "Banque Atlantique CI", "country": "CI", "environment": "sandbox", "api_key": "api-ba-ci-001"},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "created"


def test_create_tenant_duplicate_key(client):
    payload = {"name": "Bank A", "country": "CI", "environment": "sandbox", "api_key": "dup-key-001"}
    client.post("/api/v1/tenants", json=payload, headers={"X-Admin-Key": ADMIN_KEY})
    resp = client.post("/api/v1/tenants", json={**payload, "name": "Bank B"}, headers={"X-Admin-Key": ADMIN_KEY})
    assert resp.status_code == 409


def test_list_tenants_requires_admin(client, test_tenant):
    resp = client.get("/api/v1/tenants")
    assert resp.status_code == 403


def test_list_tenants_with_admin(client, test_tenant):
    resp = client.get("/api/v1/tenants", headers={"X-Admin-Key": ADMIN_KEY})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_score_transaction_valid(client, test_tenant):
    resp = client.post(
        "/api/v1/score",
        json={
            "transaction_id": "txn-api-001",
            "tenant_id": test_tenant.id,
            "amount": 50_000,
            "currency": "XOF",
            "channel": "mobile_money",
            "country": "CI",
            "device_fingerprint": "fp-abc123def456",
            "ip_address": "41.203.72.1",
            "timestamp": "2024-01-15T14:30:00",
        },
        headers={"X-API-Key": TENANT_API_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert 0.0 <= data["score"] <= 1.0
    assert "model_version" in data


def test_score_wrong_tenant_id(client, test_tenant):
    """Un tenant ne peut pas scorer au nom d'un autre."""
    resp = client.post(
        "/api/v1/score",
        json={
            "transaction_id": "txn-api-002",
            "tenant_id": 99999,  # ID d'un autre tenant
            "amount": 50_000,
            "currency": "XOF",
            "channel": "pos",
            "country": "SN",
            "device_fingerprint": "fp-xyz",
            "ip_address": "1.2.3.4",
            "timestamp": "2024-01-15T10:00:00",
        },
        headers={"X-API-Key": TENANT_API_KEY},
    )
    assert resp.status_code == 403


def test_score_transaction_invalid_key(client):
    resp = client.post(
        "/api/v1/score",
        json={
            "transaction_id": "txn-api-003",
            "tenant_id": 1,
            "amount": 10_000,
            "currency": "XOF",
            "channel": "pos",
            "country": "SN",
            "device_fingerprint": "fp-xyz",
            "ip_address": "1.2.3.4",
            "timestamp": "2024-01-15T10:00:00",
        },
        headers={"X-API-Key": "mauvaise-cle"},
    )
    assert resp.status_code == 401


def test_get_tenant_metrics(client, test_tenant):
    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["tenant_id"] == test_tenant.id
    assert "transaction_count" in data


def test_get_tenant_metrics_not_found(client):
    assert client.get("/api/v1/tenants/99999/metrics").status_code == 404


def test_get_alerts(client, test_tenant):
    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/alerts")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_update_policy_requires_admin(client, test_tenant):
    resp = client.post(f"/api/v1/tenants/{test_tenant.id}/policies",
                       json={"score_threshold": 0.8})
    assert resp.status_code == 403


def test_update_policy_with_admin(client, test_tenant):
    resp = client.post(
        f"/api/v1/tenants/{test_tenant.id}/policies",
        json={"score_threshold": 0.75, "auto_reject_threshold": 0.95, "model_id": "fraud_v1"},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 200
    assert resp.json()["score_threshold"] == 0.75


def test_get_policy(client, test_tenant):
    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/policies")
    assert resp.status_code == 200
    assert "score_threshold" in resp.json()


def test_list_model_versions(client):
    resp = client.get("/api/v1/model/versions")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_promote_model_requires_admin(client):
    assert client.post("/api/v1/model/versions/v1/promote").status_code == 403


def test_promote_model_with_admin(client):
    resp = client.post("/api/v1/model/versions/v1/promote",
                       headers={"X-Admin-Key": ADMIN_KEY})
    assert resp.status_code == 200
    assert resp.json()["stage"] == "production"
