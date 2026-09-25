/**
 * MOTOR DE READINESS (determinista). Es la única lógica que decide el estado
 * fisiológico del día y los LÍMITES de la sesión. Miguel (la IA) elige y
 * explica la sesión DENTRO de estos límites; no reinterpreta los datos.
 *
 * Nivel base (mismos cortes que usaba el semáforo desde el principio):
 *   ROJO  : HRV < −20 % de la referencia, sueño < 5,5 h o dolor muscular ≥ 8
 *   ÁMBAR : HRV < −10 %, sueño < 6,5 h o dolor muscular ≥ 6
 *   VERDE : resto
 * Señales que suben el nivel UN paso como máximo (elección de diseño de la
 * app, no un estándar publicado):
 *   - TSB < −30
 *   - TSS de los últimos 7 días por encima del umbral "muy alta" del atleta
 *     (CTL×7 + 20 %, ver weeklyLoadThresholds)
 *   - Estrés vital declarado ≥ 8
 * Cuando se juntan varios riesgos, los límites se endurecen:
 *   - ROJO de base + cualquier escalador  → descanso obligatorio
 *   - ÁMBAR de base + ≥ 2 escaladores     → ROJO con descanso obligatorio
 * El Recovery de Suunto se informa pero NO cambia el nivel: no hay un corte
 * validado para él. Los límites son MÁXIMOS: Miguel puede proponer menos.
 */
import type { WeeklyLoadThresholds } from '../utils/trainingLoad';
import { colorRank, type ZoneSenseColor } from './zonesense';

export type ReadinessLevel = 'green' | 'amber' | 'red' | 'unknown';

export interface ReadinessInput {
  hrvRmssd?: number | null;
  hrvBaseline?: number | null;
  sleepHours?: number | null;
  muscleSoreness?: number | null;
  stressLevel?: number | null;
  /** Recovery (Balance) de Suunto del día, 0-100. */
  recoveryPct?: number | null;
  tsb?: number | null;
  /** TSS de los últimos 7 días. */
  weeklyTss?: number | null;
  weeklyThresholds?: WeeklyLoadThresholds | null;
  plannedWorkout?: { type?: string; plannedDurationMin?: number } | null;
}

export interface ReadinessLimits {
  /** null = sin tope (se mantiene la duración planificada). */
  maxDurationMin: number | null;
  /** Color máximo de ZoneSense permitido. */
  maxZoneSense: ZoneSenseColor;
  allowIntervals: boolean;
  mandatoryRest: boolean;
}

export interface ReadinessState {
  level: ReadinessLevel;
  reasons: string[];
  limits: ReadinessLimits;
  missingData: string[];
  /** Variación de la HRV frente a la referencia (%), null si no se puede calcular. */
  hrvDeltaPct: number | null;
}

export const TSB_ESCALATION = -30;
export const STRESS_ESCALATION = 8;
/** Sesión regenerativa máxima en rojo (misma cifra que el consejo histórico del semáforo). */
export const RED_MAX_DURATION_MIN = 35;

const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function evaluateReadiness(input: ReadinessInput): ReadinessState {
  const reasons: string[] = [];
  const missingData: string[] = [];

  const hrvOk = num(input.hrvRmssd) && input.hrvRmssd > 0;
  const baseOk = num(input.hrvBaseline) && input.hrvBaseline > 0;
  const hrvDeltaPct = hrvOk && baseOk ? Math.round(((input.hrvRmssd! - input.hrvBaseline!) / input.hrvBaseline!) * 100) : null;
  if (!hrvOk) missingData.push('HRV nocturna');
  if (!baseOk) missingData.push('HRV de referencia');
  const sleepOk = num(input.sleepHours) && input.sleepHours > 0;
  if (!sleepOk) missingData.push('horas de sueño');

  // 1. Nivel base
  let rank = 0; // 0 verde, 1 ámbar, 2 rojo
  const soreness = num(input.muscleSoreness) ? input.muscleSoreness : null;
  const redHits: string[] = [];
  if (hrvDeltaPct != null && hrvDeltaPct < -20) redHits.push(`HRV ${hrvDeltaPct}% bajo tu referencia`);
  if (sleepOk && input.sleepHours! < 5.5) redHits.push(`solo ${input.sleepHours} h de sueño`);
  if (soreness != null && soreness >= 8) redHits.push(`dolor muscular ${soreness}/10`);
  if (redHits.length) {
    rank = 2;
    reasons.push(...redHits);
  } else {
    const amberHits: string[] = [];
    if (hrvDeltaPct != null && hrvDeltaPct < -10) amberHits.push(`HRV ${hrvDeltaPct}% bajo tu referencia`);
    if (sleepOk && input.sleepHours! < 6.5) amberHits.push(`${input.sleepHours} h de sueño`);
    if (soreness != null && soreness >= 6) amberHits.push(`dolor muscular ${soreness}/10`);
    if (amberHits.length) {
      rank = 1;
      reasons.push(...amberHits);
    }
  }

  // 2. Escalado (un paso como máximo; varios riesgos a la vez endurecen los límites)
  const baseRank = rank;
  const escalators: string[] = [];
  if (num(input.tsb) && input.tsb < TSB_ESCALATION) escalators.push(`TSB ${input.tsb} (< ${TSB_ESCALATION})`);
  if (num(input.weeklyTss) && input.weeklyThresholds && input.weeklyTss > input.weeklyThresholds.veryHigh) {
    escalators.push(`carga de 7 días ${Math.round(input.weeklyTss)} TSS (> ${input.weeklyThresholds.veryHigh}, muy alta para tu forma)`);
  }
  if (num(input.stressLevel) && input.stressLevel >= STRESS_ESCALATION) escalators.push(`estrés ${input.stressLevel}/10`);
  if (escalators.length && rank < 2) {
    rank += 1;
    reasons.push(...escalators.map((e) => `${e} → sube un nivel`));
  } else if (escalators.length) {
    reasons.push(...escalators);
  }

  if (num(input.recoveryPct)) reasons.push(`Recovery Suunto ${input.recoveryPct}% (informativo)`);

  const noCoreData = hrvDeltaPct == null && !sleepOk && soreness == null;
  const level: ReadinessLevel = noCoreData && rank === 0 ? 'unknown' : (['green', 'amber', 'red'] as const)[rank];
  if (level === 'unknown') reasons.push('Sin HRV ni sueño: no se puede valorar la recuperación de hoy');

  // 3. Límites de la sesión
  const planned = input.plannedWorkout?.plannedDurationMin;
  let limits: ReadinessLimits;
  if (level === 'red') {
    const compounded = (baseRank === 2 && escalators.length >= 1) || (baseRank === 1 && escalators.length >= 2);
    const mandatoryRest = redHits.length >= 2 || (soreness != null && soreness >= 8) || compounded;
    if (compounded) reasons.push('fatiga de base y carga/estrés acumulados a la vez → descanso obligatorio');
    limits = {
      maxDurationMin: mandatoryRest ? 0 : Math.min(planned ?? RED_MAX_DURATION_MIN, RED_MAX_DURATION_MIN),
      maxZoneSense: 'green',
      allowIntervals: false,
      mandatoryRest,
    };
  } else if (level === 'amber') {
    limits = { maxDurationMin: planned ?? null, maxZoneSense: 'green', allowIntervals: false, mandatoryRest: false };
  } else {
    limits = { maxDurationMin: null, maxZoneSense: 'red', allowIntervals: true, mandatoryRest: false };
  }

  return { level, reasons, limits, missingData, hrvDeltaPct };
}

const LEVEL_RANK: Record<ReadinessLevel, number> = { unknown: 0, green: 0, amber: 1, red: 2 };
const COLORS: ZoneSenseColor[] = ['green', 'yellow', 'red'];

function isValidState(s: any): s is ReadinessState {
  const l = s?.limits;
  return (
    !!s &&
    s.level in LEVEL_RANK &&
    !!l &&
    (l.maxDurationMin === null || (typeof l.maxDurationMin === 'number' && Number.isFinite(l.maxDurationMin) && l.maxDurationMin >= 0)) &&
    COLORS.includes(l.maxZoneSense) &&
    typeof l.allowIntervals === 'boolean' &&
    typeof l.mandatoryRest === 'boolean'
  );
}

/**
 * Combina el estado recalculado (fuente de verdad) con otro recibido de fuera
 * (p. ej. el del cliente, que sí conoce TSB y carga). Solo puede ENDURECER:
 * de cada límite se queda el más estricto de los dos.
 */
export function strictestReadiness(base: ReadinessState, other: unknown): ReadinessState {
  if (!isValidState(other)) return base;
  const a = base.limits;
  const b = other.limits;
  const minDuration = a.maxDurationMin == null ? b.maxDurationMin : b.maxDurationMin == null ? a.maxDurationMin : Math.min(a.maxDurationMin, b.maxDurationMin);
  const limits: ReadinessLimits = {
    maxDurationMin: minDuration,
    maxZoneSense: colorRank(a.maxZoneSense) <= colorRank(b.maxZoneSense) ? a.maxZoneSense : b.maxZoneSense,
    allowIntervals: a.allowIntervals && b.allowIntervals,
    mandatoryRest: a.mandatoryRest || b.mandatoryRest,
  };
  if (limits.mandatoryRest) limits.maxDurationMin = 0;
  const level = LEVEL_RANK[other.level] > LEVEL_RANK[base.level] ? other.level : base.level;
  const tightened = level !== base.level || JSON.stringify(limits) !== JSON.stringify(a);
  const extra = Array.isArray(other.reasons) ? other.reasons.filter((r) => typeof r === 'string' && !base.reasons.includes(r)) : [];
  return tightened ? { ...base, level, limits, reasons: [...base.reasons, ...extra] } : base;
}

/** Texto de los límites para el prompt de Miguel. */
export function describeReadiness(state: ReadinessState): string {
  const lvl = { green: 'VERDE', amber: 'ÁMBAR', red: 'ROJO', unknown: 'SIN DATOS' }[state.level];
  const l = state.limits;
  return [
    `Estado calculado por el motor de readiness: ${lvl}.`,
    state.reasons.length ? `Motivos: ${state.reasons.join('; ')}.` : 'Sin señales de fatiga.',
    `LÍMITES OBLIGATORIOS: ${l.mandatoryRest ? 'descanso total' : `duración máxima ${l.maxDurationMin ?? 'la planificada'}${l.maxDurationMin != null ? ' min' : ''}, ZoneSense máximo ${l.maxZoneSense === 'green' ? 'verde' : l.maxZoneSense === 'yellow' ? 'amarillo' : 'rojo'}, ${l.allowIntervals ? 'series permitidas' : 'sin series'}`}.`,
    'Los límites son MÁXIMOS: puedes proponer menos (y explicarlo como recomendación), nunca más. El Recovery de Suunto es informativo: si es bajo con límites holgados, puedes aconsejar prudencia, pero no lo presentes como un límite.',
    state.missingData.length ? `Datos que faltan: ${state.missingData.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
