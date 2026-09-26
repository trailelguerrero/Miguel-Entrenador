/**
 * CONTRATO DE SESIÓN (determinista). Qué sesiones son posibles según el estado
 * del día y qué forma tiene que tener una sesión válida. Lo usan el servidor
 * (adaptar sesión, plan semanal) y el cliente (descarga): una sola fuente.
 *
 * Política por nivel del motor de readiness:
 *   VERDE        → cualquier sesión
 *   ÁMBAR        → rodaje suave, fuerza, cruzado, tirada larga (recortada al máximo del día), descanso
 *   ROJO         → rodaje regenerativo o descanso
 *   SIN DATOS    → rodaje suave o descanso
 *   DESCANSO OBL.→ solo descanso
 *
 * Lo que no cabe en la política se transforma en la sesión permitida más
 * parecida y SUS TEXTOS SE REESCRIBEN desde el código: la IA no puede dejar
 * "6×5 min fuertes" en el texto de un rodaje regenerativo.
 */
import type { WorkoutType } from '../types/index.js';
import type { ReadinessLevel, ReadinessState } from './readiness.js';

export const POLICY_ALLOWED_TYPES: Record<ReadinessLevel, readonly WorkoutType[]> = {
  green: ['easy_run', 'long_mountain_run', 'muscular_endurance', 'hill_intervals', 'intensity_run', 'strength_core', 'drift_test', 'cross_training', 'rest'],
  amber: ['easy_run', 'long_mountain_run', 'strength_core', 'cross_training', 'rest'],
  red: ['easy_run', 'rest'],
  unknown: ['easy_run', 'rest'],
};

/** Tipos permitidos hoy (con descanso obligatorio, solo 'rest'). */
export function allowedTypes(state: Pick<ReadinessState, 'level' | 'limits'>): readonly WorkoutType[] {
  return state.limits.mandatoryRest ? ['rest'] : POLICY_ALLOWED_TYPES[state.level];
}

/** Campos que describen un entrenamiento: un descanso no puede tener ninguno. */
const TRAINING_FIELDS = [
  'plannedDistanceKm',
  'plannedElevationGainM',
  'targetHrMin',
  'targetHrMax',
  'plannedCarbsPerHourG',
  'plannedFluidsPerHourMl',
  'plannedSodiumPerHourMg',
  'warmup',
  'mainSet',
  'cooldown',
  'terrainRecommendation',
  'nutritionAdvice',
  'strengthExercises',
  'zoneSenseTarget',
  'intensitySource',
] as const;

/** Un descanso es imposible de leer como entrenamiento: sin duración, distancia, desnivel, intensidad, nutrición ni textos de sesión. */
export function toRest(w: Record<string, any>, reason: string): Record<string, any> {
  const out: Record<string, any> = { ...w, type: 'rest', plannedDurationMin: 0 };
  for (const f of TRAINING_FIELDS) out[f] = null;
  out.mainSet = `Descanso total. ${reason}`;
  return out;
}

/**
 * Palabras que describen intensidad en un texto libre. Si la política no permite
 * intensidad y el texto las contiene, el texto se reescribe desde el código.
 */
const INTENSITY_TEXT = /\b(series?|intervalos?|repeticiones?|fartlek|tempo|umbral anaer[oó]bico|por encima (del|de tu) (umbral|aet)|vo2|fuerte|fuertes|r[aá]pid[oa]s?|a tope|m[aá]ximo|sprints?|cambios? de ritmo|progresiv[oa]s?|amarillo|rojo|z[3-5]\b|zona [3-5])|\d+\s*[x×]\s*\d+/i;

export const mentionsIntensity = (text: unknown): boolean => typeof text === 'string' && INTENSITY_TEXT.test(text);

export type EasyMode = 'regenerative' | 'easy' | 'long';

/**
 * Texto de una sesión suave escrito por el código, en PULSACIONES.
 * @param maxHr techo de FC de la sesión (AeT, o AeT − 10 en rojo). Sin él, por sensaciones.
 */
export function easySessionText(minutes: number, mode: EasyMode, maxHr?: number | null): { warmup: string; mainSet: string; cooldown: string } {
  const fc = typeof maxHr === 'number' && maxHr > 0 ? `FC por debajo de ${maxHr} ppm` : 'ritmo en el que puedas hablar sin esfuerzo (sin umbral de FC en tu perfil)';
  const mainSet = {
    regenerative: `${minutes} min de trote regenerativo en terreno llano, muy cómodo: ${fc}. Sin cuestas ni cambios de ritmo.`,
    easy: `${minutes} min de rodaje suave: ${fc}. Sin cambios de ritmo.`,
    long: `${minutes} min de tirada continua y suave en montaña: ${fc}; camina las rampas en las que no puedas mantenerla. Sin cambios de ritmo.`,
  }[mode];
  return { warmup: '5–10 min caminando o trotando muy suave.', mainSet, cooldown: '5 min caminando.' };
}

/** Tipos de carrera (se les audita el texto cuando no se permite intensidad). */
export const RUN_TYPES: readonly WorkoutType[] = ['easy_run', 'long_mountain_run', 'intensity_run', 'hill_intervals', 'muscular_endurance', 'drift_test'];

/** Cuando se recorta la duración, la distancia y el desnivel se recortan en la misma proporción. */
export function scaleVolume(w: Record<string, any>, fromMin: number, toMin: number): void {
  if (!(fromMin > 0) || !(toMin >= 0) || toMin >= fromMin) return;
  const r = toMin / fromMin;
  if (typeof w.plannedDistanceKm === 'number') w.plannedDistanceKm = Math.round(w.plannedDistanceKm * r * 10) / 10;
  if (typeof w.plannedElevationGainM === 'number') w.plannedElevationGainM = Math.round(w.plannedElevationGainM * r);
}
