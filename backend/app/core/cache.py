import json
import logging
import time
from collections import defaultdict
from typing import Optional

import redis as redis_lib

from app.core.config import settings

log = logging.getLogger(__name__)

_client: Optional[redis_lib.Redis] = None

# Fallback in-memory rate limiter quand Redis est indisponible
_fallback_counters: dict[str, list[float]] = defaultdict(list)


def get_redis() -> redis_lib.Redis:
    global _client
    if _client is None:
        _client = redis_lib.from_url(settings.redis_url, decode_responses=True)
    return _client


def cache_score(transaction_id: str, score: dict, ttl: int = 3600) -> None:
    try:
        get_redis().setex(f"score:{transaction_id}", ttl, json.dumps(score))
    except Exception:
        pass


def get_cached_score(transaction_id: str) -> Optional[dict]:
    try:
        raw = get_redis().get(f"score:{transaction_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def _fallback_rate_limit(key: str, window_seconds: int, max_requests: int) -> tuple[bool, int]:
    """Rate limiting in-memory utilisé quand Redis est indisponible."""
    now = time.monotonic()
    window_start = now - window_seconds
    _fallback_counters[key] = [t for t in _fallback_counters[key] if t > window_start]
    remaining = max(0, max_requests - len(_fallback_counters[key]))
    if len(_fallback_counters[key]) >= max_requests:
        return False, 0
    _fallback_counters[key].append(now)
    return True, remaining - 1


def check_rate_limit(
    key: str,
    window_seconds: int = 60,
    max_requests: int = 200,
) -> tuple[bool, int]:
    """Rate limiting générique par clé arbitraire (IP, tenant_id, etc.).

    Retourne (allowed, remaining) — le header X-RateLimit-Remaining peut être
    renseigné directement par l'appelant à partir de `remaining`.
    """
    try:
        redis_key = f"rl:{key}"
        pipe = get_redis().pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, window_seconds)
        count, _ = pipe.execute()
        count = int(count)
        remaining = max(0, max_requests - count)
        return count <= max_requests, remaining
    except Exception:
        log.warning("Redis indisponible — rate limiting in-memory activé pour clé %s", key)
        return _fallback_rate_limit(key, window_seconds, max_requests)


def add_to_blacklist(jti: str, expires_seconds: int) -> None:
    """Révoque un JWT en plaçant son JTI dans la liste noire Redis jusqu'à son expiration naturelle."""
    try:
        get_redis().setex(f"blacklist:{jti}", max(1, expires_seconds), "1")
    except Exception:
        log.error("Impossible d'ajouter le JTI %s à la blacklist Redis — token non révoqué", jti)


def is_blacklisted(jti: str) -> bool:
    """Renvoie True si le JWT associé à ce JTI a été révoqué."""
    try:
        return get_redis().exists(f"blacklist:{jti}") > 0
    except Exception:
        # Fail-secure : si Redis est indisponible, on rejette le token par précaution.
        # Un token révoqué vaut mieux qu'une session compromise.
        log.error("Redis indisponible — REJET du token par précaution (fail-secure) JTI=%s", jti)
        return True
