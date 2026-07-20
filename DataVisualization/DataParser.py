import pandas as pd
import json
import re

print("1. Loading CSV...")
df = pd.read_csv("new_ridership.csv")

df['ridership'] = pd.to_numeric(df['ridership'], errors='coerce').fillna(0)

# Convert timestamps
df['transit_timestamp'] = pd.to_datetime(df['transit_timestamp'])

print("2. Aggregating hourly totals...")
hourly_df = df.groupby(
    ['station_complex_id', 'station_complex', 'latitude', 'longitude', 'transit_timestamp']
)['ridership'].sum().reset_index()

print("3. Pivoting timeline into arrays...")
pivot_df = hourly_df.pivot(
    index=['station_complex_id', 'station_complex', 'latitude', 'longitude'],
    columns='transit_timestamp',
    values='ridership'
).fillna(0)

pivot_df = pivot_df.sort_index(axis=1)
pivot_df['ridership_array'] = pivot_df.values.tolist()
pivot_df = pivot_df.reset_index()

print("4. Extracting train lines & calculating weights...")

# Approximate peak Trains Per Hour (tph) for frequency-based splitting
TRAIN_WEIGHTS = {
    '1': 15, '2': 12, '3': 12, 
    '4': 15, '5': 12, '6': 15, 
    '7': 22, 
    'A': 15, 'C': 8, 'E': 12, 
    'B': 8, 'D': 12, 'F': 15, 'M': 8, 
    'N': 10, 'Q': 10, 'R': 10, 'W': 8, 
    'J': 12, 'Z': 6, 
    'L': 15, 'G': 8,
    'S': 12, 'FS': 12, 'GS': 12, 'SIR': 4 # Including shuttles just in case
}

def extract_lines(station_name):
    # Find ALL parentheses in the string
    matches = re.findall(r'\((.*?)\)', str(station_name))
    if matches:
        # Grab only the very last one, which contains the train letters
        last_match = matches[-1]
        lines = [line.strip() for line in last_match.split(',')]
        
        # Reroute general 'S' to the map's 'ST' (Times Square Shuttle)
        return ['ST' if line == 'S' else line for line in lines]
    return []

pivot_df['lines'] = pivot_df['station_complex'].apply(extract_lines)

stations_by_line = {}
for _, row in pivot_df.iterrows():
    lines = row['lines']
    
    # Calculate the total "weight" of all trains servicing this station
    total_station_weight = sum([TRAIN_WEIGHTS.get(line, 10) for line in lines])
    
    for line in lines:
        # Calculate this specific train's percentage of the station traffic
        line_weight = TRAIN_WEIGHTS.get(line, 10)
        ratio = line_weight / total_station_weight if total_station_weight > 0 else (1 / len(lines))
        
        # Multiply the entire array by this train's ratio
        proportional_ridership = [round(float(val) * ratio) for val in row['ridership_array']]
        
        station_dict = {
            "station_complex_id": str(row['station_complex_id']),
            "name": row['station_complex'],
            "latitude": row['latitude'],
            "longitude": row['longitude'],
            "ridership": proportional_ridership
        }
        
        if line not in stations_by_line:
            stations_by_line[line] = []
        stations_by_line[line].append(station_dict)

print("5. Injecting proportionally split data into GeoJSON...")
with open("final_final_d3_subway_data.geojson", "r") as f:
    geojson_data = json.load(f)

for feature in geojson_data["features"]:
    line_letter = feature["properties"].get("service")
    if line_letter:
        feature["properties"]["stations"] = stations_by_line.get(line_letter, [])

with open("final_d3_subway_data4.geojson", "w") as f:
    json.dump(geojson_data, f)

print("Done! Ridership is now proportionally split based on train frequency.")