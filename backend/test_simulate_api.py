"""
Test Input Validation for /simulate
"""
import sys
import json
sys.path.insert(0, ".")

from app import create_app

app = create_app()
client = app.test_client()

cases = [
    {
        "name": "1. Invalid disaster type",
        "payload": {
            "type": "Alien Attack",
            "severity": 8
        }
    },
    {
        "name": "2. Missing fields",
        "payload": {
            "severity": 8
        }
    },
    {
        "name": "3. Invalid severity",
        "payload": {
            "type": "Flood",
            "severity": 20
        }
    }
]

print("=" * 60)
print("  TESTING INPUT VALIDATION FOR /simulate")
print("=" * 60)

for idx, case in enumerate(cases):
    print(f"\n[Case {case['name']}]")
    print("Payload payload:", json.dumps(case["payload"]))
    
    response = client.post('/simulate', json=case["payload"])
    
    print(f"Status Code: {response.status_code}")
    print(f"Response JSON: {json.dumps(response.get_json(), indent=2)}")
    
    if response.status_code == 400:
        print("[PASS] Validation caught errors successfully without crashing.")
    elif response.status_code == 500:
        print("[FAIL] SERVER CRASHED! Returned 500.")
    else:
        print(f"[WARN] Unexpected status code: {response.status_code}")
        
print("\n" + "=" * 60)
print("  TEST SUITE COMPLETE")
print("=" * 60)
