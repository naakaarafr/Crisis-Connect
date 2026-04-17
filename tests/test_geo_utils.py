import pytest
import math
from src.data.geo_utils import haversine_distance

def test_haversine_distance_zero():
    # Distance between two identical points should be 0
    assert haversine_distance(15.0, 30.0, 15.0, 30.0) == 0.0

def test_haversine_distance_known():
    # 1 degree of latitude is approximately 111.19 km
    dist = haversine_distance(0.0, 0.0, 1.0, 0.0)
    assert math.isclose(dist, 111.19, rel_tol=0.01)
