/**
 * Estructura semanal del plan: 3 sesiones entre semana (lunes a viernes)
 * + 1 tirada larga en sábado o domingo. Miguel puede bajar a 2 sesiones
 * entre semana por fatiga o por la disponibilidad del atleta.
 */
import type { Workout } from '../types/index.js';
import { localDateKey } from './trainingLoad.js';

export const MIDWEEK_SESSIONS_DEFAULT = 3;
export const MIDWEEK_SESSIONS_MIN = 2;

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

export function analyzeWeekStructure(workouts: Workout[], anyDateInWeek: string): WeekStructure {
  const monday = mondayOfKey(anyDateInWeek);
  const friday = addDaysKey(monday, 4);
  const sunday = addDaysKey(monday, 6);
  const week = (workouts || []).filter((w) => w.date >= monday && w.date <= sunday && isPlannedSession(w));

  const midweek = week.filter((w) => w.date <= friday);
  const weekendLong = week.filter((w) => w.date > friday && w.type === 'long_mountain_run');
  const longRun = weekendLong[0] ?? null;

  const issues: string[] = [];
  if (week.length > 0) {
    if (midweek.length > MIDWEEK_SESSIONS_DEFAULT) issues.push(`${midweek.length} sesiones entre semana (máximo ${MIDWEEK_SESSIONS_DEFAULT})`);
    if (midweek.length < MIDWEEK_SESSIONS_MIN) issues.push(`${midweek.length} sesiones entre semana (mínimo ${MIDWEEK_SESSIONS_MIN})`);
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
