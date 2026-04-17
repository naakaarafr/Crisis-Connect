import requests
import logging
import logging
import time
from .normalizer import normalize_disaster_type

_CACHE = {
    "data": [],
    "last_fetched": 0
}
CACHE_TTL = 300  # 5 minutes

logger = logging.getLogger(__name__)

def fetch_nasa_disasters():
    """Fetch active disasters from NASA EONET and convert to standard format."""
    global _CACHE
    if time.time() - _CACHE["last_fetched"] < CACHE_TTL:
        return _CACHE["data"]

    url = "https://eonet.gsfc.nasa.gov/api/v3/events"
    standard_data = []
    
    try:
        # Fetch data, timeout after 10s
        response = requests.get(f"{url}?status=open&limit=20", timeout=10)
        response.raise_for_status()
        raw_events = response.json().get("events", [])
        
        for event in raw_events:
            categories = event.get("categories", [])
            event_type = categories[0].get("title", "Unknown") if categories else "Unknown"
            
            # EONET Geometry is a list; grab the latest entry
            geometries = event.get("geometry", [])
            lat, lon = 0.0, 0.0
            
            if geometries:
                coords = geometries[-1].get("coordinates", [])
                # GeoJSON formatting returns [Longitude, Latitude]
                if len(coords) >= 2:
                    lon, lat = coords[0], coords[1]
                    
            # Set baseline heuristics since EONET lacks universal severity
            severity = 6 if "fire" in event_type.lower() else 5
            
            if event_type.lower() != "unknown" and (lat != 0.0 or lon != 0.0):
                normalized_type = normalize_disaster_type(event_type)
                standard_data.append({
                    "type": normalized_type,
                    "severity": int(severity),
                    "location": [float(lat), float(lon)]
                })
                
    except Exception as e:
        logger.error(f"Failed to fetch data from NASA EONET: {e}")
        
    # Update Cache
    if standard_data:
        _CACHE["data"] = standard_data
        _CACHE["last_fetched"] = time.time()
        
    return standard_data
