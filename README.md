# 🌍 LandGuard: Satellite-Powered Land Monitoring

LandGuard is a real-time encroachment detection system designed for the CSIDC hackathon. It uses Sentinel-1 (Radar) and Sentinel-2 (Optical) satellite data to identify illegal constructions on industrial plots.

## 🚀 Getting Started (For Team Members)

### 1. Prerequisites
- Python 3.11+ installed.
- Access to the `service-account.json` (Ask Shataksha for this privately; DO NOT upload to GitHub).

### 2. Installation
```bash
# Clone the repository
git clone [https://github.com/shataksha45-shiiii/LandGuard-Hackathon.git](https://github.com/shataksha45-shiiii/LandGuard-Hackathon.git)
cd LandGuard-Hackathon

# Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install flask flask-cors earthengine-api fpdf requests