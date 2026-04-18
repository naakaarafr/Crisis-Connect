import logging

from flask import Blueprint, jsonify, request

from app.services.disaster_service import (
    add_disaster,
    calculate_impact,
    get_all_disasters,
    get_disaster_by_id,
)
from app.services.displacement_service import calculate_displacement
from app.services.hotspot_service import detect_hotspots
from app.services.resource_service import allocate_resources
from app.services.risk_service import assess_risk

logger = logging.getLogger(__name__)

disaster_bp = Blueprint('disaster', __name__)
disasters_bp = Blueprint('disasters', __name__)


@disaster_bp.route('/analyze', methods=['POST'])
def analyze_disaster():
    """Perform comprehensive analysis of a disaster scenario."""
    data = request.json or {}

    try:
        displacement = calculate_displacement(data)
        risk = assess_risk(data)
        
        # Feed high-precision ML displacement into the hotspot detector for scaled node generation
        data["displaced"] = displacement.get("estimated_displaced_persons", 0)
        hotspots = detect_hotspots(data)
        
        resources = allocate_resources(displacement.get("estimated_displaced_persons", 0))

        # Dynamically append the newly analyzed disaster to our backend datasets
        disaster_record = add_disaster(data)

        return jsonify({
            "status": "success",
            "data": {
                "id": disaster_record["id"],
                "displacement": displacement,
                "risk": risk,
                "hotspots": hotspots,
                "resources": resources
            }
        }), 200

    except Exception as e:
        logger.exception("Error in /analyze")
        return jsonify({"status": "error", "message": "Analysis failed. Please try again."}), 500


@disasters_bp.route('/', methods=['GET'])
def list_disasters():
    """Retrieve all known disasters."""
    disasters = get_all_disasters()
    return jsonify(disasters), 200


@disasters_bp.route('/<int:id>', methods=['GET'])
def get_disaster(id):
    """Retrieve a specific disaster by ID."""
    disaster = get_disaster_by_id(id)
    if not disaster:
        return jsonify({"error": f"Disaster with id {id} not found."}), 404
    return jsonify(disaster), 200


@disasters_bp.route('/<int:id>/impact', methods=['GET'])
def disaster_impact(id):
    """Calculate the estimated impact of a specific disaster."""
    impact = calculate_impact(id)
    if not impact:
        return jsonify({"error": f"Disaster with id {id} not found."}), 404
    return jsonify(impact), 200

