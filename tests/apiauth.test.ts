/** G2: las rutas de IA exigen la clave de la app cuando está configurada. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import app, { isProtectedRoute } from '../server/app.js';

async function withServer(fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

const post = (base: string, path: string, secret?: string) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-app-secret': secret } : {}) }, body: JSON.stringify({}) });

test('G2. Rutas protegidas: IA y memoria sí; salud y Suunto no', () => {
  for (const p of ['/api/chat', '/api/generate-plan', '/api/adapt-session', '/api/analyze-workout', '/api/coach-memory/extract-insight', '/api/race-info', '/api/parse-markdown-history', '/api/health/ai-test']) assert.ok(isProtectedRoute(p), p);
  for (const p of ['/api/health', '/api/suunto/callback', '/api/suunto/sync-history', '/api/chatx']) assert.ok(!isProtectedRoute(p), p);
});

test('G2. Con APP_SECRET/INGEST_SECRET: sin clave → 401 APP_AUTH; con cualquiera de las dos pasa', async () => {
  const prev = { a: process.env.APP_SECRET, i: process.env.INGEST_SECRET };
  process.env.APP_SECRET = 'clave-app';
  process.env.INGEST_SECRET = 'clave-biblioteca';
  try {
    await withServer(async (base) => {
      const r = await post(base, '/api/coach-memory/extract-insight');
      assert.equal(r.status, 401);
      assert.equal((await r.json()).code, 'APP_AUTH');
      assert.equal((await post(base, '/api/coach-memory/extract-insight', 'mala')).status, 401);
      // Con clave válida llega a la ruta (400: falta el texto de la nota)
      assert.equal((await post(base, '/api/coach-memory/extract-insight', 'clave-app')).status, 400);
      assert.equal((await post(base, '/api/coach-memory/extract-insight', 'clave-biblioteca')).status, 400);
      const health = await (await fetch(`${base}/api/health`)).json();
      assert.equal(health.apiProtected, true);
    });
  } finally {
    if (prev.a === undefined) delete process.env.APP_SECRET; else process.env.APP_SECRET = prev.a;
    if (prev.i === undefined) delete process.env.INGEST_SECRET; else process.env.INGEST_SECRET = prev.i;
  }
});

test('G2. Sin claves configuradas sigue abierta (compatibilidad) y health lo avisa', async () => {
  const prev = { a: process.env.APP_SECRET, i: process.env.INGEST_SECRET };
  delete process.env.APP_SECRET;
  delete process.env.INGEST_SECRET;
  try {
    await withServer(async (base) => {
      assert.equal((await post(base, '/api/coach-memory/extract-insight')).status, 400);
      assert.equal((await (await fetch(`${base}/api/health`)).json()).apiProtected, false);
    });
  } finally {
    if (prev.a !== undefined) process.env.APP_SECRET = prev.a;
    if (prev.i !== undefined) process.env.INGEST_SECRET = prev.i;
  }
});
