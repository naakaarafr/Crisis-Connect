import pandas as pd

def load_ged_data(path):
    df = pd.read_csv(path)

    df = df[[
        "latitude",
        "longitude",
        "year",
        "best",
        "deaths_civilians"
    ]].dropna()

    df["conflict_intensity"] = df["best"] + df["deaths_civilians"]

    df_grouped = df.groupby(
        ["latitude", "longitude", "year"]
    ).agg({
        "conflict_intensity": "sum"
    }).reset_index()

    # Temporary features (replace later)
    df_grouped["population"] = 50000
    df_grouped["infra_score"] = 0.6

    df_grouped["displaced"] = (
        df_grouped["conflict_intensity"] * 10 +
        (1 - df_grouped["infra_score"]) * 5000
    )

    return df_grouped
