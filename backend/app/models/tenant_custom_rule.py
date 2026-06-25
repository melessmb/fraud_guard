from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text

from app.core.database import Base


class TenantCustomRule(Base):
    """Règle personnalisée d'un tenant — appliquée après le scoring ML."""

    __tablename__ = "tenant_custom_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # ── Conditions (AND — None = ignorer le critère) ───────────────────────
    min_amount = Column(Float, nullable=True)      # montant >=
    max_amount = Column(Float, nullable=True)      # montant <=
    channels = Column(JSON, nullable=True)         # liste de canaux ciblés
    countries = Column(JSON, nullable=True)        # liste de pays ciblés
    min_score = Column(Float, nullable=True)       # score ML >=
    max_score = Column(Float, nullable=True)       # score ML <=

    # ── Action ────────────────────────────────────────────────────────────
    # "block"  → is_fraud=True, score=1.0
    # "review" → is_fraud inchangé, flag requires_review=True
    # "flag"   → annotation sans modification du score
    action = Column(String(20), nullable=False, default="flag")

    priority = Column(Integer, nullable=False, default=100)  # plus petit = priorité haute
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
