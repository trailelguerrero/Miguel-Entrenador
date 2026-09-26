import React, { useState, useMemo } from 'react';
import { measuredAntHr } from '../brain/intensity';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle, 
  Info, 
  Calendar, 
  Zap, 
  Heart,
  Sliders,
  Calculator,
  BookOpen,
  Layers,
  ChevronRight,
  Flame,
  Scale
} from 'lucide-react';
import { PMCDataPoint, AthleteProfile, Workout } from '../types';
import { StorageService } from '../services/storage';
import { 
  calculateWorkoutTss, 
  getTsbZoneDiagnosis, 
  getRampRateDiagnosis
} from '../utils/pmcCalculations';
import { computePmcSeries, countEstimatedWorkouts, CTL_DAYS, ATL_DAYS } from '../utils/trainingLoad';

interface PMCChartViewProps {
  profile?: AthleteProfile;
  workouts?: Workout[];
}

export const PMCChartView: React.FC<PMCChartViewProps> = ({ profile: propProfile, workouts: propWorkouts }) => {
  const profile = propProfile || StorageService.getProfile();
  const workouts = propWorkouts || StorageService.getWorkouts();

  // Time range selector
  const [timeRange, setTimeRange] = useState<'14d' | '30d' | '42d' | '90d'>('42d');
  const [hoveredPoint, setHoveredPoint] = useState<PMCDataPoint | null>(null);

  // Quick TSS Simulator state
  const [simDuration, setSimDuration] = useState<number>(75);
  const [simAvgHr, setSimAvgHr] = useState<number>(profile.aetHr || 0);
  const [simRpe, setSimRpe] = useState<number>(6);

  // Serie PMC calculada con todo el historial de entrenos completados
  // (TSS de Suunto cuando existe). Se muestra solo el rango elegido.
  const allDataPoints: PMCDataPoint[] = useMemo(
    () => computePmcSeries(workouts, measuredAntHr(profile)),
    [workouts, measuredAntHr(profile)]
  );
  const fullDataPoints: PMCDataPoint[] = useMemo(() => {
    const days = timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : timeRange === '42d' ? 42 : 90;
    return allDataPoints.slice(-days);
  }, [allDataPoints, timeRange]);
  const estimatedCount = useMemo(
    () => countEstimatedWorkouts(workouts, measuredAntHr(profile), fullDataPoints[0]?.date),
    [workouts, measuredAntHr(profile), fullDataPoints]
  );

  if (fullDataPoints.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-400 bg-zinc-900 rounded-2xl border border-zinc-800">
        No hay entrenamientos completados todavía. Sincroniza Suunto o registra una sesión para generar el PMC.
      </div>
    );
  }

  const latest = fullDataPoints[fullDataPoints.length - 1];
  const tsbDiagnosis = getTsbZoneDiagnosis(latest.tsb);
  const rampRateDiagnosis = getRampRateDiagnosis(latest.rampRate || 0);

  // Calculate 7-day accumulated TSS
  const last7DaysPoints = fullDataPoints.slice(-7);
  const totalTss7d = last7DaysPoints.reduce((sum, p) => sum + p.tss, 0);
  const avgDailyTss7d = Math.round(totalTss7d / 7);

  // SVG Chart Dimensions
  const width = 850;
  const height = 340;
  const padding = { top: 30, right: 55, bottom: 45, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Scales for dual axes
  // Left Axis: CTL, ATL, and Daily TSS
  const maxLoad = Math.max(
    ...fullDataPoints.map(p => Math.max(p.ctl, p.atl, p.tss * 0.7)),
    80
  );

  // Right Axis: TSB (typically spans from -40 to +30)
  const minTsbAxis = -40;
  const maxTsbAxis = 30;
  const tsbSpan = maxTsbAxis - minTsbAxis;

  const getX = (index: number) => {
    return padding.left + (index / Math.max(fullDataPoints.length - 1, 1)) * graphWidth;
  };

  const getYLoad = (val: number) => {
    const clamped = Math.max(0, val);
    return padding.top + graphHeight - (clamped / maxLoad) * graphHeight;
  };

  const getYForTsb = (val: number) => {
    const clamped = Math.max(minTsbAxis, Math.min(maxTsbAxis, val));
    const normalized = (clamped - minTsbAxis) / tsbSpan;
    return padding.top + graphHeight - normalized * graphHeight;
  };

  // Zero line for TSB
  const yZeroTsb = getYForTsb(0);

  // Generate SVG paths
  const ctlPath = fullDataPoints.reduce((acc, p, idx) => {
    const x = getX(idx);
    const y = getYLoad(p.ctl);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const atlPath = fullDataPoints.reduce((acc, p, idx) => {
    const x = getX(idx);
    const y = getYLoad(p.atl);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const tsbPath = fullDataPoints.reduce((acc, p, idx) => {
    const x = getX(idx);
    const y = getYForTsb(p.tsb);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  // Simulation calculation result
  const simResult = calculateWorkoutTss(
    simDuration,
    simAvgHr,
    measuredAntHr(profile),
    simRpe
  );

  // Impacto de la sesión simulada sobre el día de hoy: se recalcula el punto
  // de hoy a partir de ayer, sumando el TSS simulado al TSS ya hecho hoy.
  const prevPoint = allDataPoints.length >= 2 ? allDataPoints[allDataPoints.length - 2] : { ctl: 0, atl: 0 };
  const todayTssWithSim = latest.tss + simResult.tss;
  const projCtl = Math.round((prevPoint.ctl + (todayTssWithSim - prevPoint.ctl) / CTL_DAYS) * 10) / 10;
  const projAtl = Math.round((prevPoint.atl + (todayTssWithSim - prevPoint.atl) / ATL_DAYS) * 10) / 10;
  const projTsb = Math.round((projCtl - projAtl) * 10) / 10;

  return (
    <div className="space-y-6">
      {/* Header Banner with Scientific Rigor Badge */}
      <div className="rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-cyan-950/40 border border-zinc-800 p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-black text-xs uppercase tracking-wider border border-cyan-500/30">
                PMC • Performance Management Chart
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-xs border border-zinc-700">
                Modelo Científico Dr. Coggan & Dr. Banister
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/30 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> TSS de Suunto · {allDataPoints.length} días de historial
              </span>
              {estimatedCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs border border-amber-500/30 font-semibold" title="Entrenos completados sin TSS de Suunto: su TSS se estima con FC media / RPE y puede no coincidir con Suunto">
                  {estimatedCount} entreno(s) con TSS estimado
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-3">
              <Activity className="w-8 h-8 text-cyan-400 shrink-0" />
              Métricas de Carga Fisiológica: TSS, CTL, ATL y TSB
            </h1>
            <p className="text-sm text-zinc-300 mt-1 max-w-3xl leading-relaxed">
              Monitoreo objetivo de la adaptación deportiva mediante medias móviles exponencialmente ponderadas 
              (EWMA). Relación matemática rigurosa entre el estrés de la sesión (<strong>TSS</strong>), 
              la condición física acumulada (<strong>CTL a 42 días</strong>), la fatiga residual (<strong>ATL a 7 días</strong>) 
              y el balance de forma o frescura (<strong>TSB = CTL - ATL</strong>).
            </p>
          </div>

          {/* Current TSB Diagnostic Badge */}
          <div className={`px-5 py-4 rounded-2xl border ${tsbDiagnosis.bgColor} ${tsbDiagnosis.borderColor} max-w-md shrink-0 shadow-lg`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">
                Diagnóstico Fisiológico Actual (TSB):
              </span>
              <span className="text-xs font-mono font-bold text-zinc-400">
                {tsbDiagnosis.rangeDescription}
              </span>
            </div>
            <div className={`text-base font-black ${tsbDiagnosis.textColor} flex items-center gap-2`}>
              {latest.tsb < -30 ? <ShieldAlert className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              {tsbDiagnosis.label}
            </div>
            <p className="text-xs text-zinc-300 mt-1.5 leading-snug">
              {tsbDiagnosis.actionRecommendation}
            </p>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (Contrastado & Comprobado) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* 1. TSS Última Sesión / Semanal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>TSS (Semana 7d)</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono">{totalTss7d}</span>
            <span className="text-xs text-zinc-400">TSS tot.</span>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
            <span>Media diaria:</span>
            <span className="font-mono text-zinc-200 font-bold">{avgDailyTss7d} TSS/día</span>
          </div>
        </div>

        {/* 2. CTL (Chronic Training Load - Fitness) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>CTL • Fitness</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-950 text-cyan-400 rounded border border-cyan-800">τ = 42d</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-cyan-400 font-mono">{latest.ctl.toFixed(1)}</span>
            <span className="text-xs text-zinc-400">pts</span>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
            <span>Adaptación:</span>
            <span className="text-cyan-300 font-semibold">Base Crónica</span>
          </div>
        </div>

        {/* 3. ATL (Acute Training Load - Fatigue) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>ATL • Fatiga</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-950 text-rose-400 rounded border border-rose-800">τ = 7d</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400 font-mono">{latest.atl.toFixed(1)}</span>
            <span className="text-xs text-zinc-400">pts</span>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
            <span>Estrés agudo:</span>
            <span className="text-rose-300 font-semibold">{latest.atl > latest.ctl ? 'Sobrecarga' : 'Asimilada'}</span>
          </div>
        </div>

        {/* 4. TSB (Training Stress Balance - Form) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>TSB • Frescura</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded">CTL - ATL</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-black font-mono ${
              latest.tsb >= -20 && latest.tsb <= 5 ? 'text-emerald-400' : latest.tsb < -30 ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {latest.tsb > 0 ? `+${latest.tsb.toFixed(1)}` : latest.tsb.toFixed(1)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
            <span>Estado:</span>
            <span className={`font-semibold ${
              latest.tsb >= -30 && latest.tsb < -10 ? 'text-amber-400' : latest.tsb > 5 ? 'text-cyan-400' : 'text-emerald-400'
            }`}>
              {latest.tsb < -30 ? 'Peligro' : latest.tsb < -10 ? 'Carga Óptima' : latest.tsb <= 5 ? 'Mantenimiento' : 'Pico Forma'}
            </span>
          </div>
        </div>

        {/* 5. Ramp Rate (Tasa de Rampa de CTL) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Ramp Rate 7d</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-black font-mono ${rampRateDiagnosis.textColor}`}>
              {(latest.rampRate || 0) > 0 ? `+${(latest.rampRate || 0).toFixed(1)}` : (latest.rampRate || 0).toFixed(1)}
            </span>
            <span className="text-xs text-zinc-400">/sem</span>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
            <span>Guía (+3 a +7):</span>
            <span className={`font-bold ${rampRateDiagnosis.textColor}`}>{rampRateDiagnosis.status.toUpperCase()}</span>
          </div>
        </div>

        {/* 6. Umbral Anaeróbico Referencia (AnT) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>AnT / LTHR (Ref.)</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-zinc-100 font-mono">{profile.antHr || '—'}</span>
            <span className="text-xs text-zinc-400">bpm</span>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
            <span>1h al AnT:</span>
            <span className="font-mono text-zinc-300 font-bold">= 100 TSS</span>
          </div>
        </div>

      </div>

      {/* Main Interactive PMC Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        
        {/* Graph Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          
          {/* Curve Legends */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3.5 h-1 bg-cyan-400 rounded-full inline-block shadow-sm shadow-cyan-400/50" />
              Fitness (CTL - 42d)
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-3.5 h-1 bg-rose-400 rounded-full inline-block border-t border-b border-dashed border-rose-400" />
              Fatiga (ATL - 7d)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3.5 h-1 bg-amber-400 rounded-full inline-block shadow-sm shadow-amber-400/50" />
              Forma / Frescura (TSB = CTL - ATL)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 bg-amber-500/50 rounded-sm inline-block" />
              Barras de TSS diario
            </span>
          </div>

          {/* Time & Mode Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Range Selector */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
              {(['14d', '30d', '42d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    timeRange === r ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Container with Verified Physiological Zones Background */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[750px] relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72 sm:h-80 overflow-visible select-none">
              <defs>
                {/* Linear Gradients for Area & Curves */}
                <linearGradient id="ctlAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="tsbGreenZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="tsbOverloadZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id="tsbDangerZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.25" />
                </linearGradient>
              </defs>

              {/* Verified Physiological Zones Shading for TSB */}
              {/* 1. Peak Performance Zone (+5 to +25 TSB) */}
              <rect
                x={padding.left}
                y={getYForTsb(25)}
                width={graphWidth}
                height={Math.max(0, getYForTsb(5) - getYForTsb(25))}
                fill="url(#tsbGreenZone)"
              />
              <text x={padding.left + 8} y={getYForTsb(25) + 14} fill="#06b6d4" fontSize="9" fontWeight="bold" opacity="0.7">
                ZONA RENDIMIENTO ÓPTIMO / COMPETICIÓN (+5 a +25)
              </text>

              {/* 2. Optimal Overload / Training Building Zone (-30 to -10 TSB) */}
              <rect
                x={padding.left}
                y={getYForTsb(-10)}
                width={graphWidth}
                height={Math.max(0, getYForTsb(-30) - getYForTsb(-10))}
                fill="url(#tsbOverloadZone)"
              />
              <text x={padding.left + 8} y={getYForTsb(-10) + 14} fill="#f59e0b" fontSize="9" fontWeight="bold" opacity="0.7">
                ZONA ÓPTIMA DE SOBRECARGA ADAPTATIVA (-10 a -30)
              </text>

              {/* 3. Danger / Critical Fatigue Zone (TSB < -30) */}
              <rect
                x={padding.left}
                y={getYForTsb(-30)}
                width={graphWidth}
                height={Math.max(0, getYForTsb(minTsbAxis) - getYForTsb(-30))}
                fill="url(#tsbDangerZone)"
              />
              <text x={padding.left + 8} y={getYForTsb(-30) + 14} fill="#f43f5e" fontSize="9" fontWeight="bold" opacity="0.8">
                ZONA DE PELIGRO: FATIGA SEVERA Y RIESGO LESIÓN (&lt; -30)
              </text>

              {/* Horizontal Grid lines (Load axis) */}
              {[20, 40, 60, 80, 100].filter(v => v <= maxLoad).map((val) => {
                const y = getYLoad(val);
                return (
                  <g key={`grid-load-${val}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#27272a"
                      strokeDasharray="2,4"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="#71717a"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Right Axis Labels (TSB Scale) */}
              {[-30, -10, 0, 10, 20].map((tsbVal) => {
                const y = getYForTsb(tsbVal);
                return (
                  <g key={`axis-tsb-${tsbVal}`}>
                    <text
                      x={width - padding.right + 8}
                      y={y + 3}
                      fill={tsbVal === 0 ? '#fbbf24' : tsbVal > 0 ? '#34d399' : '#f87171'}
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="start"
                      fontWeight={tsbVal === 0 ? 'bold' : 'normal'}
                    >
                      {tsbVal > 0 ? `+${tsbVal}` : tsbVal}
                    </text>
                  </g>
                );
              })}

              {/* TSB Zero Baseline (Dashed Amber line) */}
              <line 
                x1={padding.left} 
                y1={yZeroTsb} 
                x2={width - padding.right} 
                y2={yZeroTsb} 
                stroke="#f59e0b" 
                strokeDasharray="4,4" 
                strokeWidth="1.2" 
                opacity="0.8"
              />
              <text x={width - padding.right - 8} y={yZeroTsb - 4} fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="end">
                TSB = 0 (Equilibrio)
              </text>

              {/* Daily TSS Bars */}
              {fullDataPoints.map((p, idx) => {
                const x = getX(idx);
                const dayTssVal = p.tss;
                const barWidth = Math.max(3, Math.min(10, graphWidth / fullDataPoints.length - 2));
                const barHeight = (dayTssVal / maxLoad) * graphHeight;
                const y = padding.top + graphHeight - barHeight;

                // Color based on TSS intensity
                const barColor = dayTssVal > 140 ? '#f59e0b' : dayTssVal > 80 ? '#38bdf8' : '#10b981';

                return (
                  <rect
                    key={`tss-bar-${p.date}`}
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 0)}
                    fill={barColor}
                    opacity={hoveredPoint?.date === p.date ? 0.9 : 0.45}
                    rx="1.5"
                    className="transition-opacity duration-150"
                  />
                );
              })}

              {/* Area under CTL curve */}
              {ctlPath && (
                <path
                  d={`${ctlPath} L ${getX(fullDataPoints.length - 1)} ${padding.top + graphHeight} L ${getX(0)} ${padding.top + graphHeight} Z`}
                  fill="url(#ctlAreaGrad)"
                />
              )}

              {/* Continuous Metric Curves */}
              {/* 1. CTL (Fitness) - Solid Cyan */}
              <path 
                d={ctlPath} 
                fill="none" 
                stroke="#22d3ee" 
                strokeWidth="2.8" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* 2. ATL (Fatigue) - Dashed Rose */}
              <path 
                d={atlPath} 
                fill="none" 
                stroke="#fb7185" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                strokeDasharray="4,2" 
              />

              {/* 3. TSB (Form) - Solid Amber */}
              <path 
                d={tsbPath} 
                fill="none" 
                stroke="#f59e0b" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Interactive Hover Trigger & Key Point Dots */}
              {fullDataPoints.map((p, idx) => {
                const x = getX(idx);
                const isHovered = hoveredPoint?.date === p.date;
                const yCtl = getYLoad(p.ctl);
                const yTsb = getYForTsb(p.tsb);

                return (
                  <g 
                    key={`point-hit-${p.date}`} 
                    onMouseEnter={() => setHoveredPoint(p)} 
                    className="cursor-pointer"
                  >
                    {/* Invisible wider hit area */}
                    <rect
                      x={x - graphWidth / (fullDataPoints.length * 2)}
                      y={padding.top}
                      width={graphWidth / fullDataPoints.length}
                      height={graphHeight}
                      fill="transparent"
                    />

                    {/* Vertical line indicator on hover */}
                    {isHovered && (
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={padding.top + graphHeight}
                        stroke="#71717a"
                        strokeDasharray="2,2"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* CTL Point */}
                    <circle
                      cx={x}
                      cy={yCtl}
                      r={isHovered ? 6 : (idx === fullDataPoints.length - 1 ? 4 : 2)}
                      fill="#22d3ee"
                      stroke="#09090b"
                      strokeWidth={isHovered ? 2 : 1}
                    />

                    {/* TSB Point */}
                    <circle
                      cx={x}
                      cy={yTsb}
                      r={isHovered ? 6 : (idx === fullDataPoints.length - 1 ? 4 : 2)}
                      fill="#f59e0b"
                      stroke="#09090b"
                      strokeWidth={isHovered ? 2 : 1}
                    />
                  </g>
                );
              })}

              {/* X Axis Date Labels */}
              {fullDataPoints.filter((_, idx, arr) => {
                const step = arr.length > 40 ? 7 : arr.length > 20 ? 4 : 2;
                return idx % step === 0 || idx === arr.length - 1;
              }).map((p) => {
                const globalIdx = fullDataPoints.findIndex(pt => pt.date === p.date);
                const x = getX(globalIdx);
                return (
                  <text
                    key={`label-date-${p.date}`}
                    x={x}
                    y={height - 12}
                    fill="#71717a"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {p.dayLabel}
                  </text>
                );
              })}

              {/* Axis Titles */}
              <text x={padding.left} y={padding.top - 12} fill="#22d3ee" fontSize="10" fontWeight="bold">
                ← Carga (CTL, ATL & TSS)
              </text>
              <text x={width - padding.right} y={padding.top - 12} fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="end">
                Balance TSB →
              </text>
            </svg>
          </div>
        </div>

        {/* Dynamic Hover Inspector Banner */}
        {hoveredPoint ? (
          <div className="bg-zinc-950 border border-zinc-700/80 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 transition-all">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-zinc-100 uppercase">{hoveredPoint.dayLabel} ({hoveredPoint.date})</span>
                {hoveredPoint.workoutTitle ? (
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-800">
                    {hoveredPoint.workoutTitle}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                    Descanso / Regeneración
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {getTsbZoneDiagnosis(hoveredPoint.tsb).label}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs">
              <div className="bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <span className="text-[9px] text-zinc-400 uppercase block">TSS Diario</span>
                <span className="text-amber-400 font-black text-sm">{hoveredPoint.tss} TSS</span>
              </div>

              {hoveredPoint.intensityFactor && (
                <div className="bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="text-[9px] text-zinc-400 uppercase block">Int. Factor (IF)</span>
                  <span className="text-zinc-200 font-black text-sm">{hoveredPoint.intensityFactor.toFixed(2)}</span>
                </div>
              )}

              <div className="bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <span className="text-[9px] text-cyan-400 uppercase block">CTL (Fitness)</span>
                <span className="text-cyan-400 font-black text-sm">{hoveredPoint.ctl.toFixed(1)}</span>
              </div>

              <div className="bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <span className="text-[9px] text-rose-400 uppercase block">ATL (Fatiga)</span>
                <span className="text-rose-400 font-black text-sm">{hoveredPoint.atl.toFixed(1)}</span>
              </div>

              <div className="bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <span className="text-[9px] text-amber-400 uppercase block">TSB (Forma)</span>
                <span className={`font-black text-sm ${hoveredPoint.tsb < -30 ? 'text-rose-400' : hoveredPoint.tsb > 5 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                  {hoveredPoint.tsb > 0 ? `+${hoveredPoint.tsb.toFixed(1)}` : hoveredPoint.tsb.toFixed(1)}
                </span>
              </div>

              {hoveredPoint.elevationLossM > 0 && (
                <div className="bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="text-[9px] text-zinc-400 uppercase block">D+ / D-</span>
                  <span className="text-emerald-400 font-black text-sm">+{hoveredPoint.elevationGainM}m / -{hoveredPoint.elevationLossM}m</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            Pasa el cursor sobre cualquier punto del gráfico para inspeccionar el desglose exacto de TSS, IF, CTL, ATL y TSB de ese día.
          </div>
        )}

      </div>

      {/* Two-Column Scientific Rigor & Interactive Simulator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Scientific Foundations & Verified Tables (Coggan & Friel) (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-100">
                Fundamentación Científica & Fórmulas Matemáticas
              </h2>
              <p className="text-xs text-zinc-400">
                Sin especulación: estándares universales de la fisiología del ejercicio deportivo
              </p>
            </div>
          </div>

          {/* Mathematical Formulas Accordion / Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400">1. Training Stress Score (TSS)</span>
                <span className="text-[10px] text-zinc-400 font-mono">Coggan (2003)</span>
              </div>
              <div className="font-mono bg-zinc-900 p-2 rounded-lg text-[11px] text-zinc-200 border border-zinc-800">
                TSS = (t_sec × HR × IF) / (AnT × 3600) × 100
                <div className="text-[10px] text-amber-400 mt-1">IF = HR_promedio / AnT (LTHR)</div>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                1 hora exacta a ritmo de Umbral Anaeróbico (IF = 1.0) equivale exactamente a <strong>100 TSS</strong>.
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400">2. Chronic Training Load (CTL)</span>
                <span className="text-[10px] text-zinc-400 font-mono">Constante τ = 42d</span>
              </div>
              <div className="font-mono bg-zinc-900 p-2 rounded-lg text-[11px] text-zinc-200 border border-zinc-800">
                CTL_t = CTL_(t-1) + (TSS_t - CTL_(t-1)) / 42
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Media móvil exponencial de 42 días (factor 1/42 ≈ 0,0238, el mismo que usa el código). Representa el <strong>Fitness</strong> (densidad mitocondrial y volumen asimilado).
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-400">3. Acute Training Load (ATL)</span>
                <span className="text-[10px] text-zinc-400 font-mono">Constante τ = 7d</span>
              </div>
              <div className="font-mono bg-zinc-900 p-2 rounded-lg text-[11px] text-zinc-200 border border-zinc-800">
                ATL_t = ATL_(t-1) + (TSS_t - ATL_(t-1)) / 7
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Media móvil exponencial de 7 días (factor 1/7 ≈ 0,143, el mismo que usa el código). Representa la <strong>Fatiga</strong> aguda inducida por las sesiones recientes.
              </p>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400">4. Training Stress Balance (TSB)</span>
                <span className="text-[10px] text-zinc-400 font-mono">Friel / Banister</span>
              </div>
              <div className="font-mono bg-zinc-900 p-2 rounded-lg text-[11px] text-zinc-200 border border-zinc-800">
                TSB = CTL - ATL (o CTL_(t-1) - ATL_(t-1))
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Diferencia directa entre condición física y fatiga. Determina la <strong>Forma / Frescura</strong> neuromuscular para el día clave.
              </p>
            </div>
          </div>

          {/* Contrast Table of TSB Interpretations (Joe Friel's Standard) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Tabla Fisiológica de Zonas de TSB (Joe Friel):
            </h3>
            
            <div className="overflow-x-auto rounded-2xl border border-zinc-800">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3">Rango TSB</th>
                    <th className="py-2.5 px-3">Estado Fisiológico</th>
                    <th className="py-2.5 px-3">Efecto Biológico</th>
                    <th className="py-2.5 px-3">Acción Recomendada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                  <tr className="bg-rose-950/20">
                    <td className="py-2.5 px-3 text-rose-400 font-bold">&lt; -30</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-rose-300">Fatiga Severa / Peligro</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-300">Inmunosupresión, riesgo de tendinopatía y sobreentrenamiento no funcional.</td>
                    <td className="py-2.5 px-3 font-sans text-rose-400 font-semibold">Descarga inmediata (-45% vol)</td>
                  </tr>
                  <tr className="bg-amber-950/20">
                    <td className="py-2.5 px-3 text-amber-400 font-bold">-30 a -10</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-amber-300">Sobrecarga Óptima</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-300">Estímulo adaptativo máximo. Aumento de densidad capilar y enzimas oxidativas.</td>
                    <td className="py-2.5 px-3 font-sans text-amber-300">Mantener bloque de carga + HRV</td>
                  </tr>
                  <tr className="bg-zinc-950">
                    <td className="py-2.5 px-3 text-zinc-300 font-bold">-10 a +5</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-zinc-200">Zona Neutra / Asimilación</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-400">Balance metabólico estable. Recuperación celular y consolidación del mesociclo.</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-300">Semanas de transición / Test</td>
                  </tr>
                  <tr className="bg-cyan-950/20">
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">+5 a +25</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-cyan-300">Pico de Rendimiento (Peak Form)</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-300">Máxima potencia mitocondrial con fatiga neuromuscular prácticamente nula.</td>
                    <td className="py-2.5 px-3 font-sans text-cyan-400 font-semibold">Día de carrera (Transvulcania)</td>
                  </tr>
                  <tr className="bg-zinc-950">
                    <td className="py-2.5 px-3 text-zinc-400 font-bold">&gt; +25</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-zinc-400">Desentrenamiento</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-400">Pérdida paulatina de adaptaciones mitocondriales y reducción de VO2max.</td>
                    <td className="py-2.5 px-3 font-sans text-zinc-400">Reanudar estímulos aeróbicos Z1/Z2</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Ramp Rate Guideline */}
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-zinc-200">Regla de Oro: Ramp Rate de CTL Semanal</span>
              <p className="text-zinc-400 leading-relaxed">
                Según las investigaciones de Joe Friel, el incremento de condición física (CTL) debe oscilar estrictamente entre 
                <strong> +3 y +7 puntos por semana</strong>. Progresiones superiores a <strong>+10 CTL/semana</strong> incrementan 
                exponencialmente la tasa de lesiones musculoesqueléticas y sobrecarga tendinosa en trail running.
              </p>
            </div>
          </div>

        </div>

        {/* Column 2: Interactive TSS & Impact Calculator (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-100">
                Calculadora & Simulador TSS
              </h2>
              <p className="text-xs text-zinc-400">
                Proyecta el impacto exacto de una sesión en tu ATL y TSB
              </p>
            </div>
          </div>

          {/* Interactive Inputs */}
          <div className="space-y-4 text-xs">
            {/* Duration Input */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-zinc-300">Duración del entrenamiento:</span>
                <span className="text-amber-400 font-mono font-bold">{simDuration} min ({Math.floor(simDuration / 60)}h {simDuration % 60}m)</span>
              </div>
              <input
                type="range"
                min="15"
                max="360"
                step="5"
                value={simDuration}
                onChange={(e) => setSimDuration(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Average Heart Rate */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-zinc-300">Pulsaciones medias (HR avg):</span>
                <span className="text-rose-400 font-mono font-bold">{simAvgHr} bpm</span>
              </div>
              <input
                type="range"
                min="100"
                max="195"
                step="1"
                value={simAvgHr}
                onChange={(e) => setSimAvgHr(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5 font-mono">
                <span>AeT: {profile.aetHr || '—'} bpm</span>
                <span>AnT (LTHR): {profile.antHr || '—'} bpm</span>
              </div>
            </div>

            {/* RPE fallback selector */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-zinc-300">Percepción de esfuerzo (sRPE 1-10):</span>
                <span className="text-zinc-200 font-mono font-bold">{simRpe} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={simRpe}
                onChange={(e) => setSimRpe(Number(e.target.value))}
                className="w-full accent-zinc-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Computed Calculation Box */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs text-zinc-400 font-semibold">TSS Resultante de la Sesión:</span>
              <div className="text-right">
                <span className="text-2xl font-black text-amber-400 font-mono">{simResult.tss}</span>
                <span className="text-xs text-zinc-400 font-bold ml-1">TSS</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Intensity Factor (IF)</span>
                <span className="text-sm font-mono font-bold text-cyan-400">{simResult.intensityFactor.toFixed(2)}</span>
                <span className="text-[9px] text-zinc-500 block mt-0.5">
                  {simResult.intensityFactor < 0.75 ? 'Resistencia Z1/Z2' : simResult.intensityFactor < 0.90 ? 'Tempo / Asimilación' : 'Umbral AnT'}
                </span>
              </div>
            </div>

            {/* Formula verification string */}
            <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
              <span className="text-zinc-500 block">Cálculo (estimación; Suunto calcula su propio TSS):</span>
              {simResult.formulaExplanation}
            </div>

            {/* Projected PMC Impact */}
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <span className="text-[11px] font-bold text-zinc-300 block">
                Impacto Proyectado al Finalizar el Día:
              </span>
              <div className="flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-zinc-500 text-[9px] block">Nuevo CTL</span>
                  <span className="text-cyan-400 font-bold">{projCtl}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[9px] block">Nuevo ATL</span>
                  <span className="text-rose-400 font-bold">{projAtl}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[9px] block">Nuevo TSB</span>
                  <span className={`font-bold ${projTsb < -30 ? 'text-rose-400' : projTsb > 5 ? 'text-cyan-400' : 'text-amber-400'}`}>
                    {projTsb > 0 ? `+${projTsb}` : projTsb}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 text-[9px] block">Diagnóstico</span>
                  <span className="text-zinc-300 text-[10px] font-sans font-semibold">
                    {getTsbZoneDiagnosis(projTsb).label.split('(')[0]}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
