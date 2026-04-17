import numpy as np
import requests
import logging
import time
from sklearn.cluster import DBSCAN

logger = logging.getLogger(__name__)

def is_valid_landmass(lat, lon):
    """Hits OSM Nominatim API to ensure coordinates represent a valid addressable landmass, rather than the ocean."""
    url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json"
    headers = {"User-Agent": "CrisisConnect Backend QA Validator"}
    try:
        r = requests.get(url, headers=headers, timeout=3)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            return False  # "Unable to geocode" usually means water/ocean
        return True
    except Exception as e:
        logger.warning(f"Geographic Validation timeout or failure: {e}")
        return True # Fallback smoothly if OpenStreetMap API fails

def detect_hotspots(data):
    """
    Take input location [lat, lon], generate 20 random nearby points,
    cluster them using DBSCAN, and return structured hotspot groups.
    """
    location = data.get("location", [0.0, 0.0])
    displaced_population = data.get("displaced", 0)
    
    if len(location) == 2:
        lat, lon = location
    else:
        lat, lon = 0.0, 0.0
        
    # Generate 20 nearby random scatter points (std dev roughly correlates to 5-10km footprint)
    lat_points = np.random.normal(lat, 0.05, 20)
    lon_points = np.random.normal(lon, 0.05, 20)
    
    points = np.column_stack((lat_points, lon_points))
    
    # Cluster points using DBSCAN
    db = DBSCAN(eps=0.03, min_samples=3).fit(points)
    labels = db.labels_
    
    hotspots = []
    
    unique_labels = set(labels)
    valid_clusters = [k for k in unique_labels if k != -1]
    
    # Fallback if algorithm classifies everything as noise
    if not valid_clusters:
        return [{
            "lat": float(lat),
            "lon": float(lon),
            "intensity": 1.0,
            "population_estimate": int(displaced_population)
        }]
        
    # Calculate total clustered points to normalize intensity proportions to 1.0 total
    total_valid_points = sum(1 for label in labels if label != -1)
    
    # Process derived clusters
    for k in valid_clusters:
        cluster_mask = (labels == k)
        cluster_points = points[cluster_mask]
        
        # Center of generated hotspot
        center_lat = np.mean(cluster_points[:, 0])
        center_lon = np.mean(cluster_points[:, 1])
        
        # Validate spatial reality
        if not is_valid_landmass(center_lat, center_lon):
            # Contraction logic: snap to the true root origin where the primary disaster triggered
            center_lat, center_lon = lat, lon
            
        # Limit OSM rate to 1/sec
        time.sleep(1.0)
        
        # Intensity score as proportion of all valid clustered points
        intensity = len(cluster_points) / float(total_valid_points)
        
        population_estimate = int(intensity * displaced_population)
        
        hotspots.append({
            "lat": float(center_lat),
            "lon": float(center_lon),
            "intensity": float(round(intensity, 3)),
            "population_estimate": population_estimate
        })
        
    return hotspots
