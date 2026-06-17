import hashlib
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.audit import log_audit
from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.fraud_log import FraudLog
from app.models.schemas import AuditLogResponse
from app.models.tenant_policy import TenantPolicy

router = APIRouter()


@router.get("/compliance/audit-log", dependencies=[Depends(require_admin)])
def get_audit_log(
    limit: int = 100,
    offset: int = 0,
    action_type: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if action_type:
        q = q.filter(AuditLog.action_type == action_type)
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {"total": total, "rows": [AuditLogResponse.model_validate(r) for r in rows]}


@router.get("/compliance/report", dependencies=[Depends(require_admin)])
def compliance_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    try:
        dt_from = (
            datetime.fromisoformat(from_date)
            if from_date
            else datetime.utcnow() - timedelta(days=30)
        )
        dt_to = datetime.fromisoformat(to_date) if to_date else datetime.utcnow()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide (ISO 8601 attendu)")

    logs = (
        db.query(FraudLog)
        .filter(FraudLog.created_at >= dt_from, FraudLog.created_at <= dt_to)
        .all()
    )
    total = len(logs)
    fraud_count = sum(1 for log in logs if log.is_fraud)
    anonymized = sum(1 for log in logs if log.is_anonymized)

    by_channel: dict = {}
    by_country: dict = {}
    by_model: dict = {}
    for log in logs:
        by_channel[log.channel] = by_channel.get(log.channel, 0) + 1
        by_country[log.country] = by_country.get(log.country, 0) + 1
        by_model[log.model_version] = by_model.get(log.model_version, 0) + 1

    admin_actions = (
        db.query(AuditLog)
        .filter(AuditLog.timestamp >= dt_from, AuditLog.timestamp <= dt_to)
        .count()
    )

    return {
        "period_from": dt_from.isoformat(),
        "period_to": dt_to.isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
        "regulatory_reference": "BCEAO Instruction n°008-05-2015 — Rétention 5 ans",
        "transactions": {
            "total": total,
            "fraud_detected": fraud_count,
            "fraud_rate": round(fraud_count / total, 4) if total > 0 else 0.0,
            "anonymized": anonymized,
            "by_channel": by_channel,
            "by_country": by_country,
            "by_model_version": by_model,
        },
        "audit_actions": admin_actions,
        "data_retention_policy": "5 ans (BCEAO) — Suppression automatique après expiration",
    }


@router.get("/compliance/transactions/{transaction_id}/explanation")
def get_explanation(transaction_id: str, db: Session = Depends(get_db)) -> dict:
    """Droit à l'explication — RGPD Art. 22 / Loi ARTCI CI / CDP SN."""
    log = db.query(FraudLog).filter(FraudLog.transaction_id == transaction_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Transaction introuvable")

    policy = (
        db.query(TenantPolicy).filter(TenantPolicy.tenant_id == log.tenant_id).first()
    )
    threshold = policy.score_threshold if policy else 0.7

    return {
        "transaction_id": log.transaction_id,
        "scored_at": log.created_at.isoformat(),
        "is_anonymized": log.is_anonymized,
        "scoring_decision": {
            "score": round(log.score, 4),
            "is_fraud": log.is_fraud,
            "threshold_applied": threshold,
            "model_version": log.model_version,
            "automated_decision": True,
        },
        "transaction_context": {
            "amount": log.amount,
            "currency": log.currency,
            "channel": log.channel,
            "country": log.country,
        },
        "legal_basis": (
            "Prévention de la fraude financière conformément à l'Instruction BCEAO "
            "n°008-05-2015 relative aux systèmes de paiement électronique dans l'UEMOA."
        ),
        "data_retention": {
            "expires_at": log.data_expires_at.isoformat() if log.data_expires_at else None,
            "policy": "Conservation 5 ans minimum (BCEAO) — Pseudonymisation sur demande",
        },
        "contact": "dpo@fraudguard.ci — Délégué à la Protection des Données",
    }


@router.post(
    "/compliance/anonymize/{transaction_id}",
    dependencies=[Depends(require_admin)],
)
def anonymize_transaction(transaction_id: str, db: Session = Depends(get_db)) -> dict:
    """Pseudonymisation d'une transaction (droit à l'effacement limité — BCEAO 5 ans)."""
    log = db.query(FraudLog).filter(FraudLog.transaction_id == transaction_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    if log.is_anonymized:
        return {"status": "already_anonymized", "transaction_id": transaction_id}

    original_hash = hashlib.sha256(log.transaction_id.encode()).hexdigest()[:16]
    pseudonym = f"anon-{original_hash}"
    log.transaction_id = pseudonym
    log.is_anonymized = True
    db.flush()

    log_audit(
        db,
        action_type="ANONYMIZE_TRANSACTION",
        actor_type="admin",
        resource_type="transaction",
        resource_id=pseudonym,
        details={"original_id_hash": original_hash},
    )
    return {"status": "anonymized", "pseudonym": pseudonym}


@router.get("/compliance/retention-stats", dependencies=[Depends(require_admin)])
def retention_stats(db: Session = Depends(get_db)) -> dict:
    total = db.query(FraudLog).count()
    expired = (
        db.query(FraudLog)
        .filter(FraudLog.data_expires_at < datetime.utcnow())
        .count()
    )
    anonymized = db.query(FraudLog).filter(FraudLog.is_anonymized.is_(True)).count()

    return {
        "total_records": total,
        "expired_records": expired,
        "anonymized_records": anonymized,
        "retention_policy_years": 5,
        "regulatory_reference": "BCEAO Instruction n°008-05-2015",
    }


@router.delete("/compliance/expired", dependencies=[Depends(require_admin)])
def purge_expired_records(db: Session = Depends(get_db)) -> dict:
    """Supprime les enregistrements dont la durée de conservation BCEAO est expirée."""
    expired = (
        db.query(FraudLog)
        .filter(FraudLog.data_expires_at < datetime.utcnow())
        .all()
    )
    count = len(expired)
    for rec in expired:
        db.delete(rec)
    db.flush()

    if count > 0:
        log_audit(
            db,
            action_type="PURGE_EXPIRED",
            actor_type="admin",
            resource_type="fraud_log",
            details={"purged_count": count},
        )

    return {"status": "purged", "records_deleted": count}
