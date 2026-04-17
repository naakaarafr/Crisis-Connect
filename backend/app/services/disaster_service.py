from app.data_sources import fetch_nasa_disasters, fetch_gdacs_disasters

from app.database import (
    insert_disaster, 
    get_all_disasters as db_get_all, 
    get_disaster_by_id as db_get_by_id, 
    disaster_exists
)

ALLOWED_DISASTER_TYPES = {
    "flood", "storm", "epidemic", "drought", "volcanic activity",
    "industrial accident", "chemical spill", "gas leak", 
    "explosion (industrial)", "fire (industrial)", "oil spill", 
    "radiation leak", "nuclear accident"
}

def get_all_disasters():
    """Retrieve all disasters by merging local state with live external services."""
    # Fetch external data
    nasa_data = fetch_nasa_disasters()
    gdacs_data = fetch_gdacs_disasters()
    
    combined = nasa_data + gdacs_data
    
    for d in combined:
        lat = d["location"][0]
        lon = d["location"][1]
        
        # Deduplicate entries by type and bounded location
        if not disaster_exists(d["type"], lat, lon):
            insert_disaster(d["type"], d["severity"], lat, lon)

    return db_get_all()

def add_disaster(data):
    """Dynamically add a new disaster to the dataset."""
    # Parse location safely
    location_data = data.get("location")
    if isinstance(location_data, dict) and "lat" in location_data:
        lat, lon = location_data.get("lat"), location_data.get("lon")
    elif isinstance(location_data, (list, tuple)) and len(location_data) == 2:
        lat, lon = location_data[0], location_data[1]
    else:
        lat, lon = 0.0, 0.0

    d_type = str(data.get("type", "Unknown")).capitalize()
    severity = data.get("severity", 0)

    # Insert natively to DB
    new_id = insert_disaster(d_type, severity, lat, lon)
    return db_get_by_id(new_id)

def get_disaster_by_id(disaster_id):
    """Retrieve a single disaster by ID."""
    return db_get_by_id(disaster_id)

def calculate_impact(disaster_id):
    """
    Calculate the impact based on the disaster severity.
    Logic:
    - affected_population = severity * 10000
    - radius = severity * 5
    """
    disaster = get_disaster_by_id(disaster_id)
    if not disaster:
        return None
        
    severity = disaster.get("severity", 0)
    
    return {
        "disaster_id": disaster_id,
        "affected_population": severity * 10000,
        "radius": severity * 5
    }
