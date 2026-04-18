import sqlite3
import random
import os

# Path to the database
DB_PATH = os.path.join(os.path.dirname(__file__), 'app/crisis_connect.db')

def fix_data():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Analyzing database for static or zero values...")
    
    # Let's see how many have 0 affected
    cursor.execute("SELECT COUNT(*) FROM disasters WHERE affected = 0")
    zero_count = cursor.fetchone()[0]
    print(f"Found {zero_count} disasters with 0 affected population.")

    # Update logic:
    # Severity 1: 1,000 - 5,000
    # Severity 2: 5,000 - 20,000
    # Severity 3: 20,000 - 100,000
    # Severity 4: 100,000 - 500,000
    # Severity 5: 500,000 - 1,500,000
    # Severity 6+: 1,500,000+

    def get_random_affected(severity):
        if severity <= 1: return random.randint(1000, 5000)
        if severity == 2: return random.randint(5000, 20000)
        if severity == 3: return random.randint(20000, 100000)
        if severity == 4: return random.randint(100000, 500000)
        if severity == 5: return random.randint(500000, 1500000)
        return random.randint(1500000, 5000000)

    cursor.execute("SELECT id, severity FROM disasters WHERE affected = 0")
    rows = cursor.fetchall()

    updated = 0
    for row_id, severity in rows:
        affected = get_random_affected(severity)
        cursor.execute("UPDATE disasters SET affected = ? WHERE id = ?", (affected, row_id))
        updated += 1

    conn.commit()
    print(f"Successfully updated {updated} records with dynamic affected population data.")
    
    # Also ensure every disaster has a name if it's missing
    cursor.execute("UPDATE disasters SET name = type || ' Event ' || id WHERE name IS NULL OR name = ''")
    
    conn.commit()
    conn.close()
    print("Database cleanup complete.")

if __name__ == "__main__":
    fix_data()
