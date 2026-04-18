import sys
import os

# Add the backend directory to sys.path so we can import the app modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import init_db, insert_disaster, get_all_disasters, get_db_connection

def seed():
    # Ensure DB is initialized
    init_db()
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('DELETE FROM disasters') # Clear old data for clean seed
    conn.commit()
    conn.close()

    print("Seeding database with historical disasters (including hubs)...")
    
    hist_disasters = [
        {"name": "Türkiye Earthquake", "type": "Earthquake", "severity": 5, "lat": 37.5, "lng": 36.8, "affected": 2400000, "hub": "Kahramanmaraş"},
        {"name": "Bangladesh Flooding", "type": "Flood", "severity": 4, "lat": 23.8, "lng": 90.4, "affected": 890000, "hub": "Sylhet District"},
        {"name": "California Wildfire", "type": "Wildfire", "severity": 3, "lat": 34.0, "lng": -118.2, "affected": 145000, "hub": "Los Angeles County"},
        {"name": "Mozambique Cyclone", "type": "Cyclone", "severity": 4, "lat": -19.8, "lng": 34.9, "affected": 670000, "hub": "Beira Coast"},
        {"name": "Pakistan Heatwave", "type": "Heatwave", "severity": 3, "lat": 30.3, "lng": 69.3, "affected": 320000, "hub": "Jacobabad"},
        {"name": "Philippines Typhoon", "type": "Flood", "severity": 5, "lat": 12.8, "lng": 122.5, "affected": 1200000, "hub": "Leyte Bay"},
        {"name": "Peru Landslides", "type": "Earthquake", "severity": 2, "lat": -9.2, "lng": -75.0, "affected": 45000, "hub": "Huanuco Valley"}
    ]

    for d in hist_disasters:
        insert_disaster(
            d_type=d["type"],
            severity=d["severity"],
            lat=d["lat"],
            lon=d["lng"],
            name=d["name"],
            affected=d["affected"],
            hub=d["hub"]
        )
        print(f"Inserted: {d['name']} @ {d['hub']}")

    print("Seeding complete.")

if __name__ == "__main__":
    seed()
