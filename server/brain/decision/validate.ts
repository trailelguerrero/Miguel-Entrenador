// Validación DETERMINISTA de lo que devuelve la IA. El código es el que
// garantiza las reglas del cerebro de Miguel; el prompt solo las explica.
//   - Sin umbral de FC medido → sin pulsaciones (null), nunca inventadas.
//   - Objetivos ZoneSense siempre canónicos (colores).
//   - Nutrición numérica solo con evidencia del atleta y sin pasar de ella.
//   - Adaptaciones recortadas a los límites del motor de readiness.
import type { AthleteProfile, IntensitySource, Workout } from '../../../src/types/index.js';
import { resolveIntensityPrescription, type IntensityPrescription } from '../../../src/brain/intensity.js';
import { normalizeZoneSenseTarget, TARGET_COLOR, colorRank } from '../../../src/brain/zonesense.js';
import type { ReadinessState } from '../../../src/brain/readiness.js';
import { analyzeWeekStructure } from '../../../src/utils/weekStructure.js';

/** Evidencia nutricional real del atleta (la envía el cliente). */
export interface NutritionEvidence {
  /** Máximo de carbohidratos por hora tolerado y registrado (gut training). */
  maxCarbsPerHourG?: number | null;
  /** Tasa de sudoración medida (L/h). */
  sweatRateLph?: number | null;
  /** Perfil de pérdida de sodio declarado. */
  sodiumProfile?: string | null;
}

const VALID_SOURCES: IntensitySource[] = ['zonesense', 'heart_rate_measured', 'rpe', 'terrain', 'unknown'];
const INTERVAL_TYPES = new Set(['hill_intervals', 'muscular_endurance']);

const pos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function fixIntensity(w: any, p: IntensityPrescription, notes: string[], label: string) {
  if (w.type === 'rest') {
    w.targetHrMin = null;
    w.targetHrMax = null;
    w.zoneSenseTarget = undefined;
    w.intensitySource = undefined;
    return;
  }
  const target = normalizeZoneSenseTarget(w.zoneSenseTarget);
  w.zoneSenseTarget = target;

  if (!p.hrAllowed) {
    if (w.targetHrMin != null || w.targetHrMax != null) notes.push(`${label}: se quitaron pulsaciones (no hay umbral de FC medido).`);
    w.targetHrMin = null;
    w.targetHrMax = null;
  } else {
    w.targetHrMin = pos(w.targetHrMin) ? Math.round(w.targetHrMin) : null;
    w.targetHrMax = pos(w.targetHrMax) ? Math.round(w.targetHrMax) : null;
    // En sesiones verdes/regenerativas el tope de FC no puede pasar del umbral aeróbico medido
    if (target && TARGET_COLOR[target] === 'green' && w.targetHrMax != null && w.targetHrMax > (p.aetHr as number)) {
      notes.push(`${label}: tope de FC ${w.targetHrMax} bajado a tu umbral aeróbico medido (${p.aetHr}).`);
      w.targetHrMax = p.aetHr;
    }
    if (w.targetHrMin != null && w.targetHrMax != null && w.targetHrMin > w.targetHrMax) w.targetHrMin = null;
  }

  let src: IntensitySource | undefined = VALID_SOURCES.includes(w.intensitySource) ? w.intensitySource : undefined;
  if (src === 'heart_rate_measured' && !p.hrAllowed) src = undefined;
  if (src === 'zonesense' && !target) src = undefined;
  w.intensitySource = src ?? (target ? 'zonesense' : p.hrAllowed && w.targetHrMax != null ? 'heart_rate_measured' : 'rpe');
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
  // Sodio: solo con tasa de sudoración medida y perfil de sal declarado; sin tope numérico propio
  const sodiumOk = pos(ev?.sweatRateLph) && !!ev?.sodiumProfile;
  if (!sodiumOk && pos(w.plannedSodiumPerHourMg)) notes.push(`${label}: sodio quitado (falta tasa de sudoración o perfil de sal).`);
  if (!sodiumOk || !pos(w.plannedSodiumPerHourMg)) w.plannedSodiumPerHourMg = null;
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
    const label = w.title || w.date || `sesión ${i + 1}`;
    fixIntensity(w, p, notes, label);
    fixNutrition(w, nutrition, notes, label);
    return w;
  });
  const structureIssues = weekMonday ? analyzeWeekStructure(out as Workout[], weekMonday).issues : [];
  return { workouts: out, notes, structureIssues };
}

/** Número que la IA puede devolver como texto ("90") → número; si no, se deja tal cual. */
function toNumber(v: unknown): unknown {
  if (typeof v !== 'string' || !v.trim()) return v;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : v;
}

/**
 * Recorta una sesión adaptada a los límites del motor de readiness. Se valida la
 * sesión RESULTANTE (original + cambios de la IA): lo que la IA no devuelve se
 * conserva de la original y también tiene que cumplir los límites.
 */
export function sanitizeAdaptation(
  adapted: any,
  state: ReadinessState,
  profile: Partial<AthleteProfile> | undefined,
  original?: any,
): { adapted: any; corrections: string[] } {
  const base = original && typeof original === 'object' ? original : {};
  const w = { ...base, ...(adapted && typeof adapted === 'object' ? adapted : {}) };
  const corrections: string[] = [];
  const l = state.limits;
  for (const k of ['plannedDurationMin', 'targetHrMin', 'targetHrMax']) w[k] = toNumber(w[k]);
  // Duración no válida de la IA → la de la sesión original (que después se recorta)
  if (!pos(w.plannedDurationMin) && w.plannedDurationMin !== 0 && pos(base.plannedDurationMin)) w.plannedDurationMin = base.plannedDurationMin;

  if (l.mandatoryRest) {
    if (w.type !== 'rest') corrections.push('El motor de readiness exige descanso total: la sesión pasa a descanso.');
    Object.assign(w, { type: 'rest', plannedDurationMin: 0, targetHrMin: null, targetHrMax: null, zoneSenseTarget: undefined });
  } else {
    if (!l.allowIntervals && INTERVAL_TYPES.has(w.type)) {
      corrections.push(`Sin series hoy (estado ${state.level}): "${w.type}" pasa a rodaje suave.`);
      w.type = 'easy_run';
    }
    if (l.maxDurationMin != null && w.type !== 'rest') {
      if (!pos(w.plannedDurationMin)) {
        corrections.push(`Sin duración válida: se fija el máximo de hoy (${l.maxDurationMin} min).`);
        w.plannedDurationMin = l.maxDurationMin;
      } else if (w.plannedDurationMin > l.maxDurationMin) {
        corrections.push(`Duración ${w.plannedDurationMin} min recortada al máximo de hoy (${l.maxDurationMin} min).`);
        w.plannedDurationMin = l.maxDurationMin;
      }
    }
    const target = normalizeZoneSenseTarget(w.zoneSenseTarget);
    if (w.type !== 'rest' && (!target || colorRank(TARGET_COLOR[target]) > colorRank(l.maxZoneSense))) {
      const fallback = state.level === 'red' ? 'Regenerativo (verde, muy suave)' : 'ZoneSense verde (aeróbico)';
      if (target) corrections.push(`Intensidad "${target}" por encima de lo permitido hoy: pasa a "${fallback}".`);
      w.zoneSenseTarget = fallback;
    }
  }
  fixIntensity(w, resolveIntensityPrescription(profile), corrections, w.title || 'Sesión adaptada');
  return { adapted: w, corrections };
}
