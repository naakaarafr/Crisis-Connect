import os
import pickle
import pandas as pd

import sys

# Ensure project root is accessible so 'src' can be imported natively
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.models.displacement_model import DisplacementModel

MODEL_PATH = os.path.join(PROJECT_ROOT, 'models/displacement_xgb.pkl')
_displacement_model = DisplacementModel(MODEL_PATH)
MODEL = _displacement_model.model

# Encode disaster type using a dictionary mapping.
# Since the trained model requires risk_index and infrastructure_index,
# we derive these from the given disaster type.
TYPE_ENCODING = {
    'flood': {'risk_index': 6.0, 'infrastructure_index': 5.0},
    'storm': {'risk_index': 7.5, 'infrastructure_index': 4.0},
    'epidemic': {'risk_index': 9.0, 'infrastructure_index': 9.0},     # biological, infra intact
    'drought': {'risk_index': 5.5, 'infrastructure_index': 8.0},      # environmental, slow onset
    'volcanic activity': {'risk_index': 8.5, 'infrastructure_index': 2.5},
    'industrial accident': {'risk_index': 6.5, 'infrastructure_index': 5.5},
    'chemical spill': {'risk_index': 7.5, 'infrastructure_index': 6.0},
    'gas leak': {'risk_index': 6.0, 'infrastructure_index': 7.0},
    'explosion (industrial)': {'risk_index': 8.0, 'infrastructure_index': 3.5},
    'fire (industrial)': {'risk_index': 7.5, 'infrastructure_index': 4.5},
    'oil spill': {'risk_index': 8.0, 'infrastructure_index': 7.0},
    'radiation leak': {'risk_index': 9.0, 'infrastructure_index': 6.0},
    'nuclear accident': {'risk_index': 10.0, 'infrastructure_index': 1.0}, # catastrophic
    
    # Legacy fallbacks
    'earthquake': {'risk_index': 8.5, 'infrastructure_index': 3.0},
    'hurricane': {'risk_index': 8.0, 'infrastructure_index': 3.5},
    'tsunami': {'risk_index': 9.0, 'infrastructure_index': 2.0},
    'default': {'risk_index': 5.0, 'infrastructure_index': 5.0}
}

def predict_displacement(disaster_type: str, severity: float, population_density: float) -> dict:
    """
    Predict displacement statistics based on disaster data.
    """
    # 1. Encode disaster type
    disaster_type_clean = str(disaster_type).lower().strip()
    encoding = TYPE_ENCODING.get(disaster_type_clean, TYPE_ENCODING['default'])
    
    # 2. Derive required model inputs
    # severity_score formula matches feature_engineer.py:
    #   severity_score = magnitude * affected_population
    # where affected_population = population_density * 100km^2 area
    affected_population = int(population_density * 100)
    severity_score = severity * affected_population

    # risk_index scaled by severity so higher severity raises risk proportionally
    scaled_risk_index = encoding['risk_index'] * (severity / 5.0)

    input_df = pd.DataFrame([{
        "severity_score": float(severity_score),
        "risk_index": float(scaled_risk_index),
        "population_density": float(population_density),
        "infrastructure_index": float(encoding['infrastructure_index'])
    }])

    # 3. Model Prediction
    displacement_rate = float(MODEL.predict(input_df)[0])
    displacement_rate = max(0.0, min(100.0, displacement_rate))

    displaced_population = int(affected_population * (displacement_rate / 100.0))
    
    # 4. Impact level: thresholds relative to affected_population for proper scaling
    displacement_ratio = displaced_population / max(affected_population, 1)
    if displaced_population > 50000 or displacement_ratio > 0.6:
        impact_level = "high"
    elif displaced_population > 20000 or displacement_ratio > 0.3:
        impact_level = "medium"
    else:
        impact_level = "low"
        
    # 5. Return structured output
    return {
        "displaced_population": displaced_population,
        "displacement_rate": float(round(displacement_rate, 2)),
        "impact_level": impact_level
    }
