"""Redis pub/sub helpers pour les notifications temps réel (SSE)."""

import json
import logging

import redis.asyncio as aioredis

from app.core.config import settings

log = logging.getLogger(__name__)

_async_client: aioredis.Redis | None = None


def _get_async_redis() -> aioredis.Redis:
    global _async_client
    if _async_client is None:
        _async_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _async_client


def channel_for_tenant(tenant_id: int) -> str:
    return f"fraud:tenant:{tenant_id}"


async def publish_fraud_alert(tenant_id: int, payload: dict) -> None:
    """Publie une alerte fraude sur le canal Redis du tenant."""
    try:
        client = _get_async_redis()
        await client.publish(channel_for_tenant(tenant_id), json.dumps(payload))
    except Exception as exc:
        log.warning("Redis pub/sub unavailable — alert not streamed: %s", exc)


async def subscribe_tenant(tenant_id: int):
    """Générateur async : yield messages SSE pour le tenant donné."""
    client = _get_async_redis()
    pubsub = client.pubsub()
    channel = channel_for_tenant(tenant_id)
    await pubsub.subscribe(channel)
    log.debug("SSE: subscribed to %s", channel)
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield message["data"]
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        log.debug("SSE: unsubscribed from %s", channel)
