"""MVP standalone demo: fraud scoring + SQLite persistence without uvicorn."""

from datetime import datetime, timezone
from decimal import Decimal

from app.core.database import SessionLocal, Base, engine
from app.models.tenant import Tenant
from app.models.schemas import FraudEvent
from app.services.evaluation import evaluate_risk


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)


def ensure_tenant(db) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.api_key == "dev-key").first()
    if not tenant:
        tenant = Tenant(
            name="Demo Tenant",
            country="CI",
            environment="sandbox",
            api_key="dev-key",
        )
        db.add(tenant)
        db.flush()
    return tenant


def run() -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        tenant = ensure_tenant(db)
        sample = FraudEvent(
            transaction_id="tx_demo_1",
            tenant_id=tenant.id,
            amount=Decimal("12000000"),
            currency="XOF",
            channel="mobile_money",
            country="CI",
            device_fingerprint="dp_demo",
            ip_address="102.89.0.10",
            timestamp=datetime.now(timezone.utc),
            client_id="cli_demo",
        )
        result = evaluate_risk(sample)
        print("tenant_id:", tenant.id)
        print("score:", result["score"])
        print("is_fraud:", result["is_fraud"])
        print("explanations:", result.get("explanations"))
    finally:
        db.close()


if __name__ == "__main__":
    run()
