from app.data_sources import fetch_nasa_disasters, fetch_gdacs_disasters, fetch_usgs_disasters

from app.database import (
    insert_disaster, 
    get_all_disasters as db_get_all, 
    get_disaster_by_id as db_get_by_id, 
    disaster_exists
)

ALLOWED_DISASTER_TYPES = {
    "Earthquake", "Flood", "Storm", "Epidemic", "Drought", "Volcanic Activity",
    "Industrial Accident", "Chemical Spill", "Gas Leak", 
    "Explosion (Industrial)", "Fire (Industrial)", "Oil Spill", 
    "Radiation Leak", "Nuclear Accident"
}

def sync_external_data():
    """Poll all external sources and synchronize with the local database."""
    sources = [
        ("NASA", fetch_nasa_disasters),
        ("GDACS", fetch_gdacs_disasters),
        ("USGS", fetch_usgs_disasters)
    ]
    
    total_added = 0
    for name, fetcher in sources:
        try:
            data = fetcher()
            for d in data:
                lat, lon = d["location"][0], d["location"][1]
                # Deduplicate by type and approximate location
                if not disaster_exists(d["type"], lat, lon):
                    insert_disaster(
                        d_type=d["type"],
                        severity=d["severity"],
                        lat=lat,
                        lon=lon,
                        name=d.get("name"),
                        affected=d.get("affected", 0),
                        hub=d.get("hub")
                    )
                    total_added += 1
        except Exception as e:
            print(f"Failed to sync {name}: {e}")
            
    return total_added

def get_all_disasters():
    """Retrieve all disasters from the database (background sync handles freshness)."""
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
    """Retrieve a single disaster by ID, enriched with dynamic timeline intel."""
    d = db_get_by_id(disaster_id)
    if d:
        d["timeline"] = generate_disaster_timeline(d)
    return d

def generate_disaster_timeline(d):
    """
    Generate a dynamic sequence of events based on disaster type and severity.
    Uses 'timestamp' as the baseline T-0.
    """
    import datetime
    
    # Baseline detection logic
    base_ts = d.get("timestamp")
    if isinstance(base_ts, str):
        try:
            # Handle potential formats from SQLite (YYYY-MM-DD HH:MM:SS)
            start_dt = datetime.datetime.strptime(base_ts.split('.')[0], "%Y-%m-%d %H:%M:%S")
        except:
            start_dt = datetime.datetime.utcnow()
    else:
        start_dt = datetime.datetime.utcnow()

    # Timeline Template Generation
    timeline = []
    
    # Phase 1: Detection (Past)
    timeline.append({
        "status": "Past",
        "title": "Satellite Detection",
        "timestamp": start_dt.strftime("%Y-%m-%d %H:%M:%S") + " UTC",
        "desc": f"Primary thermal and seismic sensors registered {d['type']} activity. Uplink established to Central Command."
    })
    
    # Phase 2: Response (Current or Near-Past)
    offset_resp = 2 if d['severity'] > 3 else 4
    resp_dt = start_dt + datetime.timedelta(hours=offset_resp)
    timeline.append({
        "status": "Current",
        "title": "Emergency Response Triggered",
        "timestamp": resp_dt.strftime("%Y-%m-%d %H:%M:%S") + " UTC",
        "desc": f"Local first responders deployed to coordinates {d['lat']}, {d['lng']}. Primary triage centers initializing."
    })
    
    # Phase 3: Logistics (Future)
    offset_log = 12 if d['severity'] > 3 else 24
    log_dt = start_dt + datetime.timedelta(hours=offset_log)
    timeline.append({
        "status": "Future",
        "title": "Logistical Corridor Deployment",
        "timestamp": log_dt.strftime("%Y-%m-%d %H:%M:%S") + " UTC",
        "desc": f"Airlift of medical supplies and temporary shelters estimated at T+{offset_log}h. Secondary routes being surveyed."
    })
    
    # Phase 4: Stabilization (Future)
    offset_stab = 48 if d['severity'] > 3 else 72
    stab_dt = start_dt + datetime.timedelta(hours=offset_stab)
    timeline.append({
        "status": "Future",
        "title": "Target Stabilization Window",
        "timestamp": stab_dt.strftime("%Y-%m-%d %H:%M:%S") + " UTC",
        "desc": "Models predict peak impact stabilization and transition to civil recovery phase."
    })
    
    return timeline

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
