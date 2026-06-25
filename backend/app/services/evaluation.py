"""Pipeline de scoring — intègre les pre/post-score hooks des tenants."""
from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Optional

from sqlalchemy.orm import Session

from app.models.schemas import FraudEvent, FraudScoreResponse
from app.services.risk import evaluate_risk

log = logging.getLogger(__name__)

# Pool dédié à l'inférence CPU (LightGBM + SHAP) — libère l'event loop asyncio
_ML_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="ml-worker")


async def score_transaction(
    event: FraudEvent,
    *,
    tenant_id: Optional[int] = None,
    db: Optional[Session] = None,
) -> FraudScoreResponse:
    """Pipeline complet :
      1. Pre-score hooks  → enrichissement / blocage anticipé
      2. Scoring ML       → score + explications SHAP
      3. Post-score hooks → acceptation ou override du score
    """
    context: dict = {}
    hooks_context_reason: str = ""

    # ── 1. Pre-score hooks ────────────────────────────────────────────────────
    if tenant_id and db:
        from app.models.tenant_scoring_hook import TenantScoringHook
        from app.services.hook_executor import call_pre_score_hook

        pre_hooks = (
            db.query(TenantScoringHook)
            .filter(
                TenantScoringHook.tenant_id == tenant_id,
                TenantScoringHook.hook_type == "pre_score",
                TenantScoringHook.enabled.is_(True),
            )
            .all()
        )

        event_data = {
            "transaction_id":    event.transaction_id,
            "tenant_id":         tenant_id,
            "amount":            event.amount,
            "currency":          event.currency,
            "channel":           event.channel,
            "country":           event.country,
            "device_fingerprint": event.device_fingerprint,
            "ip_address":        event.ip_address,
            "timestamp":         event.timestamp.isoformat(),
        }

        for hook in pre_hooks:
            result = await call_pre_score_hook(
                hook.url, event_data,
                secret=hook.secret,
                timeout_ms=hook.timeout_ms,
            )
            context.update(result.get("context", {}))

            if result.get("action") == "block":
                log.info(
                    "Pre-score hook '%s' a bloqué la transaction %s : %s",
                    hook.name, event.transaction_id, result.get("reason"),
                )
                return FraudScoreResponse(
                    transaction_id=event.transaction_id,
                    score=1.0,
                    is_fraud=True,
                    model_version="hook-block",
                    explanations={
                        "hook_name":   hook.name,
                        "hook_action": "block",
                        "reason":      result.get("reason", ""),
                        "context":     context,
                    },
                )

    # ── 2. Scoring ML — exécuté dans un thread dédié pour ne pas bloquer l'event loop
    loop = asyncio.get_event_loop()
    ml_result = await loop.run_in_executor(
        _ML_EXECUTOR,
        partial(evaluate_risk, event, extra_context=context),
    )

    score        = ml_result["score"]
    is_fraud     = ml_result["is_fraud"]
    model_ver    = ml_result.get("model_version", "v1")
    explanations = ml_result.get("explanations") or {}
    if context:
        explanations["hook_context"] = context

    rule_triggered: Optional[str] = None
    rule_action:    Optional[str] = None

    # ── 2.5 Règles personnalisées du tenant ───────────────────────────────────
    if tenant_id and db:
        from app.models.tenant_custom_rule import TenantCustomRule

        rules = (
            db.query(TenantCustomRule)
            .filter(
                TenantCustomRule.tenant_id == tenant_id,
                TenantCustomRule.is_active.is_(True),
            )
            .order_by(TenantCustomRule.priority)
            .all()
        )

        for rule in rules:
            if not _rule_matches(rule, event, score):
                continue

            rule_triggered = rule.name
            rule_action    = rule.action
            explanations["custom_rule"] = {"name": rule.name, "action": rule.action}

            if rule.action == "block":
                score    = 1.0
                is_fraud = True
            break  # première règle correspondante — arrêt

    # ── 3. Post-score hooks ───────────────────────────────────────────────────
    if tenant_id and db:
        from app.models.tenant_scoring_hook import TenantScoringHook
        from app.services.hook_executor import call_post_score_hook

        post_hooks = (
            db.query(TenantScoringHook)
            .filter(
                TenantScoringHook.tenant_id == tenant_id,
                TenantScoringHook.hook_type == "post_score",
                TenantScoringHook.enabled.is_(True),
            )
            .all()
        )

        score_data = {
            "transaction_id": event.transaction_id,
            "tenant_id":      tenant_id,
            "score":          score,
            "is_fraud":       is_fraud,
            "model_version":  model_ver,
            "amount":         event.amount,
            "channel":        event.channel,
            "context":        context,
        }

        for hook in post_hooks:
            result = await call_post_score_hook(
                hook.url, score_data,
                secret=hook.secret,
                timeout_ms=hook.timeout_ms,
            )

            if result.get("action") == "override":
                override = result.get("override_score")
                if override is not None and 0.0 <= float(override) <= 1.0:
                    log.info(
                        "Post-score hook '%s' override %s → %s (raison: %s)",
                        hook.name, score, override, result.get("reason"),
                    )
                    score    = float(override)
                    is_fraud = score >= 0.70
                    explanations["hook_override"] = {
                        "hook_name":      hook.name,
                        "original_score": ml_result["score"],
                        "override_score": score,
                        "reason":         result.get("reason", ""),
                    }

    return FraudScoreResponse(
        transaction_id=event.transaction_id,
        score=score,
        is_fraud=is_fraud,
        model_version=model_ver,
        explanations=explanations,
        rule_triggered=rule_triggered,
        rule_action=rule_action,
    )


def _rule_matches(rule, event: FraudEvent, score: float) -> bool:
    """Vérifie si toutes les conditions d'une règle sont satisfaites (AND)."""
    if rule.min_amount is not None and event.amount < rule.min_amount:
        return False
    if rule.max_amount is not None and event.amount > rule.max_amount:
        return False
    if rule.channels and event.channel not in rule.channels:
        return False
    if rule.countries and event.country not in rule.countries:
        return False
    if rule.min_score is not None and score < rule.min_score:
        return False
    if rule.max_score is not None and score > rule.max_score:
        return False
    return True
