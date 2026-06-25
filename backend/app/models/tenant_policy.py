from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String

from app.core.database import Base


class TenantPolicy(Base):
    __tablename__ = "tenant_policies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, nullable=False, unique=True, index=True)
    score_threshold = Column(Float, default=0.7, nullable=False)
    auto_reject_threshold = Column(Float, default=0.9, nullable=False)
    medium_risk_threshold = Column(Float, default=0.5, nullable=False)
    max_amount_xof = Column(Float, nullable=True)
    max_amount_usd = Column(Float, nullable=True)
    allowed_channels = Column(JSON, default=list, nullable=False)
    blocked_channels = Column(JSON, default=list, nullable=False)
    model_id = Column(String(64), default="fraud_v1", nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
