"""
backend/app/routes/ml.py
========================
ML-powered prediction endpoints.

All prediction logic lives in src/api/inference.py.
All schema validation (type coercion, alias resolution, bounds) lives in src/api/schemas.py.
This blueprint only handles HTTP mechanics: parse body → call inference → return JSON.
"""

import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from flask import Blueprint, request, jsonify

from src.api.schemas import (
    ValidationError,
    validate_required,
    DRIFT_REQUIRED,
    HOTSPOT_REQUIRED,
    ROUTE_REQUIRED,
)
from src.api.inference import (
    predict_displacement,
    predict_drift,
    predict_hotspots,
    predict_route,
    predict_secondary_risk,
    predict_full,
    model_health,
)

ml_bp = Blueprint("ml", __name__)


# ── GET /health/models ─────────────────────────────────────────────────────────
@ml_bp.route("/health/models", methods=["GET"])
def models_health_endpoint():
    """
    Returns load status for every ML model.
    Use this to verify all models loaded correctly at startup.
    """
    return jsonify({"status": "ok", "models": model_health()}), 200


# ── Helpers ────────────────────────────────────────────────────────────────────

def _body() -> dict:
    return request.get_json(silent=True) or {}


def _missing_error(missing: list):
    return jsonify({
        "status": "error",
        "message": f"Missing required fields: {missing}"
    }), 422


def _validation_error(exc: ValidationError):
    return jsonify({
        "status": "error",
        "message": str(exc)
    }), 422


def _server_error(exc: Exception):
    return jsonify({
        "status": "error",
        "message": "Internal inference error.",
        "detail": str(exc)
    }), 500


# ── POST /predict ──────────────────────────────────────────────────────────────
@ml_bp.route("/predict", methods=["POST"])
def displacement_endpoint():
    """
    Displacement prediction.

    Classic: { severity_score, risk_index, population_density, infrastructure_index }
    War:     { conflict_intensity, population, infra_score }
    All fields have safe defaults — an empty body returns a baseline prediction.
    """
    data = _body()
    try:
        return jsonify(predict_displacement(data)), 200
    except ValidationError as e:
        return _validation_error(e)
    except Exception as e:
        return _server_error(e)


# ── POST /predict-drift ────────────────────────────────────────────────────────
@ml_bp.route("/predict-drift", methods=["POST"])
def drift_endpoint():
    """
    Ocean drift prediction.

    Required: { lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours }
    """
    data = _body()
    missing = validate_required(data, DRIFT_REQUIRED)
    if missing:
        return _missing_error(missing)
    try:
        return jsonify(predict_drift(data)), 200
    except ValidationError as e:
        return _validation_error(e)
    except Exception as e:
        return _server_error(e)


# ── POST /predict-hotspots ─────────────────────────────────────────────────────
@ml_bp.route("/predict-hotspots", methods=["POST"])
def hotspots_endpoint():
    """
    DBSCAN hotspot detection.

    Required: { coordinates: [[lat,lon],...] }
    Optional: { displaced_people: int }
    """
    data = _body()
    missing = validate_required(data, HOTSPOT_REQUIRED)
    if missing:
        return _missing_error(missing)
    try:
        return jsonify(predict_hotspots(data)), 200
    except ValidationError as e:
        return _validation_error(e)
    except Exception as e:
        return _server_error(e)


# ── POST /predict-route ────────────────────────────────────────────────────────
@ml_bp.route("/predict-route", methods=["POST"])
def route_endpoint():
    """
    Evacuation / supply route optimisation.

    Required: { coordinates: [[lat,lon],...] }
    Optional: { source: int, target: int }
    """
    data = _body()
    missing = validate_required(data, ROUTE_REQUIRED)
    if missing:
        return _missing_error(missing)
    try:
        return jsonify(predict_route(data)), 200
    except ValidationError as e:
        return _validation_error(e)
    except Exception as e:
        return _server_error(e)


# ── POST /predict-risk ─────────────────────────────────────────────────────────
@ml_bp.route("/predict-risk", methods=["POST"])
def risk_endpoint():
    """
    Secondary risk scoring.

    Optional: { displaced_people, severity, disaster_type }
    All fields have safe defaults.
    """
    data = _body()
    try:
        return jsonify(predict_secondary_risk(data)), 200
    except ValidationError as e:
        return _validation_error(e)
    except Exception as e:
        return _server_error(e)


# ── POST /predict-full ─────────────────────────────────────────────────────────
@ml_bp.route("/predict-full", methods=["POST"])
def full_endpoint():
    """
    Combined inference — all models in one call.

    Body: union of all fields above.
    Missing optional groups (drift, route, hotspots) are skipped gracefully.

    Response shape:
    {
        "displacement": float,
        "risk_level": "LOW"|"MEDIUM"|"HIGH",
        "drift": { predicted_lat, predicted_lon, search_radius_km, survival_probability },
        "hotspots": [{ lat, lon, intensity, population_estimate },...],
        "route": { path, distance_km, estimated_time_hours },
        "risk_score": float,
        "risk": { risk_score, category, level, disease_risk, overcrowding, food_shortage }
    }
    """
    data = _body()
    try:
        return jsonify(predict_full(data)), 200
    except ValidationError as e:
        return _validation_error(e)
    except Exception as e:
        return _server_error(e)
