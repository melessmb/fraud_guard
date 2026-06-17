from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String

from app.core.database import Base


class FraudLog(Base):
    __tablename__ = "fraud_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(255), nullable=False, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False)
    channel = Column(String(64), nullable=False)
    country = Column(String(64), nullable=False)
    score = Column(Float, nullable=False)
    is_fraud = Column(Boolean, nullable=False)
    model_version = Column(String(64), nullable=False)
    status = Column(String(32), default="reviewed", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
