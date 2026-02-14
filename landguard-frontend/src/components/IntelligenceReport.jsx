import React from 'react';
import {
    AlertCircle, Activity, DollarSign, FileWarning, Send, TrendingUp, X,
    Leaf, Radio, BrainCircuit, Ruler, ShieldAlert, ShieldCheck, Satellite
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

/* ────────────────────────────────────────────── */
/*  Reusable sub-components                       */
/* ────────────────────────────────────────────── */

/** Section wrapper with left accent bar */
const Section = ({ children, accent = '#1b3a4b', className = '' }) => (
    <div className={`relative pl-4 ${className}`}>
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full" style={{ background: accent }} />
        {children}
    </div>
);

/** Bold section heading */
const SectionHeading = ({ icon, title, subtitle }) => (
    <div className="mb-3">
        <h3 className="text-sm font-extrabold text-[#1b3a4b] dark:text-blue-300 uppercase tracking-wide flex items-center gap-2">
            {icon} {title}
        </h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>}
    </div>
);

/** Gauge bar with marker */
const GaugeBar = ({ value, min, max, gradient, markerBorder = '#1b3a4b' }) => {
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return (
        <div className="relative w-full h-3 rounded-full overflow-visible" style={{ background: '#e2e8f0' }}>
            <div className={`absolute inset-0 rounded-full ${gradient}`} />
            <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-[2.5px] transition-all duration-700 ease-out z-10"
                style={{ left: `calc(${pct}% - 8px)`, borderColor: markerBorder }}
            />
        </div>
    );
};

/* ────────────────────────────────────────────── */
/*  Custom tooltip for the chart                  */
/* ────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 shadow-xl">
            <p className="text-xs font-bold text-[#1b3a4b] dark:text-blue-300 mb-1">{label}</p>
            <p className="text-sm font-extrabold text-[#FF9933]">{payload[0].value?.toLocaleString()} m²</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Encroached Area</p>
        </div>
    );
};

/* ════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════ */
export default function IntelligenceReport({
    selectedPlot,
    activeZone,
    loading,
    timelineData = [],
    timelineLoading = false,
    onGenerateNotice,
    onClose
}) {
    const calculateTrend = () => {
        if (!timelineData || timelineData.length < 2) return null;
        const first = timelineData[0].area;
        const last = timelineData[timelineData.length - 1].area;
        return last - first;
    };

    const ndvi = selectedPlot?.analysis_data?.ndvi;
    const radar = selectedPlot?.analysis_data?.radar;
    const area = selectedPlot?.analysis_data?.area;
    const confidence = selectedPlot?.analysis_data?.confidence || 0.92;

    // NDVI status
    const ndviStatus = ndvi
        ? ndvi.score >= 0.4 ? 'good' : ndvi.score >= 0.15 ? 'moderate' : 'critical'
        : null;
    const ndviColors = { good: '#16a34a', moderate: '#d97706', critical: '#dc2626' };

    // Radar status
    const radarStatus = radar
        ? radar.score > -11 ? 'critical' : radar.score > -18 ? 'moderate' : 'good'
        : null;
    const radarColors = { good: '#16a34a', moderate: '#d97706', critical: '#dc2626' };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col h-full animate-fade-in-up">

            {/* ═══════ HEADER ═══════ */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#0f2b3c] via-[#1b3a4b] to-[#24505f] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#FF9933]/20 flex items-center justify-center">
                        <Satellite size={20} className="text-[#FF9933]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold text-white tracking-tight">Intelligence Report</h2>
                        <p className="text-[10px] text-blue-200/70 font-medium">Satellite-based Analysis · Copernicus Programme</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* ═══════ BODY ═══════ */}
            <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto custom-scrollbar">
                {selectedPlot && (
                    <div className="animate-fade-in-right space-y-6">

                        {/* ──── PLOT ID + VERDICT (combined hero) ──── */}
                        <div className={`rounded-xl overflow-hidden border-2 transition-all duration-500 ${
                            loading ? 'border-slate-200 dark:border-slate-700'
                            : selectedPlot.is_violating ? 'border-red-300 dark:border-red-800/60' : 'border-emerald-300 dark:border-emerald-800/40'
                        }`}>
                            {/* Plot ID bar */}
                            <div className="bg-slate-50 dark:bg-slate-900 px-5 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">Plot Identification</p>
                                    <p className="text-2xl font-black text-[#1b3a4b] dark:text-blue-300 mt-0.5 tracking-tight">{selectedPlot.plot_id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">Location</p>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{activeZone?.location || 'Industrial Area'}</p>
                                    <p className="text-[10px] text-slate-400">Chhattisgarh, India</p>
                                </div>
                            </div>

                            {/* Verdict banner */}
                            <div className={`px-5 py-4 text-center ${
                                loading ? 'bg-slate-100 dark:bg-slate-800'
                                : selectedPlot.is_violating
                                    ? 'bg-gradient-to-r from-red-50 via-red-50 to-orange-50 dark:from-red-900/20 dark:via-red-900/15 dark:to-orange-900/10'
                                    : 'bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-900/15 dark:via-green-900/10 dark:to-teal-900/10'
                            }`}>
                                {loading ? (
                                    <div className="flex items-center justify-center gap-3 py-1">
                                        <span className="w-5 h-5 border-[2.5px] border-[#1b3a4b] border-t-transparent rounded-full animate-spin" />
                                        <span className="font-extrabold text-base text-slate-600 dark:text-slate-300 uppercase tracking-wider">Scanning Pixels...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-3">
                                        {selectedPlot.is_violating
                                            ? <ShieldAlert size={28} className="text-red-500" />
                                            : <ShieldCheck size={28} className="text-emerald-600 dark:text-emerald-400" />}
                                        <div className="text-left">
                                            <p className={`text-lg font-black tracking-tight ${selectedPlot.is_violating ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                                {selectedPlot.is_violating ? 'VIOLATION CONFIRMED' : 'PLOT COMPLIANT'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                                                {selectedPlot.is_violating
                                                    ? 'Unauthorized construction detected beyond the legally permitted boundary.'
                                                    : 'No encroachment or unauthorized construction detected within legal boundaries.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ──── SATELLITE SENSOR ANALYSIS (hero section) ──── */}
                        {selectedPlot.analysis_data && (
                            <div className="space-y-5">
                                <Section accent="#FF9933">
                                    <SectionHeading
                                        icon={<Activity size={16} className="text-[#FF9933]" />}
                                        title="Satellite Sensor Analysis"
                                        subtitle="Copernicus Sentinel-1 (SAR Radar) & Sentinel-2 (Multispectral Optical) — last 30 days"
                                    />
                                </Section>

                                {/* ── NDVI Card ── */}
                                <div className={`rounded-xl border-2 overflow-hidden transition-all ${
                                    ndviStatus === 'critical' ? 'border-red-200 dark:border-red-900/40'
                                    : ndviStatus === 'moderate' ? 'border-amber-200 dark:border-amber-900/40'
                                    : 'border-emerald-200 dark:border-emerald-900/30'
                                }`}>
                                    <div className="bg-gradient-to-r from-emerald-50 to-lime-50 dark:from-emerald-950/30 dark:to-lime-950/20 px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                                <Leaf size={18} className="text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-extrabold text-[#1b3a4b] dark:text-emerald-300">Vegetation Index (NDVI)</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Normalized Difference Vegetation Index via Sentinel-2</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black font-mono tracking-tight" style={{ color: ndviColors[ndviStatus] }}>
                                                {ndvi.score}
                                            </p>
                                            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ndviColors[ndviStatus] }}>
                                                {ndviStatus === 'good' ? 'Healthy' : ndviStatus === 'moderate' ? 'Low Cover' : 'Bare/Built'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-5 py-4 bg-white dark:bg-slate-800/60 space-y-3">
                                        <GaugeBar
                                            value={ndvi.score}
                                            min={-0.1}
                                            max={0.6}
                                            gradient="bg-gradient-to-r from-red-400 via-amber-300 via-60% to-emerald-500"
                                            markerBorder={ndviColors[ndviStatus]}
                                        />
                                        <div className="flex justify-between text-[10px] font-semibold text-slate-400 px-0.5">
                                            <span>−0.1 Bare</span>
                                            <span>0.15 Sparse</span>
                                            <span>0.4 Dense</span>
                                            <span>0.6+</span>
                                        </div>
                                        <div className={`mt-2 p-3 rounded-lg text-xs font-semibold leading-relaxed ${
                                            ndviStatus === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-900/15 dark:text-red-300'
                                            : ndviStatus === 'moderate' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/15 dark:text-amber-300'
                                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/15 dark:text-emerald-300'
                                        }`}>
                                            {ndviStatus === 'critical'
                                                ? '▸ Very low / no vegetation detected — indicates bare ground, concrete, or hardened surfaces. Consistent with construction activity.'
                                                : ndviStatus === 'moderate'
                                                    ? '▸ Low-to-moderate vegetation — possible cleared land, degraded cover, or sparse plant growth on the plot.'
                                                    : '▸ Dense vegetation detected — land appears naturally covered or actively cultivated. No signs of construction.'}
                                        </div>
                                    </div>
                                </div>

                                {/* ── RADAR Card ── */}
                                <div className={`rounded-xl border-2 overflow-hidden transition-all ${
                                    radarStatus === 'critical' ? 'border-red-200 dark:border-red-900/40'
                                    : radarStatus === 'moderate' ? 'border-amber-200 dark:border-amber-900/40'
                                    : 'border-blue-200 dark:border-blue-900/30'
                                }`}>
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                <Radio size={18} className="text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-extrabold text-[#1b3a4b] dark:text-blue-300">Radar Backscatter (VV)</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">C-band SAR vertical co-polarisation via Sentinel-1</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black font-mono tracking-tight" style={{ color: radarColors[radarStatus] }}>
                                                {radar.score} <span className="text-base font-bold">dB</span>
                                            </p>
                                            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: radarColors[radarStatus] }}>
                                                {radarStatus === 'critical' ? 'Structure Detected' : radarStatus === 'moderate' ? 'Moderate' : 'Clear'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-5 py-4 bg-white dark:bg-slate-800/60 space-y-3">
                                        <GaugeBar
                                            value={radar.score}
                                            min={-25}
                                            max={0}
                                            gradient="bg-gradient-to-r from-emerald-500 via-amber-300 via-55% to-red-500"
                                            markerBorder={radarColors[radarStatus]}
                                        />
                                        <div className="flex justify-between text-[10px] font-semibold text-slate-400 px-0.5">
                                            <span>−25 dB Clear</span>
                                            <span className="text-red-400 font-bold">−11 dB Threshold</span>
                                            <span>0 dB Dense</span>
                                        </div>
                                        <div className={`mt-2 p-3 rounded-lg text-xs font-semibold leading-relaxed ${
                                            radarStatus === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-900/15 dark:text-red-300'
                                            : radarStatus === 'moderate' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/15 dark:text-amber-300'
                                            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/15 dark:text-blue-300'
                                        }`}>
                                            {radarStatus === 'critical'
                                                ? '▸ Strong radar reflection — hard surfaces like concrete, metal roofing, or permanent structures detected on the plot.'
                                                : radarStatus === 'moderate'
                                                    ? '▸ Moderate radar reflection — possible construction, rubble, or semi-permanent structures present.'
                                                    : '▸ Low radar reflection — consistent with natural terrain, vegetation, or open undeveloped land.'}
                                        </div>
                                    </div>
                                </div>

                                {/* ── AI Confidence ── */}
                                <div className="flex items-center gap-4 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/40">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                                        <BrainCircuit size={18} className="text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <p className="text-xs font-extrabold text-[#1b3a4b] dark:text-slate-200">AI Confidence Level</p>
                                            <span className="text-lg font-black text-violet-600 dark:text-violet-400 font-mono">
                                                {(confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-violet-500 to-purple-600 h-full transition-all duration-1000 ease-out rounded-full"
                                                style={{ width: `${confidence * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ──── LAND AREA BREAKDOWN ──── */}
                        {area && (
                            <div className="space-y-4">
                                <Section accent="#1b3a4b">
                                    <SectionHeading
                                        icon={<Ruler size={16} className="text-[#1b3a4b] dark:text-blue-400" />}
                                        title="Land Area Breakdown"
                                    />
                                </Section>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Total area */}
                                    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700/40">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">Registered Size</p>
                                        <p className="text-xl font-black text-[#1b3a4b] dark:text-blue-300 font-mono mt-1">
                                            {area.total_area_sqm?.toLocaleString()}
                                            <span className="text-xs font-bold text-slate-400 ml-1">m²</span>
                                        </p>
                                    </div>
                                    {/* Excess area */}
                                    <div className={`rounded-xl p-4 border-2 ${
                                        selectedPlot.is_violating
                                            ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/40'
                                            : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
                                    }`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${selectedPlot.is_violating ? 'text-red-400' : 'text-emerald-500'}`}>
                                            {selectedPlot.is_violating ? 'Encroached Area' : 'Excess Area'}
                                        </p>
                                        <p className={`text-xl font-black font-mono mt-1 ${selectedPlot.is_violating ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                            {area.excess_area_sqm?.toLocaleString()}
                                            <span className={`text-xs font-bold ml-1 ${selectedPlot.is_violating ? 'text-red-400' : 'text-emerald-400'}`}>m²</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Utilization bar */}
                                {area.utilization_ratio > 0 && (
                                    <div className="px-1 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Land Utilization</span>
                                            <span className={`text-sm font-black font-mono ${area.utilization_ratio > 10 ? 'text-red-600 dark:text-red-400' : 'text-[#1b3a4b] dark:text-blue-400'}`}>
                                                {area.utilization_ratio}% <span className="text-[10px] font-bold text-slate-400">excess</span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ease-out ${area.utilization_ratio > 10 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-[#1b3a4b] to-[#24505f]'}`}
                                                style={{ width: `${Math.min(100, area.utilization_ratio)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ──── FINANCIAL LIABILITY ──── */}
                        {(selectedPlot.is_violating || (area?.excess_area_sqm > 0)) && area && (
                            <div className="space-y-4">
                                <Section accent="#dc2626">
                                    <SectionHeading
                                        icon={<DollarSign size={16} className="text-red-500" />}
                                        title="Financial Liability"
                                    />
                                </Section>

                                <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-red-200 dark:border-red-800/30 p-5 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">Section 248 Penalty (Max)</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹25,000</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">Est. Civil Liability (Land Value)</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            ₹{Math.round((area?.excess_area_sqm || 0) * 10.764 * 600).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="h-px bg-red-200 dark:bg-red-800/40" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Total Recoverable</span>
                                        <span className="font-black text-2xl text-red-600 dark:text-red-400 font-mono">
                                            ₹{(25000 + Math.round((area?.excess_area_sqm || 0) * 10.764 * 600)).toLocaleString()}
                                        </span>
                                    </div>
                                    <button
                                        onClick={onGenerateNotice}
                                        disabled={loading}
                                        className="w-full mt-2 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-red-500/25 transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wider"
                                    >
                                        <FileWarning size={15} /> {loading ? 'Processing...' : 'Issue Legal Notice'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ──── 12-MONTH TREND CHART ──── */}
                        {timelineData.length > 0 && (
                            <div className="space-y-4">
                                <Section accent="#FF9933">
                                    <div className="flex items-center justify-between">
                                        <SectionHeading
                                            icon={<TrendingUp size={16} className="text-[#FF9933]" />}
                                            title="12-Month Encroachment Trend"
                                            subtitle="Monthly radar-based encroached area from Sentinel-1"
                                        />
                                        {(() => {
                                            const trend = calculateTrend();
                                            if (trend === null) return null;
                                            const isExpanding = trend > 0;
                                            return (
                                                <span className={`text-[10px] font-extrabold px-3 py-1.5 rounded-full flex-shrink-0 ${
                                                    isExpanding ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                    {isExpanding ? '↗ Expanding' : '→ Stable'}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </Section>

                                <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/40 p-4">
                                    {timelineLoading ? (
                                        <div className="h-52 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <span className="w-6 h-6 border-[2.5px] border-[#1b3a4b] border-t-transparent rounded-full animate-spin" />
                                                <span className="text-xs font-semibold">Loading timeline data...</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="irAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#FF9933" stopOpacity={0.35} />
                                                        <stop offset="100%" stopColor="#FF9933" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid
                                                    strokeDasharray="3 6"
                                                    stroke="#e2e8f0"
                                                    opacity={0.5}
                                                    vertical={false}
                                                />
                                                <XAxis
                                                    dataKey="displayDate"
                                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                                                    axisLine={{ stroke: '#e2e8f0' }}
                                                    tickLine={false}
                                                    dy={5}
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                                                    width={45}
                                                />
                                                <Tooltip content={<ChartTooltip />} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="area"
                                                    stroke="#FF9933"
                                                    strokeWidth={2.5}
                                                    fill="url(#irAreaGrad)"
                                                    dot={{ r: 3, fill: '#FF9933', stroke: '#fff', strokeWidth: 2 }}
                                                    activeDot={{ r: 5, fill: '#FF9933', stroke: '#fff', strokeWidth: 2.5 }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════ FOOTER ═══════ */}
            {!selectedPlot?.is_violating && selectedPlot && !loading && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-900/30">
                    <button
                        disabled={true}
                        className="w-full py-3.5 rounded-xl font-extrabold shadow-sm transition-all duration-300 flex items-center justify-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30 cursor-default"
                    >
                        <ShieldCheck size={18} /> No Violation — Plot is Compliant
                    </button>
                </div>
            )}
        </div>
    );
}
