import math

# ==========================================
# 1. PHYSICS ENGINE (From your geo_utils.py)
# ==========================================
def drift_position(lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours):
    """
    Predict new position based on ocean current + wind vector physics
    """
    # Convert directions to radians
    wind_rad = math.radians(wind_dir)
    current_rad = math.radians(current_dir)

    # Calculate drift components mapping
    dx = (wind_speed * math.cos(wind_rad) + current_speed * math.cos(current_rad)) * time_hours
    dy = (wind_speed * math.sin(wind_rad) + current_speed * math.sin(current_rad)) * time_hours

    # Convert km distance to global lat/lon coordinate shift
    new_lat = lat + (dy / 111)
    new_lon = lon + (dx / (111 * math.cos(math.radians(lat))))

    return new_lat, new_lon


# ==========================================
# 2. FLASK API WRAPPER (From your drift_model.py)
# ==========================================
class DriftModel:
    def __init__(self):
        pass

    def predict(self, data):
        """
        Accepts dict: {lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours}
        Returns dict: {predicted_lat, predicted_lon, search_radius_km, survival_probability}
        """
        lat, lon = drift_position(
            data["lat"],
            data["lon"],
            data["wind_speed"],
            data["wind_dir"],
            data["current_speed"],
            data["current_dir"],
            data["time_hours"]
        )

        # uncertainty search radius expands over time (2km/h heuristic)
        radius = data["time_hours"] * 2  

        # survival probability dropoff heuristic cap
        survival_prob = max(0, 1 - (data["time_hours"] / 72))

        return {
            "predicted_lat": lat,
            "predicted_lon": lon,
            "search_radius_km": radius,
            "survival_probability": survival_prob
        }
