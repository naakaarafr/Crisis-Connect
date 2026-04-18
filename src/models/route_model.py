import networkx as nx
import pickle

class RouteModel:
    def __init__(self):
        self.graph = nx.Graph()

    def build_graph(self, edges):
        """
        edges = [
            ("A", "B", distance),
            ("B", "C", distance)
        ]
        """
        for u, v, w in edges:
            self.graph.add_edge(u, v, weight=w)

    def shortest_path(self, source, target):
        """
        Returns shortest path using Dijkstra
        """
        try:
            path = nx.dijkstra_path(self.graph, source, target)
            distance = nx.dijkstra_path_length(self.graph, source, target)

            return {
                "path": path,
                "distance": distance
            }

        except nx.NetworkXNoPath:
            return {"error": "No path found"}

    def predict(self, data: dict) -> dict:
        """
        Unified ML Pipeline inference endpoint for Route prediction.
        """
        coords = data.get("coordinates", [])
        source = data.get("source", 0)
        target = data.get("target", len(coords) - 1) if coords else 0

        # Heuristic path distance if we have coordinates
        dist_km = 0
        if coords and len(coords) > 1:
            dist_km = len(coords) * 12.5 # placeholder distance logic

        return {
            "path": coords,
            "distance_km": dist_km,
            "estimated_time_hours": dist_km / 40.0 if dist_km else 0
        }

    def save(self, path="models/route_graph.pkl"):
        pickle.dump(self.graph, open(path, "wb"))

    def load(self, path="models/route_graph.pkl"):
        self.graph = pickle.load(open(path, "rb"))