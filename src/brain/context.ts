/**
 * Contexto calculado en el CLIENTE (donde viven los datos) y enviado a Miguel.
 * Todo lo que aquí aparece son hechos calculados de forma determinista; la IA
 * no los recalcula.
 */
import type { AthleteProfile, DailyCheckIn, Workout } from '../types/index.js';
import {
  computePmcSeries,
  getLoadHistoryInfo,
  getWorkoutLoad,
  localDateKey,
  weeklyLoadThresholds,
  windowLoad,
  type LoadHistoryInfo,
} from '../utils/trainingLoad.js';
import { resolveIntensityPrescription } from './intensity.js';
import { evaluateReadiness, type ReadinessState, type TodayReadinessInputs } from './readiness.js';

export interface BrainCheckInSummary {
  date: string;
  hrvRmssd: number;
  hrvBaseline: number;
  sleepHours: number;
  recoveryPct?: number;
  status: string;
  /** true si HRV/sueño vienen de Suunto (dato REAL); si no, los declaró el atleta. */
  fromSuunto: boolean;
  /** "Siestas" de Suunto que terminaron ese día (no sumadas al sueño). */
  napMinutes?: number;
}

export interface BrainContext {
  /** Fecha local del atleta (YYYY-MM-DD): el servidor no conoce su zona horaria. */
  today: string;
  ctl?: number;
  atl?: number;
  tsb?: number;
  weeklyTss?: number;
  /** Parte del TSS de 7 días que no es medida (estimada por la app o asignada por Suunto). */
  weeklyNonMeasuredTss?: number;
  loadHistory: LoadHistoryInfo;
  recentCheckIns: BrainCheckInSummary[];
  /** Estado de hoy según el motor de readiness (sin check-in: solo con la carga → 'unknown' o más estricto). */
  todayReadiness: ReadinessState | null;
  /** Datos crudos de hoy con los que el servidor recalcula (y verifica) todayReadiness. */
  todayReadinessInputs: TodayReadinessInputs | null;
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + n));
}

export function buildBrainContext(
  workouts: Workout[],
  profile: AthleteProfile,
  checkIns: DailyCheckIn[],
  plannedToday?: Workout | null,
  /** Fecha del atleta (el servidor la pasa: en Vercel el reloj está en UTC). */
  today: string = localDateKey(),
): BrainContext {
  // Solo el umbral anaeróbico MEDIDO (Suunto/manual) sirve para estimar hrTSS
  const antHr = resolveIntensityPrescription(profile).antHr ?? undefined;
  const series = computePmcSeries(workouts, antHr, undefined, today);
  const latest = series[series.length - 1];
  const week = windowLoad(workouts, addDays(today, -6), today, antHr);
  const weeklyTss = week.tss;
  const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));
  const todayCi = sorted.find((c) => c.date === today) ?? null;

  // Sin check-in de hoy también se evalúa: la carga (TSB, TSS de 7 días) puede
  // bastar para subir el nivel, y sin datos de recuperación no se permiten series.
  // Umbral aeróbico por FC (zonas del reloj o fijado a mano): de él salen los techos de FC
  const aetHr = resolveIntensityPrescription(profile).aetHr;
  const planned = plannedToday ? { type: plannedToday.type, plannedDurationMin: plannedToday.plannedDurationMin } : null;
  const todayReadinessInputs: TodayReadinessInputs | null = todayCi
    ? {
        hrvRmssd: todayCi.hrvRmssd,
        hrvBaseline: profile.baselineHrv || todayCi.hrvBaseline,
        sleepHours: todayCi.sleepHours,
        muscleSoreness: todayCi.muscleSoreness,
        stressLevel: todayCi.stressLevel,
        recoveryPct: todayCi.readinessScore,
        plannedWorkout: planned,
        aetHr,
      }
    : { plannedWorkout: planned, aetHr };
  const todayReadiness = evaluateReadiness({
    ...todayReadinessInputs,
    tsb: latest?.tsb,
    weeklyTss,
    weeklyNonMeasuredTss: week.nonMeasuredTss,
    weeklyThresholds: weeklyLoadThresholds(latest?.ctl),
  });

  return {
    today,
    ctl: latest?.ctl,
    atl: latest?.atl,
    tsb: latest?.tsb,
    weeklyTss,
    weeklyNonMeasuredTss: week.nonMeasuredTss,
    loadHistory: getLoadHistoryInfo(workouts, antHr, today),
    recentCheckIns: sorted.slice(-7).map((c) => ({
      date: c.date,
      hrvRmssd: c.hrvRmssd,
      hrvBaseline: c.hrvBaseline,
      sleepHours: c.sleepHours,
      recoveryPct: c.readinessScore,
      status: c.status,
      fromSuunto: c.source === 'suunto',
      ...(c.napMinutes ? { napMinutes: c.napMinutes } : {}),
    })),
    todayReadiness,
    todayReadinessInputs,
  };
}

/** Resumen de las sesiones de una semana (hechas, planificadas, adaptadas) para el plan. */
export function summarizeWeekWorkouts(workouts: Workout[], monday: string, antHr?: number) {
  const sunday = addDays(monday, 6);
  return workouts
    .filter((w) => w.date >= monday && w.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({
      date: w.date,
      title: w.title,
      type: w.type,
      status: w.completed ? 'hecha' : w.date < localDateKey() ? 'no hecha' : 'planificada',
      adapted: !!w.wasAdapted,
      fromSuunto: !!w.suuntoWorkoutKey,
      durationMin: w.completed ? w.actualDurationMin : w.plannedDurationMin,
      tss: w.completed ? getWorkoutLoad(w, antHr)?.tss : undefined,
      /** 'suunto' = TSS medido por Suunto; 'suunto_assigned' = valor fijo de Suunto (añadida a mano); 'estimated' = fórmula de la app. */
      tssSource: w.completed ? getWorkoutLoad(w, antHr)?.source : undefined,
    }));
}
