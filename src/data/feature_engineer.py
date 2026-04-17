import pandas as pd
import numpy as np

def create_features(disasters, displacement):
    df = disasters.merge(displacement, on="country", how="left")
    df = df.fillna(0)
    
    df["magnitude"] = df["severity"] if "severity" in df.columns else 1.0
    df["infrastructure_index"] = 0.5
    df["population_density"] = np.random.uniform(50, 500, size=len(df))
    
    df["severity_score"] = df["magnitude"] * df["affected_population"]
    df["risk_index"] = df["severity_score"] / (df["infrastructure_index"] + 1)
    df["displaced_percentage"] = (df["displaced_people"] / (df["affected_population"] + 1)) * 100
    
    return df