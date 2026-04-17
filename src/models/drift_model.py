import numpy as np
from src.data.geo_utils import drift_position

class DriftModel:
    def __init__(self):
        pass

    def predict(self, data):
        """
        data = {
            lat, lon,
            wind_speed, wind_dir,
            current_speed, current_dir,
            time_hours
        }
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

        # uncertainty radius increases over time
        radius = data["time_hours"] * 2  # km

        # survival probability (simple heuristic)
        survival_prob = max(0, 1 - (data["time_hours"] / 72))

        return {
            "predicted_lat": lat,
            "predicted_lon": lon,
            "search_radius_km": radius,
            "survival_probability": survival_prob
        }
