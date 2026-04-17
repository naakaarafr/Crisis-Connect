def assess_risk(data):
    """
    Evaluate structural, logistical, and environmental variables to determine comprehensive risk metrics.
    """
    displaced = data.get("displaced", 0)
    severity = float(data.get("severity", 0.0))
    disaster_type = str(data.get("type", "default")).strip().lower()
    
    # 1. Risk Scoring
    # Calculate base score from normalized displacement + severity
    displacement_factor = displaced / 10000.0
    base_score = int(severity + displacement_factor)
    
    # Add +2 modifier for high-risk disaster distributions
    high_risk_types = ["epidemic", "chemical spill", "radiation leak", "nuclear accident"]
    if disaster_type in high_risk_types:
        base_score += 2
        
    risk_score = max(0, base_score)
    
    # 2. Risk Categorization (moderate/high/critical)
    if risk_score >= 12 or displaced > 80000:
        category = "critical"
    elif risk_score >= 7 or displaced > 30000:
        category = "high"
    else:
        category = "moderate"
        
    # 3. Supplemental Metric Toggles
    if category == "critical" or disaster_type in ["epidemic", "chemical spill"]:
        disease_risk = "high"
    elif category == "high" or displaced > 20000:
        disease_risk = "medium"
    else:
        disease_risk = "low"
        
    overcrowding = displaced > 30000
    food_shortage = (category in ["critical", "high"]) or (displaced > 50000)
    
    # 4. Return Structured JSON Format
    return {
        "risk_score": risk_score,
        "category": category,
        "disease_risk": disease_risk,
        "overcrowding": overcrowding,
        "food_shortage": food_shortage
    }
