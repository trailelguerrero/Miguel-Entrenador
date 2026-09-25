/**
 * Biblioteca de Miguel (RAG) y conversaciones en Supabase.
 * Las partes deterministas se prueban directamente; el flujo completo
 * (ingesta → búsqueda → guardado de chat) contra un Supabase y un proveedor de
 * embeddings simulados en un servidor HTTP local, sin claves reales.
 *
 *   npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { chunkText } from '../server/rag/chunker.js';
import { buildKnowledgeBlock, buildKnowledgeQuery } from '../server/brain/prompts/knowledge.js';
import { checkIngestSecret, ingestDocument, knowledgeConfigStatus, listDocuments, parseIngestInput, searchKnowledge, deleteDocument } from '../server/rag/knowledge.js';
import { embeddingModelId, missingEmbeddingVars } from '../server/rag/embeddings.js';
import { getConversation, listConversations, parseIncomingMessages, saveConversation } from '../server/rag/chatStore.js';
import { KnowledgeError } from '../server/rag/supabase.js';

const ENV_KEYS = [
  'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY',
  'OPENAI_BASE_URL', 'EMBEDDING_PROVIDER', 'GEMINI_EMBEDDING_MODEL', 'OPENAI_EMBEDDING_MODEL', 'INGEST_SECRET',
  'KNOWLEDGE_MATCH_THRESHOLD',
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function resetEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

// ── Troceado ───────────────────────────────────────────────────────────────
test('chunkText: texto corto = un fragmento; vacío = ninguno', () => {
  assert.deepEqual(chunkText('  hola  '), ['hola']);
  assert.deepEqual(chunkText('   \n '), []);
});

test('chunkText: fragmentos acotados, con solapamiento y sin perder texto', () => {
  const paragraphs = Array.from({ length: 30 }, (_, i) => `Párrafo ${i}. ${'palabra '.repeat(40).trim()}.`);
  const text = paragraphs.join('\n\n');
  const chunks = chunkText(text, { chunkSize: 500, overlap: 100 });
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.length <= 500, `fragmento de ${c.length}`);
  for (const p of paragraphs) assert.ok(chunks.some((c) => c.includes(p.slice(0, 20))), `falta ${p.slice(0, 12)}`);
});

// ── Prompt ─────────────────────────────────────────────────────────────────
test('buildKnowledgeQuery: pregunta corta de seguimiento incluye la anterior', () => {
  const q = buildKnowledgeQuery([
    { role: 'user', content: '¿Cómo entreno las bajadas técnicas para Transvulcania?' },
    { role: 'assistant', content: 'Con fuerza excéntrica…' },
    { role: 'user', content: '¿Y cuántas series?' },
  ]);
  assert.match(q, /bajadas técnicas/);
  assert.match(q, /cuántas series/);
});

test('buildKnowledgeBlock: vacío sin fragmentos; con fragmentos, etiquetas [B1] y reglas', () => {
  assert.equal(buildKnowledgeBlock([]), '');
  const block = buildKnowledgeBlock([{ title: 'Manual', source: 'libro', content: 'Texto del manual' }]);
  assert.match(block, /\[B1\] Manual \(libro\)/);
  assert.match(block, /NO son datos fisiológicos del atleta/);
});

// ── Validación y clave ─────────────────────────────────────────────────────
test('parseIngestInput valida título, texto y tamaño', () => {
  assert.deepEqual(parseIngestInput({ title: ' T ', text: ' x ', source: '' }), { title: 'T', text: 'x', source: undefined });
  assert.throws(() => parseIngestInput({ text: 'x' }), (e: KnowledgeError) => e.code === 'KB_INPUT' && e.httpStatus === 400);
  assert.throws(() => parseIngestInput({ title: 't', text: 'a'.repeat(200_001) }), (e: KnowledgeError) => e.httpStatus === 413);
});

test('checkIngestSecret: sin INGEST_SECRET no admite cambios; clave incorrecta = 401', () => {
  resetEnv();
  assert.throws(() => checkIngestSecret('lo-que-sea'), (e: KnowledgeError) => e.code === 'KB_CONFIG');
  process.env.INGEST_SECRET = 'secreto-correcto';
  assert.throws(() => checkIngestSecret(undefined), (e: KnowledgeError) => e.httpStatus === 401);
  assert.throws(() => checkIngestSecret('secreto-incorrect'), (e: KnowledgeError) => e.httpStatus === 401);
  assert.doesNotThrow(() => checkIngestSecret('secreto-correcto'));
});

// ── Proveedor de embeddings intercambiable ─────────────────────────────────
test('embeddings: Gemini por defecto; OpenAI con EMBEDDING_PROVIDER; proveedor desconocido detectado', () => {
  resetEnv();
  assert.equal(embeddingModelId(), 'gemini:gemini-embedding-001');
  assert.deepEqual(missingEmbeddingVars(), ['GEMINI_API_KEY']);
  process.env.EMBEDDING_PROVIDER = 'openai';
  process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';
  assert.equal(embeddingModelId(), 'openai:text-embedding-3-large');
  assert.deepEqual(missingEmbeddingVars(), ['OPENAI_API_KEY']);
  process.env.EMBEDDING_PROVIDER = 'otro';
  assert.deepEqual(missingEmbeddingVars(), ['EMBEDDING_PROVIDER']);
});

test('knowledgeConfigStatus: sin variables todo desactivado; con Supabase solo, se guarda el chat', () => {
  resetEnv();
  const off = knowledgeConfigStatus();
  assert.equal(off.enabled, false);
  assert.equal(off.chatHistoryEnabled, false);
  process.env.SUPABASE_URL = 'http://x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const partial = knowledgeConfigStatus();
  assert.equal(partial.chatHistoryEnabled, true);
  assert.equal(partial.enabled, false);
  assert.deepEqual(partial.missing, ['GEMINI_API_KEY']);
});

// ── Flujo completo contra servicios simulados ──────────────────────────────
// Embeddings de juguete: bolsa de palabras en 1536 dimensiones (normalizada).
function toyEmbedding(text: string): number[] {
  const v = new Array(1536).fill(0);
  const words = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  for (const w of words) {
    let h = 0;
    for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    v[h % 1536] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

const db = { documents: [] as any[], chat_sessions: [] as any[], chat_messages: [] as any[] };
let server: http.Server;
let seq = 1;

before(async () => {
  server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : null;
    const url = new URL(req.url!, 'http://x');
    const send = (code: number, data: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const single = String(req.headers.accept).includes('vnd.pgrst.object');

    if (url.pathname === '/v1/embeddings') {
      if (req.headers.authorization !== 'Bearer test-openai') return send(401, { error: { message: 'bad key' } });
      assert.equal(body.dimensions, 1536);
      return send(200, { data: body.input.map((t: string, index: number) => ({ index, embedding: toyEmbedding(t) })) });
    }
    if (req.headers.apikey !== 'test-service') return send(401, { message: 'bad apikey' });

    if (url.pathname === '/rest/v1/rpc/match_documents') {
      const q = body.query_embedding as number[];
      const rows = db.documents
        .filter((d) => !body.filter_model || d.metadata.embedding_model === body.filter_model)
        .map((d) => ({ id: d.id, content: d.content, metadata: d.metadata, similarity: q.reduce((s, x, i) => s + x * d.embedding[i], 0) }))
        .filter((r) => r.similarity > body.match_threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, body.match_count);
      return send(200, rows);
    }
    const table = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1] as keyof typeof db | undefined;
    if (!table || !db[table]) return send(404, { message: `no existe ${url.pathname}` });
    // Filtros PostgREST que usa la app: eq., in.(…), is.null
    const matches = (r: any) =>
      [...url.searchParams].every(([k, v]) => {
        const json = /^metadata->>(\w+)$/.exec(k);
        const value = json ? r.metadata?.[json[1]] : r[k];
        if (v.startsWith('eq.')) return String(value) === v.slice(3);
        if (v.startsWith('in.(')) return v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(value));
        if (v === 'is.null') return value == null;
        return true;
      });

    if (req.method === 'POST') {
      const rows = (Array.isArray(body) ? body : [body]).map((r: any) => {
        const row = { ...r, id: table === 'chat_sessions' ? randomUUID() : seq++, created_at: new Date().toISOString() };
        if (typeof row.embedding === 'string') row.embedding = JSON.parse(row.embedding);
        db[table].push(row);
        return row;
      });
      if (!String(req.headers.prefer).includes('return=representation')) {
        res.writeHead(201);
        return res.end();
      }
      return send(201, single ? rows[0] : rows);
    }
    if (req.method === 'PATCH') {
      for (const r of db[table].filter(matches)) Object.assign(r, body);
      res.writeHead(204);
      return res.end();
    }
    if (req.method === 'GET') {
      let rows = db[table].filter(matches);
      if (url.searchParams.get('select')?.includes('chat_messages(count)')) {
        rows = rows.map((r) => ({ ...r, chat_messages: [{ count: db.chat_messages.filter((m) => m.session_id === r.id).length }] }));
      }
      if (single) return rows.length === 1 ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: '0 rows', details: '', hint: null });
      return send(200, rows);
    }
    if (req.method === 'DELETE') {
      const removed = db[table].filter(matches);
      (db as any)[table] = db[table].filter((r) => !matches(r));
      return send(200, removed.map((r) => ({ id: r.id })));
    }
    send(405, { message: 'método no soportado' });
  });
  await new Promise<void>((r) => server.listen(0, r));
});

/** Apunta Supabase y los embeddings (proveedor OpenAI) al servidor simulado. */
function useMockServices() {
  const { port } = server.address() as AddressInfo;
  resetEnv();
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
  process.env.EMBEDDING_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.KNOWLEDGE_MATCH_THRESHOLD = '0.2';
}

after(() => {
  server?.close();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('ingesta → búsqueda → sustitución → borrado', async () => {
  useMockServices();
  const doc = {
    title: 'Fuerza excéntrica',
    source: 'apuntes',
    text: 'Los step-downs excéntricos protegen los cuádriceps en las bajadas largas de montaña.\n\n' +
      'El power-hiking en pendientes empinadas desarrolla la resistencia muscular específica.',
  };
  const first = await ingestDocument(doc);
  assert.equal(first.chunks, 1);
  assert.equal(first.replaced, 0);
  assert.equal(db.documents[0].metadata.embedding_model, 'openai:text-embedding-3-small');

  const hits = await searchKnowledge('¿Qué hago para los cuádriceps en las bajadas?');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, 'Fuerza excéntrica');
  assert.equal(hits[0].source, 'apuntes');

  assert.deepEqual(await searchKnowledge('xyzzy quux'), []);

  // Volver a subir el mismo título sustituye, no duplica.
  const again = await ingestDocument(doc);
  assert.equal(again.replaced, 1);
  assert.equal((await listDocuments()).length, 1);

  // Documentos de otro modelo de embeddings no se mezclan en la búsqueda.
  process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';
  assert.deepEqual(await searchKnowledge('cuádriceps bajadas'), []);
  delete process.env.OPENAI_EMBEDDING_MODEL;

  assert.equal(await deleteDocument('Fuerza excéntrica'), 1);
  assert.deepEqual(await listDocuments(), []);
});

test('conversaciones: solo se guarda lo nuevo, se listan y se cargan', async () => {
  useMockServices();
  const turn1 = parseIncomingMessages([
    { clientId: 'user-1', role: 'user', content: '¿Qué toca hoy?', timestamp: '2026-09-25T08:00:00.000Z' },
    { clientId: 'assistant-1', role: 'assistant', content: 'Rodaje suave en Z1 [B1].', knowledgeSources: [{ title: 'Manual', source: null, similarity: 0.7 }] },
  ]);
  const first = await saveConversation(undefined, turn1);
  assert.match(first.sessionId, /^[0-9a-f-]{36}$/);
  assert.equal(first.saved, 2);

  // Guardar otra vez lo mismo + un mensaje nuevo: solo entra el nuevo, en la misma conversación.
  const turn2 = parseIncomingMessages([...turn1, { clientId: 'user-2', role: 'user', content: '¿Y mañana?' }]);
  const second = await saveConversation(first.sessionId, turn2);
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.saved, 1);
  assert.equal(second.alreadySaved, 2);
  assert.deepEqual(second.clientIds, ['user-1', 'assistant-1', 'user-2']);

  // Un id inexistente o inválido abre una conversación nueva.
  assert.notEqual((await saveConversation('00000000-0000-4000-8000-000000000000', [])).sessionId, first.sessionId);
  assert.notEqual((await saveConversation('no-es-un-uuid', [])).sessionId, first.sessionId);

  const list = await listConversations();
  const summary = list.find((c) => c.id === first.sessionId)!;
  assert.equal(summary.title, '¿Qué toca hoy?');
  assert.equal(summary.messageCount, 3);

  const loaded = await getConversation(first.sessionId);
  assert.deepEqual(loaded.map((m) => [m.clientId, m.role, m.content]), [
    ['user-1', 'user', '¿Qué toca hoy?'],
    ['assistant-1', 'assistant', 'Rodaje suave en Z1 [B1].'],
    ['user-2', 'user', '¿Y mañana?'],
  ]);
  assert.equal(loaded[0].timestamp, '2026-09-25T08:00:00.000Z');
  assert.deepEqual(loaded[1].knowledgeSources, [{ title: 'Manual', source: null, similarity: 0.7 }]);
});

test('parseIncomingMessages rechaza mensajes sin id, rol o contenido', () => {
  const bad = (m: unknown) => assert.throws(() => parseIncomingMessages([m]), (e: KnowledgeError) => e.code === 'KB_INPUT');
  bad({ role: 'user', content: 'x' });
  bad({ clientId: 'a', role: 'system', content: 'x' });
  bad({ clientId: 'a', role: 'user', content: '  ' });
  assert.throws(() => parseIncomingMessages('nada'), (e: KnowledgeError) => e.httpStatus === 400);
});
