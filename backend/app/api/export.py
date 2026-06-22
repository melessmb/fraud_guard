"""Export CSV en streaming — transactions, alertes, journal d'audit.

Chaque endpoint renvoie un StreamingResponse pour éviter de tout charger
en mémoire (datasets pouvant dépasser 100k lignes pour BCEAO).
"""

import csv
import io
import logging
from datetime import datetime
from typing import Generator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.audit import log_audit
from app.core.database import get_db
from app.core.keycloak_auth import oauth2_scheme, decode_keycloak_token
from app.core.roles import ADMIN, COMPLIANCE_READ_ROLES, get_tenant_for_user, require_any_role
from app.models.audit_log import AuditLog
from app.models.fraud_log import FraudLog
from app.models.tenant import Tenant

log = logging.getLogger(__name__)
router = APIRouter()

_CHUNK = 500  # lignes par batch SQL


def _risk_level(score: float) -> str:
    if score >= 0.8: return "critical"
    if score >= 0.5: return "high"
    if score >= 0.3: return "medium"
    return "low"


def _csv_stream(headers: list[str], rows_gen: Generator) -> Generator[bytes, None, None]:
    """Génère le CSV en chunks sans tout charger en RAM."""
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    writer.writerow(headers)
    yield buf.getvalue().encode("utf-8-sig")  # BOM pour Excel

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    count = 0
    for row in rows_gen:
        writer.writerow(row)
        count += 1
        if count % _CHUNK == 0:
            yield buf.getvalue().encode("utf-8-sig")
            buf = io.StringIO()
            writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    tail = buf.getvalue()
    if tail:
        yield tail.encode("utf-8-sig")


def _csv_response(filename: str, headers: list[str], rows_gen: Generator) -> StreamingResponse:
    return StreamingResponse(
        _csv_stream(headers, rows_gen),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


def _resolve_tenant(token: str, db: Session, requested: Optional[int]) -> Optional[int]:
    payload = decode_keycloak_token(token)
    roles   = set(payload.get("realm_access", {}).get("roles", []))
    if ADMIN in roles:
        return requested
    tenant = get_tenant_for_user(token, db)
    return tenant.id if tenant else None


# ── Export transactions ───────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/export/transactions")
def export_transactions(
    tenant_id:  int,
    date_from:  Optional[datetime] = Query(default=None),
    date_to:    Optional[datetime] = Query(default=None),
    is_fraud:   Optional[bool]     = Query(default=None),
    risk_level: Optional[str]      = Query(default=None),
    channel:    Optional[str]      = Query(default=None),
    country:    Optional[str]      = Query(default=None),
    token:      str = Depends(oauth2_scheme),
    db:         Session = Depends(get_db),
) -> StreamingResponse:
    """Export CSV de toutes les transactions d'un tenant (filtrable)."""
    _check = require_any_role(*COMPLIANCE_READ_ROLES)
    _check(token=token)

    effective_tenant = _resolve_tenant(token, db, tenant_id)
    if effective_tenant is None:
        raise HTTPException(403, "Accès refusé")

    q = db.query(FraudLog).filter(FraudLog.tenant_id == effective_tenant)
    if is_fraud   is not None: q = q.filter(FraudLog.is_fraud == is_fraud)
    if channel:                q = q.filter(FraudLog.channel == channel)
    if country:                q = q.filter(FraudLog.country == country)
    if date_from:              q = q.filter(FraudLog.created_at >= date_from)
    if date_to:                q = q.filter(FraudLog.created_at <= date_to)
    if risk_level:
        thresholds = {"critical": (0.8, 2.0), "high": (0.5, 0.8), "medium": (0.3, 0.5), "low": (0.0, 0.3)}
        if risk_level in thresholds:
            lo, hi = thresholds[risk_level]
            q = q.filter(FraudLog.score >= lo, FraudLog.score < hi)
    q = q.order_by(FraudLog.created_at.desc())

    log_audit(db, action_type="EXPORT_TRANSACTIONS", actor_type="user",
              actor_id=decode_keycloak_token(token).get("sub"),
              resource_type="tenant", resource_id=str(effective_tenant),
              tenant_id=effective_tenant,
              details={"date_from": str(date_from), "date_to": str(date_to), "filters": {"is_fraud": is_fraud, "channel": channel, "country": country}})
    db.commit()

    filename = f"transactions_tenant{effective_tenant}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
    headers = ["id", "transaction_id", "montant", "devise", "canal", "pays",
               "score_fraude", "niveau_risque", "est_fraude", "statut",
               "version_modele", "date_creation", "expiration_donnees"]

    def rows():
        for row in q.yield_per(_CHUNK):
            yield [
                row.id, row.transaction_id, row.amount, row.currency,
                row.channel, row.country,
                f"{row.score:.4f}", _risk_level(row.score),
                "oui" if row.is_fraud else "non", row.status,
                row.model_version,
                row.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                row.data_expires_at.strftime("%Y-%m-%d") if row.data_expires_at else "",
            ]

    return _csv_response(filename, headers, rows())


# ── Export alertes ────────────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/export/alerts")
def export_alerts(
    tenant_id: int,
    date_from: Optional[datetime] = Query(default=None),
    date_to:   Optional[datetime] = Query(default=None),
    status:    Optional[str]      = Query(default=None),
    token:     str = Depends(oauth2_scheme),
    db:        Session = Depends(get_db),
) -> StreamingResponse:
    """Export CSV des alertes fraude d'un tenant."""
    _check = require_any_role(*COMPLIANCE_READ_ROLES)
    _check(token=token)

    effective_tenant = _resolve_tenant(token, db, tenant_id)
    if effective_tenant is None:
        raise HTTPException(403, "Accès refusé")

    q = (db.query(FraudLog)
         .filter(FraudLog.tenant_id == effective_tenant, FraudLog.is_fraud.is_(True)))
    if status:    q = q.filter(FraudLog.status == status)
    if date_from: q = q.filter(FraudLog.created_at >= date_from)
    if date_to:   q = q.filter(FraudLog.created_at <= date_to)
    q = q.order_by(FraudLog.created_at.desc())

    log_audit(db, action_type="EXPORT_ALERTS", actor_type="user",
              actor_id=decode_keycloak_token(token).get("sub"),
              resource_type="tenant", resource_id=str(effective_tenant),
              tenant_id=effective_tenant,
              details={"date_from": str(date_from), "date_to": str(date_to), "status": status})
    db.commit()

    filename = f"alertes_tenant{effective_tenant}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
    headers = ["id", "transaction_id", "montant", "devise", "canal", "pays",
               "score_fraude", "niveau_risque", "statut_alerte",
               "version_modele", "date_alerte"]

    def rows():
        for row in q.yield_per(_CHUNK):
            yield [
                row.id, row.transaction_id, row.amount, row.currency,
                row.channel, row.country,
                f"{row.score:.4f}", _risk_level(row.score), row.status,
                row.model_version,
                row.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            ]

    return _csv_response(filename, headers, rows())


# ── Export journal d'audit ────────────────────────────────────────────────────

@router.get("/export/audit-log")
def export_audit_log(
    date_from:   Optional[datetime] = Query(default=None),
    date_to:     Optional[datetime] = Query(default=None),
    action_type: Optional[str]      = Query(default=None),
    tenant_id:   Optional[int]      = Query(default=None),
    token:       str = Depends(oauth2_scheme),
    db:          Session = Depends(get_db),
) -> StreamingResponse:
    """Export CSV du journal d'audit (admin/compliance uniquement)."""
    _check = require_any_role(*COMPLIANCE_READ_ROLES)
    _check(token=token)

    effective_tenant = _resolve_tenant(token, db, tenant_id)

    q = db.query(AuditLog).order_by(AuditLog.timestamp.asc())
    if action_type:      q = q.filter(AuditLog.action_type == action_type)
    if effective_tenant: q = q.filter(AuditLog.tenant_id == effective_tenant)
    if date_from:        q = q.filter(AuditLog.timestamp >= date_from)
    if date_to:          q = q.filter(AuditLog.timestamp <= date_to)

    log_audit(db, action_type="EXPORT_AUDIT_LOG", actor_type="user",
              actor_id=decode_keycloak_token(token).get("sub"),
              resource_type="audit_log", tenant_id=effective_tenant,
              details={"date_from": str(date_from), "date_to": str(date_to), "action_type": action_type})
    db.commit()

    filename = f"journal_audit_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
    headers = ["id", "horodatage", "type_action", "type_acteur", "id_acteur",
               "type_ressource", "id_ressource", "tenant_id", "resultat", "details"]

    def rows():
        for row in q.yield_per(_CHUNK):
            yield [
                row.id,
                row.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                row.action_type, row.actor_type,
                row.actor_id or "", row.resource_type or "",
                row.resource_id or "", row.tenant_id or "",
                row.outcome,
                str(row.details or ""),
            ]

    return _csv_response(filename, headers, rows())
