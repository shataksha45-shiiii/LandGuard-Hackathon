import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Map from './Map';
import ComparisonView from './ComparisonView';
import HomeDashboard from './HomeDashboard';
import {
  Menu, Satellite, AlertTriangle, Activity, Search, ArrowLeft,
  AlertCircle, Send, LayoutDashboard, MapPin, TrendingUp,
  Info, Shield, Eye, Zap, ChevronRight, ExternalLink, Layers, Building2,
  DollarSign, FileWarning, Download, Globe, Phone, Mail, X, Factory, Landmark, Warehouse
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = `http://${window.location.hostname}:5001`;

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

// ─────────────────────── ZONE CONFIG ───────────────────────
const ZONES = [
  {
    id: 'khapri',
    name: 'Khapri Khurd',
    file: '/plots.geojson',
    center: [21.572, 81.846],
    location: 'Khapri Khurd Industrial Area',
    district: 'District Durg',
    color: 'blue',
    plotCount: 0
  },
  {
    id: 'siyarpali',
    name: 'Siyarpali',
    file: '/map.geojson',
    center: [21.871, 83.493],
    location: 'Siyarpali Industrial Zone',
    district: 'District Raigarh',
    color: 'blue',
    plotCount: 0
  }
];

// ─────────────────────── ABOUT SECTION ───────────────────────
const AboutSection = () => {
  const features = [
    {
      icon: <Satellite className="w-6 h-6" />,
      title: 'Satellite Intelligence',
      desc: 'Real-time monitoring via Sentinel-1 radar and Sentinel-2 optical data from European Space Agency\'s Copernicus Programme for CSIDC industrial areas.'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Encroachment Detection',
      desc: 'AI-powered analysis using NDVI vegetation indexing and SAR backscatter thresholds to detect unauthorized constructions on government industrial land.'
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Continuous Surveillance',
      desc: '24/7 all-weather monitoring using Synthetic Aperture Radar that works through clouds, day or night — protecting CSIDC industrial assets.'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Instant Legal Action',
      desc: 'Auto-generate official legal notices under relevant CG State Industrial laws with verified satellite evidence for rapid enforcement.'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-8 space-y-8 animate-fade-in">

        {/* Hero Card — Government Styled */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-400">
          {/* Tricolor bar */}
          <div className="tricolor-bar" />
          <div className="p-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <img
                  src="https://csidc.in/wp-content/uploads/2022/07/44.jpg"
                  alt="CSIDC Logo"
                  className="w-24 h-24 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-[#1b3a4b] dark:text-blue-400 font-heading">
                  UdyogGadh — Automated Satellite Surveillance
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Chhattisgarh State Industrial Development Corporation Limited
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Department of Commerce & Industry, Government of Chhattisgarh
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-4 leading-relaxed">
                  UdyogGadh is a real-time satellite-based encroachment detection system developed for CSIDC.
                  It leverages Sentinel-1 (Radar) and Sentinel-2 (Optical) satellite imagery to identify
                  unauthorized constructions on industrial plots across Chhattisgarh's industrial areas,
                  enabling swift administrative and legal action.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {features.map((f, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5 hover:border-[#1b3a4b] dark:hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1b3a4b] to-[#24505f] text-white flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1b3a4b] dark:text-blue-400">{f.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Government Links / Contact */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-sm font-bold text-[#1b3a4b] dark:text-blue-400 uppercase tracking-wider mb-4">Important Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="https://csidc.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 hover:underline">
              <Globe size={14} /> CSIDC Official Website
            </a>
            <a href="https://cgstate.gov.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 hover:underline">
              <Globe size={14} /> Government of Chhattisgarh
            </a>
            <a href="https://industries.cg.gov.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 hover:underline">
              <Globe size={14} /> Dept. of Commerce & Industries
            </a>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-[10px] text-slate-500 dark:text-slate-500">
              Head Office: Udyog Bhawan, Ring Road No.-1, Telibandha, Raipur - 492006, Chhattisgarh, India
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────── EXECUTIVE SUMMARY ───────────────────────
const ExecutiveSummary = ({ plots, activeZone }) => {
  const totalAreaSqKm = plots.reduce((sum, p) => sum + (p.area_sqkm || 0), 0);
  const excessAreaSqKm = plots.reduce((sum, p) => sum + (p.analysis_data?.area?.excess_area_sqkm || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1b3a4b] to-[#24505f] text-white shadow-md">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1b3a4b] dark:text-blue-400 font-heading">{activeZone?.name || 'Zone'} — Statistics Overview</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time industrial zone monitoring | CSIDC</p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
          <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 p-5 rounded-2xl hover:shadow-lg transition-all duration-300">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Total Plots Mapped</p>
            <p className="text-3xl font-black text-[#1b3a4b] dark:text-blue-400 mt-2">{plots.length}</p>
            <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-[#1b3a4b] dark:bg-blue-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/30 p-5 rounded-lg">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Potential Violations</p>
            <p className="text-3xl font-black text-red-600 dark:text-red-400 mt-2">{plots.filter(p => p.is_violating).length}</p>
            <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${(plots.filter(p => p.is_violating).length / Math.max(plots.length, 1)) * 100}%` }} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-lg">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Total Area Mapped</p>
            <p className="text-2xl font-black text-[#1b3a4b] dark:text-blue-400 mt-2">{totalAreaSqKm.toFixed(3)} km²</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(totalAreaSqKm * 100).toFixed(0)} hectares</p>
          </div>
          <div className={`bg-white dark:bg-slate-800 border p-5 rounded-lg ${excessAreaSqKm > 0 ? 'border-red-200 dark:border-red-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${excessAreaSqKm > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>Excess Area Used</p>
            <p className={`text-2xl font-black mt-2 ${excessAreaSqKm > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{excessAreaSqKm.toFixed(4)} km²</p>
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
  const [activeView, setActiveView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [openZonePanel, setOpenZonePanel] = useState(null); // which zone category icon is open

  // --- REAL DATA STATE ---
  const [plots, setPlots] = useState([]);
  const [mapCenter, setMapCenter] = useState(ZONES[0].center);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [_generatedReports, setGeneratedReports] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // --- ZONE STATE ---
  const [activeZone, setActiveZone] = useState(ZONES[0]);
  const [allZonesData, setAllZonesData] = useState({});
  const [zoneCounts, setZoneCounts] = useState({});

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper: parse GeoJSON features into plot objects
  const parseGeoJSON = (data, zone) => {
    return data.features
      .filter(feature => feature.geometry.type === "Polygon")
      .map((feature, index) => {
        // Fix: Strip Z-axis (altitude) from coordinates to prevent GEE errors
        const rawRing = feature.geometry?.coordinates?.[0];
        if (!rawRing || rawRing.length === 0) return null;

        const cleanRing = rawRing.map(pt => pt.slice(0, 2));
        const cleanCoords = [cleanRing];

        const areaKmSq = calculatePolygonArea(cleanRing);
        return {
          plot_id: feature.properties.name || `PLOT-${index}`,
          location: zone.location,
          zone_id: zone.id,
          is_violating: false,
          coordinates: cleanCoords,
          description: 'Awaiting Live Satellite Scan...',
          analysis_data: null,
          area_sqkm: areaKmSq,
          area_sqm: areaKmSq * 1_000_000
        };
      })
      .filter(p => p !== null); // Filter out invalid plots
  };

  // 1. Load ALL GeoJSON zones on mount
  useEffect(() => {
    Promise.all(
      ZONES.map(zone =>
        fetch(zone.file)
          .then(res => res.json())
          .then(data => ({ zone, plots: parseGeoJSON(data, zone) }))
          .catch(() => {
            showNotification(`❌ Failed to load ${zone.name} data`);
            return { zone, plots: [] };
          })
      )
    ).then(results => {
      const zonesData = {};
      const counts = {};
      results.forEach(({ zone, plots: zonePlots }) => {
        zonesData[zone.id] = zonePlots;
        counts[zone.id] = zonePlots.length;
      });
      setAllZonesData(zonesData);
      setZoneCounts(counts);

      // Set initial zone
      const initialPlots = zonesData[ZONES[0].id] || [];
      setPlots(initialPlots);
      if (initialPlots.length > 0) setSelectedPlot(initialPlots[0]);
      showNotification(`✅ Loaded ${Object.values(counts).reduce((a, b) => a + b, 0)} plots across ${results.length} zones`);
    });
  }, []);

  // Switch active zone
  const handleZoneSwitch = (zone) => {
    if (zone.id === activeZone.id) return;
    setActiveZone(zone);
    const zonePlots = allZonesData[zone.id] || [];
    setPlots(zonePlots);
    setSelectedPlot(zonePlots.length > 0 ? zonePlots[0] : null);
    setMapCenter(zone.center);
    setTimelineData([]);
    setSearchQuery('');
    showNotification(`📍 Switched to ${zone.name} — ${zonePlots.length} plots`);
  };

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
        axios.post(`${API_BASE}/analyze_plot`, {
          plot_id: plot.plot_id,
          coordinates: plot.coordinates[0]
        }),
        axios.post(`${API_BASE}/analyze_timeline`, {
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
    setLoading(true);
    try {
      showNotification("⏳ Generating Legal Notice...");

      // Step 1: Request PDF generation from backend with area data
      const response = await axios.post(`${API_BASE}/generate_notice`, {
        plot_id: selectedPlot.plot_id,
        violation: selectedPlot.description,
        excess_area_sqm: selectedPlot.analysis_data?.area?.excess_area_sqm || 0
      });

      const { file, download_link } = response.data;
      const downloadUrl = `${API_BASE}${download_link}`;
      const fileName = file || 'LegalNotice.pdf';

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
    { id: 'home', label: 'Home', icon: <Building2 size={20} /> },
    { id: 'map', label: 'Live Map', icon: <MapPin size={20} /> },
    { id: 'comparison', label: 'Comparison', icon: <Layers size={20} /> },
    { id: 'dashboard', label: 'Statistics', icon: <LayoutDashboard size={20} /> },
    { id: 'about', label: 'About', icon: <Info size={20} /> },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-govt text-slate-900 dark:text-slate-100">

      {/* ─────── TOP GOVERNMENT BANNER ─────── */}
      <div className="govt-header flex-shrink-0">
        {/* Tricolor bar */}
        <div className="tricolor-bar" />
        {/* Main banner */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            {/* National Emblem (Ashoka Pillar) */}
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/120px-Emblem_of_India.svg.png"
              alt="National Emblem of India"
              className="h-16 w-auto object-contain brightness-0 invert"
            />
            {/* CG State Emblem */}
            <div className="h-16 w-16 flex items-center justify-center bg-white/90 rounded-full p-1">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Coat_of_arms_of_Chhattisgarh.svg/200px-Coat_of_arms_of_Chhattisgarh.svg.png"
                alt="Chhattisgarh State Emblem"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="border-l border-white/20 pl-5">
              <h1 className="text-2xl font-bold text-white font-heading tracking-wide leading-tight">
                Chhattisgarh State Industrial Development Corporation
              </h1>
              <p className="text-sm text-blue-200 font-medium mt-0.5">
                छत्तीसगढ़ राज्य औद्योगिक विकास निगम लिमिटेड | Department of Commerce & Industry, Govt. of Chhattisgarh
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-[10px] text-blue-300">
              <ThemeToggle />
              <span className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${loading
                ? 'bg-amber-900/30 text-amber-300 border border-amber-700/30'
                : 'bg-green-900/30 text-green-300 border border-green-700/30'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                {loading ? 'SCANNING...' : 'SYSTEM ONLINE'}
              </span>
              <span className="text-blue-400 font-mono">{currentTime}</span>
            </div>
            {/* CSIDC Logo */}
            <img
              src="https://csidc.in/wp-content/uploads/2022/07/44.jpg"
              alt="CSIDC"
              className="h-16 w-auto object-contain rounded"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-4 border-l-[#003366] rounded-lg px-5 py-3 shadow-lg z-[9999] notif-animate">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#003366] dark:text-blue-400" /> {notification}
          </p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ─────── Sidebar Navigation ─────── */}
        <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} govt-sidebar transition-all duration-300 flex flex-col z-20 flex-shrink-0`}>
          {/* Sidebar Toggle */}
          <div className="h-12 flex items-center justify-between px-3 border-b border-white/10">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Menu size={18} className="text-white/80" />
            </button>
            {sidebarOpen && (
              <span className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider">Navigation</span>
            )}
          </div>

          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scrollbar">
            {/* Nav Items */}
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeView === item.id
                  ? 'bg-white/15 text-white font-bold border-l-2 border-[#FF9933]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                  }`}
              >
                {item.icon} {sidebarOpen && <span className="text-[15px]">{item.label}</span>}
                {activeView === item.id && sidebarOpen && (
                  <ChevronRight size={14} className="ml-auto text-[#FF9933]" />
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          {sidebarOpen && (
            <div className="p-3 border-t border-white/10 animate-fade-in">
              <div className="flex items-center gap-2 px-2">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                <span className="text-[10px] font-semibold text-white/40">{loading ? 'Processing...' : 'System Ready'}</span>
              </div>
            </div>
          )}
        </aside>

        {/* ─────── Content Area ─────── */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Secondary Nav Bar */}
          <div className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-700 flex items-center px-4 gap-2 z-10 flex-shrink-0">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-400 ${activeView === item.id
                  ? 'bg-gradient-to-r from-[#1b3a4b] to-[#24505f] text-white shadow-md shadow-[#1b3a4b]/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                {item.label}
              </button>
            ))}
            <div className="flex-1" />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            {activeView === 'home' ? (
              <HomeDashboard onNavigate={setActiveView} />
            ) : activeView === 'about' ? (
              <AboutSection />
            ) : activeView === 'dashboard' ? (
              <ExecutiveSummary plots={plots} activeZone={activeZone} />
            ) : activeView === 'comparison' ? (
              <ComparisonView
                plots={plots}
                allZonesData={allZonesData}
                selectedPlot={selectedPlot}
                onSelectPlot={handlePlotClick}
                activeZone={activeZone}
                loading={loading}
                timelineData={timelineData}
                timelineLoading={timelineLoading}
                onGenerateNotice={handleGenerateNotice}
              />
            ) : (
              <>
                {/* Map Panel */}
                <div className="flex-[2] bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm relative border border-slate-200 dark:border-slate-700 transition-all duration-300">
                  <Map plots={plots} onPlotClick={handlePlotClick} center={mapCenter} />

                  {/* ─── CSIDC Geoportal-style Zone Sidebar + Flyout ─── */}
                  <div className="absolute top-3 left-3 z-[500] flex items-start gap-0">
                    {/* Vertical Icon Bar */}
                    <div className="flex flex-col gap-2">
                      {ZONES.map(zone => {
                        const isActive = openZonePanel === zone.id;
                        const icons = { khapri: <Factory size={22} />, siyarpali: <Warehouse size={22} /> };
                        return (
                          <button
                            key={zone.id}
                            onClick={() => {
                              if (isActive) {
                                setOpenZonePanel(null);
                              } else {
                                setOpenZonePanel(zone.id);
                                handleZoneSwitch(zone);
                              }
                            }}
                            className={`w-[82px] flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl shadow-lg border-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer ${isActive
                              ? 'bg-[#3b82f6] border-[#3b82f6] text-white scale-105 shadow-blue-300/40'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-[#003366] dark:text-blue-400 hover:border-[#3b82f6]/50 hover:shadow-xl hover:scale-[1.03]'
                              }`}
                          >
                            <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                              {icons[zone.id] || <Building2 size={22} />}
                            </div>
                            <span className={`text-[10px] font-bold text-center leading-tight transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                              }`}>
                              {zone.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Slide-out Panel */}
                    <div
                      className={`ml-2 transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] origin-left ${openZonePanel
                        ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto'
                        : 'opacity-0 -translate-x-4 scale-95 pointer-events-none'
                        }`}
                    >
                      {openZonePanel && (() => {
                        const zone = ZONES.find(z => z.id === openZonePanel);
                        if (!zone) return null;
                        return (
                          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-[300px] overflow-hidden">
                            {/* Panel Header */}
                            <div className="bg-[#3b82f6] px-4 py-3 flex items-center justify-between">
                              <h3 className="text-white font-bold text-base tracking-wide">{zone.name} Area</h3>
                              <button
                                onClick={() => setOpenZonePanel(null)}
                                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-all duration-200"
                              >
                                <X size={18} />
                              </button>
                            </div>
                            {/* Panel Body */}
                            <div className="p-4 space-y-4">
                              <div>
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{zone.location}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{zone.district} · {zoneCounts[zone.id] || 0} plots</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Select Industrial Plot</p>
                                <select
                                  value={selectedPlot?.plot_id || ''}
                                  onChange={(e) => {
                                    const plot = plots.find(p => p.plot_id === e.target.value);
                                    if (plot) handlePlotClick(plot);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/50 cursor-pointer transition-all duration-200"
                                >
                                  <option value="" disabled>------Select an industrial plot------</option>
                                  {plots.map(plot => (
                                    <option key={plot.plot_id} value={plot.plot_id}>
                                      {plot.plot_id}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Coordinates badge */}
                  <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-md z-[400] text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <MapPin size={12} className="text-[#003366] dark:text-blue-400" />
                    {mapCenter[0].toFixed(3)}, {mapCenter[1].toFixed(3)} | 1:1000
                  </div>
                </div>


              </>
            )}
          </div>
        </main>
      </div >
    </div >
  );
}
