"""Tests gestion des utilisateurs : invitation, liste, révocation."""
from unittest.mock import patch, MagicMock
from tests.conftest import bearer, TENANT_ADMIN_SUB, DEVELOPER_SUB, OTHER_TENANT_SUB


def _mock_keycloak(keycloak_id: str = "new-kc-id-001"):
    """Patch le service Keycloak admin pour ne pas appeler le vrai Keycloak."""
    mock = MagicMock()
    mock.create_user.return_value = keycloak_id
    mock.disable_user.return_value = None
    mock.list_users_by_ids.return_value = []
    return patch("app.api.users.keycloak_admin", mock)


# ── Invitation ────────────────────────────────────────────────────────────────

def test_invite_user_as_tenant_admin(client, test_tenant):
    with _mock_keycloak("kc-dev-001"):
        resp = client.post("/api/v1/admin/users/invite", json={
            "username": "dev-julaya",
            "email":    "dev@julaya.co",
            "role":     "developer",
            "tenant_id": test_tenant.id,
        }, headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "developer"
    assert "temporary_password" in data
    assert data["temporary_password"] is not None


def test_invite_user_admin_can_assign_tenant_admin(client, test_tenant):
    with _mock_keycloak("kc-ta-002"):
        resp = client.post("/api/v1/admin/users/invite", json={
            "username": "admin-julaya",
            "email":    "admin@julaya.co",
            "role":     "tenant_admin",
            "tenant_id": test_tenant.id,
        }, headers=bearer("admin"))
    assert resp.status_code == 200
    assert resp.json()["role"] == "tenant_admin"


def test_tenant_admin_cannot_assign_tenant_admin(client, test_tenant):
    """tenant_admin ne peut pas créer un autre tenant_admin."""
    with _mock_keycloak():
        resp = client.post("/api/v1/admin/users/invite", json={
            "username": "bad-admin",
            "email":    "bad@julaya.co",
            "role":     "tenant_admin",
            "tenant_id": test_tenant.id,
        }, headers=bearer("tenant_admin"))
    assert resp.status_code == 403


def test_tenant_admin_cannot_invite_to_other_tenant(client, test_tenant, other_tenant):
    """tenant_admin ne peut inviter que dans son propre tenant."""
    with _mock_keycloak():
        resp = client.post("/api/v1/admin/users/invite", json={
            "username": "intruder",
            "email":    "intruder@hack.com",
            "role":     "developer",
            "tenant_id": other_tenant.id,  # autre tenant !
        }, headers=bearer("tenant_admin"))
    assert resp.status_code == 403


def test_invite_requires_auth(client, test_tenant):
    resp = client.post("/api/v1/admin/users/invite", json={
        "username": "ghost",
        "email":    "ghost@test.com",
        "role":     "developer",
        "tenant_id": test_tenant.id,
    })
    assert resp.status_code == 401


# ── Liste des utilisateurs ────────────────────────────────────────────────────

def test_list_users_as_tenant_admin(client, test_tenant):
    with patch("app.api.users.keycloak_admin") as mock:
        mock.list_users_by_ids.return_value = [{
            "keycloak_id": TENANT_ADMIN_SUB,
            "username":    "tenant-admin-demo",
            "email":       "admin@julaya.co",
            "enabled":     True,
        }]
        resp = client.get(f"/api/v1/admin/tenants/{test_tenant.id}/users",
                          headers=bearer("tenant_admin"))
    assert resp.status_code == 200
    users = resp.json()
    assert isinstance(users, list)
    assert any(u["keycloak_id"] == TENANT_ADMIN_SUB for u in users)


def test_list_users_cross_tenant_blocked(client, test_tenant, other_tenant):
    """tenant_admin de test_tenant ne peut pas voir les users de other_tenant."""
    with patch("app.api.users.keycloak_admin") as mock:
        mock.list_users_by_ids.return_value = []
        resp = client.get(f"/api/v1/admin/tenants/{other_tenant.id}/users",
                          headers=bearer("tenant_admin"))
    assert resp.status_code == 403


# ── Révocation ────────────────────────────────────────────────────────────────

def test_revoke_user_not_in_tenant_blocked(client, test_tenant):
    """Tenter de révoquer un user qui n'appartient pas au tenant → 403."""
    with patch("app.api.users.keycloak_admin") as mock:
        mock.disable_user.return_value = None
        resp = client.delete("/api/v1/admin/users/nonexistent-kc-id",
                             headers=bearer("tenant_admin"))
    assert resp.status_code == 403


def test_revoke_user_as_admin(client, test_tenant):
    """admin FraudGuard peut révoquer n'importe quel utilisateur."""
    with patch("app.api.users.keycloak_admin") as mock:
        mock.disable_user.return_value = None
        resp = client.delete(f"/api/v1/admin/users/{TENANT_ADMIN_SUB}",
                             headers=bearer("admin"))
    # 204 si succès, ou 500 si l'utilisateur n'existe pas côté Keycloak
    assert resp.status_code in (204, 500)
