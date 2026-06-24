import os
from unittest.mock import patch

# Forcer SQLite + clés de test AVANT tout import de l'app
os.environ["DATABASE_URL"] = "sqlite:///./test_fraud.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["ADMIN_API_KEY"] = "test-admin-key"
os.environ["DEBUG"] = "true"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import hash_api_key
from app.main import app
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.fraud_log import FraudLog  # noqa: F401
from app.models.tenant import Tenant  # noqa: F401
from app.models.tenant_feature import TenantFeature  # noqa: F401
from app.models.tenant_permission import TenantPagePermission  # noqa: F401
from app.models.tenant_policy import TenantPolicy  # noqa: F401
from app.models.tenant_user import TenantUser  # noqa: F401
from app.models.tenant_webhook import TenantWebhook  # noqa: F401
from app.core.roles import ADMIN, TENANT_ADMIN, DEVELOPER, COMPLIANCE, TENANT

_TEST_ENGINE = create_engine(
    "sqlite:///./test_fraud.db", connect_args={"check_same_thread": False}
)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)

ADMIN_KEY = "test-admin-key"
TENANT_API_KEY = "test-api-key-123"

# ── JWT payloads de test ──────────────────────────────────────────────────────

def _make_payload(sub: str, roles: list[str]) -> dict:
    return {
        "sub": sub,
        "preferred_username": sub,
        "email": f"{sub}@test.com",
        "realm_access": {"roles": roles},
        "exp": 9999999999,
    }

ADMIN_SUB         = "admin-keycloak-id"
TENANT_ADMIN_SUB  = "tenant-admin-keycloak-id"
DEVELOPER_SUB     = "developer-keycloak-id"
COMPLIANCE_SUB    = "compliance-keycloak-id"
OTHER_TENANT_SUB  = "other-tenant-admin-id"

PAYLOADS = {
    "admin":        _make_payload(ADMIN_SUB,        [ADMIN]),
    "tenant_admin": _make_payload(TENANT_ADMIN_SUB, [TENANT_ADMIN]),
    "developer":    _make_payload(DEVELOPER_SUB,    [DEVELOPER]),
    "compliance":   _make_payload(COMPLIANCE_SUB,   [COMPLIANCE]),
    "other_tenant": _make_payload(OTHER_TENANT_SUB, [TENANT_ADMIN]),
}


def bearer(role: str) -> dict:
    """Retourne un header Authorization factice identifié par rôle."""
    return {"Authorization": f"Bearer fake-{role}-token"}


# ── Database setup ────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=_TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=_TEST_ENGINE)


@pytest.fixture
def db_session(setup_database):
    session = _TestSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Client HTTP avec mock JWT ─────────────────────────────────────────────────

@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    def _mock_decode(token: str) -> dict:
        for role_key, payload in PAYLOADS.items():
            if f"fake-{role_key}-token" in token:
                return payload
        raise Exception("Token de test non reconnu")

    _DECODE_TARGETS = [
        "app.api.tenants.decode_keycloak_token",
        "app.api.users.decode_keycloak_token",
        "app.api.permissions.decode_keycloak_token",
        "app.api.auth.decode_keycloak_token",
        "app.api.hooks.decode_keycloak_token",
        "app.api.compliance.decode_keycloak_token",
        "app.core.auth.decode_keycloak_token",
        "app.core.keycloak_auth.decode_keycloak_token",
        "app.core.admin_auth.decode_keycloak_token",
        "app.core.roles.decode_keycloak_token",
    ]

    app.dependency_overrides[get_db] = _override_get_db
    mocks = [patch(t, side_effect=_mock_decode) for t in _DECODE_TARGETS]
    for m in mocks:
        m.start()
    try:
        with TestClient(app) as c:
            yield c
    finally:
        for m in mocks:
            m.stop()
    app.dependency_overrides.clear()


# ── Fixtures de données ───────────────────────────────────────────────────────

@pytest.fixture
def test_tenant(db_session) -> Tenant:
    hashed = hash_api_key(TENANT_API_KEY)
    db_session.query(Tenant).filter(Tenant.api_key == hashed).delete()
    db_session.query(Tenant).filter(Tenant.keycloak_id == TENANT_ADMIN_SUB).delete()
    db_session.flush()
    tenant = Tenant(
        name="Test Bank CI",
        country="CI",
        environment="sandbox",
        api_key=hashed,
        keycloak_id=TENANT_ADMIN_SUB,
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant


@pytest.fixture
def other_tenant(db_session) -> Tenant:
    db_session.query(Tenant).filter(Tenant.keycloak_id == OTHER_TENANT_SUB).delete()
    db_session.flush()
    tenant = Tenant(
        name="Other Bank SN",
        country="SN",
        environment="sandbox",
        keycloak_id=OTHER_TENANT_SUB,
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant
