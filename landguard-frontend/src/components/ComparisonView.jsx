import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Layers, Eye, AlertTriangle, CheckCircle, Loader2,
    ArrowLeftRight, Maximize2
} from 'lucide-react';
import axios from 'axios';

// ─── Stable map sync: only syncs FROM the map the user is interacting with ───
// Uses a module-level variable to track which map is "primary" (user-driven)
let activeMapId = null;
let isSyncing = false;

function MapSync({ mapRef, otherMapRef, mapId }) {
    const map = useMap();

    useEffect(() => {
        mapRef.current = map;

        // Track which map the user is interacting with
        const onInteractionStart = () => {
            activeMapId = mapId;
        };

        const syncOther = () => {
            // Only sync if THIS map is the one the user is actively using
            if (activeMapId !== mapId) return;
            if (isSyncing) return;
            if (!otherMapRef.current || otherMapRef.current === map) return;

            isSyncing = true;
            const center = map.getCenter();
            const zoom = map.getZoom();
            otherMapRef.current.setView(center, zoom, { animate: false });

            // Use a timeout instead of rAF for more reliable lock release
            setTimeout(() => { isSyncing = false; }, 50);
        };

        // Detect user interaction on this map's container
        const container = map.getContainer();
        container.addEventListener('mousedown', onInteractionStart);
        container.addEventListener('touchstart', onInteractionStart);
        container.addEventListener('wheel', onInteractionStart);

        // Only sync on end events — avoid per-frame firing entirely
        map.on('moveend', syncOther);
        map.on('zoomend', syncOther);

        return () => {
            container.removeEventListener('mousedown', onInteractionStart);
            container.removeEventListener('touchstart', onInteractionStart);
            container.removeEventListener('wheel', onInteractionStart);
            map.off('moveend', syncOther);
            map.off('zoomend', syncOther);
        };
    }, [map, mapRef, otherMapRef, mapId]);

    return null;
}

// ─── Fly to plot center ───
function FlyToPlot({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 18, { duration: 1.2 });
        }
    }, [center, map]);
    return null;
}

// ─── OVERLAY LAYER TOGGLE BUTTONS ───
const overlayOptions = [
    { id: 'encroachment', label: 'Encroachment', color: '#ef4444', icon: '🔴' },
    { id: 'satellite', label: 'True Color', color: '#3b82f6', icon: '🛰️' },
    { id: 'ndvi', label: 'Vegetation', color: '#22c55e', icon: '🌿' },
    { id: 'radar', label: 'Radar VV', color: '#a855f7', icon: '📡' },
];

export default function ComparisonView({ plots, selectedPlot, onSelectPlot }) {
    const [overlayTiles, setOverlayTiles] = useState(null);
    const [areaBreakdown, setAreaBreakdown] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeOverlay, setActiveOverlay] = useState('encroachment');
    const [error, setError] = useState(null);

    const leftMapRef = useRef(null);
    const rightMapRef = useRef(null);

    // Calculate center from plot coordinates
    const getPlotCenter = (plot) => {
        if (!plot?.coordinates?.[0]) return [21.572, 81.846];
        const coords = plot.coordinates[0];
        let sumLat = 0, sumLon = 0;
        coords.forEach(c => { sumLon += c[0]; sumLat += c[1]; });
        return [sumLat / coords.length, sumLon / coords.length];
    };

    // Fetch overlay tiles when a plot is selected
    const fetchOverlayTiles = async (plot) => {
        if (!plot?.coordinates?.[0]) return;
        setLoading(true);
        setError(null);
        setOverlayTiles(null);

        try {
            const res = await axios.post('http://127.0.0.1:5001/get_overlay_tiles', {
                plot_id: plot.plot_id,
                coordinates: plot.coordinates[0]
            });

            setOverlayTiles(res.data.tiles);
            setAreaBreakdown(res.data.area_breakdown);
        } catch (err) {
            console.error('Overlay fetch error:', err);
            setError(err.response?.data?.error || 'Failed to fetch satellite overlays');
        }
        setLoading(false);
    };

    const center = getPlotCenter(selectedPlot);
    const legalPositions = selectedPlot?.coordinates?.[0]?.map(c => [c[1], c[0]]) || [];

    return (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-fade-in">
            {/* ─── Top Controls ─── */}
            <div className="flex items-center justify-between gap-4">
                {/* Plot Selector */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md">
                        <Layers size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">Boundary Comparison</h2>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Legal boundary vs satellite detection</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Plot dropdown */}
                    <select
                        value={selectedPlot?.plot_id || ''}
                        onChange={(e) => {
                            const plot = plots.find(p => p.plot_id === e.target.value);
                            if (plot) onSelectPlot(plot);
                        }}
                        className="text-sm bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                    >
                        {plots.map(p => (
                            <option key={p.plot_id} value={p.plot_id}>{p.plot_id}</option>
                        ))}
                    </select>

                    {/* Scan Button */}
                    <button
                        onClick={() => selectedPlot && fetchOverlayTiles(selectedPlot)}
                        disabled={loading || !selectedPlot}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                        {loading ? 'Scanning...' : 'Scan Plot'}
                    </button>
                </div>
            </div>

            {/* ─── Overlay Layer Selector ─── */}
            {overlayTiles && (
                <div className="flex items-center gap-2 animate-fade-in-up">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Right panel:</span>
                    {overlayOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setActiveOverlay(opt.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-200 flex items-center gap-1.5 ${activeOverlay === opt.id
                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-md'
                                : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50'
                                }`}
                        >
                            <span className="text-xs">{opt.icon}</span> {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ─── Dual Map Panels ─── */}
            <div className="flex-1 flex gap-3 min-h-0">
                {/* LEFT: Legal Boundary View */}
                <div className="flex-1 glass-intense rounded-2xl overflow-hidden shadow-xl relative border border-white/40 dark:border-white/5">
                    <div className="absolute top-3 left-3 z-[400] glass px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <CheckCircle size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Legal Boundary</span>
                    </div>

                    <MapContainer
                        center={center}
                        zoom={18}
                        className="h-full w-full"
                        scrollWheelZoom={true}
                        zoomControl={false}
                    >
                        <MapSync mapRef={leftMapRef} otherMapRef={rightMapRef} mapId="left" />
                        <FlyToPlot center={center} />

                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            attribution="&copy; Google Satellite"
                        />

                        {/* Legal boundary polygon — solid green */}
                        {legalPositions.length > 0 && (
                            <Polygon
                                positions={legalPositions}
                                pathOptions={{
                                    color: '#10b981',
                                    fillColor: '#10b981',
                                    fillOpacity: 0.2,
                                    weight: 3,
                                    dashArray: null,
                                }}
                            />
                        )}
                    </MapContainer>
                </div>

                {/* CENTER DIVIDER */}
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-px h-full bg-gradient-to-b from-transparent via-emerald-300 dark:via-emerald-700 to-transparent" />
                    <ArrowLeftRight size={16} className="text-slate-400 dark:text-slate-600 flex-shrink-0" />
                    <div className="w-px h-full bg-gradient-to-b from-transparent via-emerald-300 dark:via-emerald-700 to-transparent" />
                </div>

                {/* RIGHT: Satellite Detection View */}
                <div className="flex-1 glass-intense rounded-2xl overflow-hidden shadow-xl relative border border-white/40 dark:border-white/5">
                    <div className="absolute top-3 left-3 z-[400] glass px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <AlertTriangle size={12} className="text-red-500" />
                        <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                            {overlayOptions.find(o => o.id === activeOverlay)?.label || 'Detection'}
                        </span>
                    </div>

                    <MapContainer
                        center={center}
                        zoom={18}
                        className="h-full w-full"
                        scrollWheelZoom={true}
                        zoomControl={false}
                    >
                        <MapSync mapRef={rightMapRef} otherMapRef={leftMapRef} mapId="right" />
                        <FlyToPlot center={center} />

                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            attribution="&copy; Google Satellite"
                        />

                        {/* Legal boundary outline — dashed white on right panel */}
                        {legalPositions.length > 0 && (
                            <Polygon
                                positions={legalPositions}
                                pathOptions={{
                                    color: '#ffffff',
                                    fillColor: 'transparent',
                                    fillOpacity: 0,
                                    weight: 2,
                                    dashArray: '6, 4',
                                }}
                            />
                        )}

                        {/* GEE Overlay Tile Layer */}
                        {overlayTiles && overlayTiles[activeOverlay] && (
                            <TileLayer
                                key={activeOverlay}
                                url={overlayTiles[activeOverlay]}
                                opacity={0.75}
                                maxZoom={22}
                            />
                        )}
                    </MapContainer>

                    {/* Loading overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[450] flex flex-col items-center justify-center gap-3">
                            <Loader2 size={32} className="text-emerald-400 animate-spin" />
                            <p className="text-sm font-bold text-white">Processing GEE data...</p>
                            <p className="text-[10px] text-slate-300">Fetching Sentinel-1 & Sentinel-2 imagery</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Area Breakdown Stats ─── */}
            {areaBreakdown && (
                <div className="grid grid-cols-4 gap-3 animate-fade-in-up">
                    <div className="glass-card p-4 rounded-xl text-center">
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Plot</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{areaBreakdown.total_sqm.toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400">sq. meters</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl text-center border-red-200/50 dark:border-red-900/30">
                        <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Encroached</p>
                        <p className="text-lg font-black text-red-600 dark:text-red-400 mt-1">{areaBreakdown.encroached_sqm.toLocaleString()}</p>
                        <p className="text-[9px] text-red-400">sq. meters</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl text-center">
                        <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Clean Area</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">{areaBreakdown.clean_sqm.toLocaleString()}</p>
                        <p className="text-[9px] text-emerald-400">sq. meters</p>
                    </div>
                    <div className={`glass-card p-4 rounded-xl text-center ${areaBreakdown.encroachment_pct > 10 ? 'border-red-300 dark:border-red-800/40' : ''}`}>
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Violation %</p>
                        <p className={`text-lg font-black mt-1 ${areaBreakdown.encroachment_pct > 10 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {areaBreakdown.encroachment_pct}%
                        </p>
                        <p className="text-[9px] text-slate-400">of total area</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="glass-card p-4 rounded-xl border-red-200 dark:border-red-900/30 text-center animate-fade-in-up">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">⚠️ {error}</p>
                    <p className="text-xs text-slate-500 mt-1">Make sure the Flask backend is running on port 5000</p>
                </div>
            )}

            {/* Empty state when no overlay */}
            {!overlayTiles && !loading && !error && (
                <div className="glass-card p-6 rounded-xl text-center animate-fade-in">
                    <Eye size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Select a plot and click "Scan Plot"</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Live GEE satellite imagery will overlay on the right panel</p>
                </div>
            )}
        </div>
    );
}
