import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Map from './Map';
import {
  Menu, X, Satellite, AlertTriangle, Activity, Search, ArrowLeft,
  AlertCircle, Download, Send, BarChart3, FileText, LayoutDashboard, MapPin
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

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

const ExecutiveSummary = ({ plots }) => {
  const totalAreaSqKm = plots.reduce((sum, p) => sum + (p.area_sqkm || 0), 0);
  const excessAreaSqKm = plots.reduce((sum, p) => sum + (p.analysis_data?.area?.excess_area_sqkm || 0), 0);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Siyarpali Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase">Total Plots Mapped</p>
          <p className="text-4xl font-black text-slate-800 dark:text-white mt-2">{plots.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase">Potential Violations</p>
          <p className="text-4xl font-black text-red-600 dark:text-red-500 mt-2">{plots.filter(p => p.is_violating).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-sky-100 dark:border-sky-900/30">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase">📏 Total Area Mapped</p>
          <p className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-2">{totalAreaSqKm.toFixed(3)} km²</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(totalAreaSqKm * 100).toFixed(0)} hectares</p>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border ${excessAreaSqKm > 0 ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50' : 'border-emerald-100 dark:border-emerald-900/30'}`}>
          <p className={`text-slate-500 text-sm font-bold uppercase ${excessAreaSqKm > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>⚠️ Excess Area Used</p>
          <p className={`text-2xl font-black mt-2 ${excessAreaSqKm > 0 ? 'text-red-600 dark:text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{excessAreaSqKm.toFixed(4)} km²</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(excessAreaSqKm * 1_000_000).toFixed(0)} sq.m</p>
        </div>
      </div>
    </div>
  );
};

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

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Load Aayushi's GeoJSON into the System
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
    showNotification(`🛰️ Requesting GEE Analysis for ${plot.plot_id}...`);

    try {
      const response = await axios.post('http://127.0.0.1:5000/analyze_plot', {
        plot_id: plot.plot_id,
        coordinates: plot.coordinates[0]
      });

      setSelectedPlot(prev => ({
        ...prev,
        is_violating: response.data.is_violating,
        description: response.data.analysis_summary,
        analysis_data: {
          ndvi: response.data.vacancy_analysis,
          radar: response.data.encroachment_analysis,
          confidence: response.data.confidence_score,
          area: response.data.area_analysis
        }
      }));

      showNotification("✅ Satellite Data Received");
    } catch (err) {
      console.error(err);
      showNotification("❌ Backend Error: Check Flask Terminal");
    }
    setLoading(false);
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
      const res = await axios.post('http://127.0.0.1:5000/generate_notice', {
        plot_id: selectedPlot.plot_id,
        violation: selectedPlot.description
      });

      setGeneratedReports(prev => [{
        id: selectedPlot.plot_id,
        date: new Date().toLocaleDateString(),
        download: res.data.download_link
      }, ...prev]);

      showNotification("📄 Notice Ready for Dispatch");
    } catch (err) {
      console.error(err);
      showNotification("❌ PDF Generation Failed");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {notification && (
        <div className="fixed top-6 right-6 glass-intense border-l-4 border-emerald-500 rounded-lg px-6 py-4 shadow-2xl z-[9999] animate-bounce">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" /> {notification}
          </p>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} glass border-r border-emerald-200/50 transition-all duration-300 flex flex-col z-20`}>
        <div className="h-16 flex items-center gap-3 px-4 border-b border-emerald-200/40 dark:border-emerald-800/20">
          <Satellite className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          {sidebarOpen && <span className="font-bold text-gray-800 dark:text-gray-100 tracking-tight">LandGuard AI</span>}
        </div>
        <nav className="flex-1 py-6 px-2 space-y-2 overflow-y-auto custom-scrollbar">
          {!isSearchMode ? (
            <>
              <button onClick={() => { setIsSearchMode(true); setSidebarOpen(true); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                <Search size={20} /> {sidebarOpen && <span>Search Area</span>}
              </button>
              <div className="h-px bg-emerald-100 dark:bg-emerald-900/30 my-2 mx-2"></div>
              <button onClick={() => setActiveView('map')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg ${activeView === 'map' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                <MapPin size={20} /> {sidebarOpen && <span>Live Map</span>}
              </button>
              <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg ${activeView === 'dashboard' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                <LayoutDashboard size={20} /> {sidebarOpen && <span>Statistics</span>}
              </button>
            </>
          ) : (
            <div className="flex flex-col h-full animate-in slide-in-from-left-4 duration-300">
              <button onClick={() => setIsSearchMode(false)} className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-4 px-2 hover:underline">
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
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm border-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredPlots.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 mt-4">No plots found.</p>
                ) : (
                  filteredPlots.map(plot => (
                    <button
                      key={plot.plot_id}
                      onClick={() => handleSearchResultClick(plot)}
                      className={`w-full text-left p-3 rounded-lg border transition-all text-xs group ${selectedPlot?.plot_id === plot.plot_id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-800/50 border-transparent hover:border-emerald-100 dark:hover:border-emerald-800'}`}
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
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 glass border-b border-emerald-200/50 flex items-center justify-between px-6 z-10 dark:border-emerald-800/20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
              <Menu className="text-slate-600 dark:text-slate-300" />
            </button>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-3 py-1 rounded-full">{loading ? 'SCANNING...' : 'SYSTEM ONLINE'}</span>
            <span>{currentTime}</span>
          </div>
        </header>

        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {activeView === 'dashboard' ? <ExecutiveSummary plots={plots} /> : (
            <>
              <div className="flex-[2] glass-intense rounded-2xl overflow-hidden shadow-xl relative border border-white/50 dark:border-white/10">
                <Map plots={plots} onPlotClick={handlePlotClick} center={mapCenter} />
                <div className="absolute bottom-4 left-4 glass px-4 py-2 rounded-lg z-[400] text-[10px] font-bold text-gray-600 dark:text-gray-300">
                  COORD: {mapCenter[0]}, {mapCenter[1]} | SCALE: 1:1000
                </div>
              </div>

              <div className="w-96 glass-intense rounded-2xl border border-white/60 dark:border-white/10 p-0 flex flex-col shadow-2xl">
                <div className="p-6 border-b border-emerald-100 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <AlertCircle className="text-red-500" /> Intelligence Report
                  </h2>
                </div>

                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  {selectedPlot && (
                    <div className="animate-in slide-in-from-right-4 duration-300">
                      <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 shadow-sm mb-6">
                        <p className="text-xs text-gray-400 font-bold uppercase">TARGET ID</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white">{selectedPlot.plot_id}</p>
                      </div>

                      <div className={`p-4 rounded-lg text-center font-bold mb-6 ${selectedPlot.is_violating ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'}`}>
                        {loading ? "SCANNING PIXELS..." : selectedPlot.is_violating ? "⚠️ VIOLATION CONFIRMED" : "✅ COMPLIANT"}
                      </div>

                      {selectedPlot.analysis_data && (
                        <div className="space-y-3 mb-6">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Sensor Readings</h3>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div className="p-3 bg-slate-900 dark:bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 dark:border-slate-800">
                              <p className="text-slate-500 mb-1">NDVI INDEX</p>
                              <p className="text-lg font-bold">{selectedPlot.analysis_data.ndvi.score}</p>
                            </div>
                            <div className="p-3 bg-slate-900 dark:bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 dark:border-slate-800">
                              <p className="text-slate-500 mb-1">RADAR VV</p>
                              <p className="text-lg font-bold">{selectedPlot.analysis_data.radar.score}</p>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-1000"
                              style={{ width: `${(selectedPlot.analysis_data.confidence || 0.92) * 100}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-slate-400 text-right font-bold">AI CONFIDENCE: {(selectedPlot.analysis_data.confidence || 0.92) * 100}%</p>
                        </div>
                      )}

                      {selectedPlot.analysis_data?.area && (
                        <div className="bg-sky-50/50 dark:bg-sky-900/10 p-4 rounded-lg border border-sky-200 dark:border-sky-800/30 mb-6 space-y-3">
                          <label className="text-[10px] font-bold text-sky-800 dark:text-sky-400 uppercase">📏 Area Analysis</label>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 bg-white dark:bg-slate-800 rounded border border-sky-100 dark:border-sky-900/30">
                              <p className="text-slate-500 dark:text-slate-400 font-bold">Total Area</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPlot.analysis_data.area.total_area_sqm?.toLocaleString()} m²</p>
                              <p className="text-[8px] text-slate-500 dark:text-slate-400">{selectedPlot.analysis_data.area.total_area_sqkm} km²</p>
                            </div>
                            <div className={`p-2 bg-white dark:bg-slate-800 rounded border ${selectedPlot.is_violating ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/50' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/30'}`}>
                              <p className={`text-[10px] font-bold ${selectedPlot.is_violating ? 'text-red-800 dark:text-red-400' : 'text-emerald-800 dark:text-emerald-400'}`}>Excess Area</p>
                              <p className={`text-sm font-bold ${selectedPlot.is_violating ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{selectedPlot.analysis_data.area.excess_area_sqm?.toLocaleString()} m²</p>
                              <p className={`text-[8px] ${selectedPlot.is_violating ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{selectedPlot.analysis_data.area.excess_area_sqft} sq.ft</p>
                            </div>
                          </div>
                          {selectedPlot.is_violating && (
                            <div className="bg-gradient-to-r from-red-500 to-red-600 p-2 rounded text-white text-[9px] font-bold">
                              ⚠️ {selectedPlot.analysis_data.area.utilization_ratio}% EXCESS UTILIZATION DETECTED
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                        <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Analysis Summary</label>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 italic leading-relaxed">"{selectedPlot.description}"</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-emerald-100 dark:border-emerald-800/30 bg-gray-50/50 dark:bg-slate-900/50">
                  <button
                    onClick={handleGenerateNotice}
                    disabled={!selectedPlot?.is_violating || loading}
                    className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${selectedPlot?.is_violating ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600'}`}>
                    <Send size={18} /> {loading ? "PROCESSING..." : "ISSUE LEGAL NOTICE"}
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