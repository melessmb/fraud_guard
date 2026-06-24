"""Tests gestion des API keys : génération, révocation, statut."""
from tests.conftest import bearer


# ── Génération ────────────────────────────────────────────────────────────────

def test_generate_api_key_as_admin(client, test_tenant):
    resp = client.post(f"/api/v1/tenants/{test_tenant.id}/api-key",
                       headers=bearer("admin"))
    assert resp.status_code == 200
    data = resp.json()
    assert "api_key" in data
    assert data["api_key"].startswith("fg_")
    assert data["tenant_id"] == test_tenant.id


def test_generate_api_key_as_tenant_admin(client, test_tenant):
    resp = client.post(f"/api/v1/tenants/{test_tenant.id}/api-key",
                       headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["api_key"].startswith("fg_")


def test_tenant_admin_cannot_generate_for_other_tenant(client, test_tenant, other_tenant):
    """tenant_admin ne peut générer une clé que pour son propre tenant."""
    resp = client.post(f"/api/v1/tenants/{other_tenant.id}/api-key",
                       headers=bearer("tenant_admin"))
    assert resp.status_code == 403


def test_generate_api_key_requires_auth(client, test_tenant):
    resp = client.post(f"/api/v1/tenants/{test_tenant.id}/api-key")
    assert resp.status_code == 401


def test_developer_cannot_generate_api_key(client, test_tenant):
    """Le rôle developer n'a pas accès à la gestion des API keys."""
    resp = client.post(f"/api/v1/tenants/{test_tenant.id}/api-key",
                       headers=bearer("developer"))
    assert resp.status_code == 403


# ── Statut ────────────────────────────────────────────────────────────────────

def test_api_key_status_after_generation(client, test_tenant):
    # Générer d'abord une clé
    client.post(f"/api/v1/tenants/{test_tenant.id}/api-key", headers=bearer("admin"))

    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/api-key/status",
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    assert resp.json()["has_key"] is True


# ── Révocation ────────────────────────────────────────────────────────────────

def test_revoke_api_key_as_admin(client, test_tenant):
    client.post(f"/api/v1/tenants/{test_tenant.id}/api-key", headers=bearer("admin"))
    resp = client.delete(f"/api/v1/tenants/{test_tenant.id}/api-key",
                         headers=bearer("admin"))
    assert resp.status_code == 204


def test_revoke_api_key_as_tenant_admin(client, test_tenant):
    client.post(f"/api/v1/tenants/{test_tenant.id}/api-key", headers=bearer("admin"))
    resp = client.delete(f"/api/v1/tenants/{test_tenant.id}/api-key",
                         headers=bearer("tenant_admin"))
    assert resp.status_code == 204


def test_status_is_false_after_revocation(client, test_tenant):
    client.post(f"/api/v1/tenants/{test_tenant.id}/api-key", headers=bearer("admin"))
    client.delete(f"/api/v1/tenants/{test_tenant.id}/api-key", headers=bearer("admin"))

    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/api-key/status",
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    assert resp.json()["has_key"] is False


def test_tenant_admin_cannot_revoke_other_tenant_key(client, test_tenant, other_tenant):
    client.post(f"/api/v1/tenants/{other_tenant.id}/api-key", headers=bearer("admin"))
    resp = client.delete(f"/api/v1/tenants/{other_tenant.id}/api-key",
                         headers=bearer("tenant_admin"))
    assert resp.status_code == 403
