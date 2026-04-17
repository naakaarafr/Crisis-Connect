import sys
import requests
import argparse
sys.path.append(".")
from src.models.drift_model import DriftModel

def get_country_live_drift(country_name):
    print(f"Fetching live data for: {country_name}...")
    
    # 1. Geocode the country to get Lat/Lon using Open-Meteo
    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={country_name}&count=1&format=json"
    geo_res = requests.get(geo_url).json()
    
    if "results" not in geo_res:
        print(f"❌ Could not find coordinates for '{country_name}'. Check spelling.")
        return
    
    location = geo_res["results"][0]
    lat = location["latitude"]
    lon = location["longitude"]
    
    # 2. Get LIVE weather data for those coordinates right now
    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=wind_speed_10m,wind_direction_10m&timezone=auto"
    weather_res = requests.get(weather_url).json()
    
    current_wind_speed = weather_res["current"]["wind_speed_10m"]
    current_wind_dir = weather_res["current"]["wind_direction_10m"]
    
    print(f"\n--- 🌍 LIVE OPEN-METEO WEATHER DATA ---")
    print(f"Location: {location['name']} (Lat: {lat}, Lon: {lon})")
    print(f"Live Current Wind Speed: {current_wind_speed} km/h")
    print(f"Live Current Wind Direction: {current_wind_dir}°")
    print("---------------------------------------\n")
    
    # 3. Predict Drift using the physics implementation
    data = {
        "lat": lat,
        "lon": lon,
        "wind_speed": current_wind_speed,
        "wind_dir": current_wind_dir,
        "current_speed": 2.0, # Baseline generic drift current
        "current_dir": current_wind_dir, # Simplified alignment
        "time_hours": 24.0 # Simulating an event 24 hours into the future
    }
    
    model = DriftModel()
    result = model.predict(data)
    
    print("--- 🚢 24-HOUR DRIFT PREDICTION ---")
    print(f"Predicted Latitude: {round(result['predicted_lat'], 4)}")
    print(f"Predicted Longitude: {round(result['predicted_lon'], 4)}")
    print(f"Expanded Search Radius: {result['search_radius_km']} km")
    print(f"Estimated Survival Probability: {round(result['survival_probability'] * 100, 2)}%")
    print("-----------------------------------")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live drift prediction for any country.")
    # Default to Japan if no argument is passed
    parser.add_argument("location", type=str, nargs="?", default="Japan", help="Country or city name")
    args = parser.parse_args()
    
    get_country_live_drift(args.location)
