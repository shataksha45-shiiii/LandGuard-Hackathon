import ee
import os

# 1. Point to your Service Account Key
# This must match the file you just put in the folder
SERVICE_ACCOUNT_FILE = 'service-account.json'

try:
    # 2. Authenticate
    # This uses the key file to log in automatically
    ee.Initialize(ee.ServiceAccountCredentials(
        'landguard-bot@landguard-hackathon.iam.gserviceaccount.com', # <--- REPLACE THIS EMAIL if it's different in your JSON file
        SERVICE_ACCOUNT_FILE
    ))
    
    print("✅ Google Earth Engine Authenticated Successfully!")

    # 3. Run a quick test (Get Elevation of Raipur)
    dem = ee.Image('USGS/SRTMGL1_003')
    raipur_point = ee.Geometry.Point([81.6296, 21.2514]) # Long, Lat
    elevation = dem.sample(raipur_point, 30).first().get('elevation').getInfo()
    
    print(f"🌍 Test Metric - Elevation of Raipur: {elevation} meters")

except Exception as e:
    print("❌ Connection Failed.")
    print(f"Error Details: {e}")