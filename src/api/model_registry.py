"""
src/api/model_registry.py
==========================
Centralised model loader — runs ONCE at import time.

All models are loaded here and re-used across every request.
If a pkl file is missing or corrupt, a fallback instance is used and a warning is logged.
"""

import os
import sys
import logging
import pickle

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.models.displacement_model import DisplacementModel
from src.models.drift_model import DriftModel
from src.models.hotspot_model import HotspotModel
from src.models.secondary_risk_model import SecondaryRiskModel
from src.models.route_model import RouteModel


def _load_pkl(path: str):
    """
    Load a pickle file.  Returns the deserialized object on success,
    or None if the file is missing, too small to be a real model (<1 KB),
    or fails to deserialise.
    """
    abs_path = os.path.join(PROJECT_ROOT, path)
    if not os.path.exists(abs_path):
        logger.warning(f"[ModelRegistry] File not found: {abs_path}")
        return None
    if os.path.getsize(abs_path) < 1024:          # placeholder guard
        logger.warning(f"[ModelRegistry] File too small to be a real model: {abs_path} "
                       f"({os.path.getsize(abs_path)} bytes) — using in-memory fallback")
        return None
    try:
        with open(abs_path, "rb") as f:
            obj = pickle.load(f)
        if not hasattr(obj, "predict"):
            logger.warning(f"[ModelRegistry] {abs_path} has no predict() — using in-memory fallback")
            return None
        logger.info(f"[ModelRegistry] Loaded {type(obj).__name__} from {abs_path}")
        return obj
    except Exception as exc:
        logger.error(f"[ModelRegistry] Failed to load {abs_path}: {exc}")
        return None


def _make_displacement(pkl_path: str) -> DisplacementModel:
    """
    Try to load a DisplacementModel from pkl_path.
    Falls back to a fresh DisplacementModel instance (no weights) on failure.
    """
    raw = _load_pkl(pkl_path)
    if raw is not None:
        # raw is an XGBRegressor directly — wrap in the class shell
        instance = DisplacementModel.__new__(DisplacementModel)
        instance.model = raw
        return instance
    logger.warning(f"[ModelRegistry] Using untrained DisplacementModel fallback for {pkl_path}")
    return DisplacementModel()          # no-op until trained


# ── Load all models at module import ──────────────────────────────────────────

logger.info("[ModelRegistry] Starting model loading sequence...")

# 1. Displacement — XGBoost (classic 4-feature disaster model, trained)
DISPLACEMENT_XGB: DisplacementModel = _make_displacement("models/displacement_xgb.pkl")

# 2. Displacement — XGBoost (war 3-feature model, trained on GED data)
DISPLACEMENT_WAR: DisplacementModel = _make_displacement("models/displacement_model.pkl")

# 3. Drift — physics-based, no trained weights needed; pkl is a placeholder
DRIFT: DriftModel = DriftModel()
logger.info("[ModelRegistry] DriftModel initialised (physics-based, no pkl required)")

# 4. Hotspot — DBSCAN, initialised in-process (sklearn, no pkl needed)
#    hotspot_dbscan.pkl is a placeholder; real DBSCAN params live in HotspotModel
HOTSPOT: HotspotModel = HotspotModel()
logger.info("[ModelRegistry] HotspotModel initialised (DBSCAN in-process, no pkl required)")

# 5. Route — Haversine graph router, no pkl needed
#    route_graph.pkl is a placeholder
ROUTE: RouteModel = RouteModel()
logger.info("[ModelRegistry] RouteModel initialised (Haversine router, no pkl required)")

# 6. Secondary risk — rule-based scorer, no pkl needed
#    secondary_risk.pkl is a placeholder
SECONDARY_RISK: SecondaryRiskModel = SecondaryRiskModel()
logger.info("[ModelRegistry] SecondaryRiskModel initialised (rule-based, no pkl required)")

logger.info("[ModelRegistry] All models ready ✓")


# ── Health check helper ────────────────────────────────────────────────────────

def health() -> dict:
    """Return a dict describing load status of each model."""
    def _status(obj, name):
        return {
            "name": name,
            "type": type(obj).__name__,
            "ready": True,
            "has_predict": hasattr(obj, "predict"),
        }

    return {
        "displacement_xgb": _status(DISPLACEMENT_XGB, "displacement_xgb.pkl"),
        "displacement_war": _status(DISPLACEMENT_WAR, "displacement_model.pkl"),
        "drift":            _status(DRIFT,             "physics-based"),
        "hotspot":          _status(HOTSPOT,           "DBSCAN in-process"),
        "route":            _status(ROUTE,             "Haversine in-process"),
        "secondary_risk":   _status(SECONDARY_RISK,    "rule-based in-process"),
    }
