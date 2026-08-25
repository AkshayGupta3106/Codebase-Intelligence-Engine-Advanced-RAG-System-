"""
latency_middleware.py
=====================
FastAPI middleware that records per-request wall-clock latency in a
thread-safe rolling window and exposes a /api/metrics endpoint returning
p50, p95, and p99 percentiles.

Usage — mount in app/main.py:

    from eval.latency_middleware import LatencyMiddleware, metrics_router
    app.add_middleware(LatencyMiddleware, window_size=500)
    app.include_router(metrics_router)
"""

from __future__ import annotations

import threading
import time
from collections import deque
from statistics import mean
from typing import Deque

from fastapi import APIRouter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# ---------------------------------------------------------------------------
# Rolling window of latency samples (thread-safe)
# ---------------------------------------------------------------------------

class _LatencyStore:
    def __init__(self, window_size: int = 500) -> None:
        self._lock = threading.Lock()
        self._window: Deque[float] = deque(maxlen=window_size)

    def record(self, latency_ms: float) -> None:
        with self._lock:
            self._window.append(latency_ms)

    def snapshot(self) -> list[float]:
        with self._lock:
            return list(self._window)


_store = _LatencyStore()


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

class LatencyMiddleware(BaseHTTPMiddleware):
    """Records wall-clock latency for every HTTP request."""

    def __init__(self, app, window_size: int = 500) -> None:
        super().__init__(app)
        _store._window = deque(maxlen=window_size)

    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.perf_counter()
        response = await call_next(request)
        latency_ms = (time.perf_counter() - t0) * 1000
        _store.record(latency_ms)
        response.headers["X-Latency-Ms"] = f"{latency_ms:.1f}"
        return response


# ---------------------------------------------------------------------------
# Metrics endpoint
# ---------------------------------------------------------------------------

def _pct(values: list[float], p: int) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    idx = max(0, int(len(sorted_v) * p / 100) - 1)
    return round(sorted_v[idx], 2)


metrics_router = APIRouter(prefix="/api")


@metrics_router.get("/metrics")
def get_metrics() -> dict:
    """Return rolling-window latency percentiles for all recent requests."""
    samples = _store.snapshot()
    if not samples:
        return {"n": 0, "p50_ms": None, "p95_ms": None, "p99_ms": None, "mean_ms": None}

    return {
        "n": len(samples),
        "mean_ms": round(mean(samples), 2),
        "p50_ms": _pct(samples, 50),
        "p95_ms": _pct(samples, 95),
        "p99_ms": _pct(samples, 99),
        "min_ms": round(min(samples), 2),
        "max_ms": round(max(samples), 2),
    }
