// Calcula los datos del perfil del atleta a partir de lo que registra Suunto,
// con reglas fijas (sin IA): lo que no se puede medir no se devuelve.
// Suunto no expone peso, altura ni edad, así que esos siguen siendo manuales.
import type { SuuntoProfileField, SuuntoProfileSuggestion } from '../src/types/index.js';
import type { SuuntoSleepSession, SuuntoWorkoutRow } from './suunto-map.js';

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

export function deriveProfileFromSuunto(
  workouts: SuuntoWorkoutRow[],
  sleep: SuuntoSleepSession[],
  now = Date.now(),
): SuuntoProfileSuggestion {
  const values: SuuntoProfileSuggestion['values'] = {};
  const evidence: Partial<Record<SuuntoProfileField, string>> = {};
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

  // Umbrales: ZoneSense si Suunto los calculó; si no, tus zonas de FC de Suunto.
  const zsAet = recentFirst.find((w) => validHr(w.zoneSenseAerobicThreshold))?.zoneSenseAerobicThreshold;
  const zsAnt = recentFirst.find((w) => validHr(w.zoneSenseAnaerobicThreshold))?.zoneSenseAnaerobicThreshold;
  // Las zonas del reloj son por deporte (en carrera no son las mismas que en
  // pilates o bici): se usan las del último entreno de CARRERA.
  const zones = recentFirst.find(
    (w) => RUNNING_IDS.has(w.activityId ?? -1) && w.hrZoneLowerLimits && validHr(w.hrZoneLowerLimits.z3),
  )?.hrZoneLowerLimits;
  if (validHr(zsAet)) {
    values.aetHr = Math.round(zsAet);
    evidence.aetHr = 'Umbral aeróbico medido por Suunto ZoneSense (DFA a1).';
  } else if (zones && validHr(zones.z3)) {
    values.aetHr = zones.z3;
    evidence.aetHr = `Inicio de tu Zona 3 de FC para carrera en Suunto (${zones.z3} bpm).`;
  }
  if (validHr(zsAnt)) {
    values.antHr = Math.round(zsAnt);
    evidence.antHr = 'Umbral anaeróbico medido por Suunto ZoneSense (DFA a1).';
  } else if (zones && validHr(zones.z5)) {
    values.antHr = zones.z5;
    evidence.antHr = `Inicio de tu Zona 5 de FC para carrera en Suunto (${zones.z5} bpm).`;
  }
  if (values.aetHr && values.antHr && values.antHr > values.aetHr) {
    const spread = values.antHr - values.aetHr;
    // Misma regla que la ficha del atleta (AthleteProfileModal)
    values.hasAds = spread > 20 || spread / values.antHr > 0.1;
    evidence.hasAds = `Diferencia AeT–AnT de ${spread} bpm (${Math.round((spread / values.antHr) * 100)}%). ADS si > 20 bpm o > 10%.`;
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

  return { values, evidence };
}
