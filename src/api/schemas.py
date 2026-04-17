"""
src/api/schemas.py
==================
Unified request/response schema for the CrisisConnect ML pipeline.

Usage
-----
    from src.api.schemas import CrisisPayload, ValidationError

    try:
        payload = CrisisPayload.from_dict(request_data)
    except ValidationError as e:
        return {"error": str(e)}, 422

    # payload.to_displacement_features() → dict ready for XGB model
    # payload.to_drift_features()        → dict ready for DriftModel
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional


class ValidationError(ValueError):
    """Raised when incoming data fails schema validation."""


# ── Field-level casting helpers ───────────────────────────────────────────────

def _float(value, name: str, min_val: float = None, max_val: float = None) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"'{name}' must be a number, got: {value!r}")
    if min_val is not None and v < min_val:
        raise ValidationError(f"'{name}' must be >= {min_val}, got {v}")
    if max_val is not None and v > max_val:
        raise ValidationError(f"'{name}' must be <= {max_val}, got {v}")
    return v


def _int(value, name: str, min_val: int = None) -> int:
    try:
        v = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"'{name}' must be an integer, got: {value!r}")
    if min_val is not None and v < min_val:
        raise ValidationError(f"'{name}' must be >= {min_val}, got {v}")
    return v


def _coords(value, name: str = "coordinates") -> List[List[float]]:
    if not isinstance(value, list) or len(value) < 2:
        raise ValidationError(f"'{name}' must be a list of at least 2 [lat, lon] pairs")
    result = []
    for i, pair in enumerate(value):
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            raise ValidationError(f"'{name}[{i}]' must be [lat, lon]")
        result.append([
            _float(pair[0], f"{name}[{i}][lat]", -90, 90),
            _float(pair[1], f"{name}[{i}][lon]", -180, 180),
        ])
    return result


# ── Canonical request payload ─────────────────────────────────────────────────

@dataclass
class CrisisPayload:
    """
    Unified schema for all CrisisConnect API requests.
    Every field has a safe default so partial payloads work for single-model calls.

    Canonical field names
    ---------------------
    Displacement (classic): severity_score, risk_index, population_density, infrastructure_index
    Displacement (war):     conflict_intensity, population, infra_score (mapped → canonical)
    Drift:                  lat, lon, wind_speed, wind_dir, current_speed, current_dir, time_hours
    Hotspot / Route:        coordinates, source, target, displaced_people
    Risk:                   disaster_type, severity, displaced_people
    """

    # ── Displacement ──────────────────────────────────────────────────────────
    severity_score: float = 0.0          # alias: conflict_intensity
    risk_index: float = 5.0
    population_density: float = 50_000.0  # alias: population
    infrastructure_index: float = 0.6    # alias: infra_score

    # ── Drift ─────────────────────────────────────────────────────────────────
    lat: Optional[float] = None
    lon: Optional[float] = None
    wind_speed: float = 0.0
    wind_dir: float = 0.0
    current_speed: float = 0.0
    current_dir: float = 0.0
    time_hours: float = 0.0

    # ── Hotspot / Route ───────────────────────────────────────────────────────
    coordinates: Optional[List[List[float]]] = field(default=None)
    source: int = 0
    target: int = -1
    displaced_people: int = 0

    # ── Risk extras ───────────────────────────────────────────────────────────
    disaster_type: str = "default"
    severity: float = 0.0

    # ── Raw extras (passed through untouched) ─────────────────────────────────
    _raw: dict = field(default_factory=dict, repr=False)

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    def from_dict(cls, data: dict) -> "CrisisPayload":
        """
        Parse, alias-resolve, coerce, and validate a raw request dict.
        Raises ValidationError with a human-readable message on bad input.
        """
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object")

        d = data  # shorthand

        # ── Displacement: resolve aliases → canonical names ──────────────────
        severity_score = d.get("severity_score",
                                d.get("conflict_intensity", 0.0))
        population_density = d.get("population_density",
                                    d.get("population", 50_000.0))
        infrastructure_index = d.get("infrastructure_index",
                                      d.get("infra_score", 0.6))

        # ── Drift: lat/lon are optional (only required for drift/full) ────────
        lat = _float(d["lat"], "lat", -90, 90) if "lat" in d else None
        lon = _float(d["lon"], "lon", -180, 180) if "lon" in d else None

        # ── Parse coordinates ─────────────────────────────────────────────────
        raw_coords = d.get("coordinates")
        coordinates = _coords(raw_coords) if raw_coords is not None else None

        # ── Route: target defaults to last coordinate ─────────────────────────
        n_coords = len(coordinates) if coordinates else 0
        default_target = max(n_coords - 1, 0)

        return cls(
            severity_score=_float(severity_score, "severity_score", 0.0),
            risk_index=_float(d.get("risk_index", 5.0), "risk_index", 0.0),
            population_density=_float(population_density, "population_density", 0.0),
            infrastructure_index=_float(infrastructure_index, "infrastructure_index", 0.0, 1.0),
            lat=lat,
            lon=lon,
            wind_speed=_float(d.get("wind_speed", 0.0), "wind_speed", 0.0),
            wind_dir=_float(d.get("wind_dir", 0.0), "wind_dir", 0.0, 360.0),
            current_speed=_float(d.get("current_speed", 0.0), "current_speed", 0.0),
            current_dir=_float(d.get("current_dir", 0.0), "current_dir", 0.0, 360.0),
            time_hours=_float(d.get("time_hours", 0.0), "time_hours", 0.0),
            coordinates=coordinates,
            source=_int(d.get("source", 0), "source", 0),
            target=_int(d.get("target", default_target), "target", 0),
            displaced_people=_int(d.get("displaced_people", 0), "displaced_people", 0),
            disaster_type=str(d.get("disaster_type", d.get("type", "default"))).lower().strip(),
            severity=_float(d.get("severity", d.get("severity_score", 0.0)), "severity", 0.0),
            _raw=data,
        )

    # ── Feature extractors for each model ─────────────────────────────────────

    def has_war_features(self) -> bool:
        return "conflict_intensity" in self._raw

    def to_displacement_features_war(self) -> List[float]:
        """3-feature vector for DisplacementModel (war variant)."""
        return [self.severity_score, self.population_density, self.infrastructure_index]

    def to_displacement_features_xgb(self) -> dict:
        """4-feature dict for XGBRegressor (classic disaster variant)."""
        return {
            "severity_score": self.severity_score,
            "risk_index": self.risk_index,
            "population_density": self.population_density,
            "infrastructure_index": self.infrastructure_index,
        }

    def to_drift_features(self) -> dict:
        """Dict expected by DriftModel.predict()."""
        return {
            "lat": self.lat,
            "lon": self.lon,
            "wind_speed": self.wind_speed,
            "wind_dir": self.wind_dir,
            "current_speed": self.current_speed,
            "current_dir": self.current_dir,
            "time_hours": self.time_hours,
        }

    def to_risk_features(self) -> dict:
        """Dict expected by SecondaryRiskModel.predict()."""
        return {
            "disaster_type": self.disaster_type,
            "severity": self.severity or self.severity_score,
            "displaced_people": self.displaced_people,
        }

    def has_drift_features(self) -> bool:
        return self.lat is not None and self.lon is not None and self.time_hours > 0

    def has_route_features(self) -> bool:
        return self.coordinates is not None and len(self.coordinates) >= 2


# ── Canonical response envelope ───────────────────────────────────────────────

def make_response(
    displacement: float = 0.0,
    risk_level: str = "LOW",
    drift: dict = None,
    hotspots: list = None,
    route: dict = None,
    risk_score: float = 0.0,
    risk: dict = None,
) -> dict:
    """
    Build the canonical response envelope.

    Shape
    -----
    {
        "displacement": float,
        "risk_level": "LOW" | "MEDIUM" | "HIGH",
        "drift": { predicted_lat, predicted_lon, search_radius_km, survival_probability },
        "hotspots": { hotspots: [...], count: int },
        "route": { path, distance_km, estimated_time_hours },
        "risk_score": float,
        "risk": { risk_score, category, level, disease_risk, overcrowding, food_shortage }
    }
    """
    return {
        "displacement": round(float(displacement), 2),
        "risk_level": risk_level,
        "drift": drift or {},
        "hotspots": hotspots or [],
        "route": route or {},
        "risk_score": round(float(risk_score), 2),
        "risk": risk or {},
    }


# ── Per-endpoint required-field contracts ─────────────────────────────────────

DISPLACEMENT_REQUIRED: List[str] = []            # all have defaults; both variants accepted
DRIFT_REQUIRED: List[str] = [
    "lat", "lon", "wind_speed", "wind_dir",
    "current_speed", "current_dir", "time_hours"
]
HOTSPOT_REQUIRED: List[str] = ["coordinates"]
ROUTE_REQUIRED: List[str] = ["coordinates"]
RISK_REQUIRED: List[str] = []                    # all have safe defaults
FULL_REQUIRED: List[str] = []                    # union; individual models skip gracefully


def validate_required(data: dict, required_fields: List[str]) -> List[str]:
    """Return list of any missing required fields."""
    return [f for f in required_fields if f not in data]
