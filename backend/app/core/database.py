from typing import Generator

from sqlalchemy import create_engine
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


def init_db() -> None:
    import app.models.fraud_log  # noqa: F401
    import app.models.tenant  # noqa: F401
    import app.models.tenant_policy  # noqa: F401
    import app.models.tenant_webhook  # noqa: F401
    Base.metadata.create_all(bind=_engine)
