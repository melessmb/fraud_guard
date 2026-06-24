"""Exécuteur de hooks — POST signé avec retry exponentiel.

Contrat de sécurité :
  - Chaque requête est signée : X-FraudGuard-Signature: sha256=<hmac>
  - Timeout configurable (défaut 2s, max 5s)
  - trust_env=False : évite tout proxy Docker parasite

Contrat de fiabilité :
  - Retry automatique jusqu'à max_retries tentatives
  - Backoff exponentiel : 1s, 2s, 4s entre les tentatives
  - 4xx client-error : pas de retry (le hook est mal configuré)
  - 5xx / timeout / réseau : retry avec backoff
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from typing import Any, Optional

import httpx

log = logging.getLogger(__name__)

_MAX_TIMEOUT_MS = 5_000
_DEFAULT_MAX_RETRIES = 3


def _sign(body: str, secret: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


async def call_hook(
    url: str,
    payload: dict[str, Any],
    *,
    secret: Optional[str] = None,
    timeout_ms: int = 2_000,
    max_retries: int = _DEFAULT_MAX_RETRIES,
) -> Optional[dict[str, Any]]:
    """Envoie un POST au hook avec retry exponentiel. Retourne la réponse JSON ou None."""
    timeout_s = min(timeout_ms, _MAX_TIMEOUT_MS) / 1_000
    body = json.dumps(payload, default=str)
    headers: dict[str, str] = {"Content-Type": "application/json"}

    if secret:
        headers["X-FraudGuard-Signature"] = f"sha256={_sign(body, secret)}"

    last_exc: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(trust_env=False, timeout=timeout_s) as client:
                resp = await client.post(url, content=body, headers=headers)

            # 4xx → erreur client (mauvaise URL, auth, …) — pas la peine de réessayer
            if 400 <= resp.status_code < 500:
                log.warning(
                    "hook_client_error url=%s status=%d attempt=%d — pas de retry",
                    url, resp.status_code, attempt + 1,
                )
                return None

            resp.raise_for_status()
            if attempt > 0:
                log.info("hook_recovered url=%s after %d attempt(s)", url, attempt + 1)
            return resp.json()

        except httpx.TimeoutException as exc:
            last_exc = exc
            log.warning("hook_timeout url=%s timeout=%dms attempt=%d/%d",
                        url, timeout_ms, attempt + 1, max_retries)
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            log.warning("hook_http_error url=%s status=%d attempt=%d/%d",
                        url, exc.response.status_code, attempt + 1, max_retries)
        except Exception as exc:
            last_exc = exc
            log.warning("hook_error url=%s type=%s attempt=%d/%d",
                        url, type(exc).__name__, attempt + 1, max_retries)

        # Backoff exponentiel : 1s, 2s, 4s, …
        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)

    log.error("hook_exhausted url=%s after %d attempts last_exc=%s", url, max_retries, last_exc)
    return None


async def call_pre_score_hook(
    url: str,
    event_data: dict[str, Any],
    *,
    secret: Optional[str] = None,
    timeout_ms: int = 2_000,
) -> dict[str, Any]:
    payload = {"hook_type": "pre_score", **event_data}
    resp = await call_hook(url, payload, secret=secret, timeout_ms=timeout_ms, max_retries=1)
    if resp is None:
        return {"action": "continue", "context": {}}
    return {
        "action":  resp.get("action", "continue"),
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
    payload = {"hook_type": "post_score", **score_data}
    resp = await call_hook(url, payload, secret=secret, timeout_ms=timeout_ms, max_retries=1)
    if resp is None:
        return {"action": "accept"}
    return {
        "action":         resp.get("action", "accept"),
        "override_score": resp.get("override_score"),
        "reason":         resp.get("reason", ""),
    }
