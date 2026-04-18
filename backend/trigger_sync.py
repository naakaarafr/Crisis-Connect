import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.disaster_service import sync_external_data
from app.database import init_db

def run_sync():
    print("Initializing DB...")
    init_db()
    print("Triggering Worldwide Real-Time Sync...")
    count = sync_external_data()
    print(f"Sync complete. Added {count} new worldwide events to the database.")

if __name__ == "__main__":
    run_sync()
