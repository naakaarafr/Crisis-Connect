import pickle
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

class DisplacementModel:
    def __init__(self, load_path=None):
        if load_path:
            self.model = pickle.load(open(load_path, "rb"))
        else:
            self.model = XGBRegressor(
                n_estimators=500,
                max_depth=8,
                learning_rate=0.05
            )

    def train(self, X, y):
        self.model.fit(X, y)

    def predict(self, features):
        if isinstance(features, dict):
            features = pd.DataFrame([features])
        elif isinstance(features, (list, np.ndarray)):
            # If it's a flat list, reshape it
            if not hasattr(features[0], '__iter__'):
                features = np.array(features).reshape(1, -1)
            else:
                features = np.array(features)
        
        return float(self.model.predict(features)[0])

    def save(self, path="models/displacement_xgb.pkl"):
        pickle.dump(self.model, open(path, "wb"))
