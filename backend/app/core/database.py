from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

# check_same_thread est spécifique à SQLite (utilisé uniquement en tests)
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

_engine = create_engine(settings.database_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _apply_migrations() -> None:
    """Migrations incrémentales — ADD COLUMN IF NOT EXISTS pour les tables existantes."""
    if settings.database_url.startswith("sqlite"):
        return  # SQLite ne supporte pas IF NOT EXISTS sur ALTER TABLE
    migrations = [
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS keycloak_id VARCHAR(255)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_tenants_keycloak_id ON tenants (keycloak_id)",
        # api_key devient nullable (migration douce — pas de DROP)
        "ALTER TABLE tenants ALTER COLUMN api_key DROP NOT NULL",
        # SHAP values stockées par alerte
        "ALTER TABLE fraud_logs ADD COLUMN IF NOT EXISTS explanations JSONB",
        # tenant_id sur audit_logs pour le scoping par tenant
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_id ON audit_logs (tenant_id)",
    ]
    with _engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass  # ignore si déjà appliqué ou table inexistante
        conn.commit()


def init_db() -> None:
    import app.models.audit_log           # noqa: F401
    import app.models.fraud_log           # noqa: F401
    import app.models.tenant              # noqa: F401
    import app.models.tenant_policy       # noqa: F401
    import app.models.tenant_scoring_hook # noqa: F401
    import app.models.tenant_webhook      # noqa: F401
    import app.models.tenant_permission   # noqa: F401
    import app.models.tenant_user         # noqa: F401
    import app.models.tenant_feature      # noqa: F401
    Base.metadata.create_all(bind=_engine)
    _apply_migrations()
