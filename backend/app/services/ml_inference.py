import logging
import pickle
import os
import warnings
import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning)

logger = logging.getLogger(__name__)

# Load the trained ML Model artifact at startup
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ml', 'model.pkl')
ML_MODEL = None

try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            ML_MODEL = pickle.load(f)
        logger.info(f"Successfully loaded ML model from {MODEL_PATH}")
    else:
        logger.warning(f"ML model not found at {MODEL_PATH}. Falling back to default simulation.")
except Exception as e:
    logger.error(f"Failed to load ML Model from {MODEL_PATH}: {e}")


def predict_displacement_percentage(severity_score: float, risk_index: float, population_density: float, infrastructure_index: float) -> float:
    """
    Inference function that uses the loaded ML model or a fallback heuristic.
    """
    if ML_MODEL and not isinstance(ML_MODEL, dict):
        try:
            logger.info("Executing inference via trained ML Model")
            # Create DataFrame with the exact columns expected by XGBoost
            input_df = pd.DataFrame([{
                "severity_score": severity_score,
                "risk_index": risk_index,
                "population_density": population_density,
                "infrastructure_index": infrastructure_index
            }])
            prediction = ML_MODEL.predict(input_df)[0]
            logger.info(f"ML Model predicted: {prediction}")
            
            # Ensure it's a valid percentage between 0 and 100
            prediction = max(0.0, min(100.0, float(prediction)))
            return prediction
        except Exception as e:
            logger.error(f"Error during ML prediction: {e}. Falling back to heuristic.")
    elif ML_MODEL and isinstance(ML_MODEL, dict):
        logger.info(f"Executing inference via {ML_MODEL.get('algorithm', 'unknown')} v{ML_MODEL.get('version', '1.0')}")
    else:
        logger.info("Predicting displacement with ML fallback heuristic")
        
    # Mock heuristic replicating the expected model behavior:
    # - Higher severity and risk -> more displacement
    # - Higher infrastructure -> lower displacement
    
    # Assuming expected scales: severity_score (0-100), risk_index (0-10), infra (0-10)
    base_percentage = (severity_score * 0.4) + (risk_index * 2.0)
    mitigation = (infrastructure_index * 1.5)
    
    displaced_percentage = base_percentage - mitigation
    
    # Ensure it's a valid percentage between 0 and 100
    displaced_percentage = max(0.0, min(100.0, displaced_percentage))
    
    return displaced_percentage
