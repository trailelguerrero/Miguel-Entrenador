/**
 * HRV rMSSD 30-Day Linear Regression & Fatigue Predictive Engine
 * 
 * Physiological Foundation:
 * - Employs ordinary least squares (OLS) linear regression on the 30-day historical nocturnal rMSSD
 *   and 7-day rolling baseline values to quantify the rate of parasympathetic tone drift (slope m in ms/day).
 * - Projects autonomic fatigue trajectory for the next 7 days (t+1 through t+7) with standard error
 *   prediction corridors (confidence fan).
 * - Translates mathematical trend into actionable training load decisions (Uphill Athlete methodology):
 *   Determines whether the runner should apply a deload (-35% TSS), trim volume (-15%), or safely maintain/increase load.
 */

import { DailyCheckIn, Workout, AthleteProfile } from '../types';
import { buildDailyLoadMap, localDateKey } from './trainingLoad';

export interface HistoricalRegressionPoint {
  index: number;              // 1 to 30
  date: string;
  dayLabel: string;
  dailyHrv: number;           // Actual measured rMSSD (ms)
  hrv7dRolling: number;       // 7-day rolling average
  fittedHrv: number;          // y_hat from regression line
  residual: number;           // y - y_hat
  dailyTss: number;
}

export interface ProjectedPoint {
  index: number;              // 31 to 37 (future days 1 to 7)
  date: string;
  dayLabel: string;
  daysAhead: number;          // 1 to 7
  projectedHrv: number;       // baseline regression projection
  simulatedHrv: number;       // = projectedHrv (sin ajustes por escenario: no hay dato que los respalde)
  confidenceLower: number;    // lower 90% prediction band
  confidenceUpper: number;    // upper 90% prediction band
  swcLower: number;
  swcUpper: number;
  isBelowSwc: boolean;
}

export type FatigueRiskLevel = 
  | 'critical_overreaching'   // Sharp decline projecting below SWC (Needs immediate deload)
  | 'moderate_strain'         // Mild negative slope approaching lower bound
  | 'stable_adaptation'       // Neutral slope within normal SWC band
  | 'supercompensation';      // Positive slope, rebounding parasympathetic activity


export interface LinearRegressionResult {
  n: number;
  slopeDaily: number;         // m (ms/day)
  slopeWeekly: number;        // 7 * m (ms/week)
  intercept: number;          // b
  rValue: number;             // Pearson correlation (-1 to 1)
  rSquared: number;           // Coefficient of determination (0 to 1)
  stdError: number;           // Residual standard error
  meanX: number;
  meanY: number;
  baselineHrv: number;
  swcLower: number;
  swcUpper: number;
  currentHrv7d: number;
  projectedHrv7d: number;     // Projected value at day t+7
  projectedDelta7d: number;   // projectedHrv7d - currentHrv7d
  daysUntilSwcCrossover: number | null; // Days until crossing below SWC lower, or null
  fatigueRiskLevel: FatigueRiskLevel;
  riskTitle: string;
  riskDescription: string;
  riskBadgeColor: string;
  recommendedAction: string;
  recommendedLoadAdjustmentPct: number; // e.g. -35, -15, 0, +10
  coachPrescription: string;
  historicalPoints: HistoricalRegressionPoint[];
  projectedPoints: ProjectedPoint[];
}

/**
 * Calculates 30-day linear regression and 7-day predictive forward fatigue projection
 */
export function calculateHrvPredictiveRegression(
  checkIns: DailyCheckIn[],
  workouts: Workout[],
  profile: AthleteProfile
): LinearRegressionResult {
  // Solo la HRV nocturna medida por Suunto (sincronización); los check-ins
  // manuales no entran en la tendencia.
  checkIns = checkIns.filter(c => c.source === 'suunto');
  // Compute standard deviation of all known check-ins for the SWC band (Plews & Altini, 2017)
  // Solo valores reales; nunca se rellenan con datos de ejemplo.
  const knownHrvValues: number[] = [];
  checkIns.forEach(c => {
    if (c.hrvRmssd > 0) knownHrvValues.push(c.hrvRmssd);
  });
  const meanHrv = knownHrvValues.length > 0 ? knownHrvValues.reduce((a, b) => a + b, 0) / knownHrvValues.length : 0;
  const variance = knownHrvValues.length > 1 ? knownHrvValues.reduce((acc, v) => acc + Math.pow(v - meanHrv, 2), 0) / knownHrvValues.length : 0;
  const standardDeviation = Math.round(Math.sqrt(variance) * 10) / 10;
  const baselineHrv = profile.baselineHrv || Math.round(meanHrv * 10) / 10;

  // Smallest Worthwhile Change (SWC): baseline ± 0.5 * SD
  const swcHalfSd = Math.round((0.5 * standardDeviation) * 10) / 10;
  const swcUpper = Math.round((baselineHrv + swcHalfSd) * 10) / 10;
  const swcLower = Math.round((baselineHrv - swcHalfSd) * 10) / 10;

  // 1. Sort check-ins by date ascending
  const sortedCheckIns = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));

  // Build a 30-day historical window up to the latest check-in
  const totalDays = 30;
  const latestCheckInDate = sortedCheckIns.length > 0 
    ? new Date(sortedCheckIns[sortedCheckIns.length - 1].date + 'T12:00:00')
    : new Date();

  // Create date array for the last 30 days
  const dateStrings: string[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(latestCheckInDate);
    d.setDate(d.getDate() - i);
    dateStrings.push(localDateKey(d));
  }

  // Map check-ins by date for fast lookup
  const checkInMap = new Map<string, DailyCheckIn>();
  sortedCheckIns.forEach(c => checkInMap.set(c.date, c));

  // TSS diario real (solo entrenos completados; TSS de Suunto cuando existe)
  const loadMap = buildDailyLoadMap(workouts, profile.antHr);
  // TSS de los últimos 7 días (hasta hoy), para dar recomendaciones relativas a TU carga
  let currentWeeklyTss = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    currentWeeklyTss += loadMap.get(localDateKey(d))?.tss ?? 0;
  }
  currentWeeklyTss = Math.round(currentWeeklyTss);

  // Solo las noches con HRV medida. x = posición del día dentro de la ventana
  // de 30 días, para que los huecos sin dato no deformen la pendiente.
  const rawData: { x: number; date: string; hrv: number; tss: number }[] = [];
  dateStrings.forEach((dStr, idx) => {
    const c = checkInMap.get(dStr);
    if (c && c.hrvRmssd > 0) {
      rawData.push({ x: idx + 1, date: dStr, hrv: c.hrvRmssd, tss: Math.round(loadMap.get(dStr)?.tss ?? 0) });
    }
  });

  // Media móvil de 7 días (de las noches con dato dentro de los 7 días previos)
  const rolling7d: number[] = rawData.map(p => {
    const window = rawData.filter(q => q.x > p.x - 7 && q.x <= p.x);
    const avg = window.reduce((sum, item) => sum + item.hrv, 0) / window.length;
    return Math.round(avg * 10) / 10;
  });

  // 2. Compute Ordinary Least Squares (OLS) Linear Regression: y = m*x + b
  // Using the daily HRV points (with 1-based index x_i = 1 .. n)
  const n = rawData.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += rawData[i].x;
    sumY += rawData[i].hrv;
  }
  const meanX = n > 0 ? sumX / n : 0;
  const meanY = n > 0 ? sumY / n : 0;

  let ssXX = 0;
  let ssXY = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    const x = rawData[i].x;
    const y = rawData[i].hrv;
    const dx = x - meanX;
    const dy = y - meanY;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssYY += dy * dy;
  }

  const slopeDaily = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slopeDaily * meanX;
  const slopeWeekly = Math.round(slopeDaily * 7 * 100) / 100;

  // Correlation r and R-squared
  const rValue = (ssXX > 0 && ssYY > 0) ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
  const rSquared = Math.round(Math.pow(rValue, 2) * 1000) / 1000;

  // Residual sum of squares and standard error of estimate (S_e)
  let ssRes = 0;
  const historicalPoints: HistoricalRegressionPoint[] = [];

  for (let i = 0; i < n; i++) {
    const x = rawData[i].x;
    const y = rawData[i].hrv;
    const fitted = slopeDaily * x + intercept;
    const residual = y - fitted;
    ssRes += residual * residual;

    const dObj = new Date(rawData[i].date + 'T12:00:00');
    const dayLabel = dObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

    historicalPoints.push({
      index: x,
      date: rawData[i].date,
      dayLabel,
      dailyHrv: y,
      hrv7dRolling: rolling7d[i],
      fittedHrv: Math.round(fitted * 10) / 10,
      residual: Math.round(residual * 10) / 10,
      dailyTss: rawData[i].tss,
    });
  }

  const degreesOfFreedom = Math.max(1, n - 2);
  const stdError = Math.sqrt(ssRes / degreesOfFreedom);

  // 3. 7-Day Future Projection (days 31 to 37)
  const projectedPoints: ProjectedPoint[] = [];
  const latestDateObj = new Date(dateStrings[dateStrings.length - 1] + 'T12:00:00');

  let daysUntilSwcCrossover: number | null = null;
  const currentHrv7d = rolling7d.length > 0 ? rolling7d[rolling7d.length - 1] : 0;

  for (let k = 1; k <= 7; k++) {
    const futureIndex = totalDays + k;
    const nextDate = new Date(latestDateObj);
    nextDate.setDate(latestDateObj.getDate() + k);
    const dateStr = localDateKey(nextDate);
    const dayLabel = nextDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' });

    // Baseline OLS projection
    const rawProjected = slopeDaily * futureIndex + intercept;
    const projectedHrv = Math.round(rawProjected * 10) / 10;

    // Proyección pura de tu tendencia (sin escenarios inventados)
    const simulatedHrv = projectedHrv;

    // Prediction interval (90% confidence corridor, t approx 1.70 for df=28)
    const sePred = stdError * Math.sqrt(1 + (1 / n) + (Math.pow(futureIndex - meanX, 2) / (ssXX || 1)));
    const margin = 1.70 * sePred;
    const confidenceLower = Math.round((simulatedHrv - margin) * 10) / 10;
    const confidenceUpper = Math.round((simulatedHrv + margin) * 10) / 10;

    const isBelowSwc = simulatedHrv < swcLower;
    if (isBelowSwc && daysUntilSwcCrossover === null) {
      daysUntilSwcCrossover = k;
    }

    projectedPoints.push({
      index: futureIndex,
      date: dateStr,
      dayLabel,
      daysAhead: k,
      projectedHrv,
      simulatedHrv,
      confidenceLower,
      confidenceUpper,
      swcLower,
      swcUpper,
      isBelowSwc,
    });
  }

  const finalProjectedDay = projectedPoints[projectedPoints.length - 1];
  const projectedHrv7d = finalProjectedDay.simulatedHrv;
  const projectedDelta7d = Math.round((projectedHrv7d - currentHrv7d) * 10) / 10;

  // 4. Clinical Fatigue & Overreaching Classification
  let fatigueRiskLevel: FatigueRiskLevel;
  let riskTitle: string;
  let riskDescription: string;
  let riskBadgeColor: string;
  let recommendedAction: string;
  let recommendedLoadAdjustmentPct: number;
  let coachPrescription: string;

  if (slopeDaily <= -0.28 || projectedHrv7d < swcLower) {
    fatigueRiskLevel = 'critical_overreaching';
    riskTitle = 'Alerta de Fatiga Severa: Riesgo Inminente de Sobre-esfuerzo No Funcional';
    riskDescription = `La regresión lineal revela una pendiente de decaimiento parasimpático acelerada de ${(slopeDaily).toFixed(2)} ms/día (${slopeWeekly} ms/semana). La proyección a 7 días sitúa el rMSSD en ${projectedHrv7d} ms, penetrando ${Math.abs(Math.round((projectedHrv7d - swcLower) * 10) / 10)} ms por debajo del umbral de tolerancia individual (${swcLower} ms).`;
    riskBadgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    recommendedAction = 'Reducir volumen un -35% a -40% (Microciclo de Descarga Inmediato)';
    recommendedLoadAdjustmentPct = -35;
    coachPrescription = `Coach Miguel: "Tu sistema nervioso autónomo está agotando su reserva de adaptación vagal. El modelo proyecta que en ${daysUntilSwcCrossover ?? 3} días el tono parasimpático quedará totalmente suprimido si mantienes la carga. Para Transvulcania, llegar sobreentrenado destruye la capacidad mitocondrial. ${currentWeeklyTss > 0 ? `Baja el TSS semanal un 35-40 % (de ${currentWeeklyTss} a unos ${Math.round(currentWeeklyTss * 0.6)}-${Math.round(currentWeeklyTss * 0.65)})` : 'Baja el volumen semanal un 35-40 %'}, elimina cualquier sesión de cuestas o intensidades por encima de AeT y haz solo rodajes ${profile.aetHr ? `claramente por debajo de ${profile.aetHr} bpm` : 'claramente por debajo de tu AeT'}."`;
  } else if (slopeDaily < -0.08 || (projectedHrv7d <= swcLower + 1.5)) {
    fatigueRiskLevel = 'moderate_strain';
    riskTitle = 'Fatiga Acumulada Progresiva: Sobre-esfuerzo Funcional en Límite';
    riskDescription = `Tendencia descendente moderada (${(slopeDaily).toFixed(2)} ms/día). El HRV se mantiene aún dentro del corredor normal (${swcLower}-${swcUpper} ms), pero la proyección a 7 días (${projectedHrv7d} ms) roza la frontera inferior de asimilación.`;
    riskBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    recommendedAction = 'Ajuste Preventivo de Volumen (-15% a -20%) o día de descanso pasivo';
    recommendedLoadAdjustmentPct = -15;
    coachPrescription = `Coach Miguel: "Estamos en zona de sobre-esfuerzo funcional. Es normal en semanas de carga alta para ultras de montaña, pero no dejes que la recta cruce los ${swcLower} ms. Cambia el entrenamiento de intervalos por un trote regenerativo en Z1 y duerme al menos 8 horas para estabilizar la curva."`;
  } else if (slopeDaily > 0.20 && projectedHrv7d >= baselineHrv) {
    fatigueRiskLevel = 'supercompensation';
    riskTitle = 'Supercompensación Autonómica: Alta Receptividad al Esfuerzo';
    riskDescription = `Pendiente positiva vigorosa (+${(slopeDaily).toFixed(2)} ms/día). Tu tono parasimpático está rebotando con fuerza por encima de la línea base (${baselineHrv} ms). El organismo ha asimilado la fatiga previa.`;
    riskBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    recommendedAction = 'Autorizado para Bloque de Carga Progresiva (+10% a +15% TSS)';
    recommendedLoadAdjustmentPct = +10;
    coachPrescription = `Coach Miguel: "Excelente respuesta adaptativa. Tu variabilidad cardíaca proyecta mantenerse en la zona alta de supercompensación (${projectedHrv7d} ms). Es el momento idóneo para meter la tirada clave de desnivel específico D+ con bastones o series de umbral aeróbico."`;
  } else {
    fatigueRiskLevel = 'stable_adaptation';
    riskTitle = 'Equilibrio Autonómico Estable: Carga Sostenible';
    riskDescription = `Pendiente neutral (${(slopeDaily >= 0 ? '+' : '') + (slopeDaily).toFixed(2)} ms/día). La variabilidad proyectada se mantendrá equilibrada alrededor de ${projectedHrv7d} ms dentro de la banda SWC, sin señales de desacople parasimpático.`;
    riskBadgeColor = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    recommendedAction = 'Mantener Carga Programada (Sobrecarga Progresiva Normal)';
    recommendedLoadAdjustmentPct = 0;
    coachPrescription = `Coach Miguel: "El estímulo de entrenamiento está perfectamente emparejado con tu tasa de recuperación. Mantén las sesiones programadas según el plan Uphill Athlete sin modificaciones extraordinarias."`;
  }

  return {
    n,
    slopeDaily: Math.round(slopeDaily * 100) / 100,
    slopeWeekly,
    intercept: Math.round(intercept * 10) / 10,
    rValue: Math.round(rValue * 1000) / 1000,
    rSquared,
    stdError: Math.round(stdError * 10) / 10,
    meanX: Math.round(meanX * 10) / 10,
    meanY: Math.round(meanY * 10) / 10,
    baselineHrv,
    swcLower,
    swcUpper,
    currentHrv7d,
    projectedHrv7d,
    projectedDelta7d,
    daysUntilSwcCrossover,
    fatigueRiskLevel,
    riskTitle,
    riskDescription,
    riskBadgeColor,
    recommendedAction,
    recommendedLoadAdjustmentPct,
    coachPrescription,
    historicalPoints,
    projectedPoints,
  };
}
