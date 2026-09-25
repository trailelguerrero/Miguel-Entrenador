// Aviso para cambiar las zonas de FC configuradas en el reloj Suunto.
//
// Regla principal: SOLO se recomienda un cambio cuando hay una TENDENCIA
// sostenida en el tiempo, nunca por el dato de un único día/entreno.
// Se usan solo entrenos de carrera (las zonas del reloj son por deporte).
//
// Criterios (elección de diseño de la app, no un estándar publicado):
// - FC máxima: ≥ 3 carreras en las últimas 12 semanas, repartidas en ≥ 2
//   semanas distintas, con FC máx por encima de la configurada. Se propone
//   el segundo valor más alto (se descarta el pico mayor por si es un
//   artefacto del sensor). A la baja no se puede deducir: una carrera suave
//   no demuestra que la FC máx haya bajado.
// - Umbral aeróbico / anaeróbico: ZoneSense NO equivale a una FC fija (se mide
//   contra la línea base de cada entreno), pero registra la FC a la que detectó
//   cada umbral ESE día. Esa FC varía de un día a otro; solo su tendencia de
//   semanas sirve para ajustar las zonas de FC del reloj, que son la
//   referencia de respaldo cuando no se lleva banda. Criterio: ≥ 4 lecturas en las últimas
//   4 semanas y ≥ 4 en las 4 anteriores; la mediana de AMBOS periodos debe
//   separarse del valor del reloj en el mismo sentido y ≥ 3 ppm.
import type { SuuntoWorkoutRow } from './suunto-map.js';
import { isDefaultSuuntoZones } from './suunto-profile.js';
import type { WatchZoneAdvice, WatchZoneRecommendation } from '../src/types/index.js';

const DAY_MS = 24 * 3600 * 1000;
const RUNNING_IDS = new Set([1, 22]);
const MIN_DIFF_BPM = 3;

const validHr = (v: number | null | undefined): v is number => typeof v === 'number' && v >= 30 && v <= 240;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function isoWeek(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function dateOf(w: SuuntoWorkoutRow): string {
  return new Date(w.startTime + w.timeOffsetInMinutes * 60_000).toISOString().slice(0, 10);
}

function thresholdTrend(
  runs: SuuntoWorkoutRow[],
  pick: (w: SuuntoWorkoutRow) => number | null | undefined,
  current: number,
  now: number,
): { recent: number; previous: number; nRecent: number; nPrev: number } | null {
  const recent = runs.filter((w) => w.startTime >= now - 28 * DAY_MS).map(pick).filter(validHr);
  const previous = runs
    .filter((w) => w.startTime < now - 28 * DAY_MS && w.startTime >= now - 56 * DAY_MS)
    .map(pick)
    .filter(validHr);
  if (recent.length < 4 || previous.length < 4) return null;
  const mr = Math.round(median(recent));
  const mp = Math.round(median(previous));
  const dr = mr - current;
  const dp = mp - current;
  if (Math.abs(dr) < MIN_DIFF_BPM || Math.abs(dp) < MIN_DIFF_BPM || Math.sign(dr) !== Math.sign(dp)) return null;
  return { recent: mr, previous: mp, nRecent: recent.length, nPrev: previous.length };
}

export function computeWatchZoneAdvice(rows: SuuntoWorkoutRow[], now = Date.now()): WatchZoneAdvice {
  const runs = rows.filter((w) => RUNNING_IDS.has(w.activityId ?? -1)).sort((a, b) => b.startTime - a.startTime);
  const notes: string[] = [];
  const recommendations: WatchZoneRecommendation[] = [];

  const latest = runs.find((w) => w.hrZoneLowerLimits && validHr(w.hrZoneLowerLimits.z3));
  const watchMax = runs.find((w) => validHr(w.userMaxHR))?.userMaxHR ?? null;
  const zones = latest?.hrZoneLowerLimits ?? null;

  if (!runs.length) {
    return { checkedAt: new Date(now).toISOString(), watch: null, recommendations, notes: ['No hay carreras en el historial sincronizado.'] };
  }

  // 1. FC máxima
  if (validHr(watchMax)) {
    const over = runs.filter((w) => w.startTime >= now - 84 * DAY_MS && validHr(w.maxHR) && (w.maxHR as number) > watchMax);
    const weeks = new Set(over.map((w) => isoWeek(w.startTime)));
    if (over.length >= 3 && weeks.size >= 2) {
      const values = over.map((w) => w.maxHR as number).sort((a, b) => b - a);
      const suggested = values[1];
      recommendations.push({
        field: 'maxHr',
        label: 'FC máxima',
        current: watchMax,
        suggested,
        direction: 'up',
        evidence: `${over.length} carreras en ${weeks.size} semanas distintas de las últimas 12 superaron tu FC máx configurada (${watchMax}): ${over
          .map((w) => `${dateOf(w)} ${w.maxHR}`)
          .join(', ')}. Propuesta: ${suggested} (segundo valor más alto; se descarta el pico mayor por si fue un artefacto).`,
      });
    } else if (over.length > 0) {
      notes.push(
        `FC máx: ${over.length} carrera(s) por encima de ${watchMax} en las últimas 12 semanas (${over
          .map((w) => `${dateOf(w)} ${w.maxHR}`)
          .join(', ')}). No es una tendencia todavía (hacen falta ≥ 3 en ≥ 2 semanas).`,
      );
    }
  }

  if (isDefaultSuuntoZones(zones, watchMax)) {
    notes.push('Las zonas de FC de carrera del reloj son las de fábrica (un % fijo de la FC máx): no son umbrales medidos, así que no des pulsaciones como si lo fueran.');
  }

  // 2. Umbrales ZoneSense frente a las zonas del reloj (Z3 = umbral aeróbico, Z5 = anaeróbico)
  const hasZs = runs.some((w) => validHr(w.zoneSenseAerobicThreshold) || validHr(w.zoneSenseAnaerobicThreshold));
  if (!hasZs) {
    notes.push('Suunto no envía umbrales ZoneSense (aeróbico/anaeróbico) en tus entrenos: no se puede evaluar si cambiar Z3/Z5.');
  } else if (zones) {
    const checks: Array<{ field: 'aetHr' | 'antHr'; label: string; zone: 'z3' | 'z5'; pick: (w: SuuntoWorkoutRow) => number | null | undefined }> = [
      { field: 'aetHr', label: 'Umbral aeróbico (inicio Z3)', zone: 'z3', pick: (w) => w.zoneSenseAerobicThreshold },
      { field: 'antHr', label: 'Umbral anaeróbico (inicio Z5)', zone: 'z5', pick: (w) => w.zoneSenseAnaerobicThreshold },
    ];
    for (const c of checks) {
      const current = zones[c.zone];
      if (!validHr(current)) continue;
      const t = thresholdTrend(runs, c.pick, current, now);
      if (!t) continue;
      recommendations.push({
        field: c.field,
        label: c.label,
        current,
        suggested: t.recent,
        direction: t.recent > current ? 'up' : 'down',
        evidence: `FC a la que ZoneSense detectó el umbral (varía cada día): mediana ${t.previous} ppm en ${t.nPrev} carreras de hace 5-8 semanas y ${t.recent} ppm en ${t.nRecent} carreras de las últimas 4; tus zonas de FC del reloj tienen ${current}. Afecta solo a las zonas de FC (respaldo sin banda); ZoneSense se ajusta solo.`,
      });
    }
  }

  return {
    checkedAt: new Date(now).toISOString(),
    watch: { maxHr: watchMax ?? null, zones: zones ?? null, sport: 'carrera' },
    recommendations,
    notes,
  };
}
