import json
import traceback

PASS = "PASS"
FAIL = "FAIL"

print("=" * 50)
print("CRISISCONNECT BACKEND HEALTH CHECK")
print("=" * 50)

# 1. App startup
print("\n[1] App startup...")
try:
    from app import create_app
    app = create_app()
    app.config["TESTING"] = True
    c = app.test_client()
    print("    " + PASS + " - App created successfully")
except Exception as e:
    print("    " + FAIL + " - " + str(e))
    traceback.print_exc()
    raise SystemExit(1)

results = []

def check(label, r, expected_status, extra_check=None):
    d = r.get_json()
    ok = (r.status_code == expected_status)
    if ok and extra_check:
        ok = extra_check(d)
    tag = PASS if ok else FAIL
    print(f"    {tag} - {r.status_code}" + (f" | {json.dumps(d)[:120]}" if not ok else ""))
    results.append(ok)
    return d

# 2. GET /
print("\n[2] GET / ...")
r = c.get("/")
d = check("/", r, 200, lambda d: d.get("status") == "running")
if d and d.get("status") == "running":
    print(f"         version={d.get('version')} | endpoints={len(d.get('endpoints', []))}")

# 3. GET /health
print("\n[3] GET /health ...")
r = c.get("/health")
d = check("/health", r, 200, lambda d: d.get("status") == "ok")
if d and d.get("status") == "ok":
    print(f"         message={d.get('message')}")

# 4. Blueprint: disasters_bp — list
print("\n[4] GET /disasters/ (blueprint: disasters_bp) ...")
r = c.get("/disasters/")
d = check("/disasters/", r, 200, lambda d: d.get("status") == "success")
if d and d.get("status") == "success":
    print(f"         {len(d.get('data', []))} disaster records returned")

# 5. Blueprint: disasters_bp — single
print("\n[5] GET /disasters/1 ...")
r = c.get("/disasters/1")
d = check("/disasters/1", r, 200, lambda d: d.get("status") == "success")
if d and d.get("status") == "success":
    print(f"         type={d['data'].get('type')} severity={d['data'].get('severity')}")

# 6. Blueprint: disasters_bp — 404
print("\n[6] GET /disasters/999 (not found) ...")
r = c.get("/disasters/999")
d = check("/disasters/999", r, 404, lambda d: d.get("status") == "error")
if d and d.get("status") == "error":
    print(f"         message={d.get('message')}")

# 7. Blueprint: disaster_bp — analyze
print("\n[7] POST /api/disaster/analyze (blueprint: disaster_bp) ...")
r = c.post("/api/disaster/analyze", json={
    "type": "earthquake", "severity": 7, "location": [28.6, 77.2], "population_density": 500
})
d = check("/api/disaster/analyze", r, 200, lambda d: d.get("status") == "success")
if d and d.get("status") == "success":
    print(f"         keys={list(d['data'].keys())}")

# 8. Blueprint: simulation_bp — valid
print("\n[8] POST /simulate (blueprint: simulation_bp) ...")
r = c.post("/simulate", json={
    "type": "flood", "severity": 5, "location": [19.07, 72.87], "population_density": 400
})
d = check("/simulate", r, 200, lambda d: d.get("status") == "success")
if d and d.get("status") == "success":
    print(f"         keys={list(d['data'].keys())}")

# 9. Validation guard
print("\n[9] POST /simulate empty payload (validation guard) ...")
r = c.post("/simulate", json={})
d = check("/simulate (empty)", r, 400, lambda d: "errors" in d)
if d and "errors" in d:
    print(f"         {len(d['errors'])} validation error(s) returned")

# Summary
print("\n" + "=" * 50)
passed = sum(results)
total = len(results)
print(f"RESULT: {passed}/{total} checks passed")
if passed == total:
    print("STATUS: ALL SYSTEMS GO")
else:
    print("STATUS: ISSUES FOUND")
print("=" * 50)
