import pickle
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split

from src.data.data_loader import load_data
from src.data.feature_engineer import create_features

def evaluate():
    disasters, displacement = load_data()
    df = create_features(disasters, displacement)

    X = df[[
        "severity_score",
        "risk_index",
        "population_density",
        "infrastructure_index"
    ]]
    
    y = df["displaced_percentage"]

    # Split data to get a test set
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Load trained model
    try:
        with open("models/displacement_xgb.pkl", "rb") as f:
            model = pickle.load(f)
    except FileNotFoundError:
        print("Model not found. Please run train.py first.")
        return

    # Generate predictions
    preds = model.predict(X_test)

    print("R2 Score:", r2_score(y_test, preds))

if __name__ == "__main__":
    evaluate()
