# Schema definitions for API validation

DISPLACEMENT_SCHEMA = [
    "severity_score",
    "risk_index",
    "population_density",
    "infrastructure_index"
]

DRIFT_SCHEMA = [
    "lat",
    "lon",
    "wind_speed",
    "wind_dir",
    "current_speed",
    "current_dir",
    "time_hours"
]

HOTSPOT_SCHEMA = [
    "coordinates"
]

ROUTE_SCHEMA = [
    "source",
    "target"
]

SECONDARY_RISK_SCHEMA = [
    "population_density",
    "displaced_people",
    "infrastructure_index"
]
