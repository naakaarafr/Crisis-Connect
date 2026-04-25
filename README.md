# 🌍 CrisisConnect: AI-Powered Disaster Intelligence

<div align="center">

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Render-brightgreen?style=for-the-badge)](https://crisis-connect-iwx0.onrender.com/)
[![Python](https://img.shields.io/badge/Python-3.11.0-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-API-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![XGBoost](https://img.shields.io/badge/ML-XGBoost-FF6600?style=for-the-badge)](https://xgboost.readthedocs.io/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet.js-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Predicting the unpredictable. Responding at the speed of crisis.**

*A high-fidelity, real-time command center for disaster response — combining advanced ML pipelines, physics-based simulations, and live geospatial data to help save lives.*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Screenshots](#-screenshots)
- [The Intelligence Suite](#-the-intelligence-suite)
- [Real-time Command Center](#-real-time-command-center)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🧭 Overview

CrisisConnect is not a simple alert dashboard — it's a **multi-model cognitive engine** built for disaster response teams. When a crisis hits, responders need more than a map; they need predictions, optimized routes, hotspot clustering, and drift simulations running simultaneously.

Built with a clean split-service architecture (Flask REST API + vanilla JS static frontend), it is designed to run on free-tier cloud infrastructure while executing XGBoost inference, DBSCAN clustering, and physics-based ocean/wind drift models in real time.

---

## 📸 Screenshots

> **To add screenshots:** create a `screenshots/` folder in the repo root, add your images, and they will render below automatically.

| Dashboard Overview | Drift Simulation |
|:---:|:---:|
| ![Dashboard](screenshots/dashboard.png) | ![Drift](screenshots/drift.png) |

| Hotspot Clustering | Route Optimization |
|:---:|:---:|
| ![Hotspots](screenshots/hotspots.png) | ![Routes](screenshots/routes.png) |

```bash
# How to add screenshots
mkdir screenshots
# copy your images into screenshots/
git add screenshots/
git commit -m "add dashboard screenshots"
git push
```

---

## 🧠 The Intelligence Suite

CrisisConnect runs **5 specialized ML pipelines** concurrently to give responders a complete operational picture.

### 🏘 1. Displacement Prediction — XGBoost
Forecasts population movement before it happens. The model ingests conflict intensity scores, infrastructure resilience metrics, and demographic density data to output directional displacement vectors for at-risk zones. Serialized as a pickle model for fast inference via the Flask API.

### 🌊 2. Physics-Based Drift Model
Simulates the real-time trajectory of survivors, debris, or supply resources in water and wind-driven disaster scenarios. Implemented in `src/models/drift_model.py` and `src/models/geo_utils.py`, the engine integrates wind and ocean current force vectors using differential vector mathematics:

```python
dx = (wind_speed * cos(wind_rad) + current_speed * cos(current_rad)) * time_hours
dy = (wind_speed * sin(wind_rad) + current_speed * sin(current_rad)) * time_hours
new_lat = lat + (dy / 111)
new_lon = lon + (dx / (111 * cos(lat)))
```

Outputs a predicted coordinate, an expanding search radius (2 km/hr), and a survival probability that degrades over 72 hours. Available standalone via `drift_standalone_export.py` or with live weather data via `run_real_drift.py`.

### 🔥 3. Hotspot Clustering — DBSCAN
Ingests streaming alert data and automatically identifies emerging epicenters of distress without requiring a predefined number of clusters. DBSCAN correctly separates genuine crisis hotspots from isolated noise incidents, enabling targeted resource deployment.

### 🛣 4. Route Optimization — NetworkX
Builds a graph representation of the road network and applies shortest-path algorithms to calculate the most efficient supply and evacuation corridors — factoring in terrain risk scores and reported infrastructure damage to avoid routing through collapsed roads and bridges.

### ⚠️ 5. Secondary Risk Evaluator
A heuristic engine that monitors for cascading failure patterns. After a primary event (e.g., earthquake), it evaluates the conditional probability of secondary disasters — dam failures, aftershock-triggered landslides, chemical plant breaches — and surfaces them as high-priority risk advisories in the dashboard.

---

## 📡 Real-time Command Center

The dashboard integrates live geospatial data from the real world:

- **Live OSM Integration** — Dynamically fetches hospitals, police stations, fire departments, and community centers from [OpenStreetMap](https://www.openstreetmap.org/) via the **Overpass API**.
- **Adaptive Field Station Generation** — When formal infrastructure is unavailable or destroyed, the system heuristically generates ML-driven optimal coordinates for temporary medical field stations and triage zones.
- **Drift Animation** — Real-time animated visualization of drift paths rendered on Leaflet.js, updated as new environmental data arrives.
- **Live Weather Integration** — `run_real_drift.py` geocodes any country or city via Open-Meteo, fetches live wind speed and direction, then pipes that data directly into the drift physics model for on-demand 24-hour predictions.

---

## 🏗 Architecture

CrisisConnect uses a **split-service architecture** optimized for Render's free tier. The static frontend is served from a CDN while the ML-heavy backend runs as a dedicated web service. The backend API URL is injected into the frontend JS bundle at build time using `sed`, so no runtime environment config is needed post-deploy.

```
┌───────────────────────────────────────────────────────────────────┐
│                          USER  (Browser)                          │
└────────────────────────────────┬──────────────────────────────────┘
                                 │  HTTPS
                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│             Render CDN  ·  Static Site Service                    │
│              frontend/index.html  +  js/  +  css/                │
│        [ API URL baked in via sed at build time ]                 │
└────────────────────────────────┬──────────────────────────────────┘
                                 │  REST API  (JSON)
                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│        Flask API  ·  Gunicorn (-w 1)  ·  Python 3.11             │
│              Render Web Service  ·  Free Plan                     │
│                                                                   │
│   ┌──────────────────────┐     ┌───────────────────────────────┐  │
│   │      ML  Suite       │     │     Simulation Engine         │  │
│   │  XGBoost  (pkl)      │     │  drift_model.py               │  │
│   │  DBSCAN              │     │  geo_utils.py                 │  │
│   │  NetworkX            │     │  Secondary Risk Evaluator     │  │
│   └──────────┬───────────┘     └───────────────┬───────────────┘  │
│              │                                 │                  │
│              ▼                                 ▼                  │
│        /models/*.pkl              Overpass API  (OSM)             │
│                                   Open-Meteo   (Weather)         │
│                                                                   │
│   GET /health  ←──── health-check endpoint                        │
└───────────────────────────────────────────────────────────────────┘
```

**Two Render services defined in `render.yaml`:**

| Service | Type | Start Command |
|---|---|---|
| `crisis-connect-api` | Web Service (Python 3.11) | `cd backend && gunicorn -w 1 -b 0.0.0.0:$PORT run:app --timeout 120` |
| `crisis-connect-dashboard` | Static Site | `sed` injects API URL into `js/api.js`, serves `frontend/` |

---

## 📁 Project Structure

```
Crisis-Connect/
│
├── backend/                        # Flask API application
│   ├── run.py                      # App entrypoint — gunicorn target: run:app
│   └── requirements.txt            # Backend deps: xgboost, pandas,
│                                   #   scikit-learn, flask, gunicorn, networkx
│
├── src/                            # Core ML & simulation source modules
│   └── models/
│       ├── drift_model.py          # DriftModel class — wraps geo_utils physics,
│       │                           #   returns predicted_lat/lon, search_radius,
│       │                           #   survival_probability
│       └── geo_utils.py            # drift_position() — vector math for
│                                   #   lat/lon coordinate shift from
│                                   #   wind + current force vectors
│
├── frontend/                       # Static dashboard (zero build step)
│   ├── index.html                  # Main dashboard shell
│   ├── js/
│   │   └── api.js                  # REST client — BACKEND_URL_PLACEHOLDER
│   │                               #   replaced by sed at Render build time
│   └── css/                        # CSS Grid / Flexbox layout & styles
│
├── models/                         # Serialized trained ML model files
│   └── *.pkl / *.json              # XGBoost displacement model, etc.
│
├── config/                         # App configuration files
│
├── data/
│   └── raw/                        # Raw training & reference datasets
│
├── notebooks/                      # Jupyter notebooks for model dev & EDA
│
├── tests/                          # pytest test suite
│   └── test_*.py                   # testpaths configured via pytest.ini
│
├── screenshots/                    # ← Place dashboard screenshots here
│
├── drift_standalone_export.py      # Self-contained drift physics module
│                                   #   No Flask dependency — import anywhere:
│                                   #   from drift_standalone_export import DriftModel
│
├── run_real_drift.py               # CLI tool: live drift prediction
│                                   #   Geocodes location → fetches live wind
│                                   #   from Open-Meteo → runs DriftModel
│                                   #   Usage: python run_real_drift.py "Japan"
│
├── Dockerfile                      # python:3.11-slim base
│                                   #   installs gcc/g++ for XGBoost/NumPy
│                                   #   gunicorn -w 2, EXPOSE 10000
├── render.yaml                     # Render blueprint: 2-service deployment
├── requirements.txt                # Root deps: xgboost, pandas,
│                                   #   scikit-learn, flask, pytest
├── runtime.txt                     # python-3.11.0  (Render version pin)
├── pytest.ini                      # [pytest] pythonpath=. testpaths=tests
├── Makefile                        # Reserved (currently empty)
├── .gitignore
├── LICENSE                         # MIT
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Python 3.11, Flask, Gunicorn |
| **ML / Data Science** | XGBoost, Scikit-learn (DBSCAN), NetworkX, NumPy, Pandas |
| **Simulation** | Custom physics drift engine (`drift_model.py` + `geo_utils.py`) |
| **External Data APIs** | Open-Meteo (live weather + geocoding), Overpass API (OpenStreetMap) |
| **Frontend** | Vanilla JavaScript (ES6+), CSS Grid / Flexbox |
| **Mapping** | Leaflet.js, OpenStreetMap tiles |
| **Containerization** | Docker (`python:3.11-slim`, gcc/g++ build deps for XGBoost) |
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

**2. Install dependencies and start the backend**
```bash
cd backend
pip install -r requirements.txt
python run.py
```

The API starts on `http://127.0.0.1:5001`. Verify:
```bash
curl http://127.0.0.1:5001/health
```

**3. Open the frontend**

Open `frontend/index.html` directly in your browser — no build step needed. The client auto-detects the local backend.

### Live Drift Prediction CLI

Run a real-time drift simulation for any location using live weather data from Open-Meteo:

```bash
# From the repo root
pip install requests   # if not already installed
python run_real_drift.py "Japan"
python run_real_drift.py "India"
python run_real_drift.py "New Orleans"
```

Output includes predicted lat/lon after 24 hours, expanded search radius, and estimated survival probability.

### Running with Docker

```bash
# Build
docker build -t crisis-connect .

# Run
docker run -p 10000:10000 -e PORT=10000 crisis-connect
```

### Running Tests

```bash
pytest
```

---

## ☁️ Deployment

The project ships with `render.yaml` that provisions **two Render services** in one step:

**1.** Fork this repository.  
**2.** In Render, go to **New → Blueprint** and connect your fork.  
**3.** Render reads `render.yaml` and deploys both services. No manual environment variables required.

The static site build step automatically injects the live API URL:
```bash
sed -i "s|BACKEND_URL_PLACEHOLDER|https://crisis-connect-api.onrender.com|g" frontend/js/api.js
```

> **Cold start note:** Both services run on Render's free plan and spin down after inactivity. The first request after a cold start may take 30–60 seconds. Upgrade to a paid plan for always-on availability.

---

## 📄 License

Licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">

*CrisisConnect — Intelligence that moves at the speed of crisis.*

</div>
