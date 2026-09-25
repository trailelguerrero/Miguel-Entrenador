import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar, 
  RotateCcw, 
  HelpCircle, 
  Flame, 
  Layers, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { Workout, DailyCheckIn, AthleteProfile, PMCDataPoint } from '../types';
import { calculateHRVLoadCorrelation, HRVLoadDataPoint } from '../utils/hrvLoadCalculations';
import { HRVPredictiveRegressionCard } from './HRVPredictiveRegressionCard';

interface HRVLoadOverreachingViewProps {
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  pmcData: PMCDataPoint[];
  profile: AthleteProfile;
  onScheduleDeload?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const HRVLoadOverreachingView: React.FC<HRVLoadOverreachingViewProps> = ({
  workouts,
  checkIns,
  pmcData,
  profile,
  onScheduleDeload,
  onNavigateTab,
}) => {
  const [loadMetric, setLoadMetric] = useState<'tss' | 'km' | 'hours'>('tss');
  const [windowDays, setWindowDays] = useState<28 | 35>(28);
  const [showScienceGuide, setShowScienceGuide] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<HRVLoadDataPoint | null>(null);

  // Compute physiological correlation model
  const summary = useMemo(() => {
    return calculateHRVLoadCorrelation(workouts, checkIns, profile, windowDays);
  }, [workouts, checkIns, profile, windowDays]);

  // Chart Dimensions
  const chartW = 780;
  const chartH = 260;
  const pad = { top: 25, right: 55, bottom: 40, left: 55 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  // Scales & Bounds for HRV (Left Axis)
  // Dynamic scale centered around baseline (e.g. 30 to 70 ms)
  const minHrv = Math.min(32, Math.floor(Math.min(...summary.series.map(p => Math.min(p.dailyHrv, p.hrv7dAvg))) - 4));
  const maxHrv = Math.max(68, Math.ceil(Math.max(...summary.series.map(p => Math.max(p.dailyHrv, p.hrv7dAvg))) + 4));

  const getYHrv = (val: number) => {
    const clamped = Math.min(maxHrv, Math.max(minHrv, val));
    return pad.top + innerH - ((clamped - minHrv) / (maxHrv - minHrv)) * innerH;
  };

  // Scales & Bounds for Weekly Load (Right Axis)
  const maxLoad = useMemo(() => {
    if (loadMetric === 'tss') {
      const maxT = Math.max(...summary.series.map(p => p.weeklyTss));
      return Math.max(450, Math.ceil(maxT * 1.15 / 50) * 50);
    } else if (loadMetric === 'km') {
      const maxK = Math.max(...summary.series.map(p => p.weeklyKm));
      return Math.max(50, Math.ceil(maxK * 1.15 / 10) * 10);
    } else {
      const maxH = Math.max(...summary.series.map(p => p.weeklyHours));
      return Math.max(8, Math.ceil(maxH * 1.15));
    }
  }, [summary.series, loadMetric]);

  const getYLoad = (val: number) => {
    const clamped = Math.min(maxLoad, Math.max(0, val));
    return pad.top + innerH - (clamped / maxLoad) * innerH;
  };

  const getX = (index: number, total: number) => {
    if (total <= 1) return pad.left + innerW / 2;
    return pad.left + (index / (total - 1)) * innerW;
  };

  // Baseline & SWC Band Coordinates
  const yBaseline = getYHrv(summary.baselineHrv);
  const ySwcUpper = getYHrv(summary.swcUpper);
  const ySwcLower = getYHrv(summary.swcLower);
  const swcBandHeight = Math.max(0, ySwcLower - ySwcUpper);

  // SVG Path for 7-day Rolling HRV Average (smooth primary curve)
  const hrv7dLinePath = useMemo(() => {
    const pts = summary.series.map((p, i) => `${getX(i, summary.series.length)},${getYHrv(p.hrv7dAvg)}`);
    return pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  }, [summary.series, minHrv, maxHrv]);

  // SVG Path for Daily HRV (subtle dots / dashed line)
  const dailyHrvLinePath = useMemo(() => {
    const pts = summary.series.map((p, i) => `${getX(i, summary.series.length)},${getYHrv(p.dailyHrv)}`);
    return pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  }, [summary.series, minHrv, maxHrv]);

  // SVG Path for Weekly Load curve & area
  const weeklyLoadLinePath = useMemo(() => {
    const pts = summary.series.map((p, i) => {
      const val = loadMetric === 'tss' ? p.weeklyTss : loadMetric === 'km' ? p.weeklyKm : p.weeklyHours;
      return `${getX(i, summary.series.length)},${getYLoad(val)}`;
    });
    return pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  }, [summary.series, loadMetric, maxLoad]);

  const weeklyLoadAreaPath = useMemo(() => {
    if (summary.series.length === 0) return '';
    const pts = summary.series.map((p, i) => {
      const val = loadMetric === 'tss' ? p.weeklyTss : loadMetric === 'km' ? p.weeklyKm : p.weeklyHours;
      return `${getX(i, summary.series.length)},${getYLoad(val)}`;
    });
    const firstX = getX(0, summary.series.length);
    const lastX = getX(summary.series.length - 1, summary.series.length);
    const bottomY = pad.top + innerH;
    return `M ${firstX},${bottomY} L ${pts.join(' L ')} L ${lastX},${bottomY} Z`;
  }, [summary.series, loadMetric, maxLoad]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div 
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-20 ${
          summary.currentStatus === 'non_functional_overreaching' ? 'bg-rose-500' :
          summary.currentStatus === 'functional_overreaching' ? 'bg-amber-500' :
          summary.currentStatus === 'recovery_deload' ? 'bg-cyan-500' : 'bg-emerald-500'
        }`} 
      />

      {/* Header and Controls */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/20 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 fill-rose-500/20 text-rose-400" />
              Tono Parasimpático vs Carga
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 font-mono text-[11px]">
              Media Móvil 7d HRV rMSSD + Carga Semanal
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-zinc-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-rose-400 shrink-0" />
            <span>Monitor de Sobre-esfuerzo: HRV 7d vs Carga Semanal</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Correlaciona la <strong>media móvil de 7 días del HRV rMSSD</strong> nocturno con la <strong>carga acumulada de entrenamiento</strong> para identificar a tiempo desacoples del sistema nervioso autónomo y prevenir el sobre-esfuerzo no funcional (NFOR).
          </p>
        </div>

        {/* View Switches */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Load Metric Switch */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center text-xs">
            <button
              onClick={() => setLoadMetric('tss')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                loadMetric === 'tss'
                  ? 'bg-zinc-800 text-cyan-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Carga en TSS acumulado (7 días)"
            >
              TSS Semanal
            </button>
            <button
              onClick={() => setLoadMetric('km')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                loadMetric === 'km'
                  ? 'bg-zinc-800 text-cyan-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Kilómetros acumulados en 7 días"
            >
              Km Semanal
            </button>
            <button
              onClick={() => setLoadMetric('hours')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                loadMetric === 'hours'
                  ? 'bg-zinc-800 text-cyan-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Horas acumuladas en 7 días"
            >
              Horas
            </button>
          </div>

          {/* Window Range */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center text-xs">
            <button
              onClick={() => setWindowDays(28)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                windowDays === 28 ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              28d
            </button>
            <button
              onClick={() => setWindowDays(35)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                windowDays === 35 ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              35d
            </button>
          </div>

          {/* Methodology Button */}
          <button
            onClick={() => setShowScienceGuide(!showScienceGuide)}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Ver metodología de Plews, Buchheit y Marco Altini"
          >
            <HelpCircle className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Metodología</span>
          </button>
        </div>
      </div>

      {/* Methodology Dropdown Guide */}
      {showScienceGuide && (
        <div className="bg-zinc-950 border border-rose-500/30 rounded-2xl p-5 text-xs text-zinc-300 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <span className="font-bold text-rose-400 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Ciencia del Desacople HRV 7d vs Carga (Plews & Buchheit, 2013)
            </span>
            <button 
              onClick={() => setShowScienceGuide(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-0.5 rounded"
            >
              Cerrar ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 leading-relaxed">
            <div className="space-y-2">
              <strong className="text-zinc-100 block">¿Por qué usar la Media Móvil de 7 días?</strong>
              <p>
                El valor puntual de HRV diario tiene ruido agudo (afectado por cenas tardías, hidratación, calor o estrés laboral). La <strong>media móvil de 7 días</strong> (Buchheit, 2014; Altini, 2018) suaviza las oscilaciones diarias y refleja el verdadero tono autonómico basal del sistema parasimpático.
              </p>
              <p>
                <strong>Banda de Normalidad SWC (Smallest Worthwhile Change):</strong> Se define como tu Línea Base ({summary.baselineHrv} ms) &plusmn; 0.5 &times; Desviación Típica ({summary.swcLower} - {summary.swcUpper} ms). Permanecer dentro de esta banda confirma adaptación positiva al estímulo.
              </p>
            </div>

            <div className="space-y-2">
              <strong className="text-zinc-100 block">Patrones Clínicos de Sobre-esfuerzo:</strong>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <strong>Adaptación Óptima:</strong> Carga semanal alta con HRV 7d estable dentro o por encima de la banda SWC.
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <strong>Carga alta asumida:</strong> carga semanal por encima de lo habitual con la HRV media de 7 días algo por debajo de tu referencia.
                </div>
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <strong>Fatiga acumulada:</strong> carga semanal muy alta con la HRV media de 7 días por debajo de tu banda normal ({summary.swcLower} ms). Es una tendencia a vigilar, no un diagnóstico; lo que toca hacer hoy lo decide el semáforo del día.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: HRV 7-Day Rolling Average */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Media Móvil HRV (7d)</span>
            <span className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400">
              <Heart className="w-4 h-4 fill-rose-500/20" />
            </span>
          </div>

          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className={`text-3xl font-black font-mono ${
                summary.currentHrv7d < summary.swcLower ? 'text-rose-400' :
                summary.currentHrv7d <= summary.swcUpper ? 'text-emerald-400' : 'text-cyan-400'
              }`}>
                {summary.currentHrv7d}
              </span>
              <span className="text-xs text-zinc-400 font-bold">ms (rMSSD)</span>
            </div>
            <div className="text-xs font-mono mt-1 flex items-center gap-1.5">
              <span className={summary.hrvDeltaFromBaselinePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {summary.hrvDeltaFromBaselinePct >= 0 ? `+${summary.hrvDeltaFromBaselinePct}%` : `${summary.hrvDeltaFromBaselinePct}%`}
              </span>
              <span className="text-zinc-500">vs base ({summary.baselineHrv} ms)</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Banda SWC normal:</span>
            <span className="font-mono text-zinc-200 font-bold">{summary.swcLower} - {summary.swcUpper} ms</span>
          </div>
        </div>

        {/* Card 2: Weekly Load (7d sum) */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Carga Semanal Acumulada</span>
            <span className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>

          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-black text-cyan-400 font-mono">
                {loadMetric === 'tss' ? summary.currentWeeklyTss : loadMetric === 'km' ? summary.currentWeeklyKm : summary.currentWeeklyHours}
              </span>
              <span className="text-xs text-zinc-400 font-bold">
                {loadMetric === 'tss' ? 'TSS total' : loadMetric === 'km' ? 'km' : 'horas'}
              </span>
            </div>
            <div className="text-xs font-mono mt-1 flex items-center gap-1.5">
              <span className={summary.weeklyTssTrendPct >= 0 ? 'text-amber-400' : 'text-cyan-400'}>
                {summary.weeklyTssTrendPct >= 0 ? `+${summary.weeklyTssTrendPct}%` : `${summary.weeklyTssTrendPct}%`}
              </span>
              <span className="text-zinc-500">vs 7 días previos</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Volumen 7d:</span>
            <span className="font-mono text-cyan-300 font-bold">{summary.currentWeeklyKm} km • {summary.currentWeeklyHours}h</span>
          </div>
        </div>

        {/* Card 3: Autonomic Balance Status */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Estado Autonómico</span>
            <span className={`p-1.5 rounded-xl ${summary.statusBgColor} ${summary.statusColor}`}>
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>

          <div>
            <div className={`text-base font-black truncate leading-tight ${summary.statusColor}`}>
              {summary.statusLabel}
            </div>
            <div className="text-xs text-zinc-400 mt-1 line-clamp-1">
              {summary.riskAssessment}
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Tono vagal:</span>
            <span className={`font-bold font-mono ${summary.statusColor}`}>
              {summary.currentHrv7d < summary.swcLower ? 'Suprimido' : 'Preservado'}
            </span>
          </div>
        </div>

        {/* Card 4: Overreaching Episodes Count */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider text-[10px]">Días en Sobre-esfuerzo</span>
            <span className={`p-1.5 rounded-xl ${summary.overreachingDaysCount > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <Flame className="w-4 h-4" />
            </span>
          </div>

          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className={`text-3xl font-black font-mono ${summary.overreachingDaysCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {summary.overreachingDaysCount}
              </span>
              <span className="text-xs text-zinc-400 font-bold">días</span>
            </div>
            <div className="text-xs font-mono text-zinc-400 mt-1">
              en los últimos {windowDays} días
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Episodios de fatiga acumulada:</span>
            <span className={`font-bold font-mono ${summary.overreachingEpisodes.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {summary.overreachingEpisodes.length} detectados
            </span>
          </div>
        </div>

      </div>

      {/* Overreaching Active Alert Banner if flagged */}
      {summary.isDeloadRecommended && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-rose-100 text-sm block">
                ¡Alerta de Sobre-esfuerzo No Funcional Detectado!
              </strong>
              <p className="text-rose-300 text-xs mt-0.5 leading-relaxed">
                Tu media móvil de HRV 7d ({summary.currentHrv7d} ms) se encuentra significativamente por debajo de tu límite de asimilación ({summary.swcLower} ms) con una carga sostenida de {summary.currentWeeklyTss} TSS.
              </p>
            </div>
          </div>

          {onScheduleDeload && (
            <button
              onClick={onScheduleDeload}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black text-xs transition shadow-lg shadow-rose-950/40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Programar Descarga Inmediata (-45%)</span>
            </button>
          )}
        </div>
      )}

      {/* Main Dual-Axis Interactive Chart */}
      <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div>
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              Gráfico Doble Eje: Media Móvil HRV 7d (Izquierda) vs Carga Semanal (Derecha)
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              La banda sombreada horizontal representa tu rango normal SWC ({summary.swcLower} - {summary.swcUpper} ms). Las zonas sombreadas en rojo indican periodos de desacople y sobre-esfuerzo.
            </p>
          </div>

          {/* Interactive Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 bg-rose-500 rounded" />
              <span className="text-rose-400 font-bold">HRV 7d (ms)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400/40 border border-rose-400" />
              <span className="text-zinc-400">HRV Diario</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/60" />
              <span className="text-cyan-400 font-bold">
                {loadMetric === 'tss' ? 'Carga TSS' : loadMetric === 'km' ? 'Carga Km' : 'Carga Horas'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded bg-emerald-500/20 border border-emerald-500/40" />
              <span className="text-emerald-400">Banda SWC Normal</span>
            </div>
          </div>
        </div>

        {/* Dual Axis SVG Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[680px]">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto overflow-visible select-none">
              
              {/* 1. Shaded Normal SWC Band (Baseline ± 0.5 SD) */}
              <rect
                x={pad.left}
                y={ySwcUpper}
                width={innerW}
                height={swcBandHeight}
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
                strokeOpacity="0.5"
              />
              <line
                x1={pad.left}
                y1={ySwcLower}
                x2={pad.left + innerW}
                y2={ySwcLower}
                stroke="#10b981"
                strokeDasharray="3,3"
                strokeWidth="1"
                strokeOpacity="0.5"
              />

              {/* Baseline Reference Line */}
              <line
                x1={pad.left}
                y1={yBaseline}
                x2={pad.left + innerW}
                y2={yBaseline}
                stroke="#34d399"
                strokeWidth="1.2"
                strokeOpacity="0.8"
              />

              {/* 2. Highlighted Overreaching (NFOR) Shaded Vertical Windows */}
              {summary.series.map((p, i) => {
                if (!p.isOverreaching) return null;
                const x = getX(i, summary.series.length);
                const colW = innerW / summary.series.length;

                return (
                  <rect
                    key={`overreaching-band-${p.date}`}
                    x={x - colW / 2}
                    y={pad.top}
                    width={colW}
                    height={innerH}
                    fill="#f43f5e"
                    fillOpacity="0.14"
                  />
                );
              })}

              {/* 3. Right Axis & Load Representation: Weekly Load Area & Curve */}
              <defs>
                <linearGradient id="loadAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Weekly Load Area Fill */}
              <path
                d={weeklyLoadAreaPath}
                fill="url(#loadAreaGradient)"
              />

              {/* Weekly Load Line */}
              <path
                d={weeklyLoadLinePath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 4. Left Axis: Daily HRV Raw Points (subtle dotted trail) */}
              <path
                d={dailyHrvLinePath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="2,3"
                strokeOpacity="0.35"
              />
              {summary.series.map((p, i) => {
                const x = getX(i, summary.series.length);
                const y = getYHrv(p.dailyHrv);
                return (
                  <circle
                    key={`raw-hrv-${p.date}`}
                    cx={x}
                    cy={y}
                    r={2}
                    fill="#fb7185"
                    fillOpacity="0.4"
                  />
                );
              })}

              {/* 5. 7-Day Rolling HRV Average Line (Bold, Primary) */}
              <path
                d={hrv7dLinePath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 6. Y-Axis Left (HRV rMSSD in ms) */}
              <text x={pad.left - 10} y={getYHrv(maxHrv) + 4} fill="#a1a1aa" fontSize="9" fontFamily="monospace" textAnchor="end">{maxHrv}ms</text>
              <text x={pad.left - 10} y={ySwcUpper + 3} fill="#10b981" fontSize="8.5" fontFamily="monospace" textAnchor="end">{summary.swcUpper}</text>
              <text x={pad.left - 10} y={yBaseline + 3} fill="#34d399" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="end">{summary.baselineHrv} (Base)</text>
              <text x={pad.left - 10} y={ySwcLower + 3} fill="#10b981" fontSize="8.5" fontFamily="monospace" textAnchor="end">{summary.swcLower}</text>
              <text x={pad.left - 10} y={getYHrv(minHrv) + 4} fill="#a1a1aa" fontSize="9" fontFamily="monospace" textAnchor="end">{minHrv}ms</text>

              {/* Axis Label Left */}
              <text
                x={12}
                y={pad.top + innerH / 2}
                fill="#f43f5e"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                transform={`rotate(-90 12 ${pad.top + innerH / 2})`}
              >
                HRV rMSSD (ms)
              </text>

              {/* 7. Y-Axis Right (Weekly Training Load) */}
              <text x={pad.left + innerW + 10} y={getYLoad(maxLoad) + 4} fill="#06b6d4" fontSize="9" fontFamily="monospace" textAnchor="start">
                {maxLoad}{loadMetric === 'tss' ? ' TSS' : loadMetric === 'km' ? ' km' : ' h'}
              </text>
              <text x={pad.left + innerW + 10} y={getYLoad(maxLoad * 0.5) + 4} fill="#71717a" fontSize="9" fontFamily="monospace" textAnchor="start">
                {Math.round(maxLoad * 0.5)}
              </text>
              <text x={pad.left + innerW + 10} y={getYLoad(0) + 4} fill="#71717a" fontSize="9" fontFamily="monospace" textAnchor="start">
                0
              </text>

              {/* Axis Label Right */}
              <text
                x={chartW - 12}
                y={pad.top + innerH / 2}
                fill="#06b6d4"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                transform={`rotate(90 ${chartW - 12} ${pad.top + innerH / 2})`}
              >
                Carga Semanal ({loadMetric.toUpperCase()})
              </text>

              {/* 8. Data Nodes & Interactive Hover Triggers */}
              {summary.series.map((p, i) => {
                const x = getX(i, summary.series.length);
                const yHrv = getYHrv(p.hrv7dAvg);
                const isHovered = hoveredPoint?.date === p.date;

                const nodeColor = p.isOverreaching
                  ? '#f43f5e'
                  : p.hrv7dAvg >= summary.baselineHrv
                  ? '#10b981'
                  : '#f59e0b';

                return (
                  <g 
                    key={`trigger-${p.date}`}
                    onMouseEnter={() => setHoveredPoint(p)}
                    className="cursor-pointer"
                  >
                    {/* Invisible full height slice for hover */}
                    <rect
                      x={x - 8}
                      y={pad.top}
                      width={16}
                      height={innerH}
                      fill="transparent"
                    />

                    {/* Vertical guideline on hover */}
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

                    {/* Node on HRV 7d Curve */}
                    <circle
                      cx={x}
                      cy={yHrv}
                      r={isHovered ? 6 : (i === summary.series.length - 1 ? 5 : 3.5)}
                      fill={nodeColor}
                      stroke="#18181b"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </g>
                );
              })}

              {/* 9. X-Axis Date Labels */}
              {summary.series
                .filter((_, i) => i % 5 === 0 || i === summary.series.length - 1)
                .map((p) => {
                  const idx = summary.series.findIndex(pt => pt.date === p.date);
                  const x = getX(idx, summary.series.length);
                  return (
                    <text
                      key={`axis-x-${p.date}`}
                      x={x}
                      y={chartH - 12}
                      fill="#71717a"
                      fontSize="9"
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

        {/* Dynamic Tooltip on Hover */}
        {hoveredPoint ? (
          <div className="bg-zinc-900 border border-zinc-700/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-xl animate-in fade-in">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 font-mono text-sm">{hoveredPoint.date}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  hoveredPoint.status === 'non_functional_overreaching' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  hoveredPoint.status === 'functional_overreaching' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  hoveredPoint.status === 'recovery_deload' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {hoveredPoint.status === 'non_functional_overreaching' ? 'Fatiga acumulada' :
                   hoveredPoint.status === 'functional_overreaching' ? 'Sobre-esfuerzo FOR' :
                   hoveredPoint.status === 'recovery_deload' ? 'Descarga / Asimilación' : 'Adaptación Óptima'}
                </span>
              </div>
              <span className="text-zinc-400 text-[11px] block">
                {hoveredPoint.workoutTitles.length > 0 
                  ? hoveredPoint.workoutTitles.join(' + ') 
                  : 'Día sin sesiones / Recuperación pasiva'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px]">Media Móvil 7d</span>
                <span className={`font-bold text-sm ${hoveredPoint.hrv7dAvg < summary.swcLower ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {hoveredPoint.hrv7dAvg} ms
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">HRV Puntual</span>
                <span className="text-zinc-300 font-bold">{hoveredPoint.dailyHrv} ms</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Carga 7d (TSS)</span>
                <span className="text-cyan-400 font-bold">{hoveredPoint.weeklyTss} TSS</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">FC Reposo</span>
                <span className="text-amber-400 font-bold">{hoveredPoint.restingHr} bpm</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Volumen 7d</span>
                <span className="text-zinc-300 font-bold">{hoveredPoint.weeklyKm} km</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-500 text-center py-1 font-mono">
            Pasa el cursor por los puntos para ver el balance entre la media móvil de HRV 7d y la carga semanal de cada día.
          </div>
        )}

      </div>

      {/* Autonomic Coupling & Fatigue vs Recovery Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Metric A: Autonomic Coupling Index (Fatiga vs Recuperación) */}
        <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Índice de Acoplamiento Fatiga / Recuperación
              </h5>
            </div>
            <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${
              summary.fatigueRecoveryIndex >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
              summary.fatigueRecoveryIndex >= 45 ? 'bg-amber-500/20 text-amber-400' :
              'bg-rose-500/20 text-rose-400'
            }`}>
              {summary.fatigueRecoveryIndex}/100
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800 p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  summary.fatigueRecoveryIndex >= 70 ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' :
                  summary.fatigueRecoveryIndex >= 45 ? 'bg-gradient-to-r from-amber-500 to-emerald-400' :
                  'bg-gradient-to-r from-rose-600 to-amber-500'
                }`}
                style={{ width: `${summary.fatigueRecoveryIndex}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0 (Desacople Crítico)</span>
              <span className="text-zinc-300 font-bold">{summary.fatigueRecoveryStatus}</span>
              <span>100 (Supercompensación)</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-900">
            Cuantifica la capacidad biológica del sistema nervioso parasimpático para asimilar la carga de entrenamiento actual ({summary.currentWeeklyTss} TSS). Un índice en descenso sostenido con HRV 7d bajo &lt; {summary.swcLower} ms confirma desacoplamiento entre esfuerzo y regeneración tisular.
          </p>
        </div>

        {/* Metric B: Resting HR (RHR 7d) & Coefficient of Variation (CV) */}
        <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Biomarcadores Cruzados: FC Reposo 7d & CV HRV
              </h5>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Validación Fisiológica</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
              <span className="text-zinc-400 text-[10px] block font-semibold">FC Reposo Media 7d</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-amber-400 font-mono">{summary.restingHr7dAvg}</span>
                <span className="text-[10px] text-zinc-500">bpm</span>
              </div>
              <span className={`text-[10px] block mt-1 font-bold ${
                summary.restingHrDelta > 3 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {summary.restingHrDelta > 0 ? `+${summary.restingHrDelta} bpm vs basal` : `${summary.restingHrDelta} bpm vs basal`}
              </span>
            </div>

            <div className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
              <span className="text-zinc-400 text-[10px] block font-semibold">Coeficiente Variación HRV</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-cyan-400 font-mono">{summary.hrvCvPct}%</span>
                <span className="text-[10px] text-zinc-500">CV 7d</span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-1">
                {summary.hrvCvPct < 6 ? 'Flexibilidad baja' : 'Flexibilidad autonómica sana'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-900">
            Una subida de la FC nocturna en reposo ({summary.restingHrDelta > 0 ? `+${summary.restingHrDelta} bpm` : 'estable'}) combinada con la caída de la HRV confirma la dominancia simpática y la necesidad de priorizar el descanso.
          </p>
        </div>

      </div>

      {/* 4-Quadrant Fatigue vs Recovery Correlation Matrix */}
      <div className="bg-zinc-950 p-5 sm:p-6 rounded-3xl border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div>
            <h5 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-400" />
              Matriz de Correlación: Carga Semanal vs Recuperación Autonómica (4 Cuadrantes)
            </h5>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Posicionamiento de las últimas 4 semanas de entrenamiento en la matriz clásica de Plews & Buchheit.
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Evolución Mesociclo</span>
        </div>

        {/* 4 Quadrants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quadrant 1: Supercompensation */}
          <div className="bg-zinc-900/80 border border-emerald-500/30 p-4 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Cuadrante I: Alta Carga + Alta Recuperación
              </span>
              <span className="text-[10px] font-mono text-emerald-500 font-bold">SUPERCOMPENSACIÓN</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Carga semanal elevada ({summary.currentLoadThresholds ? <>&gt; {summary.currentLoadThresholds.high} TSS hoy, +10 % sobre tu CTL×7; cada semana se evalúa con su propio CTL</> : 'sin CTL aún'}) con sistema nervioso parasimpático en estado óptimo (HRV &ge; {summary.swcLower} ms). Máxima adaptación celular y biogénesis mitocondrial.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'supercompensation').map(w => (
                <div key={w.id} className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono flex items-center gap-1.5">
                  <span className="font-bold text-emerald-300">{w.name}:</span>
                  <span className="text-zinc-200">{w.weeklyTss} TSS • {w.avgHrv7d} ms</span>
                  {w.isCurrentWeek && <span className="text-[9px] bg-emerald-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">Actual</span>}
                </div>
              ))}
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'supercompensation').length === 0 && (
                <span className="text-[11px] text-zinc-600 italic">Ninguna semana en este cuadrante actualmente</span>
              )}
            </div>
          </div>

          {/* Quadrant 2: Overreaching */}
          <div className="bg-zinc-900/80 border border-rose-500/40 p-4 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Cuadrante II: Alta Carga + Baja Recuperación
              </span>
              <span className="text-[10px] font-mono text-rose-500 font-bold">FATIGA ACUMULADA</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Carga semanal elevada con HRV 7d suprimida (&lt; {summary.swcLower} ms). Desacople autonómico: el atleta absorbe daño sin capacidad biológica para asimilarlo.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'overreaching').map(w => (
                <div key={w.id} className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-mono flex items-center gap-1.5">
                  <span className="font-bold text-rose-300">{w.name}:</span>
                  <span className="text-zinc-200">{w.weeklyTss} TSS • {w.avgHrv7d} ms</span>
                  {w.isCurrentWeek && <span className="text-[9px] bg-rose-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">Actual</span>}
                </div>
              ))}
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'overreaching').length === 0 && (
                <span className="text-[11px] text-zinc-600 italic">Ninguna semana en este cuadrante actualmente</span>
              )}
            </div>
          </div>

          {/* Quadrant 3: Systemic Fatigue */}
          <div className="bg-zinc-900/80 border border-amber-500/30 p-4 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                Cuadrante III: Baja Carga + Baja Recuperación
              </span>
              <span className="text-[10px] font-mono text-amber-500 font-bold">ESTRÉS EXTRADEPORTIVO</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Carga baja pero HRV deprimida. Indica fatiga residual persistente, déficit calórico, poco sueño, estrés mental o procesos inflamatorios/infecciosos.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'systemic_fatigue').map(w => (
                <div key={w.id} className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono flex items-center gap-1.5">
                  <span className="font-bold text-amber-300">{w.name}:</span>
                  <span className="text-zinc-200">{w.weeklyTss} TSS • {w.avgHrv7d} ms</span>
                  {w.isCurrentWeek && <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">Actual</span>}
                </div>
              ))}
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'systemic_fatigue').length === 0 && (
                <span className="text-[11px] text-zinc-600 italic">Ninguna semana en este cuadrante actualmente</span>
              )}
            </div>
          </div>

          {/* Quadrant 4: Deload & Freshness */}
          <div className="bg-zinc-900/80 border border-cyan-500/30 p-4 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Cuadrante IV: Baja Carga + Alta Recuperación
              </span>
              <span className="text-[10px] font-mono text-cyan-500 font-bold">DESCARGA & FRESCURA</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Carga reducida (&lt; 250 TSS) con HRV alta (&gt; {summary.baselineHrv} ms). Estado ideal de *tapering* pre-competición o semana de asimilación activa.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'deload_freshness').map(w => (
                <div key={w.id} className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5">
                  <span className="font-bold text-cyan-300">{w.name}:</span>
                  <span className="text-zinc-200">{w.weeklyTss} TSS • {w.avgHrv7d} ms</span>
                  {w.isCurrentWeek && <span className="text-[9px] bg-cyan-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">Actual</span>}
                </div>
              ))}
              {summary.weeklyQuadrants.filter(w => w.quadrant === 'deload_freshness').length === 0 && (
                <span className="text-[11px] text-zinc-600 italic">Ninguna semana en este cuadrante actualmente</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Identified Overreaching Episodes Table / Breakdown */}
      {summary.overreachingEpisodes.length > 0 && (
        <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Periodos Críticos de Sobre-esfuerzo Registrados en la Ventana ({summary.overreachingEpisodes.length})
              </h5>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">Detección Automática</span>
          </div>

          <div className="space-y-2.5">
            {summary.overreachingEpisodes.map((ep) => (
              <div 
                key={ep.id}
                className="bg-zinc-900/90 border border-rose-500/30 p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-300">{ep.startDate} ➔ {ep.endDate}</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                      {ep.durationDays} días de desacople
                    </span>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    {ep.diagnosis}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Pico Carga</span>
                    <span className="text-cyan-400 font-bold">{ep.peakWeeklyTss} TSS</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">HRV Mínima</span>
                    <span className="text-rose-400 font-bold">{ep.minHrv} ms</span>
                  </div>
                  {onScheduleDeload && (
                    <button
                      onClick={onScheduleDeload}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition cursor-pointer"
                    >
                      Descarga
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 30-Day OLS Linear Regression & 7-Day Forward Fatigue Projection */}
      <HRVPredictiveRegressionCard
        checkIns={checkIns}
        workouts={workouts}
        profile={profile}
        onScheduleDeload={onScheduleDeload}
        onNavigateTab={onNavigateTab}
      />

      {/* Coach Miguel Tactical Verdict Box */}
      <div className={`rounded-3xl border p-6 flex flex-col md:flex-row items-start justify-between gap-5 shadow-lg ${
        summary.currentStatus === 'non_functional_overreaching' ? 'bg-rose-950/20 border-rose-500/30 text-rose-200' :
        summary.currentStatus === 'functional_overreaching' ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' :
        summary.currentStatus === 'recovery_deload' ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-200' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
      }`}>
        <div className="space-y-2.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <Heart className={`w-5 h-5 shrink-0 ${summary.statusColor}`} />
            <h4 className="text-sm font-bold tracking-wide uppercase">
              Evaluación Autonómica del Coach Miguel:
            </h4>
          </div>

          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
            {summary.coachVerdict}
          </p>

          {/* Actionable points */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-zinc-300 block mb-1 uppercase tracking-wider">
              Instrucciones directas para los próximos días:
            </span>
            <ul className="space-y-1 text-xs text-zinc-300">
              {summary.actionableRecommendations.map((rec, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${summary.statusColor}`} />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 shrink-0 self-stretch sm:self-auto sm:min-w-[200px]">
          {summary.isDeloadRecommended && onScheduleDeload ? (
            <button
              onClick={onScheduleDeload}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black text-xs shadow-xl shadow-rose-500/20 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Programar Descarga Z1</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigateTab?.('calendar')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs border border-zinc-700 transition cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Ver Calendario de Sesiones</span>
            </button>
          )}

          <button
            onClick={() => onNavigateTab?.('zonesense')}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-semibold border border-zinc-800 transition cursor-pointer"
          >
            <span>Ver Métricas Suunto ZoneSense</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
