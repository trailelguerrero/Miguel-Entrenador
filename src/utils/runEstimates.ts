/**
 * Estimación de distancia y desnivel de una sesión planificada a partir de
 * TUS carreras reales completadas (Suunto o registradas), no de valores fijos.
 *
 * - Ritmo: km totales / tiempo total de las carreras usadas.
 * - Desnivel: metros D+ totales / tiempo total (m por minuto).
 * - Modo 'hilly' (sesiones en cuesta o terreno quebrado): usa solo la mitad
 *   de tus carreras con más desnivel por minuto.
 * Ventana: últimas 12 semanas; si no hay carreras ahí, todo el historial.
 * Solo carreras de duración parecida a la sesión (½× a 2×), si hay ≥ 3.
 */
import { Workout } from '../types';
import { localDateKey } from './trainingLoad';

export interface RunEstimate {
  distanceKm: number;
  elevationGainM: number;
  runsUsed: number;
  paceMinPerKm: number;
  ascentMPerHour: number;
  windowLabel: string;
}

const RUN_TYPES = new Set(['easy_run', 'long_mountain_run']);

function isUsableRun(w: Workout): boolean {
  return (
    w.completed &&
    RUN_TYPES.has(w.type) &&
    (w.actualDurationMin ?? 0) > 0 &&
    (w.actualDistanceKm ?? 0) > 0
  );
}

export function estimateFromRecentRuns(
  workouts: Workout[],
  durationMin: number,
  mode: 'all' | 'hilly' = 'all',
): RunEstimate | null {
  const since = new Date();
  since.setDate(since.getDate() - 84);
  const sinceKey = localDateKey(since);
  const allRuns = (workouts || []).filter(isUsableRun);
  let runs = allRuns.filter((w) => w.date >= sinceKey);
  let windowLabel = 'últimas 12 semanas';
  if (runs.length === 0) {
    runs = allRuns;
    windowLabel = 'todo tu historial';
  }
  if (runs.length === 0) return null;

  // Solo carreras de duración parecida (entre la mitad y el doble de la
  // sesión): las jornadas largas de montaña, con paradas y caminata, no
  // representan el ritmo de una sesión de 45-75 min.
  const similar = runs.filter((w) => (w.actualDurationMin as number) >= durationMin * 0.5 && (w.actualDurationMin as number) <= durationMin * 2);
  let durationLabel = '';
  if (similar.length >= 3) {
    runs = similar;
    durationLabel = `de ${Math.round(durationMin * 0.5)}-${durationMin * 2} min`;
  }

  if (mode === 'hilly' && runs.length >= 2) {
    const rate = (w: Workout) => (w.actualElevationGainM ?? 0) / (w.actualDurationMin as number);
    const sorted = [...runs].sort((a, b) => rate(b) - rate(a));
    runs = sorted.slice(0, Math.ceil(sorted.length / 2));
  }

  const minutes = runs.reduce((a, w) => a + (w.actualDurationMin as number), 0);
  const km = runs.reduce((a, w) => a + (w.actualDistanceKm as number), 0);
  const gain = runs.reduce((a, w) => a + (w.actualElevationGainM ?? 0), 0);
  const kmPerMin = km / minutes;
  const gainPerMin = gain / minutes;

  return {
    distanceKm: Math.round(kmPerMin * durationMin * 10) / 10,
    elevationGainM: Math.round((gainPerMin * durationMin) / 10) * 10,
    runsUsed: runs.length,
    paceMinPerKm: Math.round((minutes / km) * 100) / 100,
    ascentMPerHour: Math.round(gainPerMin * 60),
    windowLabel: [durationLabel, windowLabel, mode === 'hilly' ? 'mitad con más desnivel' : ''].filter(Boolean).join(', '),
  };
}

/** Ritmo en formato m:ss /km */
export function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s === 60 ? 0 : s).padStart(2, '0')} /km`;
}
