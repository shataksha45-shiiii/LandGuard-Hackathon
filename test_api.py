import requests
import json

# The URL of your local server
url = 'http://127.0.0.1:5000/analyze_plot'

# Test Case: A generic plot in Raipur (Coordinates for a park/open area)
# NOTE: GeoJSON uses [Longitude, Latitude]
payload = {
    "plot_id": "PLOT-TEST-001",
    "coordinates": [
        [
            [81.6330, 21.2450],
            [81.6340, 21.2450],
            [81.6340, 21.2460],
            [81.6330, 21.2460],
            [81.6330, 21.2450]  # Closing the loop
        ]
    ]
}

try:
    print(f"📡 Sending coordinates to {url}...")
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        print("\n✅ SUCCESS! Server Responded:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"\n❌ Server Error: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"\n❌ Connection Refused. Is the server running? Error: {e}")