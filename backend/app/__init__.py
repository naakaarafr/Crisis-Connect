import logging
from flask import Flask, jsonify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)


import os

def create_app():
    """Application factory — create and configure the Flask app."""
    # Serve the frontend build seamlessly
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
    app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    @app.after_request
    def add_header(r):
        """Force browser not to cache static files during development."""
        r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        r.headers["Pragma"] = "no-cache"
        r.headers["Expires"] = "0"
        return r


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
        # Connect frontend natively to the root
        return app.send_static_file('index.html')

    @app.route('/<path:filename>')
    def static_files(filename):
        # Fallback router for frontend pages (e.g., displacement.html)
        return app.send_static_file(filename)

    return app

