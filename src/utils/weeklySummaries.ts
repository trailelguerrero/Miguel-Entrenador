/**
 * Resúmenes semanales y por bloques de 4 semanas, calculados SOLO con los
 * entrenos completados (datos de Suunto o registrados a mano). Nada de
 * valores de ejemplo: si un dato no existe, se devuelve null / 0.
 */
import { Workout } from '../types';
import { getWorkoutLoad, hrAerobicShare, localDateKey } from './trainingLoad';

export interface ZoneSenseMinutes {
  aerobicMin: number; // por debajo de AeT
  transitionMin: number; // entre AeT y AnT
  anaerobicMin: number; // por encima de AnT
  trackedMin: number; // minutos de entrenos que traen ZoneSense
}

export interface WeekSummary {
  weekId: string; // lunes YYYY-MM-DD
  weekLabel: string;
  startDate: string;
  endDate: string;
  distanceKm: number;
  durationMin: number;
  elevationGainM: number;
  elevationLossM: number;
  completedCount: number;
  tss: number;
  zoneSense: ZoneSenseMinutes;
  /** % del tiempo bajo el AeT por FC (medido con .FIT o estimado con la FC media). null sin AeT o sin FC. */
  aerobicPct: number | null;
  /** Cómo se obtuvo aerobicPct. */
  aerobicMethod: 'measured' | 'estimated' | 'mixed' | null;
  hrAerobicMin: number;
  hrTrackedMin: number;
  /** % en verde según ZoneSense (segunda opinión). null si no hay ZoneSense. */
  zoneSenseAerobicPct: number | null;
}

export interface BlockSummary {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  weeksCount: number;
  avgWeeklyKm: number;
  avgWeeklyGainM: number;
  avgWeeklyHours: number;
  avgWeeklyTss: number;
  totalGainM: number;
  aerobicPct: number | null;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function mondayOf(key: string): string {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}

function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function shortDate(key: string): string {
  return parseKey(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function pct(zs: ZoneSenseMinutes): number | null {
  return zs.trackedMin > 0 ? Math.round((zs.aerobicMin / zs.trackedMin) * 1000) / 10 : null;
}

/** Últimas `weeks` semanas (lunes a domingo), de la más antigua a la actual. */
/** @param aetHr umbral aeróbico por FC: el % aeróbico sale de la FC (la verdad), ZoneSense aparte. */
export function buildWeeklySummaries(workouts: Workout[], weeks = 12, antHr?: number, aetHr?: number | null): WeekSummary[] {
  const today = localDateKey();
  const currentMonday = mondayOf(today);
  const out: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(currentMonday, -7 * i);
    const end = addDays(start, 6);
    const ws = (workouts || []).filter((w) => w.completed && w.date >= start && w.date <= end && w.date <= today);
    const zs: ZoneSenseMinutes = { aerobicMin: 0, transitionMin: 0, anaerobicMin: 0, trackedMin: 0 };
    let tss = 0;
    for (const w of ws) {
      tss += getWorkoutLoad(w, antHr)?.tss ?? 0;
      const dur = w.actualDurationMin || 0;
      if (w.zoneSenseBreakdown && dur > 0) {
        zs.aerobicMin += (dur * w.zoneSenseBreakdown.aerobicPct) / 100;
        zs.transitionMin += (dur * w.zoneSenseBreakdown.transitionPct) / 100;
        zs.anaerobicMin += (dur * w.zoneSenseBreakdown.anaerobicPct) / 100;
        zs.trackedMin += dur;
      }
    }
    const hr = hrAerobicShare(ws, aetHr);
    zs.aerobicMin = Math.round(zs.aerobicMin);
    zs.transitionMin = Math.round(zs.transitionMin);
    zs.anaerobicMin = Math.round(zs.anaerobicMin);
    out.push({
      weekId: start,
      weekLabel: `${shortDate(start)} – ${shortDate(end)}`,
      startDate: start,
      endDate: end,
      distanceKm: r1(ws.reduce((a, w) => a + (w.actualDistanceKm || 0), 0)),
      durationMin: Math.round(ws.reduce((a, w) => a + (w.actualDurationMin || 0), 0)),
      elevationGainM: Math.round(ws.reduce((a, w) => a + (w.actualElevationGainM || 0), 0)),
      elevationLossM: Math.round(ws.reduce((a, w) => a + (w.actualElevationLossM || 0), 0)),
      completedCount: ws.length,
      tss: Math.round(tss),
      zoneSense: zs,
      aerobicPct: hr.pct,
      aerobicMethod: hr.method,
      hrAerobicMin: hr.aerobicMin,
      hrTrackedMin: hr.trackedMin,
      zoneSenseAerobicPct: pct(zs),
    });
  }
  return out;
}

/** Agrupa las semanas en bloques consecutivos de 4 (el último puede ser incompleto). */
export function buildFourWeekBlocks(weeks: WeekSummary[]): BlockSummary[] {
  const blocks: BlockSummary[] = [];
  // Se agrupa desde la semana actual hacia atrás para que el último bloque
  // termine siempre en la semana en curso.
  for (let end = weeks.length; end > 0; end -= 4) {
    const slice = weeks.slice(Math.max(0, end - 4), end);
    const n = slice.length;
    const zs = slice.reduce<ZoneSenseMinutes>(
      (a, w) => ({
        aerobicMin: a.aerobicMin + w.zoneSense.aerobicMin,
        transitionMin: a.transitionMin + w.zoneSense.transitionMin,
        anaerobicMin: a.anaerobicMin + w.zoneSense.anaerobicMin,
        trackedMin: a.trackedMin + w.zoneSense.trackedMin,
      }),
      { aerobicMin: 0, transitionMin: 0, anaerobicMin: 0, trackedMin: 0 },
    );
    const totalGain = slice.reduce((a, w) => a + w.elevationGainM, 0);
    const hrAer = slice.reduce((a, w) => a + w.hrAerobicMin, 0);
    const hrTracked = slice.reduce((a, w) => a + w.hrTrackedMin, 0);
    blocks.unshift({
      id: slice[0].weekId,
      label: `${shortDate(slice[0].startDate)} – ${shortDate(slice[n - 1].endDate)}`,
      startDate: slice[0].startDate,
      endDate: slice[n - 1].endDate,
      weeksCount: n,
      avgWeeklyKm: r1(slice.reduce((a, w) => a + w.distanceKm, 0) / n),
      avgWeeklyGainM: Math.round(totalGain / n),
      avgWeeklyHours: r1(slice.reduce((a, w) => a + w.durationMin, 0) / 60 / n),
      avgWeeklyTss: Math.round(slice.reduce((a, w) => a + w.tss, 0) / n),
      totalGainM: totalGain,
      // Bajo el AeT por FC media (estimación); ZoneSense no manda
      aerobicPct: hrTracked > 0 ? Math.round((hrAer / hrTracked) * 1000) / 10 : null,
    });
  }
  return blocks;
}
