import pandas as pd
import numpy as np
import pickle

from src.models.drift_model import DriftModel


def generate_synthetic_drift_data(n_samples=1000):
    """
    Generate synthetic drift data for training / simulation
    (since real ocean drift datasets are hard to get)
    """

    data = []

    for _ in range(n_samples):
        lat = np.random.uniform(-30, 30)
        lon = np.random.uniform(0, 180)

        wind_speed = np.random.uniform(5, 50)
        wind_dir = np.random.uniform(0, 360)

        current_speed = np.random.uniform(1, 10)
        current_dir = np.random.uniform(0, 360)

        time_hours = np.random.uniform(1, 72)

        data.append({
            "lat": lat,
            "lon": lon,
            "wind_speed": wind_speed,
            "wind_dir": wind_dir,
            "current_speed": current_speed,
            "current_dir": current_dir,
            "time_hours": time_hours
        })

    return pd.DataFrame(data)


def train():
    print("Generating synthetic drift data...")

    df = generate_synthetic_drift_data()

    print("Sample data:")
    print(df.head())

    # Initialize model
    model = DriftModel()

    print("\nDrift model uses physics-based prediction.")
    print("No ML training required at this stage.")

    # Save placeholder (optional, for structure consistency)
    with open("models/drift_model.pkl", "wb") as f:
        pickle.dump({"type": "physics_based_model"}, f)

    print("\nDrift model setup complete!")
    print("Saved placeholder model to models/drift_model.pkl")


if __name__ == "__main__":
    train()