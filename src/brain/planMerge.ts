/**
 * Guardar un plan semanal: las sesiones nuevas sustituyen SOLO a las planificadas
 * sin completar de esos días. Nunca se borran entrenos hechos ni actividades de
 * Suunto. Lo usan el botón (App) y el plan automático del domingo (servidor).
 */
import type { Workout } from '../types/index.js';
import { addDaysKey } from '../utils/weekStructure.js';

export interface MergedPlan {
  workouts: Workout[];
  /** Sesiones nuevas que se han guardado. */
  added: Workout[];
  /** Ids de sesiones planificadas que se han sustituido. */
  replacedIds: string[];
  /** Títulos de sesiones descartadas por fecha inválida o pasada. */
  dropped: string[];
}

export function mergePlanIntoWorkouts(
  existing: Workout[],
  planned: Partial<Workout>[],
  monday: string,
  fromDate: string = monday,
  stamp: number = Date.now(),
): MergedPlan {
  const sunday = addDaysKey(monday, 6);
  const used = new Set(planned.map((w) => w.date).filter((d): d is string => !!d && d >= fromDate && d <= sunday));
  const dropped: string[] = [];
  const added: Workout[] = planned.flatMap((w, index) => {
    let date = w.date;
    // Días ya pasados de la semana en curso: no se planifican
    if (date && date >= monday && date < fromDate) {
      dropped.push(w.title || date);
      return [];
    }
    // Fecha fuera de la semana: se usa el día de su posición solo si está libre
    if (!(date && date >= fromDate && date <= sunday)) {
      const byPosition = index <= 6 ? addDaysKey(monday, index) : null;
      if (!byPosition || byPosition < fromDate || used.has(byPosition)) {
        dropped.push(w.title || w.date || `sesión ${index + 1}`);
        return [];
      }
      date = byPosition;
      used.add(date);
    }
    return [{ ...(w as Workout), id: `gen-${date}-${stamp}-${index}`, date, completed: false }];
  });
  const newDates = new Set(added.map((w) => w.date));
  const replacedIds: string[] = [];
  const kept = existing.filter((ex) => {
    const keep = ex.completed || !!ex.suuntoWorkoutKey || !newDates.has(ex.date);
    if (!keep) replacedIds.push(ex.id);
    return keep;
  });
  return { workouts: [...kept, ...added], added, replacedIds, dropped };
}
