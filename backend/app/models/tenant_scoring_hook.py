from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.core.database import Base


class TenantScoringHook(Base):
    """Hook appelé avant ou après le scoring ML — permet au tenant d'enrichir
    ou de modifier le résultat sans toucher au code de la plateforme."""

    __tablename__ = "tenant_scoring_hooks"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id  = Column(Integer, nullable=False, index=True)
    hook_type  = Column(String(32), nullable=False)    # "pre_score" | "post_score"
    name       = Column(String(128), nullable=False)   # label lisible
    url        = Column(String(512), nullable=False)
    secret     = Column(String(255), nullable=True)    # HMAC-SHA256 signing secret
    timeout_ms = Column(Integer, default=2000)         # max 5 000 ms
    enabled    = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)
