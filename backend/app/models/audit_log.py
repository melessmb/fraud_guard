from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, JSON, String

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    action_type = Column(String(64), nullable=False, index=True)
    actor_type = Column(String(32), nullable=False)
    actor_id = Column(String(255), nullable=True)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)
    outcome = Column(String(32), default="success", nullable=False)
