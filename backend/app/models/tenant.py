from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, JSON

from app.core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    country = Column(String(64), nullable=False, index=True)
    environment = Column(String(32), nullable=False, index=True)
    api_key = Column(String(255), nullable=True, index=True)  # nullable : Keycloak devient la source d'auth
    keycloak_id = Column(String(255), nullable=True, index=True, unique=True)  # Keycloak user sub (UUID)
    config = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
