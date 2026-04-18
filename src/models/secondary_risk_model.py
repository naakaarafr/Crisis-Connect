import requests
import random

class SecondaryRiskModel:
    """
    Dynamic secondary risk scorer predicting risk levels using real-time
    meteorological data from Open-Meteo API and exact displacement heuristics.
    """

    def predict(self, data: dict) -> dict:
        displaced = int(data.get("displaced_people", 0))
        severity = float(data.get("severity", 4.0))
        disaster_type = str(data.get("disaster_type", "default")).lower().strip()
        lat = float(data.get("lat", 0.0))
        lon = float(data.get("lon", 0.0))

        # 1. Fetch real-time weather from Open-Meteo
        weather_data = {}
        try:
            if lat != 0.0 and lon != 0.0:
                url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
                response = requests.get(url, timeout=3)
                if response.status_code == 200:
                    weather_data = response.json().get("current_weather", {})
        except Exception as e:
            print(f"[SecondaryRiskModel] Failed to fetch external weather: {e}")

        # Weather Factors
        temp = float(weather_data.get("temperature", 25.0))
        wind = float(weather_data.get("windspeed", 10.0))
        wcode = int(weather_data.get("weathercode", 0)) # precipitation/storms

        # Base Risk Matrix
        base = severity * 10
        disp_pressure = min(40, displaced / 5000.0)

        # Dynamic specific risks
        # Disease: higher in extreme heat/cold or heavy rain (weathercode > 50)
        disease_score = base + disp_pressure + (15 if temp > 32 else 0) + (20 if wcode > 50 else 0)
        
        # Overcrowd: purely bound to displacement pressure
        overcrowd_score = base * 0.8 + disp_pressure * 1.5

        # Food: dependent on severity + minor randomness for supply chain variance
        food_score = base * 0.9 + disp_pressure + random.uniform(-5, 10)

        # Water Contamination: boosted significantly by flooding/rain
        water_score = base + (30 if disaster_type == "flood" else 0) + (15 if wcode > 50 else 0)

        # Infrastructure: boosted by high winds and earthquake status
        infra_score = base + (wind * 0.5) + (20 if disaster_type == "earthquake" else 0)

        def clamp(v):
            return max(0, min(100, int(v)))

        # 2. Build the exact card payload array (excluding mental health)
        cards = [
            {
                "id": "disease",
                "name": "Disease Outbreak",
                "icon": "<circle cx=\"12\" cy=\"12\" r=\"5\"/><path d=\"M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5L19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5L19 5\"/>",
                "desc": f"Risk of infectious clustering { 'amplified by severe precipitation' if wcode > 50 else 'under current climate' }.",
                "score": clamp(disease_score)
            },
            {
                "id": "overcrowd",
                "name": "Overcrowding",
                "icon": "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>",
                "desc": f"Severe density limits mapped for {displaced:,} displaced persons.",
                "score": clamp(overcrowd_score)
            },
            {
                "id": "food",
                "name": "Food Shortage",
                "icon": "<circle cx=\"9\" cy=\"21\" r=\"1\"/><circle cx=\"20\" cy=\"21\" r=\"1\"/><path d=\"M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6\"/>",
                "desc": "Depleted regional stockpile metrics and disrupted supply chains.",
                "score": clamp(food_score)
            },
            {
                "id": "water",
                "name": "Water Contamination",
                "icon": "<path d=\"M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z\"/>",
                "desc": "Systemic breakdown of mass sanitization and potable water systems.",
                "score": clamp(water_score)
            },
            {
                "id": "infra",
                "name": "Infrastructure Collapse",
                "icon": "<rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\" ry=\"2\"/><line x1=\"9\" y1=\"22\" x2=\"9\" y2=\"2\"/><line x1=\"15\" y1=\"22\" x2=\"15\" y2=\"2\"/><line x1=\"4\" y1=\"12\" x2=\"20\" y2=\"12\"/><line x1=\"4\" y1=\"7\" x2=\"9\" y2=\"7\"/><line x1=\"4\" y1=\"17\" x2=\"9\" y2=\"17\"/><line x1=\"15\" y1=\"7\" x2=\"20\" y2=\"7\"/><line x1=\"15\" y1=\"17\" x2=\"20\" y2=\"17\"/>",
                "desc": f"Degradation of load-bearing structural assets{ ' exacerbated by high winds ('+str(wind)+'km/h)' if wind > 30 else '' }.",
                "score": clamp(infra_score)
            }
        ]

        total_risk = sum([c["score"] for c in cards]) / len(cards)

        return {
            "risk_score": clamp(total_risk),
            "weather": weather_data,
            "cards": cards
        }
