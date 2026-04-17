"""
backend/app/routes/realtime.py
===============================
REST endpoints for polling cached real-time simulation results.

GET  /realtime/snapshot         — latest environmental sensor data
GET  /realtime/displacement     — latest cached displacement prediction
GET  /realtime/drift            — latest cached drift prediction
GET  /realtime/hotspots         — latest cached hotspot clusters
GET  /realtime/full             — latest cached full pipeline result
GET  /realtime/status           — scheduler job schedule + cache key ages
"""

import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from flask import Blueprint, jsonify
from app import cache
from app import scheduler as sched

realtime_bp = Blueprint("realtime", __name__, url_prefix="/realtime")


def _cached_response(key: str):
    """Fetch a cache entry and return it as a JSON response with metadata."""
    entry = cache.get_with_meta(key)
    if entry["data"] is None:
        return jsonify({
            "status": "pending",
            "message": f"No data yet for '{key}'. Scheduler runs on startup — retry in a few seconds.",
            "cache_key": key,
        }), 202
    status_code = 200
    if entry.get("stale"):
        entry["warning"] = "Data may be stale (>2 minutes old)"
        status_code = 206       # Partial Content — still usable but old
    return jsonify({"status": "ok", "cache_key": key, **entry}), status_code


# ── GET /realtime/snapshot ────────────────────────────────────────────────────
@realtime_bp.route("/snapshot", methods=["GET"])
def snapshot():
    """Latest synthetic environmental sensor reading (updates every 30 s)."""
    return _cached_response("env_snapshot")


# ── GET /realtime/displacement ────────────────────────────────────────────────
@realtime_bp.route("/displacement", methods=["GET"])
def displacement():
    """Latest cached displacement prediction (updates every 60 s)."""
    return _cached_response("prediction_displacement")


# ── GET /realtime/drift ───────────────────────────────────────────────────────
@realtime_bp.route("/drift", methods=["GET"])
def drift():
    """Latest cached drift prediction (updates every 45 s)."""
    return _cached_response("prediction_drift")


# ── GET /realtime/hotspots ────────────────────────────────────────────────────
@realtime_bp.route("/hotspots", methods=["GET"])
def hotspots():
    """Latest cached hotspot clusters (updates every 90 s)."""
    return _cached_response("prediction_hotspots")


# ── GET /realtime/full ────────────────────────────────────────────────────────
@realtime_bp.route("/full", methods=["GET"])
def full():
    """Latest cached full pipeline result (updates every 120 s)."""
    return _cached_response("prediction_full")


# ── GET /realtime/status ──────────────────────────────────────────────────────
@realtime_bp.route("/status", methods=["GET"])
def status():
    """
    Overall scheduler and cache status.
    Shows next scheduled run times for all jobs + ages of cached keys.
    """
    return jsonify({
        "status": "ok",
        "scheduler_jobs": sched.status(),
        "cache_keys": cache.all_keys(),
    }), 200
