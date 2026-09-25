// Convierte lo que devuelven las tools del MCP de Suunto a los tipos de la app
// (Workout y DailyCheckIn).
import type { DailyCheckIn, Workout, WorkoutType } from '../src/types/index.js';
import { computeReadiness } from '../src/utils/readiness.js';

/** Fila de la tool `suunto_list_workouts_summary`. */
export interface SuuntoWorkoutRow {
  workoutKey: string;
  activityId: number | null;
  description: string | null;
  startTime: number;
  timeOffsetInMinutes: number;
  totalTimeSec: number | null;
  totalDistanceM: number | null;
  totalAscentM: number | null;
  totalDescentM: number | null;
  avgHR: number | null;
  maxHR: number | null;
  tss: number | null;
  energyKcal: number | null;
  timeInAerobicZoneMs: number | null;
  timeInAnaerobicZoneMs: number | null;
  timeInVo2MaxZoneMs: number | null;
  // Perfil configurado en Suunto (MCP ≥ "add profile fields")
  userMaxHR?: number | null;
  hrZoneLowerLimits?: { z2: number | null; z3: number | null; z4: number | null; z5: number | null } | null;
  zoneSenseAerobicThreshold?: number | null;
  zoneSenseAnaerobicThreshold?: number | null;
  vo2Max?: number | null;
}

/** Fila de la tool `suunto_get_sleep`. */
export interface SuuntoSleepSession {
  date: string;
  wakeDate?: string | null;
  isNap: boolean;
  durationMin: number | null;
  sleepQualityScore: number | null;
  hrMin: number | null;
  avgHRV: number | null;
}

/** Fila de la tool `suunto_get_recovery`. */
export interface SuuntoRecoveryDay {
  date: string;
  avgBalance: number | null;
  samples?: number | null;
}

// Ids de deporte de Suunto (activityId). Los confirmados con datos reales de
// esta cuenta: 1 = carrera, 10 = bici de montaña, 51 = pilates. El resto son
// los ids estándar de Suunto; cualquier id no listado cae en 'cross_training'.
const RUNNING_IDS = new Set([1, 22]); // carrera, trail running
const STRENGTH_IDS = new Set([20, 23, 51]); // gimnasio exterior, gimnasio, pilates

const SPORT_NAMES: Record<number, string> = {
  0: 'Caminata',
  1: 'Carrera',
  2: 'Ciclismo',
  10: 'Bici de montaña',
  11: 'Senderismo',
  20: 'Gimnasio exterior',
  22: 'Trail running',
  23: 'Gimnasio',
  24: 'Marcha nórdica',
  51: 'Pilates',
};

function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function localDate(startTime: number, offsetMin: number): string {
  return new Date(startTime + offsetMin * 60_000).toISOString().slice(0, 10);
}

function workoutType(row: SuuntoWorkoutRow, durationMin: number): WorkoutType {
  const id = row.activityId ?? -1;
  if (RUNNING_IDS.has(id)) {
    return durationMin > 90 || (row.totalAscentM ?? 0) > 500 ? 'long_mountain_run' : 'easy_run';
  }
  if (STRENGTH_IDS.has(id)) return 'strength_core';
  return 'cross_training';
}

export function mapSuuntoWorkouts(rows: SuuntoWorkoutRow[]): Workout[] {
  return rows.map((row) => {
    const durationMin = round((row.totalTimeSec ?? 0) / 60);
    const type = workoutType(row, durationMin);
    const sport = SPORT_NAMES[row.activityId ?? -1] ?? 'Actividad';
    const distanceKm = row.totalDistanceM ? round(row.totalDistanceM / 1000, 2) : undefined;

    const aer = row.timeInAerobicZoneMs ?? 0;
    const ana = row.timeInAnaerobicZoneMs ?? 0;
    const vo2 = row.timeInVo2MaxZoneMs ?? 0;
    const totalZoneMs = aer + ana + vo2;
    // ZoneSense: "aerobic zone" = por debajo de AeT; "anaerobic zone" = entre
    // AeT y AnT (transición); "VO2max zone" = por encima de AnT.
    const zoneSenseBreakdown =
      totalZoneMs > 0
        ? {
            aerobicPct: round((aer / totalZoneMs) * 100),
            transitionPct: round((ana / totalZoneMs) * 100),
            anaerobicPct: round((vo2 / totalZoneMs) * 100),
          }
        : undefined;

    const title = row.description?.trim() || `${sport}${distanceKm ? ` ${distanceKm} km` : ''} (Suunto)`;

    return {
      id: `suunto-${row.workoutKey}`,
      suuntoWorkoutKey: row.workoutKey,
      date: localDate(row.startTime, row.timeOffsetInMinutes),
      title,
      type,
      plannedDurationMin: durationMin,
      // Sin objetivo de intensidad: es una actividad ya hecha, no una sesión planificada
      description: `Actividad importada de Suunto (${sport}).`,
      mainSet: '',
      completed: true,
      actualDurationMin: durationMin,
      actualDistanceKm: distanceKm,
      actualElevationGainM: row.totalAscentM != null ? round(row.totalAscentM) : undefined,
      actualElevationLossM: row.totalDescentM != null ? round(row.totalDescentM) : undefined,
      actualAvgHr: row.avgHR || undefined,
      actualMaxHr: row.maxHR || undefined,
      zoneSenseBreakdown,
      actualTss: row.tss != null ? round(row.tss) : undefined,
      tss: row.tss != null ? round(row.tss) : undefined,
    } satisfies Workout;
  });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Un check-in por mañana, con la noche principal (no siestas) que termina ese día. */
export function mapSuuntoCheckIns(
  sleep: SuuntoSleepSession[],
  recovery: SuuntoRecoveryDay[],
  baselineHrv?: number,
): DailyCheckIn[] {
  const nights = new Map<string, SuuntoSleepSession>();
  for (const s of sleep) {
    if (s.isNap || !s.durationMin || s.avgHRV == null) continue;
    const morning = s.wakeDate || addDays(s.date, 1);
    const prev = nights.get(morning);
    if (!prev || (s.durationMin ?? 0) > (prev.durationMin ?? 0)) nights.set(morning, s);
  }
  if (nights.size === 0) return [];

  // Referencia: la misma HRV que se calcula para el perfil (deriveProfileFromSuunto);
  // el cliente la sustituye por la del perfil si el atleta la fijó a mano.
  const hrvs = [...nights.values()].map((s) => s.avgHRV as number);
  const hrvBaseline = baselineHrv && baselineHrv > 0 ? baselineHrv : round(hrvs.reduce((a, b) => a + b, 0) / hrvs.length, 1);
  const recoveryByDay = new Map(recovery.map((r) => [r.date, r]));

  return [...nights.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => {
      const sleepHours = round((s.durationMin ?? 0) / 60, 1);
      const hrvRmssd = s.avgHRV as number;
      const readiness = computeReadiness({ hrvRmssd, hrvBaseline, sleepHours });
      const rec = recoveryByDay.get(date);
      const balance = rec?.avgBalance;
      const balanceNote = balance != null ? ` Recovery Suunto del día: ${Math.round(balance * 100)}%.` : '';
      return {
        date,
        restingHr: s.hrMin ?? 0, // 0 = sin dato (se excluye de las medias)
        hrvRmssd,
        hrvBaseline,
        sleepHours,
        sleepQuality: s.sleepQualityScore ?? 0,
        // Puntuación = Recovery (Balance) medio del día según Suunto
        readinessScore: balance != null ? Math.round(balance * 100) : undefined,
        recoverySamples: rec?.samples ?? undefined,
        status: readiness.status,
        coachAdvice: `${readiness.coachAdvice} (Datos de Suunto: sueño ${sleepHours} h, HRV ${hrvRmssd} ms vs referencia ${hrvBaseline} ms.${balanceNote})`,
        suggestedAction: readiness.suggestedAction,
        source: 'suunto',
      } satisfies DailyCheckIn;
    });
}
