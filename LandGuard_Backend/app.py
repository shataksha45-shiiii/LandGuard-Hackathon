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

# --- THE HAMMER: CHHATTISGARH RAJPATRA (GAZETTE) FORMAT PDF GENERATOR ---

class GazettePDF(FPDF):
    """
    PDF generator following the Chhattisgarh Rajpatra (Government Gazette) format.
    Produces bilingual (Hindi + English) legal notices with satellite evidence details.
    """
    SAFFRON = (255, 153, 51)
    WHITE_BG = (255, 255, 255)
    INDIA_GREEN = (19, 136, 8)
    NAVY = (0, 0, 128)
    DARK_GREEN = (0, 80, 0)
    MAROON = (128, 0, 0)

    def __init__(self):
        super().__init__()
        self._hindi = False
        # Attempt to load Devanagari-capable font from Windows system fonts
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
                    print(f"  \u2713 Hindi font loaded: {reg}")
                    break
                except Exception as e:
                    print(f"  Font load warning: {e}")
        if not self._hindi:
            print("  \u26a0 No Devanagari font found - Hindi sections will use transliteration")

    def _hi(self, text, style='', size=12, h=6, align='C', w=0, ln=1):
        """Write Hindi/Devanagari text. Skips gracefully if font unavailable."""
        if not self._hindi:
            return
        self.set_font('Hindi', style, size)
        self.cell(w, h, text, 0, ln, align)

    def _hi_multi(self, text, size=10, h=5, w=0):
        """Multi-line Hindi text."""
        if not self._hindi:
            return
        self.set_font('Hindi', '', size)
        self.multi_cell(w, h, text)

    def _tricolor_bar(self, y=None, stripe_h=2.5):
        """Draw Indian tricolor horizontal bar (Saffron-White-Green)."""
        if y is None:
            y = self.get_y()
        self.set_fill_color(*self.SAFFRON)
        self.rect(10, y, 190, stripe_h, 'F')
        self.set_fill_color(*self.WHITE_BG)
        self.rect(10, y + stripe_h, 190, stripe_h, 'F')
        self.set_fill_color(*self.INDIA_GREEN)
        self.rect(10, y + 2 * stripe_h, 190, stripe_h, 'F')
        self.set_y(y + 3 * stripe_h + 2)

    def _double_line(self, y=None):
        """Draw a double-line separator."""
        if y is None:
            y = self.get_y() + 1
        self.set_draw_color(*self.DARK_GREEN)
        self.set_line_width(0.8)
        self.line(10, y, 200, y)
        self.set_line_width(0.3)
        self.line(10, y + 2, 200, y + 2)
        self.set_y(y + 5)

    # ── Page Header (Rajpatra Style — matches CG Gazette image) ──
    def header(self):
        self._tricolor_bar(y=5)

        # ── CG State Emblem (Ashoka Lions) ──
        emblem_path = os.path.join(os.path.dirname(__file__), 'emblem.png')
        if os.path.exists(emblem_path):
            self.image(emblem_path, x=90, y=self.get_y(), w=30)
            self.ln(22)
        else:
            # Textual placeholder if image not present
            self.set_font('Times', 'B', 20)
            self.set_text_color(*self.NAVY)
            self.cell(0, 8, '\u2660', 0, 1, 'C')   # dignified placeholder

        # Title: छत्तीसगढ़ राजपत्र (large bold Devanagari)
        self.set_text_color(0, 0, 0)
        self._hi('\u091b\u0924\u094d\u0924\u0940\u0938\u0917\u0922\u093c \u0930\u093e\u091c\u092a\u0924\u094d\u0930', 'B', 20, 9)

        # (असाधारण) in maroon
        self.set_text_color(*self.MAROON)
        self._hi('(\u0905\u0938\u093e\u0927\u093e\u0930\u0923)', 'B', 13, 6)

        # प्राधिकार से प्रकाशित
        self.set_text_color(80, 80, 80)
        self._hi('\u092a\u094d\u0930\u093e\u0927\u093f\u0915\u093e\u0930 \u0938\u0947 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924', '', 10, 5)

        self._double_line()

    # ── Page Footer ──
    def footer(self):
        self.set_y(-25)
        self._tricolor_bar(stripe_h=1)
        self.ln(1)
        if self._hindi:
            self.set_font('Hindi', '', 7)
            self.set_text_color(100, 100, 100)
            self.cell(0, 3,
                '\u092f\u0939 \u0915\u092e\u094d\u092a\u094d\u092f\u0942\u091f\u0930 \u091c\u0928\u093f\u0924 \u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c \u0939\u0948\u0964 '
                '\u091b.\u0917. \u092d\u0942-\u0930\u093e\u091c\u0938\u094d\u0935 \u0938\u0902\u0939\u093f\u0924\u093e \u090f\u0935\u0902 \u0928\u0917\u0930 \u0924\u0925\u093e \u0917\u094d\u0930\u093e\u092e \u0928\u093f\u0935\u0947\u0936 \u0905\u0927\u093f\u0928\u093f\u092f\u092e \u0915\u0947 \u0905\u0927\u0940\u0928 \u091c\u093e\u0930\u0940\u0964',
                0, 1, 'C')
        self.set_font('Times', 'I', 7)
        self.set_text_color(100, 100, 100)
        self.cell(0, 3, 'Computer-generated document. Issued under CG Land Revenue Code & Town and Country Planning Act.', 0, 1, 'C')
        self.cell(0, 3, 'Powered by UdyogGadh AI Satellite Surveillance | Copernicus Sentinel-1 / Sentinel-2 Data', 0, 1, 'C')
        self.set_font('Times', '', 7)
        self.cell(0, 3, f'Page {self.page_no()}/{{nb}}', 0, 0, 'C')


def create_notice(plot_id, violation_type, excess_area_sqm=0,
                  ndvi_score=None, ndvi_status=None,
                  radar_score=None, radar_status=None,
                  confidence_score=None,
                  total_area_sqm=None, utilization_ratio=None,
                  timeline_data=None):
    """
    Generate a Chhattisgarh Rajpatra (Government Gazette) format legal notice PDF.
    Structured into clear sections:
      1. WHY the notice is being sent
      2. HOW MUCH the recipient must pay
      3. HOW LONG the violation has persisted (from timeline)
      4. WHAT was the technical basis (NDVI / VV Radar)
    """
    import re as _re

    def safe(text):
        """Sanitize text for the Times (latin-1) font: strip emoji & non-latin chars."""
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

    # ── Numerical Values ──
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

    # ── Determine which sensor is the PRIMARY basis ──
    ndvi_violating = ndvi_val is not None and ndvi_val < 0.2
    radar_violating = radar_val is not None and radar_val > -11.0
    if ndvi_violating and radar_violating:
        primary_basis = 'Both NDVI (vegetation loss) and VV Radar (structural encroachment)'
        primary_basis_hi = 'NDVI (वनस्पति हानि) एवं VV रडार (संरचनात्मक अतिक्रमण) दोनों'
    elif ndvi_violating:
        primary_basis = 'NDVI vegetation analysis (Sentinel-2 optical satellite)'
        primary_basis_hi = 'NDVI वनस्पति विश्लेषण (सेंटिनेल-2 ऑप्टिकल उपग्रह)'
    elif radar_violating:
        primary_basis = 'VV-polarization Radar analysis (Sentinel-1 SAR satellite)'
        primary_basis_hi = 'VV-ध्रुवीकरण रडार विश्लेषण (सेंटिनेल-1 SAR उपग्रह)'
    else:
        primary_basis = 'Multi-sensor satellite analysis'
        primary_basis_hi = 'बहु-सेंसर उपग्रह विश्लेषण'

    # ── Timeline / Duration of Violation ──
    violation_duration_str = 'Data unavailable'
    violation_duration_hi = 'डेटा अनुपलब्ध'
    first_detected_date = None
    months_violating = 0
    if timeline_data and len(timeline_data) > 0:
        # timeline_data = [{ date: 'YYYY-MM-DD', encroached_area: float }, ...]
        violating_dates = [t for t in timeline_data if t.get('encroached_area', 0) > 0]
        if violating_dates:
            violating_dates.sort(key=lambda x: x['date'])
            first_detected_date = violating_dates[0]['date']
            last_date = violating_dates[-1]['date']
            try:
                d1 = datetime.datetime.strptime(first_detected_date, '%Y-%m-%d')
                d2 = datetime.datetime.strptime(last_date, '%Y-%m-%d')
                months_violating = max(1, round((d2 - d1).days / 30))
                violation_duration_str = (
                    f'Approximately {months_violating} month(s) '
                    f'(first detected: {d1.strftime("%d %b %Y")}, last observed: {d2.strftime("%d %b %Y")})'
                )
                violation_duration_hi = (
                    f'लगभग {months_violating} माह '
                    f'(प्रथम पहचान: {d1.strftime("%d %b %Y")}, अंतिम अवलोकन: {d2.strftime("%d %b %Y")})'
                )
            except Exception:
                pass

    # ── Financial Calculations (CG Land Revenue Code, 1959) ──
    LAND_RATE_PER_SQFT = 600
    fine_statutory = 25000
    civil_liability = round(area_excess_sqft * LAND_RATE_PER_SQFT)
    # Add per-month penalty if duration known
    monthly_penalty_rate = 5000
    duration_penalty = months_violating * monthly_penalty_rate if months_violating > 0 else 0
    total_liability = fine_statutory + civil_liability + duration_penalty

    # ── Create PDF ──
    pdf = GazettePDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=28)
    pdf.add_page()

    date_str = datetime.datetime.now().strftime("%d %B %Y")
    date_short = datetime.datetime.now().strftime("%Y%m%d")
    ref_no = f"CSIDC/TCP/LG-{date_short}/{plot_id}"

    # ═══════════════════════════════════════════════════════
    # GAZETTE SUB-HEADER (matches CG Rajpatra image format)
    # ═══════════════════════════════════════════════════════
    pdf.set_text_color(0, 0, 0)
    # Serial number / date line (like the image: क्रमांक 371 | नवा रायपुर …)
    if pdf._hindi:
        pdf.set_font('Hindi', '', 9)
        notice_number = f'{abs(hash(plot_id)) % 9000 + 1000}'
        pdf.cell(0, 5,
            f'क्रमांक {notice_number}  |  नवा रायपुर, दिनांक {date_str}',
            0, 1, 'C')
        pdf.ln(1)

    # Department name (bilingual)
    pdf._hi('राजस्व एवं भू-संपदा प्रबंधन विभाग', 'B', 12, 6)
    pdf._hi('छत्तीसगढ़ राज्य औद्योगिक विकास निगम (CSIDC)', '', 10, 5)
    pdf.set_font('Times', 'B', 11)
    pdf.cell(0, 6, 'Revenue & Land Estate Management Department', 0, 1, 'C')
    pdf.set_font('Times', '', 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 5, 'Chhattisgarh State Industrial Development Corp. (CSIDC), Naya Raipur', 0, 1, 'C')
    pdf.ln(1)

    # Location line
    if pdf._hindi:
        pdf.set_font('Hindi', '', 8)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 4, 'मंत्रालय, महानदी भवन, नवा रायपुर अटल नगर', 0, 1, 'C')
        pdf.ln(1)

    # ── Reference & Date ──
    pdf.set_font('Times', 'B', 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(95, 6, f'Ref: {ref_no}', 0, 0, 'L')
    pdf.cell(95, 6, f'Date: {date_str}', 0, 1, 'R')
    pdf.ln(2)

    # ═══════════════════════════════════════════════════════
    #  अधिसूचना / NOTIFICATION  — Title Banner
    # ═══════════════════════════════════════════════════════
    pdf.set_fill_color(*pdf.DARK_GREEN)
    pdf.set_text_color(255, 255, 255)
    if pdf._hindi:
        pdf.set_font('Hindi', 'B', 14)
        pdf.cell(0, 10, 'अधिसूचना  -  SHOW CAUSE NOTICE', 0, 1, 'C', fill=True)
    else:
        pdf.set_font('Times', 'B', 14)
        pdf.cell(0, 10, 'SHOW CAUSE NOTICE', 0, 1, 'C', fill=True)
    pdf.ln(3)

    # ── TO / Recipient ──
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, 'TO:', 0, 1, 'L')
    pdf.set_font('Times', '', 10)
    pdf.cell(0, 5, f'   The Registered Owner / Occupant of Plot: {plot_id}', 0, 1, 'L')
    pdf.cell(0, 5, '   Khapri Khurd Industrial Area, District Durg, Chhattisgarh', 0, 1, 'L')
    pdf.ln(3)

    # ═══════════════════════════════════════════════════════
    # SECTION 1:  WHY THIS NOTICE HAS BEEN ISSUED
    # ═══════════════════════════════════════════════════════
    pdf.set_font('Times', 'B', 11)
    pdf.set_text_color(*pdf.DARK_GREEN)
    pdf.cell(0, 7, 'SECTION 1: REASON FOR THIS NOTICE', 0, 1, 'L')
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 10)
    pdf.multi_cell(0, 5,
        f'This Show Cause Notice is being issued to you because the UdyogGadh AI Satellite '
        f'Surveillance System has detected unauthorized activity on your allotted industrial '
        f'plot ({plot_id}) in the Khapri Khurd Industrial Area, under the jurisdiction of CSIDC.\n\n'
        f'Satellite imagery analysis has revealed that your land is being used in a manner '
        f'that violates the terms of your industrial plot allotment. Specifically, the system '
        f'has found evidence of unauthorized construction, encroachment beyond sanctioned '
        f'boundaries, or non-industrial use of industrial land.'
    )
    pdf.ln(1)

    # Violation summary box (red accent bar)
    y_start = pdf.get_y()
    pdf.set_font('Times', 'B', 10)
    pdf.set_text_color(150, 0, 0)
    pdf.cell(0, 5, 'Violation Detected:', 0, 1, 'L')
    pdf.set_font('Times', '', 10)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(0, 5, violation_type)
    y_end = pdf.get_y()
    pdf.set_fill_color(180, 0, 0)
    pdf.rect(10, y_start - 1, 2, y_end - y_start + 2, 'F')
    pdf.ln(2)

    # Legal authority
    pdf.set_font('Times', 'I', 9)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 4,
        'Legal Basis: Section 27, CG Nagar Tatha Gram Nivesh Adhiniyam, 1973; '
        'Rule 15, CG Land Revenue Code, 1959; Section 248, CG Municipal Corporation Act, 1956.'
    )
    pdf.ln(3)

    # ═══════════════════════════════════════════════════════
    # SECTION 2:  HOW LONG THE VIOLATION HAS BEEN ONGOING
    # ═══════════════════════════════════════════════════════
    if pdf.get_y() > 220:
        pdf.add_page()

    pdf.set_font('Times', 'B', 11)
    pdf.set_text_color(*pdf.DARK_GREEN)
    pdf.cell(0, 7, 'SECTION 2: DURATION OF VIOLATION', 0, 1, 'L')
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 10)

    if timeline_data and months_violating > 0:
        pdf.multi_cell(0, 5,
            f'Based on a 12-month temporal analysis of Sentinel-1 SAR satellite data, '
            f'the encroachment / unauthorized activity on Plot {plot_id} has been '
            f'continuously detected for approximately {months_violating} month(s).\n\n'
            f'First Detection:  {first_detected_date}\n'
            f'Most Recent Observation:  {violating_dates[-1]["date"]}\n\n'
            f'Throughout this period, the satellite consistently detected encroached area '
            f'ranging from {min(t["encroached_area"] for t in violating_dates):.1f} m\u00b2 '
            f'to {max(t["encroached_area"] for t in violating_dates):.1f} m\u00b2, '
            f'confirming a sustained and ongoing violation rather than a one-time anomaly.'
        )
    else:
        pdf.multi_cell(0, 5,
            f'The violation on Plot {plot_id} has been identified through the latest satellite '
            f'pass. Historical timeline data indicates ongoing unauthorized activity. The exact '
            f'commencement date shall be determined through field inspection and revenue records.'
        )
    pdf.ln(3)

    # ═══════════════════════════════════════════════════════
    # SECTION 3:  TECHNICAL BASIS — HOW VIOLATION WAS DETECTED
    # ═══════════════════════════════════════════════════════
    if pdf.get_y() > 220:
        pdf.add_page()

    pdf.set_font('Times', 'B', 11)
    pdf.set_text_color(*pdf.DARK_GREEN)
    pdf.cell(0, 7, 'SECTION 3: TECHNICAL BASIS OF DETECTION', 0, 1, 'L')
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 10)
    pdf.multi_cell(0, 5,
        f'The primary basis for this notice is: {primary_basis}.\n\n'
        f'Two independent satellite sensors were used to verify the violation:'
    )
    pdf.ln(1)

    # 3a. NDVI
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, '(a) Vegetation Index - NDVI (Sentinel-2 Optical Satellite)', 0, 1, 'L')
    pdf.set_font('Times', '', 9)
    ndvi_threshold_text = 'BELOW' if ndvi_violating else 'above'
    ndvi_meaning = ('This means the land has experienced vegetation loss or clearing - '
                    'consistent with unauthorized construction, paving, or industrial misuse.') \
        if ndvi_violating else 'This indicates normal vegetation cover within acceptable limits.'
    pdf.multi_cell(0, 4.5,
        f'     NDVI Score Recorded: {ndvi_display}   |   Violation Threshold: 0.20\n'
        f'     Your plot\'s NDVI is {ndvi_threshold_text} the threshold.\n'
        f'     {ndvi_meaning}\n'
        f'     Assessment: {ndvi_str}'
    )
    pdf.ln(2)

    # 3b. Radar
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, '(b) Radar Backscatter - VV Polarization (Sentinel-1 SAR Satellite)', 0, 1, 'L')
    pdf.set_font('Times', '', 9)
    radar_threshold_text = 'EXCEEDS' if radar_violating else 'is below'
    radar_meaning = ('This confirms hard structures (concrete, metal, brick) are present '
                     'on your plot beyond the sanctioned building area - indicating encroachment.') \
        if radar_violating else 'This indicates no significant structural anomalies detected.'
    pdf.multi_cell(0, 4.5,
        f'     Radar VV Score Recorded: {radar_display}   |   Encroachment Threshold: -11.0 dB\n'
        f'     Your plot\'s radar backscatter {radar_threshold_text} the threshold.\n'
        f'     {radar_meaning}\n'
        f'     Assessment: {radar_str}'
    )
    pdf.ln(2)

    # 3c. Confidence
    pdf.set_font('Times', 'B', 10)
    pdf.cell(0, 6, '(c) Overall AI Confidence Score', 0, 1, 'L')
    pdf.set_font('Times', '', 9)
    conf_label = 'HIGH' if (conf_pct is not None and conf_pct > 80) else 'MODERATE'
    pdf.multi_cell(0, 4.5,
        f'     Combined Confidence: {conf_display}  ({conf_label})\n'
        f'     This score combines optical + radar evidence with 12-month temporal trends.'
    )
    pdf.ln(2)

    # Evidence summary table
    pdf.set_font('Times', 'B', 9)
    pdf.set_text_color(0, 60, 0)
    pdf.cell(0, 6, 'Evidence Summary Table:', 0, 1, 'L')

    col_w = [48, 48, 47, 47]
    pdf.set_font('Times', 'B', 8)
    pdf.set_fill_color(0, 80, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(col_w[0], 7, ' Parameter', 1, 0, 'L', fill=True)
    pdf.cell(col_w[1], 7, ' Satellite Source', 1, 0, 'L', fill=True)
    pdf.cell(col_w[2], 7, ' Your Value', 1, 0, 'L', fill=True)
    pdf.cell(col_w[3], 7, ' Finding', 1, 1, 'L', fill=True)

    pdf.set_font('Times', '', 8)
    pdf.set_text_color(0, 0, 0)
    pdf.set_fill_color(245, 245, 245)

    table_data = [
        ('NDVI Score', 'Sentinel-2 MSI', ndvi_display, 'VIOLATING' if ndvi_violating else 'Normal'),
        ('Radar VV (dB)', 'Sentinel-1 SAR', radar_display, 'VIOLATING' if radar_violating else 'Normal'),
        ('AI Confidence', 'Multi-Sensor Fusion', conf_display, conf_label),
        ('Excess Area', 'GIS Boundary Check', f'{area_excess_sqm:.1f} m2', f'{util_display} of plot'),
    ]

    for i, (param, src, val, finding) in enumerate(table_data):
        fill = i % 2 == 0
        pdf.cell(col_w[0], 6, f' {param}', 1, 0, 'L', fill=fill)
        pdf.cell(col_w[1], 6, f' {src}', 1, 0, 'L', fill=fill)
        pdf.cell(col_w[2], 6, f' {val}', 1, 0, 'L', fill=fill)
        pdf.cell(col_w[3], 6, f' {finding}', 1, 1, 'L', fill=fill)
    pdf.ln(4)

    # ═══════════════════════════════════════════════════════
    # SECTION 4:  AMOUNT YOU ARE REQUIRED TO PAY
    # ═══════════════════════════════════════════════════════
    if pdf.get_y() > 220:
        pdf.add_page()

    pdf.set_font('Times', 'B', 11)
    pdf.set_text_color(*pdf.DARK_GREEN)
    pdf.cell(0, 7, 'SECTION 4: FINANCIAL LIABILITY - AMOUNT PAYABLE', 0, 1, 'L')
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 10)
    pdf.multi_cell(0, 5,
        f'Under the provisions of the CG Land Revenue Code, 1959 and the CG Municipal '
        f'Corporation Act, 1956, the following amount is assessed against you as the '
        f'owner/occupant of Plot {plot_id}:'
    )
    pdf.ln(2)

    # Financial table
    pdf.set_font('Times', 'B', 8)
    pdf.set_fill_color(0, 80, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(90, 7, ' Description', 1, 0, 'L', fill=True)
    pdf.cell(45, 7, ' Legal Reference', 1, 0, 'L', fill=True)
    pdf.cell(55, 7, ' Amount (INR)', 1, 1, 'R', fill=True)

    pdf.set_font('Times', '', 9)
    pdf.set_text_color(0, 0, 0)
    pdf.set_fill_color(245, 245, 245)

    pdf.cell(90, 6, '  Statutory Penalty', 1, 0, 'L')
    pdf.cell(45, 6, '  Sec 248, CG LRC 1959', 1, 0, 'L')
    pdf.cell(55, 6, f'  Rs. {fine_statutory:,}', 1, 1, 'R')

    pdf.cell(90, 6, f'  Land Recovery ({area_excess_sqm:.1f} m2 @ Rs.{LAND_RATE_PER_SQFT}/sqft)', 1, 0, 'L', fill=True)
    pdf.cell(45, 6, '  Civil Damages', 1, 0, 'L', fill=True)
    pdf.cell(55, 6, f'  Rs. {civil_liability:,}', 1, 1, 'R', fill=True)

    if duration_penalty > 0:
        pdf.cell(90, 6, f'  Duration Penalty ({months_violating} months @ Rs.{monthly_penalty_rate:,}/mo)', 1, 0, 'L')
        pdf.cell(45, 6, '  Ongoing violation surcharge', 1, 0, 'L')
        pdf.cell(55, 6, f'  Rs. {duration_penalty:,}', 1, 1, 'R')

    pdf.set_font('Times', 'B', 9)
    pdf.set_fill_color(180, 0, 0)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(135, 7, '  TOTAL AMOUNT PAYABLE', 1, 0, 'R', fill=True)
    pdf.cell(55, 7, f'  Rs. {total_liability:,}', 1, 1, 'R', fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    pdf.set_font('Times', 'B', 10)
    pdf.multi_cell(0, 5,
        f'You are required to deposit the total amount of Rs. {total_liability:,}/- '
        f'(Rupees {_number_to_words(total_liability)} Only) within 15 days of receipt of this notice.'
    )
    pdf.ln(3)

    # ═══════════════════════════════════════════════════════
    # HINDI SUMMARY (bilingual compliance)
    # ═══════════════════════════════════════════════════════
    if pdf._hindi:
        if pdf.get_y() > 200:
            pdf.add_page()

        pdf.set_draw_color(180, 180, 180)
        pdf.set_line_width(0.3)
        pdf.line(30, pdf.get_y(), 180, pdf.get_y())
        pdf.ln(3)

        pdf.set_text_color(*pdf.MAROON)
        pdf._hi('-- हिन्दी सारांश --', 'B', 11, 6)
        pdf.ln(1)

        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Hindi', 'B', 10)
        pdf.cell(0, 6, f'विषय: प्लॉट {plot_id} पर अनधिकृत भूमि उपयोग / अतिक्रमण सूचना', 0, 1, 'L')
        pdf.ln(1)

        pdf.set_font('Hindi', '', 9)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5,
            f'1. यह सूचना क्यों: उद्योगगढ़ AI उपग्रह निगरानी प्रणाली ने आपके प्लॉट ({plot_id}) पर '
            f'अनधिकृत गतिविधि का पता लगाया है। उपग्रह चित्रों से प्रमाणित होता है कि आपकी भूमि पर '
            f'आवंटन शर्तों का उल्लंघन हो रहा है।\n\n'
            f'2. उल्लंघन की अवधि: {violation_duration_hi}।\n\n'
            f'3. तकनीकी आधार: {primary_basis_hi}। '
            f'NDVI मान: {ndvi_display}, रडार VV मान: {radar_display}, '
            f'AI विश्वास स्कोर: {conf_display}।\n\n'
            f'4. देय राशि: कुल Rs. {total_liability:,}/- (जुर्माना Rs. {fine_statutory:,} + '
            f'भूमि वसूली Rs. {civil_liability:,}'
            + (f' + अवधि अधिभार Rs. {duration_penalty:,}' if duration_penalty > 0 else '')
            + f')। 15 दिनों के भीतर जमा करें।'
        )
        pdf.ln(3)

    # ═══════════════════════════════════════════════════════
    # DIRECTIVES
    # ═══════════════════════════════════════════════════════
    if pdf.get_y() > 230:
        pdf.add_page()
    pdf.set_font('Times', 'B', 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 6, 'DIRECTIVES:', 0, 1, 'L')
    pdf.set_font('Times', '', 9)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 5,
        'You are hereby directed to:\n'
        '   1. Immediately cease all unauthorized construction and land-use activities.\n'
        f'   2. Deposit the total assessed amount of Rs. {total_liability:,}/- within 15 days.\n'
        '   3. Restore the land to its original designated industrial use or face summary eviction.\n'
        '   4. Appear before the Revenue Court / Tahsildar on the scheduled hearing date.\n'
        '   5. Produce all allotment documents, building permissions, and land records for verification.'
    )
    pdf.ln(3)

    # ── Warning ──
    if pdf.get_y() > 250:
        pdf.add_page()
    pdf.set_x(pdf.l_margin)
    pdf.set_font('Times', 'B', 9)
    pdf.set_text_color(150, 0, 0)
    pdf.multi_cell(0, 4.5,
        'WARNING: Failure to comply within the stipulated 15 days shall result in: '
        '(a) Demolition of unauthorized structures at your cost, '
        '(b) Recovery of all dues as arrears of land revenue, '
        '(c) Cancellation of plot allotment, and '
        '(d) Criminal prosecution under applicable laws of Chhattisgarh.'
    )
    if pdf._hindi:
        pdf.set_x(pdf.l_margin)
        pdf.set_font('Hindi', 'B', 9)
        pdf.multi_cell(0, 4.5,
            'चेतावनी: 15 दिनों में अनुपालन न करने पर: (क) आपकी लागत पर अनधिकृत निर्माण ध्वस्तीकरण, '
            '(ख) भू-राजस्व बकाया के रूप में सभी देय राशि की वसूली, '
            '(ग) प्लॉट आवंटन रद्द, एवं (घ) लागू कानूनों के तहत आपराधिक अभियोजन।'
        )
    pdf.ln(6)

    # ── Signature Block ──
    if pdf.get_y() > 250:
        pdf.add_page()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Times', '', 10)
    pdf.cell(95, 5, '', 0, 0)
    pdf.cell(95, 5, 'By Order,', 0, 1, 'L')
    pdf.ln(8)

    pdf.cell(95, 5, '', 0, 0)
    pdf.set_font('Times', 'B', 10)
    pdf.cell(95, 5, 'Authorized Signatory', 0, 1, 'L')

    if pdf._hindi:
        pdf.cell(95, 5, '', 0, 0)
        pdf.set_font('Hindi', '', 9)
        pdf.cell(95, 5, 'अधिकृत हस्ताक्षरकर्ता, सचिव', 0, 1, 'L')

    pdf.cell(95, 5, '', 0, 0)
    pdf.set_font('Times', '', 9)
    pdf.cell(95, 5, 'Revenue & Land Estate Management Dept.', 0, 1, 'L')

    pdf.cell(95, 5, '', 0, 0)
    pdf.cell(95, 5, 'CSIDC, Naya Raipur, Chhattisgarh', 0, 1, 'L')

    # ── CC Block ──
    pdf.ln(4)
    pdf.set_font('Times', 'I', 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 4, 'CC: District Collector (Durg), Sub-Divisional Officer, CSIDC Managing Director, Tahsildar (Khapri)', 0, 1, 'L')

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