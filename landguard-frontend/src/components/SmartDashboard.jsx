import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Map from './Map';
import ComparisonView from './ComparisonView';
import {
  Menu, Satellite, AlertTriangle, Activity, Search, ArrowLeft,
  AlertCircle, Send, LayoutDashboard, MapPin, TrendingUp,
  Info, Shield, Eye, Zap, ChevronRight, ExternalLink, Layers
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Utility function to calculate polygon area from lat/lon coordinates
const calculatePolygonArea = (coordinates) => {
  if (!coordinates || coordinates.length < 3) return 0;

  const R = 6371; // Earth's radius in km
  const coords = [...coordinates];

  // Close polygon if needed
  if (coords[0] !== coords[coords.length - 1]) {
    coords.push(coords[0]);
  }

  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i].slice(0, 2);
    const [lon2, lat2] = coords[i + 1].slice(0, 2);

    const lon1Rad = (lon1 * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    area += (lon2Rad - lon1Rad) * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad));
  }

  area = Math.abs((area * R * R) / 2.0);
  return area; // Returns in square km
};

// ─────────────────────── ABOUT SECTION ───────────────────────
const AboutSection = () => {
  const features = [
    {
      icon: <Satellite className="w-6 h-6" />,
      title: 'Satellite Intelligence',
      desc: 'Real-time monitoring via Sentinel-1 radar and Sentinel-2 optical data from European Space Agency\'s Copernicus Programme.'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Encroachment Detection',
      desc: 'AI-powered analysis using NDVI vegetation indexing and SAR backscatter thresholds to detect unauthorized constructions.'
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Continuous Surveillance',
      desc: '24/7 all-weather monitoring using Synthetic Aperture Radar that works through clouds, day or night.'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Instant Legal Action',
      desc: 'Auto-generate official legal notices with verified satellite evidence for rapid enforcement and compliance.'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-8 space-y-10 animate-fade-in">

        {/* Hero Card with Government Integration */}
        <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-sky-50/30 dark:from-emerald-950/20 dark:to-sky-950/10 pointer-events-none" />

          <div className="relative z-10">
            {/* Government Logos */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="flex flex-col items-center gap-2 animate-fade-in-up">
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 p-2 shadow-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center overflow-hidden">
                  <img src="/cg-govt-logo.png" alt="Government of Chhattisgarh" className="w-full h-full object-contain" />
                </div>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Govt. of CG</span>
              </div>

              <div className="flex flex-col items-center gap-1" style={{ animationDelay: '0.1s' }}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg animate-pulse-glow">
                  <Satellite className="w-7 h-7 text-white" />
                </div>
                <span className="text-xl font-black gradient-text tracking-tight mt-1">LandGuard AI</span>
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Satellite Surveillance System</span>
              </div>

              <div className="flex flex-col items-center gap-2 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 p-2 shadow-lg border border-sky-100 dark:border-sky-900/30 flex items-center justify-center overflow-hidden">
                  <img src="/csidc-logo.png" alt="CSIDC" className="w-full h-full object-contain" />
                </div>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CSIDC</span>
              </div>
            </div>

            {/* Tagline */}
            <div className="text-center max-w-2xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight mb-3">
                Protecting Public Land with<br />
                <span className="gradient-text">Satellite Intelligence</span>
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                An initiative by the <strong>Government of Chhattisgarh</strong> in collaboration with <strong>CSIDC</strong> to combat unauthorized land encroachment using Google Earth Engine, AI-powered analysis, and real-time Sentinel radar data.
              </p>
            </div>
          </div>
        </div>

        {/* Problem Statement */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> The Problem
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Industrial plots allotted by CSIDC in the Siyarpali Industrial Area are being <strong>illegally encroached upon</strong> — unauthorized constructions extend beyond sanctioned boundaries. Traditional manual surveys are <strong>slow, expensive, and prone to human error</strong>. Government officials often discover violations months or years after they occur, making enforcement difficult and costly.
          </p>
        </div>

        {/* Solution */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={16} /> Our Solution
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong>LandGuard AI</strong> leverages <strong>satellite-based radar imagery</strong> (Sentinel-1 SAR) from the European Space Agency's Copernicus programme, processed through <strong>Google Earth Engine</strong>. It detects unauthorized structures by analyzing radar backscatter patterns and vegetation changes — providing irrefutable, timestamped satellite evidence for legal action.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {features.map((f, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 group cursor-default">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                  {f.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <h3 className="text-sm font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Zap size={16} /> How It Works
          </h3>
          <div className="space-y-3">
            {[
              { step: '01', text: 'Plot boundaries are loaded from official CSIDC GeoJSON survey data.' },
              { step: '02', text: 'Click a plot to trigger live satellite analysis via Google Earth Engine.' },
              { step: '03', text: 'Sentinel-1 radar and Sentinel-2 optical data are fetched and analyzed in real-time.' },
              { step: '04', text: 'AI calculates NDVI (vegetation) and VV backscatter (structures) to detect encroachment.' },
              { step: '05', text: 'Excess area is quantified and a legal notice is auto-generated with evidence.' }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
                  {item.step}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 pt-1 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4">Powered By</h3>
          <div className="flex flex-wrap gap-2">
            {['Google Earth Engine', 'Sentinel-1 SAR', 'Sentinel-2 MSI', 'React.js', 'Flask', 'Leaflet', 'NDVI Analysis', 'Radar Backscatter'].map((tech, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-[10px] text-slate-400 dark:text-slate-600">
            © 2025 LandGuard AI — Government of Chhattisgarh × CSIDC
          </p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────── EXECUTIVE SUMMARY ───────────────────────
const ExecutiveSummary = ({ plots }) => {
  const totalAreaSqKm = plots.reduce((sum, p) => sum + (p.area_sqkm || 0), 0);
  const excessAreaSqKm = plots.reduce((sum, p) => sum + (p.analysis_data?.area?.excess_area_sqkm || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Siyarpali Overview</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time industrial zone monitoring</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 stagger-children">
          <div className="glass-card p-6 rounded-2xl">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Total Plots Mapped</p>
            <p className="text-4xl font-black text-slate-800 dark:text-white mt-2">{plots.length}</p>
            <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl border-red-100 dark:border-red-900/20">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Potential Violations</p>
            <p className="text-4xl font-black text-red-600 dark:text-red-500 mt-2">{plots.filter(p => p.is_violating).length}</p>
            <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full" style={{ width: `${(plots.filter(p => p.is_violating).length / Math.max(plots.length, 1)) * 100}%` }} />
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">📏 Total Area Mapped</p>
            <p className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-2">{totalAreaSqKm.toFixed(3)} km²</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(totalAreaSqKm * 100).toFixed(0)} hectares</p>
          </div>
          <div className={`glass-card p-6 rounded-2xl ${excessAreaSqKm > 0 ? 'border-red-200 dark:border-red-900/30' : ''}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${excessAreaSqKm > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>⚠️ Excess Area Used</p>
            <p className={`text-2xl font-black mt-2 ${excessAreaSqKm > 0 ? 'text-red-600 dark:text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{excessAreaSqKm.toFixed(4)} km²</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(excessAreaSqKm * 1_000_000).toFixed(0)} sq.m</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────── MAIN DASHBOARD ───────────────────────
export default function SmartDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  // --- REAL DATA STATE ---
  const [plots, setPlots] = useState([]);
  const [mapCenter, setMapCenter] = useState([21.871, 83.493]); // Siyarpali Coordinates
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [_generatedReports, setGeneratedReports] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Load GeoJSON into the System
  useEffect(() => {
    fetch('/map.geojson')
      .then(response => response.json())
      .then(data => {
        const realPlots = data.features
          .filter(feature => feature.geometry.type === "Polygon")
          .map((feature, index) => {
            const areaKmSq = calculatePolygonArea(feature.geometry.coordinates[0]);
            return {
              plot_id: feature.properties.name || `PLOT-${index}`,
              location: 'Siyarpali Industrial Zone',
              is_violating: false,
              coordinates: feature.geometry.coordinates,
              description: 'Awaiting Live Satellite Scan...',
              analysis_data: null,
              area_sqkm: areaKmSq,
              area_sqm: areaKmSq * 1_000_000
            };
          });

        setPlots(realPlots);
        if (realPlots.length > 0) setSelectedPlot(realPlots[0]);
      })
      .catch(() => showNotification("❌ Failed to load map.geojson"));
  }, []);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. TRIGGER REAL SATELLITE ANALYSIS
  const handlePlotClick = async (plot) => {
    setSelectedPlot({ ...plot, description: "🛰️ Initiating Live Satellite Scan...", is_violating: false });
    setLoading(true);
    setTimelineLoading(true);
    showNotification(`🛰️ Requesting GEE Analysis for ${plot.plot_id}...`);

    try {
      // Fetch current analysis and timeline data in parallel
      const [analysisResponse, timelineResponse] = await Promise.all([
        axios.post('http://127.0.0.1:5000/analyze_plot', {
          plot_id: plot.plot_id,
          coordinates: plot.coordinates[0]
        }),
        axios.post('http://127.0.0.1:5000/analyze_timeline', {
          plot_id: plot.plot_id,
          coordinates: plot.coordinates[0]
        })
      ]);

      setSelectedPlot(prev => ({
        ...prev,
        is_violating: analysisResponse.data.is_violating,
        description: analysisResponse.data.analysis_summary,
        analysis_data: {
          ndvi: analysisResponse.data.vacancy_analysis,
          radar: analysisResponse.data.encroachment_analysis,
          confidence: analysisResponse.data.confidence_score,
          area: analysisResponse.data.area_analysis
        }
      }));

      // Process timeline data for chart
      const formattedTimeline = timelineResponse.data.timeline.map(item => ({
        date: item.date,
        displayDate: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        area: item.encroached_area
      }));
      setTimelineData(formattedTimeline);

      showNotification("✅ Satellite Data Received");
    } catch (err) {
      console.error(err);
      showNotification("❌ Backend Error: Check Flask Terminal");
    }
    setLoading(false);
    setTimelineLoading(false);
  };

  // Calculate trend from timeline data
  const calculateTrend = () => {
    if (timelineData.length < 2) return null;

    // Simple linear regression slope
    const n = timelineData.length;
    const xValues = timelineData.map((_, i) => i);
    const yValues = timelineData.map(d => d.area);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  };

  // 4. SEARCH LOGIC
  const filteredPlots = plots.filter(plot =>
    String(plot.plot_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (plot.description && String(plot.description).toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSearchResultClick = (plot) => {
    handlePlotClick(plot);
    if (plot.coordinates && plot.coordinates[0]) {
      const coords = plot.coordinates[0];
      let sumLat = 0, sumLon = 0;
      coords.forEach(c => { sumLon += c[0]; sumLat += c[1]; });
      setMapCenter([sumLat / coords.length, sumLon / coords.length]);
    }
  };

  // 3. GENERATE LEGAL NOTICE
  const handleGenerateNotice = async () => {
    if (!selectedPlot?.is_violating) return;
    setLoading(true);
    showNotification("⚖️ Generating Official Notice...");

    try {
      // Step 1: Generate the PDF on the backend
      const res = await axios.post('http://127.0.0.1:5000/generate_notice', {
        plot_id: selectedPlot.plot_id,
        violation: selectedPlot.description
      });

      const downloadUrl = `http://127.0.0.1:5000${res.data.download_link}`;
      const fileName = res.data.file || 'LegalNotice.pdf';

      setGeneratedReports(prev => [{
        id: selectedPlot.plot_id,
        date: new Date().toLocaleDateString(),
        download: downloadUrl
      }, ...prev]);

      // Step 2: Download the PDF as a blob and trigger browser save
      const pdfRes = await axios.get(downloadUrl, { responseType: 'blob' });
      const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      showNotification("📄 Notice Ready - Download Complete!");
    } catch (err) {
      console.error('PDF Generation Error:', err);
      showNotification("❌ PDF Generation Failed");
    }
    setLoading(false);
  };

  // --- NAV ITEMS ---
  const navItems = [
    { id: 'map', label: 'Live Map', icon: <MapPin size={20} /> },
    { id: 'comparison', label: 'Comparison', icon: <Layers size={20} /> },
    { id: 'dashboard', label: 'Statistics', icon: <LayoutDashboard size={20} /> },
    { id: 'about', label: 'About', icon: <Info size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 glass-intense border-l-4 border-emerald-500 rounded-xl px-5 py-3.5 shadow-2xl z-[9999] notif-animate">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> {notification}
          </p>
        </div>
      )}

      {/* ─────── Sidebar Navigation ─────── */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} glass border-r border-emerald-200/30 dark:border-emerald-800/15 transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col z-20`}>
        {/* Branding */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-emerald-200/30 dark:border-emerald-800/15">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Satellite className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in">
              <span className="font-black text-sm text-gray-800 dark:text-gray-100 tracking-tight block leading-tight">LandGuard AI</span>
              <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Satellite Surveillance</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
          {!isSearchMode ? (
            <>
              {/* Search Button */}
              <button
                onClick={() => { setIsSearchMode(true); setSidebarOpen(true); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-200"
              >
                <Search size={18} /> {sidebarOpen && <span className="text-sm">Search Area</span>}
              </button>

              <div className="h-px bg-emerald-100/50 dark:bg-emerald-900/20 my-2 mx-3" />

              {/* Nav Items */}
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${activeView === item.id
                    ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-400 font-bold shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                    }`}
                >
                  {item.icon} {sidebarOpen && <span className="text-sm">{item.label}</span>}
                  {activeView === item.id && sidebarOpen && (
                    <ChevronRight size={14} className="ml-auto text-emerald-500 dark:text-emerald-400" />
                  )}
                </button>
              ))}
            </>
          ) : (
            <div className="flex flex-col h-full animate-fade-in-left">
              <button onClick={() => setIsSearchMode(false)} className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-4 px-2 hover:underline transition-colors">
                <ArrowLeft size={14} /> BACK TO MENU
              </button>

              <div className="px-1 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search Plot ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-sm border border-transparent focus:border-emerald-300 dark:focus:border-emerald-700 focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {filteredPlots.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 mt-4">No plots found.</p>
                ) : (
                  filteredPlots.map(plot => (
                    <button
                      key={plot.plot_id}
                      onClick={() => handleSearchResultClick(plot)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 text-xs group ${selectedPlot?.plot_id === plot.plot_id
                        ? 'bg-emerald-50/80 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 shadow-sm'
                        : 'bg-white/50 dark:bg-slate-800/30 border-transparent hover:border-emerald-100 dark:hover:border-emerald-800/30 hover:bg-white dark:hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`font-bold ${selectedPlot?.plot_id === plot.plot_id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{plot.plot_id}</span>
                        {plot.is_violating && <AlertTriangle size={12} className="text-red-500" />}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 truncate">{plot.description}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="p-3 border-t border-emerald-200/20 dark:border-emerald-800/10 animate-fade-in">
            <div className="flex items-center gap-2 px-2">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-500">{loading ? 'Processing...' : 'System Ready'}</span>
            </div>
          </div>
        )}
      </aside>

      {/* ─────── Content Area ─────── */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-14 glass border-b border-emerald-200/30 dark:border-emerald-800/15 flex items-center justify-between px-5 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 rounded-xl transition-all duration-200"
            >
              <Menu size={18} className="text-slate-500 dark:text-slate-400" />
            </button>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-300 ${loading
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {loading ? 'SCANNING...' : 'SYSTEM ONLINE'}
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">{currentTime}</span>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {activeView === 'about' ? (
            <AboutSection />
          ) : activeView === 'dashboard' ? (
            <ExecutiveSummary plots={plots} />
          ) : activeView === 'comparison' ? (
            <ComparisonView plots={plots} selectedPlot={selectedPlot} onSelectPlot={handlePlotClick} />
          ) : (
            <>
              {/* Map Panel */}
              <div className="flex-[2] glass-intense rounded-2xl overflow-hidden shadow-xl relative border border-white/40 dark:border-white/5 transition-all duration-300">
                <Map plots={plots} onPlotClick={handlePlotClick} center={mapCenter} />
                <div className="absolute bottom-4 left-4 glass px-4 py-2 rounded-xl z-[400] text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <MapPin size={12} className="text-emerald-500" />
                  {mapCenter[0].toFixed(3)}, {mapCenter[1].toFixed(3)} | 1:1000
                </div>
              </div>

              {/* ─────── Intelligence Report Sidebar ─────── */}
              <div className="w-96 glass-intense rounded-2xl border border-white/50 dark:border-white/5 p-0 flex flex-col shadow-2xl transition-all duration-300">
                {/* Header */}
                <div className="p-5 border-b border-emerald-100/50 dark:border-emerald-800/20 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/20">
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-500" /> Intelligence Report
                  </h2>
                </div>

                {/* Body */}
                <div className="flex-1 p-5 space-y-5 overflow-y-auto custom-scrollbar">
                  {selectedPlot && (
                    <div className="animate-fade-in-right space-y-4">
                      {/* ──── SECTION 1: Target Identification ──── */}
                      <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">TARGET IDENTIFICATION</p>
                        <p className="text-xl font-black text-gray-800 dark:text-white mt-0.5">{selectedPlot.plot_id}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Siyarpali Industrial Area, Chhattisgarh</p>
                      </div>

                      {/* ──── SECTION 2: AI Verdict ──── */}
                      <div className={`p-4 rounded-xl text-center transition-all duration-500 ${selectedPlot.is_violating
                        ? 'bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200/70 dark:from-red-900/20 dark:to-red-900/10 dark:border-red-900/40'
                        : 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/15 dark:to-emerald-900/10 dark:border-emerald-900/20'
                        }`}>
                        {loading ? (
                          <span className="flex items-center justify-center gap-2 font-bold text-sm text-slate-600 dark:text-slate-300">
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            SCANNING PIXELS...
                          </span>
                        ) : (
                          <>
                            <p className={`text-sm font-black ${selectedPlot.is_violating ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {selectedPlot.is_violating ? "⚠️ VIOLATION CONFIRMED" : "✅ COMPLIANT"}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                              {selectedPlot.is_violating
                                ? "Our AI detected unauthorized construction or structure beyond the legally permitted boundary."
                                : "No unauthorized construction or encroachment detected within the plot's legal boundary."}
                            </p>
                          </>
                        )}
                      </div>

                      {/* ──── SECTION 3: Satellite Sensor Readings ──── */}
                      {selectedPlot.analysis_data && (
                        <div className="space-y-3 animate-fade-in-up">
                          <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={12} className="text-emerald-500" />
                            Satellite Sensor Analysis
                          </h3>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-1 leading-relaxed">
                            Based on Copernicus Sentinel-1 (Radar) & Sentinel-2 (Optical) satellite imagery from the last 30 days.
                          </p>

                          {/* NDVI Reading */}
                          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-700/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  🌿 Vegetation Index (NDVI)
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Measures live plant cover using reflected light</p>
                              </div>
                              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {selectedPlot.analysis_data.ndvi.score}
                              </span>
                            </div>
                            {/* NDVI visual bar */}
                            <div className="w-full bg-gradient-to-r from-yellow-200 via-lime-300 to-emerald-500 h-2 rounded-full relative">
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-emerald-600 rounded-full shadow-md transition-all duration-700"
                                style={{ left: `${Math.max(0, Math.min(100, ((selectedPlot.analysis_data.ndvi.score + 0.1) / 0.7) * 100))}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400">
                              <span>Bare / Built</span>
                              <span>Moderate</span>
                              <span>Dense Green</span>
                            </div>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg">
                              {selectedPlot.analysis_data.ndvi.score >= 0.4
                                ? "🟢 Dense vegetation detected — land appears to be naturally covered or cultivated."
                                : selectedPlot.analysis_data.ndvi.score >= 0.15
                                  ? "🟡 Low-to-moderate vegetation — possible cleared land, degraded cover, or sparse plants."
                                  : "🔴 Very low or no vegetation — indicates bare ground, construction, or hardened surfaces."}
                            </p>
                          </div>

                          {/* Radar VV Reading */}
                          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-700/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  📡 Radar Backscatter (VV)
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Detects physical structures using radar waves</p>
                              </div>
                              <span className={`text-base font-black font-mono ${selectedPlot.analysis_data.radar.score > -11 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {selectedPlot.analysis_data.radar.score} dB
                              </span>
                            </div>
                            {/* Radar visual bar */}
                            <div className="w-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500 h-2 rounded-full relative">
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-slate-600 rounded-full shadow-md transition-all duration-700"
                                style={{ left: `${Math.max(0, Math.min(100, ((selectedPlot.analysis_data.radar.score + 25) / 25) * 100))}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400">
                              <span>−25 dB (Clear)</span>
                              <span>−11 dB (Threshold)</span>
                              <span>0 dB (Dense)</span>
                            </div>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg">
                              {selectedPlot.analysis_data.radar.score > -11
                                ? "🔴 Strong radar reflection detected — this indicates hard surfaces like concrete, metal roofing, or permanent structures."
                                : selectedPlot.analysis_data.radar.score > -18
                                  ? "🟡 Moderate reflection — possible construction, rubble, or semi-permanent structures."
                                  : "🟢 Low reflection — consistent with natural terrain, vegetation, or open land."}
                            </p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                              Threshold: Values above −11.0 dB are flagged as unauthorized construction.
                            </p>
                          </div>

                          {/* AI Confidence */}
                          <div className="p-3 bg-white/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/30 dark:border-slate-700/20 space-y-1.5">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                🧠 AI Confidence Level
                              </p>
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {((selectedPlot.analysis_data.confidence || 0.92) * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${(selectedPlot.analysis_data.confidence || 0.92) * 100}%` }}
                              />
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500">
                              Multi-sensor fusion of optical and radar data with cross-validation.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ──── SECTION 4: Land Area Breakdown ──── */}
                      {selectedPlot.analysis_data?.area && (
                        <div className="bg-sky-50/40 dark:bg-sky-900/10 p-4 rounded-xl border border-sky-200/50 dark:border-sky-800/20 space-y-3 animate-fade-in-up">
                          <h3 className="text-[10px] font-bold text-sky-800 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                            📏 Land Area Breakdown
                          </h3>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 -mt-1">
                            Comparing the registered legal boundary against satellite-detected land use.
                          </p>

                          {/* Total area */}
                          <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border border-sky-100/50 dark:border-sky-900/20 space-y-1">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Registered Plot Size</p>
                              <span className="text-sm font-black text-slate-800 dark:text-white font-mono">{selectedPlot.analysis_data.area.total_area_sqm?.toLocaleString()} m²</span>
                            </div>
                            <p className="text-[9px] text-slate-400">({selectedPlot.analysis_data.area.total_area_sqkm} km²) — Total area within the legally registered boundary from land records.</p>
                          </div>

                          {/* Excess / Encroached area */}
                          <div className={`p-3 rounded-lg border space-y-1 ${selectedPlot.is_violating
                            ? 'bg-red-50/80 dark:bg-red-900/15 border-red-200/70 dark:border-red-900/30'
                            : 'bg-emerald-50/80 dark:bg-emerald-900/15 border-emerald-200/50 dark:border-emerald-900/20'}`}>
                            <div className="flex justify-between items-center">
                              <p className={`text-[10px] font-bold ${selectedPlot.is_violating ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                {selectedPlot.is_violating ? '⚠️ Excess Encroached Area' : '✅ Excess Area'}
                              </p>
                              <span className={`text-sm font-black font-mono ${selectedPlot.is_violating ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {selectedPlot.analysis_data.area.excess_area_sqm?.toLocaleString()} m²
                              </span>
                            </div>
                            <p className={`text-[9px] ${selectedPlot.is_violating ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                              ({selectedPlot.analysis_data.area.excess_area_sqft} sq.ft) — {selectedPlot.is_violating
                                ? "Area beyond the legal boundary being occupied by unauthorized construction."
                                : "No excess utilization beyond legal boundary detected."}
                            </p>
                          </div>

                          {/* Utilization ratio visual */}
                          {selectedPlot.analysis_data.area.utilization_ratio > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-slate-600 dark:text-slate-400">Land Utilization</span>
                                <span className={`font-black ${selectedPlot.analysis_data.area.utilization_ratio > 10 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {selectedPlot.analysis_data.area.utilization_ratio}% excess
                                </span>
                              </div>
                              <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-3 rounded-full overflow-hidden relative">
                                {/* Legal 100% baseline */}
                                <div className="absolute inset-0 bg-emerald-200/60 dark:bg-emerald-900/30 rounded-full" />
                                {/* Excess overlay */}
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ease-out ${selectedPlot.analysis_data.area.utilization_ratio > 10
                                    ? 'bg-gradient-to-r from-red-400 to-red-600'
                                    : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                                  style={{ width: `${Math.min(100, selectedPlot.analysis_data.area.utilization_ratio)}%` }}
                                />
                              </div>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                                Percentage of registered area detected as excess unauthorized construction.
                              </p>
                            </div>
                          )}

                          {selectedPlot.is_violating && (
                            <div className="bg-gradient-to-r from-red-500 to-red-600 p-3 rounded-lg text-white text-[10px] font-bold shadow-sm leading-relaxed">
                              ⚠️ This plot has {selectedPlot.analysis_data.area.utilization_ratio}% excess utilization — {selectedPlot.analysis_data.area.excess_area_sqm?.toLocaleString()} m² of unauthorized construction detected beyond the legal boundary.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ──── SECTION 5: AI Summary ──── */}
                      <div className="bg-emerald-50/40 dark:bg-emerald-900/8 p-4 rounded-xl border border-emerald-100/50 dark:border-emerald-900/15">
                        <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          📋 AI Analysis Summary
                        </label>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">"{selectedPlot.description}"</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 italic">
                          Generated by LandGuard AI using multi-spectral satellite fusion analysis.
                        </p>
                      </div>

                      {/* ──── SECTION 6: Trend Analysis (Historical) ──── */}
                      {timelineData.length > 0 && (
                        <div className="bg-slate-50/50 dark:bg-slate-900/15 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/30 space-y-3 animate-fade-in-up">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-[10px] font-bold text-slate-800 dark:text-slate-300 uppercase flex items-center gap-1.5 tracking-wider">
                                <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" />
                                12-Month Trend
                              </label>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                                How encroached area has changed over the past year
                              </p>
                            </div>
                            {(() => {
                              const trend = calculateTrend();
                              if (trend === null) return null;
                              const isExpanding = trend > 0;
                              return (
                                <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${isExpanding ? 'bg-red-100/80 text-red-700 dark:bg-red-900/25 dark:text-red-400' : 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400'}`}>
                                  {isExpanding ? '📈 Expanding' : '📉 Stable'}
                                </span>
                              );
                            })()}
                          </div>

                          {timelineLoading ? (
                            <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                              <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mr-2" />
                              Loading timeline...
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height={160}>
                              <AreaChart data={timelineData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <defs>
                                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                                <XAxis
                                  dataKey="displayDate"
                                  tick={{ fontSize: 9, fill: '#64748b' }}
                                  stroke="#cbd5e1"
                                />
                                <YAxis
                                  tick={{ fontSize: 9, fill: '#64748b' }}
                                  stroke="#cbd5e1"
                                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                  }}
                                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                                  formatter={(value) => [`${value.toLocaleString()} m²`, 'Encroached Area']}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="area"
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  fill="url(#areaGradient)"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          )}

                          <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center">
                            {timelineData.length} Sentinel-1 observations over 12 months — {(() => {
                              const trend = calculateTrend();
                              if (trend === null) return "Not enough data for trend analysis.";
                              return trend > 0
                                ? "Encroachment is expanding — immediate action recommended."
                                : "Encroachment is stable or decreasing — continue monitoring.";
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="p-4 border-t border-emerald-100/30 dark:border-emerald-800/15 bg-gray-50/30 dark:bg-slate-900/30">
                  <button
                    onClick={handleGenerateNotice}
                    disabled={!selectedPlot?.is_violating || loading}
                    className={`w-full py-3.5 rounded-xl font-bold shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm ${selectedPlot?.is_violating
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white hover:shadow-red-500/20 hover:shadow-xl active:scale-[0.98]'
                      : 'bg-gray-200/80 dark:bg-slate-800/80 text-gray-400 dark:text-slate-600 cursor-not-allowed'
                      }`}>
                    <Send size={16} /> {loading ? "PROCESSING..." : "ISSUE LEGAL NOTICE"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
