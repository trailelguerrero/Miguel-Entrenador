/**
 * HRV nocturna (media de 7 días) frente a la carga semanal: PATRONES DESCRIPTIVOS.
 *
 * Referencias: Plews & Buchheit (media móvil de rMSSD), Altini (SWC = referencia
 * ± 0,5 DE). Aquí solo se describe qué combinación hay (carga alta/baja frente a
 * HRV dentro/fuera de tu banda normal). No es un diagnóstico clínico ni una
 * recomendación: qué hacer hoy lo decide el motor de readiness (src/brain/readiness.ts).
 */

import { Workout, DailyCheckIn, AthleteProfile } from '../types';
import { measuredAntHr } from '../brain/intensity.js';
import { buildDailyLoadSeries, buildCtlByDate, weeklyLoadThresholds, WeeklyLoadThresholds } from './trainingLoad';

export type HrvLoadPattern = 
  | 'insufficient_data'        // sin HRV medida en la ventana: no hay tendencia (nunca "estable")
  | 'hrv_in_band'              // HRV media dentro de tu banda normal
  | 'high_load_hrv_below_ref'  // carga alta + HRV media algo por debajo de tu referencia
  | 'high_load_low_hrv'        // carga muy alta + HRV media bajo tu banda normal
  | 'low_load_hrv_recovered'   // carga baja + HRV media en/por encima de tu referencia
  | 'low_load_low_hrv';        // carga baja + HRV media bajo tu banda normal

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
  status: HrvLoadPattern;
  isHighLoadLowHrv: boolean;    // patrón carga muy alta + HRV bajo la banda
  isSuppressed: boolean;      // HRV 7d below SWC lower band
  workoutTitles: string[];
}

export interface HighLoadLowHrvEpisode {
  id: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  avgHrv: number;
  minHrv: number;
  peakWeeklyTss: number;
  description: string;
}

export interface WeeklyQuadrantPoint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeklyTss: number;
  avgHrv7d: number;
  restingHrAvg: number;
  quadrant: 'high_load_high_hrv' | 'high_load_low_hrv' | 'low_load_low_hrv' | 'low_load_high_hrv';
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
  status: 'optimal' | 'high_load_hrv_below_ref' | 'high_load_low_hrv' | 'deload' | 'insufficient_data';
  statusLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isHighLoadLowHrv: boolean;
  isCurrentWeek: boolean;
  description: string;
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
  /** Índice PROPIO de la app (fórmula no validada), 0-100: solo una tendencia orientativa. */
  loadRecoveryTrendScore: number;
  loadRecoveryTrendLabel: string;
  currentStatus: HrvLoadPattern;
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
  statusBorderColor: string;
  trendSummary: string;
  highLoadLowHrvDays: number;
  highLoadLowHrvEpisodes: HighLoadLowHrvEpisode[];
  weeklyQuadrants: WeeklyQuadrantPoint[];
  weeklyBlocks: WeeklyHrvLoadBlock[];
  description: string;
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
  for (const day of buildDailyLoadSeries(workouts, totalDaysToFetch, measuredAntHr(profile))) {
    workoutTssMap.set(day.date, { tss: day.tss, km: day.km, minutes: day.minutes, titles: day.titles });
  }

  // CTL de cada fecha: los umbrales de carga de cada día se calculan con la
  // forma física que tenía el atleta ESE día (evolucionan con su carga).
  const ctlByDate = buildCtlByDate(workouts, measuredAntHr(profile));

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

    let status: HrvLoadPattern = 'hrv_in_band';

    // Gravedad coherente: la fatiga acumulada exige MÁS carga que la carga alta asumida
    if (hrvCount === 0) {
      status = 'insufficient_data';
    } else if (isVeryHighLoad && isSuppressed) {
      status = 'high_load_low_hrv';
    } else if (isHighLoad && hrv7dAvg > 0 && hrv7dAvg <= baselineHrv) {
      status = 'high_load_hrv_below_ref';
    } else if (isLowLoad && hrv7dAvg >= baselineHrv) {
      status = 'low_load_hrv_recovered';
    } else if (isLowLoad && isSuppressed) {
      status = 'low_load_low_hrv';
    } else {
      status = 'hrv_in_band';
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
      isHighLoadLowHrv: status === 'high_load_low_hrv',
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
  const highLoadLowHrvEpisodes: HighLoadLowHrvEpisode[] = [];
  let currentEpisodeStart: HRVLoadDataPoint | null = null;
  let episodePoints: HRVLoadDataPoint[] = [];

  for (let i = 0; i < displaySeries.length; i++) {
    const pt = displaySeries[i];
    if (pt.isHighLoadLowHrv) {
      if (!currentEpisodeStart) currentEpisodeStart = pt;
      episodePoints.push(pt);
    } else {
      if (currentEpisodeStart && episodePoints.length >= 2) {
        const peakTss = Math.max(...episodePoints.map(p => p.weeklyTss));
        const minHrv = Math.min(...episodePoints.map(p => p.hrv7dAvg));
        const avgHrv = Math.round((episodePoints.reduce((acc, p) => acc + p.hrv7dAvg, 0) / episodePoints.length) * 10) / 10;

        highLoadLowHrvEpisodes.push({
          id: `ep-${currentEpisodeStart.date}`,
          startDate: currentEpisodeStart.date,
          endDate: episodePoints[episodePoints.length - 1].date,
          durationDays: episodePoints.length,
          avgHrv,
          minHrv,
          peakWeeklyTss: peakTss,
          description: `${episodePoints.length} días seguidos con carga muy alta y la HRV media por debajo de tu banda normal (mínimo ${minHrv} ms).`,
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

    highLoadLowHrvEpisodes.push({
      id: `ep-${currentEpisodeStart.date}`,
      startDate: currentEpisodeStart.date,
      endDate: episodePoints[episodePoints.length - 1].date,
      durationDays: episodePoints.length,
      avgHrv,
      minHrv,
      peakWeeklyTss: peakTss,
      description: `En curso: ${episodePoints.length} días seguidos con carga muy alta y la HRV media por debajo de tu banda normal.`,
    });
  }

  const highLoadLowHrvDays = displaySeries.filter(p => p.isHighLoadLowHrv).length;
  let statusLabel = 'HRV en tu banda normal';
  let statusColor = 'text-emerald-400';
  let statusBgColor = 'bg-emerald-500/10';
  let statusBorderColor = 'border-emerald-500/30';
  let trendSummary = 'HRV media dentro de tu banda normal';
  let description = '';
  // Solo descripción de la tendencia de 7 días: qué hacer HOY lo decide el motor de readiness.
  const TODAY_RULE = 'Es una tendencia, no una decisión: la sesión de hoy la fija el estado de readiness.';

  if (latest.status === 'insufficient_data') {
    statusLabel = 'Sin datos de HRV';
    statusColor = 'text-zinc-300';
    statusBgColor = 'bg-zinc-700/30';
    statusBorderColor = 'border-zinc-600';
    trendSummary = 'No hay HRV medida en los últimos 7 días: no se puede leer la tendencia';
    description = `Carga de ${latest.weeklyTss} TSS esta semana; sin HRV de los últimos 7 días no hay tendencia que describir. Sincroniza Suunto.`;
  } else if (latest.status === 'high_load_low_hrv') {
    statusLabel = 'Carga muy alta + HRV baja';
    statusColor = 'text-rose-400';
    statusBgColor = 'bg-rose-500/10';
    statusBorderColor = 'border-rose-500/30';
    trendSummary = 'Carga muy alta con la HRV media por debajo de tu banda normal';
    description = `HRV media de 7 días ${latest.hrv7dAvg} ms (${hrvDeltaFromBaselinePct}% frente a tu referencia de ${baselineHrv} ms) con ${latest.weeklyTss} TSS esta semana, por encima de tu carga habitual. ${TODAY_RULE}`;
  } else if (latest.status === 'high_load_hrv_below_ref') {
    statusLabel = 'Carga alta + HRV algo baja';
    statusColor = 'text-amber-400';
    statusBgColor = 'bg-amber-500/10';
    statusBorderColor = 'border-amber-500/30';
    trendSummary = 'Carga por encima de lo habitual con la HRV media algo por debajo de tu referencia';
    description = `${latest.weeklyTss} TSS esta semana y HRV media de 7 días ${latest.hrv7dAvg} ms, algo por debajo de tu referencia (${baselineHrv} ms) pero dentro de tu banda normal. ${TODAY_RULE}`;
  } else if (latest.status === 'low_load_hrv_recovered') {
    statusLabel = 'Carga baja + HRV en referencia';
    statusColor = 'text-cyan-400';
    statusBgColor = 'bg-cyan-500/10';
    statusBorderColor = 'border-cyan-500/30';
    trendSummary = 'Carga baja con la HRV media en tu referencia o por encima';
    description = `La carga semanal es baja (${latest.weeklyTss} TSS) y la HRV media de 7 días está en ${latest.hrv7dAvg} ms. ${TODAY_RULE}`;
  } else if (latest.status === 'low_load_low_hrv') {
    statusLabel = 'Carga baja + HRV baja';
    statusColor = 'text-amber-400';
    statusBgColor = 'bg-amber-500/10';
    statusBorderColor = 'border-amber-500/30';
    trendSummary = 'Carga baja con la HRV media por debajo de tu banda normal';
    description = `La carga semanal es baja (${latest.weeklyTss} TSS) y aun así la HRV media de 7 días (${latest.hrv7dAvg} ms) está bajo tu banda normal (${swcLower} ms). ${TODAY_RULE}`;
  } else {
    description = `Con ${latest.weeklyTss} TSS esta semana, tu HRV media de 7 días (${latest.hrv7dAvg} ms) está dentro de tu banda normal (${swcLower} - ${swcUpper} ms). ${TODAY_RULE}`;
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

  // Índice propio de la app (0-100, fórmula no validada): HRV frente a referencia,
  // penalizado por carga por encima de lo habitual y FC de reposo elevada.
  const hrvScore = Math.max(0, Math.min(100, 50 + (baselineHrv > 0 && latest.hrv7dAvg > 0 ? ((latest.hrv7dAvg - baselineHrv) / baselineHrv) * 120 : 0)));
  const latestThr = latest.loadThresholds;
  const loadPenalty = latestThr && latest.weeklyTss > latestThr.high ? ((latest.weeklyTss - latestThr.high) / 15) : 0;
  const restingHrPenalty = restingHrDelta > 2 ? (restingHrDelta * 3) : 0;
  const rawCouplingIndex = Math.round(hrvScore - (latest.hrv7dAvg < swcLower ? loadPenalty * 1.5 : loadPenalty * 0.5) - restingHrPenalty);
  const loadRecoveryTrendScore = Math.max(12, Math.min(98, rawCouplingIndex));

  // Índice ORIENTATIVO de la app (no validado): sin HRV no hay lectura
  let loadRecoveryTrendLabel: string;
  if (!(latest.hrv7dAvg > 0)) {
    loadRecoveryTrendLabel = 'Sin datos de HRV';
  } else if (loadRecoveryTrendScore >= 75) {
    loadRecoveryTrendLabel = 'Índice alto: HRV alta para la carga que llevas';
  } else if (loadRecoveryTrendScore >= 55) {
    loadRecoveryTrendLabel = 'Índice medio';
  } else if (loadRecoveryTrendScore >= 38) {
    loadRecoveryTrendLabel = 'Índice bajo: HRV baja para la carga que llevas';
  } else {
    loadRecoveryTrendLabel = 'Índice muy bajo: carga alta y HRV bajo tu banda';
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

      let quadrant: WeeklyQuadrantPoint['quadrant'];
      let quadrantLabel: string;
      let badgeColor: string;

      const qThr = weekSlice[weekSlice.length - 1].loadThresholds;
      const isHighLoad = !!qThr && weeklyTss > qThr.high;
      const isHighRecovery = avgHrv7d >= baselineHrv * 0.95;

      if (isHighLoad && isHighRecovery) {
        quadrant = 'high_load_high_hrv';
        quadrantLabel = 'Carga alta + HRV en referencia';
        badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      } else if (isHighLoad && !isHighRecovery) {
        quadrant = 'high_load_low_hrv';
        quadrantLabel = 'Carga alta + HRV baja';
        badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      } else if (!isHighLoad && !isHighRecovery) {
        quadrant = 'low_load_low_hrv';
        quadrantLabel = 'Carga baja + HRV baja';
        badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      } else {
        quadrant = 'low_load_high_hrv';
        quadrantLabel = 'Carga baja + HRV en referencia';
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

      let status: 'optimal' | 'high_load_hrv_below_ref' | 'high_load_low_hrv' | 'deload' | 'insufficient_data';
      let statusLabel: string;
      let badgeBg: string;
      let badgeText: string;
      let badgeBorder: string;
      let description: string;
      let isHighLoadLowHrv = false;

      const bThr = weekSlice[weekSlice.length - 1].loadThresholds;
      if (!(avgHrv > 0)) {
        status = 'insufficient_data';
        statusLabel = 'Sin HRV';
        badgeBg = 'bg-zinc-700/40';
        badgeText = 'text-zinc-300';
        badgeBorder = 'border-zinc-600';
        description = `Carga ${weeklyTss} TSS; sin HRV medida esa semana no hay lectura de la tendencia.`;
      } else if (bThr && weeklyTss > bThr.veryHigh && avgHrv > 0 && avgHrv < swcLower) {
        status = 'high_load_low_hrv';
        statusLabel = 'Carga muy alta + HRV baja';
        badgeBg = 'bg-rose-500/20';
        badgeText = 'text-rose-400';
        badgeBorder = 'border-rose-500/40';
        isHighLoadLowHrv = true;
        description = `Carga muy alta (${weeklyTss} TSS) con la HRV media (${avgHrv} ms) por debajo de tu banda normal (${swcLower} ms): por debajo de tu banda.`;
      } else if (bThr && weeklyTss > bThr.high && avgHrv > 0 && avgHrv < baselineHrv) {
        status = 'high_load_hrv_below_ref';
        statusLabel = 'Carga alta + HRV algo baja';
        badgeBg = 'bg-amber-500/20';
        badgeText = 'text-amber-400';
        badgeBorder = 'border-amber-500/40';
        description = `Carga alta (${weeklyTss} TSS) con la HRV media algo por debajo de tu referencia.`;
      } else if (bThr && weeklyTss < bThr.low && avgHrv >= baselineHrv * 0.96) {
        status = 'deload';
        statusLabel = 'Carga baja + HRV en referencia';
        badgeBg = 'bg-cyan-500/20';
        badgeText = 'text-cyan-400';
        badgeBorder = 'border-cyan-500/40';
        description = `Carga baja (${weeklyTss} TSS) con la HRV media en tu referencia.`;
      } else {
        status = 'optimal';
        statusLabel = 'HRV en tu banda';
        badgeBg = 'bg-emerald-500/20';
        badgeText = 'text-emerald-400';
        badgeBorder = 'border-emerald-500/40';
        description = `Carga ${weeklyTss} TSS con la HRV media (${avgHrv} ms) en tu banda normal.`;
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
        isHighLoadLowHrv,
        isCurrentWeek,
        description,
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
    loadRecoveryTrendScore,
    loadRecoveryTrendLabel,
    currentStatus: latest.status,
    statusLabel,
    statusColor,
    statusBgColor,
    statusBorderColor,
    trendSummary,
    highLoadLowHrvDays,
    highLoadLowHrvEpisodes,
    weeklyQuadrants,
    weeklyBlocks,
    description,
    series: displaySeries,
  };
}
