"""Exécuteur de scoring hooks — appelle les URLs enregistrées par les tenants.

Contrat de sécurité :
  - Chaque requête est signée : X-FraudGuard-Signature: sha256=<hmac>
  - Timeout configurable (défaut 2s, max 5s)
  - Échec silencieux : si le hook ne répond pas, le scoring continue normalement
  - trust_env=False : évite tout proxy Docker parasite
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Optional

import httpx

log = logging.getLogger(__name__)

_MAX_TIMEOUT_MS = 5_000


def _sign(body: str, secret: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


async def call_hook(
    url: str,
    payload: dict[str, Any],
    *,
    secret: Optional[str] = None,
    timeout_ms: int = 2_000,
) -> Optional[dict[str, Any]]:
    """Envoie un POST au hook et retourne la réponse JSON, ou None en cas d'échec."""
    timeout_s = min(timeout_ms, _MAX_TIMEOUT_MS) / 1_000
    body = json.dumps(payload, default=str)
    headers: dict[str, str] = {"Content-Type": "application/json"}

    if secret:
        headers["X-FraudGuard-Signature"] = f"sha256={_sign(body, secret)}"

    try:
        async with httpx.AsyncClient(trust_env=False, timeout=timeout_s) as client:
            resp = await client.post(url, content=body, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.TimeoutException:
        log.warning("Hook timeout (%dms) : %s", timeout_ms, url)
    except httpx.HTTPStatusError as exc:
        log.warning("Hook HTTP %d : %s", exc.response.status_code, url)
    except Exception as exc:
        log.warning("Hook error (%s) : %s", type(exc).__name__, url)

    return None  # échec silencieux — le scoring continue sans ce hook


async def call_pre_score_hook(
    url: str,
    event_data: dict[str, Any],
    *,
    secret: Optional[str] = None,
    timeout_ms: int = 2_000,
) -> dict[str, Any]:
    """Appelle un pre-score hook et retourne le contexte enrichi.

    Réponse attendue du tenant :
    {
      "action": "continue" | "block",
      "context": { ... }   // données supplémentaires injectées dans le scoring
    }
    """
    payload = {"hook_type": "pre_score", **event_data}
    resp = await call_hook(url, payload, secret=secret, timeout_ms=timeout_ms)

    if resp is None:
        return {"action": "continue", "context": {}}

    return {
        "action": resp.get("action", "continue"),
        "context": resp.get("context", {}),
        "reason":  resp.get("reason", ""),
    }


async def call_post_score_hook(
    url: str,
    score_data: dict[str, Any],
    *,
    secret: Optional[str] = None,
    timeout_ms: int = 2_000,
) -> dict[str, Any]:
    """Appelle un post-score hook et retourne l'action à appliquer.

    Réponse attendue du tenant :
    {
      "action": "accept" | "override",
      "override_score": 0.25,   // seulement si action == "override"
      "reason": "..."
    }
    """
    payload = {"hook_type": "post_score", **score_data}
    resp = await call_hook(url, payload, secret=secret, timeout_ms=timeout_ms)

    if resp is None:
        return {"action": "accept"}

    return {
        "action":         resp.get("action", "accept"),
        "override_score": resp.get("override_score"),
        "reason":         resp.get("reason", ""),
    }
