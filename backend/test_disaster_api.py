"""
Disaster API Test Suite
Tests: GET /disasters, GET /disasters/<id>, GET /disasters/<id>/impact
"""
from app import create_app

app = create_app()
app.config["TESTING"] = True
c = app.test_client()

PASS = "PASS"
FAIL = "FAIL"
bugs = []
results = []

def check(test_id, description, condition, actual=None, expected=None):
    ok = bool(condition)
    tag = PASS if ok else FAIL
    results.append(ok)
    if not ok:
        bugs.append({
            "test": test_id,
            "description": description,
            "expected": expected,
            "actual": actual
        })
    marker = "✓" if ok else "✗"
    print(f"  [{marker}] {test_id}: {description}")
    if not ok:
        print(f"       Expected : {expected}")
        print(f"       Got      : {actual}")

# ─────────────────────────────────────────────
print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("  TEST SUITE — Disaster APIs")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# ─────────────────────────────────────────────
# Section 1: GET /disasters
# ─────────────────────────────────────────────
print("\n── GET /disasters ──────────────────────────")
r = c.get("/disasters/")
d = r.get_json()
disasters = d.get("data", []) if d else []

check("D-01", "Status code is 200",
      r.status_code == 200, r.status_code, 200)
check("D-02", "Response has 'status' field",
      "status" in (d or {}), list((d or {}).keys()), "'status' key present")
check("D-03", "Response status == 'success'",
      (d or {}).get("status") == "success", d.get("status") if d else None, "success")
check("D-04", "Response has 'data' list",
      isinstance(disasters, list), type(disasters).__name__, "list")
check("D-05", "At least one disaster returned",
      len(disasters) > 0, len(disasters), ">0")

if disasters:
    first = disasters[0]
    check("D-06", "Each disaster has 'id' field",
          all("id" in x for x in disasters), None, "'id' in every record")
    check("D-07", "Each disaster has 'type' field",
          all("type" in x for x in disasters), None, "'type' in every record")
    check("D-08", "Each disaster has 'severity' field",
          all("severity" in x for x in disasters), None, "'severity' in every record")
    check("D-09", "Each disaster has 'location' field",
          all("location" in x for x in disasters), None, "'location' in every record")
    check("D-10", "Location has lat and lon",
          all("lat" in x["location"] and "lon" in x["location"] for x in disasters),
          None, "lat/lon in every location")

# ─────────────────────────────────────────────
# Section 2: GET /disasters/<id>
# ─────────────────────────────────────────────
print("\n── GET /disasters/<id> ─────────────────────")

for disaster_id in [d["id"] for d in disasters]:
    r = c.get(f"/disasters/{disaster_id}")
    d2 = r.get_json()
    record = (d2 or {}).get("data", {})

    check(f"D-11-{disaster_id}", f"Status 200 for id={disaster_id}",
          r.status_code == 200, r.status_code, 200)
    check(f"D-12-{disaster_id}", f"Returned id matches requested id={disaster_id}",
          record.get("id") == disaster_id, record.get("id"), disaster_id)
    check(f"D-13-{disaster_id}", f"'type' is a non-empty string for id={disaster_id}",
          isinstance(record.get("type"), str) and len(record.get("type","")) > 0,
          record.get("type"), "non-empty string")

# Invalid id — string
r = c.get("/disasters/abc")
check("D-14", "GET /disasters/abc → 404 (invalid id type)",
      r.status_code == 404, r.status_code, 404)

# Invalid id — number not found
r = c.get("/disasters/9999")
d3 = r.get_json()
check("D-15", "GET /disasters/9999 → 404",
      r.status_code == 404, r.status_code, 404)
check("D-16", "Error response has 'status'='error'",
      (d3 or {}).get("status") == "error", (d3 or {}).get("status"), "error")
check("D-17", "Error response has 'message' field",
      "message" in (d3 or {}), list((d3 or {}).keys()), "'message' key present")

# ─────────────────────────────────────────────
# Section 3: GET /disasters/<id>/impact
# ─────────────────────────────────────────────
print("\n── GET /disasters/<id>/impact ──────────────")

for disaster in disasters:
    did = disaster["id"]
    severity = disaster["severity"]
    expected_pop = severity * 10000
    expected_radius = severity * 5

    r = c.get(f"/disasters/{did}/impact")
    d4 = r.get_json()
    impact = (d4 or {}).get("data", {})

    check(f"D-18-{did}", f"Status 200 for id={did}",
          r.status_code == 200, r.status_code, 200)
    check(f"D-19-{did}", f"'disaster_id' matches requested id={did}",
          impact.get("disaster_id") == did, impact.get("disaster_id"), did)
    check(f"D-20-{did}", f"affected_population = severity*10000 = {expected_pop}",
          impact.get("affected_population") == expected_pop,
          impact.get("affected_population"), expected_pop)
    check(f"D-21-{did}", f"radius = severity*5 = {expected_radius}",
          impact.get("radius") == expected_radius,
          impact.get("radius"), expected_radius)

# Invalid id impact
r = c.get("/disasters/9999/impact")
check("D-22", "GET /disasters/9999/impact → 404",
      r.status_code == 404, r.status_code, 404)

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
passed = sum(results)
total = len(results)

print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"  RESULT: {passed}/{total} tests passed")

if bugs:
    print(f"\n  BUGS FOUND ({len(bugs)}):")
    for b in bugs:
        print(f"\n  ● [{b['test']}] {b['description']}")
        print(f"    Expected : {b['expected']}")
        print(f"    Actual   : {b['actual']}")
else:
    print("  STATUS  : ALL TESTS PASSED — No bugs found")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
