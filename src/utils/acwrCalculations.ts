/**
 * Ratio de carga aguda:crónica (ACWR), DESCRIPTIVO y DESACOPLADO.
 *
 *   aguda   = TSS medio de los últimos 7 días (días i-6 .. i)
 *   crónica = TSS medio de los 28 días ANTERIORES (días i-34 .. i-7), sin incluir
 *             los 7 agudos: en el ACWR clásico la carga aguda está también en el
 *             denominador y eso crea una correlación espuria (acoplamiento
 *             matemático, Lolli et al., BJSM 2019).
 *
 * Solo describe: "tu carga de 7 días es X veces la media de las 4 semanas
 * previas". No es un predictor de lesiones (las bandas de Gabbett vienen de
 * deportes de equipo) ni decide nada: lo que haces hoy lo decide el motor de
 * readiness (src/brain/readiness.ts). Sin historial suficiente → 'insufficient_data'
 * (nunca valores de ejemplo).
 */

import { Workout } from '../types';
import { buildDailyLoadMap, buildDailyLoadSeries, localDateKey } from './trainingLoad';

export type ACWRZone = 'insufficient_data' | 'low' | 'similar' | 'high' | 'very_high';

export interface ACWRDataPoint {
  date: string;
  dayLabel: string;
  dayTss: number;
  acuteLoad7d: number;      // media de 7 días
  acuteLoad7dTotal: number; // suma de 7 días
  chronicLoad28d: number;   // media de los 28 días previos a la ventana aguda
  chronicLoad28dTotal: number;
  acwr: number;             // aguda / crónica (0 si no hay crónica)
  ewmaAcwr: number;         // ratio con medias exponenciales
  zone: ACWRZone;
  workoutTitles: string[];
}

export interface ACWRSummary {
  currentAcwr: number;
  currentEwmaAcwr: number;
  acuteLoad7dTotal: number;
  acuteLoad7dAvg: number;
  chronicLoad28dTotal: number;
  chronicLoad28dAvg: number;
  weeklyChangePct: number;    // % de la carga aguda frente a la de hace 7 días
  zone: ACWRZone;
  zoneLabel: string;
  zoneColor: string;
  zoneBgColor: string;
  zoneBorderColor: string;
  /** Lectura corta, solo descriptiva. */
  shortLabel: string;
  /** Frase descriptiva ("tu carga reciente es 1,38 veces..."), sin recomendación. */
  description: string;
  series28d: ACWRDataPoint[];
}

/**
 * Builds a continuous date-indexed TSS map (oldest → today) from the
 * athlete's COMPLETED workouts only (Suunto TSS when available).
 * Days without training count as 0 TSS.
 */
export function buildContinuousTssMap(
  workouts: Workout[],
  daysCount: number = 60,
  antHr?: number
): Map<string, { tss: number; titles: string[] }> {
  const map = new Map<string, { tss: number; titles: string[] }>();
  for (const day of buildDailyLoadSeries(workouts, daysCount, antHr)) {
    map.set(day.date, { tss: day.tss, titles: day.titles });
  }
  return map;
}

const fmt = (n: number) => n.toFixed(2).replace('.', ',');

/** Bandas descriptivas del ratio (sin semántica de riesgo). */
export function getACWRZone(acwr: number, chronicTotal?: number): {
  zone: ACWRZone;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  shortLabel: string;
  description: string;
} {
  if (chronicTotal !== undefined && !(chronicTotal > 0)) {
    return {
      zone: 'insufficient_data',
      label: 'Sin carga de las 4 semanas previas',
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-700/20',
      borderColor: 'border-zinc-600',
      shortLabel: 'Sin datos suficientes',
      description: 'No hay carga registrada en las 4 semanas anteriores a los últimos 7 días: no se puede comparar.',
    };
  }
  const base = `Tu carga de los últimos 7 días es ${fmt(acwr)} veces la media de las 4 semanas previas.`;
  if (acwr < 0.8) return { zone: 'low', label: 'Carga reciente por debajo de la previa (< 0,80)', color: 'text-sky-400', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/30', shortLabel: 'Carga reciente menor', description: base };
  if (acwr <= 1.3) return { zone: 'similar', label: 'Carga reciente similar a la previa (0,80–1,30)', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', shortLabel: 'Carga reciente similar', description: base };
  if (acwr <= 1.5) return { zone: 'high', label: 'Carga reciente por encima de la previa (1,30–1,50)', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', shortLabel: 'Carga reciente mayor', description: base };
  return { zone: 'very_high', label: 'Carga reciente muy por encima de la previa (> 1,50)', color: 'text-rose-400', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/30', shortLabel: 'Carga reciente mucho mayor', description: base };
}

/** Serie de los últimos 28 días y estado actual del ratio desacoplado. */
export function calculateACWRSummary(workouts: Workout[], antHr?: number): ACWRSummary {
  // 28 puntos, cada uno necesita 7 + 28 días detrás → al menos 63 días. La EWMA
  // usa todo el historial desde el primer entreno (arranca en 0, sin semilla).
  const loggedDates = [...buildDailyLoadMap(workouts, antHr).keys()].sort();
  const today = localDateKey();
  const firstDate = loggedDates[0] && loggedDates[0] < today ? loggedDates[0] : today;
  const daysSinceFirst = Math.round((new Date(today).getTime() - new Date(firstDate).getTime()) / 86400000) + 1;
  const tssMap = buildContinuousTssMap(workouts, Math.max(63, daysSinceFirst), antHr);
  const dates = Array.from(tssMap.keys()).sort();
  const tssAt = (j: number) => (j >= 0 ? tssMap.get(dates[j])?.tss || 0 : 0);

  const series28d: ACWRDataPoint[] = [];
  let ewmaAcute = 0;
  let ewmaChronic = 0;
  const acuteAlpha = 2 / (7 + 1);
  const chronicAlpha = 2 / (28 + 1);

  for (let i = 0; i < dates.length; i++) {
    const dayTss = tssAt(i);
    ewmaAcute = dayTss * acuteAlpha + (1 - acuteAlpha) * ewmaAcute;
    ewmaChronic = dayTss * chronicAlpha + (1 - chronicAlpha) * ewmaChronic;
    if (i < dates.length - 28) continue;

    let acuteSum = 0;
    for (let j = i - 6; j <= i; j++) acuteSum += tssAt(j);
    let chronicSum = 0;
    for (let j = i - 34; j <= i - 7; j++) chronicSum += tssAt(j);
    const acuteAvg = Math.round((acuteSum / 7) * 10) / 10;
    const chronicAvg = Math.round((chronicSum / 28) * 10) / 10;
    const acwr = chronicSum > 0 ? Math.round(((acuteSum / 7) / (chronicSum / 28)) * 100) / 100 : 0;
    const ewmaAcwr = ewmaChronic > 0 ? Math.round((ewmaAcute / ewmaChronic) * 100) / 100 : 0;

    const [yy, mm, dd] = dates[i].split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    series28d.push({
      date: dates[i],
      dayLabel: `${d.getDate()} ${d.toLocaleString('es-ES', { month: 'short' })}`,
      dayTss,
      acuteLoad7d: acuteAvg,
      acuteLoad7dTotal: acuteSum,
      chronicLoad28d: chronicAvg,
      chronicLoad28dTotal: chronicSum,
      acwr,
      ewmaAcwr,
      zone: getACWRZone(acwr, chronicSum).zone,
      workoutTitles: tssMap.get(dates[i])?.titles ?? [],
    });
  }

  const latest = series28d[series28d.length - 1];
  const weekAgo = series28d[series28d.length - 8] || series28d[0];
  const weeklyChangePct = latest && weekAgo && weekAgo.acuteLoad7d > 0 ? Math.round(((latest.acuteLoad7d - weekAgo.acuteLoad7d) / weekAgo.acuteLoad7d) * 100) : 0;
  const zone = getACWRZone(latest?.acwr ?? 0, latest?.chronicLoad28dTotal ?? 0);

  return {
    currentAcwr: latest?.acwr ?? 0,
    currentEwmaAcwr: latest?.ewmaAcwr ?? 0,
    acuteLoad7dTotal: latest?.acuteLoad7dTotal ?? 0,
    acuteLoad7dAvg: latest?.acuteLoad7d ?? 0,
    chronicLoad28dTotal: latest?.chronicLoad28dTotal ?? 0,
    chronicLoad28dAvg: latest?.chronicLoad28d ?? 0,
    weeklyChangePct,
    zone: zone.zone,
    zoneLabel: zone.label,
    zoneColor: zone.color,
    zoneBgColor: zone.bgColor,
    zoneBorderColor: zone.borderColor,
    shortLabel: zone.shortLabel,
    description: zone.description,
    series28d,
  };
}
