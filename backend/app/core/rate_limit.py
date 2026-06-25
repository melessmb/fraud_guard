"""Helpers de rate limiting — lève HTTP 429 avec les headers RFC 6585."""
from __future__ import annotations

from fastapi import HTTPException, Request

from app.core.cache import check_rate_limit
from app.core.config import settings


def _parse_limit(limit_str: str) -> tuple[int, int]:
    """Parse '100/minute' → (100, 60)."""
    count, unit = limit_str.split("/")
    seconds = {"second": 1, "minute": 60, "hour": 3600}.get(unit.lower().rstrip("s"), 60)
    return int(count), seconds


def enforce(key: str, limit_str: str) -> None:
    """Applique la limite et lève HTTP 429 si dépassée."""
    max_req, window = _parse_limit(limit_str)
    allowed, _ = check_rate_limit(key, window_seconds=window, max_requests=max_req)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Limite de requêtes dépassée — réessayez dans 60s",
            headers={
                "X-RateLimit-Limit": str(max_req),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Window": str(window),
                "Retry-After": str(window),
            },
        )


def client_ip(request: Request) -> str:
    """Extrait l'IP réelle derrière un éventuel proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_score(tenant_id: int) -> None:
    """100 req/min par tenant pour le scoring."""
    enforce(f"score:tenant:{tenant_id}", settings.rate_limit_score)


def enforce_login(request: Request) -> None:
    """10 req/min par IP pour le login (anti brute-force)."""
    enforce(f"login:{client_ip(request)}", settings.rate_limit_login)


def enforce_batch(tenant_id: int) -> None:
    """20 req/min par tenant pour le batch scoring."""
    enforce(f"batch:tenant:{tenant_id}", settings.rate_limit_batch)
