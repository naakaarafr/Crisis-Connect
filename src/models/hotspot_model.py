import numpy as np
from sklearn.cluster import DBSCAN


class HotspotModel:
    def __init__(self):
        self.db = DBSCAN(eps=0.03, min_samples=3)

    def predict(self, coordinates: list, displaced_population: int = 0) -> list:
        """
        Cluster a list of [lat, lon] coordinate pairs with DBSCAN
        and return hotspot centres with intensity scores.

        Parameters
        ----------
        coordinates : [[lat, lon], ...]   — at least 3 points recommended
        displaced_population : int        — total displaced people (optional)

        Returns
        -------
        list of dicts: {lat, lon, intensity, population_estimate}
        """
        if not coordinates or len(coordinates) < 1:
            return []

        points = np.array(coordinates)
        labels = self.db.fit_predict(points)

        valid_clusters = [k for k in set(labels) if k != -1]

        # Fallback: if everything is noise, return the centroid
        if not valid_clusters:
            centroid = points.mean(axis=0)
            return [{
                "lat": float(centroid[0]),
                "lon": float(centroid[1]),
                "intensity": 1.0,
                "population_estimate": int(displaced_population)
            }]

        total_valid = sum(1 for l in labels if l != -1)
        hotspots = []

        for k in valid_clusters:
            mask = labels == k
            cluster = points[mask]
            intensity = len(cluster) / float(total_valid)
            centre = cluster.mean(axis=0)
            hotspots.append({
                "lat": float(centre[0]),
                "lon": float(centre[1]),
                "intensity": round(float(intensity), 3),
                "population_estimate": int(intensity * displaced_population)
            })

        return sorted(hotspots, key=lambda h: h["intensity"], reverse=True)
