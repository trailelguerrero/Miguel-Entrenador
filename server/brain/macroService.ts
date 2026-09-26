/**
 * Plan largo hasta la carrera en el servidor. El CÓDIGO construye el esqueleto
 * (src/brain/macrocycle.ts: fechas, fases, objetivos semanales); Miguel solo
 * redacta, dentro de él, el porqué de cada fase y sus sesiones clave. Nada de lo
 * que escribe Miguel puede llevar cifras: los números son los del código.
 */
import type { AthleteProfile, DailyCheckIn, MacrocyclePlan, TargetRace, Workout } from '../../src/types/index.js';
import { buildMacrocycle, needsReplan } from '../../src/brain/macrocycle.js';
import { parseModelJson } from '../ai.js';
import { storeReady } from '../store/docStore.js';
import { getSingleton, isImported, listCheckIns, listWorkouts, putSingleton } from '../store/athleteData.js';
import { DEFAULT_TARGET } from './context.js';
import { MIGUEL_SYSTEM_INSTRUCTION } from './prompts/routes.js';
import type { AiCall } from './weeklyPlan.js';

export interface PlanningData {
  source: 'server' | 'client';
  profile: AthleteProfile | null;
  race: TargetRace;
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  macro: MacrocyclePlan | null;
}

/** Carrera por defecto del servidor como TargetRace completo. */
export const SERVER_DEFAULT_RACE: TargetRace = {
  id: 'transvulcania-2027',
  name: 'Transvulcania Ultramarathon 2027',
  date: DEFAULT_TARGET.date,
  dateConfirmed: DEFAULT_TARGET.dateConfirmed,
  distanceKm: DEFAULT_TARGET.distanceKm,
  elevationGainM: DEFAULT_TARGET.elevationGainM,
  elevationLossM: DEFAULT_TARGET.elevationLossM,
  priority: 'A',
  location: 'Isla de La Palma, Canarias',
} as TargetRace;

const validRace = (r: any): r is TargetRace => !!r && typeof r === 'object' && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date);

/** Datos para planificar: los del servidor si existen; si no, los que manda el navegador. */
export async function loadPlanningData(body: any = {}): Promise<PlanningData> {
  const fromBody = (): PlanningData => ({
    source: 'client',
    profile: body?.athleteProfile ?? null,
    race: validRace(body?.targetRace) ? body.targetRace : SERVER_DEFAULT_RACE,
    workouts: Array.isArray(body?.workouts) ? body.workouts : [],
    checkIns: Array.isArray(body?.checkIns) ? body.checkIns : [],
    macro: body?.macrocycle ?? null,
  });
  if (!(await storeReady().catch(() => false)) || !(await isImported().catch(() => false))) return fromBody();
  const [profile, raceS, workouts, checkIns, macro] = await Promise.all([
    getSingleton<AthleteProfile>('profile'),
    getSingleton<TargetRace>('targetRace'),
    listWorkouts(),
    listCheckIns(),
    getSingleton<MacrocyclePlan>('macrocycle'),
  ]);
  const race = validRace(raceS) ? raceS : validRace(body?.targetRace) ? body.targetRace : SERVER_DEFAULT_RACE;
  return { source: 'server', profile, race, workouts, checkIns, macro };
}

// Números, pulsaciones o ritmos: Miguel no puede ponerlos (las cifras son del código)
const HAS_FIGURES = /\d/;
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || HAS_FIGURES.test(t)) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Aplica al esqueleto SOLO los textos válidos de Miguel (sin cifras, ids conocidos). */
export function applyMacroTexts(macro: MacrocyclePlan, parsed: any): { macro: MacrocyclePlan; rejected: number } {
  let rejected = 0;
  const byId = new Map<string, any>((Array.isArray(parsed?.mesocycles) ? parsed.mesocycles : []).filter((m: any) => m && typeof m.id === 'string').map((m: any) => [m.id, m]));
  const mesocycles = macro.mesocycles.map((m) => {
    const ai = byId.get(m.id);
    if (!ai) return m;
    const focus = clean(ai.focus, 240);
    const rationale = clean(ai.rationale, 600);
    const keys = (Array.isArray(ai.keyWorkouts) ? ai.keyWorkouts : []).slice(0, 5);
    const keyWorkouts = keys.map((k: unknown) => clean(k, 160)).filter((k: string | null): k is string => !!k);
    rejected += (ai.focus && !focus ? 1 : 0) + (ai.rationale && !rationale ? 1 : 0) + (keys.length - keyWorkouts.length);
    return { ...m, focus: focus ?? m.focus, rationale: rationale ?? m.rationale, keyWorkouts };
  });
  return { macro: { ...macro, mesocycles }, rejected };
}

export function buildMacroPrompt(macro: MacrocyclePlan): string {
  const phases = macro.mesocycles.map((m) => ({
    id: m.id,
    fase: m.title,
    desde: m.startDate,
    hasta: m.endDate,
    foco_del_sistema: m.focus,
    marcadores: (m.markers || []).map((k) => k.label),
  }));
  const b = macro.baseline;
  return `
Has de explicar al atleta su PLAN HASTA ${macro.targetRace.name} (${macro.raceDate}). El sistema ya ha fijado, con reglas de código, las fechas, las fases y los objetivos semanales (horas, desnivel, tirada larga); tú NO los cambias.
Carga de partida medida: ${b ? `${b.weeklyHours} h/semana a pie, ${b.weeklyElevationGainM} m de D+/semana, tirada más larga ${b.longestRunMin} min${b.conservative ? ' (pocos datos: base conservadora)' : ''}` : 'sin dato'}.
Semanas totales: ${macro.totalWeeks}. Bloques de 3 semanas de carga + 1 de descarga; afinado las 2 semanas previas + la de carrera. Objetivo del atleta: terminar bien.

Fases (JSON): ${JSON.stringify(phases)}

Para CADA fase escribe:
- "focus": qué adaptación busca esa fase y por qué, en una o dos frases.
- "rationale": cómo encaja en el camino hasta la carrera y qué señales indicarán que la adaptación llega.
- "keyWorkouts": de 2 a 4 sesiones clave descritas por su propósito y forma (terreno, tipo de esfuerzo, bajadas, nutrición), SIN cifras.
REGLA ESTRICTA: NINGÚN texto puede contener números (ni pulsaciones, ni minutos, ni kilómetros, ni metros, ni porcentajes). Los textos con cifras se descartan.

Responde SOLO con JSON: {"mesocycles":[{"id":"meso-1","focus":"...","rationale":"...","keyWorkouts":["..."]}]}
`.trim();
}

/** Al rehacer sin Miguel, cada fase conserva lo que él ya había escrito para esa fase. */
export function inheritPhaseTexts(macro: MacrocyclePlan, prev: MacrocyclePlan | null): MacrocyclePlan {
  if (!prev?.mesocycles?.length) return macro;
  const byPhase = new Map(prev.mesocycles.filter((m) => m.phase).map((m) => [m.phase, m]));
  return {
    ...macro,
    mesocycles: macro.mesocycles.map((m) => {
      const old = m.phase ? byPhase.get(m.phase) : undefined;
      return old ? { ...m, focus: old.focus || m.focus, rationale: old.rationale ?? m.rationale, keyWorkouts: old.keyWorkouts?.length ? old.keyWorkouts : m.keyWorkouts } : m;
    }),
  };
}

export interface CreateMacroInput {
  data: PlanningData;
  today: string;
  ai: AiCall | null;
  reason: string;
}

/** Construye (o rehace) el macro, pide los textos a Miguel y lo guarda con versión e historial. */
export async function createMacrocycle({ data, today, ai, reason }: CreateMacroInput): Promise<{ macro: MacrocyclePlan; aiUsed: boolean; note?: string }> {
  let macro = inheritPhaseTexts(buildMacrocycle({ race: data.race, today, workouts: data.workouts }), data.macro);
  let aiUsed = false;
  let note: string | undefined;
  if (ai) {
    try {
      const parsed = parseModelJson(await ai({ system: MIGUEL_SYSTEM_INSTRUCTION, input: buildMacroPrompt(macro), json: true }));
      const r = applyMacroTexts(macro, parsed);
      macro = r.macro;
      aiUsed = true;
      if (r.rejected) note = `${r.rejected} textos de Miguel descartados por llevar cifras.`;
    } catch (err) {
      console.error('[macro] Miguel no pudo redactar las fases; se guarda el esqueleto:', err);
      note = 'Miguel no pudo redactar las fases: se guarda el plan con los textos del sistema.';
    }
  }
  const prev = data.macro;
  macro = {
    ...macro,
    version: (prev?.version ?? 0) + 1,
    log: [...(prev?.log ?? []), { date: today, message: reason }].slice(-30),
  };
  if (data.source === 'server') await putSingleton('macrocycle', macro);
  return { macro, aiUsed, note };
}

/** ¿Hay que rehacer el macro? (carrera cambiada o dos semanas de carga muy por debajo). */
export function replanReason(data: PlanningData, today: string): string | null {
  const m = data.macro;
  if (!m?.weeks?.length) return null;
  if (m.raceDate !== data.race.date) return `la fecha de la carrera ha cambiado (${m.raceDate} → ${data.race.date})`;
  return needsReplan(m, data.workouts, data.checkIns, today);
}
