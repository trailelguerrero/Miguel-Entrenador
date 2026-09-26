// Validación DETERMINISTA de lo que devuelve la IA. El código es el que
// garantiza las reglas del cerebro de Miguel; el prompt solo las explica.
//   - La intensidad se prescribe en PULSACIONES (la FC es la verdad).
//   - Sin umbral de FC → sin pulsaciones (null), nunca inventadas.
//   - ZoneSense no se prescribe (solo sirve para analizar entrenos hechos).
//   - Nutrición numérica solo con evidencia del atleta y sin pasar de ella.
//   - Adaptaciones recortadas a los límites del motor de readiness.
import type { AthleteProfile, IntensitySource, Workout } from '../../../src/types/index.js';
import { resolveIntensityPrescription, type IntensityPrescription } from '../../../src/brain/intensity.js';
import type { ReadinessState } from '../../../src/brain/readiness.js';
import { verifyTodayReadiness } from '../context.js';
import { analyzeWeekStructure, addDaysKey, DEFAULT_WEEK_POLICY, deriveWeeklyStructurePolicy, type WeeklyStructurePolicy } from '../../../src/utils/weekStructure.js';
import { allowedTypes, applyMechanicalBudget, easySessionText, mentionsIntensity, RUN_TYPES, scaleVolume, toRest } from '../../../src/brain/workoutContract.js';

/** Evidencia nutricional real del atleta (la envía el cliente). */
export interface NutritionEvidence {
  /** Máximo de carbohidratos por hora tolerado y registrado (gut training). */
  maxCarbsPerHourG?: number | null;
  /** Tasa de sudoración medida (L/h). */
  sweatRateLph?: number | null;
  /** Perfil de pérdida de sodio declarado (cualitativo: NO basta para dar una cifra). */
  sodiumProfile?: string | null;
  /** Rango de sodio por hora VALIDADO para el atleta (test de sudor). Sin él, sodio = null. */
  sodiumRangeMgPerHour?: { min: number; max: number } | null;
}

/** Sesiones aeróbicas: su techo de FC es el umbral aeróbico. */
const AEROBIC_TYPES = new Set(['easy_run', 'long_mountain_run']);

const pos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Intensidad en pulsaciones. `ceiling` = techo de FC del motor de readiness (null = sin techo).
 */
function fixIntensity(w: any, p: IntensityPrescription, notes: string[], label: string, ceiling: number | null = null) {
  // ZoneSense no se prescribe: se analiza después, en los entrenos hechos
  w.zoneSenseTarget = undefined;
  if (w.type === 'rest') {
    w.targetHrMin = null;
    w.targetHrMax = null;
    w.intensitySource = undefined;
    return;
  }

  if (!p.hrAllowed) {
    if (w.targetHrMin != null || w.targetHrMax != null) notes.push(`${label}: se quitaron pulsaciones (no hay umbral aeróbico por FC).`);
    w.targetHrMin = null;
    w.targetHrMax = null;
    w.intensitySource = 'rpe';
    return;
  }
  const aet = p.aetHr as number;
  w.targetHrMin = pos(w.targetHrMin) ? Math.round(w.targetHrMin) : null;
  w.targetHrMax = pos(w.targetHrMax) ? Math.round(w.targetHrMax) : null;
  // Rodajes y tiradas largas: por debajo del umbral aeróbico (si no traen tope, el AeT)
  if (AEROBIC_TYPES.has(w.type)) {
    if (w.targetHrMax == null) w.targetHrMax = aet;
    else if (w.targetHrMax > aet) {
      notes.push(`${label}: tope de FC ${w.targetHrMax} bajado a tu umbral aeróbico (${aet} ppm).`);
      w.targetHrMax = aet;
    }
  }
  // Techo del día (motor de readiness)
  if (ceiling != null) {
    if (w.targetHrMax == null || w.targetHrMax > ceiling) {
      if (w.targetHrMax != null) notes.push(`${label}: tope de FC ${w.targetHrMax} bajado al máximo de hoy (${ceiling} ppm).`);
      w.targetHrMax = ceiling;
    }
    if (w.targetHrMin != null && w.targetHrMin > ceiling - 5) w.targetHrMin = null;
  }
  // Nunca por encima de tu FC máxima
  if (p.maxHr != null && w.targetHrMax != null && w.targetHrMax > p.maxHr) {
    notes.push(`${label}: tope de FC ${w.targetHrMax} por encima de tu FC máxima (${p.maxHr}): se ajusta.`);
    w.targetHrMax = p.maxHr;
  }
  if (w.targetHrMin != null && w.targetHrMax != null && w.targetHrMin >= w.targetHrMax) w.targetHrMin = null;
  w.intensitySource = 'heart_rate_measured' as IntensitySource;
}

function fixNutrition(w: any, ev: NutritionEvidence | undefined, notes: string[], label: string) {
  const clean = (field: string, max: number | null) => {
    const v = w[field];
    if (!pos(v)) {
      w[field] = null;
      return;
    }
    if (max == null) {
      notes.push(`${label}: ${field} quitado (no hay dato tuyo que lo respalde).`);
      w[field] = null;
    } else if (v > max) {
      notes.push(`${label}: ${field} ${v} limitado a tu dato registrado (${max}).`);
      w[field] = max;
    }
  };
  clean('plannedCarbsPerHourG', pos(ev?.maxCarbsPerHourG) ? ev!.maxCarbsPerHourG! : null);
  clean('plannedFluidsPerHourMl', pos(ev?.sweatRateLph) ? Math.round(ev!.sweatRateLph! * 1000) : null);
  // Sodio: SOLO dentro de un rango medido para ti. Un perfil cualitativo ("sudador salado")
  // no genera una cifra: sin rango, sodio = null.
  const range = ev?.sodiumRangeMgPerHour;
  const rangeOk = !!range && pos(range.min) && pos(range.max) && range.max >= range.min;
  if (!pos(w.plannedSodiumPerHourMg)) w.plannedSodiumPerHourMg = null;
  else if (!rangeOk) {
    notes.push(`${label}: sodio quitado (no hay un rango de sodio medido para ti).`);
    w.plannedSodiumPerHourMg = null;
  } else if (w.plannedSodiumPerHourMg < range!.min || w.plannedSodiumPerHourMg > range!.max) {
    const clamped = Math.min(range!.max, Math.max(range!.min, w.plannedSodiumPerHourMg));
    notes.push(`${label}: sodio ${w.plannedSodiumPerHourMg} ajustado a tu rango medido (${range!.min}–${range!.max} mg/h).`);
    w.plannedSodiumPerHourMg = clamped;
  }
}

/** Limpia las sesiones de un plan generado por la IA. */
export function sanitizePlanWorkouts(
  workouts: any[],
  profile: Partial<AthleteProfile> | undefined,
  weekMonday?: string,
  nutrition?: NutritionEvidence,
): { workouts: any[]; notes: string[]; structureIssues: string[] } {
  const p = resolveIntensityPrescription(profile);
  const notes: string[] = [];
  const out = (Array.isArray(workouts) ? workouts : []).map((raw, i) => {
    const w = { ...raw };
    for (const k of ['plannedDurationMin', 'plannedDistanceKm', 'plannedElevationGainM', 'plannedElevationLossM', 'targetHrMin', 'targetHrMax']) w[k] = toNumber(w[k]);
    // Contrato de descanso: sin restos de entreno
    if (w.type === 'rest') return toRest(w, 'Día de recuperación.');
    const label = w.title || w.date || `sesión ${i + 1}`;
    fixIntensity(w, p, notes, label);
    fixNutrition(w, nutrition, notes, label);
    return w;
  });
  const structureIssues = weekMonday ? analyzeWeekStructure(out as Workout[], weekMonday, deriveWeeklyStructurePolicy(profile as any)).issues : [];
  return { workouts: out, notes, structureIssues };
}

/** D+/D− de la sesión ORIGINAL (referencia del % del presupuesto mecánico), si los trae. */
function pickElevation(base: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of ['plannedElevationGainM', 'plannedElevationLossM']) {
    const v = toNumber(base?.[k]);
    if (typeof v === 'number' && v > 0) out[k] = v;
  }
  return out;
}

/** Número que la IA puede devolver como texto ("90") → número; si no, se deja tal cual. */
function toNumber(v: unknown): unknown {
  if (typeof v !== 'string' || !v.trim()) return v;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : v;
}

/**
 * Recorta una sesión adaptada al CONTRATO DE SESIÓN y a los límites del motor de
 * readiness (src/brain/workoutContract.ts). Se valida la sesión RESULTANTE (original
 * + cambios de la IA): lo que la IA no devuelve se conserva de la original y también
 * tiene que cumplir los límites. No basta con cambiar el tipo o el color: el texto,
 * la distancia, el desnivel y la nutrición tienen que casar con la sesión permitida.
 */
export function sanitizeAdaptation(
  adapted: any,
  state: ReadinessState,
  profile: Partial<AthleteProfile> | undefined,
  original?: any,
): { adapted: any; corrections: string[] } {
  const base = original && typeof original === 'object' ? original : {};
  let w: any = { ...base, ...(adapted && typeof adapted === 'object' ? adapted : {}) };
  const corrections: string[] = [];
  const l = state.limits;
  for (const k of ['plannedDurationMin', 'targetHrMin', 'targetHrMax', 'plannedDistanceKm', 'plannedElevationGainM', 'plannedElevationLossM']) w[k] = toNumber(w[k]);
  // Duración no válida de la IA → la de la sesión original (que después se recorta)
  if (!pos(w.plannedDurationMin) && w.plannedDurationMin !== 0 && pos(base.plannedDurationMin)) w.plannedDurationMin = base.plannedDurationMin;

  const allowed = allowedTypes(state);
  // 1. Descanso: obligatorio, o el que proponga la IA → contrato de descanso (sin restos de entreno)
  if (l.mandatoryRest || w.type === 'rest') {
    if (w.type !== 'rest') corrections.push('El motor de readiness exige descanso total: la sesión pasa a descanso.');
    w = toRest(w, l.mandatoryRest ? `Lo exige el estado de hoy (${state.level}).` : 'Día de recuperación.');
    return { adapted: w, corrections };
  }

  // 2. Tipo permitido por la política del nivel
  let rewrite = false;
  if (!allowed.includes(w.type)) {
    const running = RUN_TYPES.includes(w.type);
    const to = running ? 'easy_run' : 'rest';
    corrections.push(`"${w.type}" no está permitido hoy (estado ${state.level}): pasa a ${to === 'rest' ? 'descanso' : 'rodaje suave'}.`);
    if (to === 'rest') return { adapted: toRest(w, `No toca "${w.type}" con el estado de hoy (${state.level}).`), corrections };
    w.type = 'easy_run';
    rewrite = true;
  }

  // 3. Duración máxima (la distancia y el desnivel se recortan en proporción)
  if (l.maxDurationMin != null) {
    if (!pos(w.plannedDurationMin)) {
      corrections.push(`Sin duración válida: se fija el máximo de hoy (${l.maxDurationMin} min).`);
      w.plannedDurationMin = l.maxDurationMin;
    } else if (w.plannedDurationMin > l.maxDurationMin) {
      corrections.push(`Duración ${w.plannedDurationMin} min recortada al máximo de hoy (${l.maxDurationMin} min).`);
      scaleVolume(w, w.plannedDurationMin, l.maxDurationMin);
      w.plannedDurationMin = l.maxDurationMin;
    }
  }

  // 5. Textos: sin intensidad permitida, un texto de carrera que la describe se reescribe desde el código
  const texts = [w.warmup, w.mainSet, w.cooldown, w.description];
  if (!l.allowIntervals && RUN_TYPES.includes(w.type) && texts.some(mentionsIntensity)) {
    corrections.push('El texto de la sesión describía intensidad que hoy no está permitida: se reescribe.');
    rewrite = true;
  }
  if (rewrite) {
    const mode = state.level === 'red' ? 'regenerative' : w.type === 'long_mountain_run' ? 'long' : 'easy';
    const aet = resolveIntensityPrescription(profile).aetHr;
    Object.assign(w, easySessionText(w.plannedDurationMin, mode, l.maxHr ?? aet), {
      description: `Sesión ajustada por el motor de readiness (estado ${state.level}).`,
      strengthExercises: null,
      terrainRecommendation: mode === 'regenerative' ? 'Terreno llano y blando.' : null,
      // La nutrición era de la sesión original
      plannedCarbsPerHourG: null,
      plannedFluidsPerHourMl: null,
      plannedSodiumPerHourMg: null,
    });
  }
  // Presupuesto mecánico del nivel (el desnivel no se recorta en proporción al tiempo):
  // ámbar D+ ≤ 50 % y D− ≤ 40 % de lo planificado; rojo / sin datos, llano
  if (RUN_TYPES.includes(w.type)) corrections.push(...applyMechanicalBudget(w, state.level, { ...w, ...pickElevation(base) }));
  // En rojo o sin datos: sin distancia heredada
  if (state.level === 'red' || state.level === 'unknown') w.plannedDistanceKm = null;

  // 4. Intensidad en pulsaciones: techo de FC del día (en rojo, AeT − 10)
  fixIntensity(w, resolveIntensityPrescription(profile), corrections, w.title || 'Sesión adaptada', l.maxHr);
  return { adapted: w, corrections };
}

/**
 * El plan semanal también respeta el estado de HOY: si el plan trae una sesión para
 * hoy, se recorta a los límites del motor de readiness (recalculado con esa sesión).
 * `loadContext.today` es la fecha local del atleta.
 */
export function applyTodayReadinessToPlan(
  workouts: any[],
  loadContext: any,
  profile: Partial<AthleteProfile> | undefined,
): { workouts: any[]; corrections: string[] } {
  const today = typeof loadContext?.today === 'string' ? loadContext.today : null;
  const idx = today ? workouts.findIndex((w) => w?.date === today) : -1;
  if (idx < 0 || !loadContext?.todayReadinessInputs) return { workouts, corrections: [] };
  const w = workouts[idx];
  const state = verifyTodayReadiness({
    ...loadContext,
    todayReadinessInputs: { ...loadContext.todayReadinessInputs, plannedWorkout: { type: w.type, plannedDurationMin: w.plannedDurationMin } },
  });
  if (!state) return { workouts, corrections: [] };
  const { adapted, corrections } = sanitizeAdaptation(w, state, profile);
  const out = [...workouts];
  out[idx] = adapted;
  return { workouts: out, corrections: corrections.map((c) => `Hoy (${today}): ${c}`) };
}

export type PlanContractStatus = 'valid' | 'repaired' | 'rejected';

const PLAN_TYPES = new Set(['easy_run', 'long_mountain_run', 'muscular_endurance', 'hill_intervals', 'intensity_run', 'strength_core', 'drift_test', 'cross_training', 'rest']);
const isRunning = (w: any) => RUN_TYPES.includes(w?.type);

/**
 * Contrato del PLAN SEMANAL. No se guarda un plan que incumpla la estructura:
 *   - todas las fechas dentro de la semana (lunes–domingo) y tipos válidos;
 *   - como mucho una sesión de carrera por día;
 *   - 2 o 3 sesiones entre semana y UNA tirada larga en sábado o domingo, con
 *     duración, distancia y desnivel positivo (una tirada larga sin D+ no vale);
 *   - ninguna tirada larga entre semana.
 * Lo que se puede arreglar sin inventar (descansos duplicados) se REPARA; el resto
 * se RECHAZA con los motivos.
 */
export function validatePlanContract(
  workouts: any[],
  weekMonday: string,
  policy: WeeklyStructurePolicy = DEFAULT_WEEK_POLICY,
): { status: PlanContractStatus; workouts: any[]; issues: string[]; repairs: string[] } {
  const sunday = addDaysKey(weekMonday, 6);
  const issues: string[] = [];
  const repairs: string[] = [];
  let out = Array.isArray(workouts) ? [...workouts] : [];
  if (!out.length) return { status: 'rejected', workouts: out, issues: ['el plan no trae sesiones'], repairs };

  for (const w of out) {
    const label = w?.title || w?.date || 'sesión';
    if (!w?.date || w.date < weekMonday || w.date > sunday) issues.push(`"${label}" tiene una fecha fuera de la semana (${w?.date ?? 'sin fecha'})`);
    if (!PLAN_TYPES.has(w?.type)) issues.push(`"${label}" tiene un tipo no válido (${w?.type})`);
    if (w?.type !== 'rest' && !pos(w?.plannedDurationMin)) issues.push(`"${label}" no tiene duración`);
  }

  // Descansos duplicados el mismo día: se deja uno (reparación)
  const restDays = new Set<string>();
  out = out.filter((w) => {
    if (w?.type !== 'rest') return true;
    if (restDays.has(w.date)) {
      repairs.push(`descanso duplicado el ${w.date} eliminado`);
      return false;
    }
    restDays.add(w.date);
    return true;
  });
  // Un descanso y una sesión el mismo día: sobra el descanso
  const trainingDays = new Set(out.filter((w) => w?.type !== 'rest').map((w) => w.date));
  out = out.filter((w) => {
    if (w?.type === 'rest' && trainingDays.has(w.date)) {
      repairs.push(`descanso del ${w.date} eliminado (ese día hay sesión)`);
      return false;
    }
    return true;
  });

  // Como mucho una sesión de carrera por día
  const runsByDay = new Map<string, number>();
  for (const w of out.filter(isRunning)) runsByDay.set(w.date, (runsByDay.get(w.date) ?? 0) + 1);
  for (const [d, n] of runsByDay) if (n > 1) issues.push(`${n} sesiones de carrera el ${d}`);

  // Estructura (política de la semana: disponibilidad declarada) + tirada larga
  const structure = analyzeWeekStructure(out as Workout[], weekMonday, policy);
  issues.push(...structure.issues);
  const long = out.find((w) => w.type === 'long_mountain_run' && w.date === structure.longRunDate);
  if (long) {
    if (!pos(long.plannedDistanceKm)) issues.push('la tirada larga no tiene distancia');
    if (!pos(long.plannedElevationGainM)) issues.push('la tirada larga no tiene desnivel positivo');
  }

  const status: PlanContractStatus = issues.length ? 'rejected' : repairs.length ? 'repaired' : 'valid';
  return { status, workouts: out, issues, repairs };
}
