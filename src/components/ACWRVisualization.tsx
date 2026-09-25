import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Flame, 
  Layers, 
  Sparkles, 
  HelpCircle, 
  Calendar,
  Zap,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { Workout, PMCDataPoint } from '../types';
import { calculateACWRSummary, ACWRDataPoint } from '../utils/acwrCalculations';

interface ACWRVisualizationProps {
  workouts: Workout[];
  pmcData?: PMCDataPoint[];
  antHr?: number;
  onScheduleDeload?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const ACWRVisualization: React.FC<ACWRVisualizationProps> = ({
  workouts,
  antHr,
  onScheduleDeload,
  onNavigateTab,
}) => {
  const [calculationMode, setCalculationMode] = useState<'standard' | 'ewma'>('standard');
  const [showScienceModal, setShowScienceModal] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<ACWRDataPoint | null>(null);

  // Calculate full 28-day ACWR model
  const summary = useMemo(() => {
    return calculateACWRSummary(workouts, antHr);
  }, [workouts, antHr]);

  const activeAcwr = calculationMode === 'standard' ? summary.currentAcwr : summary.currentEwmaAcwr;

  // Semicircular Gauge Calculations (180 degrees arc, from -180 to 0 or 180 to 360)
  // Scale: 0.0 to 2.0 ACWR mapped to 180 degrees (0 deg = left 0.0, 180 deg = right 2.0)
  const clampedAcwr = Math.min(2.0, Math.max(0, activeAcwr));
  const gaugeAngle = (clampedAcwr / 2.0) * 180; // 0 to 180 degrees

  // SVG Chart Dimensions
  const chartW = 760;
  const chartH = 220;
  const pad = { top: 20, right: 30, bottom: 35, left: 45 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  // Max Y for ACWR chart: max between 2.0 and highest point + 0.2
  const maxAcwrVal = Math.max(2.0, ...summary.series28d.map(p => calculationMode === 'standard' ? p.acwr : p.ewmaAcwr)) + 0.1;
  const minAcwrVal = 0;

  const getY = (val: number) => {
    const clamped = Math.min(maxAcwrVal, Math.max(0, val));
    return pad.top + innerH - (clamped / maxAcwrVal) * innerH;
  };

  const getX = (index: number, total: number) => {
    if (total <= 1) return pad.left + innerW / 2;
    return pad.left + (index / (total - 1)) * innerW;
  };

  // Generate SVG path for ACWR line
  const acwrLinePath = useMemo(() => {
    const points = summary.series28d.map((p, i) => {
      const val = calculationMode === 'standard' ? p.acwr : p.ewmaAcwr;
      return `${getX(i, summary.series28d.length)},${getY(val)}`;
    });
    return points.length > 0 ? `M ${points.join(' L ')}` : '';
  }, [summary.series28d, calculationMode, maxAcwrVal]);

  // Area under line
  const acwrAreaPath = useMemo(() => {
    if (summary.series28d.length === 0) return '';
    const points = summary.series28d.map((p, i) => {
      const val = calculationMode === 'standard' ? p.acwr : p.ewmaAcwr;
      return `${getX(i, summary.series28d.length)},${getY(val)}`;
    });
    const firstX = getX(0, summary.series28d.length);
    const lastX = getX(summary.series28d.length - 1, summary.series28d.length);
    const bottomY = pad.top + innerH;
    return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
  }, [summary.series28d, calculationMode, maxAcwrVal]);

  // Sweet spot zone Y coordinates (0.80 to 1.30)
  const ySweetBottom = getY(0.80);
  const ySweetTop = getY(1.30);
  const sweetHeight = Math.max(0, ySweetBottom - ySweetTop);

  // Warning zone Y coordinates (1.30 to 1.50)
  const yWarnBottom = getY(1.30);
  const yWarnTop = getY(1.50);
  const warnHeight = Math.max(0, yWarnBottom - yWarnTop);

  // Danger zone line Y (1.50)
  const yDangerLine = getY(1.50);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div 
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-20 ${
          summary.zone === 'danger_overtraining' ? 'bg-rose-500' :
          summary.zone === 'overload_risk' ? 'bg-amber-500' :
          summary.zone === 'sweet_spot' ? 'bg-emerald-500' : 'bg-sky-500'
        }`} 
      />

      {/* Header and Toggle Controls */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Modelo Dr. Tim Gabbett (BJSM)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 font-mono text-[11px]">
              Ventana: 7d Aguda / 28d Crónica
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-zinc-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-400 shrink-0" />
            <span>Ratio de Carga Aguda:Crónica (ACWR)</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Monitorea el equilibrio entre la fatiga reciente (últimos 7 días) y la preparación muscular acumulada (últimos 28 días) para 
            <strong> prevenir el sobreentrenamiento</strong> y reducir el riesgo de lesión antes de Transvulcania 73K.
          </p>
        </div>

        {/* Action / Calculation Mode Switches */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center text-xs">
            <button
              onClick={() => setCalculationMode('standard')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                calculationMode === 'standard'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Media móvil estándar de 7 y 28 días"
            >
              Media Móvil (RA)
            </button>
            <button
              onClick={() => setCalculationMode('ewma')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                calculationMode === 'ewma'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Media ponderada exponencialmente que otorga mayor peso a los días más recientes"
            >
              Exponencial (EWMA)
            </button>
          </div>

          <button
            onClick={() => setShowScienceModal(!showScienceModal)}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Ver fundamento científico y zonas del ACWR"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Metodología</span>
          </button>
        </div>
      </div>

      {/* Scientific Methodology Dropdown Explainer */}
      {showScienceModal && (
        <div className="bg-zinc-950 border border-emerald-500/30 rounded-2xl p-5 text-xs text-zinc-300 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <span className="font-bold text-emerald-400 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Fundamento Fisiológico del ACWR (Tim Gabbett, 2016)
            </span>
            <button 
              onClick={() => setShowScienceModal(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-0.5 rounded"
            >
              Cerrar ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 leading-relaxed">
              <strong className="text-zinc-100 block">¿Cómo se calcula el ratio?</strong>
              <p>
                <strong>Carga Aguda (Fatiga 7D):</strong> Media diaria de TSS acumulado durante los últimos 7 días. Representa el estrés reciente del sistema nervioso y muscular.
              </p>
              <p>
                <strong>Carga Crónica (Fitness 28D):</strong> Media diaria de TSS durante los últimos 28 días (4 semanas). Representa la capacidad de carga del atleta y la robustez tisular.
              </p>
              <p className="font-mono bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 text-emerald-300 text-[11px]">
                ACWR = (TSS Total 7d / 7) ÷ (TSS Total 28d / 28)
              </p>
            </div>

            <div className="space-y-2">
              <strong className="text-zinc-100 block">Zonas Clave de Riesgo de Lesión:</strong>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between bg-sky-500/10 border border-sky-500/20 p-2 rounded-lg text-sky-300">
                  <span><strong>&lt; 0.80: Infracarga</strong> (Desentrenamiento / Pérdida de adaptaciones)</span>
                  <span className="font-mono font-bold">Riesgo &lt; 8%</span>
                </div>
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg text-emerald-300">
                  <span><strong>0.80 - 1.30: "The Sweet Spot"</strong> (Máxima adaptación, mínimo sobreentrenamiento)</span>
                  <span className="font-mono font-bold">Riesgo &lt; 10%</span>
                </div>
                <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-amber-300">
                  <span><strong>1.30 - 1.50: Zona de Alerta</strong> (Incremento acelerado de fatiga)</span>
                  <span className="font-mono font-bold">Riesgo 15-25%</span>
                </div>
                <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-rose-300">
                  <span><strong>&gt; 1.50: Zona de Peligro</strong> (Riesgo exponencial de rotura o fatiga crónica)</span>
                  <span className="font-mono font-bold">Riesgo &gt; 35-50%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Main Cards: Semicircular Gauge + Primary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Speedometer Gauge Card (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-between relative shadow-lg">
          <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold uppercase tracking-wider text-[10px]">Indicador Dinámico</span>
            <span className="font-mono text-[11px] text-zinc-400">Escala 0.0 - 2.0</span>
          </div>

          {/* SVG Semicircle Gauge */}
          <div className="relative w-64 h-36 flex items-end justify-center my-2">
            <svg viewBox="0 0 200 115" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />     {/* < 0.8: Sky */}
                  <stop offset="38%" stopColor="#34d399" />    {/* 0.8: Emerald start */}
                  <stop offset="65%" stopColor="#10b981" />    {/* 1.3: Emerald end */}
                  <stop offset="75%" stopColor="#f59e0b" />    {/* 1.5: Amber */}
                  <stop offset="100%" stopColor="#f43f5e" />   {/* > 1.5: Rose */}
                </linearGradient>
              </defs>

              {/* Background Arc (gray) */}
              <path
                d="M 20,105 A 80,80 0 0,1 180,105"
                fill="none"
                stroke="#27272a"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Colored Segments Arc */}
              <path
                d="M 20,105 A 80,80 0 0,1 180,105"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Sweet Spot Highlight Arc Overlay (0.80 = 40% of 2.0 = 72 deg, 1.30 = 65% = 117 deg) */}
              {/* Reference ticks */}
              {/* 0.80 mark */}
              <line x1="68" y1="36" x2="63" y2="28" stroke="#34d399" strokeWidth="2.5" />
              <text x="56" y="24" fill="#34d399" fontSize="8" fontWeight="bold" fontFamily="monospace">0.8</text>

              {/* 1.30 mark */}
              <line x1="132" y1="36" x2="137" y2="28" stroke="#f59e0b" strokeWidth="2.5" />
              <text x="136" y="24" fill="#f59e0b" fontSize="8" fontWeight="bold" fontFamily="monospace">1.3</text>

              {/* 1.50 mark */}
              <line x1="157" y1="55" x2="164" y2="50" stroke="#f43f5e" strokeWidth="2.5" />
              <text x="168" y="52" fill="#f43f5e" fontSize="8" fontWeight="bold" fontFamily="monospace">1.5</text>

              {/* Needle */}
              {(() => {
                // angle 0 deg = left (20, 105), angle 180 deg = right (180, 105)
                // Center is (100, 105), radius = 68
                const rad = (Math.PI / 180) * (180 - gaugeAngle);
                const needleLen = 65;
                const nx = 100 - needleLen * Math.cos(rad);
                const ny = 105 - needleLen * Math.sin(rad);

                return (
                  <g>
                    {/* Shadow / Glow line */}
                    <line
                      x1="100"
                      y1="105"
                      x2={nx}
                      y2={ny}
                      stroke={
                        summary.zone === 'danger_overtraining' ? '#f43f5e' :
                        summary.zone === 'overload_risk' ? '#f59e0b' :
                        summary.zone === 'sweet_spot' ? '#10b981' : '#38bdf8'
                      }
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Needle pivot circle */}
                    <circle cx="100" cy="105" r="7" fill="#18181b" stroke="#71717a" strokeWidth="2" />
                    <circle cx="100" cy="105" r="3" fill="#ffffff" />
                  </g>
                );
              })()}
            </svg>

            {/* In-gauge Value */}
            <div className="absolute bottom-0 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-4xl font-black font-mono tracking-tight ${summary.zoneColor}`}>
                  {activeAcwr.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-400 font-semibold font-mono">ratio</span>
              </div>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className="mt-3 text-center space-y-1">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${summary.zoneBgColor} ${summary.zoneColor} ${summary.zoneBorderColor}`}>
              {summary.zoneLabel}
            </span>
            <div className="text-[11px] text-zinc-400 font-medium">
              Riesgo relativo (orientativo, sin % validado para ti): <strong className={summary.zoneColor}>{summary.injuryRiskPctFormatted}</strong>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards Grid (7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Card 1: Acute Load (7d) */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">Carga Aguda (7d)</span>
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Flame className="w-4 h-4" />
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-amber-400 font-mono">
                  {summary.acuteLoad7dTotal}
                </span>
                <span className="text-xs text-zinc-400 font-bold">TSS total</span>
              </div>
              <div className="text-xs font-mono text-zinc-300 mt-1">
                ~{summary.acuteLoad7dAvg} TSS/día (7d)
              </div>
            </div>

            <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Fatiga reciente:</span>
              <span className="font-bold text-amber-300 font-mono">Última semana</span>
            </div>
          </div>

          {/* Card 2: Chronic Load (28d) */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">Carga Crónica (28d)</span>
              <span className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Layers className="w-4 h-4" />
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-cyan-400 font-mono">
                  {summary.chronicLoad28dTotal}
                </span>
                <span className="text-xs text-zinc-400 font-bold">TSS (4 sem)</span>
              </div>
              <div className="text-xs font-mono text-zinc-300 mt-1">
                ~{summary.chronicLoad28dAvg} TSS/día (~{Math.round(summary.chronicLoad28dTotal / 4)} sem)
              </div>
            </div>

            <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Base aeróbica:</span>
              <span className="font-bold text-cyan-300 font-mono">Acondicionamiento</span>
            </div>
          </div>

          {/* Card 3: Weekly Ramp / Delta */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">Variación Semanal</span>
              <span className={`p-1.5 rounded-xl ${summary.weeklyChangePct > 20 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {summary.weeklyChangePct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className={`text-3xl font-black font-mono ${
                  summary.weeklyChangePct > 25 ? 'text-rose-400' :
                  summary.weeklyChangePct > 15 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {summary.weeklyChangePct > 0 ? `+${summary.weeklyChangePct}%` : `${summary.weeklyChangePct}%`}
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-400 mt-1">
                vs 7 días previos
              </div>
            </div>

            <div className="pt-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Regla del 10%:</span>
              <span className={`font-bold font-mono ${Math.abs(summary.weeklyChangePct) <= 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {Math.abs(summary.weeklyChangePct) <= 15 ? 'Progresión Segura' : 'Salto Elevado'}
              </span>
            </div>
          </div>

          {/* Gabbett Sweet Spot Rule Callout across bottom of 3 cards */}
          <div className="sm:col-span-3 bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-zinc-300">
              <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Regla de Tim Gabbett:</strong> Para maximizar la adaptación sin caer en sobreentrenamiento, mantén el ratio ACWR entre <strong>0.80 y 1.30</strong>.
              </span>
            </div>
            {summary.currentAcwr > 1.30 && onScheduleDeload && (
              <button
                onClick={onScheduleDeload}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Programar Descarga</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* 28-Day Evolution Chart */}
      <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div>
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Evolución Diaria del ACWR a lo largo de los Últimos 28 Días
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Curva continua calculada a partir del TSS diario acumulado. Pasa el cursor por los puntos para ver el detalle de cada día.
            </p>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/60" />
              <span className="text-zinc-400">Sweet Spot (0.8 - 1.3)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
              <span className="text-zinc-400">Alerta (1.3 - 1.5)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 bg-rose-500" />
              <span className="text-rose-400 font-bold">&gt;1.5 Peligro</span>
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[640px]">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto overflow-visible select-none">
              
              {/* Background Reference Bands */}
              {/* Sweet spot band: 0.80 to 1.30 */}
              <rect
                x={pad.left}
                y={ySweetTop}
                width={innerW}
                height={sweetHeight}
                fill="#10b981"
                fillOpacity="0.10"
              />
              {/* Sweet spot dashed border lines */}
              <line x1={pad.left} y1={ySweetTop} x2={pad.left + innerW} y2={ySweetTop} stroke="#10b981" strokeDasharray="3,3" strokeWidth="1" strokeOpacity="0.6" />
              <line x1={pad.left} y1={ySweetBottom} x2={pad.left + innerW} y2={ySweetBottom} stroke="#10b981" strokeDasharray="3,3" strokeWidth="1" strokeOpacity="0.6" />
              
              {/* Warning zone band: 1.30 to 1.50 */}
              <rect
                x={pad.left}
                y={yWarnTop}
                width={innerW}
                height={warnHeight}
                fill="#f59e0b"
                fillOpacity="0.08"
              />

              {/* Danger zone threshold line (1.50) */}
              <line x1={pad.left} y1={yDangerLine} x2={pad.left + innerW} y2={yDangerLine} stroke="#f43f5e" strokeDasharray="4,3" strokeWidth="1.5" strokeOpacity="0.8" />

              {/* Y Axis Reference Labels */}
              <text x={pad.left - 8} y={getY(0.8) + 3} fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="end">0.80</text>
              <text x={pad.left - 8} y={getY(1.3) + 3} fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="end">1.30</text>
              <text x={pad.left - 8} y={getY(1.5) + 3} fill="#f43f5e" fontSize="9" fontFamily="monospace" textAnchor="end">1.50</text>
              <text x={pad.left - 8} y={getY(maxAcwrVal - 0.1) + 3} fill="#71717a" fontSize="9" fontFamily="monospace" textAnchor="end">2.0</text>

              {/* TSS Bars at bottom of chart (scaled 0-150 TSS to 45px height) */}
              {summary.series28d.map((p, i) => {
                const x = getX(i, summary.series28d.length);
                const barH = Math.min(45, (p.dayTss / 150) * 45);
                const barY = pad.top + innerH - barH;
                const isHovered = hoveredPoint?.date === p.date;

                return (
                  <rect
                    key={`tss-bar-${p.date}`}
                    x={x - 4}
                    y={barY}
                    width={8}
                    height={barH}
                    fill={isHovered ? '#f59e0b' : '#3f3f46'}
                    fillOpacity={isHovered ? 0.9 : 0.4}
                    rx={2}
                  />
                );
              })}

              {/* Area fill under curve */}
              <path
                d={acwrAreaPath}
                fill="url(#acwrAreaGradient)"
                opacity="0.35"
              />
              <defs>
                <linearGradient id="acwrAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Line Curve */}
              <path
                d={acwrLinePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Hover Hit Areas & Data Points */}
              {summary.series28d.map((p, i) => {
                const x = getX(i, summary.series28d.length);
                const val = calculationMode === 'standard' ? p.acwr : p.ewmaAcwr;
                const y = getY(val);
                const isHovered = hoveredPoint?.date === p.date;

                const ptColor = 
                  p.zone === 'danger_overtraining' ? '#f43f5e' :
                  p.zone === 'overload_risk' ? '#f59e0b' :
                  p.zone === 'sweet_spot' ? '#10b981' : '#38bdf8';

                return (
                  <g 
                    key={`point-${p.date}`}
                    onMouseEnter={() => setHoveredPoint(p)}
                    className="cursor-pointer"
                  >
                    {/* Invisible vertical slice for easy mouse hovering */}
                    <rect
                      x={x - 10}
                      y={pad.top}
                      width={20}
                      height={innerH}
                      fill="transparent"
                    />

                    {/* Vertical hover line */}
                    {isHovered && (
                      <line
                        x1={x}
                        y1={pad.top}
                        x2={x}
                        y2={pad.top + innerH}
                        stroke="#a1a1aa"
                        strokeDasharray="2,2"
                        strokeWidth="1"
                      />
                    )}

                    {/* Circle Node */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : (i === summary.series28d.length - 1 ? 5 : 3)}
                      fill={ptColor}
                      stroke="#18181b"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </g>
                );
              })}

              {/* X Axis Date Labels (every 4-5 days) */}
              {summary.series28d
                .filter((_, i) => i % 5 === 0 || i === summary.series28d.length - 1)
                .map((p) => {
                  const idx = summary.series28d.findIndex(pt => pt.date === p.date);
                  const x = getX(idx, summary.series28d.length);
                  return (
                    <text
                      key={`label-${p.date}`}
                      x={x}
                      y={chartH - 8}
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
          <div className="bg-zinc-900 border border-zinc-700/80 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-in fade-in">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 font-mono text-sm">{hoveredPoint.date}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  hoveredPoint.zone === 'danger_overtraining' ? 'bg-rose-500/20 text-rose-400' :
                  hoveredPoint.zone === 'overload_risk' ? 'bg-amber-500/20 text-amber-400' :
                  hoveredPoint.zone === 'sweet_spot' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
                }`}>
                  Ratio: {calculationMode === 'standard' ? hoveredPoint.acwr.toFixed(2) : hoveredPoint.ewmaAcwr.toFixed(2)}
                </span>
              </div>
              <span className="text-zinc-400 text-[11px] block">
                {hoveredPoint.workoutTitles.length > 0 
                  ? hoveredPoint.workoutTitles.join(', ') 
                  : 'Descanso / Asimilación'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px]">TSS del Día</span>
                <span className="text-amber-400 font-bold">{hoveredPoint.dayTss} TSS</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Carga Aguda (7d)</span>
                <span className="text-zinc-200 font-bold">{hoveredPoint.acuteLoad7d} TSS/d</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Carga Crónica (28d)</span>
                <span className="text-cyan-400 font-bold">{hoveredPoint.chronicLoad28d} TSS/d</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-500 text-center py-1 font-mono">
            Pasa el ratón sobre los puntos de la curva para inspeccionar el TSS de cada día y los ratios intermedios.
          </div>
        )}
      </div>

      {/* Coach Miguel Contextual Evaluation Box */}
      <div className={`rounded-3xl border p-6 flex flex-col md:flex-row items-start justify-between gap-5 shadow-lg ${
        summary.zone === 'danger_overtraining' ? 'bg-rose-950/20 border-rose-500/30 text-rose-200' :
        summary.zone === 'overload_risk' ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' :
        summary.zone === 'sweet_spot' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' : 'bg-sky-950/20 border-sky-500/30 text-sky-200'
      }`}>
        <div className="space-y-2.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <Flame className={`w-5 h-5 shrink-0 ${summary.zoneColor}`} />
            <h4 className="text-sm font-bold tracking-wide uppercase">
              Dictamen Fisiológico de Miguel sobre tu ACWR:
            </h4>
          </div>

          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
            {summary.coachTacticalAdvice}
          </p>

          {/* Actionable Points */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-zinc-300 block mb-1 uppercase tracking-wider">
              Pautas recomendadas para los próximos 7 días:
            </span>
            <ul className="space-y-1 text-xs text-zinc-300">
              {summary.actionableSteps.map((step, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${summary.zoneColor}`} />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 shrink-0 self-stretch sm:self-auto sm:min-w-[200px]">
          {summary.currentAcwr > 1.30 && onScheduleDeload ? (
            <button
              onClick={onScheduleDeload}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-xl shadow-amber-500/20 transition cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Programar Descarga (-45%)</span>
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
            onClick={() => onNavigateTab?.('pmc')}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-semibold border border-zinc-800 transition cursor-pointer"
          >
            <span>Ver Gráfico PMC Completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
