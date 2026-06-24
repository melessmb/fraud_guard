"""Tests permissions pages et plafond features."""
from tests.conftest import bearer


# ── Lecture des permissions ───────────────────────────────────────────────────

def test_get_permissions_as_tenant_admin(client, test_tenant):
    resp = client.get(f"/api/v1/admin/tenants/{test_tenant.id}/permissions",
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["tenant_id"] == test_tenant.id
    assert "pages" in data
    pages = {p["key"]: p for p in data["pages"]}
    assert "dashboard" in pages
    assert "equipe" in pages
    # Les defaults doivent être présents
    assert "perms" in pages["dashboard"]


def test_get_permissions_cross_tenant_blocked(client, test_tenant, other_tenant):
    resp = client.get(f"/api/v1/admin/tenants/{other_tenant.id}/permissions",
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 403


def test_get_permissions_unknown_tenant(client):
    resp = client.get("/api/v1/admin/tenants/99999/permissions",
                      headers=bearer("admin"))
    assert resp.status_code == 404


# ── Modification des permissions ──────────────────────────────────────────────

def test_set_permission_as_tenant_admin(client, test_tenant):
    resp = client.put(f"/api/v1/admin/tenants/{test_tenant.id}/permissions",
                      json={"page_key": "scoring", "role": "compliance", "allowed": True},
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 204


def test_set_permission_invalid_page(client, test_tenant):
    resp = client.put(f"/api/v1/admin/tenants/{test_tenant.id}/permissions",
                      json={"page_key": "inexistant", "role": "developer", "allowed": True},
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 400


def test_set_permission_invalid_role(client, test_tenant):
    resp = client.put(f"/api/v1/admin/tenants/{test_tenant.id}/permissions",
                      json={"page_key": "dashboard", "role": "superuser", "allowed": True},
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 400


def test_tenant_admin_cannot_modify_tenant_admin_perms(client, test_tenant):
    """tenant_admin ne peut pas modifier les permissions du rôle tenant_admin."""
    resp = client.put(f"/api/v1/admin/tenants/{test_tenant.id}/permissions",
                      json={"page_key": "dashboard", "role": "tenant_admin", "allowed": False},
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 403


# ── Plafond features (admin FraudGuard uniquement) ────────────────────────────

def test_get_features_as_admin(client, test_tenant):
    resp = client.get(f"/api/v1/admin/tenants/{test_tenant.id}/features",
                      headers=bearer("admin"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["tenant_id"] == test_tenant.id
    assert "features" in data


def test_get_features_blocked_for_tenant_admin(client, test_tenant):
    resp = client.get(f"/api/v1/admin/tenants/{test_tenant.id}/features",
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 403


def test_disable_feature_blocks_permission_grant(client, test_tenant):
    """Si FraudGuard désactive 'analytique', tenant_admin ne peut pas l'activer."""
    # 1. Admin désactive la feature analytique
    resp = client.put(f"/api/v1/admin/tenants/{test_tenant.id}/features",
                      json={"feature_key": "analytique", "enabled": False},
                      headers=bearer("admin"))
    assert resp.status_code == 204

    # 2. tenant_admin tente d'activer la page analytique pour developer → 403
    resp = client.put(f"/api/v1/admin/tenants/{test_tenant.id}/permissions",
                      json={"page_key": "analytique", "role": "developer", "allowed": True},
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 403

    # 3. Remettre à True pour ne pas polluer les autres tests
    client.put(f"/api/v1/admin/tenants/{test_tenant.id}/features",
               json={"feature_key": "analytique", "enabled": True},
               headers=bearer("admin"))


# ── Mes permissions (endpoint portail) ───────────────────────────────────────

def test_my_permissions_returns_dict(client, test_tenant):
    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/permissions/me",
                      headers=bearer("developer"))
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "dashboard" in data
    assert isinstance(data["dashboard"], bool)


def test_my_permissions_tenant_admin_all_true(client, test_tenant):
    """tenant_admin a accès à toutes les pages."""
    resp = client.get(f"/api/v1/tenants/{test_tenant.id}/permissions/me",
                      headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    data = resp.json()
    assert all(data.values())
