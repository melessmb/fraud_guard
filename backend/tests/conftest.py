import os

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
from app.models.tenant_policy import TenantPolicy  # noqa: F401
from app.models.tenant_webhook import TenantWebhook  # noqa: F401

_TEST_ENGINE = create_engine(
    "sqlite:///./test_fraud.db", connect_args={"check_same_thread": False}
)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)

ADMIN_KEY = "test-admin-key"
TENANT_API_KEY = "test-api-key-123"


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


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_tenant(db_session) -> Tenant:
    hashed = hash_api_key(TENANT_API_KEY)
    # Nettoyer les éventuels doublons laissés par des tests précédents
    db_session.query(Tenant).filter(Tenant.api_key == hashed).delete()
    db_session.flush()

    tenant = Tenant(
        name="Test Bank CI",
        country="CI",
        environment="sandbox",
        api_key=hashed,
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant
