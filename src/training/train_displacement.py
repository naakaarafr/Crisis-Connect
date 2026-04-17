from src.data.war_data_loader import load_ged_data
from src.models.displacement_model import DisplacementModel

def run_training():
    print("Loading GED data...")
    df = load_ged_data("data/raw/GEDEvent_v25_1.csv")
    
    print(f"Data loaded. Processing {len(df)} groups...")
    
    X = df[["conflict_intensity", "population", "infra_score"]]
    y = df["displaced"]
    
    print("Training Displacement Model (War module)...")
    model = DisplacementModel()
    model.train(X, y)
    
    save_path = "models/displacement_model.pkl"
    model.save(save_path)
    print(f"Successfully saved to {save_path}")

if __name__ == "__main__":
    run_training()
