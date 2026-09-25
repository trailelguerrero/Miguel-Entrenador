import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Sliders, 
  Sparkles, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  Activity, 
  Calendar, 
  ArrowRight,
  Flame
} from 'lucide-react';
import { DailyCheckIn, Workout, AthleteProfile } from '../types';
import { 
  calculateHrvPredictiveRegression, 
  HistoricalRegressionPoint, 
  ProjectedPoint 
} from '../utils/hrvLinearRegression';

interface HRVPredictiveRegressionCardProps {
  checkIns: DailyCheckIn[];
  workouts: Workout[];
  profile: AthleteProfile;
  onScheduleDeload?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const HRVPredictiveRegressionCard: React.FC<HRVPredictiveRegressionCardProps> = ({
  checkIns,
  workouts,
  profile,
  onScheduleDeload,
  onNavigateTab,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    type: 'historical' | 'projected';
    hist?: HistoricalRegressionPoint;
    proj?: ProjectedPoint;
    x: number;
    y: number;
  } | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  // Compute regression and forward projections
  const regression = useMemo(() => {
    return calculateHrvPredictiveRegression(checkIns, workouts, profile);
  }, [checkIns, workouts, profile]);

  // SVG Chart Geometry Constants
  const width = 860;
  const height = 320;
  const padding = { top: 35, right: 40, bottom: 45, left: 55 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // X domain: 37 days (1 to 30 historical + 31 to 37 future)
  const totalXPoints = 37;
  const getX = (index: number) => {
    return padding.left + ((index - 1) / (totalXPoints - 1)) * innerWidth;
  };

  // Y domain: HRV range (e.g. 36 to 66 ms)
  const allHrvValues = [
    ...regression.historicalPoints.map(p => p.dailyHrv),
    ...regression.historicalPoints.map(p => p.fittedHrv),
    ...regression.projectedPoints.map(p => p.simulatedHrv),
    ...regression.projectedPoints.map(p => p.confidenceLower),
    ...regression.projectedPoints.map(p => p.confidenceUpper),
    regression.baselineHrv,
    regression.swcLower,
    regression.swcUpper
  ];
  const minHrvRaw = Math.min(...allHrvValues);
  const maxHrvRaw = Math.max(...allHrvValues);
  const yMin = Math.floor(Math.min(minHrvRaw - 3, regression.swcLower - 4));
  const yMax = Math.ceil(Math.max(maxHrvRaw + 3, regression.swcUpper + 4));

  const getY = (val: number) => {
    return padding.top + innerHeight - ((val - yMin) / (yMax - yMin)) * innerHeight;
  };

  // Coordinates
  const todayX = getX(30);
  const swcUpperY = getY(regression.swcUpper);
  const swcLowerY = getY(regression.swcLower);
  const baselineY = getY(regression.baselineHrv);

  // Generate path strings
  // 1. Fitted historical regression line
  const fittedHistPath = regression.historicalPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.index)} ${getY(p.fittedHrv)}`)
    .join(' ');

  // 2. Projected regression line (connecting from Day 30 fitted to Day 37 projected)
  const day30Fitted = regression.historicalPoints[regression.historicalPoints.length - 1]?.fittedHrv || regression.currentHrv7d;
  const projectedLinePath = [
    `M ${todayX} ${getY(day30Fitted)}`,
    ...regression.projectedPoints.map(p => `L ${getX(p.index)} ${getY(p.simulatedHrv)}`)
  ].join(' ');

  // 3. 7-Day Rolling HRV historical curve
  const rollingPath = regression.historicalPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.index)} ${getY(p.hrv7dRolling)}`)
    .join(' ');

  // 4. Shaded confidence cone for days 31-37
  const upperConfidencePoints = [
    { x: todayX, y: getY(day30Fitted) },
    ...regression.projectedPoints.map(p => ({ x: getX(p.index), y: getY(p.confidenceUpper) }))
  ];
  const lowerConfidencePoints = [
    ...regression.projectedPoints.map(p => ({ x: getX(p.index), y: getY(p.confidenceLower) })).reverse(),
    { x: todayX, y: getY(day30Fitted) }
  ];

  const confidenceCorridorPath = [
    `M ${upperConfidencePoints[0].x} ${upperConfidencePoints[0].y}`,
    ...upperConfidencePoints.slice(1).map(pt => `L ${pt.x} ${pt.y}`),
    ...lowerConfidencePoints.map(pt => `L ${pt.x} ${pt.y}`),
    'Z'
  ].join(' ');

  // Y-axis ticks
  const yTicks: number[] = [];
  const yStep = Math.max(2, Math.round((yMax - yMin) / 6));
  for (let val = Math.ceil(yMin / yStep) * yStep; val <= yMax; val += yStep) {
    yTicks.push(val);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
      
      {/* Header with Title and Predictive Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Modelo Predictivo Fisiológico
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono text-xs border border-zinc-700">
              Regresión OLS 30d ➔ Proyección 7d
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-100 flex items-center gap-2.5">
            <TrendingDown className={`w-6 h-6 ${regression.slopeDaily < 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
            <span>Tendencia Predictiva de Fatiga & HRV (Regresión 30 Días)</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-3xl">
            Ajuste por mínimos cuadrados sobre tu rMSSD nocturno para pronosticar la trayectoria de fatiga simpática de los próximos 7 días y anticipar si debes podar el volumen de entrenamiento antes de sobrepasar el umbral adaptativo.
          </p>
        </div>

        {/* Methodology Button */}
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-700/80 transition cursor-pointer self-start lg:self-auto shrink-0"
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>{showMethodology ? 'Ocultar Fundamento' : 'Fundamento Matemático'}</span>
          {showMethodology ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Methodology Collapsible Box */}
      {showMethodology && (
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3 text-xs text-zinc-300 leading-relaxed animate-in fade-in">
          <div className="font-bold text-zinc-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>¿Cómo funciona el Modelo de Regresión Lineal de HRV (Plews & Altini, 2017)?</span>
          </div>
          <p>
            El sistema calcula la recta de mínimos cuadrados ordinarios (y = mx + b) sobre la serie temporal de los últimos 30 días de HRV rMSSD. 
            La pendiente <strong>m</strong> (ms/día) representa la <strong>tasa de aceleración o decaimiento del tono parasimpático (vagal)</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-400">
            <li>
              <strong className="text-rose-400">Pendiente Negativa Crítica (m &lt; -0.25 ms/día):</strong> Agotamiento progresivo de la capacidad de regeneración celular. Al proyectar a 7 días, cruzar el límite inferior SWC ({regression.swcLower} ms) pronostica un estado de <em>Non-Functional Overreaching (NFOR)</em>.
            </li>
            <li>
              <strong className="text-cyan-400">Corredor de Confianza al 90%:</strong> Se calcula el error estándar de la estimación (S<sub>e</sub>) expandiéndose en abanico según la varianza residual histórica (S<sub>e</sub> ≈ {regression.stdError} ms).
            </li>
            <li>
              <strong className="text-emerald-400">Decisión Táctica:</strong> Si la regresión proyecta una caída sostenida, recortar la carga entre un -35% y -40% restablece el equilibrio vagal antes de la destrucción mitocondrial.
            </li>
          </ul>
        </div>
      )}

      {/* Top 4 Key Predictive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Slope & Drift Rate */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Pendiente de Deriva (m)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              regression.slopeDaily < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {regression.slopeDaily < 0 ? 'Fatiga Progresiva' : 'Recuperación'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${
              regression.slopeDaily < -0.2 ? 'text-rose-400' : regression.slopeDaily < 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {regression.slopeDaily > 0 ? `+${regression.slopeDaily.toFixed(2)}` : regression.slopeDaily.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-500 font-mono">ms/día</span>
          </div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-900">
            Ritmo semanal: <strong className="font-mono text-zinc-200">{regression.slopeWeekly > 0 ? `+${regression.slopeWeekly}` : regression.slopeWeekly} ms/sem</strong>
          </p>
        </div>

        {/* KPI 2: 7-Day Forward Forecast */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Proyección en 7 Días</span>
            <span className="text-[10px] font-mono text-zinc-500">t + 7 días</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${
              regression.projectedHrv7d < regression.swcLower ? 'text-rose-400' : 'text-zinc-100'
            }`}>
              {regression.projectedHrv7d}
            </span>
            <span className="text-xs text-zinc-500 font-mono">ms rMSSD</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-900">
            <span className="text-zinc-400">Variación proyectada:</span>
            <span className={`font-bold font-mono ${regression.projectedDelta7d < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {regression.projectedDelta7d > 0 ? `+${regression.projectedDelta7d}` : regression.projectedDelta7d} ms
            </span>
          </div>
        </div>

        {/* KPI 3: Days until SWC Lower Threshold */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Alerta de Cruce SWC</span>
            <span className="p-1 rounded bg-zinc-900 text-zinc-400">
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            {regression.daysUntilSwcCrossover !== null ? (
              <>
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {regression.daysUntilSwcCrossover}
                </span>
                <span className="text-xs text-rose-400 font-bold">días para cruzar</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  &gt; 7
                </span>
                <span className="text-xs text-emerald-400 font-bold">días (Seguro)</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-900">
            Banda normal SWC: <strong className="font-mono text-zinc-200">{regression.swcLower} - {regression.swcUpper} ms</strong>
          </p>
        </div>

        {/* KPI 4: Statistical Goodness of Fit (R^2 & SE) */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Fiabilidad Regresión (R²)</span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">n = 30 días</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {(regression.rSquared * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-zinc-500 font-mono">R²</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-900">
            <span className="text-zinc-400">Error estándar (Sₑ):</span>
            <span className="font-bold font-mono text-zinc-300">±{regression.stdError} ms</span>
          </div>
        </div>

      </div>

      <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800 text-[11px] text-zinc-400">
        Proyección a 7 días de tu propia tendencia de HRV nocturna (datos de Suunto), con su banda de confianza. No se simulan escenarios de carga: no hay datos que digan cuánto cambia tu HRV al subir o bajar la carga.
      </div>

      {/* SVG Dual Stage Chart: Historical 30 Days + Future 7-Day Forecast */}
      <div className="bg-zinc-950 p-4 sm:p-6 rounded-3xl border border-zinc-800 space-y-4">
        
        {/* Legend bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />
              <span className="text-zinc-300 font-medium">HRV Medido Diario</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-amber-400 inline-block" />
              <span className="text-zinc-300 font-medium">Media Móvil 7d</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-cyan-400 inline-block" />
              <span className="text-zinc-300 font-medium">Recta Regresión (30d)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-400 inline-block" />
              <span className="text-rose-300 font-bold">Proyección 7d Próxima Semana</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" />
              <span className="text-emerald-400 text-[11px]">Banda Normal SWC</span>
            </div>

          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <span>Hoy: <strong className="text-zinc-100">{regression.currentHrv7d} ms</strong></span>
            <span>➔</span>
            <span>Pronóstico: <strong className={regression.projectedHrv7d < regression.swcLower ? 'text-rose-400' : 'text-cyan-400'}>
              {regression.projectedHrv7d} ms
            </strong></span>
          </div>
        </div>

        {/* The SVG Visualization */}
        <div className="w-full overflow-x-auto no-scrollbar">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[700px] select-none"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              {/* Gradient for SWC Normal Band */}
              <linearGradient id="swcBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
              </linearGradient>

              {/* Gradient for Future Confidence Cone */}
              <linearGradient id="confidenceConeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.08" />
              </linearGradient>

              {/* Pattern for Future Background */}
              <pattern id="futureStripe" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#27272a" strokeWidth="1.5" />
              </pattern>
            </defs>

            {/* Shaded Future Forecast Background Zone (Days 31 to 37) */}
            <rect
              x={todayX}
              y={padding.top}
              width={width - padding.right - todayX}
              height={innerHeight}
              fill="url(#futureStripe)"
              opacity="0.7"
            />

            {/* SWC Normal Band Shading */}
            <rect
              x={padding.left}
              y={swcUpperY}
              width={innerWidth}
              height={Math.max(2, swcLowerY - swcUpperY)}
              fill="url(#swcBandGradient)"
            />

            {/* SWC Lower Line (Threshold of Functional Overreaching) */}
            <line
              x1={padding.left}
              y1={swcLowerY}
              x2={width - padding.right}
              y2={swcLowerY}
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.8"
            />
            <text
              x={width - padding.right - 4}
              y={swcLowerY - 4}
              textAnchor="end"
              className="text-[9px] fill-rose-400 font-mono font-bold"
            >
              Límite SWC ({regression.swcLower} ms)
            </text>

            {/* SWC Upper Line */}
            <line
              x1={padding.left}
              y1={swcUpperY}
              x2={width - padding.right}
              y2={swcUpperY}
              stroke="#10b981"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.6"
            />

            {/* Baseline HRV Line */}
            <line
              x1={padding.left}
              y1={baselineY}
              x2={width - padding.right}
              y2={baselineY}
              stroke="#06b6d4"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.4"
            />
            <text
              x={padding.left + 8}
              y={baselineY - 4}
              className="text-[9px] fill-cyan-400 font-mono"
            >
              Línea Base: {regression.baselineHrv} ms
            </text>

            {/* Y-Axis Grid Lines & Labels */}
            {yTicks.map(val => (
              <g key={`ytick-${val}`}>
                <line
                  x1={padding.left}
                  y1={getY(val)}
                  x2={width - padding.right}
                  y2={getY(val)}
                  stroke="#27272a"
                  strokeWidth="0.8"
                />
                <text
                  x={padding.left - 8}
                  y={getY(val) + 3}
                  textAnchor="end"
                  className="text-[10px] fill-zinc-500 font-mono"
                >
                  {val}
                </text>
              </g>
            ))}

            {/* Vertical Marker: "HOY / DÍA 30" */}
            <line
              x1={todayX}
              y1={padding.top}
              x2={todayX}
              y2={height - padding.bottom}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <text
              x={todayX}
              y={padding.top - 12}
              textAnchor="middle"
              className="text-[10px] fill-amber-400 font-bold font-mono tracking-wider"
            >
              ▲ HOY (ACTUAL)
            </text>

            {/* Historical 7d Rolling Line (Amber) */}
            <path
              d={rollingPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              opacity="0.8"
            />

            {/* Historical OLS Regression Line (Cyan) */}
            <path
              d={fittedHistPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
            />

            {/* Confidence Cone for Future Projection */}
            <path
              d={confidenceCorridorPath}
              fill="url(#confidenceConeGradient)"
            />

            {/* Projected Regression Line (Dashed) */}
            <path
              d={projectedLinePath}
              fill="none"
              stroke={regression.slopeDaily < 0 ? '#f43f5e' : '#06b6d4'}
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />

            {/* Historical Daily Scatter Dots */}
            {regression.historicalPoints.map((pt) => {
              const cx = getX(pt.index);
              const cy = getY(pt.dailyHrv);
              const isBelow = pt.dailyHrv < regression.swcLower;

              return (
                <g key={`hist-${pt.index}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="3.5"
                    className={`${isBelow ? 'fill-rose-500 stroke-zinc-950' : 'fill-cyan-400 stroke-zinc-950'} transition-transform hover:scale-150 cursor-pointer`}
                    strokeWidth="1.5"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredPoint({
                        type: 'historical',
                        hist: pt,
                        x: rect.x + rect.width / 2,
                        y: rect.y,
                      });
                    }}
                  />
                </g>
              );
            })}

            {/* Projected Future Dots (Days 31 to 37) */}
            {regression.projectedPoints.map((pt) => {
              const cx = getX(pt.index);
              const cy = getY(pt.simulatedHrv);
              const isBelow = pt.simulatedHrv < regression.swcLower;

              return (
                <g key={`proj-${pt.index}`}>
                  {/* Outer halo */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5"
                    fill={isBelow ? '#f43f5e' : '#10b981'}
                    opacity="0.25"
                  />
                  {/* Point */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="3.5"
                    fill={isBelow ? '#f43f5e' : '#10b981'}
                    stroke="#09090b"
                    strokeWidth="1.5"
                    className="cursor-pointer hover:scale-150 transition-transform"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredPoint({
                        type: 'projected',
                        proj: pt,
                        x: rect.x + rect.width / 2,
                        y: rect.y,
                      });
                    }}
                  />
                </g>
              );
            })}

            {/* X-Axis Labels */}
            {/* Show a few historical labels */}
            {[1, 8, 15, 22, 29].map(dayIdx => {
              const pt = regression.historicalPoints[dayIdx - 1];
              if (!pt) return null;
              return (
                <text
                  key={`xlabel-${dayIdx}`}
                  x={getX(pt.index)}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className="text-[10px] fill-zinc-500 font-mono"
                >
                  {pt.dayLabel}
                </text>
              );
            })}

            {/* Future Projection Labels */}
            {regression.projectedPoints.map((pt, i) => {
              if (i % 2 !== 0 && i !== 6) return null; // show every 2 days + day 7
              return (
                <text
                  key={`xlabel-future-${pt.index}`}
                  x={getX(pt.index)}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className="text-[10px] fill-rose-400 font-mono font-bold"
                >
                  +{pt.daysAhead}d
                </text>
              );
            })}

            {/* Bottom X-axis line */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="#3f3f46"
              strokeWidth="1"
            />

          </svg>
        </div>

        {/* Hover Tooltip Details */}
        {hoveredPoint && (
          <div className="bg-zinc-900 border border-zinc-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1 animate-in fade-in">
            {hoveredPoint.type === 'historical' && hoveredPoint.hist && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-zinc-400 block text-[10px]">Día Histórico</span>
                  <span className="font-bold text-zinc-200">{hoveredPoint.hist.date} ({hoveredPoint.hist.dayLabel})</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">HRV Medido</span>
                  <span className="font-bold font-mono text-cyan-400">{hoveredPoint.hist.dailyHrv} ms</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Media Móvil 7d</span>
                  <span className="font-bold font-mono text-amber-400">{hoveredPoint.hist.hrv7dRolling} ms</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Ajuste Regresión</span>
                  <span className="font-mono text-zinc-300">{hoveredPoint.hist.fittedHrv} ms</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Carga TSS</span>
                  <span className="font-mono text-cyan-300">{hoveredPoint.hist.dailyTss} TSS</span>
                </div>
              </div>
            )}

            {hoveredPoint.type === 'projected' && hoveredPoint.proj && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-rose-400 block text-[10px] font-bold">Pronóstico Futuro (+{hoveredPoint.proj.daysAhead} días)</span>
                  <span className="font-bold text-zinc-200">{hoveredPoint.proj.date} ({hoveredPoint.proj.dayLabel})</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">HRV Proyectado</span>
                  <span className={`font-black font-mono text-sm ${hoveredPoint.proj.isBelowSwc ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {hoveredPoint.proj.simulatedHrv} ms
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Intervalo Confianza (90%)</span>
                  <span className="font-mono text-zinc-300">
                    [{hoveredPoint.proj.confidenceLower} - {hoveredPoint.proj.confidenceUpper}] ms
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Estado vs SWC</span>
                  <span className={`font-bold ${hoveredPoint.proj.isBelowSwc ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {hoveredPoint.proj.isBelowSwc ? '⚠ Riesgo Sobre-esfuerzo' : '✓ Normal'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Coach Tactical Verdict & Action Decision Box */}
      <div className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
        regression.fatigueRiskLevel === 'critical_overreaching'
          ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
          : regression.fatigueRiskLevel === 'moderate_strain'
          ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
          : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {regression.fatigueRiskLevel === 'critical_overreaching' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : regression.fatigueRiskLevel === 'moderate_strain' ? (
              <Activity className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <h4 className="text-sm font-black text-zinc-100 uppercase tracking-wide">
              {regression.riskTitle}
            </h4>
          </div>

          <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase font-mono tracking-wider border self-start sm:self-auto ${regression.riskBadgeColor}`}>
            Recomendación: {regression.recommendedAction}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
          {regression.riskDescription}
        </p>

        {/* Coach Miguel Specific Direct Quote */}
        <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Prescripción Directa de Carga — Coach Miguel (Transvulcania 2027)
            </span>
            <span className="text-[11px] font-mono text-zinc-500">Ajuste de Microciclo</span>
          </div>
          <p className="text-xs text-zinc-200 italic leading-relaxed">
            {regression.coachPrescription}
          </p>
        </div>

        {/* Action Buttons to execute the recommended workload adjustment */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {regression.fatigueRiskLevel === 'critical_overreaching' && onScheduleDeload && (
            <button
              onClick={onScheduleDeload}
              className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-500/20 flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Programar descarga</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('planner')}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition border border-zinc-700 flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Ajustar Sesiones en Planificador</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
