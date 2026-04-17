from app.services.hotspot_service import detect_hotspots
from app.services.risk_service import assess_risk
from app.services.resource_service import allocate_resources
from app.ml.predict import predict_displacement

def run_simulation(data):
    """
    Core logic to execute a disaster simulation scenario using the trained ML model.
    """
    # 1. Parse Inputs
    disaster_type = data.get('type', 'default')
    severity = data.get('severity', 0.0)
    population_density = data.get('population_density', 500.0)
    
    # 2. ML Prediction (loaded once globally in predict module)
    displacement_info = predict_displacement(
        disaster_type=disaster_type,
        severity=severity,
        population_density=population_density
    )
    
    # Establish total affected (matches ML calculation area constraint)
    affected_population = int(population_density * 100)
    
    # 3. Synchronize context for downstream modules without duplicate calculation
    data['displaced'] = displacement_info['displaced_population']
    data['severity'] = severity
    
    # 4. Invoke integrated modules
    hotspots = detect_hotspots(data)
    risks = assess_risk(data)
    
    # Ensure risk.level aligns with impact for resource allocator
    if 'level' not in risks:
        risks['level'] = displacement_info['impact_level']
        
    resources = allocate_resources(displacement_info['displaced_population'])
    
    # 5. Build Structured Response
    return {
        "summary": {
            "affected_population": affected_population,
            "displaced_population": displacement_info['displaced_population'],
            "impact_level": displacement_info['impact_level']
        },
        "displacement": {
            "rate": displacement_info['displacement_rate']
        },
        "hotspots": hotspots,
        "resources": resources,
        "risk": risks
    }
