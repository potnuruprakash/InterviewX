"""Serialize expensive media inference and keep it off FastAPI's event loop."""
import os
import asyncio
import logging
import time
from typing import Any, Callable

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

# Limit simultaneous inference jobs per service instance to avoid exhausting RAM/CPU
MAX_CONCURRENT_INFERENCES = max(1, int(os.getenv("MAX_CONCURRENT_INFERENCES", "1")))
_inference_semaphore = asyncio.Semaphore(MAX_CONCURRENT_INFERENCES)


async def run_media_inference(operation: str, function: Callable[..., Any], *args: Any) -> Any:
    """Run bounded CPU-heavy audio/video inference off the async event loop in the thread pool."""
    queued_at = time.monotonic()
    async with _inference_semaphore:
        wait_seconds = time.monotonic() - queued_at
        started_at = time.monotonic()
        logger.info(
            "[MediaInference] START operation=%s queue_wait_seconds=%.2f concurrency_limit=%d",
            operation,
            wait_seconds,
            MAX_CONCURRENT_INFERENCES,
        )
        try:
            return await run_in_threadpool(function, *args)
        finally:
            logger.info(
                "[MediaInference] END operation=%s duration_seconds=%.2f",
                operation,
                time.monotonic() - started_at,
            )

