from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, JSON, String

from app.core.database import Base


class TenantWebhook(Base):
    __tablename__ = "tenant_webhooks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, nullable=False, unique=True, index=True)
    url = Column(String(512), nullable=False)
    events = Column(JSON, default=list, nullable=False)
    secret = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
