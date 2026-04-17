import pytest
from src.api.app import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_predict_endpoint_missing_fields(client):
    # Test that missing required fields correctly raises a 500 error from validation
    response = client.post("/predict", json={
        "severity_score": 10
        # intentionally missing other required fields
    })
    
    assert response.status_code == 500
    assert b"error" in response.data
