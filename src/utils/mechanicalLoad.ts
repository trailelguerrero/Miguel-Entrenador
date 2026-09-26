/**
 * CARGA MECÁNICA A PIE (descriptiva). Solo datos medidos, sin índice combinado:
 * D−, D+, km y horas a pie de los últimos 7 días frente a la media semanal de las
 * 4 semanas ANTERIORES (sin solaparse, como el ACWR desacoplado).
 *
 * No decide nada (decisión del atleta): no cambia el nivel de readiness ni el
 * presupuesto mecánico. Es contexto para la app y para Miguel.
 *
 * Cuentan las actividades a pie: carrera, trail, senderismo, caminata y marcha
 * nórdica (activityId de Suunto). La bici no: su D− no carga las piernas igual.
 * El ratio solo se da si hubo actividad a pie en ≥ 3 de las 4 semanas previas.
 */
import type { Workout } from '../types/index.js';
import { localDateKey } from './trainingLoad.js';

/** activityId de Suunto a pie: caminata, carrera, senderismo, trail, marcha nórdica. */
export const ON_FOOT_ACTIVITY_IDS = new Set([0, 1, 11, 22, 24]);
const RUN_TYPES = new Set(['easy_run', 'long_mountain_run', 'intensity_run', 'hill_intervals', 'muscular_endurance', 'drift_test']);
export const MIN_COMPARABLE_WEEKS = 3;

/** ¿Actividad completada a pie? Sin deporte de Suunto, solo cuentan los tipos de carrera. */
export function isOnFoot(w: Workout): boolean {
  if (!w.completed) return false;
  if (typeof w.suuntoActivityId === 'number') return ON_FOOT_ACTIVITY_IDS.has(w.suuntoActivityId);
  return RUN_TYPES.has(w.type);
}

export interface MechanicalTotals {
  descentM: number;
  ascentM: number;
  km: number;
  hours: number;
}

export interface MechanicalMetric {
  last7: number;
  /** Media semanal de las 4 semanas previas (null si no es comparable). */
  priorWeeklyAvg: number | null;
  /** last7 / priorWeeklyAvg (null si no es comparable o la media es 0). */
  ratio: number | null;
}

export interface MechanicalLoadSummary {
  from: string;
  to: string;
  descent: MechanicalMetric;
  ascent: MechanicalMetric;
  km: MechanicalMetric;
  hours: MechanicalMetric;
  /** Semanas con actividad a pie de las 4 previas. */
  priorWeeksWithActivity: number;
  comparable: boolean;
  activities7d: number;
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + n));
}

function totals(ws: Workout[]): MechanicalTotals {
  const t = { descentM: 0, ascentM: 0, km: 0, hours: 0 };
  for (const w of ws) {
    t.descentM += w.actualElevationLossM ?? 0;
    t.ascentM += w.actualElevationGainM ?? 0;
    t.km += w.actualDistanceKm ?? 0;
    t.hours += (w.actualDurationMin ?? 0) / 60;
  }
  return t;
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeMechanicalLoad(workouts: Workout[], today: string = localDateKey()): MechanicalLoadSummary {
  const onFoot = (workouts || []).filter(isOnFoot);
  const inRange = (from: string, to: string) => onFoot.filter((w) => w.date >= from && w.date <= to);
  const from = addDays(today, -6);
  const last = totals(inRange(from, today));
  const weeks = [0, 1, 2, 3].map((k) => inRange(addDays(today, -13 - 7 * k), addDays(today, -7 - 7 * k)));
  const priorWeeksWithActivity = weeks.filter((w) => w.length > 0).length;
  const comparable = priorWeeksWithActivity >= MIN_COMPARABLE_WEEKS;
  const prior = totals(weeks.flat());
  const metric = (v: number, p: number, round: (n: number) => number): MechanicalMetric => {
    const avg = comparable ? round(p / 4) : null;
    return { last7: round(v), priorWeeklyAvg: avg, ratio: avg != null && avg > 0 ? Math.round((v / (p / 4)) * 100) / 100 : null };
  };
  return {
    from,
    to: today,
    descent: metric(last.descentM, prior.descentM, r0),
    ascent: metric(last.ascentM, prior.ascentM, r0),
    km: metric(last.km, prior.km, r1),
    hours: metric(last.hours, prior.hours, r1),
    priorWeeksWithActivity,
    comparable,
    activities7d: inRange(from, today).length,
  };
}

const fmtRatio = (r: number | null) => (r == null ? '' : ` · ${r.toFixed(2).replace('.', ',')}×`);

/** Una cifra: "D− 2100 m (media previa 1300 m/sem · 1,62×)". */
export function describeMetric(label: string, m: MechanicalMetric, unit: string): string {
  return m.priorWeeklyAvg == null ? `${label} ${m.last7} ${unit}` : `${label} ${m.last7} ${unit} (media previa ${m.priorWeeklyAvg} ${unit}/sem${fmtRatio(m.ratio)})`;
}

/** Texto para Miguel: contexto, nunca un límite. */
export function describeMechanicalLoad(s: MechanicalLoadSummary): string {
  const parts = [
    describeMetric('D−', s.descent, 'm'),
    describeMetric('D+', s.ascent, 'm'),
    describeMetric('distancia', s.km, 'km'),
    describeMetric('tiempo', s.hours, 'h'),
  ].join('; ');
  const hist = s.comparable
    ? 'comparado con la media semanal de las 4 semanas anteriores'
    : `sin historial suficiente para comparar (actividad a pie en ${s.priorWeeksWithActivity} de las 4 semanas previas; hacen falta ${MIN_COMPARABLE_WEEKS})`;
  return `Carga mecánica a pie de los últimos 7 días (${s.activities7d} actividades; ${hist}): ${parts}. Es contexto para explicar, NO un límite: no cambia el estado de readiness ni el desnivel permitido.`;
}
