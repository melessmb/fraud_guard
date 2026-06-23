from datetime import datetime, timedelta

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String

from app.core.database import Base


def _data_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(days=365 * 5)


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
    # Conformité BCEAO : rétention 5 ans — Instruction n°008-05-2015
    data_expires_at = Column(DateTime, default=_data_expires_at, nullable=True)
    is_anonymized = Column(Boolean, default=False, nullable=False)
    # SHAP values + base_value stockés pour affichage dans le drawer
    explanations = Column(JSON, nullable=True)
