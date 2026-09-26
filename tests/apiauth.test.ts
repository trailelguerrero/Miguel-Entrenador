/** Fase B (C2): API cerrada por defecto, sesión de un solo usuario con cookie firmada. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import app from '../server/app.js';
import { createSessionToken, isPublicRoute, verifySessionToken } from '../server/auth.js';

async function withServer(fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

const post = (base: string, path: string, headers: Record<string, string> = {}, body: unknown = {}) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('C2. Rutas públicas: solo salud, login/logout/status y cron', () => {
  for (const p of ['/api/health', '/api/auth/login', '/api/auth/logout', '/api/auth/status', '/api/cron/suunto-sync']) assert.ok(isPublicRoute(p), p);
  for (const p of ['/api/chat', '/api/health/ai-test', '/api/suunto/sync', '/api/suunto/connect', '/api/data', '/api/knowledge/documents', '/api/conversations']) assert.ok(!isPublicRoute(p), p);
});

test('Sin APP_SECRET la app está abierta (decisión del atleta: un solo usuario, URL privada)', async () => {
  await withEnv({ APP_SECRET: undefined, INGEST_SECRET: 'ya-no-cuenta', SESSION_SECRET: undefined }, () =>
    withServer(async (base) => {
      // Llega a la ruta (400: falta el texto de la nota), sin pedir clave
      assert.equal((await post(base, '/api/coach-memory/extract-insight')).status, 400);
      assert.equal((await (await fetch(`${base}/api/health`)).json()).apiProtected, false);
      assert.deepEqual(await (await fetch(`${base}/api/auth/status`)).json(), { configured: false, authenticated: true });
    }),
  );
});

test('C2. Con clave: sin sesión 401; login correcto da cookie HttpOnly de 90 días y abre la API', async () => {
  await withEnv({ APP_SECRET: 'clave-app', INGEST_SECRET: 'clave-biblioteca', SESSION_SECRET: undefined }, () =>
    withServer(async (base) => {
      const r = await post(base, '/api/coach-memory/extract-insight');
      assert.equal(r.status, 401);
      assert.equal((await r.json()).code, 'AUTH_REQUIRED');

      assert.equal((await post(base, '/api/auth/login', {}, { key: 'mala' })).status, 401);
      const login = await post(base, '/api/auth/login', {}, { key: 'clave-app' });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie') || '';
      assert.match(cookie, /^mc_session=[^;]+;/);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /Max-Age=7776000/);
      assert.ok(!cookie.includes('clave-app'), 'la cookie no lleva la clave');

      const session = cookie.split(';')[0];
      // Con la cookie llega a la ruta (400: falta el texto de la nota)
      assert.equal((await post(base, '/api/coach-memory/extract-insight', { cookie: session })).status, 400);
      const status = await (await fetch(`${base}/api/auth/status`, { headers: { cookie: session } })).json();
      assert.deepEqual(status, { configured: true, authenticated: true });
      // Cookie manipulada → 401
      assert.equal((await post(base, '/api/coach-memory/extract-insight', { cookie: session + 'x' })).status, 401);
      // Scripts: la cabecera con APP_SECRET vale; INGEST_SECRET ya no existe para la app
      assert.equal((await post(base, '/api/coach-memory/extract-insight', { 'x-app-secret': 'clave-app' })).status, 400);
      assert.equal((await post(base, '/api/coach-memory/extract-insight', { 'x-ingest-secret': 'clave-biblioteca' })).status, 401);
      assert.equal((await post(base, '/api/auth/login', {}, { key: 'clave-biblioteca' })).status, 401);
      // Logout borra la cookie
      const out = await post(base, '/api/auth/logout', { cookie: session });
      assert.match(out.headers.get('set-cookie') || '', /Max-Age=0/);
    }),
  );
});

test('C2. Cambiar SESSION_SECRET revoca todas las sesiones; las caducadas no valen', async () => {
  await withEnv({ APP_SECRET: 'clave-app', SESSION_SECRET: 'uno' }, async () => {
    const t = createSessionToken();
    assert.ok(verifySessionToken(t));
    assert.ok(!verifySessionToken(t, Date.now() + 91 * 86400000));
    process.env.SESSION_SECRET = 'dos';
    assert.ok(!verifySessionToken(t));
  });
});
