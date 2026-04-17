def normalize_disaster_type(raw_type: str) -> str:
    """
    Normalize raw external data strings strictly into the internal ecosystem types:
    Flood, Storm, Epidemic, Drought, Volcanic Activity, Industrial Accident,
    Chemical Spill, Gas Leak, Explosion (Industrial), Fire (Industrial),
    Oil Spill, Radiation Leak, Nuclear Accident.
    """
    if not isinstance(raw_type, str):
        return "Unknown"
        
    t = raw_type.strip().lower()
    
    # Storm / Hurricane / Cyclone / Tsunami (Water disturbances)
    if any(k in t for k in ["storm", "cyclone", "tc", "hurricane", "typhoon", "tornado", "tsunami"]):
        return "Storm"
        
    # Flood
    if "flood" in t or t == "fl":
        return "Flood"
        
    # Volcanic Activity / Earthquakes (Geological)
    if "volcan" in t or t == "vo" or "quake" in t or t == "eq":
        return "Volcanic Activity"
        
    # Fire (NASA EONET maps Wildfires)
    if "fire" in t:
        return "Fire (Industrial)" if "industrial" in t else "Fire (Industrial)" # Map all to Fire (Industrial) for exact list adherence
        
    # Drought
    if "drought" in t or t == "dr" or "heat" in t:
        return "Drought"
        
    # Epidemic
    if "epidemic" in t or "disease" in t or "virus" in t or "health" in t:
        return "Epidemic"
        
    # Spills / Leaks
    if "oil spill" in t:
        return "Oil Spill"
    if "chemical spill" in t:
        return "Chemical Spill"
    if "gas leak" in t:
        return "Gas Leak"
    if "radiation" in t:
        return "Radiation Leak"
    if "nuclear" in t:
        return "Nuclear Accident"
        
    # Industrial Accidents
    if "explosion" in t:
        return "Explosion (Industrial)"
    if "industrial" in t or "accident" in t:
        return "Industrial Accident"
        
    return raw_type.capitalize()
