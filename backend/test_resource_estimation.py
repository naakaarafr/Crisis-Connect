"""
Test: Resource Estimation Logic
Input: displaced_population = 50000
"""

import sys
sys.path.insert(0, '.')
from app.services.resource_service import allocate_resources

displaced = 50000
result = allocate_resources(displaced)

# Expected values per specification
expected_shelters  = displaced // 500   # 100
expected_food      = displaced * 2      # 100000
expected_water     = displaced * 5      # 250000
expected_medical   = displaced // 50    # 1000

# Pressure: displaced=50000 is NOT > 50000, so falls into 'medium' branch
expected_pressure  = "medium"

print("=" * 58)
print("  Resource Estimation Test  |  displaced_population = 50000")
print("=" * 58)

checks = [
    ("shelters_needed",  result["shelters_needed"],  expected_shelters),
    ("food_packets",     result["food_packets"],      expected_food),
    ("water_liters",     result["water_liters"],      expected_water),
    ("medical_kits",     result["medical_kits"],      expected_medical),
]

all_pass = True
for name, got, exp in checks:
    status = "PASS" if got == exp else "FAIL"
    if status == "FAIL":
        all_pass = False
    print(f"  {name:<18} | Got {str(got):>8} | Expected {str(exp):>8} | {status}")

# Pressure check
p_status = "PASS" if result["resource_pressure"] == expected_pressure else "FAIL"
if p_status == "FAIL":
    all_pass = False
print(f"  {'resource_pressure':<18} | Got {result['resource_pressure']:>8} | Expected {expected_pressure:>8} | {p_status}")

print("=" * 58)
print()

# Diagnose mismatches vs spec
print("DIAGNOSIS vs Specification:")
spec_multipliers = {
    "shelters_needed":  ("displaced // 500", expected_shelters),
    "food_packets":     ("displaced * 2",    expected_food),
    "water_liters":     ("displaced * 5",    expected_water),
    "medical_kits":     ("displaced // 50",  expected_medical),
}
actual_multipliers = {
    "shelters_needed":  f"displaced // 20  -> {displaced // 20}",
    "food_packets":     f"displaced * 9    -> {displaced * 9}",
    "water_liters":     f"displaced * 9    -> {displaced * 9}",
    "medical_kits":     f"displaced // 50  -> {displaced // 50}",
}
for name, (spec_expr, spec_val) in spec_multipliers.items():
    actual_str = actual_multipliers[name]
    match = result[name] == spec_val
    print(f"  {name}:")
    print(f"    Spec:   {spec_expr} = {spec_val}")
    print(f"    Code:   {actual_str}")
    print(f"    Match:  {'YES' if match else 'NO - MISMATCH'}")

print()
print(f"Overall Result: {'ALL PASS' if all_pass else 'FAILURES DETECTED'}")
