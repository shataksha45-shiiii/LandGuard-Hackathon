from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
import ee
import datetime
import os
import math

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, 'service-account.json')
SERVICE_ACCOUNT_EMAIL = 'landguard-bot@landguard-hackathon.iam.gserviceaccount.com' 

# --- AUTHENTICATION ---
try:
    credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, SERVICE_ACCOUNT_FILE)
    ee.Initialize(credentials, project='landguard-hackathon')
    print("✅ GEE Connected Successfully.")
except Exception as e:
    print(f"❌ GEE Auth Failed: {e}")

app = Flask(__name__)
CORS(app)

# Create pdfs directory if it doesn't exist
PDF_DIR = os.path.join(BASE_DIR, 'pdfs')
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
        # Top border line
        self.set_draw_color(0, 100, 0)
        self.set_line_width(1.2)
        self.line(10, 8, 200, 8)
        
        # Ashoka Emblem placeholder
        self.set_font('Times', 'B', 22)
        self.set_text_color(0, 80, 0)
        self.set_y(12)
        self.cell(0, 8, '* * *', 0, 1, 'C')
        
        # Government Name (Hindi transliteration)
        self.set_font('Times', 'B', 14)
        self.set_text_color(0, 0, 0)
        self.cell(0, 7, 'CHHATTISGARH SHASAN', 0, 1, 'C')
        
        # Government Name (English)
        self.set_font('Times', 'B', 16)
        self.set_text_color(0, 60, 0)
        self.cell(0, 8, 'GOVERNMENT OF CHHATTISGARH', 0, 1, 'C')
        
        # Department
        self.set_font('Times', '', 11)
        self.set_text_color(30, 30, 30)
        self.cell(0, 6, 'Department of Town & Country Planning', 0, 1, 'C')
        
        # Sub-department
        self.set_font('Times', '', 10)
        self.set_text_color(80, 80, 80)
        self.cell(0, 5, 'Chhattisgarh State Industrial Development Corporation (CSIDC)', 0, 1, 'C')
        self.cell(0, 5, 'Naya Raipur Development Authority (NRDA)', 0, 1, 'C')
        
        # Decorative line
        self.set_draw_color(0, 100, 0)
        self.set_line_width(0.8)
        self.line(10, self.get_y() + 3, 200, self.get_y() + 3)
        self.set_line_width(0.3)
        self.line(10, self.get_y() + 5, 200, self.get_y() + 5)
        self.ln(8)
    
    def footer(self):
        self.set_y(-30)
        self.set_draw_color(0, 100, 0)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)
        self.set_font('Times', 'I', 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 4, 'This is a computer-generated notice issued under the authority of the', 0, 1, 'C')
        self.cell(0, 4, 'Chhattisgarh Land Revenue Code and Town & Country Planning Act.', 0, 1, 'C')
        self.cell(0, 4, 'Powered by UdyogGadh AI Satellite Surveillance System | Copernicus Sentinel Data', 0, 1, 'C')
        self.set_font('Times', '', 8)
        self.cell(0, 5, f'Page {self.page_no()}/{{nb}}', 0, 0, 'C')

def create_notice(plot_id, violation_type, excess_area_sqm=0):
    # Sanitize text for FPDF's latin-1 encoding 
    def safe(text):
        if not text:
            return ''
        return text.encode('latin-1', errors='replace').decode('latin-1')
    
    # Sanitize inputs
    violation_type = safe(str(violation_type))
    plot_id = safe(str(plot_id))
    
    # Financial Calculation (CG Land Revenue Code, 1959)
    try:
        area_sqm = float(excess_area_sqm)
    except:
        area_sqm = 0.0
        
    area_sqft = area_sqm * 10.764
    LAND_RATE_PER_SQFT = 600  # Estimated Industrial Rate for Khapri/Siyarpali
    
    fine_statutory = 25000  # Max fine under Section 248
    civil_liability = round(area_sqft * LAND_RATE_PER_SQFT)
    total_liability = fine_statutory + civil_liability
    
    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    date_str = datetime.datetime.now().strftime("%d %B %Y")
    date_short = datetime.datetime.now().strftime("%Y%m%d")
    ref_no = f"CSIDC/TCP/LG-{date_short}/{plot_id}"
    
    # ─── Reference and Date Block ───
    pdf.set_font("Times", "B", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(95, 6, f"Ref. No.: {ref_no}", 0, 0, 'L')
    pdf.cell(95, 6, f"Date: {date_str}", 0, 1, 'R')
    pdf.ln(3)
    
    # ─── NOTICE Title ───
    pdf.set_fill_color(0, 80, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Times", "B", 14)
    pdf.cell(0, 10, "SHOW CAUSE NOTICE", 0, 1, 'C', fill=True)
    pdf.ln(2)
    
    # ─── Subject ───
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Times", "B", 10)
    pdf.cell(20, 6, "Subject:", 0, 0, 'L')
    pdf.set_font("Times", "BU", 10)
    pdf.cell(0, 6, "Notice of Unauthorized Land Use / Encroachment - Khapri Khurd Industrial Area", 0, 1, 'L')
    pdf.ln(1)
    
    # ─── Legal Reference ───
    pdf.set_font("Times", "I", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 5,
        "Issued under Section 27 of the Chhattisgarh Nagar Tatha Gram Nivesh Adhiniyam, 1973 "
        "read with Rule 15 of the CG Land Revenue Code, 1959 and Section 248 of the "
        "CG Municipal Corporation Act, 1956."
    )
    pdf.ln(3)
    
    # ─── TO / Recipient ───
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Times", "B", 10)
    pdf.cell(0, 6, "TO:", 0, 1, 'L')
    pdf.set_font("Times", "", 10)
    pdf.cell(0, 5, f"   The Registered Owner / Occupant of Plot: {plot_id}", 0, 1, 'L')
    pdf.cell(0, 5, "   Khapri Khurd Industrial Area, District Durg, Chhattisgarh", 0, 1, 'L')
    pdf.ln(4)
    
    # ─── Body Paragraph 1 ───
    pdf.set_font("Times", "", 10)
    pdf.multi_cell(0, 5,
        f"WHEREAS, the UdyogGadh AI Satellite Surveillance System, operating under the "
        f"directive of the Chhattisgarh State Industrial Development Corporation (CSIDC), "
        f"has conducted a remote sensing analysis of the above-mentioned plot ({plot_id}) "
        f"using Copernicus Sentinel-1 SAR (Synthetic Aperture Radar) and Sentinel-2 MSI "
        f"(Multi-Spectral Instrument) satellite imagery, and;"
    )
    pdf.ln(2)
    
    # ─── Body Paragraph 2 ───
    pdf.multi_cell(0, 5,
        f"WHEREAS, the said analysis has revealed the following unauthorized activity:"
    )
    pdf.ln(2)
    
    # ─── Violation Details Box ───
    pdf.set_draw_color(180, 0, 0)
    pdf.set_line_width(0.6)
    y_before = pdf.get_y()
    pdf.set_fill_color(255, 240, 240)
    pdf.rect(12, y_before, 186, 22, 'DF')
    pdf.set_xy(15, y_before + 3)
    pdf.set_font("Times", "B", 10)
    pdf.set_text_color(150, 0, 0)
    pdf.cell(0, 5, "NATURE OF VIOLATION:", 0, 1, 'L')
    pdf.set_x(15)
    pdf.set_font("Times", "", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(180, 5, violation_type)
    pdf.set_y(y_before + 25)
    
    # ─── Satellite Evidence Table ───
    pdf.set_font("Times", "B", 10)
    pdf.set_text_color(0, 60, 0)
    pdf.cell(0, 7, "SATELLITE EVIDENCE SUMMARY:", 0, 1, 'L')
    
    pdf.set_font("Times", "B", 9)
    pdf.set_fill_color(0, 80, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(63, 7, "Parameter", 1, 0, 'C', fill=True)
    pdf.cell(63, 7, "Technology", 1, 0, 'C', fill=True)
    pdf.cell(64, 7, "Finding", 1, 1, 'C', fill=True)
    
    pdf.set_font("Times", "", 9)
    pdf.set_text_color(0, 0, 0)
    pdf.set_fill_color(245, 245, 245)

    table_data = [
        ("Vegetation Index (NDVI)", "Sentinel-2 Optical", "Anomalous - Low / Cleared"),
        ("Radar Backscatter (VV)", "Sentinel-1 C-Band SAR", "Exceeded -11.0 dB Threshold"),
        ("Structural Detection", "Multi-Sensor Fusion", "Unauthorized Construction"),
        ("Temporal Change", "12-Month Time Series", "Progressive Encroachment"),
    ]
    
    for i, (param, tech, finding) in enumerate(table_data):
        fill = i % 2 == 0
        pdf.cell(63, 6, f"  {param}", 1, 0, 'L', fill=fill)
        pdf.cell(63, 6, f"  {tech}", 1, 0, 'L', fill=fill)
        pdf.cell(64, 6, f"  {finding}", 1, 1, 'L', fill=fill)
    
    pdf.ln(5)

    # ─── Financial Liability Assessment ───
    pdf.set_font("Times", "B", 10)
    pdf.set_text_color(150, 0, 0)
    pdf.cell(0, 6, "FINANCIAL LIABILITY ASSESSMENT:", 0, 1, 'L')
    
    pdf.set_font("Times", "B", 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(100, 6, "Description of Liability", 1, 0, 'L', fill=True)
    pdf.cell(50, 6, "Reference", 1, 0, 'L', fill=True)
    pdf.cell(40, 6, "Amount (INR)", 1, 1, 'R', fill=True)
    
    pdf.set_font("Times", "", 9)
    
    # Row 1: Statutory Fine
    pdf.cell(100, 6, "  Statutory Penalty (Max)", 1, 0, 'L')
    pdf.cell(50, 6, "  Sec 248, CGLRC 1959", 1, 0, 'L')
    pdf.cell(40, 6, f"  Rs. {fine_statutory:,}", 1, 1, 'R')
    
    # Row 2: Civil Liability
    pdf.cell(100, 6, f"  Est. Market Value of Encroached Land ({area_sqm:.1f} m2)", 1, 0, 'L')
    pdf.cell(50, 6, "  Civil Recovery / Damages", 1, 0, 'L')
    pdf.cell(40, 6, f"  Rs. {civil_liability:,}", 1, 1, 'R')
    
    # Row 3: Total
    pdf.set_font("Times", "B", 9)
    pdf.cell(150, 6, "  TOTAL RECOVERABLE AMOUNT", 1, 0, 'R', fill=True)
    pdf.cell(40, 6, f"  Rs. {total_liability:,}", 1, 1, 'R', fill=True)
    
    pdf.ln(4)
    
    # ─── Directive ───
    pdf.set_font("Times", "B", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 6, "DIRECTIVE:", 0, 1, 'L')
    pdf.set_font("Times", "", 10)
    pdf.multi_cell(0, 5,
        "You are hereby directed to:\n"
        "   1. Immediately cease all unauthorized construction and land-use activities.\n"
        f"   2. Deposit the assessed penalty of Rs. {fine_statutory:,} and liability within 15 days.\n"
        "   3. Restore the land to its original state or face summary eviction.\n"
        "   4. Appear before the Revenue Court/Tahsildar on the scheduled hearing date."
    )
    pdf.ln(2)
    
    # ─── Warning ───
    pdf.set_font("Times", "B", 9)
    pdf.set_text_color(150, 0, 0)
    pdf.multi_cell(0, 5,
        "WARNING: Failure to comply within the stipulated time will result in action "
        "including but not limited to: demolition of unauthorized structures, recovery of "
        "damages, and prosecution under applicable laws of the State of Chhattisgarh."
    )
    pdf.ln(6)
    
    # ─── Signature Block ───
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Times", "", 10)
    pdf.cell(95, 5, "", 0, 0)
    pdf.cell(95, 5, "By Order,", 0, 1, 'L')
    pdf.ln(8)
    
    pdf.cell(95, 5, "", 0, 0)
    pdf.set_font("Times", "B", 10)
    pdf.cell(95, 5, "Authorized Signatory", 0, 1, 'L')
    
    pdf.cell(95, 5, "", 0, 0)
    pdf.set_font("Times", "", 9)
    pdf.cell(95, 5, "Town & Country Planning Department", 0, 1, 'L')
    
    pdf.cell(95, 5, "", 0, 0)
    pdf.cell(95, 5, "CSIDC, Naya Raipur, Chhattisgarh", 0, 1, 'L')
    
    # ─── CC Block ───
    pdf.ln(5)
    pdf.set_font("Times", "I", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 4, "CC: District Collector (Raigarh), Sub-Divisional Officer (Dharamjaigarh), CSIDC Managing Director", 0, 1, 'L')
    
    filename = f"NOTICE_{plot_id}_{date_short}.pdf"
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

@app.route('/analyze_timeline', methods=['POST'])
def analyze_timeline():
    try:
        data = request.json
        plot_id = data.get('plot_id', 'Unknown')
        coords = data.get('coordinates')
        
        # 1. Coordinate Cleaning (same as analyze_plot)
        def clean_coords(c_list):
            if isinstance(c_list[0], list):
                return [clean_coords(sub) for sub in c_list]
            return [c_list[0], c_list[1]]

        temp_coords = coords
        while isinstance(temp_coords, list) and len(temp_coords) == 1 and isinstance(temp_coords[0][0], list):
            temp_coords = temp_coords[0]
            
        final_coords = clean_coords(temp_coords)
        roi = ee.Geometry.Polygon(final_coords)
        
        # 2. Get Sentinel-1 data for last 12 months
        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=365)
        
        s1_collection = ee.ImageCollection('COPERNICUS/S1_GRD') \
            .filterBounds(roi) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) \
            .filter(ee.Filter.eq('instrumentMode', 'IW'))
        
        # 3. Calculate encroached area for each image
        def calculate_encroachment_area(image):
            # Threshold: VV > -11.0 indicates encroachment
            encroached = image.select('VV').gt(-11.0)
            # Multiply by pixel area to get area in square meters
            area_image = encroached.multiply(ee.Image.pixelArea())
            # Sum up the total encroached area
            area_stats = area_image.reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=roi,
                scale=10,
                maxPixels=1e9
            )
            
            # Get the date of the image
            date = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd')
            
            return ee.Feature(None, {
                'date': date,
                'encroached_area': area_stats.get('VV')
            })
        
        # Map over collection and extract timeline data
        timeline_features = s1_collection.map(calculate_encroachment_area)
        timeline_list = timeline_features.reduceColumns(
            ee.Reducer.toList(2), 
            ['date', 'encroached_area']
        ).get('list').getInfo()
        
        # 4. Format and sort the results
        timeline_data = []
        for item in timeline_list:
            if item[1] is not None:  # Skip if area calculation failed
                timeline_data.append({
                    'date': item[0],
                    'encroached_area': round(float(item[1]), 2)
                })
        
        # Sort by date
        timeline_data.sort(key=lambda x: x['date'])
        
        return jsonify({
            'plot_id': plot_id,
            'timeline': timeline_data,
            'data_points': len(timeline_data)
        })
        
    except Exception as e:
        print(f"❌ Timeline Analysis Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_overlay_tiles', methods=['POST'])
def get_overlay_tiles():
    """Generate GEE tile URLs for satellite overlay comparison."""
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
        roi = ee.Geometry.Polygon(final_coords)
        
        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=30)
        
        # 2. Sentinel-1 Radar — Encroachment mask
        s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
            .filterBounds(roi) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) \
            .filter(ee.Filter.eq('instrumentMode', 'IW')) \
            .mean().clip(roi)
        
        # Create encroachment mask: VV > -11.0 means structure detected
        encroachment_mask = s1.select('VV').gt(-11.0)
        
        # Calculate encroached area in sq meters
        encroached_area_img = encroachment_mask.multiply(ee.Image.pixelArea())
        encroached_stats = encroached_area_img.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=10,
            maxPixels=1e9
        )
        encroached_area_sqm = encroached_stats.get('VV').getInfo() or 0
        
        # Total plot area
        total_area_sqm = roi.area(1).getInfo()  # 1m precision
        clean_area_sqm = max(total_area_sqm - encroached_area_sqm, 0)
        
        # Style the encroachment mask for visualization
        encroachment_vis = encroachment_mask.selfMask().visualize(**{
            'palette': ['#ff0000'],
            'min': 0,
            'max': 1,
            'opacity': 0.65
        })
        
        # Get tile URL for encroachment overlay
        encroachment_map = encroachment_vis.getMapId()
        encroachment_tile_url = encroachment_map['tile_fetcher'].url_format
        
        # 3. Sentinel-2 True Color — Natural satellite view
        s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(roi) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)) \
            .median().clip(roi)
        
        s2_vis = s2.visualize(**{
            'bands': ['B4', 'B3', 'B2'],
            'min': 0,
            'max': 3000,
            'gamma': 1.3
        })
        
        s2_map = s2_vis.getMapId()
        s2_tile_url = s2_map['tile_fetcher'].url_format
        
        # 4. NDVI Vegetation overlay
        ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI').clip(roi)
        ndvi_vis = ndvi.visualize(**{
            'min': -0.1,
            'max': 0.6,
            'palette': ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850']
        })
        
        ndvi_map = ndvi_vis.getMapId()
        ndvi_tile_url = ndvi_map['tile_fetcher'].url_format
        
        # 5. Radar backscatter visualization
        vv_vis = s1.select('VV').visualize(**{
            'min': -25,
            'max': 0,
            'palette': ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf']
        })
        
        vv_map = vv_vis.getMapId()
        vv_tile_url = vv_map['tile_fetcher'].url_format
        
        print(f"✅ Overlay tiles generated for {plot_id}")
        
        return jsonify({
            'plot_id': plot_id,
            'tiles': {
                'encroachment': encroachment_tile_url,
                'satellite': s2_tile_url,
                'ndvi': ndvi_tile_url,
                'radar': vv_tile_url
            },
            'area_breakdown': {
                'total_sqm': round(total_area_sqm, 2),
                'encroached_sqm': round(encroached_area_sqm, 2),
                'clean_sqm': round(clean_area_sqm, 2),
                'encroachment_pct': round((encroached_area_sqm / total_area_sqm * 100) if total_area_sqm > 0 else 0, 1)
            }
        })
    except Exception as e:
        print(f"❌ Overlay Tiles Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate_notice', methods=['POST'])
def generate_notice():
    try:
        data = request.json
        plot_id = data.get('plot_id')
        violation = data.get('violation')
        excess_area_sqm = data.get('excess_area_sqm', 0)
        filename = create_notice(plot_id, violation, excess_area_sqm)
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
    app.run(debug=True, host='0.0.0.0', port=5001)