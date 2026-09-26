/**
 * Estructura semanal del plan: 3 sesiones entre semana (lunes a viernes)
 * + 1 tirada larga en sábado o domingo. Miguel puede bajar a 2 sesiones
 * entre semana por fatiga o por la disponibilidad del atleta.
 */
import type { Workout } from '../types/index.js';
import { localDateKey } from './trainingLoad.js';

export const MIDWEEK_SESSIONS_DEFAULT = 3;
export const MIDWEEK_SESSIONS_MIN = 2;

/**
 * Política de la semana: la MISMA para el prompt de Miguel y para el contrato
 * que valida el plan en código (una sola verdad).
 * La disponibilidad solo cuenta si la declaró el atleta (fieldSources = 'manual');
 * lo de Suunto es historial, no disponibilidad.
 *   sin declarar → 2-3 entre semana + larga (regla por defecto)
 *   1 día        → solo la tirada larga
 *   2 días       → 1 entre semana + larga
 *   3 días       → 2 entre semana + larga
 *   ≥ 4 días     → 2-3 entre semana + larga
 */
export interface WeeklyStructurePolicy {
  /** Días de carrera como máximo en la semana (null = sin límite declarado). */
  maxTrainingDays: number | null;
  midweekRunsMin: number;
  midweekRunsMax: number;
  longRunRequired: true;
  source: 'declared' | 'default';
}

export const DEFAULT_WEEK_POLICY: WeeklyStructurePolicy = {
  maxTrainingDays: null,
  midweekRunsMin: MIDWEEK_SESSIONS_MIN,
  midweekRunsMax: MIDWEEK_SESSIONS_DEFAULT,
  longRunRequired: true,
  source: 'default',
};

export function deriveWeeklyStructurePolicy(
  profile: { availableDaysPerWeek?: number; fieldSources?: Record<string, string | undefined> } | null | undefined,
): WeeklyStructurePolicy {
  const days = profile?.availableDaysPerWeek;
  if (!(typeof days === 'number' && days >= 1) || profile?.fieldSources?.availableDaysPerWeek !== 'manual') return DEFAULT_WEEK_POLICY;
  const d = Math.min(7, Math.round(days));
  const midweekRunsMax = Math.min(MIDWEEK_SESSIONS_DEFAULT, d - 1);
  return {
    maxTrainingDays: d,
    midweekRunsMin: Math.min(MIDWEEK_SESSIONS_MIN, midweekRunsMax),
    midweekRunsMax,
    longRunRequired: true,
    source: 'declared',
  };
}

/** La política en texto, para el prompt (lo mismo que comprueba el contrato). */
export function describeWeeklyStructurePolicy(p: WeeklyStructurePolicy): string {
  const mid = p.midweekRunsMin === p.midweekRunsMax ? `${p.midweekRunsMax}` : `${p.midweekRunsMin}-${p.midweekRunsMax}`;
  const why = p.source === 'declared' ? ` (el atleta declaró ${p.maxTrainingDays} días/semana disponibles)` : '';
  return `${mid} sesión(es) de carrera entre semana + 1 tirada larga en sábado o domingo${why}${
    p.maxTrainingDays != null ? `; como máximo ${p.maxTrainingDays} días de carrera en la semana` : ''
  }.`;
}

export interface WeekStructure {
  monday: string;
  sunday: string;
  midweekPlanned: number; // sesiones planificadas lunes-viernes
  midweekCompleted: number;
  longRunDate: string | null; // tirada larga planificada (sáb/dom)
  longRunDay: 'sábado' | 'domingo' | null;
  longRunCompleted: boolean;
  issues: string[]; // incumplimientos de la regla 3(2) + tirada larga
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function mondayOfKey(key: string): string {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}

export function addDaysKey(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** Sesiones del PLAN (no actividades importadas sueltas de Suunto, ni descanso ni fuerza). */
function isPlannedSession(w: Workout): boolean {
  if (w.type === 'rest' || w.type === 'strength_core') return false;
  return !(w.id ?? '').startsWith('suunto-');
}

export function analyzeWeekStructure(workouts: Workout[], anyDateInWeek: string, policy: WeeklyStructurePolicy = DEFAULT_WEEK_POLICY): WeekStructure {
  const monday = mondayOfKey(anyDateInWeek);
  const friday = addDaysKey(monday, 4);
  const sunday = addDaysKey(monday, 6);
  const week = (workouts || []).filter((w) => w.date >= monday && w.date <= sunday && isPlannedSession(w));

  const midweek = week.filter((w) => w.date <= friday);
  const weekendLong = week.filter((w) => w.date > friday && w.type === 'long_mountain_run');
  const longRun = weekendLong[0] ?? null;

  const issues: string[] = [];
  if (week.length > 0) {
    const why = policy.source === 'declared' ? ` con ${policy.maxTrainingDays} días disponibles` : '';
    if (midweek.length > policy.midweekRunsMax) issues.push(`${midweek.length} sesiones entre semana (máximo ${policy.midweekRunsMax}${why})`);
    if (midweek.length < policy.midweekRunsMin) issues.push(`${midweek.length} sesiones entre semana (mínimo ${policy.midweekRunsMin})`);
    const days = new Set(week.map((w) => w.date)).size;
    if (policy.maxTrainingDays != null && days > policy.maxTrainingDays) issues.push(`${days} días de entreno (máximo ${policy.maxTrainingDays}${why})`);
    if (weekendLong.length === 0) issues.push('sin tirada larga en sábado o domingo');
    if (weekendLong.length > 1) issues.push('más de una tirada larga el fin de semana');
    const midweekLong = midweek.filter((w) => w.type === 'long_mountain_run').length;
    if (midweekLong > 0) issues.push('tirada larga entre semana');
  }

  return {
    monday,
    sunday,
    midweekPlanned: midweek.length,
    midweekCompleted: midweek.filter((w) => w.completed).length,
    longRunDate: longRun?.date ?? null,
    longRunDay: longRun ? (parseKey(longRun.date).getDay() === 6 ? 'sábado' : 'domingo') : null,
    longRunCompleted: !!longRun?.completed,
    issues,
  };
}
