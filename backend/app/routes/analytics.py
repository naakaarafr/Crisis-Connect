from flask import Blueprint, jsonify
from app.services.disaster_service import get_all_disasters

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/', methods=['GET'])
def get_analytics():
    """Retrieve macro-level statistical analytics on global disasters."""
    disasters = get_all_disasters()
    
    total_events = len(disasters)
    if total_events == 0:
        return jsonify({"message": "No data available."}), 200
        
    # Calculate type distributions
    type_counts = {}
    total_severity = 0
    
    for d in disasters:
        t = d.get("type", "Unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
        total_severity += d.get("severity", 0)
        
    avg_severity = round(total_severity / total_events, 2)
    
    # Identify most frequent disaster
    most_frequent = max(type_counts, key=type_counts.get)
    
    return jsonify({
        "total_active_events": total_events,
        "average_global_severity": avg_severity,
        "most_frequent_disaster": most_frequent,
        "distribution": type_counts
    }), 200
