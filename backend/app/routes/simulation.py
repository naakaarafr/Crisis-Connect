from flask import Blueprint, request, jsonify
from app.services.simulation_service import run_simulation
from app.services.disaster_service import add_disaster, ALLOWED_DISASTER_TYPES

simulation_bp = Blueprint('simulation', __name__)

# Allowed disaster types — kept in sync with ml/predict.py TYPE_ENCODING and risk_service
# The ALLOWED_DISASTER_TYPES set is now centralized in disaster_service.py


def validate_input(data):
    """
    Validate the simulation request payload.
    Returns a list of human-readable error strings (empty list when valid).
    """
    errors = []

    # type
    disaster_type = data.get("type")
    if not disaster_type:
        errors.append("'type' is required.")
    elif str(disaster_type).strip().lower() not in ALLOWED_DISASTER_TYPES:
        allowed = ", ".join(sorted(ALLOWED_DISASTER_TYPES))
        errors.append(f"'type' must be one of: {allowed}.")

    # severity
    severity = data.get("severity")
    if severity is None:
        errors.append("'severity' is required.")
    else:
        try:
            if not (1 <= float(severity) <= 10):
                errors.append("'severity' must be a number between 1 and 10.")
        except (TypeError, ValueError):
            errors.append("'severity' must be a numeric value.")

    # location
    location = data.get("location")
    if location is None:
        errors.append("'location' is required.")
    elif not isinstance(location, (list, tuple)) or len(location) != 2:
        errors.append("'location' must be an array of [lat, lon].")
    else:
        lat, lon = location
        try:
            lat, lon = float(lat), float(lon)
            if not (-90 <= lat <= 90):
                errors.append("'location[0]' (lat) must be between -90 and 90.")
            if not (-180 <= lon <= 180):
                errors.append("'location[1]' (lon) must be between -180 and 180.")
        except (TypeError, ValueError):
            errors.append("'location' values must be numeric.")

    return errors


@simulation_bp.route('/simulate', methods=['POST'])
def run():
    """Trigger a disaster simulation and return structured impact analysis."""
    data = request.json or {}

    errors = validate_input(data)
    if errors:
        return jsonify({"status": "error", "errors": errors}), 400

    try:
        result = run_simulation(data)
        disaster_record = add_disaster(data)
        result["id"] = disaster_record["id"]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "message": "Simulation failed. Please try again."}), 500


