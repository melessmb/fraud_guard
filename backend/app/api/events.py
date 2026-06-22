"""SSE — Server-Sent Events pour les notifications temps réel."""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from app.core.config import settings
from app.core.keycloak_auth import _get_jwks
from app.core.pubsub import subscribe_tenant

log = logging.getLogger(__name__)
router = APIRouter()

# Intervalle du heartbeat SSE (keepalive)
_HEARTBEAT_SECONDS = 25


def _decode_token_from_query(token: str) -> dict:
    """Valide le JWT passé en query param (EventSource ne supporte pas les headers)."""
    try:
        jwks = _get_jwks()
        decode_opts: dict = {}
        if not settings.keycloak_client_id:
            decode_opts["options"] = {"verify_aud": False}
        return jwt.decode(
            token, jwks, algorithms=["RS256"],
            audience=settings.keycloak_client_id or None,
            **decode_opts,
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")


async def _sse_generator(tenant_id: int):
    """Générateur d'événements SSE pour un tenant."""

    async def heartbeat():
        while True:
            await asyncio.sleep(_HEARTBEAT_SECONDS)
            yield ": heartbeat\n\n"

    # Démarre le heartbeat et la subscription en parallèle
    heartbeat_gen = heartbeat()
    subscriber = subscribe_tenant(tenant_id)

    try:
        # Événement de connexion
        yield "event: connected\ndata: {}\n\n"

        # Multiplex heartbeat + messages Redis
        heartbeat_task = asyncio.ensure_future(heartbeat_gen.__anext__())
        message_task   = asyncio.ensure_future(subscriber.__anext__())

        while True:
            done, _ = await asyncio.wait(
                {heartbeat_task, message_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in done:
                result = task.result()

                if task is heartbeat_task:
                    yield result
                    heartbeat_task = asyncio.ensure_future(heartbeat_gen.__anext__())

                elif task is message_task:
                    try:
                        payload = json.loads(result)
                        yield f"event: new_alert\ndata: {json.dumps(payload)}\n\n"
                    except (json.JSONDecodeError, TypeError):
                        pass
                    message_task = asyncio.ensure_future(subscriber.__anext__())

    except asyncio.CancelledError:
        pass
    except Exception as exc:
        log.error("SSE generator error for tenant %d: %s", tenant_id, exc)
        yield f"event: error\ndata: {json.dumps({'detail': 'stream error'})}\n\n"
    finally:
        heartbeat_task.cancel()
        message_task.cancel()


@router.get("/events/stream")
async def sse_stream(
    token: str = Query(..., description="Bearer JWT (EventSource ne supporte pas les headers)"),
    tenant_id: int = Query(..., description="ID du tenant à surveiller"),
) -> StreamingResponse:
    """
    Flux SSE d'alertes fraude temps réel.

    Connectez-vous avec :
    `new EventSource('/api/v1/events/stream?token=<jwt>&tenant_id=<id>')`

    Événements émis :
    - `connected`  — confirmation de connexion
    - `new_alert`  — nouvelle fraude détectée (payload = AlertResponse)
    - `: heartbeat` — keepalive toutes les 25s (commentaire SSE, ignoré par EventSource)
    """
    payload = _decode_token_from_query(token)

    # Vérification que le tenant demandé appartient à l'utilisateur
    # (admins peuvent surveiller n'importe quel tenant)
    roles: list[str] = payload.get("realm_access", {}).get("roles", [])
    user_tenant = payload.get("tenant_id")
    if "admin" not in roles and "compliance" not in roles:
        if user_tenant is None or int(user_tenant) != tenant_id:
            raise HTTPException(status_code=403, detail="Accès interdit à ce tenant")

    return StreamingResponse(
        _sse_generator(tenant_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control":  "no-cache",
            "X-Accel-Buffering": "no",   # désactive le buffering nginx
            "Connection":     "keep-alive",
        },
    )
