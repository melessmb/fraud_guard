"""Registre de tâches asyncio — permet le shutdown gracieux."""
from __future__ import annotations

import asyncio
import logging
from typing import Coroutine, Any

log = logging.getLogger(__name__)

_pending: set[asyncio.Task] = set()


def track(coro: Coroutine[Any, Any, Any]) -> asyncio.Task:
    """Crée et enregistre une tâche asyncio. La tâche se retire seule à la fin."""
    task = asyncio.create_task(coro)
    _pending.add(task)
    task.add_done_callback(_pending.discard)
    return task


async def drain(timeout: float = 10.0) -> None:
    """Attend la fin de toutes les tâches en cours, puis annule les restantes."""
    if not _pending:
        return
    tasks = list(_pending)
    log.info("Shutdown : attente de %d tâche(s) en cours (timeout=%ss)…", len(tasks), timeout)
    try:
        async with asyncio.timeout(timeout):
            await asyncio.gather(*tasks, return_exceptions=True)
        log.info("Shutdown : drain terminé (%d complétées)", len(tasks))
    except TimeoutError:
        still_pending = [t for t in tasks if not t.done()]
        log.warning("Shutdown : %d tâche(s) non terminées — annulation forcée", len(still_pending))
        for t in still_pending:
            t.cancel()
