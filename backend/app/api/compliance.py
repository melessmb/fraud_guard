import hashlib
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.audit import log_audit
from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.core.roles import (
    ADMIN, COMPLIANCE_READ_ROLES, TENANT_WRITE_ROLES,
    get_tenant_for_user, require_any_role,
)
from app.models.audit_log import AuditLog
from app.models.fraud_log import FraudLog
from app.models.schemas import AuditLogResponse
from app.models.tenant_policy import TenantPolicy

router = APIRouter()


def _scoped_tenant_id(token: str, db: Session, requested_tenant_id: Optional[int]) -> Optional[int]:
    """
    Résout le tenant_id effectif selon le rôle :
    - admin → utilise requested_tenant_id (None = tous les tenants)
    - autres → force leur propre tenant, ignore requested_tenant_id
    """
    from app.core.keycloak_auth import decode_keycloak_token
    payload = decode_keycloak_token(token)
    roles   = set(payload.get("realm_access", {}).get("roles", []))
    if ADMIN in roles:
        return requested_tenant_id
    tenant = get_tenant_for_user(token, db)
    return tenant.id if tenant else None


@router.get("/compliance/audit-log")
def get_audit_log(
    limit:       int = 100,
    offset:      int = 0,
    action_type: Optional[str] = None,
    tenant_id:   Optional[int] = None,
    token:       str = Depends(oauth2_scheme),
    db:          Session = Depends(get_db),
) -> dict:
    """Journal d'audit — admin voit tout, compliance/tenant_admin voient leur tenant."""
    _check = require_any_role(*COMPLIANCE_READ_ROLES)
    _check(token=token)

    effective_tenant = _scoped_tenant_id(token, db, tenant_id)

    q = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if action_type:
        q = q.filter(AuditLog.action_type == action_type)
    if effective_tenant is not None:
        q = q.filter(AuditLog.resource_id == str(effective_tenant))

    total = q.count()
    rows  = q.offset(offset).limit(limit).all()
    return {"total": total, "rows": [AuditLogResponse.model_validate(r) for r in rows]}


@router.get("/compliance/report")
def compliance_report(
    from_date:  Optional[str] = None,
    to_date:    Optional[str] = None,
    tenant_id:  Optional[int] = None,
    token:      str = Depends(oauth2_scheme),
    db:         Session = Depends(get_db),
) -> dict:
    """Rapport BCEAO — admin voit tout, compliance/tenant_admin voient leur tenant."""
    _check = require_any_role(*COMPLIANCE_READ_ROLES)
    _check(token=token)

    effective_tenant = _scoped_tenant_id(token, db, tenant_id)

    try:
        dt_from = datetime.fromisoformat(from_date) if from_date else datetime.utcnow() - timedelta(days=30)
        dt_to   = datetime.fromisoformat(to_date)   if to_date   else datetime.utcnow()
    except ValueError:
        raise HTTPException(400, "Format de date invalide (ISO 8601 attendu)")

    q = db.query(FraudLog).filter(
        FraudLog.created_at >= dt_from,
        FraudLog.created_at <= dt_to,
    )
    if effective_tenant is not None:
        q = q.filter(FraudLog.tenant_id == effective_tenant)

    logs  = q.all()
    total = len(logs)
    fraud_count = sum(1 for l in logs if l.is_fraud)
    anonymized  = sum(1 for l in logs if l.is_anonymized)

    by_channel: dict = {}
    by_country: dict = {}
    by_model:   dict = {}
    for l in logs:
        by_channel[l.channel]       = by_channel.get(l.channel, 0) + 1
        by_country[l.country]       = by_country.get(l.country, 0) + 1
        by_model[l.model_version]   = by_model.get(l.model_version, 0) + 1

    aq = db.query(AuditLog).filter(
        AuditLog.timestamp >= dt_from,
        AuditLog.timestamp <= dt_to,
    )
    admin_actions = aq.count()

    return {
        "period_from": dt_from.isoformat(),
        "period_to":   dt_to.isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
        "tenant_id": effective_tenant,
        "regulatory_reference": "BCEAO Instruction n°008-05-2015 — Rétention 5 ans",
        "transactions": {
            "total":          total,
            "fraud_detected": fraud_count,
            "fraud_rate":     round(fraud_count / total, 4) if total > 0 else 0.0,
            "anonymized":     anonymized,
            "by_channel":     by_channel,
            "by_country":     by_country,
            "by_model_version": by_model,
        },
        "audit_actions": admin_actions,
        "data_retention_policy": "5 ans (BCEAO) — Suppression automatique après expiration",
    }


@router.get("/compliance/transactions/{transaction_id}/explanation")
def get_explanation(
    transaction_id: str,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """Droit à l'explication — accessible à tous les rôles authentifiés."""
    log = db.query(FraudLog).filter(FraudLog.transaction_id == transaction_id).first()
    if not log:
        raise HTTPException(404, "Transaction introuvable")

    # Non-admin : vérifie que la transaction appartient à leur tenant
    payload = decode_keycloak_token(token)
    roles   = set(payload.get("realm_access", {}).get("roles", []))
    if ADMIN not in roles:
        tenant = get_tenant_for_user(token, db)
        if tenant and log.tenant_id != tenant.id:
            raise HTTPException(403, "Accès refusé à cette transaction.")

    policy    = db.query(TenantPolicy).filter(TenantPolicy.tenant_id == log.tenant_id).first()
    threshold = policy.score_threshold if policy else 0.7

    return {
        "transaction_id": log.transaction_id,
        "scored_at":      log.created_at.isoformat(),
        "is_anonymized":  log.is_anonymized,
        "scoring_decision": {
            "score":             round(log.score, 4),
            "is_fraud":          log.is_fraud,
            "threshold_applied": threshold,
            "model_version":     log.model_version,
            "automated_decision": True,
        },
        "transaction_context": {
            "amount":   log.amount,
            "currency": log.currency,
            "channel":  log.channel,
            "country":  log.country,
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


@router.post("/compliance/anonymize/{transaction_id}", dependencies=[Depends(require_admin)])
def anonymize_transaction(transaction_id: str, db: Session = Depends(get_db)) -> dict:
    log = db.query(FraudLog).filter(FraudLog.transaction_id == transaction_id).first()
    if not log:
        raise HTTPException(404, "Transaction introuvable")
    if log.is_anonymized:
        return {"status": "already_anonymized", "transaction_id": transaction_id}

    original_hash = hashlib.sha256(log.transaction_id.encode()).hexdigest()[:16]
    pseudonym     = f"anon-{original_hash}"
    log.transaction_id = pseudonym
    log.is_anonymized  = True
    db.flush()

    log_audit(db, action_type="ANONYMIZE_TRANSACTION", actor_type="admin",
              resource_type="transaction", resource_id=pseudonym,
              details={"original_id_hash": original_hash})
    return {"status": "anonymized", "pseudonym": pseudonym}


@router.get("/compliance/retention-stats", dependencies=[Depends(require_admin)])
def retention_stats(db: Session = Depends(get_db)) -> dict:
    total      = db.query(FraudLog).count()
    expired    = db.query(FraudLog).filter(FraudLog.data_expires_at < datetime.utcnow()).count()
    anonymized = db.query(FraudLog).filter(FraudLog.is_anonymized.is_(True)).count()
    return {
        "total_records": total, "expired_records": expired,
        "anonymized_records": anonymized, "retention_policy_years": 5,
        "regulatory_reference": "BCEAO Instruction n°008-05-2015",
    }


@router.delete("/compliance/expired", dependencies=[Depends(require_admin)])
def purge_expired_records(db: Session = Depends(get_db)) -> dict:
    expired = db.query(FraudLog).filter(FraudLog.data_expires_at < datetime.utcnow()).all()
    count   = len(expired)
    for rec in expired:
        db.delete(rec)
    db.flush()
    if count > 0:
        log_audit(db, action_type="PURGE_EXPIRED", actor_type="admin",
                  resource_type="fraud_log", details={"purged_count": count})
    return {"status": "purged", "records_deleted": count}
