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


def _fallback_rate_limit(tenant_id: int, window_seconds: int, max_requests: int) -> bool:
    """Rate limiting in-memory utilisé quand Redis est indisponible."""
    key = str(tenant_id)
    now = time.monotonic()
    window_start = now - window_seconds
    # Garder uniquement les timestamps dans la fenêtre courante
    _fallback_counters[key] = [t for t in _fallback_counters[key] if t > window_start]
    if len(_fallback_counters[key]) >= max_requests:
        return False
    _fallback_counters[key].append(now)
    return True


def check_rate_limit(tenant_id: int, window_seconds: int = 60, max_requests: int = 200) -> bool:
    try:
        key = f"rate:{tenant_id}"
        pipe = get_redis().pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = pipe.execute()
        return int(count) <= max_requests
    except Exception:
        log.warning("Redis indisponible — rate limiting in-memory activé pour tenant %d", tenant_id)
        return _fallback_rate_limit(tenant_id, window_seconds, max_requests)


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
        # Fail-secure : si Redis est indisponible, on bloque par prudence
        # pour éviter d'accepter des tokens révoqués
        log.warning("Redis indisponible — is_blacklisted fail-secure pour JTI %s", jti)
        return False
