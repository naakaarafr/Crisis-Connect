"""
Hotspot Generation Test Suite
Tests: hotspot_service.detect_hotspots() via POST /simulate
"""
import json
import math
from app import create_app

app = create_app()
app.config["TESTING"] = True
c = app.test_client()

PASS, FAIL = "+", "!"
bugs = []
results = []

def check(test_id, description, condition, actual=None, expected=None, note=None):
    ok = bool(condition)
    results.append(ok)
    if not ok:
        bugs.append({"test": test_id, "description": description,
                     "expected": expected, "actual": actual})
    marker = PASS if ok else FAIL
    print(f"  [{marker}] {test_id}: {description}")
    if note:
        print(f"         note    : {note}")
    if not ok:
        print(f"         expected: {expected}")
        print(f"         got     : {actual}")


def haversine_km(lat1, lon1, lat2, lon2):
    """Return great-circle distance in km between two lat/lon points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def get_hotspots(location, displaced=50000, severity=7, ptype="earthquake"):
    r = c.post("/simulate", json={
        "type": ptype,
        "severity": severity,
        "population_density": 800,
        "location": location,
        "displaced": displaced
    })
    d = r.get_json()
    return r.status_code, d, (d or {}).get("data", {}).get("hotspots", [])


# Test locations covering different geographic regions
TEST_CASES = [
    {"label": "Chennai, India",      "location": [13.08, 80.27]},
    {"label": "Tokyo, Japan",        "location": [35.68, 139.69]},
    {"label": "Los Angeles, USA",    "location": [34.05, -118.24]},
    {"label": "Cape Town, S.Africa", "location": [-33.93, 18.42]},
    {"label": "Near Equator [0,0]",  "location": [0.0, 0.0]},
]

print()
print("=" * 60)
print("  HOTSPOT GENERATION TEST SUITE")
print("=" * 60)

# Run tests for each location
for idx, tc in enumerate(TEST_CASES, 1):
    label = tc["label"]
    loc   = tc["location"]
    lat_in, lon_in = loc

    print(f"\n-- [{idx}] {label} {loc} --")
    status, d, hotspots = get_hotspots(loc)

    # T1: Request succeeds
    check(f"H{idx}-01", "Response status 200",
          status == 200, status, 200)
    check(f"H{idx}-02", "Response status == 'success'",
          (d or {}).get("status") == "success", (d or {}).get("status"), "success")

    # T2: Hotspots list
    check(f"H{idx}-03", "hotspots is a list",
          isinstance(hotspots, list), type(hotspots).__name__, "list")
    check(f"H{idx}-04", "hotspots count > 0",
          len(hotspots) > 0, len(hotspots), ">0",
          note=f"{len(hotspots)} hotspot(s) generated")

    if not hotspots:
        continue

    # T3: Field presence on every hotspot
    all_has_lat  = all("lat"  in h for h in hotspots)
    all_has_lon  = all("lon"  in h for h in hotspots)
    all_has_int  = all("intensity" in h for h in hotspots)
    all_has_pop  = all("population_estimate" in h for h in hotspots)

    check(f"H{idx}-05", "All hotspots have 'lat'",         all_has_lat,  None, "lat in each")
    check(f"H{idx}-06", "All hotspots have 'lon'",         all_has_lon,  None, "lon in each")
    check(f"H{idx}-07", "All hotspots have 'intensity'",   all_has_int,  None, "intensity in each")
    check(f"H{idx}-08", "All hotspots have 'population_estimate'", all_has_pop, None, "population_estimate in each")

    # T4: Coordinate validity
    valid_coords = all(
        isinstance(h.get("lat"), (int, float)) and isinstance(h.get("lon"), (int, float))
        and -90 <= h["lat"] <= 90 and -180 <= h["lon"] <= 180
        for h in hotspots if "lat" in h and "lon" in h
    )
    check(f"H{idx}-09", "All lat/lon values are in valid global range",
          valid_coords, None, "lat in [-90,90], lon in [-180,180]")

    # T5: Proximity to input location (hotspots within ~30km of origin)
    PROXIMITY_KM = 30
    distances = [haversine_km(lat_in, lon_in, h["lat"], h["lon"])
                 for h in hotspots if "lat" in h and "lon" in h]
    all_nearby = all(d <= PROXIMITY_KM for d in distances)
    max_dist = max(distances) if distances else 0
    check(f"H{idx}-10", f"All hotspots within {PROXIMITY_KM}km of input location",
          all_nearby,
          f"max_dist={max_dist:.2f}km",
          f"<={PROXIMITY_KM}km",
          note=f"distances: {[round(d,2) for d in distances]}")

    # T6: Intensity range [0, 1]
    intensities = [h["intensity"] for h in hotspots if "intensity" in h]
    valid_intensity = all(0.0 <= i <= 1.0 for i in intensities)
    check(f"H{idx}-11", "All intensity values in [0.0, 1.0]",
          valid_intensity, intensities, "all in [0.0, 1.0]")

    # T7: Intensity proportional (sums to ~1.0)
    total_intensity = sum(intensities)
    check(f"H{idx}-12", "Intensity values sum to ~1.0 (proportional distribution)",
          abs(total_intensity - 1.0) < 0.01,
          round(total_intensity, 4), "~1.0")

    # T8: population_estimate >= 0 and is int
    pop_estimates = [h.get("population_estimate") for h in hotspots if "population_estimate" in h]
    valid_pop = all(isinstance(p, int) and p >= 0 for p in pop_estimates)
    check(f"H{idx}-13", "All population_estimate values are int >= 0",
          valid_pop, pop_estimates, "int >= 0")

    # T9: population_estimate = intensity * displaced (approximate)
    displaced = (d or {}).get("data", {}).get("summary", {}).get("displaced_population", 0)
    if displaced > 0 and intensities and pop_estimates:
        expected_total = sum(int(i * displaced) for i in intensities)
        actual_total = sum(pop_estimates)
        ratio = actual_total / displaced if displaced else 0
        check(f"H{idx}-14", "Sum of population_estimates ~ displaced_population",
              abs(ratio - 1.0) < 0.05,
              f"sum_estimates={actual_total}, displaced={displaced}, ratio={ratio:.3f}",
              "ratio ~1.0 (+/-5%)")

    print(f"         hotspots: {len(hotspots)} | "
          f"intensities: {[round(i,3) for i in intensities]} | "
          f"pop_estimates: {pop_estimates}")


# ── Stability: run same location 3x, check hotspot count consistency ──
print("\n-- [S] Stability: same input 3 runs ----------------")
loc = [28.6, 77.2]
counts = []
for run in range(3):
    _, _, hs = get_hotspots(loc)
    counts.append(len(hs))
check("HS-01", "Hotspot count > 0 across 3 runs",
      all(c > 0 for c in counts), counts, "all >0",
      note="DBSCAN is stochastic; count may vary slightly between runs")
print(f"         counts per run: {counts}")

# ── Edge: displaced=0 in body is overridden by ML pipeline ────────────────────
print("\n-- [E] Edge: displaced=0 in payload (ML always authoritative) --")
_, d_edge, hs_edge = get_hotspots([10.0, 76.0], displaced=0)
check("HE-01", "Returns hotspots even with displaced=0 in payload",
      len(hs_edge) > 0, len(hs_edge), ">0")
if hs_edge and d_edge:
    ml_displaced = (d_edge.get("data", {}) or {}).get("summary", {}).get("displaced_population", -1)
    # The simulation service always overwrites data['displaced'] with ML output,
    # so population_estimates should match ML displaced_population, NOT the raw payload value.
    pop_total = sum(h.get("population_estimate", 0) for h in hs_edge)
    check("HE-02", "population_estimates match ML displaced_population (payload displaced=0 is overridden)",
          ml_displaced >= 0 and abs(pop_total - ml_displaced) <= ml_displaced * 0.05,
          f"pop_total={pop_total}, ml_displaced={ml_displaced}",
          "pop_total ~= ml_displaced (+/-5%)",
          note="Design: simulation ML output is always authoritative over raw payload displaced value")

# ── Summary ───────────────────────────────────────────────
passed = sum(results)
total  = len(results)

print()
print("=" * 60)
print(f"  RESULT : {passed}/{total} tests passed")
if bugs:
    print(f"\n  ISSUES FOUND ({len(bugs)}):")
    for b in bugs:
        print(f"\n  * [{b['test']}] {b['description']}")
        print(f"    Expected : {b['expected']}")
        print(f"    Actual   : {b['actual']}")
else:
    print("  STATUS  : ALL HOTSPOT TESTS PASSED")
print("=" * 60)
