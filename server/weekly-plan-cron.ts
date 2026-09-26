// Plan automático del domingo (cron de Vercel) y plan largo hasta la carrera:
//   GET  /api/cron/weekly-plan      → sync Suunto → ¿rehacer macro? → plan de la semana siguiente
//   POST /api/generate-macrocycle   → crear/rehacer el macro (botón de Periodización)
import type { Express, Request, Response } from 'express';
import type { Workout } from '../src/types/index.js';
import { mergePlanIntoWorkouts } from '../src/brain/planMerge.js';
import { PHASE_LABEL, weekOf } from '../src/brain/macrocycle.js';
import { planningWindow } from '../src/utils/weekStructure.js';
import { generateText, type GenerateOptions } from './ai.js';
import { safeEqual } from './auth.js';
import { athleteToday, dateKeyInTimezone } from './brain/context.js';
import { createMacrocycle, loadPlanningData, replanReason } from './brain/macroService.js';
import { withServerData } from './brain/serverData.js';
import { generateWeekPlan, type AiCall } from './brain/weeklyPlan.js';
import { docStore, storeReady } from './store/docStore.js';
import { getSingleton, putSingleton, saveChanged } from './store/athleteData.js';
import { runServerSync } from './suunto-sync.js';

const phaseOf = (macro: any, monday: string) => {
  const w = macro ? weekOf(macro, monday) : null;
  return w ? `${PHASE_LABEL[w.phase]} hacia ${macro.targetRace?.name ?? 'la carrera'}` : undefined;
};

const ai = async (opts: GenerateOptions) => (await generateText(opts)).text;

export interface WeeklyRunResult {
  ok: boolean;
  skipped?: string;
  monday?: string;
  added?: number;
  messages: string[];
}

/** Lo que hace el cron del domingo. `force` rehace la semana aunque ya haya plan. */
export async function runWeeklyPlan(today: string, force = false, aiCall: AiCall = ai): Promise<WeeklyRunResult> {
  const t0 = Date.now();
  const messages: string[] = [];
  try {
    await runServerSync(today);
  } catch (err) {
    console.warn('[weekly-plan] sin sincronizar Suunto:', (err as Error).message);
  }

  let data = await loadPlanningData();
  if (data.source !== 'server') return { ok: false, skipped: 'el servidor aún no tiene los datos del atleta', messages };

  // Plan largo: se crea si no existe; se rehace ante desvíos grandes o cambio de fecha.
  // Sin IA aquí (tiempo de la función): cada fase conserva los textos que ya tenía.
  const why = !data.macro?.weeks?.length ? 'Plan hasta la carrera creado automáticamente.' : (() => {
    const r = replanReason(data, today);
    return r ? `Plan rehecho: ${r}. Se comprimen las fases intermedias; el afinado no se toca.` : null;
  })();
  if (why) {
    const { macro } = await createMacrocycle({ data, today, ai: null, reason: why });
    data = { ...data, macro };
    messages.push(why);
  }

  const { monday } = planningWindow(today);
  const hasPlan = data.workouts.some((w) => w.id.startsWith('gen-') && w.date >= monday && w.date <= planningWindow(today).sunday);
  if (hasPlan && !force) return { ok: true, skipped: `la semana del ${monday} ya está planificada`, monday, messages };

  const { body } = await withServerData({ weekStartDate: monday, planFromDate: monday, phaseFocus: phaseOf(data.macro, monday) }, 'generate-plan');
  const r = await generateWeekPlan(body, aiCall, t0);
  const macro = await getSingleton<any>('macrocycle');
  if (!r.ok) {
    const msg = `No he podido dejar planificada la semana del ${monday}: ${r.issues.join('; ')}. Pulsa "Planificar semana".`;
    if (macro) await putSingleton('macrocycle', { ...macro, log: [...(macro.log ?? []), { date: today, message: msg }].slice(-30) });
    return { ok: false, monday, messages: [...messages, msg] };
  }

  const merged = mergePlanIntoWorkouts(data.workouts, r.payload.workouts as Partial<Workout>[], monday, monday);
  await saveChanged('workouts', merged.added, (w) => w.id, []);
  for (const id of merged.replacedIds) await docStore().delete('workouts', id);

  const t = r.payload.weekTarget;
  const msg = `He planificado la semana del ${monday}: ${merged.added.filter((w) => w.type !== 'rest').length} sesiones${t ? ` (tope del plan: ${t.targetHours} h y ${t.targetElevationGainM} m de D+)` : ''}. Tu estado de cada mañana sigue mandando.`;
  if (macro) await putSingleton('macrocycle', { ...macro, log: [...(macro.log ?? []), { date: today, message: msg }].slice(-30) });
  return { ok: true, monday, added: merged.added.length, messages: [...messages, msg] };
}

export function registerWeeklyPlanRoutes(app: Express) {
  app.get('/api/cron/weekly-plan', async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (secret && !safeEqual(req.get('authorization'), `Bearer ${secret}`)) return res.status(401).json({ code: 'CRON_AUTH', error: 'No autorizado.' });
    if (!(await storeReady().catch(() => false))) return res.status(503).json({ code: 'STORE_NOT_CONFIGURED', error: 'Supabase no está configurado.' });
    try {
      res.json(await runWeeklyPlan(dateKeyInTimezone()));
    } catch (err: any) {
      console.error('Error in /api/cron/weekly-plan:', err);
      res.status(502).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/generate-macrocycle', async (req: Request, res: Response) => {
    try {
      const today = athleteToday(req.body);
      const data = await loadPlanningData(req.body);
      // La carrera del navegador se guarda en el servidor si allí no había ninguna
      if (data.source === 'server' && req.body?.targetRace?.date && !(await getSingleton('targetRace'))) await putSingleton('targetRace', req.body.targetRace);
      const reason = data.macro?.weeks?.length ? 'Plan rehecho a petición del atleta.' : 'Plan hasta la carrera creado.';
      const r = await createMacrocycle({ data, today, ai, reason });
      res.json({ macrocycle: r.macro, aiUsed: r.aiUsed, note: r.note, source: data.source });
    } catch (err: any) {
      console.error('Error in /api/generate-macrocycle:', err);
      res.status(400).json({ code: 'MACRO_ERROR', error: err.message || 'No se pudo crear el plan.' });
    }
  });
}
