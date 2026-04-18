import logging
import pickle
import os
import warnings
import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning)

logger = logging.getLogger(__name__)

# Load the trained ML Model artifact at startup
MODEL_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'models')
MODEL_PATH = os.path.join(MODEL_ROOT, 'displacement_xgb.pkl')
ML_MODEL = None

try:
    if os.path.exists(MODEL_PATH):
        # We need to import xgboost to correctly unpickle an XGBRegressor
        import xgboost as xgb
        with open(MODEL_PATH, 'rb') as f:
            ML_MODEL = pickle.load(f)
        logger.info(f"Successfully loaded XGBoost model from {MODEL_PATH}")
    else:
        logger.warning(f"ML model not found at {MODEL_PATH}. Falling back to default simulation.")
except Exception as e:
    logger.error(f"Failed to load ML Model from {MODEL_PATH}: {e}")


from src.api.inference import predict_displacement

def predict_displacement_percentage(severity_score: float, risk_index: float, population_density: float, infrastructure_index: float) -> float:
    """
    DEPRECATED: Legacy bridge to unified XGBoost engine.
    Now redirects to src.api.inference for production-grade results.
    """
    logger.info("Redirecting legacy displacement call to unified XGBoost engine")
    
    payload = {
        "severity_score": severity_score,
        "risk_index": risk_index,
        "population_density": population_density,
        "infrastructure_index": infrastructure_index
    }
    
    # Use standard prediction logic
    res = predict_displacement(payload)
    
    # Standardize result back to a percentage for legacy callers
    # (The new XGB model often returns a count; if it's > 100 we assume it's a count and normalize)
    val = res.get("displacement", 0.0)
    if val > 100:
        # Heuristic normalization for legacy percentage expectation
        return min(95.0, (val / population_density) * 10 if population_density > 0 else 30.0)
    
    return val
