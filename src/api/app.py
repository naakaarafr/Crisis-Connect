from flask import Flask
from src.api.routes import api_routes

def create_app():
    app = Flask(__name__)

    app.register_blueprint(api_routes)

    return app