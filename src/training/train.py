import pandas as pd
from xgboost import XGBRegressor
import pickle

from src.data.data_loader import load_data
from src.data.feature_engineer import create_features

def train():
    disasters, displacement = load_data()
    df = create_features(disasters, displacement)

    X = df[[
        "severity_score",
        "risk_index",
        "population_density",
        "infrastructure_index"
    ]]
    
    y = df["displaced_percentage"]

    model = XGBRegressor(
        n_estimators=500,
        max_depth=8,
        learning_rate=0.05
    )

    model.fit(X, y)

    pickle.dump(model, open("models/displacement_xgb.pkl", "wb"))

if __name__ == "__main__":
    train()