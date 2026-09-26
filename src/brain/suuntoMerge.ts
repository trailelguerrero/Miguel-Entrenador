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
import type { AthleteProfile, DailyCheckIn, SuuntoProfileSuggestion, WatchZoneAdvice, Workout } from '../types/index.js';
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
    const prev = new Set((profile.watchZoneAdvice?.recommendations || []).map((r) => `${r.field}:${r.suggested}`));
    freshZoneAdvice = payload.watchZoneAdvice.recommendations.filter((r) => !prev.has(`${r.field}:${r.suggested}`));
    profile = { ...profile, watchZoneAdvice: payload.watchZoneAdvice };
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
