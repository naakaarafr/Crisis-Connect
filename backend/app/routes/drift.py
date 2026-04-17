from flask import Blueprint, request, jsonify
from app.drift_standalone_export import DriftModel

drift_bp = Blueprint('drift', __name__)

_model = DriftModel()

REQUIRED_FIELDS = {
    "lat": (float, int),
    "lon": (float, int),
    "wind_speed": (float, int),
    "wind_dir": (float, int),
    "current_speed": (float, int),
    "current_dir": (float, int),
    "time_hours": (float, int),
}

@drift_bp.route('/predict-drift', methods=['POST'])
def predict_drift():
    """
    Ocean-physics drift prediction endpoint.

    Accepts JSON:
    {
        "lat": float,           # origin latitude
        "lon": float,           # origin longitude
        "wind_speed": float,    # km/h
        "wind_dir": float,      # degrees (0-360)
        "current_speed": float, # km/h
        "current_dir": float,   # degrees (0-360)
        "time_hours": float     # elapsed drift time
    }

    Returns:
    {
        "predicted_lat": float,
        "predicted_lon": float,
        "search_radius_km": float,
        "survival_probability": float
    }
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    errors = []
    for field, expected_types in REQUIRED_FIELDS.items():
        val = data.get(field)
        if val is None:
            errors.append(f"'{field}' is required.")
        elif not isinstance(val, expected_types):
            errors.append(f"'{field}' must be a number.")

    if errors:
        return jsonify({"status": "error", "errors": errors}), 400

    # Range guards
    if not (-90 <= data["lat"] <= 90):
        errors.append("'lat' must be between -90 and 90.")
    if not (-180 <= data["lon"] <= 180):
        errors.append("'lon' must be between -180 and 180.")
    if data["time_hours"] <= 0:
        errors.append("'time_hours' must be a positive number.")
    if errors:
        return jsonify({"status": "error", "errors": errors}), 400

    try:
        result = _model.predict(data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "message": "Drift prediction failed.", "detail": str(e)}), 500
