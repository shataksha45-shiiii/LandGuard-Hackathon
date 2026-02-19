from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
import ee
import datetime
import os
import math
import json
import base64
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- AUTHENTICATION ---
GEE_SERVICE_ACCOUNT = os.getenv('GEE_SERVICE_ACCOUNT')
GEE_PRIVATE_KEY = os.getenv('GEE_PRIVATE_KEY') # Expected as base64 string
GEE_PROJECT = os.getenv('GEE_PROJECT', 'landguard-hackathon')

try:
    if GEE_SERVICE_ACCOUNT and GEE_PRIVATE_KEY:
        # Load from environment variables (recommended for cloud hosting)
        key_json = json.loads(base64.b64decode(GEE_PRIVATE_KEY).decode('utf-8'))
        credentials = ee.ServiceAccountCredentials(GEE_SERVICE_ACCOUNT, key_data=key_json)
        ee.Initialize(credentials, project=GEE_PROJECT)
        print("✅ GEE Connected via Environment Variables.")
    else:
        # Fallback to local file
        SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, 'service-account.json')
        SERVICE_ACCOUNT_EMAIL = 'landguard-bot@landguard-hackathon.iam.gserviceaccount.com'
        credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, SERVICE_ACCOUNT_FILE)
        ee.Initialize(credentials, project=GEE_PROJECT)
        print("✅ GEE Connected via local service-account.json.")
except Exception as e:
    print(f"❌ GEE Auth Failed: {e}")

app = Flask(__name__)

# Configure CORS for production
# In production, Replace '*' with the specific frontend URL for better security
allowed_origins = os.getenv('ALLOWED_ORIGINS', '*').split(',')
CORS(app, resources={r"/*": {"origins": allowed_origins}})

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

# --- THE HAMMER: CLEAN B&W LEGAL NOTICE PDF GENERATOR ---

class GazettePDF(FPDF):
    """
    Clean black-and-white legal notice PDF.
    Page 1: English.  Page 2: Hindi.
    All text/lines in black, no colour, no overlap.
    """

    def __init__(self):
        super().__init__()
        self._hindi = False
        self._is_hindi_page = False
        # Load Devanagari font
        font_pairs = [
            ('C:/Windows/Fonts/Nirmala.ttf', 'C:/Windows/Fonts/NirmalaB.ttf'),
            ('C:/Windows/Fonts/Nirmala.ttc', 'C:/Windows/Fonts/Nirmala.ttc'),
            ('C:/Windows/Fonts/mangal.ttf', 'C:/Windows/Fonts/mangalb.ttf'),
        ]
        for reg, bold in font_pairs:
            if os.path.exists(reg):
                try:
                    self.add_font('Hindi', '', reg)
                    bold_path = bold if os.path.exists(bold) else reg
                    self.add_font('Hindi', 'B', bold_path)
                    self._hindi = True
                    break
                except Exception:
                    pass

    # ── Helpers ──
    def _thin_line(self, y=None):
        if y is None:
            y = self.get_y()
        self.set_draw_color(0, 0, 0)
        self.set_line_width(0.4)
        self.line(10, y, 200, y)
        self.set_y(y + 2)

    def _thick_line(self, y=None):
        if y is None:
            y = self.get_y()
        self.set_draw_color(0, 0, 0)
        self.set_line_width(1.0)
        self.line(10, y, 200, y)
        self.set_line_width(0.4)
        self.line(10, y + 2.5, 200, y + 2.5)
        self.set_y(y + 5)

    # ── Page Header ──
    def header(self):
        self.set_text_color(0, 0, 0)
        self.set_draw_color(0, 0, 0)

        start_y = 10
        self.set_y(start_y)

        # Emblem (centred, small)
        emblem_path = os.path.join(os.path.dirname(__file__), 'emblem.png')
        emblem_w = 18
        if os.path.exists(emblem_path):
            self.image(emblem_path, x=(210 - emblem_w) / 2, y=start_y, w=emblem_w)
            self.set_y(start_y + emblem_w + 2)
        else:
            self.set_y(start_y)

        if self._is_hindi_page and self._hindi:
            self.set_font('Hindi', 'B', 14)
            self.cell(0, 7, '\u091b\u0924\u094d\u0924\u0940\u0938\u0917\u0922\u093c \u0930\u093e\u091c\u092a\u0924\u094d\u0930', 0, 1, 'C')
            self.set_font('Hindi', '', 9)
            self.cell(0, 5, '(\u0905\u0938\u093e\u0927\u093e\u0930\u0923) - \u092a\u094d\u0930\u093e\u0927\u093f\u0915\u093e\u0930 \u0938\u0947 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924', 0, 1, 'C')
            self.set_font('Hindi', 'B', 11)
            self.cell(0, 6, '\u0930\u093e\u091c\u0938\u094d\u0935 \u090f\u0935\u0902 \u092d\u0942-\u0938\u0902\u092a\u0926\u093e \u092a\u094d\u0930\u092c\u0902\u0927\u0928 \u0935\u093f\u092d\u093e\u0917', 0, 1, 'C')
            self.set_font('Hindi', '', 9)
            self.cell(0, 5, '\u091b\u0924\u094d\u0924\u0940\u0938\u0917\u0922\u093c \u0930\u093e\u091c\u094d\u092f \u0914\u0926\u094d\u092f\u094b\u0917\u093f\u0915 \u0935\u093f\u0915\u093e\u0938 \u0928\u093f\u0917\u092e (CSIDC)', 0, 1, 'C')
        else:
            self.set_font('Times', 'B', 14)
            self.cell(0, 7, 'CHHATTISGARH RAJPATRA', 0, 1, 'C')
            self.set_font('Times', '', 9)
            self.cell(0, 5, '(Extraordinary) - Published by Authority', 0, 1, 'C')
            self.set_font('Times', 'B', 11)
            self.cell(0, 6, 'Revenue & Land Estate Management Department', 0, 1, 'C')
            self.set_font('Times', '', 9)
            self.cell(0, 5, 'Chhattisgarh State Industrial Development Corporation (CSIDC)', 0, 1, 'C')

        self.ln(1)
        self._thick_line()
        self.ln(1)

    # ── Page Footer ──
    def footer(self):
        self.set_y(-18)
        self._thin_line()
        self.set_font('Times', 'I', 7)
        self.set_text_color(80, 80, 80)
        self.cell(0, 3, 'Computer-generated document | CG Land Revenue Code & Town and Country Planning Act', 0, 1, 'C')
        self.cell(0, 3, 'UdyogGadh AI Satellite Surveillance | Copernicus Sentinel-1 / Sentinel-2', 0, 1, 'C')
        self.set_font('Times', '', 7)
        self.cell(0, 3, f'Page {self.page_no()}/{{nb}}', 0, 0, 'C')
        self.set_text_color(0, 0, 0)


def create_notice(plot_id, violation_type, excess_area_sqm=0,
                  ndvi_score=None, ndvi_status=None,
                  radar_score=None, radar_status=None,
                  confidence_score=None,
                  total_area_sqm=None, utilization_ratio=None,
                  timeline_data=None):
    """
    Generate a clean B&W legal notice.  Page 1 = English.  Page 2 = Hindi.
    4 sections: WHY | DURATION | TECHNICAL BASIS | AMOUNT PAYABLE
    """
    import re as _re

    def safe(text):
        if not text:
            return ''
        text = str(text)
        text = _re.sub(
            r'[\U00002600-\U000027BF'
            r'\U0000FE00-\U0000FE0F'
            r'\U0001F000-\U0001FFFF'
            r'\U00002702-\U000027B0'
            r'\U00002190-\U000021FF'
            r'\U00002300-\U000023FF'
            r'\U00002B50-\U00002B55'
            r'\U0000200D'
            r'\U0000FE0F]+', '', text)
        text = text.encode('latin-1', errors='replace').decode('latin-1')
        return text.strip()

    violation_type = safe(violation_type)
    plot_id = safe(plot_id)

    # ── Numerical values ──
    try:
        area_excess_sqm = float(excess_area_sqm)
    except Exception:
        area_excess_sqm = 0.0
    area_excess_sqft = area_excess_sqm * 10.764

    try:
        area_total_sqm = float(total_area_sqm) if total_area_sqm else area_excess_sqm * 3
    except Exception:
        area_total_sqm = 0.0

    ndvi_val = round(float(ndvi_score), 4) if ndvi_score is not None else None
    radar_val = round(float(radar_score), 2) if radar_score is not None else None
    conf_pct = round(float(confidence_score) * 100, 1) if confidence_score is not None else None
    util_val = round(float(utilization_ratio), 1) if utilization_ratio is not None else None

    ndvi_str = safe(ndvi_status) if ndvi_status else 'Analysis Pending'
    radar_str = safe(radar_status) if radar_status else 'Analysis Pending'

    ndvi_display = str(ndvi_val) if ndvi_val is not None else 'N/A'
    radar_display = f'{radar_val} dB' if radar_val is not None else 'N/A'
    conf_display = f'{conf_pct}%' if conf_pct is not None else 'N/A'
    util_display = f'{util_val}%' if util_val is not None else 'N/A'

    ndvi_violating = ndvi_val is not None and ndvi_val < 0.2
    radar_violating = radar_val is not None and radar_val > -11.0

    if ndvi_violating and radar_violating:
        primary_en = 'Both NDVI (vegetation loss) and VV Radar (structural encroachment)'
        primary_hi = 'NDVI (\u0935\u0928\u0938\u094d\u092a\u0924\u093f \u0939\u093e\u0928\u093f) \u090f\u0935\u0902 VV \u0930\u0921\u093e\u0930 (\u0938\u0902\u0930\u091a\u0928\u093e\u0924\u094d\u092e\u0915 \u0905\u0924\u093f\u0915\u094d\u0930\u092e\u0923) \u0926\u094b\u0928\u094b\u0902'
    elif ndvi_violating:
        primary_en = 'NDVI vegetation analysis (Sentinel-2 optical satellite)'
        primary_hi = 'NDVI \u0935\u0928\u0938\u094d\u092a\u0924\u093f \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923 (\u0938\u0947\u0902\u091f\u093f\u0928\u0947\u0932-2 \u0911\u092a\u094d\u091f\u093f\u0915\u0932 \u0909\u092a\u0917\u094d\u0930\u0939)'
    elif radar_violating:
        primary_en = 'VV-polarization Radar analysis (Sentinel-1 SAR satellite)'
        primary_hi = 'VV-\u0927\u094d\u0930\u0941\u0935\u0940\u0915\u0930\u0923 \u0930\u0921\u093e\u0930 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923 (\u0938\u0947\u0902\u091f\u093f\u0928\u0947\u0932-1 SAR \u0909\u092a\u0917\u094d\u0930\u0939)'
    else:
        primary_en = 'Multi-sensor satellite analysis'
        primary_hi = '\u092c\u0939\u0941-\u0938\u0947\u0902\u0938\u0930 \u0909\u092a\u0917\u094d\u0930\u0939 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923'

    # ── Timeline / Duration ──
    first_detected_date = None
    last_date_str = None
    months_violating = 0
    duration_en = 'Data unavailable - to be determined through field inspection.'
    duration_hi = '\u0921\u0947\u091f\u093e \u0905\u0928\u0941\u092a\u0932\u092c\u094d\u0927 - \u0915\u094d\u0937\u0947\u0924\u094d\u0930 \u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923 \u0926\u094d\u0935\u093e\u0930\u093e \u0928\u093f\u0930\u094d\u0927\u093e\u0930\u093f\u0924 \u0915\u093f\u092f\u093e \u091c\u093e\u090f\u0917\u093e\u0964'
    min_area = 0
    max_area = 0
    if timeline_data and len(timeline_data) > 0:
        violating_dates = [t for t in timeline_data if t.get('encroached_area', 0) > 0]
        if violating_dates:
            violating_dates.sort(key=lambda x: x['date'])
            first_detected_date = violating_dates[0]['date']
            last_date_str = violating_dates[-1]['date']
            min_area = min(t['encroached_area'] for t in violating_dates)
            max_area = max(t['encroached_area'] for t in violating_dates)
            try:
                d1 = datetime.datetime.strptime(first_detected_date, '%Y-%m-%d')
                d2 = datetime.datetime.strptime(last_date_str, '%Y-%m-%d')
                months_violating = max(1, round((d2 - d1).days / 30))
                duration_en = (
                    f'Approximately {months_violating} month(s). '
                    f'First detected: {d1.strftime("%d %b %Y")}. '
                    f'Last observed: {d2.strftime("%d %b %Y")}.'
                )
                duration_hi = (
                    f'\u0932\u0917\u092d\u0917 {months_violating} \u092e\u093e\u0939\u0964 '
                    f'\u092a\u094d\u0930\u0925\u092e \u092a\u0939\u091a\u093e\u0928: {d1.strftime("%d %b %Y")}\u0964 '
                    f'\u0905\u0902\u0924\u093f\u092e \u0905\u0935\u0932\u094b\u0915\u0928: {d2.strftime("%d %b %Y")}\u0964'
                )
            except Exception:
                pass

    # ── Financial calculations ──
    LAND_RATE_PER_SQFT = 600
    fine_statutory = 25000
    civil_liability = round(area_excess_sqft * LAND_RATE_PER_SQFT)
    monthly_penalty_rate = 5000
    duration_penalty = months_violating * monthly_penalty_rate if months_violating > 0 else 0
    total_liability = fine_statutory + civil_liability + duration_penalty

    # ── Create PDF ──
    pdf = GazettePDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=22)

    date_str = datetime.datetime.now().strftime("%d %B %Y")
    date_short = datetime.datetime.now().strftime("%Y%m%d")
    ref_no = f"CSIDC/TCP/LG-{date_short}/{plot_id}"
    notice_number = f'{abs(hash(plot_id)) % 9000 + 1000}'

    # ══════════════════════════════════════════════════════════════
    #  PAGE 1 — ENGLISH
    # ══════════════════════════════════════════════════════════════
    pdf._is_hindi_page = False
    pdf.add_page()

    # Ref & date
    pdf.set_font('Times', 'B', 9)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(95, 5, f'Ref: {ref_no}', 0, 0, 'L')
    pdf.cell(95, 5, f'Date: {date_str}', 0, 1, 'R')
    pdf.cell(95, 5, f'Notice No. {notice_number}', 0, 0, 'L')
    pdf.cell(95, 5, 'Naya Raipur, Chhattisgarh', 0, 1, 'R')
    pdf.ln(2)

    # Title bar
    pdf.set_fill_color(0, 0, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Times', 'B', 12)
    pdf.cell(0, 8, '  SHOW CAUSE NOTICE', 0, 1, 'C', fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    # Recipient
    pdf.set_font('Times', 'B', 9)
    pdf.cell(0, 5, 'TO:', 0, 1, 'L')
    pdf.set_font('Times', '', 9)
    pdf.cell(0, 4.5, f'   The Registered Owner / Occupant of Plot: {plot_id}', 0, 1, 'L')
    pdf.cell(0, 4.5, '   CSIDC Industrial Area, Chhattisgarh', 0, 1, 'L')
    pdf.ln(2)

    # ── SECTION 1: WHY ──
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, 'SECTION 1: REASON FOR THIS NOTICE', 0, 1, 'L')
    pdf._thin_line()
    pdf.set_font('Times', '', 9)
    pdf.multi_cell(0, 4.5,
        f'The UdyogGadh AI Satellite Surveillance System has detected unauthorized activity '
        f'on plot {plot_id}. Satellite imagery confirms the land is being used in violation of '
        f'allotment terms - specifically, unauthorized construction, encroachment beyond '
        f'sanctioned boundaries, or non-industrial land use.'
    )
    pdf.ln(1)

    # Violation box with left bar
    vy = pdf.get_y()
    pdf.set_font('Times', 'B', 9)
    pdf.cell(0, 4.5, '  Violation Detected:', 0, 1, 'L')
    pdf.set_font('Times', '', 9)
    pdf.multi_cell(0, 4.5, f'  {violation_type}')
    vy_end = pdf.get_y()
    pdf.set_fill_color(0, 0, 0)
    pdf.rect(10, vy - 0.5, 1.5, vy_end - vy + 1, 'F')
    pdf.ln(1)

    pdf.set_font('Times', 'I', 7.5)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 3.5,
        'Legal Basis: Sec 27, CG Nagar Tatha Gram Nivesh Adhiniyam, 1973; '
        'Rule 15, CG Land Revenue Code, 1959; Sec 248, CG Municipal Corp. Act, 1956.'
    )
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    # ── SECTION 2: DURATION ──
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, 'SECTION 2: DURATION OF VIOLATION', 0, 1, 'L')
    pdf._thin_line()
    pdf.set_font('Times', '', 9)
    if timeline_data and months_violating > 0:
        pdf.multi_cell(0, 4.5,
            f'Based on 12-month Sentinel-1 SAR temporal analysis, the encroachment on '
            f'plot {plot_id} has been continuously detected for approximately '
            f'{months_violating} month(s).\n'
            f'First Detection: {first_detected_date}    |    Last Observed: {last_date_str}\n'
            f'Encroached area ranged from {min_area:.1f} sq.m to {max_area:.1f} sq.m throughout '
            f'the period, confirming a sustained violation.'
        )
    else:
        pdf.multi_cell(0, 4.5,
            f'The violation on plot {plot_id} was identified through the latest satellite pass. '
            f'Exact commencement date to be determined through field inspection.'
        )
    pdf.ln(2)

    # ── SECTION 3: TECHNICAL BASIS ──
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, 'SECTION 3: TECHNICAL BASIS OF DETECTION', 0, 1, 'L')
    pdf._thin_line()
    pdf.set_font('Times', '', 9)
    pdf.multi_cell(0, 4.5,
        f'Primary detection basis: {primary_en}.'
    )
    pdf.ln(1)

    # (a) NDVI
    pdf.set_font('Times', 'B', 9)
    pdf.cell(0, 5, '(a) NDVI - Vegetation Index (Sentinel-2 Optical)', 0, 1, 'L')
    pdf.set_font('Times', '', 8.5)
    ndvi_flag = 'BELOW' if ndvi_violating else 'above'
    ndvi_meaning = ('Vegetation loss detected - consistent with construction/paving.' if ndvi_violating
                    else 'Normal vegetation within acceptable limits.')
    pdf.multi_cell(0, 4,
        f'    Score: {ndvi_display}  |  Threshold: 0.20  |  Status: {ndvi_flag} threshold\n'
        f'    Interpretation: {ndvi_meaning}  |  Assessment: {ndvi_str}'
    )
    pdf.ln(1)

    # (b) Radar
    pdf.set_font('Times', 'B', 9)
    pdf.cell(0, 5, '(b) VV Radar Backscatter (Sentinel-1 SAR)', 0, 1, 'L')
    pdf.set_font('Times', '', 8.5)
    radar_flag = 'EXCEEDS' if radar_violating else 'below'
    radar_meaning = ('Hard structures (concrete/metal/brick) detected beyond sanctioned area.' if radar_violating
                     else 'No significant structural anomalies.')
    pdf.multi_cell(0, 4,
        f'    Score: {radar_display}  |  Threshold: -11.0 dB  |  Status: {radar_flag} threshold\n'
        f'    Interpretation: {radar_meaning}  |  Assessment: {radar_str}'
    )
    pdf.ln(1)

    # Evidence summary table
    pdf.set_font('Times', 'B', 8)
    col_w = [47, 47, 47, 49]
    pdf.set_fill_color(0, 0, 0)
    pdf.set_text_color(255, 255, 255)
    for j, hdr in enumerate(['Parameter', 'Source', 'Value', 'Finding']):
        pdf.cell(col_w[j], 5.5, f' {hdr}', 1, 0, 'L', fill=True)
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 8)
    conf_label = 'HIGH' if (conf_pct and conf_pct > 80) else 'MODERATE'
    rows = [
        ('NDVI Score', 'Sentinel-2 MSI', ndvi_display, 'VIOLATING' if ndvi_violating else 'Normal'),
        ('Radar VV (dB)', 'Sentinel-1 SAR', radar_display, 'VIOLATING' if radar_violating else 'Normal'),
        ('AI Confidence', 'Multi-Sensor', conf_display, conf_label),
        ('Excess Area', 'GIS Boundary', f'{area_excess_sqm:.1f} m2', f'{util_display} of plot'),
    ]
    for i, (p, s, v, f_) in enumerate(rows):
        fill = i % 2 == 0
        pdf.set_fill_color(235, 235, 235)
        pdf.cell(col_w[0], 5, f' {p}', 1, 0, 'L', fill=fill)
        pdf.cell(col_w[1], 5, f' {s}', 1, 0, 'L', fill=fill)
        pdf.cell(col_w[2], 5, f' {v}', 1, 0, 'L', fill=fill)
        pdf.cell(col_w[3], 5, f' {f_}', 1, 1, 'L', fill=fill)
    pdf.ln(2)

    # ── SECTION 4: AMOUNT PAYABLE ──
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, 'SECTION 4: FINANCIAL LIABILITY - AMOUNT PAYABLE', 0, 1, 'L')
    pdf._thin_line()
    pdf.set_font('Times', '', 9)
    pdf.multi_cell(0, 4.5,
        f'Under CG Land Revenue Code, 1959 and CG Municipal Corporation Act, 1956, '
        f'the following is assessed against the owner/occupant of plot {plot_id}:'
    )
    pdf.ln(1)

    # Financial table
    fin_w = [85, 45, 60]
    pdf.set_font('Times', 'B', 8)
    pdf.set_fill_color(0, 0, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(fin_w[0], 5.5, ' Description', 1, 0, 'L', fill=True)
    pdf.cell(fin_w[1], 5.5, ' Reference', 1, 0, 'L', fill=True)
    pdf.cell(fin_w[2], 5.5, ' Amount (INR)', 1, 1, 'R', fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 8.5)

    pdf.set_fill_color(235, 235, 235)
    pdf.cell(fin_w[0], 5, ' Statutory Penalty', 1, 0, 'L')
    pdf.cell(fin_w[1], 5, ' Sec 248, CG LRC', 1, 0, 'L')
    pdf.cell(fin_w[2], 5, f' Rs. {fine_statutory:,}', 1, 1, 'R')

    pdf.cell(fin_w[0], 5, f' Land Recovery ({area_excess_sqm:.1f} m2 @ Rs.{LAND_RATE_PER_SQFT}/sqft)', 1, 0, 'L', fill=True)
    pdf.cell(fin_w[1], 5, ' Civil Damages', 1, 0, 'L', fill=True)
    pdf.cell(fin_w[2], 5, f' Rs. {civil_liability:,}', 1, 1, 'R', fill=True)

    if duration_penalty > 0:
        pdf.cell(fin_w[0], 5, f' Duration Surcharge ({months_violating} mo @ Rs.{monthly_penalty_rate:,}/mo)', 1, 0, 'L')
        pdf.cell(fin_w[1], 5, ' Ongoing violation', 1, 0, 'L')
        pdf.cell(fin_w[2], 5, f' Rs. {duration_penalty:,}', 1, 1, 'R')

    pdf.set_font('Times', 'B', 9)
    pdf.set_fill_color(0, 0, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(fin_w[0] + fin_w[1], 6, ' TOTAL AMOUNT PAYABLE', 1, 0, 'R', fill=True)
    pdf.cell(fin_w[2], 6, f' Rs. {total_liability:,}', 1, 1, 'R', fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(1)

    pdf.set_font('Times', 'B', 9)
    pdf.multi_cell(0, 4.5,
        f'Total: Rs. {total_liability:,}/- (Rupees {_number_to_words(total_liability)} Only). '
        f'Deposit within 15 days of receipt.'
    )
    pdf.ln(2)

    # Directives
    pdf.set_font('Times', 'B', 9)
    pdf.cell(0, 5, 'DIRECTIVES:', 0, 1, 'L')
    pdf.set_font('Times', '', 8.5)
    pdf.multi_cell(0, 4.5,
        '1. Immediately cease all unauthorized construction and land-use activities.\n'
        f'2. Deposit Rs. {total_liability:,}/- within 15 days.\n'
        '3. Restore land to designated industrial use or face summary eviction.\n'
        '4. Appear before Revenue Court / Tahsildar on the scheduled hearing date.\n'
        '5. Produce allotment documents, building permissions, and land records.'
    )
    pdf.ln(1)

    # Warning
    pdf.set_font('Times', 'B', 8)
    pdf.multi_cell(0, 4,
        'WARNING: Non-compliance within 15 days shall result in: (a) Demolition of unauthorized '
        'structures at your cost, (b) Recovery of dues as arrears of land revenue, '
        '(c) Cancellation of plot allotment, (d) Criminal prosecution under applicable CG laws.'
    )
    pdf.ln(3)

    # Signature
    pdf.set_font('Times', '', 9)
    pdf.cell(100, 5, '', 0, 0)
    pdf.cell(90, 5, 'By Order,', 0, 1, 'L')
    pdf.ln(6)
    pdf.cell(100, 5, '', 0, 0)
    pdf.set_font('Times', 'B', 9)
    pdf.cell(90, 5, 'Authorized Signatory', 0, 1, 'L')
    pdf.cell(100, 5, '', 0, 0)
    pdf.set_font('Times', '', 8)
    pdf.cell(90, 4, 'Revenue & Land Estate Mgmt. Dept., CSIDC', 0, 1, 'L')
    pdf.ln(2)
    pdf.set_font('Times', 'I', 7)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 3.5, 'CC: District Collector, Sub-Divisional Officer, CSIDC MD, Tahsildar', 0, 1, 'L')
    pdf.set_text_color(0, 0, 0)

    # ══════════════════════════════════════════════════════════════
    #  PAGE 2 — HINDI
    # ══════════════════════════════════════════════════════════════
    if pdf._hindi:
        pdf._is_hindi_page = True
        pdf.add_page()

        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Hindi', '', 9)
        pdf.cell(95, 5, f'\u0938\u0902\u0926\u0930\u094d\u092d: {ref_no}', 0, 0, 'L')
        pdf.cell(95, 5, f'\u0926\u093f\u0928\u093e\u0902\u0915: {date_str}', 0, 1, 'R')
        pdf.ln(2)

        # Title bar
        pdf.set_fill_color(0, 0, 0)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font('Hindi', 'B', 12)
        pdf.cell(0, 8, '  \u0905\u0927\u093f\u0938\u0942\u091a\u0928\u093e  -  \u0915\u093e\u0930\u0923 \u092c\u0924\u093e\u0913 \u0928\u094b\u091f\u093f\u0938', 0, 1, 'C', fill=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)

        # Recipient
        pdf.set_font('Hindi', 'B', 9)
        pdf.cell(0, 5, '\u0938\u0947\u0935\u093e \u092e\u0947\u0902:', 0, 1, 'L')
        pdf.set_font('Hindi', '', 9)
        pdf.cell(0, 4.5, f'   \u092a\u094d\u0932\u0949\u091f {plot_id} \u0915\u0947 \u092a\u0902\u091c\u0940\u0915\u0943\u0924 \u0938\u094d\u0935\u093e\u092e\u0940 / \u0905\u0927\u093f\u0935\u093e\u0938\u0940', 0, 1, 'L')
        pdf.cell(0, 4.5, '   CSIDC \u0914\u0926\u094d\u092f\u094b\u0917\u093f\u0915 \u0915\u094d\u0937\u0947\u0924\u094d\u0930, \u091b\u0924\u094d\u0924\u0940\u0938\u0917\u0922\u093c', 0, 1, 'L')
        pdf.ln(2)

        # ── Section 1: WHY (Hindi) ──
        pdf.set_font('Hindi', 'B', 10)
        pdf.cell(0, 6, '\u0916\u0902\u0921 1: \u092f\u0939 \u0938\u0942\u091a\u0928\u093e \u0915\u094d\u092f\u094b\u0902 \u091c\u093e\u0930\u0940 \u0915\u0940 \u0917\u0908', 0, 1, 'L')
        pdf._thin_line()
        pdf.set_font('Hindi', '', 9)
        pdf.multi_cell(0, 5,
            f'\u0909\u0926\u094d\u092f\u094b\u0917\u0917\u0922\u093c AI \u0909\u092a\u0917\u094d\u0930\u0939 \u0928\u093f\u0917\u0930\u093e\u0928\u0940 \u092a\u094d\u0930\u0923\u093e\u0932\u0940 \u0928\u0947 \u0906\u092a\u0915\u0947 \u092a\u094d\u0932\u0949\u091f ({plot_id}) \u092a\u0930 '
            f'\u0905\u0928\u0927\u093f\u0915\u0943\u0924 \u0917\u0924\u093f\u0935\u093f\u0927\u093f \u0915\u093e \u092a\u0924\u093e \u0932\u0917\u093e\u092f\u093e \u0939\u0948\u0964 \u0909\u092a\u0917\u094d\u0930\u0939 \u091a\u093f\u0924\u094d\u0930\u094b\u0902 \u0938\u0947 \u092a\u094d\u0930\u092e\u093e\u0923\u093f\u0924 \u0939\u094b\u0924\u093e \u0939\u0948 \u0915\u093f \u0906\u092a\u0915\u0940 \u092d\u0942\u092e\u093f '
            f'\u092a\u0930 \u0906\u0935\u0902\u091f\u0928 \u0936\u0930\u094d\u0924\u094b\u0902 \u0915\u093e \u0909\u0932\u094d\u0932\u0902\u0918\u0928 \u0939\u094b \u0930\u0939\u093e \u0939\u0948 - \u0905\u0928\u0927\u093f\u0915\u0943\u0924 \u0928\u093f\u0930\u094d\u092e\u093e\u0923, '
            f'\u0938\u0940\u092e\u093e \u0938\u0947 \u092a\u0930\u0947 \u0905\u0924\u093f\u0915\u094d\u0930\u092e\u0923, \u092f\u093e \u0917\u0948\u0930-\u0914\u0926\u094d\u092f\u094b\u0917\u093f\u0915 \u092d\u0942\u092e\u093f \u0909\u092a\u092f\u094b\u0917\u0964'
        )
        pdf.ln(2)

        # ── Section 2: DURATION (Hindi) ──
        pdf.set_font('Hindi', 'B', 10)
        pdf.cell(0, 6, '\u0916\u0902\u0921 2: \u0909\u0932\u094d\u0932\u0902\u0918\u0928 \u0915\u0940 \u0905\u0935\u0927\u093f', 0, 1, 'L')
        pdf._thin_line()
        pdf.set_font('Hindi', '', 9)
        if timeline_data and months_violating > 0:
            pdf.multi_cell(0, 5,
                f'12 \u092e\u093e\u0939 \u0915\u0947 \u0938\u0947\u0902\u091f\u093f\u0928\u0947\u0932-1 SAR \u0909\u092a\u0917\u094d\u0930\u0939 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923 \u0915\u0947 \u0906\u0927\u093e\u0930 \u092a\u0930, \u092a\u094d\u0932\u0949\u091f {plot_id} \u092a\u0930 '
                f'\u0905\u0924\u093f\u0915\u094d\u0930\u092e\u0923 {duration_hi}\n'
                f'\u0905\u0924\u093f\u0915\u094d\u0930\u092e\u093f\u0924 \u0915\u094d\u0937\u0947\u0924\u094d\u0930\u092b\u0932 {min_area:.1f} \u0935\u0930\u094d\u0917 \u092e\u0940\u091f\u0930 \u0938\u0947 {max_area:.1f} \u0935\u0930\u094d\u0917 \u092e\u0940\u091f\u0930 \u0924\u0915 \u0925\u093e, '
                f'\u091c\u094b \u0928\u093f\u0930\u0902\u0924\u0930 \u0909\u0932\u094d\u0932\u0902\u0918\u0928 \u0915\u0940 \u092a\u0941\u0937\u094d\u091f\u093f \u0915\u0930\u0924\u093e \u0939\u0948\u0964'
            )
        else:
            pdf.multi_cell(0, 5,
                f'\u092a\u094d\u0932\u0949\u091f {plot_id} \u092a\u0930 \u0909\u0932\u094d\u0932\u0902\u0918\u0928 \u0928\u0935\u0940\u0928\u0924\u092e \u0909\u092a\u0917\u094d\u0930\u0939 \u092a\u093e\u0938 \u092e\u0947\u0902 \u092a\u0939\u091a\u093e\u0928\u093e \u0917\u092f\u093e\u0964 '
                f'\u0938\u0939\u0940 \u0906\u0930\u0902\u092d \u0924\u093f\u0925\u093f \u0915\u094d\u0937\u0947\u0924\u094d\u0930 \u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923 \u0926\u094d\u0935\u093e\u0930\u093e \u0928\u093f\u0930\u094d\u0927\u093e\u0930\u093f\u0924 \u0915\u0940 \u091c\u093e\u090f\u0917\u0940\u0964'
            )
        pdf.ln(2)

        # ── Section 3: TECHNICAL BASIS (Hindi) ──
        pdf.set_font('Hindi', 'B', 10)
        pdf.cell(0, 6, '\u0916\u0902\u0921 3: \u0924\u0915\u0928\u0940\u0915\u0940 \u0906\u0927\u093e\u0930', 0, 1, 'L')
        pdf._thin_line()
        pdf.set_font('Hindi', '', 9)
        pdf.multi_cell(0, 5,
            f'\u092a\u094d\u0930\u093e\u0925\u092e\u093f\u0915 \u092a\u0939\u091a\u093e\u0928 \u0906\u0927\u093e\u0930: {primary_hi}\u0964\n\n'
            f'(a) NDVI \u0935\u0928\u0938\u094d\u092a\u0924\u093f \u0938\u0942\u091a\u0915\u093e\u0902\u0915 (Sentinel-2):\n'
            f'    \u0938\u094d\u0915\u094b\u0930: {ndvi_display}  |  \u0938\u0940\u092e\u093e: 0.20  |  \u092e\u0942\u0932\u094d\u092f\u093e\u0902\u0915\u0928: {ndvi_str}\n\n'
            f'(b) VV \u0930\u0921\u093e\u0930 \u092c\u0948\u0915\u0938\u094d\u0915\u0948\u091f\u0930 (Sentinel-1 SAR):\n'
            f'    \u0938\u094d\u0915\u094b\u0930: {radar_display}  |  \u0938\u0940\u092e\u093e: -11.0 dB  |  \u092e\u0942\u0932\u094d\u092f\u093e\u0902\u0915\u0928: {radar_str}\n\n'
            f'AI \u0935\u093f\u0936\u094d\u0935\u093e\u0938 \u0938\u094d\u0915\u094b\u0930: {conf_display}'
        )
        pdf.ln(2)

        # ── Section 4: AMOUNT PAYABLE (Hindi) ──
        pdf.set_font('Hindi', 'B', 10)
        pdf.cell(0, 6, '\u0916\u0902\u0921 4: \u0926\u0947\u092f \u0930\u093e\u0936\u093f - \u0935\u093f\u0924\u094d\u0924\u0940\u092f \u0926\u093e\u092f\u093f\u0924\u094d\u0935', 0, 1, 'L')
        pdf._thin_line()
        pdf.set_font('Hindi', '', 9)
        pdf.multi_cell(0, 5,
            f'\u091b.\u0917. \u092d\u0942-\u0930\u093e\u091c\u0938\u094d\u0935 \u0938\u0902\u0939\u093f\u0924\u093e, 1959 \u090f\u0935\u0902 \u091b.\u0917. \u0928\u0917\u0930 \u0928\u093f\u0917\u092e \u0905\u0927\u093f\u0928\u093f\u092f\u092e, 1956 \u0915\u0947 \u0905\u0927\u0940\u0928:\n\n'
            f'1. \u0935\u0948\u0927\u093e\u0928\u093f\u0915 \u091c\u0941\u0930\u094d\u092e\u093e\u0928\u093e: Rs. {fine_statutory:,}/-\n'
            f'2. \u092d\u0942\u092e\u093f \u0935\u0938\u0942\u0932\u0940 ({area_excess_sqm:.1f} m2 @ Rs.{LAND_RATE_PER_SQFT}/sqft): Rs. {civil_liability:,}/-\n'
            + (f'3. \u0905\u0935\u0927\u093f \u0905\u0927\u093f\u092d\u093e\u0930 ({months_violating} \u092e\u093e\u0939 @ Rs.{monthly_penalty_rate:,}/\u092e\u093e\u0939): Rs. {duration_penalty:,}/-\n' if duration_penalty > 0 else '')
            + f'\n\u0915\u0941\u0932 \u0926\u0947\u092f \u0930\u093e\u0936\u093f: Rs. {total_liability:,}/- (\u0930\u0941\u092a\u092f\u0947 {_number_to_words(total_liability)} \u092e\u093e\u0924\u094d\u0930)\n'
            f'\u092a\u094d\u0930\u093e\u092a\u094d\u0924\u093f \u0915\u0947 15 \u0926\u093f\u0928\u094b\u0902 \u0915\u0947 \u092d\u0940\u0924\u0930 \u091c\u092e\u093e \u0915\u0930\u0947\u0902\u0964'
        )
        pdf.ln(2)

        # Directives Hindi
        pdf.set_font('Hindi', 'B', 9)
        pdf.cell(0, 5, '\u0928\u093f\u0930\u094d\u0926\u0947\u0936:', 0, 1, 'L')
        pdf.set_font('Hindi', '', 9)
        pdf.multi_cell(0, 5,
            '1. \u0938\u092d\u0940 \u0905\u0928\u0927\u093f\u0915\u0943\u0924 \u0928\u093f\u0930\u094d\u092e\u093e\u0923 \u090f\u0935\u0902 \u092d\u0942\u092e\u093f \u0909\u092a\u092f\u094b\u0917 \u0917\u0924\u093f\u0935\u093f\u0927\u093f\u092f\u093e\u0902 \u0924\u0941\u0930\u0902\u0924 \u092c\u0902\u0926 \u0915\u0930\u0947\u0902\u0964\n'
            f'2. Rs. {total_liability:,}/- 15 \u0926\u093f\u0928\u094b\u0902 \u092e\u0947\u0902 \u091c\u092e\u093e \u0915\u0930\u0947\u0902\u0964\n'
            '3. \u092d\u0942\u092e\u093f \u0915\u094b \u0928\u093f\u0930\u094d\u0927\u093e\u0930\u093f\u0924 \u0914\u0926\u094d\u092f\u094b\u0917\u093f\u0915 \u0909\u092a\u092f\u094b\u0917 \u092e\u0947\u0902 \u092a\u0941\u0928\u0903\u0938\u094d\u0925\u093e\u092a\u093f\u0924 \u0915\u0930\u0947\u0902\u0964\n'
            '4. \u0928\u093f\u0930\u094d\u0927\u093e\u0930\u093f\u0924 \u0938\u0941\u0928\u0935\u093e\u0908 \u0924\u093f\u0925\u093f \u092a\u0930 \u0930\u093e\u091c\u0938\u094d\u0935 \u0928\u094d\u092f\u093e\u092f\u093e\u0932\u092f / \u0924\u0939\u0938\u0940\u0932\u0926\u093e\u0930 \u0915\u0947 \u0938\u092e\u0915\u094d\u0937 \u0909\u092a\u0938\u094d\u0925\u093f\u0924 \u0939\u094b\u0902\u0964\n'
            '5. \u0938\u092d\u0940 \u0906\u0935\u0902\u091f\u0928 \u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c, \u092d\u0935\u0928 \u0905\u0928\u0941\u092e\u0924\u093f \u090f\u0935\u0902 \u092d\u0942\u092e\u093f \u0905\u092d\u093f\u0932\u0947\u0916 \u092a\u094d\u0930\u0938\u094d\u0924\u0941\u0924 \u0915\u0930\u0947\u0902\u0964'
        )
        pdf.ln(1)

        # Warning Hindi
        pdf.set_font('Hindi', 'B', 8)
        pdf.multi_cell(0, 4.5,
            '\u091a\u0947\u0924\u093e\u0935\u0928\u0940: 15 \u0926\u093f\u0928\u094b\u0902 \u092e\u0947\u0902 \u0905\u0928\u0941\u092a\u093e\u0932\u0928 \u0928 \u0915\u0930\u0928\u0947 \u092a\u0930: (\u0915) \u0906\u092a\u0915\u0940 \u0932\u093e\u0917\u0924 \u092a\u0930 \u0905\u0928\u0927\u093f\u0915\u0943\u0924 \u0928\u093f\u0930\u094d\u092e\u093e\u0923 \u0927\u094d\u0935\u0938\u094d\u0924\u0940\u0915\u0930\u0923, '
            '(\u0916) \u092d\u0942-\u0930\u093e\u091c\u0938\u094d\u0935 \u092c\u0915\u093e\u092f\u093e \u0915\u0947 \u0930\u0942\u092a \u092e\u0947\u0902 \u0935\u0938\u0942\u0932\u0940, '
            '(\u0917) \u092a\u094d\u0932\u0949\u091f \u0906\u0935\u0902\u091f\u0928 \u0930\u0926\u094d\u0926, (\u0918) \u0932\u093e\u0917\u0942 \u0915\u093e\u0928\u0942\u0928\u094b\u0902 \u0915\u0947 \u0924\u0939\u0924 \u0906\u092a\u0930\u093e\u0927\u093f\u0915 \u0905\u092d\u093f\u092f\u094b\u091c\u0928\u0964'
        )
        pdf.ln(3)

        # Signature Hindi
        pdf.set_font('Hindi', '', 9)
        pdf.cell(100, 5, '', 0, 0)
        pdf.cell(90, 5, '\u0906\u0926\u0947\u0936 \u0926\u094d\u0935\u093e\u0930\u093e,', 0, 1, 'L')
        pdf.ln(6)
        pdf.cell(100, 5, '', 0, 0)
        pdf.set_font('Hindi', 'B', 9)
        pdf.cell(90, 5, '\u0905\u0927\u093f\u0915\u0943\u0924 \u0939\u0938\u094d\u0924\u093e\u0915\u094d\u0937\u0930\u0915\u0930\u094d\u0924\u093e', 0, 1, 'L')
        pdf.cell(100, 5, '', 0, 0)
        pdf.set_font('Hindi', '', 8)
        pdf.cell(90, 4, '\u0930\u093e\u091c\u0938\u094d\u0935 \u090f\u0935\u0902 \u092d\u0942-\u0938\u0902\u092a\u0926\u093e \u092a\u094d\u0930\u092c\u0902\u0927\u0928 \u0935\u093f\u092d\u093e\u0917, CSIDC', 0, 1, 'L')

    filename = f"NOTICE_{plot_id}_{date_short}.pdf"
    filepath = os.path.join(PDF_DIR, filename)
    pdf.output(filepath)
    return filename


def _number_to_words(n):
    """Convert a number to Indian English words (for cheque-style amount display)."""
    if n == 0:
        return 'Zero'
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def two_digits(num):
        if num < 20:
            return ones[num]
        return tens[num // 10] + ('' if num % 10 == 0 else ' ' + ones[num % 10])

    def three_digits(num):
        if num < 100:
            return two_digits(num)
        return ones[num // 100] + ' Hundred' + ('' if num % 100 == 0 else ' and ' + two_digits(num % 100))

    # Indian numbering: Lakh (1,00,000), Crore (1,00,00,000)
    parts = []
    if n >= 10000000:
        parts.append(two_digits(n // 10000000) + ' Crore')
        n %= 10000000
    if n >= 100000:
        parts.append(two_digits(n // 100000) + ' Lakh')
        n %= 100000
    if n >= 1000:
        parts.append(two_digits(n // 1000) + ' Thousand')
        n %= 1000
    if n > 0:
        parts.append(three_digits(n))
    return ' '.join(parts)

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

        # Satellite evidence data (optional, for gazette-format notice)
        ndvi_score = data.get('ndvi_score')
        ndvi_status = data.get('ndvi_status')
        radar_score = data.get('radar_score')
        radar_status = data.get('radar_status')
        confidence_score = data.get('confidence_score')
        total_area_sqm = data.get('total_area_sqm')
        utilization_ratio = data.get('utilization_ratio')
        timeline_data = data.get('timeline_data')  # list of {date, encroached_area}

        filename = create_notice(
            plot_id, violation, excess_area_sqm,
            ndvi_score=ndvi_score, ndvi_status=ndvi_status,
            radar_score=radar_score, radar_status=radar_status,
            confidence_score=confidence_score,
            total_area_sqm=total_area_sqm,
            utilization_ratio=utilization_ratio,
            timeline_data=timeline_data
        )
        filepath = os.path.join(PDF_DIR, filename)
        return jsonify({
            "message": "Legal Notice Generated Successfully (Rajpatra Format)",
            "file": filename,
            "download_link": f"/download/{filename}",
            "path": os.path.abspath(filepath)
        })
    except Exception as e:
        print(f"❌ Notice Generation Error: {str(e)}")
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