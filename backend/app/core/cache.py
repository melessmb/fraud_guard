import json
from typing import Optional

import redis as redis_lib

from app.core.config import settings

_client: Optional[redis_lib.Redis] = None


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


def check_rate_limit(tenant_id: int, window_seconds: int = 60, max_requests: int = 200) -> bool:
    try:
        key = f"rate:{tenant_id}"
        pipe = get_redis().pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = pipe.execute()
        return int(count) <= max_requests
    except Exception:
        return True  # En cas d'erreur Redis, on laisse passer


def add_to_blacklist(jti: str, expires_seconds: int) -> None:
    """Révoque un JWT en plaçant son JTI dans la liste noire Redis jusqu'à son expiration naturelle."""
    try:
        get_redis().setex(f"blacklist:{jti}", max(1, expires_seconds), "1")
    except Exception:
        pass  # fail open : une panne Redis ne bloque pas la révocation en cours


def is_blacklisted(jti: str) -> bool:
    """Renvoie True si le JWT associé à ce JTI a été révoqué."""
    try:
        return get_redis().exists(f"blacklist:{jti}") > 0
    except Exception:
        return False  # fail open : si Redis est indisponible on laisse passer
