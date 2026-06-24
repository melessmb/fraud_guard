from datetime import datetime, timedelta

from app.models.fraud_log import FraudLog
from tests.conftest import bearer


def _make_log(db, tenant_id: int, transaction_id: str = "txn-comp-001") -> FraudLog:
    log = FraudLog(
        transaction_id=transaction_id,
        tenant_id=tenant_id,
        amount=250_000.0,
        currency="XOF",
        channel="mobile_money",
        country="CI",
        score=0.88,
        is_fraud=True,
        model_version="v1-lgbm",
        data_expires_at=datetime.utcnow() + timedelta(days=365 * 5),
    )
    db.add(log)
    db.flush()
    return log


# --------------------------------------------------------------------------- #
# Audit log                                                                     #
# --------------------------------------------------------------------------- #


def test_audit_log_requires_admin(client):
    r = client.get("/api/v1/compliance/audit-log")
    assert r.status_code == 401


def test_audit_log_with_admin(client, test_tenant, db_session):
    _make_log(db_session, test_tenant.id, "txn-audit-log-001")
    r = client.get("/api/v1/compliance/audit-log", headers=bearer("admin"))
    assert r.status_code == 200
    body = r.json()
    assert "total" in body
    assert isinstance(body["rows"], list)


def test_audit_log_filter_by_action(client, test_tenant, db_session):
    from app.core.audit import log_audit

    log_audit(db_session, action_type="TEST_ACTION", actor_type="admin")
    db_session.flush()
    r = client.get(
        "/api/v1/compliance/audit-log",
        params={"action_type": "TEST_ACTION"},
        headers=bearer("admin"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert all(row["action_type"] == "TEST_ACTION" for row in body["rows"])


# --------------------------------------------------------------------------- #
# Rapport de conformité                                                         #
# --------------------------------------------------------------------------- #


def test_compliance_report_requires_admin(client):
    r = client.get("/api/v1/compliance/report")
    assert r.status_code == 401


def test_compliance_report_returns_structure(client, test_tenant, db_session):
    _make_log(db_session, test_tenant.id, "txn-report-001")
    r = client.get("/api/v1/compliance/report", headers=bearer("admin"))
    assert r.status_code == 200
    body = r.json()
    assert "transactions" in body
    assert "regulatory_reference" in body
    assert "data_retention_policy" in body
    assert body["transactions"]["total"] >= 1


def test_compliance_report_invalid_date(client):
    r = client.get(
        "/api/v1/compliance/report",
        params={"from_date": "not-a-date"},
        headers=bearer("admin"),
    )
    assert r.status_code == 400


# --------------------------------------------------------------------------- #
# Droit à l'explication                                                        #
# --------------------------------------------------------------------------- #


def test_explanation_not_found(client):
    r = client.get(
        "/api/v1/compliance/transactions/txn-never-exists/explanation",
        headers=bearer("admin"),
    )
    assert r.status_code == 404


def test_explanation_returns_decision(client, test_tenant, db_session):
    log = _make_log(db_session, test_tenant.id, "txn-explain-001")
    r = client.get(
        f"/api/v1/compliance/transactions/{log.transaction_id}/explanation",
        headers=bearer("admin"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["transaction_id"] == log.transaction_id
    assert "scoring_decision" in body
    assert "legal_basis" in body
    assert "data_retention" in body


# --------------------------------------------------------------------------- #
# Anonymisation                                                                #
# --------------------------------------------------------------------------- #


def test_anonymize_requires_admin(client, test_tenant, db_session):
    log = _make_log(db_session, test_tenant.id, "txn-anon-no-auth")
    r = client.post(f"/api/v1/compliance/anonymize/{log.transaction_id}")
    assert r.status_code == 401


def test_anonymize_transaction(client, test_tenant, db_session):
    log = _make_log(db_session, test_tenant.id, "txn-anon-ok-001")
    original_id = log.transaction_id
    r = client.post(
        f"/api/v1/compliance/anonymize/{original_id}",
        headers=bearer("admin"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "anonymized"
    assert body["pseudonym"].startswith("anon-")


def test_anonymize_not_found(client):
    r = client.post(
        "/api/v1/compliance/anonymize/txn-does-not-exist",
        headers=bearer("admin"),
    )
    assert r.status_code == 404


def test_anonymize_already_anonymized(client, test_tenant, db_session):
    log = _make_log(db_session, test_tenant.id, "txn-anon-already")
    log.is_anonymized = True
    db_session.flush()
    r = client.post(
        f"/api/v1/compliance/anonymize/{log.transaction_id}",
        headers=bearer("admin"),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "already_anonymized"


# --------------------------------------------------------------------------- #
# Statistiques de rétention                                                    #
# --------------------------------------------------------------------------- #


def test_retention_stats_requires_admin(client):
    r = client.get("/api/v1/compliance/retention-stats")
    assert r.status_code == 401


def test_retention_stats_structure(client):
    r = client.get("/api/v1/compliance/retention-stats", headers=bearer("admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["retention_policy_years"] == 5
    assert "total_records" in body
    assert "expired_records" in body


# --------------------------------------------------------------------------- #
# Purge des enregistrements expirés                                            #
# --------------------------------------------------------------------------- #


def test_purge_expired_requires_admin(client):
    r = client.delete("/api/v1/compliance/expired")
    assert r.status_code == 401


def test_purge_expired_deletes_old_records(client, test_tenant, db_session):
    db_session.add(FraudLog(
        transaction_id="txn-expired-purge-001",
        tenant_id=test_tenant.id,
        amount=10_000.0,
        currency="XOF",
        channel="atm",
        country="SN",
        score=0.1,
        is_fraud=False,
        model_version="v1-lgbm",
        data_expires_at=datetime.utcnow() - timedelta(days=1),
    ))
    db_session.flush()

    r = client.delete("/api/v1/compliance/expired", headers=bearer("admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "purged"
    assert body["records_deleted"] >= 1
