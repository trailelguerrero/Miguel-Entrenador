/**
 * FUSIÓN DE UNA SINCRONIZACIÓN CON SUUNTO (pura, sin localStorage). La usan el
 * servidor (sincronización diaria y botón Sincronizar) y el cliente cuando
 * trabaja sin servidor: una sola fuente para las reglas.
 *
 * - Workouts: se salta un workoutKey ya importado (se refrescan sus datos
 *   medidos); si ese día hay una sesión planificada sin completar del mismo
 *   deporte, se completa con los datos reales; si no, se añade.
 * - Check-ins: lo MEDIDO (HRV, sueño, Recovery) lo pone Suunto; lo que solo sabe
 *   el atleta (dolor y estrés) se conserva.
 * - Perfil: Suunto rellena sus campos sin pisar los manuales; aviso de zonas del
 *   reloj; banda de pecho si hubo ZoneSense en los últimos 30 días.
 */
import type { AthleteProfile, DailyCheckIn, SuuntoProfileSuggestion, WatchZoneAdvice, WatchZoneRecommendation, Workout, ZoneAdviceStatus } from '../types/index.js';
import { rebaseSuuntoCheckIn } from '../utils/readiness.js';
import { applySuuntoProfile, type ProfileChange } from '../utils/suuntoProfile.js';
import { resolveIntensityPrescription } from './intensity.js';

/** Deporte de una sesión, para saber si un entreno de Suunto completa lo planificado. */
export function sportGroup(type: Workout['type'] | undefined): 'run' | 'strength' | 'other' {
  if (type === 'strength_core') return 'strength';
  if (type === 'easy_run' || type === 'intensity_run' || type === 'long_mountain_run' || type === 'muscular_endurance' || type === 'hill_intervals' || type === 'drift_test') return 'run';
  return 'other';
}

/**
 * La FC es la verdad: un rodaje corto importado de Suunto (≤ 90 min, ≤ 500 m D+) con la
 * FC media POR ENCIMA de tu umbral aeróbico fue una sesión con intensidad. Sin FC o sin
 * AeT se queda como está. (Estimación con la FC media: Suunto no da el tiempo en cada
 * zona de FC en el resumen.)
 */
export function classifyRunByHr<T extends Pick<Workout, 'type' | 'actualAvgHr'>>(w: T, aetHr: number | null | undefined): T {
  if (!(typeof aetHr === 'number' && aetHr > 0) || !(typeof w.actualAvgHr === 'number' && w.actualAvgHr > 0)) return w;
  if (w.type === 'easy_run' || w.type === 'intensity_run') {
    const type: Workout['type'] = w.actualAvgHr > aetHr ? 'intensity_run' : 'easy_run';
    return type === w.type ? w : { ...w, type };
  }
  return w;
}

export interface MergeSummary {
  addedWorkouts: number;
  completedPlanned: number;
  checkInsAdded: number;
}

/** Workouts: devuelve la lista nueva (no muta la de entrada). */
export function mergeSuuntoWorkouts(current: Workout[], suuntoIn: Workout[], aetHr?: number | null): { workouts: Workout[]; addedWorkouts: number; completedPlanned: number } {
  const workouts = current.map((w) => ({ ...w }));
  const suuntoWorkouts = suuntoIn.map((w) => classifyRunByHr(w, aetHr));
  const byKey = new Map(workouts.filter((w) => w.suuntoWorkoutKey).map((w) => [w.suuntoWorkoutKey as string, w]));
  let addedWorkouts = 0;
  let completedPlanned = 0;

  // Datos medidos por Suunto (se copian siempre, también al re-sincronizar,
  // para recoger cambios como un TSS o una duración editados en Suunto).
  const measured = (sw: Workout) => ({
    completed: true,
    suuntoWorkoutKey: sw.suuntoWorkoutKey,
    date: sw.date,
    actualDurationMin: sw.actualDurationMin,
    actualDistanceKm: sw.actualDistanceKm,
    actualElevationGainM: sw.actualElevationGainM,
    actualElevationLossM: sw.actualElevationLossM,
    actualAvgHr: sw.actualAvgHr,
    actualMaxHr: sw.actualMaxHr,
    actualTss: sw.actualTss,
    tss: sw.tss,
    suuntoManualEntry: sw.suuntoManualEntry,
    suuntoActivityId: sw.suuntoActivityId,
    suuntoSport: sw.suuntoSport,
  });

  for (const sw of suuntoWorkouts) {
    if (!sw.suuntoWorkoutKey) continue;
    const existing = byKey.get(sw.suuntoWorkoutKey);
    if (existing) {
      Object.assign(existing, measured(sw), { zoneSenseBreakdown: sw.zoneSenseBreakdown ?? existing.zoneSenseBreakdown });
      // Entreno creado por la importación: versiones anteriores le ponían un
      // objetivo ZoneSense ficticio a cualquier actividad; su tipo lo decide lo que pasó.
      if (existing.id === `suunto-${sw.suuntoWorkoutKey}`) {
        existing.zoneSenseTarget = undefined;
        existing.type = sw.type;
      }
      continue;
    }
    // Solo completa la sesión planificada de ese día si es del mismo deporte
    const planned = workouts.find(
      (w) => w.date === sw.date && !w.completed && !w.suuntoWorkoutKey && w.type !== 'rest' && sportGroup(w.type) === sportGroup(sw.type),
    );
    if (planned) {
      Object.assign(planned, measured(sw), { zoneSenseBreakdown: sw.zoneSenseBreakdown ?? planned.zoneSenseBreakdown, intensityFactor: undefined });
      byKey.set(sw.suuntoWorkoutKey, planned);
      completedPlanned++;
    } else {
      const added = { ...sw };
      workouts.push(added);
      byKey.set(sw.suuntoWorkoutKey, added);
      addedWorkouts++;
    }
  }
  return { workouts, addedWorkouts, completedPlanned };
}

/** Check-ins (uno por fecha, más reciente primero). keepSubjective=false en modo prueba. */
export function mergeSuuntoCheckIns(
  current: DailyCheckIn[],
  suuntoCheckIns: DailyCheckIn[],
  profileBaseline: number,
  keepSubjective = true,
): { checkIns: DailyCheckIn[]; checkInsAdded: number } {
  const byDate = new Map(current.map((c) => [c.date, c]));
  let checkInsAdded = 0;
  for (const rawCi of suuntoCheckIns) {
    const existing = byDate.get(rawCi.date);
    const subjective = existing && keepSubjective ? { muscleSoreness: existing.muscleSoreness, stressLevel: existing.stressLevel } : {};
    const ci = rebaseSuuntoCheckIn({ ...rawCi, ...subjective }, profileBaseline);
    if (!existing) checkInsAdded++;
    byDate.set(ci.date, ci);
  }
  return { checkIns: [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)), checkInsAdded };
}

function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Diferencia mínima (ppm) entre tu AeT fijado y el inicio de Z3 del reloj para recomendar cambiarla. */
export const DRIFT_MIN_DIFF_BPM = 3;

export const zoneAdviceKey = (r: Pick<WatchZoneRecommendation, 'field' | 'suggested'>) => `${r.field}:${r.suggested ?? '-'}`;

/**
 * Señal "test de deriva / AeT fijado a mano": si tu AeT es tuyo (manual) y el inicio de
 * Z3 de tu reloj se separa ≥ 3 ppm, conviene cambiar Z3 en Suunto para que el reloj
 * te avise a las mismas pulsaciones que usa Miguel.
 */
export function driftZoneRecommendation(profile: AthleteProfile, advice: WatchZoneAdvice | undefined): WatchZoneRecommendation | null {
  const aet = profile.aetHr;
  const z3 = advice?.watch?.zones?.z3;
  if (profile.fieldSources?.aetHr !== 'manual' || !(typeof aet === 'number' && aet > 0) || !(typeof z3 === 'number' && z3 > 0)) return null;
  if (Math.abs(aet - z3) < DRIFT_MIN_DIFF_BPM) return null;
  return {
    field: 'aetHr',
    label: 'Umbral aeróbico (inicio Z3)',
    current: z3,
    suggested: aet,
    direction: aet > z3 ? 'up' : 'down',
    source: 'drift',
    evidence: `Tu umbral aeróbico fijado por ti${profile.driftTestResultPct != null ? ` (test de deriva: ${profile.driftTestResultPct} %)` : ''} es ${aet} ppm, pero tu reloj empieza la Z3 en ${z3} ppm. Cambia Z3 a ${aet} para que el reloj te avise a las mismas pulsaciones que usa Miguel.`,
  };
}

/**
 * Estado de las recomendaciones: las nuevas entran como pendientes, las que ya estaban
 * conservan su estado (hecho / ignorado / ya anunciado) y las que ya no aparecen se quitan.
 */
export function updateZoneAdviceState(
  prev: Record<string, ZoneAdviceStatus> | undefined,
  recs: WatchZoneRecommendation[],
  nowIso: string,
): Record<string, ZoneAdviceStatus> {
  const out: Record<string, ZoneAdviceStatus> = {};
  for (const r of recs) {
    const k = zoneAdviceKey(r);
    out[k] = prev?.[k] ?? { status: 'pending', firstSeen: nowIso };
  }
  return out;
}

/** Recomendaciones pendientes (y, con onlyUnannounced, las que Miguel aún no te ha contado). */
export function pendingZoneAdvice(profile: Pick<AthleteProfile, 'watchZoneAdvice' | 'zoneAdviceState'>, onlyUnannounced = false): WatchZoneRecommendation[] {
  const state = profile.zoneAdviceState || {};
  return (profile.watchZoneAdvice?.recommendations || []).filter((r) => {
    const st = state[zoneAdviceKey(r)];
    return st?.status === 'pending' && (!onlyUnannounced || !st.announcedAt);
  });
}

export interface SuuntoPayload {
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  profileFromSuunto?: SuuntoProfileSuggestion;
  watchZoneAdvice?: WatchZoneAdvice;
}

export interface SuuntoMergeResult extends MergeSummary {
  profile: AthleteProfile;
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  profileChanges: ProfileChange[];
  /** Recomendaciones de zonas del reloj que no estaban antes. */
  freshZoneAdvice: WatchZoneAdvice['recommendations'];
}

/** Sincronización completa: perfil → check-ins (con la HRV de referencia nueva) → workouts. */
export function mergeSuuntoSyncData(
  state: { profile: AthleteProfile; workouts: Workout[]; checkIns: DailyCheckIn[] },
  payload: SuuntoPayload,
  today: string,
): SuuntoMergeResult {
  let profile = state.profile;
  let profileChanges: ProfileChange[] = [];
  if (payload.profileFromSuunto) {
    const r = applySuuntoProfile(profile, payload.profileFromSuunto);
    profile = r.profile;
    profileChanges = r.changed;
  }
  let freshZoneAdvice: WatchZoneAdvice['recommendations'] = [];
  if (payload.watchZoneAdvice) {
    // Señales del servidor (FC máx., tendencia ZoneSense, zonas de fábrica) + tu AeT fijado frente a Z3
    const drift = driftZoneRecommendation(profile, payload.watchZoneAdvice);
    const advice: WatchZoneAdvice = { ...payload.watchZoneAdvice, recommendations: [...payload.watchZoneAdvice.recommendations, ...(drift ? [drift] : [])] };
    profile = { ...profile, watchZoneAdvice: advice, zoneAdviceState: updateZoneAdviceState(profile.zoneAdviceState, advice.recommendations, new Date().toISOString()) };
    freshZoneAdvice = pendingZoneAdvice(profile, true);
  }

  // Umbral aeróbico del perfil ya actualizado (zonas del reloj, o el tuyo si lo fijaste a mano)
  const aet = resolveIntensityPrescription(profile).aetHr;
  const w = mergeSuuntoWorkouts(state.workouts, payload.workouts || [], aet);
  const c = mergeSuuntoCheckIns(state.checkIns, payload.checkIns || [], profile.baselineHrv || 0);

  // Banda de pecho (precisión de la FC): ZoneSense en los últimos 30 días → la llevas (lo manual no se toca)
  const since30 = addDaysKey(today, -30);
  const zsRecent = (payload.workouts || []).some((x) => x.date >= since30 && !!x.zoneSenseBreakdown);
  if (zsRecent && profile.hasChestStrapSource !== 'manual' && profile.hasChestStrap !== true) {
    profile = { ...profile, hasChestStrap: true, hasChestStrapSource: 'suunto' };
  }

  return {
    profile,
    workouts: w.workouts,
    checkIns: c.checkIns,
    addedWorkouts: w.addedWorkouts,
    completedPlanned: w.completedPlanned,
    checkInsAdded: c.checkInsAdded,
    profileChanges,
    freshZoneAdvice,
  };
}
