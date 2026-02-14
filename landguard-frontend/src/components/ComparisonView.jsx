import { MapContainer, TileLayer, Polygon, Tooltip, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScanLine, Sparkles } from 'lucide-react';
import IntelligenceReport from './IntelligenceReport';

const LABEL_ZOOM_THRESHOLD = 14; // Show text labels at zoom >= 14, single dot below

/* ──────────────────────────────────────────────
   Helper: compute centroid of a polygon ring
   ────────────────────────────────────────────── */
function centroid(ring) {
    if (!ring || ring.length === 0) return [0, 0];
    let lat = 0, lng = 0;
    let n = 0;
    for (const pt of ring) {
        if (Array.isArray(pt) && pt.length >= 2) {
            lat += pt[1];
            lng += pt[0];
            n++;
        }
    }
    return n > 0 ? [lat / n, lng / n] : [0, 0];
}

/* ──────────────────────────────────────────────
   SyncView — keeps two maps in lock-step
   ────────────────────────────────────────────── */
function SyncView({ syncRef, isMaster }) {
    const map = useMap();

    // Register this map in the shared ref
    useEffect(() => {
        if (isMaster) syncRef.current.master = map;
        else syncRef.current.slave = map;
        if (syncRef.current.isSyncing === undefined) syncRef.current.isSyncing = false;
    }, [map, syncRef, isMaster]);

    // Sync with a shared guard flag to prevent feedback loops
    const syncOther = useCallback(() => {
        if (syncRef.current.isSyncing) return;
        const other = isMaster ? syncRef.current.slave : syncRef.current.master;
        if (!other) return;

        syncRef.current.isSyncing = true;
        try {
            other.setView(map.getCenter(), map.getZoom(), { animate: false });
        } catch (e) { /* ignore sync errors during transitions */ }
        requestAnimationFrame(() => {
            syncRef.current.isSyncing = false;
        });
    }, [map, syncRef, isMaster]);

    useMapEvents({
        move: syncOther,
        zoom: syncOther,
    });

    return null;
}

/* ──────────────────────────────────────────────
   ZoomTracker — exposes current zoom level
   ────────────────────────────────────────────── */
function ZoomTracker({ onZoom }) {
    const map = useMap();
    useMapEvents({
        zoomend: () => onZoom(map.getZoom()),
    });
    useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
    return null;
}

/* ──────────────────────────────────────────────
   FlyTo — smooth camera flight on selection
   ────────────────────────────────────────────── */
function FlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 18, { duration: 0.8 });
    }, [center, map]);
    return null;
}

/* ──────────────────────────────────────────────
   RegionCenter — flies map to region on switch
   ────────────────────────────────────────────── */
function RegionCenter({ activeRegion, allZonesData }) {
    const map = useMap();
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (!map) return;

        try {
            if (activeRegion === 'all') {
                const allPlots = Object.values(allZonesData || {}).flat();
                if (allPlots.length === 0) return;
                const latlngs = [];
                allPlots.forEach(p => {
                    if (!p.coordinates?.[0]) return;
                    p.coordinates[0].forEach(c => {
                        if (c.length >= 2) latlngs.push([c[1], c[0]]);
                    });
                });
                if (latlngs.length > 0) {
                    const bounds = L.latLngBounds(latlngs);
                    map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5, maxZoom: 14 });
                }
                return;
            }

            const regionPlots = allZonesData?.[activeRegion];
            if (!regionPlots || regionPlots.length === 0) return;
            const latlngs = [];
            regionPlots.forEach(p => {
                if (!p.coordinates?.[0]) return;
                p.coordinates[0].forEach(c => {
                    if (c.length >= 2) latlngs.push([c[1], c[0]]);
                });
            });
            if (latlngs.length > 0) {
                const bounds = L.latLngBounds(latlngs);
                map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5, maxZoom: 17 });
            }
        } catch (err) {
            console.error('Region switch error:', err);
        }
    }, [activeRegion, allZonesData, map]);

    return null;
}

/* ================================================================
   ComparisonView component
   Left: GeoJSON plot overview — click to select
   Right: Live satellite with selected plot dashed highlight
   ================================================================ */
const ComparisonView = ({
    plots,
    allZonesData,
    selectedPlot,
    onSelectPlot,
    activeZone,
    loading,
    timelineData,
    timelineLoading,
    onGenerateNotice
}) => {
    const syncRef = useRef({ master: null, slave: null });
    const [localSelected, setLocalSelected] = useState(selectedPlot || null);
    const [zoomLevel, setZoomLevel] = useState(16);
    const [activeRegion, setActiveRegion] = useState('all'); // 'all', 'khapri', 'siyarpali'
    const [isScanning, setIsScanning] = useState(false);
    const [showReport, setShowReport] = useState(false);

    // Sync local selection with parent's selectedPlot if present on mount/update
    useEffect(() => {
        if (selectedPlot) {
            setLocalSelected(selectedPlot);
            // Show report only after analysis data is available (scan completed)
            if (selectedPlot.analysis_data) {
                setIsScanning(false);
                setShowReport(true);
            }
        }
    }, [selectedPlot]);

    // Reset isScanning when parent loading goes from true→false (backend finished or failed)
    useEffect(() => {
        if (!loading && isScanning) {
            setIsScanning(false);
            // If backend returned analysis_data, show report
            if (selectedPlot?.analysis_data) {
                setShowReport(true);
            }
        }
    }, [loading]);

    const active = localSelected;
    const showLabels = zoomLevel >= LABEL_ZOOM_THRESHOLD;

    const handleScan = () => {
        if (!active) return;
        setIsScanning(true);
        setShowReport(false);
        onSelectPlot(active);
    };

    const handleCloseReport = () => {
        setShowReport(false);
        setLocalSelected(null);
    };

    // Merge ALL zones' plots into one array
    const allPlots = useMemo(() => {
        if (!allZonesData || Object.keys(allZonesData).length === 0) return plots;
        return Object.values(allZonesData).flat();
    }, [allZonesData, plots]);

    // Auto-deselect when zoomed out past threshold
    useEffect(() => {
        if (!showLabels) setLocalSelected(null);
    }, [showLabels]);

    // Default center — centroid of first valid plot across zones or fallback
    const defaultCenter = useMemo(() => {
        if (!allPlots || allPlots.length === 0) return [21.572, 81.846];
        for (const p of allPlots) {
            if (p.coordinates?.[0]?.length > 0) {
                return centroid(p.coordinates[0]);
            }
        }
        return [21.572, 81.846];
    }, [allPlots]);

    // Handle region switch — just update state, RegionCenter component handles the map flight
    const handleRegionChange = (regionId) => {
        setActiveRegion(regionId);
        setLocalSelected(null);
        setShowReport(false);
    };

    // When a plot is clicked — local selection only (no backend call)
    const handleSelect = useCallback(
        (plot) => {
            setLocalSelected(plot);
        },
        []
    );

    // Selected plot center for flyTo
    const selectedCenter = useMemo(() => {
        if (!active?.coordinates?.[0]?.length) return null;
        return centroid(active.coordinates[0]);
    }, [active]);

    // Color based on violation status
    const plotColor = (plot) => {
        if (active && active.plot_id === plot.plot_id) return '#FF9933'; // selected = saffron
        if (plot.is_violating) return '#ef4444';
        return '#66bb6a'; // default green
    };

    const positions = useCallback(
        (plot) => {
            if (!plot.coordinates?.[0]) return [];
            return plot.coordinates[0].map((c) => [c[1], c[0]]);
        },
        []
    );

    return (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto animate-fade-in custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                <div className="flex-shrink-0">
                    <h2 className="text-lg font-bold text-[#1b3a4b] dark:text-blue-400 font-heading">
                        Plot Comparison View
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Select a plot on the left · Live satellite on the right
                    </p>
                </div>

                {/* Region Selector & Status & Scan Button */}
                <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                    {/* Search Plot Button — always visible, disabled until a plot is selected */}
                    <button
                        onClick={handleScan}
                        disabled={!active || isScanning}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 flex-shrink-0 ${
                            !active
                                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : isScanning
                                    ? 'bg-gradient-to-r from-[#FF9933] to-[#FF8000] text-white shadow-lg shadow-orange-500/30'
                                    : 'bg-gradient-to-r from-[#FF9933] to-[#FF8000] hover:from-[#FF8000] hover:to-[#E67300] text-white shadow-lg shadow-orange-500/30 hover:scale-105'
                        }`}
                    >
                        {isScanning ? (
                            <>
                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="text-xs font-bold">SCANNING...</span>
                            </>
                        ) : (
                            <>
                                <ScanLine size={14} className={active ? 'animate-pulse' : ''} />
                                <span className="text-xs font-bold">SEARCH PLOT</span>
                            </>
                        )}
                    </button>

                    <select
                        value={activeRegion}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1b3a4b] flex-shrink-0"
                    >
                        <option value="all">Global View</option>
                        {allZonesData && Object.keys(allZonesData).map(zoneId => (
                            <option key={zoneId} value={zoneId}>
                                {zoneId.replace(/^\w/, c => c.toUpperCase())} Region
                            </option>
                        ))}
                    </select>

                    {/* Selected plot badge — fixed min-width so layout doesn't jump */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl min-w-[120px] transition-all duration-200 flex-shrink-0 ${
                        active
                            ? 'bg-[#FF9933]/10 border border-[#FF9933]/20'
                            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                    }`}>
                        {active ? (
                            <>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF9933] animate-pulse" />
                                <span className="text-sm font-bold text-[#FF9933] truncate">
                                    {active.plot_id}
                                </span>
                                <span className="text-xs text-slate-500">selected</span>
                            </>
                        ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">No plot selected</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Maps side by side */}
            <div className="flex gap-3 h-[65vh] min-h-[500px] flex-shrink-0">
                {/* ─── LEFT MAP: Plot overview ─── */}
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
                    <div className="h-9 bg-gradient-to-r from-[#1b3a4b] to-[#24505f] flex items-center px-4">
                        <span className="text-xs font-bold text-white/90 uppercase tracking-widest">
                            📍 Alloted Land
                        </span>
                    </div>
                    <div className="flex-1 relative">
                        <MapContainer
                            center={defaultCenter}
                            zoom={16}
                            className="h-full w-full"
                            scrollWheelZoom={true}
                            zoomSnap={0.5}
                            zoomDelta={0.5}
                            wheelDebounceTime={80}
                            wheelPxPerZoomLevel={120}
                            inertia={true}
                            inertiaDeceleration={3000}
                        >
                            <SyncView syncRef={syncRef} isMaster={true} />
                            <ZoomTracker onZoom={setZoomLevel} />
                            <RegionCenter activeRegion={activeRegion} allZonesData={allZonesData} />
                            {selectedCenter && <FlyTo center={selectedCenter} />}

                            {/* Google Maps default road view */}
                            <TileLayer
                                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                attribution="&copy; Google Maps"
                            />

                            {/* All plots */}
                            {allPlots.map((plot, idx) => {
                                if (!plot.coordinates?.[0]) return null;
                                const isActive = active?.plot_id === plot.plot_id;
                                const plotCenter = centroid(plot.coordinates[0]);
                                return (
                                    <Polygon
                                        key={idx}
                                        positions={positions(plot)}
                                        pathOptions={{
                                            color: isActive ? '#FF9933' : '#1b3a4b',
                                            fillColor: plotColor(plot),
                                            fillOpacity: isActive ? 0.55 : 0.35,
                                            weight: isActive ? 3 : 1.5,
                                        }}
                                        eventHandlers={{
                                            click: () => handleSelect(plot),
                                            mouseover: (e) => {
                                                e.target.setStyle({ fillOpacity: 0.6, weight: 2.5 });
                                            },
                                            mouseout: (e) => {
                                                e.target.setStyle({
                                                    fillOpacity: isActive ? 0.55 : 0.35,
                                                    weight: isActive ? 3 : 1.5,
                                                });
                                            },
                                        }}
                                    >
                                        {/* Show text labels only when zoomed in */}
                                        {showLabels && (
                                            <Tooltip
                                                direction="center"
                                                permanent
                                                className="plot-label-tooltip"
                                            >
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1b3a4b' }}>
                                                    {plot.plot_id}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </Polygon>
                                );
                            })}

                            {/* One orange dot PER REGION when zoomed out */}
                            {!showLabels && allZonesData && Object.entries(allZonesData).map(([zoneId, zonePlots]) => {
                                if (!zonePlots || zonePlots.length === 0) return null;
                                // Calculate region centroid
                                let lat = 0, lng = 0, n = 0;
                                zonePlots.forEach(p => {
                                    if (!p.coordinates?.[0]) return;
                                    const c = centroid(p.coordinates[0]);
                                    if (c[0] === 0 && c[1] === 0) return; // Skip invalid
                                    lat += c[0]; lng += c[1]; n++;
                                });
                                if (n === 0) return null;
                                const center = [lat / n, lng / n];
                                const isSelected = activeRegion === zoneId;

                                return (
                                    <CircleMarker
                                        key={zoneId}
                                        center={center}
                                        radius={isSelected ? 10 : 8}
                                        pathOptions={{
                                            color: '#FF9933',
                                            fillColor: '#FF9933',
                                            fillOpacity: isSelected ? 1 : 0.8,
                                            weight: 3,
                                        }}
                                        eventHandlers={{
                                            click: () => handleRegionChange(zoneId),
                                        }}
                                    >
                                        <Tooltip direction="top" offset={[0, -10]} className="plot-label-tooltip font-bold">
                                            {zoneId.toUpperCase()}
                                        </Tooltip>
                                    </CircleMarker>
                                );
                            })}
                        </MapContainer>
                    </div>
                </div>

                {/* ─── RIGHT MAP: Live satellite ─── */}
                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
                    <div className="h-9 bg-gradient-to-r from-[#1b3a4b] to-[#24505f] flex items-center px-4">
                        <span className="text-xs font-bold text-white/90 uppercase tracking-widest">
                            🛰️ Live Satellite View
                        </span>
                    </div>
                    <div className="flex-1 relative">
                        <MapContainer
                            center={defaultCenter}
                            zoom={16}
                            className="h-full w-full"
                            scrollWheelZoom={true}
                            zoomSnap={0.5}
                            zoomDelta={0.5}
                            wheelDebounceTime={80}
                            wheelPxPerZoomLevel={120}
                            inertia={true}
                            inertiaDeceleration={3000}
                        >
                            <SyncView syncRef={syncRef} isMaster={false} />

                            {/* Google Satellite hybrid tiles — always visible */}
                            <TileLayer
                                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                attribution="&copy; Google Satellite"
                                maxZoom={22}
                                maxNativeZoom={20}
                            />

                            {/* Show ALL plot boundaries faintly */}
                            {allPlots.map((plot, idx) => {
                                if (!plot.coordinates?.[0]) return null;
                                const isActive = active?.plot_id === plot.plot_id;
                                return (
                                    <Polygon
                                        key={idx}
                                        positions={positions(plot)}
                                        pathOptions={{
                                            color: isActive ? '#FF9933' : 'rgba(255,255,255,0.4)',
                                            fillColor: isActive ? '#FF9933' : 'transparent',
                                            fillOpacity: isActive ? 0.2 : 0,
                                            weight: isActive ? 3 : 1,
                                            dashArray: isActive ? '10, 8' : '4, 4',
                                            dashOffset: '0',
                                        }}
                                    >
                                        {isActive && (
                                            <Tooltip direction="top" permanent className="plot-label-tooltip">
                                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#FF9933' }}>
                                                    {plot.plot_id}
                                                </span>
                                            </Tooltip>
                                        )}
                                    </Polygon>
                                );
                            })}
                        </MapContainer>
                    </div>
                </div>
            </div>


            {/* Intelligence Report — shown below maps after scan, scroll down to view */}
            {
                showReport && (
                    <div className="min-h-[500px] flex-shrink-0 animate-fade-in-up border-t border-slate-200 dark:border-slate-700 mt-2 pb-4">
                        <IntelligenceReport
                            selectedPlot={selectedPlot || active} // Fallback to local active if selectedPlot not yet ready (though handleScan calls sync)
                            // But wait, IntelligentReport uses analysis_data which comes from selectedPlot (from parent).
                            // If sync is fast, selectedPlot is updated. If not, fallback active might lack data.
                            // Assuming sync is fast or handled by loading state.
                            activeZone={{ location: (selectedPlot || active)?.location, id: (selectedPlot || active)?.zone_id }}
                            loading={loading || isScanning}
                            timelineData={timelineData}
                            timelineLoading={timelineLoading}
                            onGenerateNotice={onGenerateNotice}
                            onClose={handleCloseReport}
                        />
                    </div>
                )
            }
        </div >
    );
};

export default ComparisonView;
