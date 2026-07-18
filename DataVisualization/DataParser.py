import pandas as pd
import geopandas as gpd
import json

# FIX 1: Add low_memory=False to handle mixed data types
ridership_df = pd.read_csv('ridership.csv', low_memory=False)

# Group and convert to GeoDataFrame
station_rollups = ridership_df.groupby(['station_complex_id', 'latitude', 'longitude'])['ridership'].apply(list).reset_index()
stations_gdf = gpd.GeoDataFrame(
    station_rollups, 
    geometry=gpd.points_from_xy(station_rollups.longitude, station_rollups.latitude),
    crs="EPSG:4326"
)

# Load routes
routes_gdf = gpd.read_file('routes.geojson') 
routes_gdf = routes_gdf.to_crs("EPSG:4326")

# FIX 2: Project both to EPSG:2263 (NYC State Plane in feet) for accurate distance math
stations_proj = stations_gdf.to_crs("EPSG:2263")
routes_proj = routes_gdf.to_crs("EPSG:2263")

# Perform the spatial join. max_distance is now in FEET. (500 feet is a good snap radius)
stations_with_routes = gpd.sjoin_nearest(stations_proj, routes_proj, how="left", max_distance=500)

# Convert back to EPSG:4326 so D3 can map it correctly
stations_with_routes = stations_with_routes.to_crs("EPSG:4326")

nested_data = []

# FIX 3: Use the DataFrame index instead of 'Object ID'
# Use the DataFrame index instead of 'Object ID'
for idx, route in routes_gdf.iterrows():
    route_stations = stations_with_routes[stations_with_routes['index_right'] == idx]
    
    # FIX: Isolate only the specific columns D3 needs. 
    # This drops the problematic ':created_at' timestamp and shrinks the file size.
    clean_stations = route_stations[['station_complex_id', 'latitude', 'longitude', 'ridership']]
    
    feature = {
        "type": "Feature",
        "geometry": route.geometry.__geo_interface__,
        "properties": {
            "service_name": route.get('Service Name', 'Unknown'),
            "stations": clean_stations.to_dict('records')
        }
    }
    nested_data.append(feature)

with open('d3_subway_data.geojson', 'w') as f:
    json.dump({"type": "FeatureCollection", "features": nested_data}, f)
    
print("Successfully generated d3_subway_data.geojson!")