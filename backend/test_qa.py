"""
Final QA Test Script for Crisis Connect API.
Testing endpoints, JSON format, error handling without crashing.
"""

import sys
import json
import logging
sys.path.insert(0, ".")

from app import create_app

app = create_app()
client = app.test_client()

valid_payload = {
    "type": "flood",
    "severity": 8.0,
    "location": [34.05, -118.25],
    "radius_km": 20,              
    "population_density": 500,    
    "infrastructure_index": 5.0,  
    "risk_index": 5.0             
}

endpoints_to_test = [
    {
        "method": "GET",
        "url": "/health",
        "description": "Health Check Endpoint"
    },
    {
        "method": "GET",
        "url": "/",
        "description": "Root Info Endpoint"
    },
    {
        "method": "POST",
        "url": "/simulate",
        "payload": valid_payload,
        "description": "Simulation Endpoint (Valid Data)"
    },
    {
        "method": "POST",
        "url": "/api/disaster/analyze",
        "payload": valid_payload,
        "description": "Disaster Analyze Endpoint (Valid Data)"
    },
    {
        "method": "GET",
        "url": "/disasters/",
        "description": "List All Disasters"
    },
    {
        "method": "GET",
        "url": "/disasters/1",
        "description": "Get Specific Disaster (Valid ID)"
    },
    {
        "method": "GET",
        "url": "/disasters/999",
        "description": "Get Specific Disaster (Invalid ID - 404 check)"
    },
    {
        "method": "GET",
        "url": "/disasters/1/impact",
        "description": "Get Specific Disaster Impact (Valid ID)"
    },
    {
        "method": "GET",
        "url": "/disasters/999/impact",
        "description": "Get Specific Disaster Impact (Invalid ID - 404 check)"
    }
]

print("=" * 60)
print("  FINAL QA SCRIPT: ENDPOINT CHECK")
print("=" * 60)

for ep in endpoints_to_test:
    method = ep["method"]
    url = ep["url"]
    print(f"\n[TEST] {method} {url} - {ep['description']}")
    
    if method == "GET":
        response = client.get(url)
    elif method == "POST":
        response = client.post(url, json=ep.get("payload", {}))
        
    print(f"  Status Code  : {response.status_code}")
    print(f"  Content-Type : {response.headers.get('Content-Type')}")
    
    is_json = response.is_json
    print(f"  Is JSON?     : {is_json}")
    
    if is_json:
        data = response.get_json()
        print(f"  JSON Format -> status: '{data.get('status', 'NONE')}' | keys: {list(data.keys())}")
    else:
        print("  WARNING: Non-JSON Response!")

print("\n" + "=" * 60)
