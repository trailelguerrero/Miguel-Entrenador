// API de datos del atleta (Fase B): el servidor es la fuente de verdad.
//   GET    /api/data                  → estado completo (perfil, carrera, memoria, historial, workouts, check-ins, Suunto)
//   PUT    /api/data/:singleton       → { data } (profile | target-race | coach-memory | history-md; data null = borrar)
//   POST   /api/data/workouts         → { upsert?: Workout[], delete?: string[] }
//   POST   /api/data/checkins         → { upsert?: DailyCheckIn[], delete?: string[] (fechas) }
//   POST   /api/data/import           → subida única de los datos del navegador (gana el más reciente)
import type { Express, Request, Response } from 'express';
import type { DailyCheckIn, Workout } from '../src/types/index.js';
import { docStore, storeReady, type Collection } from './store/docStore.js';
import { importFromBrowser, loadSnapshot, putSingleton, type SingletonName } from './store/athleteData.js';

const SINGLETON_PATHS: Record<string, SingletonName> = {
  profile: 'profile',
  'target-race': 'targetRace',
  'coach-memory': 'coachMemory',
  'history-md': 'historyMd',
};

const MAX_BATCH = 2000;
const isDateKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Validación mínima de forma (los esquemas completos llegan con C27). */
export function validWorkout(w: unknown): w is Workout {
  return isObject(w) && typeof w.id === 'string' && w.id.length > 0 && w.id.length <= 200 && isDateKey(w.date) && typeof w.type === 'string';
}
export function validCheckIn(c: unknown): c is DailyCheckIn {
  return isObject(c) && isDateKey(c.date);
}

function sendStoreError(res: Response, route: string, err: any) {
  console.error(`Error in ${route}:`, err);
  res.status(err?.httpStatus || 502).json({ code: err?.code || 'STORE_ERROR', error: err?.message || 'No se pudo guardar en el servidor.', hint: err?.hint });
}

async function guard(res: Response): Promise<boolean> {
  if (await storeReady().catch(() => false)) return true;
  res.status(503).json({ code: 'STORE_NOT_CONFIGURED', error: 'Supabase no está configurado: los datos no se guardan en el servidor.', hint: 'Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel y ejecuta scripts/init.sql en Supabase.' });
  return false;
}

async function applyBatch<T>(collection: Collection, body: any, valid: (x: unknown) => x is T, idOf: (x: T) => string): Promise<{ upserted: number; deleted: number } | string> {
  const upsert: unknown[] = Array.isArray(body?.upsert) ? body.upsert : [];
  const del: unknown[] = Array.isArray(body?.delete) ? body.delete : [];
  if (upsert.length + del.length > MAX_BATCH) return `Demasiados cambios en una petición (máx. ${MAX_BATCH}).`;
  const bad = upsert.findIndex((x) => !valid(x));
  if (bad >= 0) return `El registro ${bad} no tiene la forma correcta.`;
  if (del.some((id) => typeof id !== 'string' || !id)) return 'Ids de borrado inválidos.';
  const items = upsert as T[];
  if (items.length) await docStore().putMany(collection, items.map((x) => ({ id: idOf(x), data: x })));
  for (const id of del as string[]) await docStore().delete(collection, id);
  return { upserted: items.length, deleted: del.length };
}

export function registerDataRoutes(app: Express) {
  app.get('/api/data', async (_req: Request, res: Response) => {
    if (!(await guard(res))) return;
    try {
      res.json(await loadSnapshot());
    } catch (err) {
      sendStoreError(res, 'GET /api/data', err);
    }
  });

  app.put('/api/data/:name', async (req: Request, res: Response) => {
    if (!(await guard(res))) return;
    const name = SINGLETON_PATHS[String(req.params.name)];
    if (!name) return res.status(404).json({ code: 'NOT_FOUND', error: 'Documento desconocido.' });
    const data = req.body?.data;
    if (data !== null && !isObject(data)) return res.status(400).json({ code: 'BAD_INPUT', error: 'Falta el documento (data).' });
    try {
      await putSingleton(name, data);
      res.json({ ok: true });
    } catch (err) {
      sendStoreError(res, `PUT /api/data/${req.params.name}`, err);
    }
  });

  app.post('/api/data/workouts', async (req: Request, res: Response) => {
    if (!(await guard(res))) return;
    try {
      const r = await applyBatch<Workout>('workouts', req.body, validWorkout, (w) => w.id);
      if (typeof r === 'string') return res.status(400).json({ code: 'BAD_INPUT', error: r });
      res.json({ ok: true, ...r });
    } catch (err) {
      sendStoreError(res, 'POST /api/data/workouts', err);
    }
  });

  app.post('/api/data/checkins', async (req: Request, res: Response) => {
    if (!(await guard(res))) return;
    try {
      const r = await applyBatch<DailyCheckIn>('checkins', req.body, validCheckIn, (c) => c.date);
      if (typeof r === 'string') return res.status(400).json({ code: 'BAD_INPUT', error: r });
      res.json({ ok: true, ...r });
    } catch (err) {
      sendStoreError(res, 'POST /api/data/checkins', err);
    }
  });

  app.post('/api/data/import', async (req: Request, res: Response) => {
    if (!(await guard(res))) return;
    const b = req.body ?? {};
    const workouts = Array.isArray(b.workouts) ? b.workouts.filter(validWorkout) : [];
    const checkIns = Array.isArray(b.checkIns) ? b.checkIns.filter(validCheckIn) : [];
    try {
      const report = await importFromBrowser({
        profile: isObject(b.profile) ? (b.profile as any) : null,
        targetRace: isObject(b.targetRace) ? (b.targetRace as any) : null,
        coachMemory: isObject(b.coachMemory) ? (b.coachMemory as any) : null,
        historyMd: isObject(b.historyMd) ? (b.historyMd as any) : null,
        workouts,
        checkIns,
        suuntoAuth: isObject(b.suuntoAuth) ? (b.suuntoAuth as any) : null,
      });
      res.json({ ok: true, report, snapshot: await loadSnapshot() });
    } catch (err) {
      sendStoreError(res, 'POST /api/data/import', err);
    }
  });
}
