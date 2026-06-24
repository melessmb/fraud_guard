from sqlalchemy import Boolean, Column, Integer, String, UniqueConstraint
from app.core.database import Base


class TenantFeature(Base):
    """Plafond de features activées par FraudGuard pour chaque tenant."""
    __tablename__ = "tenant_features"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id  = Column(Integer, nullable=False, index=True)
    feature_key = Column(String(64), nullable=False)   # ex: "scoring", "conformite"
    enabled    = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "feature_key", name="uq_tenant_feature"),
    )
