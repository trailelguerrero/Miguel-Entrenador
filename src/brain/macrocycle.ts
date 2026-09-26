/**
 * MACROCICLO hasta la carrera objetivo (determinista). Es la ÚNICA fuente de las
 * cifras del plan largo: fechas, fases, semanas de carga/descarga y objetivos
 * semanales. Miguel (la IA) solo redacta objetivos y explicaciones dentro de este
 * esqueleto; no puede cambiar fechas ni números.
 *
 * Decisiones de diseño de la app (no son un estándar publicado; se documentan aquí):
 *   - Fases en orden: base aeróbica → fuerza y muscular endurance → específico de
 *     montaña → afinado. El afinado son las 2 semanas previas + la de carrera.
 *     Del resto: específico ≈ 35 % (máx. 12 semanas), fuerza/ME ≈ 25 %, base el resto.
 *   - Bloques de 3 semanas de carga + 1 de descarga (descarga = 70 % de la carga previa).
 *   - Los objetivos parten de la CARGA REAL medida (media de las semanas anteriores con
 *     actividad a pie) y suben como mucho un 8 % por semana de carga hasta el pico.
 *   - Pico de horas: 1,8 × la base medida, con techo de 10 h/semana (4 días de
 *     disponibilidad); pico de D+ semanal: el D+ de la carrera; tirada larga: hasta 5 h
 *     con hasta 2.000 m de D+ al final del específico.
 *   - Sin datos suficientes (< 3 semanas con actividad): base conservadora de 4 h y
 *     400 m/semana, marcada como tal.
 * Los objetivos son TOPES: el readiness diario sigue mandando cada día.
 */
import type { AdaptationMarker, DailyCheckIn, MacrocyclePlan, Mesocycle, MesocyclePhase, MicrocycleTarget, TargetRace, Workout } from '../types/index.js';
import { isOnFoot } from '../utils/mechanicalLoad.js';
import { addDaysKey, mondayOfKey } from '../utils/weekStructure.js';
import { hrAerobicShare, localDateKey } from '../utils/trainingLoad.js';

export const MAX_LOAD_INCREASE = 0.08;
export const RECOVERY_FACTOR = 0.7;
export const PEAK_HOURS_FACTOR = 1.8;
export const PEAK_HOURS_CAP = 10;
export const PEAK_LONG_RUN_MIN = 300;
export const PEAK_LONG_RUN_GAIN_M = 2000;
export const TAPER_FACTORS = [0.7, 0.5] as const; // semanas −2 y −1; la de carrera, 0,3
export const RACE_WEEK_FACTOR = 0.3;
const CONSERVATIVE = { weeklyHours: 4, weeklyElevationGainM: 400, longestRunMin: 90 };

const r1 = (n: number) => Math.round(n * 10) / 10;
const r0 = (n: number) => Math.round(n);

export interface Baseline {
  weeklyHours: number;
  weeklyElevationGainM: number;
  longestRunMin: number;
  weeksOfData: number;
  conservative: boolean;
}

/** Carga de partida: media semanal de las `weeks` semanas completas anteriores a `monday`. */
export function measureBaseline(workouts: Workout[], monday: string, weeks = 6): Baseline {
  const onFoot = (workouts || []).filter(isOnFoot);
  let hours = 0;
  let gain = 0;
  let longest = 0;
  let weeksWith = 0;
  for (let k = 1; k <= weeks; k++) {
    const from = addDaysKey(monday, -7 * k);
    const to = addDaysKey(from, 6);
    const ws = onFoot.filter((w) => w.date >= from && w.date <= to);
    if (ws.length) weeksWith++;
    for (const w of ws) {
      hours += (w.actualDurationMin ?? 0) / 60;
      gain += w.actualElevationGainM ?? 0;
      longest = Math.max(longest, w.actualDurationMin ?? 0);
    }
  }
  if (weeksWith < 3) return { ...CONSERVATIVE, weeksOfData: weeksWith, conservative: true };
  return { weeklyHours: r1(hours / weeksWith), weeklyElevationGainM: r0(gain / weeksWith), longestRunMin: r0(longest), weeksOfData: weeksWith, conservative: false };
}

const PHASE_TITLE: Record<MesocyclePhase, string> = {
  base_aerobic: 'Base aeróbica',
  ads_reversal: 'Base aeróbica',
  muscular_endurance: 'Fuerza y muscular endurance',
  mountain_specific: 'Específico de montaña',
  peak_taper: 'Afinado y carrera',
};

const PHASE_FOCUS: Record<MesocyclePhase, string> = {
  base_aerobic: 'Volumen por debajo del umbral aeróbico (FC), fuerza general y constancia.',
  ads_reversal: 'Volumen por debajo del umbral aeróbico (FC).',
  muscular_endurance: 'Subidas empinadas caminando fuerte, fuerza excéntrica para las bajadas y tiradas con más desnivel.',
  mountain_specific: 'Tiradas largas en terreno parecido al de la carrera, bajadas largas, nutrición y material de carrera.',
  peak_taper: 'Bajar volumen manteniendo algún estímulo corto, llegar fresco y con la estrategia de carrera clara.',
};

/** Marcadores de adaptación de cada fase (medibles con los datos de la app). */
export function phaseMarkers(phase: MesocyclePhase, race: Pick<TargetRace, 'elevationGainM'>): AdaptationMarker[] {
  switch (phase) {
    case 'base_aerobic':
    case 'ads_reversal':
      return [
        { id: 'aerobic_share', label: 'Tiempo por debajo del umbral aeróbico (FC)', target: 80, unit: '%' },
        { id: 'drift_test', label: 'Test de deriva cardíaca hecho (para afinar el AeT)', target: null },
      ];
    case 'muscular_endurance':
      return [
        { id: 'long_run_elevation', label: 'Tirada larga con desnivel', target: 1000, unit: 'm D+' },
        { id: 'descent_tolerance', label: 'Bajadas sin dolor muscular alto al día siguiente (≤ 5/10)', target: 5, unit: '/10' },
      ];
    case 'mountain_specific':
      return [
        { id: 'long_run', label: 'Tirada larga', target: PEAK_LONG_RUN_MIN * 0.9, unit: 'min' },
        { id: 'long_run_elevation', label: 'Tirada larga con desnivel', target: Math.min(PEAK_LONG_RUN_GAIN_M, Math.round((race.elevationGainM || 4000) * 0.4)), unit: 'm D+' },
        { id: 'gut_tolerance', label: 'Carbohidratos tolerados por hora en tiradas largas', target: 60, unit: 'g/h' },
      ];
    case 'peak_taper':
      return [{ id: 'readiness_green', label: 'Días en verde en la última semana', target: 4, unit: 'días' }];
  }
}

export interface BuildInput {
  race: TargetRace;
  /** Hoy (fecha del atleta). El plan empieza el lunes siguiente (o hoy si es lunes). */
  today?: string;
  workouts: Workout[];
}

/** Lunes de inicio: el propio lunes si hoy lo es; si no, el siguiente. */
export function macroStartMonday(today: string): string {
  const m = mondayOfKey(today);
  return m === today ? today : addDaysKey(m, 7);
}

/** Fases por semana (índices). */
export function splitPhases(totalWeeks: number): MesocyclePhase[] {
  const taper = Math.min(3, totalWeeks);
  const rest = totalWeeks - taper;
  const specific = Math.min(12, Math.round(rest * 0.35));
  const me = Math.round(rest * 0.25);
  const base = Math.max(0, rest - specific - me);
  return [
    ...Array(base).fill('base_aerobic'),
    ...Array(me).fill('muscular_endurance'),
    ...Array(specific).fill('mountain_specific'),
    ...Array(taper).fill('peak_taper'),
  ] as MesocyclePhase[];
}

/** Construye el esqueleto completo (sin textos de la IA). */
export function buildMacrocycle({ race, today = localDateKey(), workouts }: BuildInput): MacrocyclePlan {
  if (!race?.date || !/^\d{4}-\d{2}-\d{2}$/.test(race.date)) throw new Error('La carrera no tiene fecha: no se puede construir el plan.');
  const start = macroStartMonday(today);
  const raceMonday = mondayOfKey(race.date);
  const totalWeeks = Math.round((Date.parse(raceMonday) - Date.parse(start)) / (7 * 86400000)) + 1;
  if (totalWeeks < 4) throw new Error('Quedan menos de 4 semanas hasta la carrera: no hay margen para un macrociclo.');

  const baseline = measureBaseline(workouts, start);
  const phases = splitPhases(totalWeeks);
  const buildWeeks = phases.filter((p) => p !== 'peak_taper').length;

  const peakHours = Math.max(baseline.weeklyHours, Math.min(baseline.weeklyHours * PEAK_HOURS_FACTOR, PEAK_HOURS_CAP));
  const peakGain = Math.max(baseline.weeklyElevationGainM, race.elevationGainM || 4000);
  const peakLong = Math.max(baseline.longestRunMin, PEAK_LONG_RUN_MIN);

  const weeks: MicrocycleTarget[] = [];
  let hours = baseline.weeklyHours;
  let gain = baseline.weeklyElevationGainM;
  let long = baseline.longestRunMin;
  let lastLoad = { hours, gain, long };
  let loadCount = 0;
  const loadWeeksLeft = (i: number) => phases.slice(i, buildWeeks).length;
  for (let i = 0; i < totalWeeks; i++) {
    const monday = addDaysKey(start, 7 * i);
    const phase = phases[i];
    if (phase === 'peak_taper') {
      const fromEnd = totalWeeks - 1 - i; // 2, 1, 0
      const f = fromEnd === 0 ? RACE_WEEK_FACTOR : TAPER_FACTORS[2 - fromEnd] ?? TAPER_FACTORS[0];
      weeks.push({
        monday,
        index: i,
        phase,
        kind: fromEnd === 0 ? 'race' : 'taper',
        targetHours: r1(lastLoad.hours * f),
        targetElevationGainM: r0(lastLoad.gain * f),
        longRunMin: r0(fromEnd === 0 ? 0 : lastLoad.long * f),
        longRunElevationGainM: r0(fromEnd === 0 ? 0 : Math.min(PEAK_LONG_RUN_GAIN_M, lastLoad.gain * 0.5) * f),
      });
      continue;
    }
    // 3 semanas de carga + 1 de descarga
    const recovery = (i + 1) % 4 === 0;
    if (recovery) {
      weeks.push({
        monday,
        index: i,
        phase,
        kind: 'recovery',
        targetHours: r1(lastLoad.hours * RECOVERY_FACTOR),
        targetElevationGainM: r0(lastLoad.gain * RECOVERY_FACTOR),
        longRunMin: r0(lastLoad.long * RECOVERY_FACTOR),
        longRunElevationGainM: r0(Math.min(PEAK_LONG_RUN_GAIN_M, lastLoad.gain * 0.5) * RECOVERY_FACTOR),
      });
      continue;
    }
    if (loadCount > 0) {
      // Subida hacia el pico repartida en las semanas de carga que quedan, con tope del 8 %
      const remaining = Math.max(1, Math.ceil((loadWeeksLeft(i) * 3) / 4));
      const step = (target: number, cur: number) => Math.min(cur * (1 + MAX_LOAD_INCREASE), cur + Math.max(0, target - cur) / remaining);
      hours = step(peakHours, hours);
      gain = step(peakGain, gain);
      long = step(peakLong, long);
    }
    loadCount++;
    lastLoad = { hours, gain, long };
    weeks.push({
      monday,
      index: i,
      phase,
      kind: 'load',
      targetHours: r1(hours),
      targetElevationGainM: r0(gain),
      longRunMin: r0(long),
      longRunElevationGainM: r0(Math.min(PEAK_LONG_RUN_GAIN_M, gain * 0.5)),
    });
  }

  // Mesociclos = tramos consecutivos de la misma fase
  const mesocycles: Mesocycle[] = [];
  for (const w of weeks) {
    const last = mesocycles[mesocycles.length - 1];
    if (last && last.phase === w.phase) {
      last.endDate = addDaysKey(w.monday, 6);
    } else {
      mesocycles.push({
        id: `meso-${mesocycles.length + 1}`,
        number: mesocycles.length + 1,
        title: PHASE_TITLE[w.phase],
        phase: w.phase,
        startDate: w.monday,
        endDate: addDaysKey(w.monday, 6),
        focus: PHASE_FOCUS[w.phase],
        keyWorkouts: [],
        markers: phaseMarkers(w.phase, race),
      });
    }
  }

  return {
    id: `macro-${start}`,
    targetRace: race,
    startDate: start,
    raceDate: race.date,
    totalWeeks,
    mesocycles,
    secondaryRaces: [],
    weeks,
    baseline,
    version: 1,
    createdAt: new Date().toISOString(),
    log: [],
  };
}

// --- Adaptación semana a semana ---

export interface WeekActual {
  hours: number;
  elevationGainM: number;
  longestRunMin: number;
  redDays: number;
}

/** Lo hecho una semana (a pie) y los días en rojo del readiness. */
export function weekActual(workouts: Workout[], checkIns: DailyCheckIn[], monday: string): WeekActual {
  const sunday = addDaysKey(monday, 6);
  const ws = (workouts || []).filter((w) => isOnFoot(w) && w.date >= monday && w.date <= sunday);
  return {
    hours: r1(ws.reduce((a, w) => a + (w.actualDurationMin ?? 0) / 60, 0)),
    elevationGainM: r0(ws.reduce((a, w) => a + (w.actualElevationGainM ?? 0), 0)),
    longestRunMin: r0(Math.max(0, ...ws.map((w) => w.actualDurationMin ?? 0))),
    redDays: (checkIns || []).filter((c) => c.date >= monday && c.date <= sunday && c.status === 'fatigued').length,
  };
}

export interface AdjustedWeek {
  target: MicrocycleTarget;
  /** 'as_planned' | 'hold' (se repite el objetivo anterior) | 'reduce'. */
  decision: 'as_planned' | 'hold' | 'reduce';
  reason: string;
}

/**
 * Objetivo de la semana `monday` ajustado a lo que pasó la anterior:
 *   - ≥ 3 días en rojo o < 60 % de las horas objetivo → se BAJA a la descarga (70 %).
 *   - < 80 % de las horas objetivo → se MANTIENE el objetivo anterior (sin progresar).
 *   - si no, lo planificado. Las semanas de descarga, afinado y carrera no se tocan.
 */
export function adjustedWeekTarget(macro: MacrocyclePlan, monday: string, workouts: Workout[], checkIns: DailyCheckIn[]): AdjustedWeek | null {
  const weeks = macro.weeks || [];
  const idx = weeks.findIndex((w) => w.monday === monday);
  if (idx < 0) return null;
  const planned = weeks[idx];
  if (idx === 0 || planned.kind !== 'load') return { target: planned, decision: 'as_planned', reason: 'según el plan' };
  const prev = weeks[idx - 1];
  const act = weekActual(workouts, checkIns, prev.monday);
  const compliance = prev.targetHours > 0 ? act.hours / prev.targetHours : 1;
  if (act.redDays >= 3 || compliance < 0.6) {
    const f = RECOVERY_FACTOR;
    return {
      target: { ...planned, kind: 'recovery', targetHours: r1(prev.targetHours * f), targetElevationGainM: r0(prev.targetElevationGainM * f), longRunMin: r0(prev.longRunMin * f), longRunElevationGainM: r0(prev.longRunElevationGainM * f) },
      decision: 'reduce',
      reason: act.redDays >= 3 ? `${act.redDays} días en rojo la semana pasada` : `la semana pasada se hizo el ${Math.round(compliance * 100)} % de las horas previstas`,
    };
  }
  if (compliance < 0.8 && prev.kind === 'load') {
    return {
      target: { ...planned, targetHours: prev.targetHours, targetElevationGainM: prev.targetElevationGainM, longRunMin: prev.longRunMin, longRunElevationGainM: prev.longRunElevationGainM },
      decision: 'hold',
      reason: `la semana pasada se hizo el ${Math.round(compliance * 100)} % de las horas previstas: se repite su objetivo en vez de progresar`,
    };
  }
  return { target: planned, decision: 'as_planned', reason: 'la semana pasada se cumplió' };
}

/**
 * ¿Hay que rehacer el macro? Sí si las 2 últimas semanas de carga se quedaron por debajo
 * del 50 % de lo previsto (semanas perdidas, enfermedad, lesión). Se rehace desde hoy con
 * la carga real; la fecha de carrera y el afinado no cambian.
 */
export function needsReplan(macro: MacrocyclePlan, workouts: Workout[], checkIns: DailyCheckIn[], today: string = localDateKey()): string | null {
  const thisMonday = mondayOfKey(today);
  const past = (macro.weeks || []).filter((w) => w.monday < thisMonday && w.kind === 'load').slice(-2);
  if (past.length < 2) return null;
  const low = past.filter((w) => w.targetHours > 0 && weekActual(workouts, checkIns, w.monday).hours < w.targetHours * 0.5);
  return low.length === 2 ? `las semanas del ${past[0].monday} y del ${past[1].monday} se quedaron por debajo de la mitad de lo previsto` : null;
}

/** Semana actual/siguiente del macro para una fecha. */
export function weekOf(macro: MacrocyclePlan | null | undefined, monday: string): MicrocycleTarget | null {
  return macro?.weeks?.find((w) => w.monday === monday) ?? null;
}

export const PHASE_LABEL = PHASE_TITLE;

/** Texto para el prompt del plan semanal. */
export function describeWeekTarget(adj: AdjustedWeek, macro: MacrocyclePlan): string {
  const t = adj.target;
  const meso = macro.mesocycles.find((m) => t.monday >= m.startDate && t.monday <= m.endDate);
  const kind = { load: 'semana de carga', recovery: 'semana de DESCARGA', taper: 'semana de AFINADO', race: 'SEMANA DE CARRERA' }[t.kind];
  return [
    `Semana ${t.index + 1} de ${macro.totalWeeks} del plan hasta ${macro.targetRace.name} (${macro.raceDate}) · fase: ${PHASE_TITLE[t.phase]} · ${kind}.`,
    meso?.focus ? `Foco de la fase: ${meso.focus}` : '',
    `OBJETIVOS DE LA SEMANA (TOPES, fijados por el código): como mucho ${t.targetHours} h a pie y ${t.targetElevationGainM} m de D+ en total; tirada larga hasta ${t.longRunMin} min con hasta ${t.longRunElevationGainM} m de D+.`,
    adj.decision !== 'as_planned' ? `Ajuste de esta semana: ${adj.reason}.` : '',
    meso?.keyWorkouts?.length ? `Sesiones clave de la fase: ${meso.keyWorkouts.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// --- Marcadores de adaptación: los evalúa el código con datos medidos ---

export interface MarkerProgress {
  marker: AdaptationMarker;
  /** Valor medido en el mesociclo (null = sin dato). */
  value: number | null;
  /** true = conseguido; false = aún no; null = sin dato para decidirlo. */
  achieved: boolean | null;
}

export interface MarkerContext {
  aetHr?: number | null;
  /** Tolerancia de carbohidratos registrada (g/h), del perfil de gut training. */
  gutMaxCarbsPerHour?: number | null;
  /** Resultado del último test de deriva (%), si existe. */
  driftTestResultPct?: number | null;
}

export function evaluateMarkers(meso: Mesocycle, workouts: Workout[], checkIns: DailyCheckIn[], ctx: MarkerContext = {}, today: string = localDateKey()): MarkerProgress[] {
  const to = meso.endDate < today ? meso.endDate : today;
  const done = (workouts || []).filter((w) => w.completed && isOnFoot(w) && w.date >= meso.startDate && w.date <= to);
  const cis = (checkIns || []).filter((c) => c.date >= meso.startDate && c.date <= to);
  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
  return (meso.markers || []).map((marker) => {
    let value: number | null = null;
    let higherIsBetter = true;
    switch (marker.id) {
      case 'aerobic_share':
        value = hrAerobicShare(done, ctx.aetHr).pct;
        break;
      case 'drift_test':
        value = typeof ctx.driftTestResultPct === 'number' ? ctx.driftTestResultPct : null;
        return { marker, value, achieved: value !== null };
      case 'long_run':
        value = max(done.map((w) => w.actualDurationMin ?? 0).filter((v) => v > 0));
        break;
      case 'long_run_elevation':
        value = max(done.map((w) => w.actualElevationGainM ?? 0).filter((v) => v > 0));
        break;
      case 'descent_tolerance':
        higherIsBetter = false;
        value = max(cis.map((c) => c.muscleSoreness ?? 0).filter((v) => v > 0));
        break;
      case 'gut_tolerance':
        value = typeof ctx.gutMaxCarbsPerHour === 'number' && ctx.gutMaxCarbsPerHour > 0 ? ctx.gutMaxCarbsPerHour : null;
        break;
      case 'readiness_green': {
        const from = addDaysKey(to, -6);
        value = (checkIns || []).filter((c) => c.date >= from && c.date <= to && c.status === 'optimal').length;
        break;
      }
    }
    const achieved = value === null || marker.target === null ? null : higherIsBetter ? value >= marker.target : value <= marker.target;
    return { marker, value, achieved };
  });
}
