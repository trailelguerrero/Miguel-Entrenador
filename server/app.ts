import express, { Request, Response } from 'express';
import { AiError, aiConfigStatus, classifyAiError, generateText, GenerateOptions, modelFor, parseModelJson, searchWithGemini } from './ai.js';
import { registerSuuntoRoutes } from './suunto-routes.js';
import { registerSuuntoSyncRoutes } from './suunto-sync.js';
import { registerDataRoutes } from './data-routes.js';
import { serverData } from './brain/serverData.js';
import { storeProblem, storeReady } from './store/docStore.js';
import { SESSION_DAYS, createSessionToken, isAuthenticated, loginSecrets, requireSession, secretMatches, sessionCookie } from './auth.js';
import { sanitizeEvidenceItems } from '../src/brain/memory.js';
// Cerebro de Miguel en el servidor: prompts (texto), contexto (hechos→texto) y decisión (validación en código)
import {
  MIGUEL_SYSTEM_INSTRUCTION,
  buildAdaptPrompt,
  buildAnalyzePrompt,
  buildChatConversation,
  buildChatEvidencePrompt,
  buildHistoryPrompt,
  buildNoteEvidencePrompt,
  buildPlanPrompt,
} from './brain/prompts/routes.js';
import { RACE_EXTRACTION_SYSTEM, RACE_SEARCH_SYSTEM, buildRaceAdvicePrompt, buildRaceExtractionPrompt, buildRaceSearchPrompt } from './brain/prompts/race.js';
import { athleteToday, resolveReadinessState } from './brain/context.js';
import { applyTodayReadinessToPlan, sanitizeAdaptation, sanitizePlanWorkouts, validatePlanContract } from './brain/decision/validate.js';
import { filterRaceAdvice, RACE_NUMERIC_FIELDS, RACE_TEXT_FIELDS, targetFigures, verifyRaceInfo } from './brain/decision/race.js';
import { verifyHistoryNumbers } from './brain/decision/history.js';
import { RETRIEVED_DATA_RULE, buildKnowledgeBlock, buildLibraryIndexBlock, buildKnowledgeQuery, buildMemoryBlock, chatTurnsFromBody, withRetrievedContext } from './brain/prompts/knowledge.js';
import { MemoryMatch, indexConversation, searchConversationMemory } from './rag/conversationMemory.js';
import { KnowledgeError } from './rag/supabase.js';
import { getConversation, listConversations, parseIncomingMessages, saveConversation } from './rag/chatStore.js';
import {
  KnowledgeMatch,
  deleteDocument,
  ingestDocument,
  knowledgeConfigStatus,
  listDocuments,
  listDocumentsCached,
  clearDocumentIndexCache,
  getDocumentContent,
  parseIngestInput,
  embedQuery,
  searchKnowledge,
} from './rag/knowledge.js';

// App Express con todas las rutas /api/*. No escucha en ningún puerto:
// - En Vercel la exporta api/index.ts como función serverless.
// - En local la monta server.ts junto con Vite.
const app = express();

app.use(express.json({ limit: '25mb' }));

// Acceso: sin APP_SECRET la app está abierta (un solo atleta, URL privada); con
// APP_SECRET, toda /api/* exige sesión salvo salud, login y cron (server/auth.ts).
app.use(requireSession);

app.post('/api/auth/login', (req: Request, res: Response) => {
  if (!loginSecrets().length) return res.json({ ok: true, open: true });
  const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
  if (!secretMatches(key)) return res.status(401).json({ error: 'Clave incorrecta.', code: 'AUTH_BAD_KEY' });
  res.setHeader('Set-Cookie', sessionCookie(req, createSessionToken()));
  res.json({ ok: true, days: SESSION_DAYS });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', sessionCookie(req, null));
  res.json({ ok: true });
});

app.get('/api/auth/status', (req: Request, res: Response) => {
  // Sin APP_SECRET la app está abierta: cualquiera cuenta como autenticado
  res.json({ configured: loginSecrets().length > 0, authenticated: !loginSecrets().length || isAuthenticated(req) });
});

// Llama a la IA y, si respondió el respaldo (Gemini en vez de Experiential),
// lo avisa al navegador con la cabecera X-AI-Fallback (la app muestra un aviso).
async function runAi(res: Response, opts: GenerateOptions): Promise<string> {
  const result = await generateText(opts);
  if (result.fallback) {
    res.setHeader('X-AI-Fallback', encodeURIComponent(`${result.fallback.code}: ${result.fallback.reason}`));
  }
  return result.text;
}

// Respuesta de error común para todas las rutas de IA: código + mensaje claro
// + qué hacer, que la app muestra en el banner "Error de API de IA".
function sendAiError(res: Response, route: string, err: unknown) {
  const aiErr = err instanceof AiError ? err : classifyAiError(err, (process.env.AI_PROVIDER as any) === 'experiential' ? 'experiential' : 'gemini');
  console.error(`Error in ${route}: [${aiErr.code}] ${aiErr.message}`, aiErr.detail ?? '');
  res.status(aiErr.httpStatus).json({
    error: aiErr.message,
    code: aiErr.code,
    hint: aiErr.hint,
    provider: aiErr.provider,
  });
}

// Estado de la configuración (no gasta tokens): la app lo consulta al abrirse.
app.get('/api/health', async (_req: Request, res: Response) => {
  const dataStore = await storeReady().catch(() => false);
  res.json({
    ok: true,
    ai: aiConfigStatus(),
    knowledge: knowledgeConfigStatus(),
    // false = sin APP_SECRET: la app está abierta a quien tenga la URL
    apiProtected: loginSecrets().length > 0,
    // true = los datos del atleta viven en Supabase (Fase B)
    dataStore,
    ...(dataStore ? {} : { dataStoreProblem: storeProblem() }),
    suuntoMcpUrl: process.env.SUUNTO_MCP_URL || 'https://mcp-ten-kappa.vercel.app',
  });
});

// Prueba real y mínima de la IA (botón "Probar IA" de la app).
app.post('/api/health/ai-test', async (_req: Request, res: Response) => {
  const started = Date.now();
  try {
    const result = await generateText({
      system: 'Eres un comprobador de conexión.',
      input: 'Responde únicamente con la palabra: OK',
      temperature: 0,
    });
    res.json({
      ok: true,
      provider: result.provider,
      model: modelFor(result.provider, false),
      latencyMs: Date.now() - started,
      reply: result.text.trim().slice(0, 40),
      fallback: result.fallback,
    });
  } catch (err) {
    sendAiError(res, '/api/health/ai-test', err);
  }
});

// Tiempo máximo buscando en la biblioteca antes de responder sin ella.
const KNOWLEDGE_TIMEOUT_MS = 8_000;

/** Busca en la Biblioteca de Miguel y en las conversaciones anteriores guardadas
 * (con un único embedding de la pregunta). Nunca rompe el chat: sin configurar o
 * con error, Miguel responde como siempre y se devuelve un aviso. */
async function findContext(
  query: string,
  currentSessionId: unknown,
): Promise<{ matches: KnowledgeMatch[]; memories: MemoryMatch[]; warning?: string }> {
  if (!query || !knowledgeConfigStatus().enabled) return { matches: [], memories: [] };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), KNOWLEDGE_TIMEOUT_MS);
    });
    const search = async () => {
      const embedding = await embedQuery(query);
      const [matches, memories] = await Promise.all([
        searchKnowledge(embedding),
        searchConversationMemory(embedding, typeof currentSessionId === 'string' ? currentSessionId : null),
      ]);
      return { matches, memories };
    };
    return await Promise.race([search(), timeout]);
  } catch (err) {
    const e = err as KnowledgeError;
    console.error(`[knowledge] Búsqueda fallida: ${e.message}`, e.detail ?? '');
    return {
      matches: [],
      memories: [],
      warning: e.message === 'timeout'
        ? 'La biblioteca tardó demasiado; Miguel respondió sin ella ni sus conversaciones anteriores.'
        : `Biblioteca no disponible: ${e.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function sendKnowledgeError(res: Response, route: string, err: unknown) {
  if (err instanceof KnowledgeError) {
    if (err.httpStatus >= 500) console.error(`Error in ${route}: [${err.code}] ${err.message}`, err.detail ?? '');
    res.status(err.httpStatus).json({ error: err.message, code: err.code, hint: err.hint });
    return;
  }
  console.error(`Error in ${route}:`, (err as Error)?.message ?? err);
  res.status(500).json({ error: 'Error inesperado en la Biblioteca de Miguel.', code: 'KB_UNKNOWN', hint: 'Revisa los logs de Vercel.' });
}

// Biblioteca de Miguel (RAG): añadir, listar, ver y borrar documentos.
app.post('/api/knowledge/ingest', async (req: Request, res: Response) => {
  try {
    const input = parseIngestInput(req.body);
    const result = await ingestDocument(input);
    clearDocumentIndexCache();
    res.json({ ok: true, title: input.title, ...result });
  } catch (err) {
    sendKnowledgeError(res, '/api/knowledge/ingest', err);
  }
});

app.get('/api/knowledge/documents', async (req: Request, res: Response) => {
  try {
    res.json({ documents: await listDocuments() });
  } catch (err) {
    sendKnowledgeError(res, '/api/knowledge/documents', err);
  }
});

app.get('/api/knowledge/documents/content', async (req: Request, res: Response) => {
  try {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    if (!title) throw new KnowledgeError('KB_INPUT', 'Falta el título del documento.', 'Usa ?title=…', 400);
    res.json(await getDocumentContent(title));
  } catch (err) {
    sendKnowledgeError(res, '/api/knowledge/documents/content', err);
  }
});

app.delete('/api/knowledge/documents', async (req: Request, res: Response) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) throw new KnowledgeError('KB_INPUT', 'Falta el título del documento a borrar.', 'Envía JSON con "title".', 400);
    const deleted = await deleteDocument(title);
    clearDocumentIndexCache();
    res.json({ ok: true, deleted });
  } catch (err) {
    sendKnowledgeError(res, '/api/knowledge/documents', err);
  }
});

// Conversaciones en Supabase: solo se guardan cuando el atleta pulsa "Guardar
// en Supabase" en el chat. No hay ruta para borrarlas. Misma clave que la biblioteca.
app.post('/api/conversations/save', async (req: Request, res: Response) => {
  try {
    const messages = parseIncomingMessages(req.body?.messages);
    const result = await saveConversation(req.body?.sessionId, messages);
    // Memoria de conversaciones: si falla, los mensajes ya están guardados y el
    // siguiente guardado vuelve a intentarlo.
    let memoryIndexed = 0;
    let memoryWarning: string | undefined;
    try {
      memoryIndexed = (await indexConversation(result.sessionId)).indexed;
    } catch (err) {
      const e = err as KnowledgeError;
      console.error(`[conversation-memory] No se pudo indexar: ${e.message}`, e.detail ?? '');
      memoryWarning = `Mensajes guardados, pero Miguel aún no podrá recordarlos: ${e.message} Se reintentará en el próximo guardado.`;
    }
    res.json({ ok: true, ...result, memoryIndexed, ...(memoryWarning ? { memoryWarning } : {}) });
  } catch (err) {
    sendKnowledgeError(res, '/api/conversations/save', err);
  }
});

app.get('/api/conversations', async (req: Request, res: Response) => {
  try {
    res.json({ conversations: await listConversations() });
  } catch (err) {
    sendKnowledgeError(res, '/api/conversations', err);
  }
});

app.get('/api/conversations/:id', async (req: Request, res: Response) => {
  try {
    res.json({ sessionId: req.params.id, messages: await getConversation(req.params.id) });
  } catch (err) {
    sendKnowledgeError(res, '/api/conversations/:id', err);
  }
});

// 1. Interactive Chat with Miguel
app.post('/api/chat', serverData('chat'), async (req: Request, res: Response) => {
  try {
    const conversation = buildChatConversation(req.body);
    // Se busca con lo que escribió el atleta, no con `conversation`: esta lleva
    // el contexto completo (perfil, carga…) incrustado en el último mensaje.
    const knowledge = await findContext(buildKnowledgeQuery(chatTurnsFromBody(req.body)), req.body?.sessionId);

    // Lo recuperado va en el mensaje del atleta, marcado como dato (no en el system prompt)
    // Índice de la biblioteca (títulos): Miguel sabe qué documentos tiene
    const index = knowledgeConfigStatus().enabled ? buildLibraryIndexBlock(await listDocumentsCached().catch(() => [])) : '';
    const retrieved = buildKnowledgeBlock(knowledge.matches) + index + buildMemoryBlock(knowledge.memories);
    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION + (retrieved ? RETRIEVED_DATA_RULE : ''),
      input: withRetrievedContext(conversation, retrieved),
      temperature: 0.7,
    });

    const reply = text || 'Oye, ha habido un pequeño corte en la comunicación, pero aquí estoy. Cuéntame cómo vas.';
    res.json({
      reply,
      knowledgeSources: knowledge.matches.map(({ title, source, similarity }) => ({ title, source, similarity })),
      memorySources: knowledge.memories.map(({ sessionId, sessionTitle, date, similarity }) => ({ sessionId, sessionTitle, date, similarity })),
      ...(knowledge.warning ? { knowledgeWarning: knowledge.warning } : {}),
    });
  } catch (err) {
    sendAiError(res, '/api/chat', err);
  }
});

// 2. Generate Plan / Microcycle Workouts
app.post('/api/generate-plan', serverData('generate-plan'), async (req: Request, res: Response) => {
  try {
    const { athleteProfile, weekStartDate, nutritionEvidence } = req.body;
    if (typeof weekStartDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return res.status(400).json({ error: 'Falta el lunes de la semana (weekStartDate).', code: 'PLAN_INPUT' });
    }
    const t0 = Date.now();
    const basePrompt = buildPlanPrompt(req.body);

    // Plan de la IA → limpieza → CONTRATO DEL PLAN. Si lo incumple, un reintento
    // con los motivos (si queda tiempo en la función de 60 s); si no, se rechaza.
    const attempt = async (prompt: string) => {
      const parsed = parseModelJson(await runAi(res, { system: MIGUEL_SYSTEM_INSTRUCTION, input: prompt, json: true }));
      const checked = sanitizePlanWorkouts(parsed.workouts, athleteProfile, weekStartDate, nutritionEvidence);
      return { parsed, checked, contract: validatePlanContract(checked.workouts, weekStartDate) };
    };
    let r = await attempt(basePrompt);
    if (r.contract.status === 'rejected' && Date.now() - t0 < 25_000) {
      r = await attempt(`${basePrompt}\n\n[TU PROPUESTA ANTERIOR SE RECHAZÓ por: ${r.contract.issues.join('; ')}. Corrígelo cumpliendo la estructura obligatoria.]`);
    }
    if (r.contract.status === 'rejected') {
      return res.status(422).json({
        status: 'rejected',
        code: 'PLAN_REJECTED',
        error: 'El plan de Miguel no cumple la estructura obligatoria y no se ha guardado.',
        issues: r.contract.issues,
        hint: 'Vuelve a pulsar "Generar semana con Miguel".',
      });
    }
    // La sesión de hoy del plan, recortada a los límites del motor de readiness
    const today = applyTodayReadinessToPlan(r.contract.workouts, req.body?.loadContext, athleteProfile);
    res.json({
      ...r.parsed,
      status: r.contract.status,
      workouts: today.workouts,
      validationNotes: [...r.checked.notes, ...r.contract.repairs, ...today.corrections],
      structureIssues: [],
    });
  } catch (err) {
    sendAiError(res, '/api/generate-plan', err);
  }
});

// 3. Adapt Session in Real-Time based on Morning HRV & Sleep
app.post('/api/adapt-session', serverData('adapt-session'), async (req: Request, res: Response) => {
  try {
    const { athleteProfile } = req.body;
    // Estado y límites del motor determinista (del cliente, o desde el check-in)
    const state = resolveReadinessState(req.body);

    const prompt = buildAdaptPrompt(req.body, state);

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    // Recorte determinista a los límites del motor de readiness
    const checked = sanitizeAdaptation(parsed.adaptedWorkout, state, athleteProfile, req.body?.originalWorkout);
    res.json({ ...parsed, adaptedWorkout: checked.adapted, corrections: checked.corrections, readinessState: state });
  } catch (err) {
    sendAiError(res, '/api/adapt-session', err);
  }
});

// 4. Workout Debrief & FIT Analysis by Miguel (with Continuous Learning)
app.post('/api/analyze-workout', serverData('analyze-workout'), async (req: Request, res: Response) => {
  try {
    const { coachMemory } = req.body;
    const prompt = buildAnalyzePrompt(req.body);

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    // Evidencias validadas en código (ids existentes, categorías válidas, máximo por sesión)
    res.json({ feedback: parsed.feedback, evidence: sanitizeEvidenceItems(parsed.evidence, coachMemory) });
  } catch (err) {
    sendAiError(res, '/api/analyze-workout', err);
  }
});

// 5. Extract Learned Insight from Conversation / Note
app.post('/api/coach-memory/extract-insight', serverData('memory'), async (req: Request, res: Response) => {
  try {
    const { noteText, currentMemory } = req.body;

    if (!noteText) {
      return res.status(400).json({ error: 'Texto no proporcionado' });
    }

    const prompt = buildNoteEvidencePrompt(noteText, currentMemory, athleteToday(req.body));

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    res.json({ miguelConfirmation: parsed.miguelConfirmation, evidence: sanitizeEvidenceItems(parsed.evidence, currentMemory) });
  } catch (err) {
    sendAiError(res, '/api/coach-memory/extract-insight', err);
  }
});

// 5b. Evidencias de una conversación con Miguel (quedan PENDIENTES hasta que el atleta las confirme)
app.post('/api/coach-memory/extract-chat-evidence', serverData('memory'), async (req: Request, res: Response) => {
  try {
    const { messages, currentMemory } = req.body;
    const turns = (Array.isArray(messages) ? messages : []).slice(-30);
    const athleteTurns = turns.filter((m: any) => m?.role === 'user');
    if (athleteTurns.length === 0) return res.json({ evidence: [] });

    const prompt = buildChatEvidencePrompt(turns, currentMemory, athleteToday(req.body));

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    res.json({ evidence: sanitizeEvidenceItems(parsed.evidence, currentMemory) });
  } catch (err) {
    sendAiError(res, '/api/coach-memory/extract-chat-evidence', err);
  }
});

// 6. Look up / Analyze Race Info (for secondary prep races or Transvulcania details)
app.post('/api/race-info', async (req: Request, res: Response) => {
  try {
    const { raceName, approximateDate, distanceKm } = req.body;
    if (!raceName || typeof raceName !== 'string') return res.status(400).json({ error: 'Falta el nombre de la carrera.' });
    const t0 = Date.now();

    // Paso 1: búsqueda REAL en Google (Gemini grounding). Sin búsqueda no hay datos.
    const search = await searchWithGemini(RACE_SEARCH_SYSTEM, buildRaceSearchPrompt(raceName, approximateDate, distanceKm));
    if (search.sources.length === 0) {
      return res.json({ verified: false, fields: {}, unverified: [...RACE_NUMERIC_FIELDS, ...RACE_TEXT_FIELDS], sources: [], queries: search.queries, warnings: [], strategicAdvice: null,
        message: 'La búsqueda no devolvió ninguna fuente: no se rellena ningún dato. Introdúcelos a mano.' });
    }

    // Paso 2: extracción a JSON indicando qué página respalda cada dato
    const extractionText = await runAi(res, {
      system: RACE_EXTRACTION_SYSTEM,
      input: buildRaceExtractionPrompt(search),
      json: true,
      temperature: 0,
    });

    // Paso 3: verificación en código (sin fuente = sin verificar = null)
    const verified = verifyRaceInfo(parseModelJson(extractionText), search);

    // Paso 4: consejo de Miguel SOLO con los datos verificados (es una recomendación, no un dato)
    let strategicAdvice: string | null = null;
    // (se omite si la búsqueda ya consumió media función: límite de 60 s en Vercel)
    if (Object.keys(verified.fields).length > 0 && Date.now() - t0 < 30_000) {
      const adviceText = await runAi(res, {
        system: MIGUEL_SYSTEM_INSTRUCTION,
        input: buildRaceAdvicePrompt(raceName, verified, req.body?.targetRace),
        json: true,
      });
      strategicAdvice = parseModelJson(adviceText).strategicAdvice || null;
    }
    // Barrera en código: se quitan las frases con cifras que no están verificadas ni se derivan de ellas
    let message: string | undefined;
    if (strategicAdvice) {
      const filtered = filterRaceAdvice(strategicAdvice, verified, targetFigures(req.body?.targetRace));
      if (filtered.removed.length) {
        console.warn(`[race-info] cifras sin respaldo en el consejo: ${filtered.removed.join(', ')}`);
        message = filtered.advice
          ? `Se han quitado del consejo frases con cifras sin verificar (${filtered.removed.join(', ')}).`
          : 'El consejo de Miguel citaba cifras que no están verificadas y se ha descartado.';
      }
      strategicAdvice = filtered.advice;
    }

    res.json({ verified: true, ...verified, strategicAdvice, message, checkedAt: new Date().toISOString() });
  } catch (err) {
    sendAiError(res, '/api/race-info', err);
  }
});

// 6. Parse and Ingest Athlete Markdown History (.md)
app.post('/api/parse-markdown-history', async (req: Request, res: Response) => {
  try {
    const { markdownContent } = req.body;

    if (!markdownContent || typeof markdownContent !== 'string') {
      return res.status(400).json({ error: 'El contenido del archivo .md está vacío.' });
    }

    const prompt = buildHistoryPrompt(markdownContent);

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    // Cada cifra extraída tiene que estar escrita en el documento; si no, null
    const checked = verifyHistoryNumbers(parseModelJson(text), markdownContent);
    res.json({ ...checked.parsed, removedNumbers: checked.removed });
  } catch (err) {
    sendAiError(res, '/api/parse-markdown-history', err);
  }
});

registerSuuntoRoutes(app);
registerSuuntoSyncRoutes(app);
registerDataRoutes(app);

export default app;
