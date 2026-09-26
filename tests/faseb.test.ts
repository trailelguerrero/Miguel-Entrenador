/** Fase B: datos en el servidor, importación única, tokens cifrados, cron y cerebro con datos del servidor. */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import app from '../server/app.js';
import { MemoryDocStore, docStore, setDocStoreForTests } from '../server/store/docStore.js';
import { getSuuntoAuth, importFromBrowser, loadSnapshot, saveSuuntoAuth } from '../server/store/athleteData.js';
import { open, seal } from '../server/store/secretBox.js';
import { withServerData } from '../server/brain/serverData.js';
import { mergeSuuntoSyncData } from '../src/brain/suuntoMerge.js';
import type { AthleteProfile, DailyCheckIn, Workout } from '../src/types/index.js';

const prevEnv = { APP_SECRET: process.env.APP_SECRET, CRON_SECRET: process.env.CRON_SECRET, TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY };
process.env.APP_SECRET = 'clave-app';
after(() => {
  setDocStoreForTests(null);
  for (const [k, v] of Object.entries(prevEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

beforeEach(() => setDocStoreForTests(new MemoryDocStore()));

async function withServer(fn: (base: string, cookie: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'clave-app' }) });
    await fn(base, (login.headers.get('set-cookie') || '').split(';')[0]);
  } finally {
    server.close();
  }
}

const json = (cookie: string, method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', cookie },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const W = (o: Partial<Workout> & { id: string; date: string }): Workout => ({ title: 'Rodaje', type: 'easy_run', plannedDurationMin: 60, completed: false, ...o }) as Workout;
const CI = (o: Partial<DailyCheckIn> & { date: string }): DailyCheckIn =>
  ({ restingHr: 50, hrvRmssd: 60, hrvBaseline: 60, sleepHours: 7, sleepQuality: 80, status: 'optimal', coachAdvice: '', ...o }) as DailyCheckIn;

test('B. Tokens de Suunto cifrados: en la base no hay tokens legibles y con otra clave no se abren', async () => {
  process.env.TOKEN_ENCRYPTION_KEY = 'k1';
  await saveSuuntoAuth({ clientId: 'c', accessToken: 'ACCESS-123', refreshToken: 'REFRESH-456', expiresAt: 1 });
  const raw = JSON.stringify((await docStore().get('suunto_auth', 'current'))?.data);
  assert.ok(!raw.includes('ACCESS-123') && !raw.includes('REFRESH-456'));
  assert.equal((await getSuuntoAuth())?.accessToken, 'ACCESS-123');
  const box = seal({ a: 1 });
  process.env.TOKEN_ENCRYPTION_KEY = 'k2';
  assert.equal(open(box), null);
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

test('B. API de datos: sin sesión 401; con sesión guarda, lee, valida y borra', async () => {
  await withServer(async (base, cookie) => {
    assert.equal((await fetch(`${base}/api/data`)).status, 401);
    assert.equal((await fetch(`${base}/api/data/profile`, json(cookie, 'PUT', { data: { name: 'Yo', antHr: 170 } }))).status, 200);
    const w1 = W({ id: 'w1', date: '2026-09-20' });
    const w2 = W({ id: 'w2', date: '2026-09-21' });
    assert.equal((await fetch(`${base}/api/data/workouts`, json(cookie, 'POST', { upsert: [w1, w2] }))).status, 200);
    assert.equal((await fetch(`${base}/api/data/workouts`, json(cookie, 'POST', { upsert: [{ id: 'x' }] }))).status, 400);
    assert.equal((await fetch(`${base}/api/data/workouts`, json(cookie, 'POST', { delete: ['w1'] }))).status, 200);
    assert.equal((await fetch(`${base}/api/data/checkins`, json(cookie, 'POST', { upsert: [CI({ date: '2026-09-21' })] }))).status, 200);
    const snap = await (await fetch(`${base}/api/data`, { headers: { cookie } })).json();
    assert.equal(snap.profile.name, 'Yo');
    assert.deepEqual(snap.workouts.map((w: Workout) => w.id), ['w2']);
    assert.equal(snap.checkIns.length, 1);
    assert.equal(snap.imported, false);
    assert.equal(snap.suunto.connected, false);
  });
});

test('B. Sin Supabase la API de datos responde 503 STORE_NOT_CONFIGURED (la app sigue en modo local)', async () => {
  await withServer(async (base, cookie) => {
    setDocStoreForTests(null);
    const r = await fetch(`${base}/api/data`, { headers: { cookie } });
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return; // entorno con Supabase real
    assert.equal(r.status, 503);
    assert.equal((await r.json()).code, 'STORE_NOT_CONFIGURED');
  });
});

test('B. Importación única: la sesión del navegador + lo medido por Suunto del servidor, sin duplicados', async () => {
  // El servidor ya sincronizó Suunto antes de la importación
  await docStore().put('workouts', 'suunto-K1', W({ id: 'suunto-K1', date: '2026-09-20', completed: true, suuntoWorkoutKey: 'K1', actualTss: 80, actualDurationMin: 62 }));
  await docStore().put('checkins', '2026-09-20', CI({ date: '2026-09-20', source: 'suunto', hrvRmssd: 55 } as any));
  await docStore().put('profile', 'current', { name: 'de Suunto', maxHr: 190 });

  const planned = W({ id: 'plan-1', date: '2026-09-20', title: 'Rodaje Z1 con técnica', completed: true, suuntoWorkoutKey: 'K1', actualTss: 70 });
  const report = await importFromBrowser({
    profile: { name: 'Yo', antHr: 170 } as AthleteProfile,
    workouts: [planned, W({ id: 'plan-2', date: '2026-09-22' })],
    checkIns: [CI({ date: '2026-09-20', muscleSoreness: 7, stressLevel: 3, hrvRmssd: 99 }), CI({ date: '2026-09-19' })],
    suuntoAuth: { clientId: 'c', accessToken: 'tok', refreshToken: 'r', expiresAt: 1 },
  });
  const snap = await loadSnapshot();
  assert.equal(snap.imported, true);
  assert.equal(snap.profile?.name, 'Yo', 'el perfil sin marca de tiempo lo trae el navegador');
  const ids = snap.workouts.map((w) => w.id).sort();
  assert.deepEqual(ids, ['plan-1', 'plan-2'], 'la actividad de Suunto no queda duplicada');
  const merged = snap.workouts.find((w) => w.id === 'plan-1')!;
  assert.equal(merged.title, 'Rodaje Z1 con técnica');
  assert.equal(merged.actualTss, 80, 'lo medido lo pone Suunto (servidor)');
  const ci = snap.checkIns.find((c) => c.date === '2026-09-20')!;
  assert.equal(ci.hrvRmssd, 55);
  assert.equal(ci.muscleSoreness, 7);
  assert.equal(report.suuntoAuth, 'imported');
  assert.equal(snap.suunto.connected, true);
});

test('B. Importación: gana el más reciente cuando el registro trae marca de tiempo', async () => {
  await docStore().put('coach_memory', 'current', { lastUpdated: '2099-01-01T00:00:00Z', insights: [] });
  const r = await importFromBrowser({ coachMemory: { lastUpdated: '2020-01-01T00:00:00Z', insights: [] } as any });
  assert.equal(r.singletons.coachMemory, 'kept_server');
});

test('B. El cerebro usa los datos del servidor tras la importación (y los del navegador antes)', async () => {
  const body = { athleteProfile: { name: 'navegador', antHr: 150 }, athleteToday: '2026-09-25', weekStartDate: '2026-09-21' };
  const before = await withServerData(body, 'chat');
  assert.equal(before.source, 'client');
  assert.equal(before.body.athleteProfile.name, 'navegador');

  await importFromBrowser({
    profile: { name: 'servidor', antHr: 170, baselineHrv: 60 } as AthleteProfile,
    workouts: [W({ id: 'a', date: '2026-09-24', completed: true, actualTss: 100 }), W({ id: 'hoy', date: '2026-09-25', type: 'hill_intervals' })],
    checkIns: [CI({ date: '2026-09-25', hrvRmssd: 40, hrvBaseline: 60 })],
  });
  const chat = await withServerData(body, 'chat');
  assert.equal(chat.source, 'server');
  assert.equal(chat.body.athleteProfile.name, 'servidor');
  assert.equal(chat.body.brainContext.today, '2026-09-25', 'fecha del atleta, no la del servidor');
  assert.equal(chat.body.brainContext.weeklyTss, 100);
  assert.equal(chat.body.currentReadiness.hrvRmssd, 40);

  const plan = await withServerData(body, 'generate-plan');
  assert.deepEqual(plan.body.existingWorkouts.map((w: any) => w.date), ['2026-09-24', '2026-09-25']);

  const adapt = await withServerData({ ...body, checkIn: CI({ date: '2026-09-25', hrvRmssd: 99 }) }, 'adapt-session');
  assert.equal(adapt.body.checkIn.hrvRmssd, 40, 'el check-in de hoy es el del servidor');
  assert.equal(adapt.body.readinessInputs.weeklyTss, 100);
});

test('B. Cron de Suunto: CRON_SECRET opcional; con él, clave mala 401; sin Suunto conectado se salta', async () => {
  await withServer(async (base) => {
    delete process.env.CRON_SECRET;
    const open = await fetch(`${base}/api/cron/suunto-sync`);
    assert.equal(open.status, 200);
    assert.equal((await open.json()).skipped, 'Suunto no conectado');
    process.env.CRON_SECRET = 'cron-123';
    assert.equal((await fetch(`${base}/api/cron/suunto-sync`, { headers: { authorization: 'Bearer mala' } })).status, 401);
    const ok = await fetch(`${base}/api/cron/suunto-sync`, { headers: { authorization: 'Bearer cron-123' } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).skipped, 'Suunto no conectado');
  });
});

test('B. Sincronizar sin Suunto conectado → 401 SUUNTO_AUTH (pide reconectar)', async () => {
  await withServer(async (base, cookie) => {
    const r = await fetch(`${base}/api/suunto/sync`, json(cookie, 'POST', {}));
    assert.equal(r.status, 401);
    const d = await r.json();
    assert.equal(d.code, 'SUUNTO_AUTH');
    assert.equal(d.needsReconnect, true);
  });
});

test('B. Fusión de Suunto (pura): completa lo planificado del mismo deporte, conserva dolor/estrés y deduce la banda', () => {
  const r = mergeSuuntoSyncData(
    {
      profile: { hasChestStrap: undefined } as unknown as AthleteProfile,
      workouts: [W({ id: 'p', date: '2026-09-24', type: 'easy_run' })],
      checkIns: [CI({ date: '2026-09-24', muscleSoreness: 6, stressLevel: 4 })],
    },
    {
      workouts: [W({ id: 'suunto-Z', date: '2026-09-24', type: 'easy_run', completed: true, suuntoWorkoutKey: 'Z', actualTss: 50, zoneSenseBreakdown: { green: 90 } as any })],
      checkIns: [CI({ date: '2026-09-24', source: 'suunto', hrvRmssd: 45 } as any)],
    },
    '2026-09-25',
  );
  assert.equal(r.workouts.length, 1);
  assert.equal(r.completedPlanned, 1);
  assert.equal(r.workouts[0].actualTss, 50);
  assert.equal(r.checkIns[0].muscleSoreness, 6);
  assert.equal(r.checkIns[0].hrvRmssd, 45);
  assert.equal(r.profile.hasChestStrap, true);
  assert.equal(r.profile.hasChestStrapSource, 'suunto');
});
