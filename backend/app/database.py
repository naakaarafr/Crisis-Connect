import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), 'crisis_connect.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS disasters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            severity INTEGER NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def insert_disaster(d_type, severity, lat, lon):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO disasters (type, severity, lat, lon)
        VALUES (?, ?, ?, ?)
    ''', (d_type, severity, lat, lon))
    conn.commit()
    row_id = c.lastrowid
    conn.close()
    return row_id

def get_all_disasters():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM disasters')
    rows = c.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        results.append({
            "id": r['id'],
            "type": r['type'],
            "severity": r['severity'],
            "location": {"lat": r['lat'], "lon": r['lon']}
        })
    return results

def get_disaster_by_id(d_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM disasters WHERE id = ?', (d_id,))
    r = c.fetchone()
    conn.close()
    
    if r:
        return {
            "id": r['id'],
            "type": r['type'],
            "severity": r['severity'],
            "location": {"lat": r['lat'], "lon": r['lon']}
        }
    return None

def disaster_exists(d_type, lat, lon):
    conn = get_db_connection()
    c = conn.cursor()
    # Check within approximately ~10km (0.1 degree)
    c.execute('''
        SELECT id FROM disasters 
        WHERE type = ? AND ROUND(lat, 1) = ? AND ROUND(lon, 1) = ?
    ''', (d_type, round(lat, 1), round(lon, 1)))
    row = c.fetchone()
    conn.close()
    return row is not None

# Automatically assemble on cold start
init_db()
