from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
import ee
import datetime
import os

# --- CONFIGURATION ---
SERVICE_ACCOUNT_FILE = 'service-account.json'
# REPLACE WITH YOUR REAL EMAIL
SERVICE_ACCOUNT_EMAIL = 'landguard-bot@landguard-hackathon.iam.gserviceaccount.com' 

# --- AUTHENTICATION ---
try:
    ee.Initialize(ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, SERVICE_ACCOUNT_FILE))
    print("✅ GEE Connected Successfully.")
except Exception as e:
    print(f"❌ GEE Auth Failed: {e}")

app = Flask(__name__)
CORS(app)

# --- SATELLITE LOGIC ---
def check_vegetation(geometry):
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=60)
    s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(geometry).filterDate(start_date, end_date).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).median().clip(geometry)
    ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI')
    val = ndvi.reduceRegion(ee.Reducer.mean(), geometry, 10).get('NDVI').getInfo()
    
    # Tuned for Feb/Dry Season
    if val and val > 0.2: return {"status": "Vacant", "score": val, "is_vacant": True}
    return {"status": "Occupied", "score": val, "is_vacant": False}

def check_encroachment(geometry):
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=30)
    s1 = ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(geometry).filterDate(start_date, end_date).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')).filter(ee.Filter.eq('instrumentMode', 'IW')).mean().clip(geometry)
    val = s1.select('VV').reduceRegion(ee.Reducer.mean(), geometry, 10).get('VV').getInfo()

    # Tuned for Feb/Dry Season
    limit = -11.0 
    if val and val > limit: return {"status": "Encroachment Detected", "score": val, "is_encroached": True}
    return {"status": "Clear", "score": val, "is_encroached": False}

# --- THE HAMMER: PDF GENERATOR ---
class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'GOVERNMENT OF CHHATTISGARH', 0, 1, 'C')
        self.set_font('Arial', '', 12)
        self.cell(0, 10, 'Town & Country Planning Department', 0, 1, 'C')
        self.ln(10)

def create_notice(plot_id, violation_type):
    pdf = PDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    content = [
        f"NOTICE NO: LG-{plot_id}-{date_str}",
        f"DATE: {date_str}",
        f"TO: OWNER OF PLOT ID {plot_id}",
        "",
        "SUBJECT: NOTICE OF ILLEGAL ACTIVITY / ENCROACHMENT",
        "",
        "This is to inform you that satellite surveillance (Sentinel-1/Sentinel-2)",
        f"has detected unauthorized activity on your registered plot: {plot_id}.",
        "",
        f"DETECTED VIOLATION: {violation_type}",
        "",
        "You are hereby directed to stop all construction activities immediately",
        "and report to the District Office within 7 days.",
        "",
        "Failure to comply will result in legal action under Section 26",
        "of the Urban Development Act.",
        "",
        "Sincerely,",
        "LandGuard Automated Monitoring System",
        "Naya Raipur Authority"
    ]
    
    for line in content:
        pdf.cell(0, 10, line, 0, 1)
        
    filename = f"NOTICE_{plot_id}.pdf"
    pdf.output(filename)
    return filename

# --- API ENDPOINTS ---
@app.route('/analyze_plot', methods=['POST'])
def analyze_plot():
    try:
        data = request.json
        coords = data.get('coordinates') 
        roi = ee.Geometry.Polygon(coords)
        
        vacancy = check_vegetation(roi)
        encroachment = check_encroachment(roi)
        
        return jsonify({
            "plot_id": data.get('plot_id', 'Unknown'),
            "vacancy_analysis": vacancy,
            "encroachment_analysis": encroachment
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/generate_notice', methods=['POST'])
def generate_notice():
    try:
        data = request.json
        plot_id = data.get('plot_id')
        violation = data.get('violation')
        
        filename = create_notice(plot_id, violation)
        
        # In a real app, you would upload this to S3/Cloud Storage.
        # For hackathon, we return the filename so you can find it.
        return jsonify({
            "message": "Notice Generated Successfully",
            "file": filename,
            "download_link": f"/download/{filename}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Helper route to let you actually download the PDF to see it
@app.route('/download/<filename>')
def download_file(filename):
    return send_file(filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True, port=5000)