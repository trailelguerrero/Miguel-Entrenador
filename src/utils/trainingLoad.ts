/**
 * Fuente única de la carga diaria (TSS) y del PMC (CTL / ATL / TSB).
 *
 * Reglas (para que los valores coincidan con los de la app de Suunto):
 * - Solo cuentan los entrenamientos COMPLETADOS. Una sesión planificada que no
 *   se hizo no genera carga.
 * - Si el entrenamiento viene de Suunto, se usa su TSS tal cual (actualTss).
 *   Nunca se recalcula a partir de la FC media; si Suunto no le dio TSS, cuenta 0.
 * - Solo si el entrenamiento no trae TSS (registro manual sin Suunto) se
 *   estima con calculateWorkoutTss y se marca como estimado.
 * - CTL y ATL arrancan en 0 el día del primer entrenamiento registrado y se
 *   actualizan cada día (con o sin entreno) hasta hoy. No hay valores semilla
 *   ni series de ejemplo.
 * - CTL = media exponencial de 42 días, ATL = de 7 días, TSB = CTL − ATL
 *   (definiciones que Suunto publica para Fitness / Fatigue / Form).
 */
import type { PMCDataPoint, Workout } from '../types/index.js';
import { calculateWorkoutTss } from './pmcCalculations.js';

export const CTL_DAYS = 42;
export const ATL_DAYS = 7;

/** Fecha local YYYY-MM-DD (toISOString usa UTC y puede cambiar el día). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysKey(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

// 'suunto'          = TSS que Suunto calculó con los datos del entreno (medido);
// 'suunto_assigned' = TSS que Suunto ASIGNA a una actividad añadida a mano (valor
//                     fijo por hora, sin FC): no es medido ni lo estima esta app;
// 'estimated'       = estimación de esta app (registro manual sin Suunto).
export type TssSource = 'suunto' | 'suunto_assigned' | 'estimated';

/** ¿La carga no es medida? (asignada por Suunto o estimada por la app) */
export const isNonMeasuredLoad = (s: TssSource | undefined) => s === 'estimated' || s === 'suunto_assigned';

/**
 * Confianza de la carga: una carga estimada nunca es indistinguible de una medida.
 * - measured_suunto:    TSS calculado por Suunto con los datos del entreno
 * - assigned_suunto:    valor fijo por hora que Suunto asigna a una actividad añadida a mano
 * - estimated_hr:       hrTSS de la app con FC media y umbral anaeróbico MEDIDO
 * - estimated_rpe:      sRPE (esfuerzo percibido)
 * - estimated_duration: solo duración (IF fijo): la estimación más débil
 * - estimated_stored:   TSS estimado que se guardó al completar (método desconocido)
 */
export type LoadConfidence = 'measured_suunto' | 'assigned_suunto' | 'estimated_hr' | 'estimated_rpe' | 'estimated_duration' | 'estimated_stored';

export interface WorkoutLoad {
  tss: number;
  source: TssSource;
  confidence: LoadConfidence;
}

/**
 * TSS real de un entrenamiento completado, o null si no se completó.
 * Prioridad: TSS de Suunto → TSS estimado guardado al completar → estimación.
 */
export function getWorkoutLoad(w: Workout, antHr?: number): WorkoutLoad | null {
  if (!w.completed) return null;
  // Entreno de Suunto: se usa su TSS; si Suunto no le asignó TSS, no suma
  // carga (igual que en la app de Suunto). Nunca se estima.
  // Añadido a mano en Suunto: el TSS es un valor fijo por hora que pone Suunto, no una medida
  if (w.suuntoWorkoutKey && w.suuntoManualEntry) return { tss: w.actualTss ?? 0, source: 'suunto_assigned', confidence: 'assigned_suunto' };
  if (w.suuntoWorkoutKey) return { tss: w.actualTss ?? 0, source: 'suunto', confidence: 'measured_suunto' };
  if (w.actualTss != null) return { tss: w.actualTss, source: 'estimated', confidence: 'estimated_stored' };
  if (w.tss != null) return { tss: w.tss, source: 'estimated', confidence: 'estimated_stored' };
  const dur = w.actualDurationMin ?? w.plannedDurationMin ?? 0;
  if (dur <= 0) return null;
  // antHr solo si es > 0; sin umbral medido no hay hrTSS (se cae a RPE o duración)
  const calc = calculateWorkoutTss(dur, w.actualAvgHr || undefined, antHr && antHr > 0 ? antHr : undefined, w.athleteRpe);
  const confidence: LoadConfidence = calc.method === 'hrTSS' ? 'estimated_hr' : calc.method === 'rpeTSS' ? 'estimated_rpe' : 'estimated_duration';
  return { tss: calc.tss, source: 'estimated', confidence };
}

export interface DailyLoad {
  date: string;
  tss: number;
  titles: string[];
  minutes: number;
  km: number;
  elevationGainM: number;
  elevationLossM: number;
  zoneSenseAerobicMin: number;
  estimatedTss: boolean;
  rpes: number[];
}

/** Carga diaria agregada de los entrenamientos completados, indexada por fecha. */
export function buildDailyLoadMap(workouts: Workout[], antHr?: number): Map<string, DailyLoad> {
  const map = new Map<string, DailyLoad>();
  for (const w of workouts || []) {
    const load = getWorkoutLoad(w, antHr);
    if (!load) continue;
    let day = map.get(w.date);
    if (!day) {
      day = { date: w.date, tss: 0, titles: [], minutes: 0, km: 0, elevationGainM: 0, elevationLossM: 0, zoneSenseAerobicMin: 0, estimatedTss: false, rpes: [] };
      map.set(w.date, day);
    }
    const dur = w.actualDurationMin ?? w.plannedDurationMin ?? 0;
    day.tss += load.tss;
    day.minutes += dur;
    day.km += w.actualDistanceKm ?? 0;
    day.elevationGainM += w.actualElevationGainM ?? 0;
    day.elevationLossM += w.actualElevationLossM ?? 0;
    // Minutos en verde = % verde × tiempo MEDIDO (no × duración total)
    if (w.zoneSenseBreakdown) day.zoneSenseAerobicMin += Math.round((dur * w.zoneSenseBreakdown.aerobicPct * (w.zoneSenseBreakdown.measuredPct ?? 100)) / 10000);
    if (isNonMeasuredLoad(load.source)) day.estimatedTss = true;
    if (w.athleteRpe) day.rpes.push(w.athleteRpe);
    if (w.title && !day.titles.includes(w.title)) day.titles.push(w.title);
  }
  return map;
}

/** Serie continua de fechas (de más antigua a hoy) con la carga de cada día (0 si no hubo). */
export function buildDailyLoadSeries(workouts: Workout[], daysCount: number, antHr?: number, endDate: string = localDateKey()): DailyLoad[] {
  const map = buildDailyLoadMap(workouts, antHr);
  const out: DailyLoad[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const date = addDaysKey(endDate, -i);
    out.push(
      map.get(date) ?? { date, tss: 0, titles: [], minutes: 0, km: 0, elevationGainM: 0, elevationLossM: 0, zoneSenseAerobicMin: 0, estimatedTss: false, rpes: [] },
    );
  }
  return out;
}

function dayLabel(date: string): string {
  return parseDateKey(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Serie PMC completa: desde el primer entrenamiento completado hasta hoy.
 * Devuelve [] si no hay ningún entrenamiento completado.
 * Si se pasa daysToShow, devuelve solo los últimos N días (pero calculados
 * con todo el historial, que es lo que da el CTL correcto).
 */
export function computePmcSeries(workouts: Workout[], antHr?: number, daysToShow?: number, today: string = localDateKey()): PMCDataPoint[] {
  const map = buildDailyLoadMap(workouts, antHr);
  const dates = [...map.keys()].filter((d) => d <= today).sort();
  if (dates.length === 0) return [];

  const points: PMCDataPoint[] = [];
  let ctl = 0;
  let atl = 0;
  for (let date = dates[0]; date <= today; date = addDaysKey(date, 1)) {
    const day = map.get(date);
    const tss = day?.tss ?? 0;
    ctl = ctl + (tss - ctl) / CTL_DAYS;
    atl = atl + (tss - atl) / ATL_DAYS;
    const prevWeek = points.length >= 7 ? points[points.length - 7] : undefined;
    const ctlR = round1(ctl);
    points.push({
      date,
      dayLabel: dayLabel(date),
      tss: Math.round(tss),
      mountainTss: Math.round(tss),
      ctl: ctlR,
      atl: round1(atl),
      tsb: round1(ctl - atl),
      rampRate: prevWeek ? round1(ctlR - prevWeek.ctl) : undefined,
      zoneSenseAerobicMin: day?.zoneSenseAerobicMin ?? 0,
      elevationGainM: day?.elevationGainM ?? 0,
      elevationLossM: day?.elevationLossM ?? 0,
      workoutTitle: day && day.titles.length > 0 ? day.titles.join(' + ') : undefined,
      rpe: day && day.rpes.length > 0 ? round1(day.rpes.reduce((a, b) => a + b, 0) / day.rpes.length) : undefined,
    });
  }
  return daysToShow ? points.slice(-daysToShow) : points;
}

export interface WindowLoad {
  /** TSS total de la ventana (medido + no medido). */
  tss: number;
  /** Parte del TSS que NO es medida (estimada por la app o asignada por Suunto). */
  nonMeasuredTss: number;
}

/** TSS de los entrenos completados entre from y to (incluidos), separando la parte no medida. */
export function windowLoad(workouts: Workout[], from: string, to: string, antHr?: number): WindowLoad {
  let tss = 0;
  let nonMeasuredTss = 0;
  for (const w of workouts || []) {
    if (w.date < from || w.date > to) continue;
    const load = getWorkoutLoad(w, antHr);
    if (!load) continue;
    tss += load.tss;
    if (isNonMeasuredLoad(load.source)) nonMeasuredTss += load.tss;
  }
  return { tss: Math.round(tss), nonMeasuredTss: Math.round(nonMeasuredTss) };
}

/** ¿Algún día de la serie usa TSS estimado (entrenos sin TSS de Suunto)? */
export function countEstimatedWorkouts(workouts: Workout[], antHr?: number, sinceDate?: string): number {
  let n = 0;
  for (const w of workouts || []) {
    if (sinceDate && w.date < sinceDate) continue;
    if (isNonMeasuredLoad(getWorkoutLoad(w, antHr)?.source)) n++;
  }
  return n;
}

/**
 * Umbrales de carga semanal RELATIVOS al atleta, que evolucionan con su forma
 * física: la referencia es su carga crónica (CTL × 7 = TSS/semana que su
 * cuerpo está habituado a asumir) en la fecha evaluada.
 * - Carga alta:      > referencia + 10 %
 * - Carga muy alta:  > referencia + 20 %
 * - Carga baja:      < referencia − 20 %
 * Los porcentajes son una elección de diseño de la app (no un estándar publicado).
 */
export const LOAD_BANDS = { high: 1.1, veryHigh: 1.2, low: 0.8 } as const;

export interface WeeklyLoadThresholds {
  ctl: number;
  chronicWeeklyTss: number; // CTL × 7
  low: number;
  high: number;
  veryHigh: number;
}

/** null si aún no hay carga crónica (sin historial no se puede decir qué es "alto"). */
export function weeklyLoadThresholds(ctl: number | undefined): WeeklyLoadThresholds | null {
  if (!ctl || ctl <= 0) return null;
  const ref = ctl * 7;
  return {
    ctl,
    chronicWeeklyTss: Math.round(ref),
    low: Math.round(ref * LOAD_BANDS.low),
    high: Math.round(ref * LOAD_BANDS.high),
    veryHigh: Math.round(ref * LOAD_BANDS.veryHigh),
  };
}

/** CTL de cada fecha (todo el historial), para evaluar cada semana con la forma que había entonces. */
export function buildCtlByDate(workouts: Workout[], antHr?: number): Map<string, number> {
  return new Map(computePmcSeries(workouts, antHr).map((p) => [p.date, p.ctl]));
}

export interface LoadHistoryInfo {
  /** Primer día con entreno completado (inicio del cálculo de CTL/ATL). */
  startDate: string | null;
  days: number;
  /** 'stabilized' con ≥ 42 días (una constante de tiempo de CTL); si no, 'warming_up'. */
  status: 'stabilized' | 'warming_up' | 'none';
}

/**
 * Desde cuándo hay historial para CTL/ATL/TSB. CTL y ATL arrancan en 0 ese día,
 * así que con menos de 42 días el CTL está infravalorado frente al de Suunto,
 * que puede tener historial anterior.
 */
export function getLoadHistoryInfo(workouts: Workout[], antHr?: number, today: string = localDateKey()): LoadHistoryInfo {
  const dates = [...buildDailyLoadMap(workouts, antHr).keys()].sort();
  if (dates.length === 0) return { startDate: null, days: 0, status: 'none' };
  const start = parseDateKey(dates[0]);
  const days = Math.round((parseDateKey(today).getTime() - start.getTime()) / 86400000) + 1;
  return { startDate: dates[0], days, status: days >= CTL_DAYS ? 'stabilized' : 'warming_up' };
}

/** Texto para Miguel: cómo de fiable es el CTL/ATL/TSB actual. */
export function describeLoadHistory(info: LoadHistoryInfo): string {
  if (info.status === 'none') return 'Sin entrenos completados: no hay CTL/ATL/TSB.';
  return `CTL/ATL/TSB calculados con el TSS del historial disponible desde ${info.startDate} (${info.days} días; ${
    info.status === 'stabilized' ? 'estabilizado' : `en calentamiento: con menos de ${CTL_DAYS} días el CTL está infravalorado`
  }). Pueden diferir de los de la app de Suunto si allí hay historial anterior.`;
}

/**
 * % del tiempo por debajo del umbral aeróbico según la FC (la verdad es la FC).
 * ESTIMACIÓN con la FC media de cada entreno: Suunto no da el tiempo en cada zona de FC
 * en el resumen, así que un entreno cuenta entero como "bajo AeT" si su FC media ≤ AeT.
 * null si no hay AeT o ningún entreno completado con FC.
 */
export function hrAerobicShare(workouts: Workout[], aetHr: number | null | undefined): { pct: number | null; aerobicMin: number; trackedMin: number } {
  if (!(typeof aetHr === 'number' && aetHr > 0)) return { pct: null, aerobicMin: 0, trackedMin: 0 };
  let aerobicMin = 0;
  let trackedMin = 0;
  for (const w of workouts) {
    const dur = w.actualDurationMin || 0;
    if (!w.completed || !(dur > 0) || !(typeof w.actualAvgHr === 'number' && w.actualAvgHr > 0)) continue;
    trackedMin += dur;
    if (w.actualAvgHr <= aetHr) aerobicMin += dur;
  }
  return { pct: trackedMin > 0 ? Math.round((aerobicMin / trackedMin) * 1000) / 10 : null, aerobicMin: Math.round(aerobicMin), trackedMin: Math.round(trackedMin) };
}
