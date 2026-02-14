import React, { useEffect, useRef } from 'react';
import {
  Satellite, Shield, Eye, Zap, Globe, Phone, Mail,
  MapPin, ChevronRight, ExternalLink, Activity, TrendingUp,
  Layers, Building2, BarChart3, Radio, Server, Cpu, BrainCircuit
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Intersection Observer hook — triggers "reveal" animations on scroll */
/* ------------------------------------------------------------------ */
function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          io.unobserve(el);            // animate only once
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

/* tiny wrapper so every section can be animated identically */
const Reveal = ({ children, className = '', delay = 0 }) => {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-section ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, suffix = '', duration = 1200 }) {
  const ref = useRef(null);
  const observed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !observed.current) {
        observed.current = true;
        let start = 0;
        const end = parseFloat(value);
        const isFloat = String(value).includes('.');
        const startTime = performance.now();

        const tick = (now) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);      // easeOutCubic
          const current = start + (end - start) * eased;
          el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, suffix, duration]);

  return <span ref={ref}>0{suffix}</span>;
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function HomeDashboard({ onNavigate }) {

  /* ── feature cards ── */
  const features = [
    {
      icon: <Satellite className="w-7 h-7" />,
      title: 'Satellite Intelligence',
      desc: 'Real-time monitoring using Sentinel-1 (Radar) & Sentinel-2 (Optical) via ESA Copernicus for continuous, cloud-piercing surveillance of CSIDC industrial areas.',
      color: '#1b3a4b',
      gradient: 'from-[#1b3a4b] to-[#24505f]'
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: 'Encroachment Detection',
      desc: 'AI-driven analysis using NDVI vegetation indices and SAR backscatter thresholds to flag unauthorized constructions on government industrial land.',
      color: '#c0392b',
      gradient: 'from-[#c0392b] to-[#e74c3c]'
    },
    {
      icon: <Eye className="w-7 h-7" />,
      title: '24/7 All-Weather Monitoring',
      desc: 'Synthetic Aperture Radar works through clouds, rain and darkness — providing uninterrupted encroachment detection day and night.',
      color: '#138808',
      gradient: 'from-[#138808] to-[#1fa012]'
    },
    {
      icon: <Zap className="w-7 h-7" />,
      title: 'Instant Legal Action',
      desc: 'One-click legal notice generation under CG State Industrial Development acts, backed by verified satellite evidence for rapid enforcement.',
      color: '#FF9933',
      gradient: 'from-[#FF9933] to-[#ffb347]'
    }
  ];

  /* ── tech stack items ── */
  const techStack = [
    { icon: <Satellite size={20} />, name: 'Sentinel-1 SAR', detail: 'C-band radar, 10 m resolution, 12-day revisit — detects structures through cloud cover' },
    { icon: <Layers size={20} />, name: 'Sentinel-2 MSI', detail: '13-band multispectral, 10 m resolution — vegetation & land-use classification via NDVI' },
    { icon: <Globe size={20} />, name: 'Google Earth Engine', detail: 'Planetary-scale geospatial processing — real-time satellite image computation and analysis' },
    { icon: <BrainCircuit size={20} />, name: 'AI / ML Analysis', detail: 'Multi-sensor fusion of NDVI + Radar backscatter with anomaly detection algorithms' },
    { icon: <Server size={20} />, name: 'Flask REST API', detail: 'Python backend orchestrating GEE analysis, area computation & legal notice generation' },
    { icon: <Cpu size={20} />, name: 'React + Leaflet', detail: 'Real-time interactive mapping with dual-view comparison and dynamic GEE overlay rendering' },
  ];

  /* ── how-it-works steps ── */
  const steps = [
    { num: '01', title: 'Plot Registration', desc: 'Industrial plots are registered with their official legal boundaries from CSIDC land records using GeoJSON polygons.' },
    { num: '02', title: 'Satellite Scanning', desc: 'ESA Sentinel-1 and Sentinel-2 satellites capture radar and optical imagery of every plot at regular intervals.' },
    { num: '03', title: 'AI Analysis', desc: 'The AI engine processes NDVI vegetation indices and radar backscatter data to detect anomalies — bare ground, concrete, metal roofing.' },
    { num: '04', title: 'Violation Flagging', desc: 'Plots exceeding NDVI/radar thresholds are automatically flagged as potential encroachments with confidence scores.' },
    { num: '05', title: 'Legal Action', desc: 'Officials review satellite evidence, compare legal vs detected boundaries, and generate enforceable legal notices in one click.' },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950" style={{ scrollBehavior: 'smooth' }}>

      {/* ════════════════════  HERO  ════════════════════ */}
      <section className="relative overflow-hidden bg-[#1b3a4b] text-white min-h-[480px]">
        {/* CG district-map background */}
        <div className="absolute inset-0">
          <img
            src="/cg-map.png"
            alt="Chhattisgarh Districts"
            className="w-full h-full object-cover opacity-[0.35]"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {/* dark teal overlay so text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#152d3a]/60 via-[#1b3a4b]/50 to-[#1b3a4b]/35" />
        </div>

        <div className="relative max-w-7xl mx-auto px-10 py-20 flex items-center gap-12">
          {/* Left — bold text block */}
          <div className="flex-1 space-y-6">
            <h1 className="font-heading font-black leading-none tracking-tight mb-6">
              <span className="inline-block text-6xl lg:text-8xl text-white drop-shadow-2xl">UDYOG</span>
              <span className="inline-block text-6xl lg:text-8xl text-[#FF9933] drop-shadow-2xl lg:ml-4">GADH</span>
            </h1>

            <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-sm font-bold text-blue-100 tracking-wide shadow-lg">
              <Shield size={16} className="text-[#FF9933]" />
              Automated Entroachment Detection System
            </div>

            <p className="text-lg text-blue-100/90 leading-relaxed max-w-lg font-medium">
              Protecting <span className="text-[#FF9933] font-bold">CSIDC</span> industrial assets with 24/7 satellite surveillance.
              AI-powered detection of unauthorized constructions.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={() => onNavigate && onNavigate('map')}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#FF8000] hover:from-[#FF8000] hover:to-[#E67300] text-white font-bold text-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 transition-all duration-300 group"
              >
                <Satellite className="group-hover:rotate-12 transition-transform duration-300" />
                Analyze Live Map
              </button>

              <a href="https://csidc.in" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-lg border border-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
                <ExternalLink size={20} /> CSIDC Portal
              </a>
            </div>
          </div>

          {/* Right spacer — satellite imagery is now the full background */}
          <div className="hidden lg:block w-80 flex-shrink-0" />
        </div>

        {/* bottom tricolor — no z-index so stat cards sit on top */}
        <div className="flex h-1">
          <span className="flex-1 bg-[#FF9933]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#138808]" />
        </div>
      </section>

      {/* ════════════════════  QUICK STATS  ════════════════════ */}
      <Reveal>
        <section className="max-w-6xl mx-auto px-8 -mt-8 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: 'Industrial Zones', value: 2, suffix: '', accent: '#FF9933', bg: 'from-orange-50 to-amber-50', darkBg: 'dark:from-orange-950/20 dark:to-amber-950/20' },
              { label: 'Plots Monitored', value: 50, suffix: '+', accent: '#1b3a4b', bg: 'from-teal-50 to-cyan-50', darkBg: 'dark:from-teal-950/20 dark:to-cyan-950/20' },
              { label: 'Sentinel Revisit', value: 12, suffix: ' days', accent: '#138808', bg: 'from-green-50 to-emerald-50', darkBg: 'dark:from-green-950/20 dark:to-emerald-950/20' },
              { label: 'Resolution', value: 10, suffix: ' m', accent: '#FF9933', bg: 'from-orange-50 to-yellow-50', darkBg: 'dark:from-orange-950/20 dark:to-yellow-950/20' },
            ].map((s, i) => (
              <div key={i} className={`bg-gradient-to-br ${s.bg} ${s.darkBg} rounded-2xl overflow-hidden border border-white/60 dark:border-slate-700/50 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 ease-out group`}>
                <div className="h-1.5 w-full rounded-b-full" style={{ background: `linear-gradient(90deg, ${s.accent}, ${s.accent}88)` }} />
                <div className="p-6 text-center">
                  <p className="text-5xl font-black font-mono tracking-tighter" style={{ color: s.accent }}>
                    <AnimatedNumber value={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ════════════════════  ABOUT CSIDC & CG GOVT  ════════════════════ */}
      <Reveal>
        <section className="max-w-6xl mx-auto px-8 py-14">
          <div className="grid md:grid-cols-2 gap-6">
            {/* CSIDC */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border-l-4 border-l-[#FF9933] border border-slate-200/60 dark:border-slate-700/50 p-6 space-y-4 shadow-sm hover:shadow-lg transition-all duration-400">
              <div className="flex items-center gap-4">
                <img src="https://csidc.in/wp-content/uploads/2022/07/44.jpg" alt="CSIDC" className="h-14 object-contain rounded-lg" onError={(e) => { e.target.style.display = 'none'; }} />
                <div>
                  <h3 className="text-lg font-bold text-[#1b3a4b] dark:text-blue-400 font-heading">CSIDC</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">छत्तीसगढ़ राज्य औद्योगिक विकास निगम</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                The Chhattisgarh State Industrial Development Corporation (CSIDC) is a Government of Chhattisgarh enterprise
                responsible for the development and management of industrial infrastructure across the state. CSIDC facilitates
                industrial growth by providing ready-to-use industrial plots, common facility centers, and essential services
                to businesses in designated industrial areas.
              </p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-[#FF9933] rounded-full font-semibold border border-orange-100 dark:border-orange-800/30">Industrial Infrastructure</span>
                <span className="px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-[#FF9933] rounded-full font-semibold border border-orange-100 dark:border-orange-800/30">Land Facilitation</span>
                <span className="px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-[#FF9933] rounded-full font-semibold border border-orange-100 dark:border-orange-800/30">Policy Implementation</span>
              </div>
            </div>

            {/* CG Govt */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border-l-4 border-l-[#138808] border border-slate-200/60 dark:border-slate-700/50 p-6 space-y-4 shadow-sm hover:shadow-lg transition-all duration-400">
              <div className="flex items-center gap-4">
                <img src="https://cgstate.gov.in/user-assets/images/emblem-dark.png" alt="CG Govt" className="h-14 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                <div>
                  <h3 className="text-lg font-bold text-[#1b3a4b] dark:text-blue-400 font-heading">Government of Chhattisgarh</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Dept. of Commerce &amp; Industry</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                The Government of Chhattisgarh, through its Department of Commerce &amp; Industry, oversees the orderly
                development of industrial zones. UdyogGadh was developed to assist in monitoring and protecting
                government-allotted industrial land from encroachment, ensuring that public assets are used in
                accordance with sanctioned plans and applicable industrial development laws.
              </p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-400 rounded-full font-semibold border border-green-100 dark:border-green-800/30">State Administration</span>
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-400 rounded-full font-semibold border border-green-100 dark:border-green-800/30">Industrial Policy</span>
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-400 rounded-full font-semibold border border-green-100 dark:border-green-800/30">Land Governance</span>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ════════════════════  PURPOSE & WHAT IT DOES  ════════════════════ */}
      <Reveal>
        <section className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-8 py-14 space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#1b3a4b] text-white text-[11px] font-bold uppercase tracking-wider">Our Purpose</span>
              <h2 className="text-4xl font-heading font-black text-[#1b3a4b] dark:text-blue-400">
                Our Mission
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                CSIDC manages thousands of industrial plots across Chhattisgarh. Manual monitoring is slow,
                expensive and unreliable. Encroachments on government land go undetected for months — leading to
                legal disputes, revenue loss and unauthorized constructions.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 pt-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
                  <AlertTriangleIcon />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">The Problem</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Unauthorized constructions and land encroachments on CSIDC industrial plots remain undetected due to
                  lack of continuous surveillance. Manual inspections cover only a fraction of allotted plots.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#1b3a4b] dark:text-blue-400">
                  <Satellite size={20} />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Our Solution</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  UdyogGadh uses ESA Copernicus satellite imagery to monitor every industrial plot 24/7. AI algorithms
                  compare legal boundaries with satellite-detected land use to flag violations automatically.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-5 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-700 dark:text-green-400">
                  <Shield size={20} />
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">The Impact</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Rapid detection enables immediate legal action, protecting government assets. CSIDC can enforce compliance,
                  recover encroached land, and generate legal notices with verified satellite evidence.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ════════════════════  KEY FEATURES  ════════════════════ */}
      <Reveal>
        <section className="max-w-6xl mx-auto px-8 py-14 space-y-8">
          <div className="text-center space-y-2">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#FF9933]/15 text-[#FF9933] text-[11px] font-bold uppercase tracking-wider border border-[#FF9933]/20">Capabilities</span>
            <h2 className="text-3xl font-heading font-bold text-[#1b3a4b] dark:text-blue-400">Key Features</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6 hover:border-transparent transition-all duration-500 hover:shadow-2xl hover:-translate-y-2">
                  <div className="flex items-start gap-4">
                    <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${f.gradient} text-white flex-shrink-0 group-hover:scale-110 group-hover:shadow-lg transition-all duration-500`}>
                      {f.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1b3a4b] dark:text-blue-400">{f.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ════════════════════  HOW IT WORKS  ════════════════════ */}
      <Reveal>
        <section className="bg-[#1b3a4b] text-white">
          <div className="max-w-6xl mx-auto px-8 py-14 space-y-10">
            <div className="text-center space-y-2">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-[#FF9933] text-[11px] font-bold uppercase tracking-wider border border-white/10">Process</span>
              <h2 className="text-3xl font-heading font-bold">How UdyogGadh Works</h2>
            </div>

            <div className="grid md:grid-cols-5 gap-4">
              {steps.map((s, i) => (
                <Reveal key={i} delay={i * 120}>
                  <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-400 hover:-translate-y-1">
                    <span className="text-3xl font-black text-[#FF9933]/40 font-mono">{s.num}</span>
                    <h4 className="text-sm font-bold mt-2">{s.title}</h4>
                    <p className="text-[11px] text-blue-200 mt-2 leading-relaxed">{s.desc}</p>
                    {i < steps.length - 1 && (
                      <ChevronRight size={16} className="absolute top-1/2 -right-3 text-[#FF9933]/50 hidden md:block" />
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          {/* tricolor */}
          <div className="flex h-1">
            <span className="flex-1 bg-[#FF9933]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#138808]" />
          </div>
        </section>
      </Reveal>

      {/* ════════════════════  TECHNOLOGY STACK  ════════════════════ */}
      <Reveal>
        <section className="max-w-6xl mx-auto px-8 py-14 space-y-8">
          <div className="text-center space-y-2">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#138808]/15 text-[#138808] text-[11px] font-bold uppercase tracking-wider border border-[#138808]/20">Technology</span>
            <h2 className="text-3xl font-heading font-bold text-[#1b3a4b] dark:text-blue-400">Satellite Imagery &amp; Tech Stack</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              UdyogGadh combines European Space Agency satellite data with Google Earth Engine and custom AI to deliver
              unmatched land monitoring accuracy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {techStack.map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5 hover:shadow-lg transition-all duration-400 group hover:-translate-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-[#1b3a4b] dark:text-blue-400 group-hover:bg-[#1b3a4b] group-hover:text-white transition-all duration-300">
                      {t.icon}
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">{t.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{t.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Satellite detail banner */}
          <Reveal delay={200}>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-6 flex items-start gap-5">
              <div className="p-3 rounded-2xl bg-[#1b3a4b] text-white flex-shrink-0">
                <Radio size={24} />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-[#1b3a4b] dark:text-blue-400">About the Satellite Data</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>Sentinel-1</strong> is a C-band Synthetic Aperture Radar (SAR) satellite that transmits microwave pulses and measures their reflection.
                  Hard surfaces like concrete and metal produce strong backscatter (&gt; −11 dB), while vegetation and bare soil produce weaker signals.
                  This allows detection of unauthorized constructions regardless of weather or time of day.
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>Sentinel-2</strong> captures multispectral optical imagery in 13 bands. UdyogGadh uses the <em>Normalized Difference Vegetation Index (NDVI)</em> —
                  calculated as (NIR − Red) / (NIR + Red) — to measure live plant cover. An NDVI below 0.15 on an industrial plot
                  suggests cleared land, construction activity or hardened surfaces.
                </p>
              </div>
            </div>
          </Reveal>
        </section>
      </Reveal>

      {/* ════════════════════  GOVERNMENT LINKS & CONTACT  ════════════════════ */}
      <Reveal>
        <section className="cg-footer">
          <div className="max-w-6xl mx-auto px-8 py-10">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Links */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white/90 uppercase tracking-wider">Important Links</h4>
                <div className="space-y-2">
                  {[
                    { href: 'https://csidc.in', label: 'CSIDC Official Website' },
                    { href: 'https://cgstate.gov.in', label: 'Government of Chhattisgarh' },
                    { href: 'https://industries.cg.gov.in', label: 'Dept. of Commerce & Industries' },
                    { href: 'https://sentinels.copernicus.eu', label: 'ESA Copernicus Sentinels' },
                    { href: 'https://earthengine.google.com', label: 'Google Earth Engine' },
                  ].map((link, i) => (
                    <a key={i} href={link.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-200 hover:text-white hover:underline transition-colors">
                      <ExternalLink size={12} className="flex-shrink-0" /> {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white/90 uppercase tracking-wider">Contact</h4>
                <div className="space-y-2 text-xs text-blue-200/80">
                  <p className="flex items-center gap-2"><Building2 size={12} className="text-blue-300/60" /> CSIDC Limited</p>
                  <p className="flex items-center gap-2"><MapPin size={12} className="text-blue-300/60" /> Udyog Bhawan, Ring Road No.-1, Telibandha</p>
                  <p className="flex items-center gap-2"><MapPin size={12} className="text-blue-300/60" /> Raipur — 492006, Chhattisgarh</p>
                  <p className="flex items-center gap-2"><Phone size={12} className="text-blue-300/60" /> 0771-2331692</p>
                  <p className="flex items-center gap-2"><Mail size={12} className="text-blue-300/60" /> info@csidc.in</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white/90 uppercase tracking-wider">Disclaimer</h4>
                <p className="text-[11px] text-blue-200/60 leading-relaxed">
                  UdyogGadh is a prototype satellite monitoring system developed for hackathon/demonstration purposes.
                  Satellite data is sourced from publicly available ESA Copernicus Sentinel imagery. Analysis results
                  should be verified by authorized officials before any legal action is taken.
                </p>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-8 pt-5 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] text-blue-200/50">
              <p>© 2026 CSIDC · Government of Chhattisgarh · All Rights Reserved</p>
              <p className="flex items-center gap-1.5">
                <Activity size={10} /> Powered by ESA Copernicus · Google Earth Engine · UdyogGadh AI
              </p>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

/* small inline alert-triangle icon to avoid import collision */
function AlertTriangleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}
