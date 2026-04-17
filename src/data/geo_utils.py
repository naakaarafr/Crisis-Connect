import math  # Required for math.radians and math.cos/sin functions

# ==============================
# DRIFT CALCULATIONS (NEW)
# ==============================

def drift_position(lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours):
    """
    Predict new position based on ocean current + wind
    """

    # Convert directions to radians
    wind_rad = math.radians(wind_dir)
    current_rad = math.radians(current_dir)

    # Drift components
    dx = (wind_speed * math.cos(wind_rad) + current_speed * math.cos(current_rad)) * time_hours
    dy = (wind_speed * math.sin(wind_rad) + current_speed * math.sin(current_rad)) * time_hours

    # Convert km to lat/lon shift
    new_lat = lat + (dy / 111)
    new_lon = lon + (dx / (111 * math.cos(math.radians(lat))))

    return new_lat, new_lon