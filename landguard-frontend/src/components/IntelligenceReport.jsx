import React from 'react';
import {
    Activity, DollarSign, FileWarning, X,
    Leaf, Radio, BrainCircuit, Ruler, ShieldAlert, ShieldCheck, Satellite
} from 'lucide-react';

/* ─── brand palette (matches HomeDashboard / website) ─── */
const B = {
    navy: '#1b3a4b',
    navyLight: '#24505f',
    saffron: '#FF9933',
    green: '#138808',
    danger: '#c0392b',
};

/* ─── reusable pieces ─── */
const Label = ({ children }) => (
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
        {children}
    </span>
);

const SectionHeading = ({ icon, title }) => (
    <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-bold text-[#1b3a4b] dark:text-blue-400 uppercase tracking-wide">{title}</h3>
    </div>
);

/* ─── gauge bar ─── */
const GaugeBar = ({ value, min, max, color }) => {
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return (
        <div className="relative w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-visible">
            <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border-[2.5px] transition-all duration-700 z-10"
                style={{ left: `calc(${pct}% - 8px)`, borderColor: color }}
            />
        </div>
    );
};

/* status helpers */
const statusColor = (s) => s === 'critical' ? B.danger : s === 'moderate' ? '#d97706' : B.green;
const statusLabel = (s, type) => {
    if (type === 'ndvi') return s === 'good' ? 'Healthy' : s === 'moderate' ? 'Low Cover' : 'Bare / Built';
    return s === 'critical' ? 'Structure Detected' : s === 'moderate' ? 'Moderate' : 'Clear';
};
const statusText = (s, type) => {
    if (type === 'ndvi') {
        if (s === 'critical') return 'Very low / no vegetation — bare ground, concrete, or hardened surfaces. Consistent with construction activity.';
        if (s === 'moderate') return 'Low-to-moderate vegetation — possible cleared land, degraded cover, or sparse plant growth.';
        return 'Dense vegetation detected — land appears naturally covered or actively cultivated. No signs of construction.';
    }
    if (s === 'critical') return 'Strong radar reflection — hard surfaces like concrete, metal roofing, or permanent structures detected.';
    if (s === 'moderate') return 'Moderate radar reflection — possible construction, rubble, or semi-permanent structures.';
    return 'Low radar reflection — consistent with natural terrain, vegetation, or open undeveloped land.';
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
    const ndvi = selectedPlot?.analysis_data?.ndvi;
    const radar = selectedPlot?.analysis_data?.radar;
    const area = selectedPlot?.analysis_data?.area;
    const confidence = selectedPlot?.analysis_data?.confidence || 0.92;

    const ndviStatus = ndvi
        ? ndvi.score >= 0.4 ? 'good' : ndvi.score >= 0.15 ? 'moderate' : 'critical'
        : null;
    const radarStatus = radar
        ? radar.score > -11 ? 'critical' : radar.score > -18 ? 'moderate' : 'good'
        : null;

    return (
        <div className="w-full max-w-5xl mx-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-lg overflow-hidden">

            {/* ═══ HEADER — navy banner matching site hero ═══ */}
            <div className="px-8 py-4 bg-[#1b3a4b] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FF9933]/20 flex items-center justify-center">
                        <Satellite size={18} className="text-[#FF9933]" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-white tracking-tight">Intelligence Report</h2>
                        <p className="text-[10px] text-blue-200/70 font-medium">Copernicus Sentinel-1 & Sentinel-2</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-white/50 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all">
                        <X size={18} />
                    </button>
                )}
            </div>
            {/* tricolor stripe — same as HomeDashboard */}
            <div className="flex h-1">
                <span className="flex-1 bg-[#FF9933]" />
                <span className="flex-1 bg-white dark:bg-slate-300" />
                <span className="flex-1 bg-[#138808]" />
            </div>

            {/* ═══ BODY ═══ */}
            {selectedPlot && (
                <div className="px-8 py-6 space-y-6">

                    {/* ─── ROW 1: Plot ID + Verdict ─── */}
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                        {/* Plot ID card */}
                        <div className="flex-1 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <Label>Plot ID</Label>
                                    <p className="text-2xl font-black text-[#1b3a4b] dark:text-blue-300 font-mono mt-1 tracking-tight">{selectedPlot.plot_id}</p>
                                </div>
                                <div className="text-right">
                                    <Label>Location</Label>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">{activeZone?.location || 'Industrial Area'}</p>
                                    <p className="text-[10px] text-slate-400">Chhattisgarh, India</p>
                                </div>
                            </div>
                        </div>

                        {/* Verdict banner */}
                        <div className={`flex-1 rounded-2xl px-5 py-4 flex items-center gap-4 border-l-4 ${
                            loading
                                ? 'bg-slate-50 dark:bg-slate-900/40 border-l-slate-300 dark:border-l-slate-600'
                                : selectedPlot.is_violating
                                    ? 'bg-gradient-to-r from-red-50 to-orange-50/50 dark:from-red-900/15 dark:to-orange-900/10 border-l-[#c0392b]'
                                    : 'bg-gradient-to-r from-emerald-50 to-green-50/50 dark:from-emerald-900/12 dark:to-green-900/8 border-l-[#138808]'
                        }`}>
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-[2.5px] border-[#1b3a4b] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                    <span className="font-bold text-sm text-slate-500 uppercase tracking-wider">Scanning Pixels...</span>
                                </>
                            ) : (
                                <>
                                    {selectedPlot.is_violating
                                        ? <ShieldAlert size={26} className="text-[#c0392b] flex-shrink-0" />
                                        : <ShieldCheck size={26} className="text-[#138808] dark:text-emerald-400 flex-shrink-0" />}
                                    <div>
                                        <p className={`text-lg font-black tracking-tight ${selectedPlot.is_violating ? 'text-[#c0392b] dark:text-red-400' : 'text-[#138808] dark:text-emerald-400'}`}>
                                            {selectedPlot.is_violating ? 'VIOLATION CONFIRMED' : 'PLOT COMPLIANT'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                                            {selectedPlot.is_violating
                                                ? 'Unauthorized construction detected beyond the legally permitted boundary.'
                                                : 'No encroachment or unauthorized construction detected within legal boundaries.'}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ─── ROW 2: NDVI + Radar side-by-side ─── */}
                    {selectedPlot.analysis_data && (
                        <>
                            <SectionHeading
                                icon={<Activity size={16} className="text-[#FF9933]" />}
                                title="Satellite Sensor Analysis"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* NDVI card */}
                                <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-400">
                                    <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${B.green}, ${B.green}88)` }} />
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Leaf size={16} className="text-[#138808]" />
                                                <span className="text-sm font-bold text-[#1b3a4b] dark:text-slate-200">Vegetation (NDVI)</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-2xl font-black font-mono" style={{ color: statusColor(ndviStatus) }}>
                                                    {ndvi.score}
                                                </span>
                                            </div>
                                        </div>

                                        <GaugeBar value={ndvi.score} min={-0.1} max={0.6} color={statusColor(ndviStatus)} />
                                        <div className="flex justify-between text-[9px] font-semibold text-slate-400 px-0.5">
                                            <span>−0.1 Bare</span><span>0.15 Sparse</span><span>0.4 Dense</span><span>0.6+</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{
                                                color: statusColor(ndviStatus),
                                                backgroundColor: statusColor(ndviStatus) + '15',
                                            }}>
                                                {statusLabel(ndviStatus, 'ndvi')}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {statusText(ndviStatus, 'ndvi')}
                                        </p>
                                    </div>
                                </div>

                                {/* Radar card */}
                                <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-400">
                                    <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${B.navy}, ${B.navyLight})` }} />
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Radio size={16} className="text-[#1b3a4b] dark:text-blue-400" />
                                                <span className="text-sm font-bold text-[#1b3a4b] dark:text-slate-200">Radar VV Backscatter</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-2xl font-black font-mono" style={{ color: statusColor(radarStatus) }}>
                                                    {radar.score}
                                                </span>
                                                <span className="text-sm font-bold text-slate-400 ml-1">dB</span>
                                            </div>
                                        </div>

                                        <GaugeBar value={radar.score} min={-25} max={0} color={statusColor(radarStatus)} />
                                        <div className="flex justify-between text-[9px] font-semibold text-slate-400 px-0.5">
                                            <span>−25 dB Clear</span><span className="text-[#c0392b] font-bold">−11 dB Threshold</span><span>0 dB</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{
                                                color: statusColor(radarStatus),
                                                backgroundColor: statusColor(radarStatus) + '15',
                                            }}>
                                                {statusLabel(radarStatus, 'radar')}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {statusText(radarStatus, 'radar')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </>
                    )}

                    {/* ─── ROW 3: Land Area + Financial Liability side-by-side ─── */}
                    {area && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Land Area card */}
                            <div className="bg-white dark:bg-slate-900/40 rounded-2xl border-l-4 border-l-[#1b3a4b] border border-slate-200/60 dark:border-slate-700/50 p-5 space-y-4 shadow-sm">
                                <SectionHeading icon={<Ruler size={16} className="text-[#1b3a4b] dark:text-blue-400" />} title="Land Area" />

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 rounded-xl p-3.5 border border-white/60 dark:border-slate-700/50">
                                        <Label>Registered Size</Label>
                                        <p className="text-xl font-black text-[#1b3a4b] dark:text-blue-300 font-mono mt-1">
                                            {area.total_area_sqm?.toLocaleString()}
                                            <span className="text-xs font-bold text-slate-400 ml-1">m²</span>
                                        </p>
                                    </div>
                                    <div className={`rounded-xl p-3.5 border ${
                                        selectedPlot.is_violating
                                            ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/15 dark:to-orange-950/10 border-red-100 dark:border-red-800/30'
                                            : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/15 dark:to-emerald-950/10 border-green-100 dark:border-green-800/30'
                                    }`}>
                                        <Label>{selectedPlot.is_violating ? 'Encroached Area' : 'Excess Area'}</Label>
                                        <p className={`text-xl font-black font-mono mt-1 ${
                                            selectedPlot.is_violating ? 'text-[#c0392b] dark:text-red-400' : 'text-[#138808] dark:text-emerald-400'
                                        }`}>
                                            {area.excess_area_sqm?.toLocaleString()}
                                            <span className="text-xs font-bold text-slate-400 ml-1">m²</span>
                                        </p>
                                    </div>
                                </div>

                                {area.utilization_ratio > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Utilization</span>
                                            <span className={`text-sm font-black font-mono ${area.utilization_ratio > 10 ? 'text-[#c0392b]' : 'text-[#1b3a4b] dark:text-blue-400'}`}>
                                                {area.utilization_ratio}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{
                                                    width: `${Math.min(100, area.utilization_ratio)}%`,
                                                    backgroundColor: area.utilization_ratio > 10 ? B.danger : B.navy,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Financial Liability card */}
                            {(selectedPlot.is_violating || area?.excess_area_sqm > 0) && (
                                <div className="bg-white dark:bg-slate-900/40 rounded-2xl border-l-4 border-l-[#FF9933] border border-slate-200/60 dark:border-slate-700/50 p-5 space-y-4 shadow-sm">
                                    <SectionHeading icon={<DollarSign size={16} className="text-[#FF9933]" />} title="Financial Liability" />

                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-500 dark:text-slate-400">Sec 248 Penalty (Max)</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹25,000</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-500 dark:text-slate-400">Est. Civil Liability</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                ₹{Math.round((area?.excess_area_sqm || 0) * 10.764 * 600).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Total Recoverable</span>
                                            <span className="font-black text-2xl font-mono" style={{ color: B.saffron }}>
                                                ₹{(25000 + Math.round((area?.excess_area_sqm || 0) * 10.764 * 600)).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── AI Confidence — full-width bottom bar ─── */}
                    {selectedPlot?.analysis_data && (
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 px-6 py-4">
                            <BrainCircuit size={20} className="text-[#FF9933] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-sm font-bold text-[#1b3a4b] dark:text-slate-200">AI Confidence Level</p>
                                    <span className="text-xl font-black font-mono text-[#1b3a4b] dark:text-blue-300">
                                        {(confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${confidence * 100}%`, background: `linear-gradient(90deg, ${B.navy}, ${B.navyLight})` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Issue Legal Notice — centred at the very bottom ─── */}
                    {(selectedPlot?.is_violating || (area?.excess_area_sqm > 0)) && area && (
                        <div className="flex justify-center pt-2 pb-1">
                            <button
                                onClick={onGenerateNotice}
                                disabled={loading}
                                className="px-10 py-3 bg-gradient-to-r from-[#FF9933] to-[#FF8000] hover:from-[#FF8000] hover:to-[#E67300] text-white rounded-xl text-sm font-extrabold shadow-lg shadow-orange-500/20 transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wider"
                            >
                                <FileWarning size={16} /> {loading ? 'Processing...' : 'Issue Legal Notice'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ FOOTER ═══ */}
            {!selectedPlot?.is_violating && selectedPlot && !loading && (
                <div className="px-8 py-4 border-t border-slate-200/60 dark:border-slate-700/50 bg-gradient-to-r from-emerald-50 to-green-50/60 dark:from-emerald-900/10 dark:to-green-900/5">
                    <div className="flex items-center justify-center gap-2 text-[#138808] dark:text-emerald-400 text-sm font-bold">
                        <ShieldCheck size={18} /> No Violation — Plot is Compliant
                    </div>
                </div>
            )}
        </div>
    );
}
