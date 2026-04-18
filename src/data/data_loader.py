import pandas as pd

def load_data():
    disasters = pd.read_csv("data/raw/emdat_disasters.csv")
    displacement = pd.read_csv("data/raw/unhcr_displacement.csv")
    population = pd.read_csv("data/raw/worldpop_density.csv")

    return disasters, displacement, population