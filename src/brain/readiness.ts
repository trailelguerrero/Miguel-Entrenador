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
 * Si más de la mitad del TSS de los últimos 7 días NO es medido (estimado por la
 * app o asignado por Suunto), TSB y TSS de 7 días se informan pero NO escalan:
 * una carga estimada nunca decide por sí sola.
 * Límites por nivel (TECHO EN PULSACIONES, la FC es la verdad):
 *   VERDE    sin tope
 *   ÁMBAR    ≤ 75 % de lo planificado, FC ≤ AeT, sin series
 *   ROJO     ≤ 35 min regenerativos, FC ≤ AeT − 10 ppm (o descanso)
 *   SIN DATOS suave: FC ≤ AeT, sin series
 * Sin AeT no hay techo en ppm (null): se prescribe por sensaciones.
 * Cuando se juntan varios riesgos, los límites se endurecen:
 *   - ROJO de base + cualquier escalador  → descanso obligatorio
 *   - ÁMBAR de base + ≥ 2 escaladores     → ROJO con descanso obligatorio
 * El Recovery de Suunto se informa pero NO cambia el nivel: no hay un corte
 * validado para él. Los límites son MÁXIMOS: Miguel puede proponer menos.
 */
import type { WeeklyLoadThresholds } from '../utils/trainingLoad.js';

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
  /** Parte del TSS de 7 días que no es medida (estimada / asignada). */
  weeklyNonMeasuredTss?: number | null;
  plannedWorkout?: { type?: string; plannedDurationMin?: number } | null;
  /** Umbral aeróbico por FC (ppm): de él salen los techos de FC. */
  aetHr?: number | null;
}

/** Datos crudos del check-in de hoy (sin la carga): el servidor recalcula con ellos. */
export type TodayReadinessInputs = Omit<ReadinessInput, 'tsb' | 'weeklyTss' | 'weeklyThresholds' | 'weeklyNonMeasuredTss'>;

export interface ReadinessLimits {
  /** null = sin tope (se mantiene la duración planificada). */
  maxDurationMin: number | null;
  /** Techo de FC en ppm. null = sin techo (verde) o sin AeT para calcularlo. */
  maxHr: number | null;
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
/** Por encima de esta fracción de TSS no medido en 7 días, la carga no escala el nivel. */
export const ESTIMATED_LOAD_MAX_SHARE = 0.5;

/** ¿La carga de 7 días es sobre todo estimada? (entonces es informativa, no decide) */
export function isLoadMostlyEstimated(weeklyTss: number | null | undefined, nonMeasured: number | null | undefined): boolean {
  if (!(typeof weeklyTss === 'number' && weeklyTss > 0) || !(typeof nonMeasured === 'number' && nonMeasured > 0)) return false;
  return nonMeasured / weeklyTss > ESTIMATED_LOAD_MAX_SHARE;
}
/** Sesión regenerativa máxima en rojo (misma cifra que el consejo histórico del semáforo). */
export const RED_MAX_DURATION_MIN = 35;
/** En ámbar, fracción máxima de la duración planificada (elección de diseño de la app). */
export const AMBER_DURATION_FACTOR = 0.75;
/** En rojo, el techo de FC queda este margen por debajo del AeT (regenerativo; decisión del atleta). */
export const RED_HR_MARGIN = 10;

/** Techo de FC por nivel: verde sin techo, ámbar/sin datos = AeT, rojo = AeT − 10. Sin AeT: null. */
export function hrCeiling(level: ReadinessLevel, aetHr: number | null | undefined): number | null {
  if (!(typeof aetHr === 'number' && aetHr > 0) || level === 'green') return null;
  return level === 'red' ? aetHr - RED_HR_MARGIN : aetHr;
}

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
  const loadSignals: string[] = [];
  if (num(input.tsb) && input.tsb < TSB_ESCALATION) loadSignals.push(`TSB ${input.tsb} (< ${TSB_ESCALATION})`);
  if (num(input.weeklyTss) && input.weeklyThresholds && input.weeklyTss > input.weeklyThresholds.veryHigh) {
    loadSignals.push(`carga de 7 días ${Math.round(input.weeklyTss)} TSS (> ${input.weeklyThresholds.veryHigh}, muy alta para tu forma)`);
  }
  if (loadSignals.length && isLoadMostlyEstimated(input.weeklyTss, input.weeklyNonMeasuredTss)) {
    reasons.push(...loadSignals.map((e) => `${e} → informativo: la carga de 7 días es sobre todo ESTIMADA, no sube el nivel`));
  } else {
    escalators.push(...loadSignals);
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
  const maxHr = hrCeiling(level, input.aetHr);
  let limits: ReadinessLimits;
  if (level === 'red') {
    const compounded = (baseRank === 2 && escalators.length >= 1) || (baseRank === 1 && escalators.length >= 2);
    const mandatoryRest = redHits.length >= 2 || (soreness != null && soreness >= 8) || compounded;
    if (compounded) reasons.push('fatiga de base y carga/estrés acumulados a la vez → descanso obligatorio');
    limits = {
      maxDurationMin: mandatoryRest ? 0 : Math.min(planned ?? RED_MAX_DURATION_MIN, RED_MAX_DURATION_MIN),
      maxHr,
      allowIntervals: false,
      mandatoryRest,
    };
  } else if (level === 'amber') {
    // Ámbar: como mucho el 75 % de lo planificado (una tirada larga completa no es prudente)
    limits = {
      maxDurationMin: planned != null ? Math.round(planned * AMBER_DURATION_FACTOR) : null,
      maxHr,
      allowIntervals: false,
      mandatoryRest: false,
    };
  } else if (level === 'unknown') {
    // Sin datos de recuperación no se autoriza intensidad: se puede entrenar suave
    limits = { maxDurationMin: planned ?? null, maxHr, allowIntervals: false, mandatoryRest: false };
  } else {
    limits = { maxDurationMin: null, maxHr: null, allowIntervals: true, mandatoryRest: false };
  }

  return { level, reasons, limits, missingData, hrvDeltaPct };
}

const LEVEL_RANK: Record<ReadinessLevel, number> = { unknown: 0, green: 0, amber: 1, red: 2 };

function isValidState(s: any): s is ReadinessState {
  const l = s?.limits;
  return (
    !!s &&
    s.level in LEVEL_RANK &&
    !!l &&
    (l.maxDurationMin === null || (typeof l.maxDurationMin === 'number' && Number.isFinite(l.maxDurationMin) && l.maxDurationMin >= 0)) &&
    (l.maxHr === null || (typeof l.maxHr === 'number' && Number.isFinite(l.maxHr) && l.maxHr > 0)) &&
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
    maxHr: a.maxHr == null ? b.maxHr : b.maxHr == null ? a.maxHr : Math.min(a.maxHr, b.maxHr),
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
    `LÍMITES OBLIGATORIOS: ${l.mandatoryRest ? 'descanso total' : `duración máxima ${l.maxDurationMin ?? 'la planificada'}${l.maxDurationMin != null ? ' min' : ''}, ${l.maxHr != null ? `FC máxima ${l.maxHr} ppm` : state.level === 'green' ? 'sin techo de FC' : 'sin umbral de FC: solo suave, pudiendo hablar'}, ${l.allowIntervals ? 'series permitidas' : 'sin series'}`}.`,
    !l.mandatoryRest && state.level === 'amber'
      ? 'DESNIVEL: como mucho el 50 % del D+ y el 40 % del D− planificados, sin bajadas técnicas (el desnivel no se recorta en proporción al tiempo).'
      : !l.mandatoryRest && (state.level === 'red' || state.level === 'unknown')
        ? 'DESNIVEL: 0 m, terreno llano.'
        : '',
    'Los límites son MÁXIMOS: puedes proponer menos (y explicarlo como recomendación), nunca más. El Recovery de Suunto es informativo: si es bajo con límites holgados, puedes aconsejar prudencia, pero no lo presentes como un límite.',
    state.missingData.length ? `Datos que faltan: ${state.missingData.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
