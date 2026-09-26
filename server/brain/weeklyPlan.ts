/**
 * Plan semanal de Miguel: IA → limpieza → CONTRATO → readiness de hoy. Lo usan la
 * ruta /api/generate-plan (botón) y el cron del domingo (plan automático).
 */
import type { GenerateOptions } from '../ai.js';
import { parseModelJson } from '../ai.js';
import type { MacrocyclePlan } from '../../src/types/index.js';
import { adjustedWeekTarget, describeWeekTarget } from '../../src/brain/macrocycle.js';
import { deriveWeeklyStructurePolicy } from '../../src/utils/weekStructure.js';
import { MIGUEL_SYSTEM_INSTRUCTION, buildPlanPrompt } from './prompts/routes.js';
import { applyTodayReadinessToPlan, sanitizePlanWorkouts, validatePlanContract } from './decision/validate.js';

export type AiCall = (opts: GenerateOptions) => Promise<string>;

export type WeekPlanResult =
  | { ok: true; payload: any }
  | { ok: false; issues: string[] };

const isDateKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Objetivo de la semana cuando el servidor no lo ha calculado (sin almacén): el
 * macro que manda el navegador, sin ajuste por lo hecho (no hay entrenos aquí).
 */
function clientWeekTarget(body: any) {
  const macro: MacrocyclePlan | undefined = body?.macrocycle;
  if (body?.weekTarget || !macro?.weeks?.length || !isDateKey(body?.weekStartDate)) return;
  const adj = adjustedWeekTarget(macro, body.weekStartDate, [], []);
  if (!adj) return;
  body.weekTarget = adj.target;
  body.weekTargetText = describeWeekTarget(adj, macro);
}

export async function generateWeekPlan(input: any, ai: AiCall, startedAt = Date.now()): Promise<WeekPlanResult> {
  const body = { ...input };
  const { athleteProfile, weekStartDate, nutritionEvidence } = body;
  clientWeekTarget(body);
  // Semana en curso: solo desde planFromDate; lo ya hecho cuenta para la estructura
  const planFromDate = isDateKey(body.planFromDate) ? body.planFromDate : undefined;
  const t = body.weekTarget;
  const planOpts = {
    fromDate: planFromDate,
    done: (Array.isArray(body.existingWorkouts) ? body.existingWorkouts : [])
      .filter((w: any) => w?.status === 'hecha' && typeof w.date === 'string' && typeof w.type === 'string')
      .map((w: any) => ({ date: w.date, type: w.type, durationMin: Number(w.durationMin) || 0 })),
    weekTarget: t && t.targetHours > 0 ? { targetHours: t.targetHours, targetElevationGainM: t.targetElevationGainM, longRunMin: t.longRunMin } : undefined,
  };
  const basePrompt = buildPlanPrompt({ ...body, planFromDate });

  // Si incumple el contrato, un reintento con los motivos (si queda tiempo en la función de 60 s)
  const attempt = async (prompt: string) => {
    const parsed = parseModelJson(await ai({ system: MIGUEL_SYSTEM_INSTRUCTION, input: prompt, json: true }));
    const checked = sanitizePlanWorkouts(parsed.workouts, athleteProfile, weekStartDate, nutritionEvidence);
    return { parsed, checked, contract: validatePlanContract(checked.workouts, weekStartDate, deriveWeeklyStructurePolicy(athleteProfile), planOpts) };
  };
  let r = await attempt(basePrompt);
  if (r.contract.status === 'rejected' && Date.now() - startedAt < 25_000) {
    r = await attempt(`${basePrompt}\n\n[TU PROPUESTA ANTERIOR SE RECHAZÓ por: ${r.contract.issues.join('; ')}. Corrígelo cumpliendo la estructura obligatoria.]`);
  }
  if (r.contract.status === 'rejected') return { ok: false, issues: r.contract.issues };
  // La sesión de hoy del plan, recortada a los límites del motor de readiness
  const today = applyTodayReadinessToPlan(r.contract.workouts, body.loadContext, athleteProfile);
  return {
    ok: true,
    payload: {
      ...r.parsed,
      status: r.contract.status,
      workouts: today.workouts,
      validationNotes: [...r.checked.notes, ...r.contract.repairs, ...today.corrections],
      structureIssues: [],
      weekTarget: t ?? null,
    },
  };
}
