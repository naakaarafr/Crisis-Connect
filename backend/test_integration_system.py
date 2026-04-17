"""
Full System Integration Test across Multiple Disaster Types.
Testing: Flood, Epidemic, Nuclear Accident
"""
import sys
import json
sys.path.insert(0, ".")

from app import create_app

app = create_app()
client = app.test_client()

disaster_types = ["Flood", "Epidemic", "Nuclear Accident"]
base_payload = {
    "severity": 8.0,
    "location": [34.05, -118.25],
    "radius_km": 20,              
    "population_density": 500,    
    "infrastructure_index": 5.0,  
    "risk_index": 5.0             
}

print("=" * 70)
print("  FULL SYSTEM INTEGRATION TEST")
print("=" * 70)

results = {}

for dtype in disaster_types:
    payload = base_payload.copy()
    payload["type"] = dtype
    
    response = client.post('/simulate', json=payload)
    if response.status_code != 200:
        print(f"Failed to run simulation for {dtype}: {response.get_json()}")
        continue
        
    data = response.get_json()["data"]
    results[dtype] = data

# Output comparison
fields_to_compare = [
    ("Estimated Displacement", lambda d: d["summary"]["displaced_population"]),
    ("Risk Score", lambda d: d["risk"]["risk_score"]),
    ("Risk Category", lambda d: d["risk"]["category"]),
    ("Disease Risk", lambda d: d["risk"]["disease_risk"]),
    ("Food Shortage", lambda d: d["risk"]["food_shortage"]),
    ("Shelters Needed", lambda d: d["resources"]["shelters_needed"]),
    ("Medical Kits", lambda d: d["resources"]["medical_kits"]),
    ("Resource Pressure", lambda d: d["resources"]["resource_pressure"]),
]

col_width = 18
header = f"{'Metric':<25} | " + " | ".join(f"{dt:<{col_width}}" for dt in disaster_types)
print("\n" + header)
print("-" * len(header))

for label, extractor in fields_to_compare:
    row = f"{label:<25} | "
    for dt in disaster_types:
        try:
            val = extractor(results[dt])
            if isinstance(val, float):
                val_str = f"{val:.0f}"
            else:
                val_str = str(val)
        except KeyError:
            val_str = "ERR"
        row += f"{val_str:<{col_width}} | "
    print(row)

print("\n" + "=" * 70)
