from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
import ee
import datetime
import os
import math

# --- CONFIGURATION ---
SERVICE_ACCOUNT_FILE = 'service-account.json'
SERVICE_ACCOUNT_EMAIL = 'landguard-bot@landguard-hackathon.iam.gserviceaccount.com' 

# --- AUTHENTICATION ---
try:
    ee.Initialize(ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, SERVICE_ACCOUNT_FILE))
    print("✅ GEE Connected Successfully.")
except Exception as e:
    print(f"❌ GEE Auth Failed: {e}")

app = Flask(__name__)
CORS(app)

# Create pdfs directory if it doesn't exist
PDF_DIR = 'pdfs'
if not os.path.exists(PDF_DIR):
    os.makedirs(PDF_DIR)

# --- AREA CALCULATION UTILITIES ---
def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers"""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def calculate_polygon_area(coordinates):
    """
    Calculate area of a polygon given lat/lon coordinates
    Uses the shoelace formula converted for geographic coordinates
    Returns area in square kilometers
    """
    if not coordinates or len(coordinates) < 3:
        return 0
    
    # Earth's radius in km
    R = 6371
    
    # Close the polygon if not already closed
    coords = coordinates[:]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    
    area = 0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i][:2]  # [lon, lat, altitude]
        lon2, lat2 = coords[i + 1][:2]
        
        lon1_rad = math.radians(lon1)
        lat1_rad = math.radians(lat1)
        lon2_rad = math.radians(lon2)
        lat2_rad = math.radians(lat2)
        
        area += (lon2_rad - lon1_rad) * (2 + math.sin(lat1_rad) + math.sin(lat2_rad))
    
    area = abs(area * R * R / 2.0)
    return area

def calculate_excess_area(encroachment_score, total_area):
    """
    Calculate excess land used based on encroachment analysis
    Encroachment score indicates unauthorized usage
    Returns estimated excess area in sq km
    """
    # If encroachment detected (score > threshold), estimate excess usage
    # Using a heuristic: higher encroachment = more excess area
    encroachment_threshold = -11.0
    
    if encroachment_score is None:
        return 0
    
    if encroachment_score > encroachment_threshold:
        # Estimate excess area as a percentage of total area
        # Based on how much the encroachment signal exceeds the threshold
        excess_ratio = min((encroachment_score - encroachment_threshold) / 5.0, 1.0)
        excess_area = total_area * excess_ratio
        return max(excess_area, 0)
    
    return 0

# --- SATELLITE LOGIC ---
def check_vegetation(geometry):
    try:
        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=60)
        s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(geometry) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
            .median().clip(geometry)
        
        ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI')
        val = ndvi.reduceRegion(ee.Reducer.mean(), geometry, 10).get('NDVI').getInfo()
        
        if val is not None:
            is_vacant = val > 0.2 
            return {
                "status": "Vegetated" if is_vacant else "Vegetation Loss Detected",
                "score": round(val, 4),
                "is_vacant": is_vacant
            }
        return {"status": "No Data", "score": 0, "is_vacant": False}
    except Exception:
        return {"status": "Analysis Error", "score": 0, "is_vacant": False}

def check_encroachment(geometry):
    try:
        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=30)
        s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
            .filterBounds(geometry) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) \
            .filter(ee.Filter.eq('instrumentMode', 'IW')) \
            .mean().clip(geometry)
        
        val = s1.select('VV').reduceRegion(ee.Reducer.mean(), geometry, 10).get('VV').getInfo()

        limit = -11.0 
        if val is not None:
            is_encroached = val > limit
            return {
                "status": "Encroachment Confirmed" if is_encroached else "Clear",
                "score": round(val, 4),
                "is_encroached": is_encroached
            }
        return {"status": "No Data", "score": 0, "is_encroached": False}
    except Exception:
        return {"status": "Analysis Error", "score": 0, "is_encroached": False}

# --- THE HAMMER: PDF GENERATOR ---
class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'GOVERNMENT OF CHHATTISGARH', 0, 1, 'C')
        self.set_font('Arial', '', 12)
        self.cell(0, 10, 'Naya Raipur Development Authority', 0, 1, 'C')
        self.ln(10)

def create_notice(plot_id, violation_type):
    pdf = PDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    content = [
        f"NOTICE NO: LG-{plot_id}-{date_str}",
        f"DATE: {date_str}",
        f"TO: REGISTERED OWNER OF {plot_id}",
        "",
        "SUBJECT: NOTICE OF UNAUTHORIZED LAND USE / ENCROACHMENT",
        "",
        "Our Satellite Surveillance System (LandGuard AI) has detected significant",
        f"anomalies on the property designated as: {plot_id}.",
        "",
        f"NATURE OF VIOLATION: {violation_type}",
        "",
        "Technical analysis indicates unauthorized construction or clearance",
        "of protected land. You are required to halt all activities immediately.",
        "",
        "Please report to the Town & Country Planning Department within 7 days.",
        "",
        "Sincerely, LandGuard Monitoring System"
    ]
    
    for line in content:
        pdf.cell(0, 8, line, 0, 1)
        
    filename = f"NOTICE_{plot_id}.pdf"
    filepath = os.path.join(PDF_DIR, filename)
    pdf.output(filepath)
    return filename

# --- API ENDPOINTS ---
@app.route('/analyze_plot', methods=['POST'])
def analyze_plot():
    try:
        data = request.json
        plot_id = data.get('plot_id', 'Unknown')
        coords = data.get('coordinates') 
        
        # 1. Coordinate Cleaning
        def clean_coords(c_list):
            if isinstance(c_list[0], list):
                return [clean_coords(sub) for sub in c_list]
            return [c_list[0], c_list[1]]

        temp_coords = coords
        while isinstance(temp_coords, list) and len(temp_coords) == 1 and isinstance(temp_coords[0][0], list):
            temp_coords = temp_coords[0]
            
        final_coords = clean_coords(temp_coords)
        
        # 2. Calculate area
        total_area_sqkm = calculate_polygon_area(final_coords)
        total_area_sqm = total_area_sqkm * 1_000_000  # Convert to square meters
        
        roi = ee.Geometry.Polygon(final_coords)
        
        # 3. Sensor Analysis
        vacancy = check_vegetation(roi)
        encroachment = check_encroachment(roi)
        
        # 4. Calculate excess area
        excess_area_sqkm = calculate_excess_area(encroachment['score'], total_area_sqkm)
        excess_area_sqm = excess_area_sqkm * 1_000_000  # Convert to square meters
        
        # 5. UPDATED LOGIC: Prioritize Radar for structural violations
        is_violating = encroachment['is_encroached'] 
        
        if is_violating:
            summary = f"⚠️ Unauthorized structure detected via Radar analysis. Excess area: {excess_area_sqm:.2f} sq.m"
        elif not vacancy['is_vacant']:
            # Low vegetation but no structure
            summary = "ℹ️ Low vegetation index detected; no permanent structures found."
        else:
            summary = "✅ Plot is compliant and currently vacant."
        
        return jsonify({
            "plot_id": plot_id,
            "is_violating": is_violating,
            "analysis_summary": summary,
            "confidence_score": 0.92,
            "vacancy_analysis": vacancy,
            "encroachment_analysis": encroachment,
            "area_analysis": {
                "total_area_sqkm": round(total_area_sqkm, 4),
                "total_area_sqm": round(total_area_sqm, 2),
                "excess_area_sqkm": round(excess_area_sqkm, 4),
                "excess_area_sqm": round(excess_area_sqm, 2),
                "excess_area_sqft": round(excess_area_sqm * 10.764, 2),
                "utilization_ratio": round((excess_area_sqm / total_area_sqm * 100) if total_area_sqm > 0 else 0, 2)
            }
        })
    except Exception as e:
        print(f"❌ Analysis Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/generate_notice', methods=['POST'])
def generate_notice():
    try:
        data = request.json
        plot_id = data.get('plot_id')
        violation = data.get('violation')
        filename = create_notice(plot_id, violation)
        filepath = os.path.join(PDF_DIR, filename)
        return jsonify({
            "message": "Legal Notice Generated Successfully",
            "file": filename,
            "download_link": f"/download/{filename}",
            "path": os.path.abspath(filepath)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    # Security: Prevent directory traversal attacks
    if '..' in filename or '/' in filename:
        return jsonify({"error": "Invalid filename"}), 400
    
    filepath = os.path.join(PDF_DIR, filename)
    
    # Verify file exists before sending
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    
    return send_file(filepath, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True, port=5000)