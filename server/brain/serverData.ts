// El cerebro razona con los datos del SERVIDOR (Fase B, C1/C3). Con Supabase
// configurado, el perfil, la carrera, la memoria, el historial, los check-ins y la
// carga (CTL/ATL/TSB, readiness de hoy) se leen y se calculan aquí; lo que manda el
// navegador solo se usa para lo que el servidor aún no tiene (p. ej. antes de la
// importación) o no guarda todavía (nutrición, hidratación).
import type { AthleteHistoryDocument, AthleteProfile, CoachLearnedMemory, DailyCheckIn, MacrocyclePlan, TargetRace, Workout } from '../../src/types/index.js';
import { adjustedWeekTarget, describeWeekTarget } from '../../src/brain/macrocycle.js';
import { resolveIntensityPrescription } from '../../src/brain/intensity.js';
import { buildBrainContext, summarizeWeekWorkouts } from '../../src/brain/context.js';
import { storeReady } from '../store/docStore.js';
import { getSingleton, isImported, listCheckIns, listWorkouts } from '../store/athleteData.js';
import { athleteToday } from './context.js';

export type BrainRoute = 'chat' | 'generate-plan' | 'adapt-session' | 'analyze-workout' | 'memory';

export interface ServerDataResult {
  body: any;
  /** 'server' si se usaron datos del servidor; 'client' si no hay almacén o falló. */
  source: 'server' | 'client';
}

export async function withServerData(body: any, route: BrainRoute): Promise<ServerDataResult> {
  try {
    if (!(await storeReady())) return { body, source: 'client' };
    const today = athleteToday(body);
    // Hasta la subida única desde el navegador, el servidor no tiene tus datos: se usan los del navegador
    if (!(await isImported())) return { body, source: 'client' };
    const [profileS, targetRaceS, coachMemoryS, historyS, workouts, checkIns] = await Promise.all([
      getSingleton<AthleteProfile>('profile'),
      getSingleton<TargetRace>('targetRace'),
      getSingleton<CoachLearnedMemory>('coachMemory'),
      getSingleton<AthleteHistoryDocument>('historyMd'),
      listWorkouts(),
      listCheckIns(),
    ]);
    const profile: AthleteProfile = profileS ?? body?.athleteProfile ?? {};
    const out: any = { ...body, athleteProfile: profile };
    out.athleteHistoryDoc = historyS ?? body?.athleteHistoryDoc ?? null;
    const memory = coachMemoryS ?? body?.coachMemory ?? body?.currentMemory ?? null;
    const todayCheckIn: DailyCheckIn | null = checkIns.find((c) => c.date === today) ?? null;
    const plannedToday: Workout | null = workouts.find((w) => w.date === today && !w.completed && w.type !== 'rest') ?? null;
    const ctx = () => buildBrainContext(workouts, profile, checkIns, plannedToday, today);

    switch (route) {
      case 'chat':
        out.targetRace = targetRaceS ?? body?.targetRace;
        out.coachMemory = memory;
        out.currentReadiness = todayCheckIn ?? body?.currentReadiness;
        out.brainContext = ctx();
        break;
      case 'generate-plan':
        out.targetRace = targetRaceS ?? body?.targetRace;
        out.coachMemory = memory;
        out.loadContext = ctx();
        if (typeof body?.weekStartDate === 'string') {
          out.existingWorkouts = summarizeWeekWorkouts(workouts, body.weekStartDate, resolveIntensityPrescription(profile).antHr ?? undefined);
          // Objetivo de la semana del macrociclo, ajustado con lo que se hizo la anterior
          const macro = await getSingleton<MacrocyclePlan>('macrocycle');
          const adj = macro ? adjustedWeekTarget(macro, body.weekStartDate, workouts, checkIns) : null;
          if (macro && adj) {
            out.macrocycle = macro;
            out.weekTarget = adj.target;
            out.weekTargetText = describeWeekTarget(adj, macro);
          }
        }
        break;
      case 'adapt-session': {
        const c = ctx();
        out.checkIn = todayCheckIn ?? body?.checkIn;
        out.readinessInputs = { tsb: c.tsb, weeklyTss: c.weeklyTss, weeklyNonMeasuredTss: c.weeklyNonMeasuredTss, ctl: c.ctl };
        break;
      }
      case 'analyze-workout':
        out.coachMemory = memory;
        break;
      case 'memory':
        out.currentMemory = memory;
        break;
    }
    return { body: out, source: 'server' };
  } catch (err) {
    console.error(`[serverData] no se pudieron leer los datos del servidor (${route}); se usan los del navegador:`, err);
    return { body, source: 'client' };
  }
}

/** Middleware: sustituye req.body por el cuerpo con los datos del servidor. */
export function serverData(route: BrainRoute) {
  return async (req: any, res: any, next: () => void) => {
    const r = await withServerData(req.body, route);
    req.body = r.body;
    res.setHeader('X-Data-Source', r.source);
    next();
  };
}
