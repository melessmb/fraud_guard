from sqlalchemy import Column, Integer, String, UniqueConstraint
from app.core.database import Base


class TenantUser(Base):
    """Lie un utilisateur Keycloak (keycloak_user_id) à un tenant."""
    __tablename__ = "tenant_users"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id        = Column(Integer, nullable=False, index=True)
    keycloak_user_id = Column(String(255), nullable=False, index=True)
    role             = Column(String(32), nullable=False)  # rôle au moment de l'invitation

    __table_args__ = (
        UniqueConstraint("tenant_id", "keycloak_user_id", name="uq_tenant_user"),
    )
