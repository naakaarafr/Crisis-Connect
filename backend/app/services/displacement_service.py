from app.services.ml_inference import predict_displacement_percentage

def calculate_displacement(data):
    """
    Calculate the estimated displacement of people based on disaster data.
    """
    # Extract ML required features from data payload or calculate defaults
    severity_score = float(data.get("severity_score", 50.0))
    risk_index = float(data.get("risk_index", 5.0))
    population_density = float(data.get("population_density", 500.0))
    infrastructure_index = float(data.get("infrastructure_index", 5.0))
    
    # Predict percentage using ML Model
    displaced_percentage = predict_displacement_percentage(
        severity_score=severity_score,
        risk_index=risk_index,
        population_density=population_density,
        infrastructure_index=infrastructure_index
    )
    
    # Calculate absolute persons for downstream services
    affected_population = data.get("affected_population", 0)
    if affected_population == 0:
        radius_km = data.get("radius_km", 10)
        area = 3.14159 * (radius_km ** 2)
        affected_population = area * population_density
        
    estimated_displaced_persons = int(affected_population * (displaced_percentage / 100.0))
    
    return {
        "displaced_percentage": displaced_percentage,
        "estimated_displaced_persons": estimated_displaced_persons,
        "ml_features_used": {
            "severity_score": severity_score,
            "risk_index": risk_index,
            "population_density": population_density,
            "infrastructure_index": infrastructure_index
        }
    }
