"""
Test: Risk Model Behavior
Cases:
  1. Low severity  - Flood,          severity=3, displaced=10000
  2. High-risk     - Nuclear Accident, severity=6, displaced=20000
"""

import sys
sys.path.insert(0, ".")
from app.services.risk_service import assess_risk

SEP = "=" * 62

def manual_score(disaster_type, severity, displaced):
    """Mirror the exact algorithm in risk_service.py for verification."""
    displacement_factor = displaced / 10000.0
    base_score = int(severity + displacement_factor)
    high_risk_types = ["epidemic", "chemical spill", "radiation leak", "nuclear accident"]
    if disaster_type.strip().lower() in high_risk_types:
        base_score += 2
    return max(0, base_score)

def expected_category(risk_score, displaced):
    if risk_score >= 12 or displaced > 80000:
        return "critical"
    elif risk_score >= 7 or displaced > 30000:
        return "high"
    else:
        return "moderate"

def run_case(label, payload):
    # risk_service uses key "displaced", not "displaced_population"
    internal_payload = {
        "type":     payload["type"],
        "severity": payload["severity"],
        "displaced": payload["displaced_population"],
    }
    result = assess_risk(internal_payload)

    displaced      = payload["displaced_population"]
    severity       = payload["severity"]
    disaster_type  = payload["type"]

    exp_score    = manual_score(disaster_type, severity, displaced)
    exp_category = expected_category(exp_score, displaced)

    displacement_factor = displaced / 10000.0
    base_pre_modifier   = int(severity + displacement_factor)
    high_risk_types     = ["epidemic", "chemical spill", "radiation leak", "nuclear accident"]
    is_high_risk        = disaster_type.strip().lower() in high_risk_types
    modifier            = 2 if is_high_risk else 0

    print(SEP)
    print(f"  CASE: {label}")
    print(f"  Input: type={disaster_type!r}, severity={severity}, displaced={displaced:,}")
    print(SEP)

    # Score derivation trace
    print(f"\n  Score Derivation:")
    print(f"    displacement_factor = {displaced} / 10000 = {displacement_factor}")
    print(f"    base_score (pre-modifier) = int({severity} + {displacement_factor}) = {base_pre_modifier}")
    print(f"    high_risk_type match? {is_high_risk}  (+{modifier} modifier)")
    print(f"    final risk_score = {base_pre_modifier} + {modifier} = {exp_score}")

    # Assertions
    score_ok    = result["risk_score"]  == exp_score
    cat_ok      = result["category"]    == exp_category

    print(f"\n  Results:")
    print(f"    {'risk_score':<20} | Got {str(result['risk_score']):>4} | Expected {str(exp_score):>4} | {'PASS' if score_ok else 'FAIL'}")
    print(f"    {'category':<20} | Got {result['category']:>8} | Expected {exp_category:>8} | {'PASS' if cat_ok else 'FAIL'}")
    print(f"    {'disease_risk':<20} | {result['disease_risk']}")
    print(f"    {'overcrowding':<20} | {result['overcrowding']}")
    print(f"    {'food_shortage':<20} | {result['food_shortage']}")

    all_ok = score_ok and cat_ok
    print(f"\n  Overall: {'PASS' if all_ok else 'FAIL'}")
    return all_ok


print(SEP)
print("  RISK MODEL TEST SUITE")
print(SEP)

case1_ok = run_case(
    label="Low Severity — Flood",
    payload={"type": "Flood", "severity": 3, "displaced_population": 10000}
)

print()

case2_ok = run_case(
    label="High-Risk Disaster — Nuclear Accident",
    payload={"type": "Nuclear Accident", "severity": 6, "displaced_population": 20000}
)

print()
print(SEP)
print(f"  SUITE RESULT: {'ALL PASS' if (case1_ok and case2_ok) else 'FAILURES DETECTED'}")
print(SEP)
