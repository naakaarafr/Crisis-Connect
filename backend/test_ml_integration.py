"""
ML Integration Test Suite
Tests model loading, prediction sensitivity, and hardcoding checks.
"""
import json
import importlib
import inspect
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


BASE_PAYLOAD = {
    "type": "flood",
    "population_density": 800,
    "location": [28.6, 77.2]
}

def simulate(severity):
    payload = {**BASE_PAYLOAD, "severity": severity}
    r = c.post("/simulate", json=payload)
    return r.status_code, r.get_json()

print()
print("=" * 58)
print("  ML INTEGRATION TEST — POST /simulate")
print("=" * 58)

# ── 1. Model Loading ──────────────────────────────────────
print("\n-- [1] Model Loading --------------------------------")

import app.ml.predict as predict_module

check("ML-01", "MODEL object exists in predict module",
      hasattr(predict_module, "MODEL"),
      type(getattr(predict_module, "MODEL", None)).__name__, "XGBRegressor or similar")

model = getattr(predict_module, "MODEL", None)
check("ML-02", "MODEL is not None",
      model is not None, model, "loaded model object")

check("ML-03", "MODEL has a predict() method (real sklearn-style model)",
      model is not None and hasattr(model, "predict"),
      hasattr(model, "predict"), True)

# Verify it is loaded at module level, not inside the function
src = inspect.getsource(predict_module.predict_displacement)
check("ML-04", "predict_displacement() does NOT open/load pkl per-request",
      "open(" not in src and "pickle.load" not in src,
      "pickle.load found inside function" if "pickle.load" in src else "not found",
      "pickle.load not in function body",
      note="Model must be loaded at module level only")

# ── 2. Prediction Sensitivity ─────────────────────────────
print("\n-- [2] Prediction Sensitivity (severity 3 vs 8) ----")

status3, d3 = simulate(severity=3)
status8, d8 = simulate(severity=8)

check("ML-05", "severity=3 returns 200", status3 == 200, status3, 200)
check("ML-06", "severity=8 returns 200", status8 == 200, status8, 200)

if status3 == 200 and status8 == 200:
    data3 = d3
    data8 = d8
    rate3  = data3["displacement"]["rate"]
    rate8  = data8["displacement"]["rate"]
    disp3  = data3["summary"]["displaced_population"]
    disp8  = data8["summary"]["displaced_population"]
    level3 = data3["summary"]["impact_level"]
    level8 = data8["summary"]["impact_level"]
    risk3  = data3["risk"]["category"]
    risk8  = data8["risk"]["category"]

    print(f"\n         severity=3 → rate={rate3}%  displaced={disp3:,}  impact={level3}  risk={risk3}")
    print(f"         severity=8 → rate={rate8}%  displaced={disp8:,}  impact={level8}  risk={risk8}\n")

    # Rate validity
    check("ML-07", "displacement_rate for severity=3 is 0-100",
          0 <= rate3 <= 100, rate3, "0-100")
    check("ML-08", "displacement_rate for severity=8 is 0-100",
          0 <= rate8 <= 100, rate8, "0-100")

    # Sensitivity: higher severity → higher rate
    check("ML-09", "severity=8 produces higher or equal displacement_rate than severity=3",
          rate8 >= rate3, f"rate3={rate3}, rate8={rate8}",
          "rate8 >= rate3",
          note="ML model should produce monotonically higher output for higher severity")

    # Displaced population changes significantly (at least 10% difference)
    if disp3 > 0:
        pct_change = abs(disp8 - disp3) / disp3 * 100
        check("ML-10", "displaced_population changes significantly (>=10%) between severities",
              pct_change >= 10, f"{pct_change:.1f}%", ">=10%",
              note=f"disp(3)={disp3:,}  disp(8)={disp8:,}")
    else:
        check("ML-10", "displaced_population > 0 for severity=3",
              False, disp3, ">0")

    # Impact level changes correctly
    IMPACT_ORDER = {"low": 0, "medium": 1, "high": 2}
    check("ML-11", "impact_level for severity=8 >= severity=3",
          IMPACT_ORDER.get(level8, -1) >= IMPACT_ORDER.get(level3, -1),
          f"level3={level3}, level8={level8}",
          "level8 >= level3 in [low, medium, high]")

    # Risk category escalates
    RISK_ORDER = {"moderate": 0, "high": 1, "critical": 2}
    check("ML-12", "risk.category for severity=8 >= severity=3",
          RISK_ORDER.get(risk8, -1) >= RISK_ORDER.get(risk3, -1),
          f"risk3={risk3}, risk8={risk8}", "risk8 >= risk3")

# ── 3. No Hardcoded Values ────────────────────────────────
print("\n-- [3] Hardcoded Value Check ------------------------")

import app.services.displacement_service as ds_mod
import app.services.simulation_service as sim_mod

# Displacement service should read from data dict, not literals
ds_src = inspect.getsource(ds_mod)
check("ML-13", "displacement_service uses data.get() for inputs (not hardcoded literals)",
      "data.get(" in ds_src, None, "data.get() present in source")

# Simulation service should read type/severity/population from data
sim_src = inspect.getsource(sim_mod)
check("ML-14", "simulation_service reads 'type' from payload",
      "data.get('type'" in sim_src or 'data.get("type"' in sim_src,
      None, "data.get('type') in source")
check("ML-15", "simulation_service reads 'severity' from payload",
      "data.get('severity'" in sim_src or 'data.get("severity"' in sim_src,
      None, "data.get('severity') in source")
check("ML-16", "simulation_service reads 'population_density' from payload",
      "data.get('population_density'" in sim_src or 'data.get("population_density"' in sim_src,
      None, "data.get('population_density') in source")

# TYPE_ENCODING in predict should be a dict (not if/elif chains)
predict_src = inspect.getsource(predict_module)
check("ML-17", "TYPE_ENCODING dictionary exists in predict module (not if/elif chain)",
      "TYPE_ENCODING" in predict_src, None, "TYPE_ENCODING in source")

# ── Summary ───────────────────────────────────────────────
passed = sum(results)
total = len(results)

print()
print("=" * 58)
print(f"  RESULT : {passed}/{total} tests passed")

if bugs:
    print(f"\n  ISSUES FOUND ({len(bugs)}):")
    for b in bugs:
        print(f"\n  * [{b['test']}] {b['description']}")
        print(f"    Expected : {b['expected']}")
        print(f"    Actual   : {b['actual']}")
else:
    print("  STATUS  : ML INTEGRATION VERIFIED — No issues found")
print("=" * 58)
