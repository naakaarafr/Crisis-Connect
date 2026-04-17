import math


class RouteModel:
    """
    Lightweight graph-free router.
    Given a list of [lat, lon] waypoints, computes the shortest
    Haversine-ordered path between source and target indices.
    """

    @staticmethod
    def _haversine(p1, p2):
        R = 6371.0
        lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
        lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return R * 2 * math.asin(math.sqrt(a))

    def predict(self, data: dict) -> dict:
        """
        Parameters
        ----------
        data keys:
            coordinates : [[lat, lon], ...]   — ordered list of nodes
            source      : int | str            — index or label of origin
            target      : int | str            — index or label of destination

        Returns
        -------
        dict: path (list of [lat,lon]), distance_km, estimated_time_hours
        """
        coords = data.get("coordinates", [])
        if not coords or len(coords) < 2:
            return {"error": "At least 2 coordinate pairs required"}

        # Accept int indices or cast string ints
        try:
            src = int(data.get("source", 0))
            tgt = int(data.get("target", len(coords) - 1))
        except (ValueError, TypeError):
            src, tgt = 0, len(coords) - 1

        src = max(0, min(src, len(coords) - 1))
        tgt = max(0, min(tgt, len(coords) - 1))

        # Greedy nearest-neighbour from src toward tgt
        visited = set()
        path = [coords[src]]
        visited.add(src)
        current = src

        while current != tgt:
            remaining = [i for i in range(len(coords)) if i not in visited]
            if not remaining:
                break
            # Prefer nodes closer to target
            nxt = min(remaining, key=lambda i: self._haversine(coords[i], coords[tgt]))
            path.append(coords[nxt])
            visited.add(nxt)
            current = nxt

        total_km = sum(
            self._haversine(path[i], path[i + 1]) for i in range(len(path) - 1)
        )
        # Assume average vehicle speed 60 km/h
        estimated_hours = round(total_km / 60.0, 2)

        return {
            "path": path,
            "distance_km": round(total_km, 2),
            "estimated_time_hours": estimated_hours
        }
