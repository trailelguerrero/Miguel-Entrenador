import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Info, 
  Calendar, 
  Zap, 
  Flame, 
  Sliders, 
  Sparkles, 
  ShieldAlert, 
  ArrowRight,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Workout, DailyCheckIn, AthleteProfile, PMCDataPoint } from '../types';
import { calculateHRVLoadCorrelation, HRVLoadDataPoint, WeeklyHrvLoadBlock } from '../utils/hrvLoadCalculations';

interface WeeklyTssVsHrvWidgetProps {
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  pmcData: PMCDataPoint[];
  profile: AthleteProfile;
  onNavigateTab?: (tab: string) => void;
  onSelectMetricsTab?: (tab: 'hrv_load' | 'pmc' | 'acwr' | 'zones' | 'hrv_predictive') => void;
  defaultTimeframe?: 14 | 28 | 35;
}

export const WeeklyTssVsHrvWidget: React.FC<WeeklyTssVsHrvWidgetProps> = ({
  workouts,
  checkIns,
  pmcData,
  profile,
  onNavigateTab,
  onSelectMetricsTab,
  defaultTimeframe = 28,
}) => {
  const [timeframe, setTimeframe] = useState<14 | 28 | 35>(defaultTimeframe);
  const [viewMode, setViewMode] = useState<'continuous' | 'weekly_blocks'>('continuous');
  const [hoveredPoint, setHoveredPoint] = useState<HRVLoadDataPoint | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<WeeklyHrvLoadBlock | null>(null);
  const [showFaq, setShowFaq] = useState(false);

  // Compute physiological correlation using Plews & Buchheit methodology
  const correlation = useMemo(() => {
    return calculateHRVLoadCorrelation(workouts, checkIns, profile, timeframe);
  }, [workouts, checkIns, profile, timeframe]);

  const {
    currentHrv7d,
    baselineHrv,
    hrvDeltaFromBaselinePct,
    swcUpper,
    swcLower,
    currentWeeklyTss,
    previousWeeklyTss,
    weeklyTssTrendPct,
    currentWeeklyKm,
    loadRecoveryTrendScore,
    loadRecoveryTrendLabel,
    currentStatus,
    statusLabel,
    statusColor,
    statusBgColor,
    statusBorderColor,
    highLoadLowHrvDays,
    weeklyBlocks,
    series
  } = correlation;

  // Chart Dimensions for SVG
  const chartW = 760;
  const chartH = 240;
  const pad = { top: 25, right: 55, bottom: 35, left: 55 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  // Scales for Left Axis (HRV rMSSD in ms)
  const minHrv = Math.min(32, Math.floor(Math.min(...series.map(p => Math.min(p.dailyHrv, p.hrv7dAvg))) - 4));
  const maxHrv = Math.max(68, Math.ceil(Math.max(...series.map(p => Math.max(p.dailyHrv, p.hrv7dAvg))) + 4));

  const getYHrv = (val: number) => {
    const clamped = Math.min(maxHrv, Math.max(minHrv, val));
    return pad.top + innerH - ((clamped - minHrv) / (maxHrv - minHrv)) * innerH;
  };

  // Scales for Right Axis (Weekly TSS)
  const maxTss = useMemo(() => {
    const highestTss = Math.max(...series.map(p => p.weeklyTss), 380);
    return Math.ceil((highestTss * 1.15) / 50) * 50;
  }, [series]);

  const getYTss = (val: number) => {
    const clamped = Math.min(maxTss, Math.max(0, val));
    return pad.top + innerH - (clamped / maxTss) * innerH;
  };

  const getX = (index: number, total: number) => {
    if (total <= 1) return pad.left + innerW / 2;
    return pad.left + (index / (total - 1)) * innerW;
  };

  // Coordinates for SWC Band and Baseline
  const yBaseline = getYHrv(baselineHrv);
  const ySwcUpper = getYHrv(swcUpper);
  const ySwcLower = getYHrv(swcLower);
  const swcHeight = Math.max(0, ySwcLower - ySwcUpper);

  // SVG Paths
  const hrv7dPath = useMemo(() => {
    const pts = series.map((p, i) => `${getX(i, series.length)},${getYHrv(p.hrv7dAvg)}`);
    return pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  }, [series, minHrv, maxHrv]);

  const weeklyTssLinePath = useMemo(() => {
    const pts = series.map((p, i) => `${getX(i, series.length)},${getYTss(p.weeklyTss)}`);
    return pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  }, [series, maxTss]);

  const weeklyTssAreaPath = useMemo(() => {
    if (series.length === 0) return '';
    const pts = series.map((p, i) => `${getX(i, series.length)},${getYTss(p.weeklyTss)}`);
    const firstX = getX(0, series.length);
    const lastX = getX(series.length - 1, series.length);
    const bottomY = pad.top + innerH;
    return `M ${firstX},${bottomY} L ${pts.join(' L ')} L ${lastX},${bottomY} Z`;
  }, [series, maxTss]);

  // Umbrales de carga relativos a la forma física actual (CTL × 7), no cifras fijas
  const thr = correlation.currentLoadThresholds;

  // Lectura DESCRIPTIVA del patrón que calcula hrvLoadCalculations (una sola
  // clasificación; este widget no aplica umbrales propios). La sesión de hoy la
  // decide el motor de readiness.
  const relationshipDiagnosis = useMemo(() => {
    const TODAY = 'Es una tendencia, no una decisión: la sesión de hoy la fija el estado de readiness del día.';
    if (currentStatus === 'high_load_low_hrv') {
      return { state: 'desacople_critico', title: 'Carga muy alta + HRV baja', badge: statusLabel, badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40', summary: `HRV media de 7 días ${currentHrv7d} ms, bajo tu banda (${swcLower} ms), con ${currentWeeklyTss} TSS.`, advice: TODAY, dotColor: 'bg-rose-500', icon: AlertTriangle };
    }
    if (currentStatus === 'high_load_hrv_below_ref' || currentStatus === 'low_load_low_hrv') {
      return { state: 'sobrecarga_funcional', title: statusLabel, badge: statusLabel, badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40', summary: `HRV media de 7 días ${currentHrv7d} ms frente a tu referencia de ${baselineHrv} ms, con ${currentWeeklyTss} TSS.`, advice: TODAY, dotColor: 'bg-amber-500', icon: Zap };
    }
    if (currentStatus === 'low_load_hrv_recovered') {
      return { state: 'descarga_frescura', title: 'Carga baja + HRV en referencia', badge: statusLabel, badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', summary: `Carga semanal baja (${currentWeeklyTss} TSS) con la HRV media en ${currentHrv7d} ms.`, advice: TODAY, dotColor: 'bg-cyan-400', icon: RotateCcw };
    }
    if (currentStatus === 'insufficient_data') {
      return { state: 'sin_datos', title: 'Sin datos de HRV', badge: 'Sin HRV', badgeColor: 'bg-zinc-700/30 text-zinc-300 border-zinc-600', summary: 'No hay HRV medida en los últimos 7 días.', advice: TODAY, dotColor: 'bg-zinc-400', icon: CheckCircle2 };
    }
    return { state: 'adaptacion_optima', title: 'HRV en tu banda normal', badge: statusLabel, badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', summary: `HRV media de 7 días ${currentHrv7d} ms dentro de tu banda (${swcLower}-${swcUpper} ms) con ${currentWeeklyTss} TSS.`, advice: TODAY, dotColor: 'bg-emerald-400', icon: CheckCircle2 };
  }, [currentStatus, statusLabel, currentWeeklyTss, currentHrv7d, swcLower, swcUpper, baselineHrv]);

  const DiagIcon = relationshipDiagnosis.icon;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden transition-all">
      {/* Background ambient glow reflecting state */}
      <div 
        className={`absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15 ${
          relationshipDiagnosis.state === 'desacople_critico' ? 'bg-rose-500' :
          relationshipDiagnosis.state === 'sobrecarga_funcional' ? 'bg-amber-500' :
          relationshipDiagnosis.state === 'descarga_frescura' ? 'bg-cyan-500' : 'bg-emerald-500'
        }`}
      />

      {/* Widget Header & Controls */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold uppercase tracking-wider border border-rose-500/20 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 fill-rose-500/20 text-rose-400" />
              Biomarcador Uphill Athlete
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${relationshipDiagnosis.badgeColor}`}>
              <span className={`w-2 h-2 rounded-full ${relationshipDiagnosis.dotColor} animate-pulse`} />
              {relationshipDiagnosis.badge}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-zinc-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-cyan-400 shrink-0" />
            <span>Carga Semanal (TSS) vs Media Móvil HRV 7d</span>
          </h3>

          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Monitoriza la correlación directa entre la <strong>intensidad acumulada (TSS 7d)</strong> y la <strong>HRV nocturna (rMSSD, media de 7 días)</strong> para ver cómo se mueven juntas. Es descriptivo: no decide tu sesión.
          </p>
        </div>

        {/* View mode toggle & Timeframe buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* View mode */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center text-xs">
            <button
              onClick={() => setViewMode('continuous')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'continuous'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Ver gráfico continuo día a día"
            >
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>Día a Día</span>
            </button>
            <button
              onClick={() => setViewMode('weekly_blocks')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'weekly_blocks'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Comparativa de bloques semanales"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Por Semanas</span>
            </button>
          </div>

          {/* Timeframe */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center text-xs">
            {([14, 28, 35] as const).map(days => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  timeframe === days ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Methodology info button */}
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 transition cursor-pointer"
            title="Cómo interpretar esta relación"
          >
            <Info className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Methodology Dropdown */}
      {showFaq && (
        <div className="bg-zinc-950 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 text-xs text-zinc-300 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-cyan-300 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              ¿Cómo interpretar la relación entre Carga Semanal y HRV 7d?
            </span>
            <button 
              onClick={() => setShowFaq(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 leading-relaxed">
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-emerald-500/20 space-y-1">
              <span className="font-bold text-emerald-400 block">1. HRV en tu banda</span>
              <p className="text-[11px] text-zinc-400">
                La HRV media de 7 días está dentro de tu banda normal ({swcLower}-{swcUpper} ms), con la carga que sea.
              </p>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-amber-500/20 space-y-1">
              <span className="font-bold text-amber-400 block">2. Carga alta + HRV algo baja</span>
              <p className="text-[11px] text-zinc-400">
                Carga por encima de lo habitual con la HRV media algo por debajo de tu referencia, aún dentro de tu banda.
              </p>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-rose-500/20 space-y-1">
              <span className="font-bold text-rose-400 block">3. Carga muy alta + HRV baja</span>
              <p className="text-[11px] text-zinc-400">
                La carga semanal se mantiene alta ({thr ? <>&gt; {thr.high} TSS, +10 % sobre tu CTL×7</> : 'sin CTL aún'}) y la HRV media de 7 días está por debajo de {swcLower} ms. Es una tendencia, no un diagnóstico: la sesión de hoy la decide el estado de readiness.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Weekly TSS Load */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Carga Semanal Acumulada</span>
            <span className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
                {currentWeeklyTss}
              </span>
              <span className="text-xs text-zinc-400 font-bold">TSS (7d)</span>
            </div>
            <div className="text-[11px] font-mono mt-0.5 text-zinc-400 flex items-center gap-1.5">
              <span className={weeklyTssTrendPct >= 0 ? 'text-amber-400' : 'text-cyan-400'}>
                {weeklyTssTrendPct >= 0 ? `+${weeklyTssTrendPct}%` : `${weeklyTssTrendPct}%`}
              </span>
              <span>vs 7d previos ({previousWeeklyTss} TSS)</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-900 flex justify-between">
            <span>Volumen 7d:</span>
            <span className="text-zinc-300 font-mono font-bold">{currentWeeklyKm} km</span>
          </div>
        </div>

        {/* KPI 2: 7-Day Rolling HRV Average */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Media Móvil HRV (7d)</span>
            <span className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
              <Heart className="w-3.5 h-3.5 fill-rose-500/20" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-black font-mono ${
                currentHrv7d < swcLower ? 'text-rose-400' :
                currentHrv7d <= swcUpper ? 'text-emerald-400' : 'text-cyan-400'
              }`}>
                {currentHrv7d}
              </span>
              <span className="text-xs text-zinc-400 font-bold">ms rMSSD</span>
            </div>
            <div className="text-[11px] font-mono mt-0.5 text-zinc-400 flex items-center gap-1.5">
              <span className={hrvDeltaFromBaselinePct >= 0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                {hrvDeltaFromBaselinePct >= 0 ? `+${hrvDeltaFromBaselinePct}%` : `${hrvDeltaFromBaselinePct}%`}
              </span>
              <span>vs basal ({baselineHrv} ms)</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-900 flex justify-between">
            <span>Banda Normal SWC:</span>
            <span className="text-emerald-400 font-mono font-bold">{swcLower} - {swcUpper} ms</span>
          </div>
        </div>

        {/* KPI 3: Autonomic Coupling Index */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Índice de Acoplamiento</span>
            <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
              <Zap className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-black font-mono ${
                loadRecoveryTrendScore >= 70 ? 'text-emerald-400' :
                loadRecoveryTrendScore >= 45 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {loadRecoveryTrendScore}
              </span>
              <span className="text-xs text-zinc-400 font-bold">/ 100</span>
            </div>
            {/* Visual Gauge Bar */}
            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden mt-1.5 border border-zinc-800">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  loadRecoveryTrendScore >= 70 ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' :
                  loadRecoveryTrendScore >= 45 ? 'bg-gradient-to-r from-amber-500 to-emerald-400' :
                  'bg-gradient-to-r from-rose-600 to-amber-500'
                }`}
                style={{ width: `${loadRecoveryTrendScore}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-900 truncate">
            {loadRecoveryTrendLabel}
          </div>
        </div>

        {/* KPI 4: Relationship Verdict */}
        <div className={`p-4 rounded-2xl border space-y-2 flex flex-col justify-between ${relationshipDiagnosis.badgeColor}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px]">Diagnóstico Carga/Recuperación</span>
            <DiagIcon className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <div className="text-sm font-black leading-tight text-zinc-100">
              {relationshipDiagnosis.title}
            </div>
            <p className="text-[11px] text-zinc-300 mt-1 leading-snug line-clamp-2">
              {relationshipDiagnosis.summary}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {thr
                ? `Tus umbrales hoy (CTL ${thr.ctl} → ${thr.chronicWeeklyTss} TSS/sem): baja < ${thr.low} · alta > ${thr.high} · muy alta > ${thr.veryHigh}`
                : 'Sin CTL todavía: no se clasifica la carga como alta o baja.'}
            </p>
          </div>
          <div className="text-[10px] pt-1.5 border-t border-zinc-800/80 flex items-center justify-between">
            <span className="text-zinc-400">Días carga muy alta + HRV baja:</span>
            <span className="font-mono font-bold text-zinc-200">{highLoadLowHrvDays} de {timeframe}d</span>
          </div>
        </div>
      </div>

      {/* Main Visual Display: Continuous Dual-Axis Chart OR Weekly Blocks */}
      {viewMode === 'continuous' ? (
        <div className="bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-3">
          {/* Chart Header & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-200">Evolución Diaria:</span>
              <span className="text-zinc-400 text-[11px]">
                Carga semanal acumulada (área cian) vs Tendencia HRV 7d (línea rosa)
              </span>
            </div>

            {/* Interactive Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-1.5 bg-rose-500 rounded" />
                <span className="text-rose-400 font-bold">HRV 7d (ms)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400/50 border border-rose-400" />
                <span className="text-zinc-400">HRV Diario</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded bg-cyan-500/30 border border-cyan-500/60" />
                <span className="text-cyan-400 font-bold">Carga 7d (TSS)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded bg-emerald-500/20 border border-emerald-500/40" />
                <span className="text-emerald-400">Banda SWC Normal</span>
              </div>
              {highLoadLowHrvDays > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-500/60" />
                  <span className="text-rose-300">Carga muy alta + HRV baja</span>
                </div>
              )}
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[660px]">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-56 overflow-visible select-none">
                
                {/* 1. Shaded Normal SWC Band (Baseline ± 0.5 SD) */}
                <rect
                  x={pad.left}
                  y={ySwcUpper}
                  width={innerW}
                  height={swcHeight}
                  fill="#10b981"
                  fillOpacity="0.10"
                />
                <line
                  x1={pad.left}
                  y1={ySwcUpper}
                  x2={pad.left + innerW}
                  y2={ySwcUpper}
                  stroke="#10b981"
                  strokeDasharray="3,3"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />
                <line
                  x1={pad.left}
                  y1={ySwcLower}
                  x2={pad.left + innerW}
                  y2={ySwcLower}
                  stroke="#10b981"
                  strokeDasharray="3,3"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />

                {/* Athlete's Baseline Reference Line */}
                <line
                  x1={pad.left}
                  y1={yBaseline}
                  x2={pad.left + innerW}
                  y2={yBaseline}
                  stroke="#34d399"
                  strokeWidth="1.2"
                  strokeOpacity="0.75"
                />

                {/* 2. Highlighted Overreaching (NFOR Desacople) Vertical Windows */}
                {series.map((p, i) => {
                  if (!p.isHighLoadLowHrv) return null;
                  const x = getX(i, series.length);
                  const colW = innerW / series.length;
                  return (
                    <rect
                      key={`overreach-win-${p.date}`}
                      x={x - colW / 2}
                      y={pad.top}
                      width={colW}
                      height={innerH}
                      fill="#f43f5e"
                      fillOpacity="0.15"
                    />
                  );
                })}

                {/* 3. Right Axis Carga Semanal (TSS): Gradient Area and Line */}
                <defs>
                  <linearGradient id="widgetTssGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                <path
                  d={weeklyTssAreaPath}
                  fill="url(#widgetTssGrad)"
                />

                <path
                  d={weeklyTssLinePath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 4. Left Axis Raw Daily HRV Points (Discrete faint trail) */}
                {series.map((p, i) => {
                  const x = getX(i, series.length);
                  const y = getYHrv(p.dailyHrv);
                  return (
                    <circle
                      key={`raw-dot-${p.date}`}
                      cx={x}
                      cy={y}
                      r={2}
                      fill="#fb7185"
                      fillOpacity="0.45"
                    />
                  );
                })}

                {/* 5. Left Axis: 7-Day Rolling HRV Average Curve (Bold, Smooth) */}
                <path
                  d={hrv7dPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 6. Y-Axis Left (HRV ms) Labels */}
                <text x={pad.left - 8} y={getYHrv(maxHrv) + 4} fill="#71717a" fontSize="8.5" fontFamily="monospace" textAnchor="end">{maxHrv}ms</text>
                <text x={pad.left - 8} y={ySwcUpper + 3} fill="#10b981" fontSize="8" fontFamily="monospace" textAnchor="end">{swcUpper}</text>
                <text x={pad.left - 8} y={yBaseline + 3} fill="#34d399" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="end">{baselineHrv}</text>
                <text x={pad.left - 8} y={ySwcLower + 3} fill="#10b981" fontSize="8" fontFamily="monospace" textAnchor="end">{swcLower}</text>
                <text x={pad.left - 8} y={getYHrv(minHrv) + 4} fill="#71717a" fontSize="8.5" fontFamily="monospace" textAnchor="end">{minHrv}ms</text>

                <text
                  x={12}
                  y={pad.top + innerH / 2}
                  fill="#f43f5e"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  transform={`rotate(-90 12 ${pad.top + innerH / 2})`}
                >
                  HRV 7d (ms)
                </text>

                {/* 7. Y-Axis Right (Weekly TSS) Labels */}
                <text x={pad.left + innerW + 8} y={getYTss(maxTss) + 4} fill="#06b6d4" fontSize="8.5" fontFamily="monospace" textAnchor="start">{maxTss} TSS</text>
                <text x={pad.left + innerW + 8} y={getYTss(maxTss * 0.5) + 4} fill="#71717a" fontSize="8.5" fontFamily="monospace" textAnchor="start">{Math.round(maxTss * 0.5)}</text>
                <text x={pad.left + innerW + 8} y={getYTss(0) + 4} fill="#71717a" fontSize="8.5" fontFamily="monospace" textAnchor="start">0</text>

                <text
                  x={chartW - 12}
                  y={pad.top + innerH / 2}
                  fill="#06b6d4"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  transform={`rotate(90 ${chartW - 12} ${pad.top + innerH / 2})`}
                >
                  Carga TSS 7d
                </text>

                {/* 8. Interactive Slices and Nodes */}
                {series.map((p, i) => {
                  const x = getX(i, series.length);
                  const yHrv = getYHrv(p.hrv7dAvg);
                  const isHovered = hoveredPoint?.date === p.date;

                  const nodeColor = p.isHighLoadLowHrv
                    ? '#f43f5e'
                    : p.hrv7dAvg >= baselineHrv
                    ? '#10b981'
                    : '#f59e0b';

                  return (
                    <g 
                      key={`hit-${p.date}`}
                      onMouseEnter={() => setHoveredPoint(p)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={x - 8}
                        y={pad.top}
                        width={16}
                        height={innerH}
                        fill="transparent"
                      />

                      {isHovered && (
                        <line
                          x1={x}
                          y1={pad.top}
                          x2={x}
                          y2={pad.top + innerH}
                          stroke="#e4e4e7"
                          strokeDasharray="2,2"
                          strokeWidth="1"
                        />
                      )}

                      <circle
                        cx={x}
                        cy={yHrv}
                        r={isHovered ? 5.5 : (i === series.length - 1 ? 4.5 : 3)}
                        fill={nodeColor}
                        stroke="#18181b"
                        strokeWidth={isHovered ? 2 : 1.2}
                      />
                    </g>
                  );
                })}

                {/* 9. X-Axis Date Labels */}
                {series
                  .filter((_, i) => i % (timeframe > 20 ? 5 : 3) === 0 || i === series.length - 1)
                  .map((p) => {
                    const idx = series.findIndex(pt => pt.date === p.date);
                    const x = getX(idx, series.length);
                    return (
                      <text
                        key={`x-${p.date}`}
                        x={x}
                        y={chartH - 10}
                        fill="#71717a"
                        fontSize="8.5"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {p.dayLabel}
                      </text>
                    );
                  })}
              </svg>
            </div>
          </div>

          {/* Interactive Inspection Bar on Hover */}
          {hoveredPoint ? (
            <div className="bg-zinc-900 border border-zinc-700/80 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-100 font-mono">{hoveredPoint.date}</span>
                  <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                    hoveredPoint.status === 'high_load_low_hrv' ? 'bg-rose-500/20 text-rose-400' :
                    hoveredPoint.status === 'high_load_hrv_below_ref' ? 'bg-amber-500/20 text-amber-400' :
                    hoveredPoint.status === 'low_load_hrv_recovered' ? 'bg-cyan-500/20 text-cyan-400' :
                    hoveredPoint.status === 'insufficient_data' ? 'bg-zinc-700/40 text-zinc-300' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {hoveredPoint.status === 'high_load_low_hrv' ? 'Carga muy alta + HRV baja' :
                     hoveredPoint.status === 'high_load_hrv_below_ref' ? 'Carga alta + HRV algo baja' :
                     hoveredPoint.status === 'low_load_hrv_recovered' ? 'Carga baja + HRV en referencia' :
                     hoveredPoint.status === 'insufficient_data' ? 'Sin datos de HRV' : 'Estable'}
                  </span>
                </div>
                <span className="text-zinc-400 text-[11px] block">
                  {hoveredPoint.workoutTitles.length > 0 
                    ? hoveredPoint.workoutTitles.join(' + ') 
                    : 'Descanso activo / regeneración'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Carga 7d (TSS)</span>
                  <span className="text-cyan-400 font-bold">{hoveredPoint.weeklyTss} TSS</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Media Móvil HRV 7d</span>
                  <span className={`font-bold ${hoveredPoint.hrv7dAvg < swcLower ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {hoveredPoint.hrv7dAvg} ms
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">HRV Diario</span>
                  <span className="text-zinc-300 font-bold">{hoveredPoint.dailyHrv} ms</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">FC Reposo</span>
                  <span className="text-amber-400 font-bold">{hoveredPoint.restingHr} bpm</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 text-center py-1 font-mono">
              Pasa el cursor por los puntos del gráfico para inspeccionar la correlación día a día.
            </div>
          )}
        </div>
      ) : (
        /* Weekly Blocks Mode: 4-Week Bar Comparison */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {weeklyBlocks.map((block) => {
              const isSelected = selectedBlock?.id === block.id;
              const hrvIsLow = block.avgHrv < swcLower;
              const isOverreach = block.isHighLoadLowHrv;

              return (
                <div
                  key={block.id}
                  onClick={() => setSelectedBlock(block)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    isSelected 
                      ? 'bg-zinc-800/90 border-cyan-400 shadow-xl' 
                      : block.isCurrentWeek
                      ? 'bg-zinc-950 border-cyan-500/50 hover:border-cyan-400'
                      : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">
                      {block.name}
                    </span>
                    {block.isCurrentWeek ? (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-black uppercase">
                        Actual
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {block.startDate.slice(5)} al {block.endDate.slice(5)}
                      </span>
                    )}
                  </div>

                  {/* Dual Bar Representation */}
                  <div className="space-y-2">
                    {/* TSS Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-zinc-400">Carga Acumulada:</span>
                        <span className="text-cyan-400 font-bold">{block.weeklyTss} TSS</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${Math.min(100, (block.weeklyTss / 500) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* HRV Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-zinc-400">Media HRV 7d:</span>
                        <span className={`font-bold ${hrvIsLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {block.avgHrv} ms ({block.hrvDeltaPct >= 0 ? `+${block.hrvDeltaPct}%` : `${block.hrvDeltaPct}%`})
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                          className={`h-full rounded-full ${hrvIsLow ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (block.avgHrv / 65) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status & Volume Footer */}
                  <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-[10px]">
                    <span className={`px-2 py-0.5 rounded font-bold ${block.badgeBg} ${block.badgeText}`}>
                      {block.statusLabel}
                    </span>
                    <span className="text-zinc-400 font-mono font-bold">
                      +{block.elevationGainM}m D+
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Week Detail Callout */}
          {selectedBlock && (
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="space-y-1">
                <span className="font-bold text-zinc-200 block text-sm">
                  Dictamen Fisiológico de {selectedBlock.name}
                </span>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  {selectedBlock.description}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Distancia</span>
                  <span className="font-bold text-zinc-200">{selectedBlock.weeklyKm} km</span>
                </div>
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Horas</span>
                  <span className="font-bold text-zinc-200">{selectedBlock.weeklyHours} h</span>
                </div>
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">FC Reposo</span>
                  <span className="font-bold text-amber-400">{selectedBlock.restingHrAvg} bpm</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actionable Coach Callout & Fast Actions */}
      <div className="bg-zinc-950 border border-zinc-850 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Recomendación Táctica del Coach Miguel (50 Años • Transvulcania)
            </span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {relationshipDiagnosis.advice}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onSelectMetricsTab && (
            <button
              onClick={() => onSelectMetricsTab('hrv_load')}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer flex items-center gap-1.5"
              title="Ver la matriz de 4 cuadrantes carga / HRV"
            >
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span>Ver Matriz 4 Cuadrantes</span>
            </button>
          )}

            <button
              onClick={() => onNavigateTab?.('calendar')}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ajustar Sesiones</span>
            </button>

          <button
            onClick={() => onNavigateTab?.('zonesense')}
            className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <span>Ver ZoneSense</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
