"""
src/api/inference.py
====================
Single source-of-truth for all ML inference calls.

Models are imported from model_registry (loaded once at startup).
Inputs are normalised through CrisisPayload; outputs use make_response().
"""

import os
import sys
import pandas as pd

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.api.schemas import CrisisPayload, make_response, ValidationError  # noqa: E402
from src.api import model_registry as _reg                                   # single load


# ── Internal helpers ───────────────────────────────────────────────────────────

def _risk_level(pred: float) -> str:
    if pred > 10_000:
        return "HIGH"
    elif pred > 5_000:
        return "MEDIUM"
    return "LOW"


def _xgb_predict(model_instance, features_dict: dict) -> float:
    """Run XGBRegressor.predict() safely via DataFrame to preserve feature names."""
    try:
        input_df = pd.DataFrame([features_dict])
        return float(model_instance.model.predict(input_df)[0])
    except Exception:
        # If model is untrained fallback instance, return 0
        return 0.0


# ── Public inference functions ─────────────────────────────────────────────────

def predict_displacement(data: dict) -> dict:
    """
    Displacement prediction.

    War path   (3 features): conflict_intensity, population, infra_score
    Classic path (4 features): severity_score, risk_index, population_density,
                               infrastructure_index

    Returns: { displacement, risk_level, ... }
    """
    payload = CrisisPayload.from_dict(data)

    if payload.has_war_features():
        pred = _reg.DISPLACEMENT_WAR.predict(payload.to_displacement_features_war())
    else:
        pred = _xgb_predict(_reg.DISPLACEMENT_XGB, payload.to_displacement_features_xgb())

    return make_response(displacement=pred, risk_level=_risk_level(pred))


def predict_drift(data: dict) -> dict:
    """
    Physics-based ocean drift.

    Required: lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours
    Returns: { drift: { predicted_lat, predicted_lon, search_radius_km,
                         survival_probability }, ... }
    """
    payload = CrisisPayload.from_dict(data)
    result = _reg.DRIFT.predict(payload.to_drift_features())
    return make_response(drift=result)


def predict_hotspots(data: dict) -> dict:
    """
    DBSCAN hotspot clustering.

    Required: coordinates [[lat,lon],...]
    Optional: displaced_people
    Returns: { hotspots: [...], ... }
    """
    payload = CrisisPayload.from_dict(data)
    clusters = _reg.HOTSPOT.predict(
        payload.coordinates or [],
        payload.displaced_people
    )
    return make_response(hotspots=clusters)


def predict_route(data: dict) -> dict:
    """
    Haversine nearest-neighbour routing.

    Required: coordinates [[lat,lon],...]
    Optional: source (int), target (int)
    Returns: { route: { path, distance_km, estimated_time_hours }, ... }
    """
    payload = CrisisPayload.from_dict(data)
    route = _reg.ROUTE.predict({
        "coordinates": payload.coordinates or [],
        "source": payload.source,
        "target": payload.target,
    })
    return make_response(route=route)


def predict_secondary_risk(data: dict) -> dict:
    """
    Secondary risk scoring.

    Optional: displaced_people, severity, disaster_type
    Returns: { risk_score, risk: { category, level, disease_risk, ... }, ... }
    """
    payload = CrisisPayload.from_dict(data)
    risk = _reg.SECONDARY_RISK.predict(payload.to_risk_features())
    return make_response(risk_score=float(risk.get("risk_score", 0)), risk=risk)


def predict_full(data: dict) -> dict:
    """
    Unified intelligence endpoint — runs ALL models sequentially.

    Designed for demo use: each model step is timed and its output is
    included verbatim in the response so every stage is visible.

    Input (all optional groups stack; missing groups are skipped):
    ─────────────────────────────────────────────────────────────
    Displacement : severity_score, risk_index, population_density, infrastructure_index
                   OR conflict_intensity, population, infra_score  (war module)
    Drift        : lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours
    Hotspot/Route: coordinates [[lat,lon],...], source, target, displaced_people
    Risk         : disaster_type, severity, displaced_people

    Output envelope
    ───────────────
    {
        "pipeline": "CrisisConnect Full Intelligence",
        "steps_run": int,
        "total_time_ms": float,
        "displacement": float,
        "risk_level": "LOW"|"MEDIUM"|"HIGH",
        "drift":     { predicted_lat, predicted_lon, search_radius_km, survival_probability },
        "hotspots":  [{ lat, lon, intensity, population_estimate }, ...],
        "route":     { path, distance_km, estimated_time_hours },
        "risk_score": float,
        "risk":      { risk_score, category, level, disease_risk, overcrowding, food_shortage },
        "steps":     { step_name: { result, time_ms }, ... }
    }
    """
    import time

    payload = CrisisPayload.from_dict(data)
    steps = {}
    steps_run = 0
    pipeline_start = time.perf_counter()

    # ── Step 1: Displacement ──────────────────────────────────────────────────
    t0 = time.perf_counter()
    if payload.has_war_features():
        disp_pred = _reg.DISPLACEMENT_WAR.predict(payload.to_displacement_features_war())
        model_used = "displacement_war (XGBoost, GED-trained)"
    else:
        disp_pred = _xgb_predict(_reg.DISPLACEMENT_XGB, payload.to_displacement_features_xgb())
        model_used = "displacement_xgb (XGBoost, disaster-trained)"

    level = _risk_level(disp_pred)
    steps["1_displacement"] = {
        "model": model_used,
        "result": {"predicted_displacement": round(disp_pred, 2), "risk_level": level},
        "time_ms": round((time.perf_counter() - t0) * 1000, 2)
    }
    steps_run += 1

    # ── Step 2: Drift ─────────────────────────────────────────────────────────
    drift = {}
    if payload.has_drift_features():
        t0 = time.perf_counter()
        drift = _reg.DRIFT.predict(payload.to_drift_features())
        steps["2_drift"] = {
            "model": "DriftModel (physics-based)",
            "result": drift,
            "time_ms": round((time.perf_counter() - t0) * 1000, 2)
        }
        steps_run += 1
    else:
        steps["2_drift"] = {"skipped": True, "reason": "lat/lon/time_hours not provided"}

    # ── Step 3: Hotspot clustering ────────────────────────────────────────────
    hotspots = []
    if payload.has_route_features():
        t0 = time.perf_counter()
        displaced = payload.displaced_people or int(disp_pred)
        hotspots = _reg.HOTSPOT.predict(payload.coordinates, displaced)
        steps["3_hotspots"] = {
            "model": "HotspotModel (DBSCAN)",
            "result": {"count": len(hotspots), "clusters": hotspots},
            "time_ms": round((time.perf_counter() - t0) * 1000, 2)
        }
        steps_run += 1
    else:
        steps["3_hotspots"] = {"skipped": True, "reason": "coordinates not provided"}

    # ── Step 4: Route prediction ──────────────────────────────────────────────
    route = {}
    if payload.has_route_features():
        t0 = time.perf_counter()
        route = _reg.ROUTE.predict({
            "coordinates": payload.coordinates,
            "source": payload.source,
            "target": payload.target,
        })
        steps["4_route"] = {
            "model": "RouteModel (Haversine nearest-neighbour)",
            "result": route,
            "time_ms": round((time.perf_counter() - t0) * 1000, 2)
        }
        steps_run += 1
    else:
        steps["4_route"] = {"skipped": True, "reason": "coordinates not provided"}

    # ── Step 5: Secondary risk ────────────────────────────────────────────────
    t0 = time.perf_counter()
    risk_input = payload.to_risk_features()
    risk_input["displaced_people"] = risk_input.get("displaced_people") or int(disp_pred)
    risk = _reg.SECONDARY_RISK.predict(risk_input)
    steps["5_secondary_risk"] = {
        "model": "SecondaryRiskModel (rule-based)",
        "result": risk,
        "time_ms": round((time.perf_counter() - t0) * 1000, 2)
    }
    steps_run += 1

    total_ms = round((time.perf_counter() - pipeline_start) * 1000, 2)

    # ── Build combined response ───────────────────────────────────────────────
    response = make_response(
        displacement=disp_pred,
        risk_level=level,
        drift=drift,
        hotspots=hotspots,
        route=route,
        risk_score=float(risk.get("risk_score", 0)),
        risk=risk,
    )

    # Attach pipeline metadata for demo visibility
    response["pipeline"] = "CrisisConnect Full Intelligence"
    response["steps_run"] = steps_run
    response["total_time_ms"] = total_ms
    response["steps"] = steps

    return response


# ── Registry health pass-through ──────────────────────────────────────────────

def model_health() -> dict:
    """Expose model_registry.health() for the /health/models backend endpoint."""
    return _reg.health()
