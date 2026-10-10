"""
Serialize expensive media inference and keep it off FastAPI's event loop.

Changes from previous version:
  - Added per-operation wall-clock timeout (VIDEO_INFERENCE_TIMEOUT_S / AUDIO_INFERENCE_TIMEOUT_S).
  - Raises InferenceTimeoutError so callers can return a structured 'timed_out' failure
    instead of hanging indefinitely and exhausting the semaphore.
  - Stage-level timing logged as structured JSON so Render logs are grep-able.
  - Queue wait time logged separately from inference time.
"""

import os
import asyncio
import logging
import time
import json
from typing import Any, Callable

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

# Limit simultaneous inference jobs per service instance to avoid exhausting RAM/CPU
MAX_CONCURRENT_INFERENCES = max(1, int(os.getenv("MAX_CONCURRENT_INFERENCES", "1")))
_inference_semaphore = asyncio.Semaphore(MAX_CONCURRENT_INFERENCES)

# Per-operation hard timeouts (seconds).  Set conservatively for Render free tier.
# Video: 8 frames * ~25s/frame worst-case = 200s, with buffer for model init → 240s
# Audio: librosa on 30s clip with ffmpeg conversion ≈ 30-60s → 90s
VIDEO_INFERENCE_TIMEOUT_S = int(os.getenv("VIDEO_INFERENCE_TIMEOUT_S", "240"))
AUDIO_INFERENCE_TIMEOUT_S = int(os.getenv("AUDIO_INFERENCE_TIMEOUT_S", "90"))


class InferenceTimeoutError(Exception):
    """Raised when inference exceeds the configured wall-clock timeout."""


def _get_timeout_for_operation(operation: str) -> float:
    if operation == "video":
        return float(VIDEO_INFERENCE_TIMEOUT_S)
    if operation == "audio":
        return float(AUDIO_INFERENCE_TIMEOUT_S)
    return 120.0  # generic fallback


def _log_structured(level: str, event: str, **kwargs):
    """Emit a single-line JSON log entry compatible with Render log drain."""
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **kwargs}
    msg = json.dumps(entry, default=str)
    if level == "error":
        logger.error(msg)
    elif level == "warning":
        logger.warning(msg)
    else:
        logger.info(msg)


async def run_media_inference(operation: str, function: Callable[..., Any], *args: Any) -> Any:
    """
    Run bounded CPU-heavy audio/video inference off the async event loop in the thread pool.

    Raises:
        InferenceTimeoutError — if inference exceeds the configured timeout.
        Any exception raised by `function` is re-raised as-is.
    """
    queued_at = time.monotonic()
    timeout_s = _get_timeout_for_operation(operation)

    async with _inference_semaphore:
        queue_wait_s = time.monotonic() - queued_at
        started_at = time.monotonic()
        _log_structured(
            "info",
            "media_inference_start",
            operation=operation,
            queue_wait_seconds=round(queue_wait_s, 2),
            timeout_seconds=timeout_s,
            concurrency_limit=MAX_CONCURRENT_INFERENCES,
        )

        try:
            result = await asyncio.wait_for(
                run_in_threadpool(function, *args),
                timeout=timeout_s,
            )
            duration_s = time.monotonic() - started_at
            _log_structured(
                "info",
                "media_inference_done",
                operation=operation,
                duration_seconds=round(duration_s, 2),
                queue_wait_seconds=round(queue_wait_s, 2),
            )
            return result

        except asyncio.TimeoutError:
            duration_s = time.monotonic() - started_at
            _log_structured(
                "error",
                "media_inference_timeout",
                operation=operation,
                duration_seconds=round(duration_s, 2),
                timeout_seconds=timeout_s,
            )
            raise InferenceTimeoutError(
                f"{operation} inference exceeded {timeout_s}s timeout after {duration_s:.1f}s"
            )

        except Exception as exc:
            duration_s = time.monotonic() - started_at
            _log_structured(
                "error",
                "media_inference_error",
                operation=operation,
                duration_seconds=round(duration_s, 2),
                error=str(exc),
            )
            raise
