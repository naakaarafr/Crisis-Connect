import os
import sys
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.api.inference import predict_displacement

def calculate_displacement(data):
    """
    Calculate the estimated displacement of people using the unified XGBoost engine.
    Rely on src.api.inference for consistent ML logic across the platform.
    """
    # 1. Map input metrics to standardized ML payload
    # Handles dynamic mapping from real-time feeds (e.g. disaster_service analytics)
    payload = {
        "severity_score": float(data.get("severity_score", 50.0)),
        "risk_index": float(data.get("risk_index", 5.0)),
        "population_density": float(data.get("population_density", 500.0)),
        "infrastructure_index": float(data.get("infrastructure_index", 5.0)),
        "conflict_intensity": float(data.get("conflict_intensity", 50.0)),
        "population": float(data.get("population", 50000.0)),
        "infra_score": float(data.get("infra_score", 5.0))
    }

    # 2. Execute XGBoost Inference
    result = predict_displacement(payload)
    
    # Extract prediction (raw float)
    predicted_val = result.get("displacement", 0.0)
    
    # 3. Enrich response for downstream services (Hotspots/Tactical Mapping)
    # Ensure absolute persons are calculated if only a score was returned
    affected_pop = float(data.get("affected_population", 0))
    if affected_pop == 0:
        radius_km = float(data.get("radius_km", 10))
        area = 3.14159 * (radius_km ** 2)
        affected_pop = area * payload["population_density"]

    # The prediction is often a population count directly in the new XGB model
    estimated_displaced = int(predicted_val) if predicted_val > 100 else int(affected_pop * (predicted_val / 100.0))

    return {
        "displaced_percentage": round((estimated_displaced / affected_pop * 100), 2) if affected_pop > 0 else 0,
        "estimated_displaced_persons": estimated_displaced,
        "risk_level": result.get("risk_level", "LOW"),
        "ml_features_used": payload,
        "model_version": "XGBoost-1.0.v1"
    }
