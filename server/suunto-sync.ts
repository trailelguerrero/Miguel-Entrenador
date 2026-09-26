// Sincronización con Suunto HECHA POR EL SERVIDOR (Fase B): lee los tokens cifrados,
// descarga de Suunto, fusiona con las reglas de src/brain/suuntoMerge.ts y guarda en
// Supabase. La lanzan el botón Sincronizar, la app al abrirse (si hace >3 h) y el
// cron diario de Vercel (9:00 en Madrid).
import type { Express, Request, Response } from 'express';
import type { AthleteProfile, DailyCheckIn, Workout } from '../src/types/index.js';
import { mergeSuuntoSyncData, type SuuntoMergeResult } from '../src/brain/suuntoMerge.js';
import { athleteToday, dateKeyInTimezone } from './brain/context.js';
import { safeEqual } from './auth.js';
import { storeReady } from './store/docStore.js';
import {
  getSingleton,
  getSuuntoAuth,
  listCheckIns,
  listWorkouts,
  loadSnapshot,
  putSingleton,
  saveChanged,
  saveSuuntoAuth,
  saveSuuntoStatus,
} from './store/athleteData.js';
import { ReconnectNeededError, fetchSuuntoData } from './suunto-routes.js';

export class SuuntoNotConnectedError extends Error {}

export interface ServerSyncResult {
  message: string;
  summary: Pick<SuuntoMergeResult, 'addedWorkouts' | 'completedPlanned' | 'checkInsAdded'>;
  profileChanges: SuuntoMergeResult['profileChanges'];
  freshZoneAdvice: SuuntoMergeResult['freshZoneAdvice'];
}

export async function runServerSync(today: string): Promise<ServerSyncResult> {
  const stored = await getSuuntoAuth();
  if (!stored?.accessToken) throw new SuuntoNotConnectedError('Suunto no está conectado. Pulsa "Conectar Suunto".');
  await saveSuuntoStatus({ syncStatus: 'syncing' });
  try {
    const r = await fetchSuuntoData(stored);
    if (r.refreshed) await saveSuuntoAuth(r.auth);

    const [profile, workouts, checkIns] = await Promise.all([
      getSingleton<AthleteProfile>('profile'),
      listWorkouts(),
      listCheckIns(),
    ]);
    const merged = mergeSuuntoSyncData({ profile: profile ?? ({} as AthleteProfile), workouts, checkIns }, r.payload, today);

    await putSingleton('profile', merged.profile);
    await saveChanged<Workout>('workouts', merged.workouts, (w) => w.id, workouts);
    await saveChanged<DailyCheckIn>('checkins', merged.checkIns, (c) => c.date, checkIns);

    const message = `${r.message} Nuevos: ${merged.addedWorkouts} entrenos añadidos, ${merged.completedPlanned} sesiones planificadas completadas, ${merged.checkInsAdded} check-ins.`;
    await saveSuuntoStatus({ syncStatus: 'synced', lastSync: new Date().toISOString(), lastSyncMessage: message, totalActivitiesSynced: r.payload.workouts.length });
    return {
      message,
      summary: { addedWorkouts: merged.addedWorkouts, completedPlanned: merged.completedPlanned, checkInsAdded: merged.checkInsAdded },
      profileChanges: merged.profileChanges,
      freshZoneAdvice: merged.freshZoneAdvice,
    };
  } catch (err) {
    if (err instanceof ReconnectNeededError) {
      await saveSuuntoAuth(null);
      await saveSuuntoStatus({ syncStatus: 'error', lastSyncMessage: `La conexión con Suunto caducó. Pulsa "Conectar Suunto" de nuevo. (${err.message})` });
    } else {
      await saveSuuntoStatus({ syncStatus: 'error', lastSyncMessage: `Fallo de sincronización: ${(err as Error).message}` });
    }
    throw err;
  }
}

function storeMissing(res: Response) {
  res.status(503).json({ code: 'STORE_NOT_CONFIGURED', error: 'Supabase no está configurado: los datos no se guardan en el servidor.', hint: 'Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
}

export function registerSuuntoSyncRoutes(app: Express) {
  // Botón Sincronizar y sincronización al abrir la app: devuelve el estado completo ya fusionado
  app.post('/api/suunto/sync', async (req: Request, res: Response) => {
    if (!(await storeReady().catch(() => false))) return storeMissing(res);
    try {
      const result = await runServerSync(athleteToday(req.body));
      res.json({ success: true, ...result, snapshot: await loadSnapshot() });
    } catch (err: any) {
      if (err instanceof SuuntoNotConnectedError || err instanceof ReconnectNeededError) {
        return res.status(401).json({
          success: false,
          needsReconnect: true,
          code: 'SUUNTO_AUTH',
          message: err instanceof ReconnectNeededError ? `La conexión con Suunto caducó. Pulsa "Conectar Suunto" de nuevo. (${err.message})` : err.message,
        });
      }
      console.error('Error in /api/suunto/sync:', err);
      res.status(502).json({ success: false, code: 'SUUNTO_UNAVAILABLE', error: err.message || 'Error al sincronizar con Suunto', hint: 'Vuelve a sincronizar en un momento. Si persiste, revisa los logs del proyecto mcp en Vercel.' });
    }
  });

  app.post('/api/suunto/disconnect', async (_req: Request, res: Response) => {
    if (!(await storeReady().catch(() => false))) return storeMissing(res);
    await saveSuuntoAuth(null);
    await saveSuuntoStatus({ syncStatus: 'pending', lastSyncMessage: 'Suunto desconectado.' });
    res.json({ ok: true });
  });

  // Cron de Vercel (vercel.json). Vercel envía "Authorization: Bearer <CRON_SECRET>".
  app.get('/api/cron/suunto-sync', async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ code: 'CRON_NOT_CONFIGURED', error: 'Falta CRON_SECRET en Vercel.' });
    if (!safeEqual(req.get('authorization'), `Bearer ${secret}`)) return res.status(401).json({ code: 'CRON_AUTH', error: 'No autorizado.' });
    if (!(await storeReady().catch(() => false))) return storeMissing(res);
    try {
      const result = await runServerSync(dateKeyInTimezone());
      res.json({ ok: true, message: result.message });
    } catch (err: any) {
      if (err instanceof SuuntoNotConnectedError) return res.json({ ok: true, skipped: 'Suunto no conectado' });
      console.error('Error in /api/cron/suunto-sync:', err);
      res.status(502).json({ ok: false, error: err.message });
    }
  });
}
