import requests
import logging
import time
from .normalizer import normalize_disaster_type

_CACHE = {
    "data": [],
    "last_fetched": 0
}
CACHE_TTL = 600  # 10 minutes

logger = logging.getLogger(__name__)

def fetch_usgs_disasters():
    """Fetch recent earthquakes from USGS GeoJSON API."""
    global _CACHE
    if time.time() - _CACHE["last_fetched"] < CACHE_TTL:
        return _CACHE["data"]

    # All earthquakes from the past day
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
    standard_data = []
    
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        features = data.get("features", [])
        
        for feature in features:
            props = feature.get("properties", {})
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [])
            
            # Map magnitude to 1-10 severity
            mag = props.get("mag", 0)
            if mag is None: mag = 0
            severity = max(1, min(10, int(mag * 1.5)))
            
            # GeoJSON coords are [lon, lat, depth]
            if len(coords) >= 2:
                lon, lat = coords[0], coords[1]
                
                standard_data.append({
                    "name": props.get("title", "Earthquake"),
                    "type": "Earthquake",
                    "severity": severity,
                    "affected": int(mag * 5000) if mag > 4 else 0, # Heuristic affected count
                    "location": [float(lat), float(lon)],
                    "hub": props.get("place", "USGS Monitoring")
                })
                
    except Exception as e:
        logger.error(f"Failed to fetch data from USGS: {e}")
        
    if standard_data:
        _CACHE["data"] = standard_data
        _CACHE["last_fetched"] = time.time()
        
    return standard_data
