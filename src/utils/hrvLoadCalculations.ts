/**
 * 7-Day Rolling HRV rMSSD vs Weekly Training Load Correlation Engine
 * 
 * Based on sports science research by:
 * - Dr. Daniel Plews & Dr. Martin Buchheit (2013-2017, Sports Medicine):
 *   "Training adaptation and heart rate variability in elite endurance athletes"
 * - Marco Altini, PhD (HRV4Training):
 *   "Smallest Worthwhile Change (SWC) and normal values in nocturnal rMSSD tracking"
 * - Training for the Uphill Athlete (Kilgore, Johnston, Jornet):
 *   "Monitoring autonomic nervous system fatigue and cardiac drift in mountain ultrarunners"
 * 
 * Physiological Framework:
 * 1. Daily HRV fluctuates with acute stressors (hydration, digestion, sleep timing).
 *    The 7-day rolling average (HRV 7d MA) filters out noise and reveals true systemic autonomic adaptation.
 * 2. When plotted against Weekly Training Load (7d rolling TSS / volume):
 *    - Optimal Adaptation: High/increasing load + HRV 7d within or above the normal SWC band.
 *    - Functional Overreaching (FOR): Acute high load + transient moderate dip (< 3 days), rebounding quickly.
 *    - Non-Functional Overreaching (NFOR): High/sustained weekly load + persistent suppression of HRV 7d
 *      below the Smallest Worthwhile Change (SWC) threshold (< -10% to -15% of baseline) for 3+ consecutive days.
 *    - Deload / Supercompensation: Load drops (-40% to -50%) + HRV 7d rebounds above baseline.
 */

import { Workout, DailyCheckIn, AthleteProfile } from '../types';
import { buildDailyLoadSeries, buildCtlByDate, weeklyLoadThresholds, WeeklyLoadThresholds } from './trainingLoad';

export type OverreachingType = 
  | 'optimal_adaptation'
  | 'functional_overreaching'
  | 'non_functional_overreaching'
  | 'recovery_deload'
  | 'undertraining';

export interface HRVLoadDataPoint {
  date: string;
  dayLabel: string;
  dailyHrv: number;           // Nocturnal rMSSD (ms)
  hrv7dAvg: number;           // 7-day rolling average (ms)
  hrvBaseline: number;        // Athlete's baseline (e.g. 51.5 ms)
  swcUpper: number;           // Baseline + 0.5 * SD (Upper normal band)
  swcLower: number;           // Baseline - 0.5 * SD (Lower normal band)
  dailyTss: number;           // TSS on this single day
  weeklyTss: number;          // 7-day rolling sum of TSS
  loadThresholds: WeeklyLoadThresholds | null; // umbrales relativos a la forma (CTL) de ese día
  weeklyKm: number;           // 7-day rolling sum of km
  weeklyHours: number;        // 7-day rolling sum of training hours
  restingHr: number;          // Nocturnal resting HR (bpm)
  status: OverreachingType;
  isOverreaching: boolean;    // true if NFOR or high strain
  isSuppressed: boolean;      // HRV 7d below SWC lower band
  workoutTitles: string[];
}

export interface OverreachingEpisode {
  id: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  avgHrv: number;
  minHrv: number;
  peakWeeklyTss: number;
  severity: 'moderate' | 'critical';
  diagnosis: string;
  recommendedDeload: string;
}

export interface WeeklyQuadrantPoint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeklyTss: number;
  avgHrv7d: number;
  restingHrAvg: number;
  quadrant: 'supercompensation' | 'overreaching' | 'systemic_fatigue' | 'deload_freshness';
  quadrantLabel: string;
  badgeColor: string;
  isCurrentWeek: boolean;
}

export interface WeeklyHrvLoadBlock {
  id: string;
  weekNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  weeklyTss: number;
  weeklyKm: number;
  weeklyHours: number;
  elevationGainM: number;
  avgHrv: number;
  minHrv: number;
  restingHrAvg: number;
  hrvDeltaPct: number;
  status: 'optimal' | 'functional_overreaching' | 'non_functional_overreaching' | 'deload';
  statusLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isOverreaching: boolean;
  isCurrentWeek: boolean;
  coachVerdict: string;
}

export interface HRVLoadSummary {
  currentHrv7d: number;
  previousHrv7d: number;      // 7 days ago
  hrv7dTrendPct: number;      // % change in HRV 7d
  baselineHrv: number;
  hrvDeltaFromBaselinePct: number;
  swcUpper: number;
  swcLower: number;
  standardDeviation: number;
  currentWeeklyTss: number;
  currentLoadThresholds: WeeklyLoadThresholds | null; // evolucionan con el CTL del atleta
  previousWeeklyTss: number;  // 7 days ago
  weeklyTssTrendPct: number;
  currentWeeklyKm: number;
  currentWeeklyHours: number;
  restingHr7dAvg: number;
  restingHrDelta: number;
  hrvCvPct: number;           // Coefficient of variation of HRV (last 7d)
  fatigueRecoveryIndex: number; // 0-100 score: Autonomic Coupling Index
  fatigueRecoveryStatus: string;
  currentStatus: OverreachingType;
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
  statusBorderColor: string;
  riskAssessment: string;
  isDeloadRecommended: boolean;
  overreachingDaysCount: number;
  overreachingEpisodes: OverreachingEpisode[];
  weeklyQuadrants: WeeklyQuadrantPoint[];
  weeklyBlocks: WeeklyHrvLoadBlock[];
  coachVerdict: string;
  actionableRecommendations: string[];
  series: HRVLoadDataPoint[];
}

/** Media de los valores > 0 (0 = sin dato), redondeada a `decimals`. */
function avgPositive(values: number[], decimals: number): number {
  const v = values.filter(x => x > 0);
  if (v.length === 0) return 0;
  const f = 10 ** decimals;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * f) / f;
}

/**
 * Calculates continuous daily HRV and rolling load metrics for the evaluation window.
 */
export function calculateHRVLoadCorrelation(
  workouts: Workout[],
  checkIns: DailyCheckIn[],
  profile: AthleteProfile,
  daysCount: number = 35
): HRVLoadSummary {
  const realHrvs = (checkIns || []).map(c => c.hrvRmssd).filter(v => v > 0);
  const baselineHrv = profile.baselineHrv ||
    (realHrvs.length > 0 ? Math.round((realHrvs.reduce((a, b) => a + b, 0) / realHrvs.length) * 10) / 10 : 0);

  // Index check-ins by date
  const checkInMap = new Map<string, DailyCheckIn>();
  if (checkIns && checkIns.length > 0) {
    checkIns.forEach(c => checkInMap.set(c.date, c));
  }

  // Carga diaria real: solo entrenos completados, TSS de Suunto cuando existe.
  // (Need enough past days to calculate a clean 7-day rolling window for the earliest point)
  const totalDaysToFetch = daysCount + 14;
  const workoutTssMap = new Map<string, { tss: number; km: number; minutes: number; titles: string[] }>();
  for (const day of buildDailyLoadSeries(workouts, totalDaysToFetch, profile.antHr)) {
    workoutTssMap.set(day.date, { tss: day.tss, km: day.km, minutes: day.minutes, titles: day.titles });
  }

  // CTL de cada fecha: los umbrales de carga de cada día se calculan con la
  // forma física que tenía el atleta ESE día (evolucionan con su carga).
  const ctlByDate = buildCtlByDate(workouts, profile.antHr);

  // Generate continuous daily HRV series
  const sortedDates = Array.from(workoutTssMap.keys()).sort();
  const dailyRecords: Array<{
    date: string;
    dailyHrv: number;
    restingHr: number;
    dailyTss: number;
    dailyKm: number;
    dailyMinutes: number;
    titles: string[];
  }> = [];

  // Compute standard deviation of all known check-ins for the SWC band
  // (only real check-ins; with fewer than 2 values there is no SD → band = baseline)
  const knownHrvValues: number[] = [];
  checkInMap.forEach(c => { if (c.hrvRmssd > 0) knownHrvValues.push(c.hrvRmssd); });
  const meanHrv = knownHrvValues.length > 0 ? knownHrvValues.reduce((a, b) => a + b, 0) / knownHrvValues.length : 0;
  const variance = knownHrvValues.length > 1 ? knownHrvValues.reduce((acc, v) => acc + Math.pow(v - meanHrv, 2), 0) / knownHrvValues.length : 0;
  const standardDeviation = Math.round(Math.sqrt(variance) * 10) / 10;

  // Smallest Worthwhile Change (SWC): baseline ± 0.5 * SD
  const swcHalfSd = Math.round((0.5 * standardDeviation) * 10) / 10;
  const swcUpper = Math.round((baselineHrv + swcHalfSd) * 10) / 10;
  const swcLower = Math.round((baselineHrv - swcHalfSd) * 10) / 10;

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const wData = workoutTssMap.get(dateStr)!;
    const checkIn = checkInMap.get(dateStr);

    // Sin check-in ese día → sin dato (NaN). Nunca se inventan valores de HRV.
    const hrvVal = checkIn?.hrvRmssd && checkIn.hrvRmssd > 0 ? checkIn.hrvRmssd : NaN;
    const rHr = checkIn?.restingHr && checkIn.restingHr > 0 ? checkIn.restingHr : NaN;

    dailyRecords.push({
      date: dateStr,
      dailyHrv: hrvVal,
      restingHr: rHr,
      dailyTss: wData.tss,
      dailyKm: Math.round(wData.km * 10) / 10,
      dailyMinutes: wData.minutes,
      titles: wData.titles,
    });
  }

  // Calculate 7-day rolling metrics and overreaching classifications
  const fullSeries: HRVLoadDataPoint[] = [];

  for (let i = 6; i < dailyRecords.length; i++) {
    const cur = dailyRecords[i];

    // 7-day rolling average of HRV
    let hrvSum = 0;
    let hrvCount = 0;
    let tssSum = 0;
    let kmSum = 0;
    let minSum = 0;

    for (let j = i - 6; j <= i; j++) {
      if (!Number.isNaN(dailyRecords[j].dailyHrv)) {
        hrvSum += dailyRecords[j].dailyHrv;
        hrvCount++;
      }
      tssSum += dailyRecords[j].dailyTss;
      kmSum += dailyRecords[j].dailyKm;
      minSum += dailyRecords[j].dailyMinutes;
    }

    // Media de las noches con dato real dentro de la ventana de 7 días
    const hrv7dAvg = hrvCount > 0 ? Math.round((hrvSum / hrvCount) * 10) / 10 : 0;
    const weeklyTss = Math.round(tssSum);
    const weeklyKm = Math.round(kmSum * 10) / 10;
    const weeklyHours = Math.round((minSum / 60) * 10) / 10;

    const isSuppressed = hrvCount > 0 && hrv7dAvg < swcLower;
    const thr = weeklyLoadThresholds(ctlByDate.get(cur.date));
    const isHighLoad = !!thr && weeklyTss > thr.high;
    const isVeryHighLoad = !!thr && weeklyTss > thr.veryHigh;
    const isLowLoad = !!thr && weeklyTss < thr.low;

    let status: OverreachingType = 'optimal_adaptation';

    if (isHighLoad && isSuppressed) {
      status = 'non_functional_overreaching';
    } else if (isVeryHighLoad && !isSuppressed && hrv7dAvg <= baselineHrv) {
      status = 'functional_overreaching';
    } else if (isLowLoad && hrv7dAvg >= baselineHrv) {
      status = 'recovery_deload';
    } else if (isLowLoad && isSuppressed) {
      status = 'undertraining';
    } else {
      status = 'optimal_adaptation';
    }

    const [yy, mm, dd] = cur.date.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    const dayLabel = `${d.getDate()} ${d.toLocaleString('es-ES', { month: 'short' })}`;

    fullSeries.push({
      date: cur.date,
      dayLabel,
      dailyHrv: Number.isNaN(cur.dailyHrv) ? 0 : cur.dailyHrv,
      hrv7dAvg,
      hrvBaseline: baselineHrv,
      swcUpper,
      swcLower,
      dailyTss: cur.dailyTss,
      weeklyTss,
      loadThresholds: thr,
      weeklyKm,
      weeklyHours,
      restingHr: Number.isNaN(cur.restingHr) ? 0 : cur.restingHr,
      status,
      isOverreaching: status === 'non_functional_overreaching',
      isSuppressed,
      workoutTitles: cur.titles,
    });
  }

  // Restrict to the requested window (e.g. last 28-35 days)
  const displaySeries = fullSeries.slice(-daysCount);

  // Latest status
  const latest = displaySeries[displaySeries.length - 1] || fullSeries[fullSeries.length - 1];
  const point7dAgo = displaySeries[Math.max(0, displaySeries.length - 8)] || displaySeries[0];

  const hrv7dTrendPct = point7dAgo.hrv7dAvg > 0
    ? Math.round(((latest.hrv7dAvg - point7dAgo.hrv7dAvg) / point7dAgo.hrv7dAvg) * 100)
    : 0;

  const weeklyTssTrendPct = point7dAgo.weeklyTss > 0
    ? Math.round(((latest.weeklyTss - point7dAgo.weeklyTss) / point7dAgo.weeklyTss) * 100)
    : 0;

  const hrvDeltaFromBaselinePct = baselineHrv > 0 && latest.hrv7dAvg > 0 ? Math.round(((latest.hrv7dAvg - baselineHrv) / baselineHrv) * 100) : 0;

  // Detect continuous overreaching episodes
  const overreachingEpisodes: OverreachingEpisode[] = [];
  let currentEpisodeStart: HRVLoadDataPoint | null = null;
  let episodePoints: HRVLoadDataPoint[] = [];

  for (let i = 0; i < displaySeries.length; i++) {
    const pt = displaySeries[i];
    if (pt.isOverreaching) {
      if (!currentEpisodeStart) currentEpisodeStart = pt;
      episodePoints.push(pt);
    } else {
      if (currentEpisodeStart && episodePoints.length >= 2) {
        const peakTss = Math.max(...episodePoints.map(p => p.weeklyTss));
        const minHrv = Math.min(...episodePoints.map(p => p.hrv7dAvg));
        const avgHrv = Math.round((episodePoints.reduce((acc, p) => acc + p.hrv7dAvg, 0) / episodePoints.length) * 10) / 10;
        const severity = episodePoints.length >= 4 || minHrv < baselineHrv * 0.82 ? 'critical' : 'moderate';

        overreachingEpisodes.push({
          id: `ep-${currentEpisodeStart.date}`,
          startDate: currentEpisodeStart.date,
          endDate: episodePoints[episodePoints.length - 1].date,
          durationDays: episodePoints.length,
          avgHrv,
          minHrv,
          peakWeeklyTss: peakTss,
          severity,
          diagnosis: severity === 'critical'
            ? 'Sobre-esfuerzo prolongado: desacople parasimpático agudo con caída persistente >15% de HRV bajo pico de carga.'
            : 'Fase de sobrecarga funcional al límite: fatiga autonómica moderada.',
          recommendedDeload: 'Reducción de volumen al 50% con 3 días regenerativos Z1 sub-130 bpm.',
        });
      }
      currentEpisodeStart = null;
      episodePoints = [];
    }
  }

  // If currently in an episode
  if (currentEpisodeStart && episodePoints.length >= 2) {
    const peakTss = Math.max(...episodePoints.map(p => p.weeklyTss));
    const minHrv = Math.min(...episodePoints.map(p => p.hrv7dAvg));
    const avgHrv = Math.round((episodePoints.reduce((acc, p) => acc + p.hrv7dAvg, 0) / episodePoints.length) * 10) / 10;
    const severity = episodePoints.length >= 4 || minHrv < baselineHrv * 0.82 ? 'critical' : 'moderate';

    overreachingEpisodes.push({
      id: `ep-${currentEpisodeStart.date}`,
      startDate: currentEpisodeStart.date,
      endDate: episodePoints[episodePoints.length - 1].date,
      durationDays: episodePoints.length,
      avgHrv,
      minHrv,
      peakWeeklyTss: peakTss,
      severity,
      diagnosis: 'Episodio Activo: El sistema nervioso autónomo acumula varios días consecutivos sin capacidad de restablecer el tono vagal mientras la carga semanal se mantiene alta.',
      recommendedDeload: 'Activar microciclo de descarga inmediato.',
    });
  }

  const overreachingDaysCount = displaySeries.filter(p => p.isOverreaching).length;
  const isDeloadRecommended = latest.status === 'non_functional_overreaching' || latest.hrv7dAvg < swcLower;

  // Format status UI styling & Coach Miguel's verdict
  let statusLabel = 'Adaptación Óptima (SNA Equilibrado)';
  let statusColor = 'text-emerald-400';
  let statusBgColor = 'bg-emerald-500/10';
  let statusBorderColor = 'border-emerald-500/30';
  let riskAssessment = 'Riesgo Mínimo de Sobreentrenamiento (< 5%)';
  let coachVerdict = '';
  const actionableRecommendations: string[] = [];

  if (latest.status === 'non_functional_overreaching') {
    statusLabel = 'Sobre-esfuerzo No Funcional (Alerta de Fatiga)';
    statusColor = 'text-rose-400';
    statusBgColor = 'bg-rose-500/10';
    statusBorderColor = 'border-rose-500/30';
    riskAssessment = 'Riesgo Elevado de Sobreentrenamiento Simpático (35-45%)';
    coachVerdict = `¡Atención fisiológica! Tu media móvil de HRV 7d ha caído a ${latest.hrv7dAvg} ms (${hrvDeltaFromBaselinePct}% por debajo de tu línea base de ${baselineHrv} ms) mientras sostienes una carga semanal alta de ${latest.weeklyTss} TSS (${latest.weeklyKm} km). Esta divergencia es el signo clínico clásico de Sobre-esfuerzo No Funcional (NFOR): tus ramas parasimpáticas no dan abasto para reparar el tejido muscular y el tono cardíaco. Insistir con entrenamientos de intensidad o tiradas de desnivel provocará un estancamiento severo de cara a Transvulcania.`;
    actionableRecommendations.push('Programa de inmediato 3-4 días de descarga activa o descanso absoluto.');
    actionableRecommendations.push('Limita toda actividad de carrera a rodajes regenerativos: ZoneSense en verde y muy cómodo.');
    actionableRecommendations.push('Suprime temporalmente los descensos rápidos para evitar inflamación excéntrica.');
    actionableRecommendations.push('Prioriza higiene de sueño (> 8 horas) y reposición con carbohidratos complejos y sales.');
  } else if (latest.status === 'functional_overreaching') {
    statusLabel = 'Sobre-esfuerzo Funcional (Sobrecarga Controlada)';
    statusColor = 'text-amber-400';
    statusBgColor = 'bg-amber-500/10';
    statusBorderColor = 'border-amber-500/30';
    riskAssessment = 'Fatiga Aguda Controlada (Riesgo Moderado ~15%)';
    coachVerdict = `Te encuentras en fase de Sobre-esfuerzo Funcional (FOR). Estás acumulando un volumen potente de ${latest.weeklyTss} TSS semanal y tu media de HRV 7d (${latest.hrv7dAvg} ms) está ligeramente comprimida pero dentro del margen fisiológico esperado. Es el estímulo que necesitamos para generar supercompensación mitocondrial, pero debes planificar un día de descanso o rodaje muy suave en las próximas 48 horas.`;
    actionableRecommendations.push('Mantén la tirada larga del fin de semana pero sé riguroso con los ritmos sub-AeT.');
    actionableRecommendations.push('Realiza descarga miofascial en sóleos y cuádriceps tras las sesiones.');
    actionableRecommendations.push('Si mañana la HRV puntual cae por debajo de 42 ms, sustituye el entreno por descanso activo.');
  } else if (latest.status === 'recovery_deload') {
    statusLabel = 'Fase de Asimilación / Supercompensación';
    statusColor = 'text-cyan-400';
    statusBgColor = 'bg-cyan-500/10';
    statusBorderColor = 'border-cyan-500/30';
    riskAssessment = 'Óptima Asimilación & Cero Riesgo';
    coachVerdict = `Respuesta de libro: la carga semanal se ha relajado a ${latest.weeklyTss} TSS y tu tono parasimpático ha respondido elevando la media móvil de HRV a ${latest.hrv7dAvg} ms. Tus células están asimilando los miles de metros de desnivel acumulados. En 48 horas estarás listo para iniciar un nuevo bloque de progresión aeróbica.`;
    actionableRecommendations.push('Disfruta de la frescura muscular; no aceleres el ritmo antes de tiempo.');
    actionableRecommendations.push('Aprovecha para realizar los tests de movilidad y fuerza de core.');
    actionableRecommendations.push('Revisa la pauta de hidratación y carbohidratos para el próximo microciclo.');
  } else {
    statusLabel = 'Adaptación Óptima (SNA Equilibrado)';
    statusColor = 'text-emerald-400';
    statusBgColor = 'bg-emerald-500/10';
    statusBorderColor = 'border-emerald-500/30';
    riskAssessment = 'Mínimo Riesgo de Sobreentrenamiento (< 5%)';
    coachVerdict = `Equilibrio autonómico perfecto. Con ${latest.weeklyTss} TSS de carga semanal acumulada, tu media móvil de HRV 7d (${latest.hrv7dAvg} ms) se sitúa firmemente en el Sweet Spot de tu banda normal (${swcLower} - ${swcUpper} ms). Tu sistema nervioso autónomo digiere la carga de subida sin estrés simpático crónico. Continúa con el plan previsto hacia Transvulcania.`;
    actionableRecommendations.push('Continúa con la estructura 3 + tirada larga manteniendo los rodajes en ZoneSense verde.');
    actionableRecommendations.push('Mantén la ingesta de 55-60 g/h de carbohidratos en salidas superiores a 90 minutos.');
    actionableRecommendations.push('Monitorea tu check-in matutino para consolidar la tendencia.');
  }

  // Resting HR 7d and Delta
  const last7SeriesPoints = displaySeries.slice(-7);
  const last7RestingHr = last7SeriesPoints.map(p => p.restingHr).filter(v => v > 0);
  const baselineRestingHr = profile.restingHr || 0;
  const restingHr7dAvg = last7RestingHr.length > 0
    ? Math.round(last7RestingHr.reduce((acc, v) => acc + v, 0) / last7RestingHr.length)
    : baselineRestingHr;
  const restingHrDelta = baselineRestingHr > 0 ? restingHr7dAvg - baselineRestingHr : 0;

  // Coefficient of Variation (CV) of the last 7 daily HRV points
  const last7DailyHrv = last7SeriesPoints.map(p => p.dailyHrv).filter(v => v > 0);
  const mean7dDailyHrv = last7DailyHrv.reduce((a, b) => a + b, 0) / Math.max(last7DailyHrv.length, 1);
  const variance7d = last7DailyHrv.reduce((acc, v) => acc + Math.pow(v - mean7dDailyHrv, 2), 0) / Math.max(last7DailyHrv.length, 1);
  const hrvCvPct = mean7dDailyHrv > 0 
    ? Math.round((Math.sqrt(variance7d) / mean7dDailyHrv) * 1000) / 10 
    : 0;

  // Fatigue vs Recovery Autonomic Coupling Index (0 - 100)
  // High load + High HRV = Supercompensation (>75)
  // High load + Depressed HRV = Severe Overreaching (<35)
  // Low load + Elevated HRV = Deload / Recovery (65-80)
  const hrvScore = Math.max(0, Math.min(100, 50 + (baselineHrv > 0 && latest.hrv7dAvg > 0 ? ((latest.hrv7dAvg - baselineHrv) / baselineHrv) * 120 : 0)));
  const latestThr = latest.loadThresholds;
  const loadPenalty = latestThr && latest.weeklyTss > latestThr.high ? ((latest.weeklyTss - latestThr.high) / 15) : 0;
  const restingHrPenalty = restingHrDelta > 2 ? (restingHrDelta * 3) : 0;
  const rawCouplingIndex = Math.round(hrvScore - (latest.hrv7dAvg < swcLower ? loadPenalty * 1.5 : loadPenalty * 0.5) - restingHrPenalty);
  const fatigueRecoveryIndex = Math.max(12, Math.min(98, rawCouplingIndex));

  let fatigueRecoveryStatus = 'Equilibrio Autonómico Óptimo';
  if (fatigueRecoveryIndex >= 75) {
    fatigueRecoveryStatus = 'Alta Capacidad de Asimilación (Supercompensación)';
  } else if (fatigueRecoveryIndex >= 55) {
    fatigueRecoveryStatus = 'Equilibrio Autonómico Sano';
  } else if (fatigueRecoveryIndex >= 38) {
    fatigueRecoveryStatus = 'Fatiga Aguda Controlada (Sobrecarga Funcional)';
  } else {
    fatigueRecoveryStatus = 'Desacople Autonómico Crítico (Sobre-esfuerzo No Funcional)';
  }

  // Weekly Quadrants (Last 4 Weeks Analysis)
  const weeklyQuadrants: WeeklyQuadrantPoint[] = [];
  const weekNames = ['Hace 3 semanas', 'Hace 2 semanas', 'Semana pasada', 'Últimos 7 días'];
  
  for (let w = 0; w < 4; w++) {
    const startIdx = Math.max(0, displaySeries.length - (4 - w) * 7);
    const endIdx = Math.min(displaySeries.length, startIdx + 7);
    const weekSlice = displaySeries.slice(startIdx, endIdx);

    if (weekSlice.length > 0) {
      const weeklyTss = Math.round(weekSlice.reduce((acc, p) => acc + p.dailyTss, 0));
      const avgHrv7d = avgPositive(weekSlice.map(p => p.hrv7dAvg), 1);
      const restingHrAvg = avgPositive(weekSlice.map(p => p.restingHr), 0);
      const isCurrentWeek = w === 3;

      let quadrant: 'supercompensation' | 'overreaching' | 'systemic_fatigue' | 'deload_freshness';
      let quadrantLabel: string;
      let badgeColor: string;

      const qThr = weekSlice[weekSlice.length - 1].loadThresholds;
      const isHighLoad = !!qThr && weeklyTss > qThr.high;
      const isHighRecovery = avgHrv7d >= baselineHrv * 0.95;

      if (isHighLoad && isHighRecovery) {
        quadrant = 'supercompensation';
        quadrantLabel = 'Alta Carga + Alta Recuperación (Asimilación Óptima)';
        badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      } else if (isHighLoad && !isHighRecovery) {
        quadrant = 'overreaching';
        quadrantLabel = 'Alta Carga + Baja Recuperación (Sobre-esfuerzo)';
        badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      } else if (!isHighLoad && !isHighRecovery) {
        quadrant = 'systemic_fatigue';
        quadrantLabel = 'Baja Carga + Baja Recuperación (Estrés Extradeportivo / Fatiga)';
        badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      } else {
        quadrant = 'deload_freshness';
        quadrantLabel = 'Baja Carga + Alta Recuperación (Fase de Descarga / Frescura)';
        badgeColor = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      }

      weeklyQuadrants.push({
        id: `week-quadrant-${w}`,
        name: weekNames[w],
        startDate: weekSlice[0].date,
        endDate: weekSlice[weekSlice.length - 1].date,
        weeklyTss,
        avgHrv7d,
        restingHrAvg,
        quadrant,
        quadrantLabel,
        badgeColor,
        isCurrentWeek,
      });
    }
  }

  // Weekly Blocks (Microcycle Breakdown for Dual Axis Chart)
  const weeklyBlocks: WeeklyHrvLoadBlock[] = [];
  const totalWeeks = Math.max(1, Math.min(5, Math.floor(displaySeries.length / 7)));
  const blockWeekLabels = Array.from({ length: totalWeeks }, (_, w) =>
    w === totalWeeks - 1 ? 'Últimos 7 días' : `Hace ${totalWeeks - 1 - w} sem.`);

  for (let w = 0; w < totalWeeks; w++) {
    const startIdx = Math.max(0, displaySeries.length - (totalWeeks - w) * 7);
    const endIdx = Math.min(displaySeries.length, startIdx + 7);
    const weekSlice = displaySeries.slice(startIdx, endIdx);

    if (weekSlice.length > 0) {
      const weeklyTss = Math.round(weekSlice.reduce((acc, p) => acc + p.dailyTss, 0));
      // Km y horas reales de la semana (suma de 7 días del último punto)
      const weeklyKm = Math.round((weekSlice[weekSlice.length - 1]?.weeklyKm || 0) * 10) / 10;
      const weeklyHours = Math.round((weekSlice[weekSlice.length - 1]?.weeklyHours || 0) * 10) / 10;

      const hrvValues = weekSlice.map(p => p.dailyHrv).filter(v => v > 0);
      const avgHrv = avgPositive(hrvValues, 1);
      const minHrv = hrvValues.length > 0 ? Math.min(...hrvValues) : 0;
      const restingHrAvg = avgPositive(weekSlice.map(p => p.restingHr), 0);
      const isCurrentWeek = w === totalWeeks - 1;
      const hrvDeltaPct = baselineHrv > 0 && avgHrv > 0 ? Math.round(((avgHrv - baselineHrv) / baselineHrv) * 100) : 0;

      // Estimate elevation gain for mountain context
      const startDateStr = weekSlice[0].date;
      const endDateStr = weekSlice[weekSlice.length - 1].date;
      const weekWorkouts = workouts.filter(wo => wo.completed && wo.date >= startDateStr && wo.date <= endDateStr);
      const elevationGainM = weekWorkouts.reduce((acc, wo) => acc + (wo.actualElevationGainM || 0), 0);

      let status: 'optimal' | 'functional_overreaching' | 'non_functional_overreaching' | 'deload';
      let statusLabel: string;
      let badgeBg: string;
      let badgeText: string;
      let badgeBorder: string;
      let coachVerdict: string;
      let isOverreaching = false;

      const bThr = weekSlice[weekSlice.length - 1].loadThresholds;
      if (bThr && weeklyTss > bThr.high && avgHrv > 0 && avgHrv < swcLower) {
        status = 'non_functional_overreaching';
        statusLabel = 'Sobreentrenamiento (NFOR)';
        badgeBg = 'bg-rose-500/20';
        badgeText = 'text-rose-400';
        badgeBorder = 'border-rose-500/40';
        isOverreaching = true;
        coachVerdict = `¡Alarma de sobreentrenamiento! Carga acumulada muy alta (${weeklyTss} TSS) coincidiendo con un desplome del rMSSD medio (${avgHrv} ms, por debajo del umbral de ${swcLower} ms). Bloqueo autonómico parasimpático.`;
      } else if (bThr && weeklyTss > bThr.veryHigh && avgHrv > 0 && avgHrv < baselineHrv) {
        status = 'functional_overreaching';
        statusLabel = 'Sobre-esfuerzo Funcional (FOR)';
        badgeBg = 'bg-amber-500/20';
        badgeText = 'text-amber-400';
        badgeBorder = 'border-amber-500/40';
        coachVerdict = `Sobrecarga controlada (${weeklyTss} TSS). Fatiga aguda asumible pero requiere día de descarga en las próximas 48h.`;
      } else if (bThr && weeklyTss < bThr.low && avgHrv >= baselineHrv * 0.96) {
        status = 'deload';
        statusLabel = 'Semana de Descarga / Frescura';
        badgeBg = 'bg-cyan-500/20';
        badgeText = 'text-cyan-400';
        badgeBorder = 'border-cyan-500/40';
        coachVerdict = `Microciclo regenerativo (${weeklyTss} TSS). Reabsorción de fatiga y supercompensación de glucógeno y fibras musculares.`;
      } else {
        status = 'optimal';
        statusLabel = 'Adaptación Óptima';
        badgeBg = 'bg-emerald-500/20';
        badgeText = 'text-emerald-400';
        badgeBorder = 'border-emerald-500/40';
        coachVerdict = `Equilibrio fisiológico modélico (${weeklyTss} TSS, HRV ${avgHrv} ms). El sistema parasimpático digiere el volumen sin estrés residual.`;
      }

      weeklyBlocks.push({
        id: `week-block-${w}`,
        weekNumber: w + 1,
        name: blockWeekLabels[w] || `Semana ${w + 1}`,
        startDate: startDateStr,
        endDate: endDateStr,
        weeklyTss,
        weeklyKm,
        weeklyHours,
        elevationGainM,
        avgHrv,
        minHrv,
        restingHrAvg,
        hrvDeltaPct,
        status,
        statusLabel,
        badgeBg,
        badgeText,
        badgeBorder,
        isOverreaching,
        isCurrentWeek,
        coachVerdict,
      });
    }
  }

  return {
    currentHrv7d: latest.hrv7dAvg,
    previousHrv7d: point7dAgo.hrv7dAvg,
    hrv7dTrendPct,
    baselineHrv,
    hrvDeltaFromBaselinePct,
    swcUpper,
    swcLower,
    standardDeviation,
    currentWeeklyTss: latest.weeklyTss,
    currentLoadThresholds: latest.loadThresholds,
    previousWeeklyTss: point7dAgo.weeklyTss,
    weeklyTssTrendPct,
    currentWeeklyKm: latest.weeklyKm,
    currentWeeklyHours: latest.weeklyHours,
    restingHr7dAvg,
    restingHrDelta,
    hrvCvPct,
    fatigueRecoveryIndex,
    fatigueRecoveryStatus,
    currentStatus: latest.status,
    statusLabel,
    statusColor,
    statusBgColor,
    statusBorderColor,
    riskAssessment,
    isDeloadRecommended,
    overreachingDaysCount,
    overreachingEpisodes,
    weeklyQuadrants,
    weeklyBlocks,
    coachVerdict,
    actionableRecommendations,
    series: displaySeries,
  };
}
