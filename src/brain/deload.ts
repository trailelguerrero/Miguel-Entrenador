/**
 * DESCARGA generada por el código (no una plantilla con cifras fijas). Aplica a
 * TUS sesiones la misma política que un día ÁMBAR del motor de readiness:
 *   - sin intensidad: series, carreras con intensidad y test → rodaje suave;
 *   - duración ×0,75 (AMBER_DURATION_FACTOR); distancia en proporción;
 *   - presupuesto mecánico de ámbar: D+ ≤ 50 %, D− ≤ 40 %, sin bajadas técnicas;
 *   - FC por debajo de tu umbral aeróbico (sin umbral, por sensaciones);
 *   - textos escritos por el código.
 * Sin sesiones planificadas, se basa en la duración real de tus rodajes recientes;
 * sin historial, no inventa nada.
 */
import type { Workout } from '../types/index.js';
import { AMBER_DURATION_FACTOR } from './readiness.js';
import { applyMechanicalBudget, easySessionText, scaleVolume } from './workoutContract.js';
import { addDaysKey } from '../utils/weekStructure.js';

export const DELOAD_DAYS = 7;
const EASY_TYPES: Workout['type'][] = ['easy_run', 'long_mountain_run'];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface DeloadResult {
  workouts: Workout[];
  /** Sesiones planificadas que se sustituyen (mismo id: se actualizan). */
  replaced: number;
  basis: 'planned' | 'recent_runs' | 'none';
  message: string;
}

/** @param aetHr umbral aeróbico por FC (techo de las sesiones de descarga). */
export function buildDeload(all: Workout[], startKey: string, aetHr?: number | null): DeloadResult {
  const aet = typeof aetHr === 'number' && aetHr > 0 ? aetHr : null;
  const fc = aet ? `FC por debajo de ${aet} ppm` : 'ritmo en el que puedas hablar';
  const endKey = addDaysKey(startKey, DELOAD_DAYS - 1);
  const planned = all.filter((w) => !w.completed && !w.suuntoWorkoutKey && w.type !== 'rest' && w.date >= startKey && w.date <= endKey);

  if (planned.length) {
    const workouts = planned.map((orig) => {
      const w: Workout = { ...orig };
      const running = w.type !== 'strength_core' && w.type !== 'cross_training';
      if (running && !EASY_TYPES.includes(w.type)) w.type = 'easy_run';
      const from = w.plannedDurationMin || 0;
      const to = Math.round(from * AMBER_DURATION_FACTOR);
      scaleVolume(w as any, from, to);
      w.plannedDurationMin = to;
      if (running) {
        // Misma política que un día ámbar: D+ ≤ 50 % y D− ≤ 40 %, sin bajadas técnicas
        applyMechanicalBudget(w as any, 'amber', orig as any);
        Object.assign(w, easySessionText(to, w.type === 'long_mountain_run' ? 'long' : 'easy', aet));
        w.targetHrMin = undefined;
        w.targetHrMax = aet ?? undefined;
        w.intensitySource = aet ? 'heart_rate_measured' : 'rpe';
      } else {
        w.targetHrMin = undefined;
        w.targetHrMax = undefined;
      }
      w.zoneSenseTarget = undefined;
      w.title = `Descarga: ${orig.title}`;
      w.description = `Semana de descarga: tu sesión "${orig.title}" al ${Math.round(AMBER_DURATION_FACTOR * 100)} % de duración y sin intensidad.`;
      w.personalizedReasoning = undefined;
      w.learnedAdjustment = undefined;
      w.plannedCarbsPerHourG = null;
      w.plannedFluidsPerHourMl = null;
      w.plannedSodiumPerHourMg = null;
      return w;
    });
    return {
      workouts,
      replaced: workouts.length,
      basis: 'planned',
      message: `He convertido tus ${workouts.length} sesiones planificadas del ${startKey} al ${endKey} en descarga: ${Math.round(AMBER_DURATION_FACTOR * 100)} % de duración, como mucho la mitad del desnivel positivo y el 40 % del negativo (sin bajadas técnicas), sin series y con ${fc}.`,
    };
  }

  // Sin plan: rodajes suaves con la duración de TUS rodajes recientes (últimos 28 días)
  const since = addDaysKey(startKey, -28);
  const recent = all
    .filter((w) => w.completed && EASY_TYPES.includes(w.type) && w.date >= since && (w.actualDurationMin ?? 0) > 0)
    .map((w) => w.actualDurationMin as number);
  if (recent.length < 3) {
    return {
      workouts: [],
      replaced: 0,
      basis: 'none',
      message: 'No hay sesiones planificadas esos días ni suficientes rodajes recientes (mínimo 3) para calcular una descarga sin inventar cifras. Genera la semana con Miguel o sincroniza Suunto.',
    };
  }
  const dur = Math.round(median(recent) * AMBER_DURATION_FACTOR);
  const stamp = Date.now();
  const workouts: Workout[] = [0, 2, 4].map((offset, i) => ({
    id: `deload-${stamp}-${i}`,
    date: addDaysKey(startKey, offset),
    title: 'Descarga: rodaje suave',
    type: 'easy_run',
    plannedDurationMin: dur,
    targetHrMax: aet ?? undefined,
    intensitySource: aet ? 'heart_rate_measured' : 'rpe',
    description: `Semana de descarga: ${Math.round(AMBER_DURATION_FACTOR * 100)} % de la duración mediana de tus ${recent.length} rodajes de las últimas 4 semanas.`,
    ...easySessionText(dur, 'easy', aet),
    completed: false,
  }));
  return {
    workouts,
    replaced: 0,
    basis: 'recent_runs',
    message: `He añadido 3 rodajes suaves de ${dur} min (${Math.round(AMBER_DURATION_FACTOR * 100)} % de la duración mediana de tus rodajes recientes) con ${fc}.`,
  };
}
