import logging
from flask import Flask, jsonify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)


def create_app():
    """Application factory — create and configure the Flask app."""
    app = Flask(__name__)

    # Enable CORS — allows the static frontend to call the API from any origin
    try:
        from flask_cors import CORS
        CORS(app, resources={r"/*": {"origins": "*"}})
    except ImportError:
        pass  # flask-cors not installed; install with: pip install flask-cors

    # Register blueprints
    from app.routes.disaster import disaster_bp, disasters_bp
    from app.routes.simulation import simulation_bp
    from app.routes.alerts import alerts_bp
    from app.routes.analytics import analytics_bp
    from app.routes.ml import ml_bp
    from app.routes.realtime import realtime_bp

    app.register_blueprint(disaster_bp, url_prefix='/api/disaster')
    app.register_blueprint(simulation_bp)
    app.register_blueprint(disasters_bp, url_prefix='/disasters')
    app.register_blueprint(alerts_bp, url_prefix='/alerts')
    app.register_blueprint(analytics_bp, url_prefix='/analytics')
    app.register_blueprint(ml_bp)
    app.register_blueprint(realtime_bp)

    # Start real-time simulation scheduler
    from app import scheduler
    scheduler.start(app)
    import atexit
    atexit.register(scheduler.stop)

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "ok", "message": "CrisisConnect API is running"}), 200

    @app.route('/', methods=['GET'])
    def index():
        return jsonify({
            "name": "CrisisConnect API",
            "version": "1.0.0",
            "status": "running",
            "endpoints": [
                "GET  /health",
                "POST /api/disaster/analyze",
                "POST /simulate",
                "GET  /disasters",
                "GET  /disasters/<id>",
                "GET  /disasters/<id>/impact",
                "GET  /alerts",
                "GET  /analytics",
                "POST /predict-drift",
                "POST /predict         — displacement",
                "POST /predict-drift   — ocean drift",
                "POST /predict-hotspots — DBSCAN clusters",
                "POST /predict-route   — evacuation route",
                "POST /predict-risk    — secondary risk",
                "POST /predict-full    — all models combined"
            ]
        }), 200

    return app

