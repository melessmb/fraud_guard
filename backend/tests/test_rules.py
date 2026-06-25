"""Tests CRUD des règles personnalisées + batch scoring."""
import pytest

from tests.conftest import bearer
from app.models.tenant_custom_rule import TenantCustomRule


# ── Custom rules CRUD ─────────────────────────────────────────────────────────

class TestCustomRulesCRUD:

    def test_list_rules_empty(self, client, test_tenant, db_session):
        # Nettoie les règles du tenant pour ce test
        db_session.query(TenantCustomRule).filter(
            TenantCustomRule.tenant_id == test_tenant.id
        ).delete()
        db_session.flush()

        r = client.get(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_create_rule(self, client, test_tenant):
        payload = {
            "name": "Bloquer gros montants nuit",
            "description": "Montant > 500 000 XOF",
            "min_amount": 500_000,
            "channels": ["mobile_money"],
            "countries": ["CI", "SN"],
            "min_score": 0.7,
            "action": "block",
            "priority": 10,
            "is_active": True,
        }
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            json=payload,
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"]      == payload["name"]
        assert data["action"]    == "block"
        assert data["priority"]  == 10
        assert data["tenant_id"] == test_tenant.id
        assert data["id"] > 0

    def test_list_rules_after_create(self, client, test_tenant):
        r = client.get(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_update_rule(self, client, test_tenant):
        rules = client.get(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            headers=bearer("tenant_admin"),
        ).json()
        rule_id = rules[0]["id"]

        r = client.put(
            f"/api/v1/tenants/{test_tenant.id}/rules/{rule_id}",
            json={"action": "review", "priority": 5},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["action"]   == "review"
        assert data["priority"] == 5

    def test_toggle_inactive(self, client, test_tenant):
        rules = client.get(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            headers=bearer("tenant_admin"),
        ).json()
        rule_id = rules[0]["id"]

        r = client.put(
            f"/api/v1/tenants/{test_tenant.id}/rules/{rule_id}",
            json={"is_active": False},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_delete_rule(self, client, test_tenant, db_session):
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            json={"name": "À supprimer", "action": "flag", "priority": 999},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 201
        rule_id = r.json()["id"]

        del_r = client.delete(
            f"/api/v1/tenants/{test_tenant.id}/rules/{rule_id}",
            headers=bearer("tenant_admin"),
        )
        assert del_r.status_code == 204
        assert db_session.get(TenantCustomRule, rule_id) is None

    def test_rule_not_found_returns_404(self, client, test_tenant):
        r = client.put(
            f"/api/v1/tenants/{test_tenant.id}/rules/999999",
            json={"action": "flag"},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 404

    def test_ownership_isolation(self, client, test_tenant, other_tenant):
        """Un tenant_admin ne peut pas créer une règle sur un autre tenant."""
        r = client.post(
            f"/api/v1/tenants/{other_tenant.id}/rules",
            json={"name": "Règle pirate", "action": "block", "priority": 1},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 403

    def test_rule_cap_50(self, client, test_tenant, db_session):
        """On ne peut pas créer plus de 50 règles par tenant."""
        db_session.query(TenantCustomRule).filter(
            TenantCustomRule.tenant_id == test_tenant.id
        ).delete()
        db_session.flush()

        for i in range(50):
            r = client.post(
                f"/api/v1/tenants/{test_tenant.id}/rules",
                json={"name": f"Règle {i}", "action": "flag", "priority": i + 1},
                headers=bearer("tenant_admin"),
            )
            assert r.status_code == 201, f"Échec règle {i}: {r.json()}"

        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            json={"name": "Règle 51", "action": "flag", "priority": 51},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 422
        assert "50" in r.json()["detail"]


# ── Validation des champs ─────────────────────────────────────────────────────

class TestCustomRulesValidation:

    def test_invalid_action(self, client, test_tenant):
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            json={"name": "Bad action", "action": "ignore", "priority": 1},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 422

    def test_score_out_of_range(self, client, test_tenant):
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            json={"name": "Bad score", "action": "flag", "min_score": 1.5, "priority": 1},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 422

    def test_priority_out_of_range(self, client, test_tenant):
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/rules",
            json={"name": "Bad prio", "action": "flag", "priority": 9999},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 422


# ── Batch scoring ─────────────────────────────────────────────────────────────

class TestBatchScoring:

    def _event(self, i: int, tenant_id: int = 1) -> dict:
        return {
            "transaction_id": f"batch-txn-{i}",
            "tenant_id": tenant_id,
            "amount": 10_000 + i * 1000,
            "currency": "XOF",
            "channel": "mobile_money",
            "country": "CI",
            "device_fingerprint": f"fp-test-{i}",
            "ip_address": "192.168.1.1",
            "timestamp": "2025-01-01T12:00:00Z",
        }

    def test_batch_score_single(self, client, test_tenant):
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/events",
            json={"events": [self._event(1, test_tenant.id)]},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        results = r.json()
        assert len(results) == 1
        assert "score" in results[0]
        assert "is_fraud" in results[0]
        assert results[0]["transaction_id"] == "batch-txn-1"

    def test_batch_score_multiple(self, client, test_tenant):
        events = [self._event(i, test_tenant.id) for i in range(5)]
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/events",
            json={"events": events},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        results = r.json()
        assert len(results) == 5
        for res in results:
            assert 0.0 <= res["score"] <= 1.0

    def test_batch_score_contains_rule_fields(self, client, test_tenant):
        """La réponse expose rule_triggered et rule_action (même si None)."""
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/events",
            json={"events": [self._event(99, test_tenant.id)]},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        result = r.json()[0]
        assert "rule_triggered" in result
        assert "rule_action" in result

    def test_batch_empty_returns_empty_list(self, client, test_tenant):
        """Une liste vide d'events retourne une liste vide (pas d'erreur)."""
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/events",
            json={"events": []},
            headers=bearer("tenant_admin"),
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_batch_requires_auth(self, client, test_tenant):
        r = client.post(
            f"/api/v1/tenants/{test_tenant.id}/events",
            json={"events": [self._event(1)]},
        )
        assert r.status_code in (401, 403)
