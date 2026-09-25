/**
 * Contexto calculado en el CLIENTE (donde viven los datos) y enviado a Miguel.
 * Todo lo que aquí aparece son hechos calculados de forma determinista; la IA
 * no los recalcula.
 */
import type { AthleteProfile, DailyCheckIn, Workout } from '../types';
import {
  computePmcSeries,
  getLoadHistoryInfo,
  getWorkoutLoad,
  localDateKey,
  weeklyLoadThresholds,
  type LoadHistoryInfo,
} from '../utils/trainingLoad.js';
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
}

export interface BrainContext {
  ctl?: number;
  atl?: number;
  tsb?: number;
  weeklyTss?: number;
  loadHistory: LoadHistoryInfo;
  recentCheckIns: BrainCheckInSummary[];
  /** Estado de hoy según el motor de readiness (null si no hay check-in de hoy). */
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
): BrainContext {
  const series = computePmcSeries(workouts, profile.antHr);
  const latest = series[series.length - 1];
  const today = localDateKey();
  const since = addDays(today, -6);
  const weeklyTss = Math.round(
    workouts.filter((w) => w.date >= since && w.date <= today).reduce((a, w) => a + (getWorkoutLoad(w, profile.antHr)?.tss ?? 0), 0),
  );
  const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));
  const todayCi = sorted.find((c) => c.date === today) ?? null;

  const todayReadinessInputs: TodayReadinessInputs | null = todayCi
    ? {
        hrvRmssd: todayCi.hrvRmssd,
        hrvBaseline: profile.baselineHrv || todayCi.hrvBaseline,
        sleepHours: todayCi.sleepHours,
        muscleSoreness: todayCi.muscleSoreness,
        stressLevel: todayCi.stressLevel,
        recoveryPct: todayCi.readinessScore,
        plannedWorkout: plannedToday ? { type: plannedToday.type, plannedDurationMin: plannedToday.plannedDurationMin } : null,
      }
    : null;
  const todayReadiness = todayReadinessInputs
    ? evaluateReadiness({ ...todayReadinessInputs, tsb: latest?.tsb, weeklyTss, weeklyThresholds: weeklyLoadThresholds(latest?.ctl) })
    : null;

  return {
    ctl: latest?.ctl,
    atl: latest?.atl,
    tsb: latest?.tsb,
    weeklyTss,
    loadHistory: getLoadHistoryInfo(workouts, profile.antHr),
    recentCheckIns: sorted.slice(-7).map((c) => ({
      date: c.date,
      hrvRmssd: c.hrvRmssd,
      hrvBaseline: c.hrvBaseline,
      sleepHours: c.sleepHours,
      recoveryPct: c.readinessScore,
      status: c.status,
      fromSuunto: c.source === 'suunto',
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
      /** 'suunto' = TSS REAL de Suunto; 'estimated' = calculado por fórmula. */
      tssSource: w.completed ? getWorkoutLoad(w, antHr)?.source : undefined,
    }));
}
