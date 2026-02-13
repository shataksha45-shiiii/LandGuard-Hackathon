import requests
import json

url = 'http://127.0.0.1:5000/generate_notice'

payload = {
    "plot_id": "PLOT-TEST-001",
    "violation": "UNAUTHORIZED CONCRETE STRUCTURE DETECTED (High Radar Return)"
}

print(f"🔨 Generating Legal Notice at {url}...")
response = requests.post(url, json=payload)

if response.status_code == 200:
    print("\n✅ NOTICE GENERATED!")
    print(json.dumps(response.json(), indent=2))
    print("\n👉 Check your LandGuard_Backend folder. There should be a PDF there now.")
else:
    print(f"\n❌ Error: {response.text}")