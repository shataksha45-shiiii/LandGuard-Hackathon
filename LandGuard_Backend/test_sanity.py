import requests
import json

url = 'http://127.0.0.1:5000/analyze_plot'

# Test Case 3: Naya Raipur Jungle Safari (DEEP FOREST)
# This MUST return "Vacant" and Low Radar (-15 to -20)
payload = {
    "plot_id": "PLOT-JUNGLE-001",
    "coordinates": [
        [
            [81.8600, 21.1800], # Deep inside the green zone
            [81.8700, 21.1800],
            [81.8700, 21.1900],
            [81.8600, 21.1900],
            [81.8600, 21.1800]
        ]
    ]
}

print(f"🌲 Testing 'Deep Forest' at {url}...")
response = requests.post(url, json=payload)

print(json.dumps(response.json(), indent=2))