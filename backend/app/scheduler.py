"""
backend/app/scheduler.py
========================
APScheduler background jobs that simulate a real-time environmental data pipeline.

No actual streaming — each job generates realistic randomised sensor readings,
runs them through the ML inference pipeline, and caches the results.

Jobs
────
1. env_update     (every 30 s)  — generate synthetic environmental snapshot
2. displacement   (every 60 s)  — run displacement model on latest env data
3. drift          (every 45 s)  — run drift model on latest env data
4. hotspot        (every 90 s)  — run DBSCAN hotspot clustering
5. full_pipeline  (every 120 s) — run the full /predict-full pipeline

Cache keys written
──────────────────
  env_snapshot        → latest synthetic environment reading
  prediction_displacement
  prediction_drift
  prediction_hotspots
  prediction_full
"""

import os
import sys
import random
import logging
import datetime

logger = logging.getLogger(__name__)

# ── Path bootstrap (needed when scheduler is imported from within the backend) ─
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app import cache  # local import — works from within backend/

# Lazy-import inference so the scheduler import order doesn't break Flask startup
def _inference():
    from src.api.inference import predict_displacement, predict_drift, predict_hotspots, predict_full
    return predict_displacement, predict_drift, predict_hotspots, predict_full

def _sync():
    from app.services.disaster_service import sync_external_data
    return sync_external_data


# ── Scenario seeds (rotate to keep demo varied) ───────────────────────────────
SCENARIOS = [
    {
        "location": "Delhi NCR",
        "lat": 28.6139, "lon": 77.2090,
        "disaster_type": "flood",
        "base_severity": 7.0,
        "base_population_density": 850,
    },
    {
        "location": "Mumbai Coast",
        "lat": 19.0760, "lon": 72.8777,
        "disaster_type": "flood",
        "base_severity": 8.0,
        "base_population_density": 1200,
    },
    {
        "location": "Chennai",
        "lat": 13.0827, "lon": 80.2707,
        "disaster_type": "storm",
        "base_severity": 6.5,
        "base_population_density": 700,
    },
    {
        "location": "Kolkata Delta",
        "lat": 22.5726, "lon": 88.3639,
        "disaster_type": "flood",
        "base_severity": 7.5,
        "base_population_density": 950,
    },
]

_scenario_index = [0]   # mutable reference so jobs can rotate it


def _pick_scenario() -> dict:
    return SCENARIOS[_scenario_index[0] % len(SCENARIOS)]


def _jitter(base: float, pct: float = 0.15) -> float:
    """Return base ± pct% random variation."""
    return round(base * (1 + random.uniform(-pct, pct)), 3)


# ── Job 1: Generate environmental snapshot ────────────────────────────────────

def job_env_update():
    """Generate a randomised but realistic environmental data snapshot."""
    scenario = _pick_scenario()

    snapshot = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
        "scenario": scenario["location"],
        "disaster_type": scenario["disaster_type"],
        # Displacement features
        "severity_score": _jitter(scenario["base_severity"] * scenario["base_population_density"]),
        "risk_index": _jitter(6.5),
        "population_density": _jitter(scenario["base_population_density"]),
        "infrastructure_index": _jitter(0.45),
        # Geo
        "lat": _jitter(scenario["lat"], 0.01),
        "lon": _jitter(scenario["lon"], 0.01),
        # Ocean / atmospheric drift
        "wind_speed": _jitter(18.0),
        "wind_dir": _jitter(135.0, 0.20),
        "current_speed": _jitter(2.2),
        "current_dir": _jitter(110.0, 0.20),
        "time_hours": random.choice([12, 24, 36, 48]),
        # Hotspot & route
        "coordinates": [
            [scenario["lat"], scenario["lon"]],
            [_jitter(scenario["lat"], 0.02), _jitter(scenario["lon"], 0.02)],
            [_jitter(scenario["lat"], 0.04), _jitter(scenario["lon"], 0.04)],
            [_jitter(scenario["lat"], 0.06), _jitter(scenario["lon"], 0.06)],
        ],
        "source": 0,
        "target": 3,
        "displaced_people": int(_jitter(scenario["base_population_density"] * 15, 0.25)),
        # Risk extras
        "severity": _jitter(scenario["base_severity"]),
    }

    cache.set("env_snapshot", snapshot)
    logger.info(f"[Scheduler] env_update → {scenario['location']}  "
                f"severity={snapshot['severity']:.1f}  time={snapshot['timestamp']}")


# ── Job 2: Displacement prediction ────────────────────────────────────────────

def job_predict_displacement():
    env = cache.get("env_snapshot")
    if not env:
        logger.warning("[Scheduler] displacement: no env snapshot yet, skipping")
        return
    try:
        predict_displacement, *_ = _inference()
        result = predict_displacement(env)
        cache.set("prediction_displacement", {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
            "scenario": env.get("scenario"),
            **result,
        })
        logger.info(f"[Scheduler] displacement → {result.get('displacement')} "
                    f"({result.get('risk_level')})")
    except Exception as e:
        logger.error(f"[Scheduler] displacement FAILED: {e}")


# ── Job 3: Drift prediction ───────────────────────────────────────────────────

def job_predict_drift():
    env = cache.get("env_snapshot")
    if not env:
        return
    try:
        _, predict_drift, *_ = _inference()
        result = predict_drift(env)
        cache.set("prediction_drift", {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
            "scenario": env.get("scenario"),
            **result,
        })
        drift = result.get("drift", {})
        logger.info(f"[Scheduler] drift → predicted_lat={drift.get('predicted_lat', '?'):.4f}  "
                    f"survival={drift.get('survival_probability', '?'):.2f}")
    except Exception as e:
        logger.error(f"[Scheduler] drift FAILED: {e}")


# ── Job 4: Hotspot clustering ─────────────────────────────────────────────────

def job_predict_hotspots():
    env = cache.get("env_snapshot")
    if not env:
        return
    try:
        _, _, predict_hotspots, _ = _inference()
        result = predict_hotspots(env)
        count = len(result.get("hotspots", []))
        cache.set("prediction_hotspots", {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
            "scenario": env.get("scenario"),
            **result,
        })
        logger.info(f"[Scheduler] hotspots → {count} clusters")
    except Exception as e:
        logger.error(f"[Scheduler] hotspots FAILED: {e}")


# ── Job 5: Full pipeline ──────────────────────────────────────────────────────

def job_predict_full():
    env = cache.get("env_snapshot")
    if not env:
        return
    # Rotate scenario after full pipeline run
    _scenario_index[0] += 1
    try:
        *_, predict_full = _inference()
        result = predict_full(env)
        cache.set("prediction_full", {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
            "scenario": env.get("scenario"),
            **result,
        })
        logger.info(f"[Scheduler] full_pipeline → steps={result.get('steps_run')}  "
                    f"time={result.get('total_time_ms')}ms  "
                    f"risk={result.get('risk', {}).get('category')}")
    except Exception as e:
        logger.error(f"[Scheduler] full_pipeline FAILED: {e}")


# ── Job 6: External Data Sync ──────────────────────────────────────────────────

def job_sync_external_data():
    """Poll external feeds and update the master disaster database."""
    try:
        sync_external_data = _sync()
        count = sync_external_data()
        logger.info(f"[Scheduler] sync_external_data → added {count} new events")
    except Exception as e:
        logger.error(f"[Scheduler] sync_external_data FAILED: {e}")


# ── Scheduler factory ─────────────────────────────────────────────────────────

_scheduler: BackgroundScheduler = None


def start(app=None):
    """
    Start the APScheduler background scheduler.
    Call once from create_app().
    Accepts optional Flask app for future app-context bound jobs.
    """
    global _scheduler
    if _scheduler and _scheduler.running:
        logger.warning("[Scheduler] already running — ignoring duplicate start()")
        return

    _scheduler = BackgroundScheduler(timezone="UTC")

    _scheduler.add_job(
        job_env_update,
        IntervalTrigger(seconds=30),
        id="env_update",
        replace_existing=True,
        next_run_time=datetime.datetime.now(datetime.timezone.utc),   # run immediately on startup
    )
    _scheduler.add_job(
        job_predict_displacement,
        IntervalTrigger(seconds=60),
        id="displacement",
        replace_existing=True,
        next_run_time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=2),
    )
    _scheduler.add_job(
        job_predict_drift,
        IntervalTrigger(seconds=45),
        id="drift",
        replace_existing=True,
        next_run_time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=3),
    )
    _scheduler.add_job(
        job_predict_hotspots,
        IntervalTrigger(seconds=90),
        id="hotspots",
        replace_existing=True,
        next_run_time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=4),
    )
    _scheduler.add_job(
        job_predict_full,
        IntervalTrigger(seconds=120),
        id="full_pipeline",
        replace_existing=True,
        next_run_time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=5),
    )
    _scheduler.add_job(
        job_sync_external_data,
        IntervalTrigger(minutes=15),
        id="sync_external_data",
        replace_existing=True,
        next_run_time=datetime.datetime.now(datetime.timezone.utc), # Run immediately on startup
    )

    _scheduler.start()
    logger.info("[Scheduler] Started — 5 jobs scheduled")


def stop():
    """Gracefully stop the scheduler (called on app teardown)."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")


def status() -> list:
    """Return a list of all scheduled jobs and their next run times."""
    if not _scheduler:
        return []
    return [
        {
            "id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        }
        for job in _scheduler.get_jobs()
    ]
