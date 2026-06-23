from sqlalchemy import Boolean, Column, Integer, String, UniqueConstraint
from app.core.database import Base


class TenantPagePermission(Base):
    __tablename__ = "tenant_page_permissions"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    page_key  = Column(String(64), nullable=False)   # ex: "alertes", "scoring"
    role      = Column(String(32), nullable=False)   # "tenant_admin" | "compliance" | "tenant"
    allowed   = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "page_key", "role", name="uq_tenant_page_role"),
    )
