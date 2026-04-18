"""
backend/tests/test_integration.py
================================
Refactored integration test suite for the unified architecture.
Tests the connection between the backend Flask API and the root ML modules.
"""

import pytest
import json
from app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """Test standard health endpoint."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"

def test_model_health_check(client):
    """Test that all ML models are loaded correctly at startup."""
    r = client.get("/health/models")
    assert r.status_code == 200
    data = r.get_json()
    assert data["status"] == "ok"
    # Check that real models are ready
    assert data["models"]["displacement_xgb"]["ready"] is True
    assert data["models"]["displacement_war"]["ready"] is True

def test_classic_displacement_prediction(client):
    """Test the 4-feature classic disaster model via /predict."""
    payload = {
        "severity_score": 5000,
        "risk_index": 4.5,
        "population_density": 1000,
        "infrastructure_index": 0.6
    }
    r = client.post("/predict", json=payload)
    assert r.status_code == 200
    data = r.get_json()
    assert "displacement" in data
    assert "risk_level" in data
    assert data["displacement"] > 0

def test_war_displacement_prediction(client):
    """Test the 3-feature war model via /predict (using aliases)."""
    payload = {
        "conflict_intensity": 20,
        "population": 75000,
        "infra_score": 0.5
    }
    r = client.post("/predict", json=payload)
    assert r.status_code == 200
    data = r.get_json()
    assert "displacement" in data
    assert data["displacement"] > 0

def test_full_pipeline_intelligence(client):
    """Test the 5-model unified pipeline endpoint."""
    payload = {
        "conflict_intensity": 25,
        "population": 80000,
        "infra_score": 0.35,
        "lat": 28.6139,
        "lon": 77.2090,
        "wind_speed": 15,
        "wind_dir": 120,
        "current_speed": 2.5,
        "current_dir": 90,
        "time_hours": 36,
        "coordinates": [[28.6139, 77.2090], [28.65, 77.25]],
        "source": 0,
        "target": 1,
        "displaced_people": 12000,
        "severity": 8.0,
        "disaster_type": "flood"
    }
    r = client.post("/predict-full", json=payload)
    assert r.status_code == 200
    data = r.get_json()
    assert data["pipeline"] == "CrisisConnect Full Intelligence"
    assert "displacement" in data
    assert "drift" in data
    assert "hotspots" in data
    assert "route" in data
    assert "risk" in data
    assert data["steps_run"] == 5

def test_validation_error(client):
    """Test that out-of-range coordinates return a 422 error."""
    payload = {
        "lat": 999.0, # Impossible latitude
        "lon": 77.2,
        "wind_speed": 10, "wind_dir": 90, "current_speed": 1, "current_dir": 0, "time_hours": 5
    }
    r = client.post("/predict-drift", json=payload)
    assert r.status_code == 422
    assert "Latitude must be between -90 and 90" in r.get_json()["message"]

def test_realtime_status_polling(client):
    """Test that we can poll the real-time simulation cache."""
    r = client.get("/realtime/status")
    assert r.status_code == 200
    data = r.get_json()
    assert "scheduler_jobs" in data
    assert "cache_keys" in data
