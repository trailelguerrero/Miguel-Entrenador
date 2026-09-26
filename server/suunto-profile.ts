// Calcula los datos del perfil del atleta a partir de lo que registra Suunto,
// con reglas fijas (sin IA): lo que no se puede medir no se devuelve.
// Suunto no expone peso, altura ni edad, así que esos siguen siendo manuales.
import type { SuuntoProfileField, SuuntoProfileSuggestion } from '../src/types/index.js';
import type { SuuntoSleepSession, SuuntoWorkoutRow } from './suunto-map.js';
import { hasAerobicDeficiency } from '../src/utils/uphillAthlete.js';

const DAY_MS = 24 * 3600 * 1000;
const RUNNING_IDS = new Set([1, 22]); // carrera, trail running

const validHr = (v: number | null | undefined): v is number => typeof v === 'number' && v >= 30 && v <= 240;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Fecha local (YYYY-MM-DD) y día de la semana (0 = domingo) del workout. */
function localDay(w: SuuntoWorkoutRow): { date: string; weekday: number } {
  const d = new Date(w.startTime + w.timeOffsetInMinutes * 60_000);
  return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

/** Lunes (YYYY-MM-DD) de la semana del workout. */
function weekKey(w: SuuntoWorkoutRow): string {
  const d = new Date(w.startTime + w.timeOffsetInMinutes * 60_000);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Porcentajes de FC máx de las zonas de FÁBRICA de Suunto (inicio de Z2, Z3, Z4 y Z5). */
export const SUUNTO_DEFAULT_ZONE_PCT = { z2: 0.72, z3: 0.77, z4: 0.82, z5: 0.87 } as const;

/**
 * ¿Son las zonas de fábrica del reloj (un % fijo de la FC máx)? Entonces Z3 y Z5 no
 * son umbrales medidos: son una fórmula genérica y no se pueden usar como AeT/AnT.
 */
export function isDefaultSuuntoZones(
  zones: { z2: number | null; z3: number | null; z4: number | null; z5: number | null } | null | undefined,
  maxHr: number | null | undefined,
): boolean {
  if (!zones || !validHr(maxHr)) return false;
  return (Object.keys(SUUNTO_DEFAULT_ZONE_PCT) as (keyof typeof SUUNTO_DEFAULT_ZONE_PCT)[]).every((k) => {
    const v = zones[k];
    return validHr(v) && Math.abs(v - maxHr * SUUNTO_DEFAULT_ZONE_PCT[k]) <= 1;
  });
}

export function deriveProfileFromSuunto(
  workouts: SuuntoWorkoutRow[],
  sleep: SuuntoSleepSession[],
  now = Date.now(),
): SuuntoProfileSuggestion {
  const values: SuuntoProfileSuggestion['values'] = {};
  const evidence: Partial<Record<SuuntoProfileField, string>> = {};
  const cleared: SuuntoProfileField[] = [];
  const recentFirst = [...workouts].sort((a, b) => b.startTime - a.startTime);

  // FC máxima: la configurada en el reloj; si no, la mayor registrada.
  const userMax = recentFirst.find((w) => validHr(w.userMaxHR))?.userMaxHR;
  if (validHr(userMax)) {
    values.maxHr = userMax;
    evidence.maxHr = 'FC máxima configurada en tu Suunto.';
  } else {
    const observed = workouts.map((w) => w.maxHR).filter(validHr);
    if (observed.length) {
      values.maxHr = Math.max(...observed);
      evidence.maxHr = `La FC más alta registrada en ${observed.length} entrenos de los últimos 90 días.`;
    }
  }

  // Umbrales: las ZONAS DE FC de tu reloj Suunto (la FC es la verdad). El umbral que
  // detecta ZoneSense es solo una sugerencia: se muestra, nunca se aplica solo.
  const zsAet = recentFirst.find((w) => validHr(w.zoneSenseAerobicThreshold))?.zoneSenseAerobicThreshold;
  const zsAnt = recentFirst.find((w) => validHr(w.zoneSenseAnaerobicThreshold))?.zoneSenseAnaerobicThreshold;
  // Las zonas del reloj son por deporte (en carrera no son las mismas que en
  // pilates o bici): se usan las del último entreno de CARRERA.
  const zones = recentFirst.find(
    (w) => RUNNING_IDS.has(w.activityId ?? -1) && w.hrZoneLowerLimits && validHr(w.hrZoneLowerLimits.z3),
  )?.hrZoneLowerLimits;
  const runMax = recentFirst.find((w) => RUNNING_IDS.has(w.activityId ?? -1) && validHr(w.userMaxHR))?.userMaxHR ?? values.maxHr;
  // Zonas de fábrica = % fijo de la FC máx: NO son umbrales tuyos (como 220 − edad).
  // No se usan como AeT/AnT ni para diagnosticar ADS.
  const factoryZones = isDefaultSuuntoZones(zones, runMax);
  const zsNote = (v: number | null | undefined) => (validHr(v) ? ` ZoneSense sugiere ${Math.round(v)} ppm (solo sugerencia; si quieres usarlo, cámbialo en tu reloj o fíjalo a mano).` : '');
  if (factoryZones) {
    cleared.push('aetHr');
  } else if (zones && validHr(zones.z3)) {
    values.aetHr = zones.z3;
    evidence.aetHr = `Inicio de tu Zona 3 de FC para carrera en tu reloj Suunto (${zones.z3} ppm).${zsNote(zsAet)}`;
  }
  if (factoryZones) {
    cleared.push('antHr');
  } else if (zones && validHr(zones.z5)) {
    values.antHr = zones.z5;
    evidence.antHr = `Inicio de tu Zona 5 de FC para carrera en tu reloj Suunto (${zones.z5} ppm).${zsNote(zsAnt)}`;
  }
  if (factoryZones) {
    const why = `Tus zonas de FC de carrera en Suunto son las de fábrica (${Object.values(SUUNTO_DEFAULT_ZONE_PCT).map((x) => `${Math.round(x * 100)} %`).join(', ')} de tu FC máx ${runMax}): no son umbrales tuyos. Configura tus zonas de FC en la app de Suunto (o fija el AeT a mano; el test de deriva de 60 min te ayuda a encontrarlo).`;
    if (!values.aetHr) evidence.aetHr = `${why}${zsNote(zsAet)}`;
    if (!values.antHr) evidence.antHr = `${why}${zsNote(zsAnt)}`;
  }
  if (factoryZones && !values.aetHr) cleared.push('hasAds');
  if (values.aetHr && values.antHr && values.antHr > values.aetHr) {
    const spread = values.antHr - values.aetHr;
    // Misma regla que la ficha, la guía y el test (hasAerobicDeficiency)
    values.hasAds = hasAerobicDeficiency(values.aetHr, values.antHr) === true;
    evidence.hasAds = `Diferencia AeT–AnT de ${spread} bpm (${Math.round((spread / values.antHr) * 100)}%). ADS si el AeT está más de un 10 % por debajo del AnT.`;
  }

  // Sueño: FC en reposo (mediana de la FC mínima nocturna) y HRV de referencia.
  const nights = sleep.filter((s) => !s.isNap && (s.durationMin ?? 0) >= 180);
  const hrMins = nights.map((s) => s.hrMin).filter(validHr);
  if (hrMins.length >= 3) {
    values.restingHr = Math.round(median(hrMins));
    evidence.restingHr = `Mediana de tu FC mínima nocturna en ${hrMins.length} noches.`;
  }
  const hrvs = nights.map((s) => s.avgHRV).filter((v): v is number => typeof v === 'number' && v > 0);
  if (hrvs.length >= 3) {
    values.baselineHrv = Math.round((hrvs.reduce((a, b) => a + b, 0) / hrvs.length) * 10) / 10;
    evidence.baselineHrv = `Media de tu HRV nocturna en ${hrvs.length} noches.`;
  }

  // VO2máx estimado por Suunto
  const vo2 = recentFirst.find((w) => typeof w.vo2Max === 'number' && w.vo2Max > 10)?.vo2Max;
  if (vo2) {
    values.vo2Max = Math.round(vo2 * 10) / 10;
    evidence.vo2Max = 'VO2máx estimado por tu Suunto en el último entreno que lo calculó.';
  }

  // Volumen y días de entreno: últimas 4 semanas
  const last28 = workouts.filter((w) => w.startTime >= now - 28 * DAY_MS);
  if (last28.length) {
    const hours = last28.reduce((a, w) => a + (w.totalTimeSec ?? 0), 0) / 3600 / 4;
    values.currentWeeklyVolumeHours = Math.round(hours * 2) / 2;
    evidence.currentWeeklyVolumeHours = `${last28.length} entrenos en las últimas 4 semanas (${hours.toFixed(1)} h/semana de media).`;

    const daysPerWeek = new Set(last28.map((w) => localDay(w).date)).size / 4;
    values.availableDaysPerWeek = Math.min(7, Math.max(1, Math.round(daysPerWeek)));
    evidence.availableDaysPerWeek = `Entrenaste ${daysPerWeek.toFixed(1)} días por semana de media en las últimas 4 semanas.`;
  }

  // Día de tirada larga: el de la carrera más larga de cada semana (90 días)
  const longestByWeek = new Map<string, SuuntoWorkoutRow>();
  for (const w of workouts) {
    if (!RUNNING_IDS.has(w.activityId ?? -1) || !w.totalTimeSec) continue;
    const k = weekKey(w);
    const prev = longestByWeek.get(k);
    if (!prev || (w.totalTimeSec ?? 0) > (prev.totalTimeSec ?? 0)) longestByWeek.set(k, w);
  }
  let sat = 0;
  let sun = 0;
  for (const w of longestByWeek.values()) {
    const wd = localDay(w).weekday;
    if (wd === 6) sat++;
    if (wd === 0) sun++;
  }
  if (sat + sun > 0 && sat !== sun) {
    values.preferredLongRunDay = sat > sun ? 'saturday' : 'sunday';
    const times = (n: number) => `${n} ${n === 1 ? 'vez' : 'veces'}`;
    evidence.preferredLongRunDay = `Tu carrera más larga de la semana cayó en sábado ${times(sat)} y en domingo ${times(sun)} (últimos 90 días).`;
  }

  return cleared.length ? { values, evidence, cleared } : { values, evidence };
}
