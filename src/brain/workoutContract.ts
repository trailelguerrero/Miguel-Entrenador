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
  'plannedElevationLossM',
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

/**
 * Cuando se recorta la duración, la DISTANCIA se recorta en la misma proporción.
 * El desnivel NO: en trail la carga mecánica (subida, sobre todo bajada) no escala
 * con el tiempo; lo limita el presupuesto mecánico del nivel (applyMechanicalBudget).
 */
export function scaleVolume(w: Record<string, any>, fromMin: number, toMin: number): void {
  if (!(fromMin > 0) || !(toMin >= 0) || toMin >= fromMin) return;
  const r = toMin / fromMin;
  if (typeof w.plannedDistanceKm === 'number') w.plannedDistanceKm = Math.round(w.plannedDistanceKm * r * 10) / 10;
}

/**
 * PRESUPUESTO MECÁNICO por nivel de readiness (decisión del atleta):
 *   ámbar           → D+ ≤ 50 % y D− ≤ 40 % de lo planificado, sin bajadas técnicas
 *   rojo / sin datos → 0 m de desnivel, terreno llano
 *   verde           → sin tope
 * Sin D− planificado se toma el D+ como referencia (ruta circular: baja lo que sube).
 */
export const AMBER_GAIN_FACTOR = 0.5;
export const AMBER_LOSS_FACTOR = 0.4;

export interface MechanicalBudget {
  maxElevationGainM: number | null;
  maxElevationLossM: number | null;
  technicalDescents: boolean;
  flatOnly: boolean;
}

export function mechanicalBudget(level: ReadinessLevel, planned: { plannedElevationGainM?: unknown; plannedElevationLossM?: unknown }): MechanicalBudget {
  if (level === 'red' || level === 'unknown') return { maxElevationGainM: 0, maxElevationLossM: 0, technicalDescents: false, flatOnly: true };
  if (level !== 'amber') return { maxElevationGainM: null, maxElevationLossM: null, technicalDescents: true, flatOnly: false };
  const gain = typeof planned.plannedElevationGainM === 'number' && planned.plannedElevationGainM > 0 ? planned.plannedElevationGainM : 0;
  const lossRef = typeof planned.plannedElevationLossM === 'number' && planned.plannedElevationLossM > 0 ? planned.plannedElevationLossM : gain;
  return {
    maxElevationGainM: Math.round(gain * AMBER_GAIN_FACTOR),
    maxElevationLossM: Math.round(lossRef * AMBER_LOSS_FACTOR),
    technicalDescents: false,
    flatOnly: false,
  };
}

/**
 * Aplica el presupuesto a la sesión (sin subirlo nunca: si ya trae menos, se queda).
 * `planned` = la sesión original (referencia del %). Devuelve las correcciones.
 */
export function applyMechanicalBudget(w: Record<string, any>, level: ReadinessLevel, planned: Record<string, any> = w): string[] {
  const b = mechanicalBudget(level, planned);
  const notes: string[] = [];
  if (b.flatOnly) {
    if ((typeof w.plannedElevationGainM === 'number' && w.plannedElevationGainM > 0) || (typeof w.plannedElevationLossM === 'number' && w.plannedElevationLossM > 0)) {
      notes.push(`Sin desnivel hoy (estado ${level}): terreno llano.`);
    }
    w.plannedElevationGainM = null;
    w.plannedElevationLossM = null;
    w.terrainRecommendation = 'Terreno llano y blando, sin cuestas ni bajadas.';
    return notes;
  }
  if (b.maxElevationGainM == null) return notes;
  const cap = (field: 'plannedElevationGainM' | 'plannedElevationLossM', max: number, label: string) => {
    const cur = typeof w[field] === 'number' ? w[field] : null;
    if (cur == null) {
      // Sin D− en la sesión: se fija el tope para que quede explícito
      if (field === 'plannedElevationLossM' && max > 0) w[field] = max;
      return;
    }
    if (cur > max) {
      notes.push(`${label} ${cur} m recortado a ${max} m (estado ${level}).`);
      w[field] = max;
    }
  };
  cap('plannedElevationGainM', b.maxElevationGainM, 'D+');
  cap('plannedElevationLossM', b.maxElevationLossM!, 'D−');
  if (b.maxElevationGainM > 0 || (b.maxElevationLossM ?? 0) > 0) {
    const limits = `como mucho ${w.plannedElevationGainM ?? 0} m de D+ y ${w.plannedElevationLossM ?? 0} m de D−`;
    const prev = typeof w.terrainRecommendation === 'string' && w.terrainRecommendation.trim() ? `${w.terrainRecommendation.trim()} ` : '';
    w.terrainRecommendation = `${prev}Hoy ${limits}, sin bajadas técnicas: bajadas cortas y tendidas, caminando si hace falta.`;
  } else {
    w.terrainRecommendation = 'Terreno llano o con muy poca pendiente, sin bajadas técnicas.';
  }
  return notes;
}
