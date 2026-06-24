"""Middleware transversaux : Request-ID et logging structuré par requête."""
from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = structlog.get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Injecte un X-Request-ID dans chaque requête et le propage aux logs."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Lie le request_id au contexte structlog pour toute la durée de la requête
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            raise
        finally:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
            log.info(
                "http_request",
                method=request.method,
                path=request.url.path,
                status=getattr(response, "status_code", 500),
                duration_ms=elapsed_ms,
            )
            structlog.contextvars.clear_contextvars()

        response.headers["X-Request-ID"] = request_id
        return response
