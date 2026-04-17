"""
backend/app/cache.py
====================
Thread-safe in-memory cache for the real-time simulation pipeline.

All scheduler jobs write here; API endpoints read from here.
No external dependencies (Redis not required for demo).
"""

import threading
import time
from typing import Any, Dict, Optional

_lock = threading.RLock()

_store: Dict[str, Any] = {}
_timestamps: Dict[str, float] = {}


def set(key: str, value: Any) -> None:
    """Store a value with the current epoch timestamp."""
    with _lock:
        _store[key] = value
        _timestamps[key] = time.time()


def get(key: str, default: Any = None) -> Any:
    """Retrieve a stored value, or default if key not found."""
    with _lock:
        return _store.get(key, default)


def get_with_meta(key: str) -> dict:
    """Return value + age metadata dict for API responses."""
    with _lock:
        value = _store.get(key)
        ts = _timestamps.get(key)
        age_s = round(time.time() - ts, 1) if ts else None
        return {
            "data": value,
            "cached_at": ts,
            "age_seconds": age_s,
            "stale": age_s is not None and age_s > 120,  # stale if > 2 min
        }


def all_keys() -> dict:
    """Return a summary of all cached keys and their ages."""
    with _lock:
        now = time.time()
        return {
            k: {
                "age_seconds": round(now - _timestamps[k], 1),
                "stale": (now - _timestamps[k]) > 120,
            }
            for k in _store
        }


def clear(key: str = None) -> None:
    """Clear one key or the entire cache."""
    with _lock:
        if key:
            _store.pop(key, None)
            _timestamps.pop(key, None)
        else:
            _store.clear()
            _timestamps.clear()
