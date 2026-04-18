import requests
import logging
import time
from .normalizer import normalize_disaster_type

_CACHE = {
    "data": [],
    "last_fetched": 0
}
CACHE_TTL = 300  # 5 minutes

logger = logging.getLogger(__name__)

def fetch_gdacs_disasters():
    """Fetch active disasters from GDACS and convert to standard format."""
    global _CACHE
    if time.time() - _CACHE["last_fetched"] < CACHE_TTL:
        return _CACHE["data"]

    url = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
    standard_data = []
    
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        raw_events = response.json()
        
        if isinstance(raw_events, list):
            # Parse top 100 recent alerts for worldwide density
            for event in raw_events[:100]:
                event_name = event.get("eventname", "GDACS Alert")
                event_type = event.get("eventtype", "Unknown")
                
                # GDACS ranks severity by alert level: Green, Orange, Red
                alert_level = str(event.get("alertlevel", "Green")).upper()
                if alert_level == "RED":
                    severity = 9
                elif alert_level == "ORANGE":
                    severity = 7
                else:
                    severity = 4
                    
                lat = event.get("latitude", 0.0)
                lon = event.get("longitude", 0.0)
                
                # Filter out corrupt/null coordinates
                if event_type.lower() != "unknown" and (lat != 0.0 or lon != 0.0):
                    normalized_type = normalize_disaster_type(event_type)
                    standard_data.append({
                        "name": event_name,
                        "type": normalized_type,
                        "severity": int(severity),
                        "affected": 10000 * severity, # Scale affected by severity
                        "location": [float(lat), float(lon)],
                        "hub": f"GDACS {event.get('country', 'Global')}"
                    })
                    
    except Exception as e:
        logger.error(f"Failed to fetch data from GDACS: {e}")
        
    # Update Cache
    if standard_data:
        _CACHE["data"] = standard_data
        _CACHE["last_fetched"] = time.time()
        
    return standard_data
