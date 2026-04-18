from src.data.war_data_loader import load_ged_data
from src.models.displacement_model import DisplacementModel

df = load_ged_data("data/raw/GEDEvent_v25_1.csv")

X = df[["conflict_intensity", "population", "infra_score"]]
y = df["displaced"]

model = DisplacementModel()
model.train(X, y)

model.save("models/displacement_model.pkl")