from flask import Blueprint, request, jsonify
from src.api.inference import (
    predict_displacement,
    predict_drift,
    predict_full
)

api_routes = Blueprint("api_routes", __name__)

# ==============================
# DISPLACEMENT (EXISTING)
# ==============================

@api_routes.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    try:
        result = predict_displacement(data)
        return jsonify({"displacement": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# DRIFT PREDICTION (NEW)
# ==============================

@api_routes.route("/predict-drift", methods=["POST"])
def drift():
    data = request.get_json()

    try:
        result = predict_drift(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# COMBINED MODEL (BEST FOR DEMO)
# ==============================

@api_routes.route("/predict-full", methods=["POST"])
def full():
    data = request.get_json()

    try:
        result = predict_full(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


from src.models.displacement_model import DisplacementModel

# Assuming your latest DisplacementModel takes a path based on your diff
displacement_model = DisplacementModel("models/displacement_model.pkl")

@api_routes.route("/predict_displacement", methods=["POST"])
def predict_displacement_war():
    data = request.get_json()
    
    pred = displacement_model.predict([
        data["conflict_intensity"],
        data["population"],
        data["infra_score"]
    ])

    if pred > 10000:
        risk = "HIGH"
    elif pred > 5000:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    return jsonify({
        "predicted_displacement": pred,
        "risk_level": risk
    })
