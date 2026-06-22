from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_audit(
    db: Session,
    *,
    action_type: str,
    actor_type: str,
    actor_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    tenant_id: int | None = None,
    details: dict | None = None,
    outcome: str = "success",
) -> None:
    db.add(AuditLog(
        action_type=action_type,
        actor_type=actor_type,
        actor_id=str(actor_id) if actor_id is not None else None,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        tenant_id=tenant_id,
        details=details,
        outcome=outcome,
    ))
