from sklearn.model_selection import GridSearchCV
from xgboost import XGBRegressor

from src.data.data_loader import load_data
from src.data.feature_engineer import create_features

def tune_hyperparameters():
    disasters, displacement = load_data()
    df = create_features(disasters, displacement)

    X = df[[
        "severity_score",
        "risk_index",
        "population_density",
        "infrastructure_index"
    ]]
    
    y = df["displaced_percentage"]

    params = {
        "n_estimators": [300, 500, 700],
        "max_depth": [6, 8, 10],
        "learning_rate": [0.01, 0.05, 0.1]
    }

    grid = GridSearchCV(XGBRegressor(), params, cv=3)
    grid.fit(X, y)

    print(grid.best_params_)

if __name__ == "__main__":
    tune_hyperparameters()