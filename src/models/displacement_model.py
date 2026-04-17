import pickle
import numpy as np
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
        features = np.array(features).reshape(1, -1)
        return float(self.model.predict(features)[0])

    def save(self, path="models/displacement_xgb.pkl"):
        pickle.dump(self.model, open(path, "wb"))
