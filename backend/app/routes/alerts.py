from flask import Blueprint, jsonify
from app.services.disaster_service import get_all_disasters

alerts_bp = Blueprint('alerts', __name__)

@alerts_bp.route('/', methods=['GET'])
def get_alerts():
    """Retrieve severe crisis alerts based on active disasters."""
    disasters = get_all_disasters()
    
    # Filter for severe events (say, severity >= 8)
    critical_alerts = []
    for d in disasters:
        if d.get("severity", 0) >= 8:
            critical_alerts.append({
                "disaster_id": d.get("id"),
                "type": d.get("type"),
                "message": f"CRITICAL ALERT: {d.get('type')} detected at {d.get('location')} with a severity of {d.get('severity')}! Evacuation protocols recommended.",
                "level": "Red"
            })
            
    return jsonify({
        "active_alerts": len(critical_alerts),
        "alerts": critical_alerts
    }), 200
