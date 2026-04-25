# 🌍 CrisisConnect: AI-Powered Disaster Intelligence

<div align="center">

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-crisis--connect--dashboard.onrender.com-brightgreen?style=for-the-badge)](https://crisis-connect-dashboard.onrender.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-API-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![XGBoost](https://img.shields.io/badge/ML-XGBoost-FF6600?style=for-the-badge)](https://xgboost.readthedocs.io/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet.js-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Predicting the unpredictable. Responding at the speed of crisis.**

*CrisisConnect is a high-fidelity, real-time command center for disaster response — combining advanced ML pipelines, physics-based simulations, and live geospatial data to help save lives.*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The Intelligence Suite](#-the-intelligence-suite)
- [Real-time Command Center](#-real-time-command-center)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Contributors](#-contributors)
- [License](#-license)

---

## 🧭 Overview

CrisisConnect is not a simple alert dashboard — it's a **multi-model cognitive engine** built for disaster response teams. When a crisis hits, responders need more than a map; they need predictions, optimized routes, clustering of hotspots, and drift simulations running simultaneously. CrisisConnect delivers all of this in a single, unified interface deployable in minutes.

Built with a clean split-service architecture (Flask API backend + vanilla JS static frontend), it is designed to be lightweight enough to run on free-tier cloud infrastructure while powerful enough to run XGBoost inference, DBSCAN clustering, and physics-based drift models in real time.

---

## 🧠 The Intelligence Suite

CrisisConnect runs **5 specialized ML pipelines** concurrently to give responders a complete operational picture:

### 🏘 1. Displacement Prediction — XGBoost
Forecasts population movement before it happens. The model ingests conflict intensity scores, infrastructure resilience metrics, and demographic density data to output directional displacement vectors for at-risk zones. Trained on historical crisis datasets and serialized as a pickle model for fast inference.

### 🌊 2. Physics-Based Drift Model
Simulates the real-time trajectory of survivors, debris, or supply resources in water and wind-driven disaster scenarios. Built on differential vector mathematics, the drift engine integrates environmental force vectors (wind speed, current direction) with initial position data to compute probable drift paths over time. Exposed as a standalone export (`drift_standalone_export.py`) and a live runner (`run_real_drift.py`) for field use.

### 🔥 3. Hotspot Clustering — DBSCAN
Ingests streaming alert data and automatically identifies emerging epicenters of distress without requiring a predefined number of clusters. DBSCAN is ideal for this task because crisis events are inherently irregular in spatial distribution, and the algorithm correctly identifies noise (isolated incidents) versus genuine hotspot clusters that need resource deployment.

### 🛣 4. Route Optimization — NetworkX
Builds a graph representation of the road network in the affected area and applies shortest-path algorithms to calculate the most efficient survival corridors and supply routes — factoring in terrain risk scores and reported infrastructure damage to avoid routing through collapsed bridges or flooded roads.

### ⚠️ 5. Secondary Risk Evaluator
A heuristic engine that monitors for cascading failure patterns. After a primary event (e.g., an earthquake), it evaluates the conditional probability of secondary disasters — dam failures, aftershock-triggered landslides, chemical plant breaches — and flags them as high-priority risk advisories in the dashboard.

---

## 📡 Real-time Command Center

The dashboard provides a high-refresh-rate operational overview integrating live geospatial data from the real world:

- **Live OSM Integration** — Dynamically fetches hospitals, police stations, fire departments, and community centers from [OpenStreetMap](https://www.openstreetmap.org/) via the **Overpass API**, ensuring infrastructure data reflects reality, not a stale database.
- **Adaptive Field Station Generation** — When formal infrastructure is unavailable or destroyed, the system heuristically generates ML-driven optimal coordinates for temporary medical field stations and triage zones.
- **Drift Animation** — Real-time animated visualization of resource and debris drift paths using Leaflet.js polyline rendering, updated as new environmental data arrives.
- **API URL Injection at Build Time** — The Render deployment pipeline uses `sed` to inject the backend API URL into the frontend JS bundle at build time, so no environment config is needed post-deploy.

---

## 🏗 Architecture

CrisisConnect uses a **split-service architecture** optimized for free-tier cloud deployment on Render — keeping the static frontend served from a CDN while the ML-heavy backend runs on a dedicated web service.

```mermaid
graph TD
    User((👤 User)) -->|HTTPS| CDN[Render Global CDN]
    CDN -->|Static Assets| Frontend[Static Dashboard\nfrontend/index.html]
    Frontend -->|REST API Calls| Backend[Flask API Service\ngunicorn -w 1]

    subgraph "Backend Web Service — Python 3.11"
        Backend --> ML[ML Suite\nXGBoost · DBSCAN · NetworkX]
        Backend --> Sim[Simulation Engine\nDrift · Risk Evaluator]
        Backend --> Health[/health endpoint]
    end

    ML -->|Model Inference| Models[Pickle / XGBoost Models\n/models]
    Sim -->|GeoJSON Queries| OSM[Overpass API\nOpenStreetMap]
    Backend -->|Build-time Injection| EnvVar[API URL → js/api.js]
```

The backend is containerized with Docker for portability and runs Gunicorn with a 120-second timeout to handle long-running ML inference jobs without connection drops.

---

## 📁 Project Structure

```
Crisis-Connect/
├── backend/                  # Flask API application
│   ├── run.py                # App entrypoint (gunicorn target)
│   └── requirements.txt      # Backend-specific dependencies
├── config/                   # Configuration files
├── data/
│   └── raw/                  # Raw training/reference datasets
├── frontend/                 # Static dashboard (HTML/CSS/JS)
│   └── js/
│       └── api.js            # API client (URL injected at build time)
├── models/                   # Serialized ML models (pickle / XGBoost)
├── notebooks/                # Jupyter notebooks for model development
├── src/                      # Core ML & simulation source modules
├── tests/                    # pytest test suite
├── drift_standalone_export.py # Standalone drift simulation export
├── run_real_drift.py          # Live drift runner for field use
├── Dockerfile                 # Multi-stage Docker build
├── render.yaml                # Render deployment config (2 services)
├── requirements.txt           # Root-level dependencies
├── pytest.ini                 # Test configuration
└── runtime.txt                # Python version pin
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Python 3.11, Flask, Gunicorn |
| **ML / Data Science** | XGBoost, Scikit-learn (DBSCAN), NetworkX, NumPy, Pandas |
| **Simulation** | Custom physics drift engine (vector mathematics) |
| **Frontend** | Vanilla JavaScript (ES6+), CSS Grid / Flexbox |
| **Mapping** | Leaflet.js, OpenStreetMap tiles, Overpass API |
| **Containerization** | Docker (python:3.11-slim base) |
| **Deployment** | Render — Web Service (API) + Static Site (Dashboard) |
| **Testing** | pytest |

---

## 🚦 Getting Started

### Prerequisites

- Python 3.11+
- pip

### Local Development

**1. Clone the repository**
```bash
git clone https://github.com/naakaarafr/Crisis-Connect.git
cd Crisis-Connect
```

**2. Install backend dependencies and start the API**
```bash
cd backend
pip install -r requirements.txt
python run.py
```
The API will start on `http://127.0.0.1:5001`. You can verify it's running by hitting the health endpoint:
```bash
curl http://127.0.0.1:5001/health
```

**3. Open the frontend**

Simply open `frontend/index.html` in your browser. The frontend auto-detects the local backend and connects to it — no build step required.

### Running with Docker

```bash
# Build the image
docker build -t crisis-connect .

# Run the container
docker run -p 10000:10000 -e PORT=10000 crisis-connect
```

### Running Tests

```bash
pytest
```

---

## ☁️ Deployment

The project ships with a `render.yaml` that provisions **two services** on Render in a single click:

| Service | Type | Description |
|---|---|---|
| `crisis-connect-api` | Web Service (Python) | Flask + Gunicorn backend, runs ML suite |
| `crisis-connect-dashboard` | Static Site | Vanilla JS dashboard served via CDN |

**Deployment steps:**

1. Fork the repository.
2. Connect it to your [Render](https://render.com) account.
3. Render will read `render.yaml` and provision both services automatically.
4. The build step injects the backend URL (`https://crisis-connect-api.onrender.com`) into `frontend/js/api.js` at deploy time via `sed`.

No additional environment variables are required for the base deployment.

> **Note on cold starts:** The backend runs on Render's free tier, which spins down after inactivity. The first request after a cold start may take 30–60 seconds.

---

## 👥 Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/naakaarafr">
        <img src="https://github.com/naakaarafr.png" width="80px;" alt="naakaarafr"/><br />
        <sub><b>Divvyansh Kudesiaa</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/sohamshaw23">
        <img src="https://github.com/sohamshaw23.png" width="80px;" alt="sohamshaw23"/><br />
        <sub><b>Soham Shaw</b></sub>
      </a>
    </td>
  </tr>
</table>

Contributions are welcome. Open an issue or pull request to get started.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

*CrisisConnect — Intelligence that moves at the speed of crisis.*

</div>
