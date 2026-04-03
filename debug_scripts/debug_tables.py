import sqlite3

conn = sqlite3.connect('socialsim4.db')
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", tables)

# Check simulation_logs table
cursor.execute("SELECT COUNT(*) FROM simulation_logs")
count = cursor.fetchone()
print(f"simulation_logs count: {count}")

# Get a few sample simulation_ids
cursor.execute("SELECT DISTINCT simulation_id FROM simulation_logs LIMIT 5")
sims = cursor.fetchall()
print(f"Sample simulation_ids in logs: {sims}")

# Check simulations table
cursor.execute("SELECT id FROM simulations LIMIT 5")
sim_ids = cursor.fetchall()
print(f"Sample simulation IDs: {sim_ids}")

conn.close()
