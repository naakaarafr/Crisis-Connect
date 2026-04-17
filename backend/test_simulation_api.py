"""
Simulation API Test Suite
Endpoint: POST /simulate
"""
import json
from app import create_app

app = create_app()
app.config["TESTING"] = True
c = app.test_client()

PASS, FAIL = "PASS", "FAIL"
bugs = []
results = []

TEST_INPUT = {
    "type": "Flood",
    "severity": 8,
    "population_density": 1200,
    "location": [12.9, 80.2]
}

# Expected schema map: key -> (type, required sub-keys or None)
EXPECTED_SCHEMA = {
    "summary": {
        "affected_population": (int,),
        "displaced_population": (int,),
        "impact_level": (str,)
    },
    "displacement": {
        "rate": (float, int)
    },
    "hotspots": None,       # list — validated separately
    "resources": {
        "shelters_needed": (int,),
        "food_packets": (int,),
        "water_liters": (int,),
        "medical_kits": (int,),
        "resource_pressure": (str,)
    },
    "risk": {
        "risk_score": (int,),
        "category": (str,),
        "disease_risk": (str,),
        "overcrowding": (bool,),
        "food_shortage": (bool,)
    }
}

IMPACT_LEVELS = {"low", "medium", "high"}
RISK_CATEGORIES = {"moderate", "high", "critical"}
DISEASE_RISK_LEVELS = {"low", "medium", "high"}
RESOURCE_PRESSURE_LEVELS = {"low", "medium", "high"}


def check(test_id, description, condition, actual=None, expected=None):
    ok = bool(condition)
    results.append(ok)
    if not ok:
        bugs.append({"test": test_id, "description": description,
                     "expected": expected, "actual": actual})
    marker = "+" if ok else "!"
    print(f"  [{marker}] {test_id}: {description}")
    if not ok:
        print(f"        Expected : {expected}")
        print(f"        Got      : {actual}")


print()
print("=" * 55)
print("  SIMULATION API TEST — POST /simulate")
print("=" * 55)
print(f"\n  Input: {json.dumps(TEST_INPUT)}\n")

# ── Request & outer envelope ──────────────────────────────
print("── [A] HTTP & Envelope ─────────────────────────────")
r = c.post("/simulate", json=TEST_INPUT)
d = r.get_json()

check("S-A1", "Status code is 200",
      r.status_code == 200, r.status_code, 200)
check("S-A2", "Response is valid JSON",
      d is not None, type(d).__name__, "dict")

if d is None:
    print("\n  FATAL: No JSON response returned. Aborting.")
    raise SystemExit(1)

check("S-A3", "Top-level 'status' == 'success'",
      d.get("status") == "success", d.get("status"), "success")
check("S-A4", "Top-level 'data' key exists",
      "data" in d, list(d.keys()), "contains 'data'")

data = d.get("data", {})

# ── Top-level section keys ────────────────────────────────
print("\n── [B] Top-level Section Keys ──────────────────────")
for section in ["summary", "displacement", "hotspots", "resources", "risk"]:
    check(f"S-B-{section}", f"Section '{section}' present",
          section in data, list(data.keys()), f"contains '{section}'")

# ── Summary ───────────────────────────────────────────────
print("\n── [C] summary ────────────────────────────────────")
summary = data.get("summary", {})
check("S-C1", "summary.affected_population is int",
      isinstance(summary.get("affected_population"), int),
      type(summary.get("affected_population")).__name__, "int")
check("S-C2", "summary.affected_population > 0",
      (summary.get("affected_population") or 0) > 0,
      summary.get("affected_population"), ">0")
check("S-C3", "summary.displaced_population is int",
      isinstance(summary.get("displaced_population"), int),
      type(summary.get("displaced_population")).__name__, "int")
check("S-C4", "summary.displaced_population <= affected_population",
      summary.get("displaced_population", 0) <= summary.get("affected_population", 0),
      summary.get("displaced_population"), "<= affected_population")
check("S-C5", "summary.impact_level in {low, medium, high}",
      summary.get("impact_level") in IMPACT_LEVELS,
      summary.get("impact_level"), str(IMPACT_LEVELS))

# ── Displacement ──────────────────────────────────────────
print("\n── [D] displacement ───────────────────────────────")
displacement = data.get("displacement", {})
rate = displacement.get("rate")
check("S-D1", "displacement.rate exists",
      rate is not None, rate, "not None")
check("S-D2", "displacement.rate is numeric",
      isinstance(rate, (int, float)),
      type(rate).__name__, "int or float")
check("S-D3", "displacement.rate is between 0 and 100",
      rate is not None and 0 <= rate <= 100,
      rate, "0 <= rate <= 100")

# ── Hotspots ──────────────────────────────────────────────
print("\n── [E] hotspots ───────────────────────────────────")
hotspots = data.get("hotspots", [])
check("S-E1", "hotspots is a list",
      isinstance(hotspots, list), type(hotspots).__name__, "list")
check("S-E2", "hotspots list is not empty",
      len(hotspots) > 0, len(hotspots), ">0")

if hotspots:
    all_lat = all("lat" in h for h in hotspots)
    all_lon = all("lon" in h for h in hotspots)
    all_intensity = all("intensity" in h for h in hotspots)
    all_pop = all("population_estimate" in h for h in hotspots)
    check("S-E3", "Every hotspot has 'lat'", all_lat, None, "'lat' in each")
    check("S-E4", "Every hotspot has 'lon'", all_lon, None, "'lon' in each")
    check("S-E5", "Every hotspot has 'intensity' (float 0-1)",
          all_intensity and all(0 <= h["intensity"] <= 1 for h in hotspots),
          [h.get("intensity") for h in hotspots], "float in [0,1]")
    check("S-E6", "Every hotspot has 'population_estimate' (int >= 0)",
          all_pop and all(isinstance(h["population_estimate"], int) and h["population_estimate"] >= 0
                         for h in hotspots),
          [h.get("population_estimate") for h in hotspots], "int >= 0")
    check("S-E7", "Hotspot lat values in valid range [-90, 90]",
          all(-90 <= h["lat"] <= 90 for h in hotspots if "lat" in h),
          None, "all lats in [-90, 90]")
    check("S-E8", "Hotspot lon values in valid range [-180, 180]",
          all(-180 <= h["lon"] <= 180 for h in hotspots if "lon" in h),
          None, "all lons in [-180, 180]")
    total_intensity = sum(h["intensity"] for h in hotspots if "intensity" in h)
    check("S-E9", "Sum of hotspot intensities approx == 1.0 (proportional)",
          abs(total_intensity - 1.0) < 0.01,
          round(total_intensity, 4), "~1.0")

# ── Resources ──────────────────────────────────────────────
print("\n-- [F] resources --")
resources = data.get("resources", {})
for field in ["shelters_needed", "food_packets", "water_liters", "medical_kits"]:
    val = resources.get(field)
    check(f"S-F-{field}", f"resources.{field} is int >= 0",
          isinstance(val, int) and val >= 0, val, "int >= 0")
check("S-F-pressure", "resources.resource_pressure in {low, medium, high}",
      resources.get("resource_pressure") in RESOURCE_PRESSURE_LEVELS,
      resources.get("resource_pressure"), str(RESOURCE_PRESSURE_LEVELS))

# ── Risk ──────────────────────────────────────────────────
print("\n-- [G] risk --")
risk = data.get("risk", {})
check("S-G1", "risk.risk_score is int >= 0",
      isinstance(risk.get("risk_score"), int) and risk.get("risk_score", -1) >= 0,
      risk.get("risk_score"), "int >= 0")
check("S-G2", "risk.category in {moderate, high, critical}",
      risk.get("category") in RISK_CATEGORIES,
      risk.get("category"), str(RISK_CATEGORIES))
check("S-G3", "risk.disease_risk in {low, medium, high}",
      risk.get("disease_risk") in DISEASE_RISK_LEVELS,
      risk.get("disease_risk"), str(DISEASE_RISK_LEVELS))
check("S-G4", "risk.overcrowding is bool",
      isinstance(risk.get("overcrowding"), bool),
      type(risk.get("overcrowding")).__name__, "bool")
check("S-G5", "risk.food_shortage is bool",
      isinstance(risk.get("food_shortage"), bool),
      type(risk.get("food_shortage")).__name__, "bool")

# ── Summary Report ────────────────────────────────────────
passed = sum(results)
total = len(results)

print()
print("=" * 55)
print(f"  RESULT : {passed}/{total} tests passed")
if bugs:
    print(f"\n  MISSING / FAILED FIELDS ({len(bugs)}):")
    for b in bugs:
        print(f"\n  * [{b['test']}] {b['description']}")
        print(f"    Expected : {b['expected']}")
        print(f"    Actual   : {b['actual']}")
else:
    print("  STATUS  : ALL FIELDS PRESENT AND VALID")

print()
print("  RESPONSE SNAPSHOT:")
print(json.dumps(d.get("data", {}), indent=4))
print("=" * 55)
