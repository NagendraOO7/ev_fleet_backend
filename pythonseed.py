"""
EV Telemetry Seed Script
Run this ONCE before starting your API server.
No external APIs required. All data generated locally.

Usage: python seed_telemetry.py
"""

import random
import uuid
from datetime import datetime, timedelta
from pymongo import MongoClient, ASCENDING, DESCENDING

# ========== CONFIGURATION ==========
NUM_VEHICLES = 10000
DAYS_OF_DATA = 7
INTERVAL_SECONDS = 30
MONGO_URI = "mongodb+srv://nagendrahada1609_db_user:vIAxCZSntVC0Nmh9@e3electric.ai9cg30.mongodb.net/"
DB_NAME = "e3electric"
# ===================================

def generate_vehicles(count):
    """Generate vehicle records with realistic EV data"""
    vehicles = []
    makes = ['Tesla', 'Rivian', 'Ford', 'Hyundai', 'Kia', 'BMW', 'Mercedes']
    models = {
        'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X'],
        'Rivian': ['R1T', 'R1S'],
        'Ford': ['Mustang Mach-E', 'F-150 Lightning'],
        'Hyundai': ['Ioniq 5', 'Ioniq 6', 'Kona Electric'],
        'Kia': ['EV6', 'Niro EV'],
        'BMW': ['i4', 'iX', 'i7'],
        'Mercedes': ['EQS', 'EQE', 'EQB']
    }
    battery_sizes = {
        'Tesla Model 3': 75, 'Tesla Model Y': 82, 'Tesla Model S': 100, 'Tesla Model X': 100,
        'Rivian R1T': 135, 'Rivian R1S': 135,
        'Ford Mustang Mach-E': 88, 'Ford F-150 Lightning': 98,
        'Hyundai Ioniq 5': 77, 'Hyundai Ioniq 6': 77, 'Hyundai Kona Electric': 64,
        'Kia EV6': 77, 'Kia Niro EV': 64,
        'BMW i4': 80, 'BMW iX': 105, 'BMW i7': 101,
        'Mercedes EQS': 107, 'Mercedes EQE': 90, 'Mercedes EQB': 66
    }

    for i in range(count):
        make = random.choice(makes)
        model = random.choice(models[make])
        model_key = f"{make} {model}"
        battery = battery_sizes.get(model_key, random.choice([64, 75, 82, 100, 135]))

        vehicle = {
            'id': f"EV-{i+1:05d}",
            'make': make,
            'model': model,
            'battery_capacity_kwh': battery
        }
        vehicles.append(vehicle)

    return vehicles

def generate_telemetry(vehicle_id, start_date, end_date, battery_capacity):
    """Generate realistic telemetry points for a vehicle over time"""
    points = []
    current_time = start_date
    soc = random.uniform(60, 100)
    battery_temp = 25
    odometer = random.randint(0, 50000)

    while current_time <= end_date:
        hour = current_time.hour
        is_weekday = current_time.weekday() < 5

        if is_weekday and 7 <= hour <= 9:
            activity = 'driving'
            speed = random.randint(30, 100)
            soc_change = -random.uniform(0.1, 0.5)
            battery_temp += random.uniform(-0.1, 0.3)
        elif is_weekday and 17 <= hour <= 19:
            activity = 'driving'
            speed = random.randint(20, 80)
            soc_change = -random.uniform(0.1, 0.4)
            battery_temp += random.uniform(-0.1, 0.25)
        elif 0 <= hour <= 5:
            activity = 'parked'
            speed = 0
            soc_change = -0.01
            battery_temp += random.uniform(-0.2, 0.1)
        else:
            r = random.random()
            if r < 0.6:
                activity = 'driving'
                speed = random.randint(20, 120)
                soc_change = -random.uniform(0.05, 0.3)
                battery_temp += random.uniform(-0.1, 0.2)
            elif r < 0.8:
                activity = 'charging'
                speed = 0
                soc_change = random.uniform(0.1, 0.6)
                battery_temp += random.uniform(-0.05, 0.15)
            else:
                activity = 'parked'
                speed = 0
                soc_change = -0.01
                battery_temp += random.uniform(-0.2, 0.05)

        soc = max(0, min(100, soc + soc_change))
        battery_temp = max(15, min(50, battery_temp))
        odometer += speed * (INTERVAL_SECONDS / 3600)

        point = {
            'id': str(uuid.uuid4()),
            'vehicle_id': vehicle_id,
            'timestamp': current_time,           # store as datetime, not isoformat string
            'soc_pct': round(soc, 1),
            'battery_temp_c': round(battery_temp, 1),
            'speed_kph': speed,
            'location_lat': 37.7749 + random.uniform(-0.5, 0.5),
            'location_lng': -122.4194 + random.uniform(-0.5, 0.5),
            'charging_status': activity
        }
        points.append(point)
        current_time += timedelta(seconds=INTERVAL_SECONDS)

    return points


def setup_database(client):
    """Drop existing collections and create indexes"""
    db = client[DB_NAME]

    # Drop existing collections (clean slate)
    db.vehicles.drop()
    db.telemetry.drop()
    print("   🗑️  Dropped existing collections")

    # Indexes on vehicles
    db.vehicles.create_index([("id", ASCENDING)], unique=True)

    # Indexes on telemetry (mirrors the SQLite indexes)
    db.telemetry.create_index([("vehicle_id", ASCENDING), ("timestamp", DESCENDING)])
    db.telemetry.create_index([("timestamp", DESCENDING)])
    db.telemetry.create_index([("charging_status", ASCENDING)])
    db.telemetry.create_index([("battery_temp_c", ASCENDING)])
    db.telemetry.create_index([("soc_pct", ASCENDING)])

    print("   ✅ Collections and indexes created")
    return db


def seed_database():
    """Main function to generate and insert all data"""
    print("=" * 50)
    print("EV TELEMETRY SEED SCRIPT")
    print("=" * 50)
    print(f"\n📊 Configuration:")
    print(f"   - Vehicles: {NUM_VEHICLES:,}")
    print(f"   - Days of data: {DAYS_OF_DATA}")
    print(f"   - Interval: {INTERVAL_SECONDS} seconds")

    total_points_estimate = NUM_VEHICLES * DAYS_OF_DATA * (24 * 3600 // INTERVAL_SECONDS)
    print(f"   - Estimated points: {total_points_estimate:,}")
    print(f"   - Database: {DB_NAME} (MongoDB)")

    # Connect to MongoDB
    print("\n🔌 Connecting to MongoDB...")
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')           # verify connection before doing any work
    print("   ✅ Connected")

    print("\n🔧 Setting up database...")
    db = setup_database(client)

    print("\n🚗 Generating vehicles...")
    vehicles = generate_vehicles(NUM_VEHICLES)
    db.vehicles.insert_many(vehicles)
    print(f"   ✅ Inserted {len(vehicles):,} vehicles")

    print("\n📡 Generating telemetry data...")
    print(f"   (This may take several minutes for {NUM_VEHICLES:,} vehicles x {DAYS_OF_DATA} days)")

    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=DAYS_OF_DATA)

    total_points = 0
    batch_size = 5000
    batch = []

    for idx, vehicle in enumerate(vehicles):
        if idx > 0 and idx % 100 == 0:
            pct = (idx / NUM_VEHICLES) * 100
            print(f"   Progress: {idx:,}/{NUM_VEHICLES:,} vehicles ({pct:.1f}%) - {total_points:,} points so far")

        points = generate_telemetry(vehicle['id'], start_date, end_date, vehicle['battery_capacity_kwh'])
        total_points += len(points)
        batch.extend(points)

        if len(batch) >= batch_size:
            db.telemetry.insert_many(batch)
            batch = []

    # Insert remaining points
    if batch:
        db.telemetry.insert_many(batch)

    client.close()

    print("\n" + "=" * 50)
    print("✅ SEEDING COMPLETE!")
    print("=" * 50)
    print(f"\n📊 Final Statistics:")
    print(f"   - Vehicles: {NUM_VEHICLES:,}")
    print(f"   - Telemetry points: {total_points:,}")
    print(f"   - Database: {DB_NAME}")

    print("\n🚀 You can now start your API server.")
    print("   Example: python app.py")
    print("   Example: uvicorn main:app --reload")


if __name__ == "__main__":
    seed_database()