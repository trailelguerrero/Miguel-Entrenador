// Capa única de IA: todas las rutas de server/app.ts llaman a `generateText` y
// esta decide qué proveedor usar según variables de entorno (sin tocar código):
//
//   AI_PROVIDER=gemini        (por defecto) → Google Gemini, GEMINI_API_KEY + GEMINI_MODEL
//   AI_PROVIDER=experiential  → pasarela Experiential Labs (compatible OpenAI),
//                               EXPERIENTIAL_API_KEY + EXPERIENTIAL_MODEL / EXPERIENTIAL_FAST_MODEL
//
// Con Experiential, si la llamada falla (créditos agotados, modelo inexistente,
// tiempo agotado…) y hay GEMINI_API_KEY, se reintenta automáticamente con
// Gemini para que la app no se quede sin respuesta (AI_FALLBACK=off lo desactiva).
// Guía para el usuario: CONFIGURACION-POR-USUARIO.md.
import { GoogleGenAI } from '@google/genai';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  system: string;
  /** Un prompt suelto o una conversación completa. */
  input: string | ChatTurn[];
  /** true → la respuesta debe ser un objeto JSON (planes, análisis…). */
  json?: boolean;
  temperature?: number;
}

const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
const EXPERIENTIAL_BASE_URL = 'https://api.experientiallabs.ai/v1';
const EXPERIENTIAL_DEFAULT_MODEL = 'claude-opus-5.5'; // chat con Miguel: el que mejor razona
const EXPERIENTIAL_DEFAULT_FAST_MODEL = 'claude-sonnet-5'; // planes/análisis en JSON: rápido, para no pasar de 60 s
// Margen para que, si Experiential no responde a tiempo, quede tiempo de
// reintentar con Gemini dentro del límite de 60 s de la función de Vercel.
const EXPERIENTIAL_TIMEOUT_MS = 40_000;

const JSON_ONLY_INSTRUCTION =
  '\n\nFORMATO DE RESPUESTA: responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después y sin bloques de código ```.';

export type Provider = 'gemini' | 'experiential';

export type AiErrorCode =
  | 'AI_CONFIG'
  | 'AI_AUTH'
  | 'AI_QUOTA'
  | 'AI_MODEL'
  | 'AI_TIMEOUT'
  | 'AI_UNAVAILABLE'
  | 'AI_BAD_RESPONSE';

const GUIDE = 'CONFIGURACION-POR-USUARIO.md';

/** Error de IA ya clasificado, con un mensaje claro y qué hacer. */
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    public hint: string,
    public provider: Provider | 'desconocido',
    public detail?: string,
  ) {
    super(message);
  }

  get httpStatus(): number {
    switch (this.code) {
      case 'AI_CONFIG':
      case 'AI_AUTH':
      case 'AI_MODEL':
        return 500;
      case 'AI_QUOTA':
        return 429;
      case 'AI_TIMEOUT':
        return 504;
      case 'AI_UNAVAILABLE':
        return 503;
      default:
        return 502;
    }
  }
}

const PROVIDER_NAME: Record<Provider, string> = { gemini: 'Gemini', experiential: 'Experiential Labs' };

/** Convierte cualquier error de un proveedor en un AiError con código y consejo. */
export function classifyAiError(err: unknown, provider: Provider): AiError {
  if (err instanceof AiError) return err;
  const e = err as { message?: string; status?: number; name?: string };
  const raw = String(e?.message ?? err);
  const status = typeof e?.status === 'number' ? e.status : Number(/\b(40[0-9]|42[0-9]|5\d\d)\b/.exec(raw)?.[1] ?? NaN);
  const name = PROVIDER_NAME[provider];
  const modelVar = provider === 'gemini' ? 'GEMINI_MODEL' : 'EXPERIENTIAL_MODEL / EXPERIENTIAL_FAST_MODEL';
  const keyVar = provider === 'gemini' ? 'GEMINI_API_KEY' : 'EXPERIENTIAL_API_KEY';
  const detail = raw.slice(0, 400);

  if (e?.name === 'TimeoutError' || e?.name === 'AbortError' || /timed? ?out|timeout/i.test(raw)) {
    return new AiError('AI_TIMEOUT', `${name} tardó demasiado en responder.`, 'Vuelve a intentarlo en un momento. Si pasa siempre, usa un modelo más rápido (sección 4 o 5 de ' + GUIDE + ').', provider, detail);
  }
  if (status === 401 || status === 403 || /api key not valid|invalid api key|unauthori[sz]ed|permission denied|API_KEY_INVALID/i.test(raw)) {
    return new AiError('AI_AUTH', `La API key de ${name} no es válida o fue revocada.`, `Crea una key nueva, cámbiala en Vercel (${keyVar}) y haz Redeploy (sección ${provider === 'gemini' ? '2' : '5.2'} de ${GUIDE}).`, provider, detail);
  }
  if (status === 429 || status === 402 || /quota|RESOURCE_EXHAUSTED|rate limit|insufficient|credits?|billing/i.test(raw)) {
    return new AiError('AI_QUOTA', `Se agotó la cuota o los créditos de ${name}.`, provider === 'gemini' ? 'Espera unos minutos (el límite gratuito es por minuto/día) o revisa tu plan en AI Studio.' : 'Recarga créditos en Experiential Labs o vuelve a Gemini (sección 5.5 de ' + GUIDE + ').', provider, detail);
  }
  if (status === 404 || /not found|is not supported|unknown model|does not exist/i.test(raw)) {
    return new AiError('AI_MODEL', `El modelo configurado no existe en ${name}.`, `Corrige el nombre en Vercel (${modelVar}) y haz Redeploy (sección ${provider === 'gemini' ? '4' : '5.3'} de ${GUIDE}).`, provider, detail);
  }
  if ((status >= 500 && status < 600) || /fetch failed|ECONN|ENOTFOUND|network|socket|UNAVAILABLE/i.test(raw)) {
    return new AiError('AI_UNAVAILABLE', `${name} no está disponible ahora mismo.`, 'Suele ser temporal: vuelve a intentarlo en unos minutos.', provider, detail);
  }
  return new AiError('AI_BAD_RESPONSE', `Error inesperado de ${name}.`, 'Vuelve a intentarlo. Si se repite, revisa los logs de Vercel (sección 3.6 de ' + GUIDE + ').', provider, detail);
}

function configuredProvider(): Provider {
  const value = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  if (value === 'gemini' || value === 'experiential') return value;
  throw new AiError(
    'AI_CONFIG',
    `AI_PROVIDER="${process.env.AI_PROVIDER}" no es válido.`,
    `Usa exactamente "gemini" o "experiential" en Vercel (Settings → Environment Variables) y haz Redeploy (sección 5 de ${GUIDE}).`,
    'desconocido',
  );
}

let geminiClient: GoogleGenAI | null = null;

async function generateWithGemini(opts: GenerateOptions): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiError(
      'AI_CONFIG',
      'Falta la variable de entorno GEMINI_API_KEY.',
      `Cárgala en Vercel (Settings → Environment Variables) y haz Redeploy (secciones 2 y 3 de ${GUIDE}).`,
      'gemini',
    );
  }
  geminiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const contents =
    typeof opts.input === 'string'
      ? opts.input
      : opts.input.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));

  const response = await geminiClient.models.generateContent({
    model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    contents,
    config: {
      systemInstruction: opts.system,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  return response.text || '';
}

async function generateWithExperiential(opts: GenerateOptions): Promise<string> {
  const apiKey = process.env.EXPERIENTIAL_API_KEY;
  if (!apiKey) {
    throw new AiError(
      'AI_CONFIG',
      'AI_PROVIDER=experiential pero falta la variable EXPERIENTIAL_API_KEY.',
      `Cárgala en Vercel (Settings → Environment Variables) y haz Redeploy (sección 5.2 de ${GUIDE}).`,
      'experiential',
    );
  }
  const model = opts.json
    ? process.env.EXPERIENTIAL_FAST_MODEL || EXPERIENTIAL_DEFAULT_FAST_MODEL
    : process.env.EXPERIENTIAL_MODEL || EXPERIENTIAL_DEFAULT_MODEL;

  const turns = typeof opts.input === 'string' ? [{ role: 'user' as const, content: opts.input }] : opts.input;
  const body = {
    model,
    messages: [{ role: 'system', content: opts.system + (opts.json ? JSON_ONLY_INSTRUCTION : '') }, ...turns],
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };

  const resp = await fetch(`${(process.env.EXPERIENTIAL_BASE_URL || EXPERIENTIAL_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EXPERIENTIAL_TIMEOUT_MS),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Experiential Labs devolvió ${resp.status} con el modelo "${model}": ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { choices?: { message?: { content?: string | null } }[] };
  return data.choices?.[0]?.message?.content || '';
}

export interface AiResult {
  text: string;
  provider: Provider;
  /** Presente si Experiential falló y respondió Gemini de respaldo. */
  fallback?: { from: 'experiential'; code: AiErrorCode; reason: string };
}

async function runProvider(provider: Provider, opts: GenerateOptions): Promise<string> {
  try {
    return provider === 'gemini' ? await generateWithGemini(opts) : await generateWithExperiential(opts);
  } catch (err) {
    throw classifyAiError(err, provider);
  }
}

/** Genera texto con el proveedor configurado (con respaldo a Gemini si procede).
 * Los errores salen siempre como AiError (código + mensaje claro + qué hacer). */
export async function generateText(opts: GenerateOptions): Promise<AiResult> {
  const provider = configuredProvider();
  if (provider === 'gemini') return { text: await runProvider('gemini', opts), provider };

  try {
    return { text: await runProvider('experiential', opts), provider };
  } catch (err) {
    const aiErr = err as AiError;
    if (!fallbackAvailable()) throw aiErr;
    console.warn(`[ai] Experiential falló, reintentando con Gemini: ${aiErr.message} (${aiErr.detail ?? ''})`);
    let text: string;
    try {
      text = await runProvider('gemini', opts);
    } catch (fallbackErr) {
      const gemErr = fallbackErr as AiError;
      throw new AiError(
        aiErr.code,
        `${aiErr.message} Y el respaldo con Gemini también falló: ${gemErr.message}`,
        `${aiErr.hint} Para el respaldo: ${gemErr.hint}`,
        'experiential',
        `${aiErr.detail ?? ''} | gemini: ${gemErr.detail ?? ''}`,
      );
    }
    return { text, provider: 'gemini', fallback: { from: 'experiential', code: aiErr.code, reason: aiErr.message } };
  }
}

function fallbackAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY && (process.env.AI_FALLBACK || 'on').toLowerCase() !== 'off';
}

/** Estado de la configuración de IA, sin llamar a ningún modelo (no gasta tokens). */
export function aiConfigStatus() {
  const models = {
    gemini: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    experientialChat: process.env.EXPERIENTIAL_MODEL || EXPERIENTIAL_DEFAULT_MODEL,
    experientialFast: process.env.EXPERIENTIAL_FAST_MODEL || EXPERIENTIAL_DEFAULT_FAST_MODEL,
  };
  try {
    const provider = configuredProvider();
    if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
      throw new AiError('AI_CONFIG', 'Falta la variable de entorno GEMINI_API_KEY.', `Cárgala en Vercel (Settings → Environment Variables) y haz Redeploy (secciones 2 y 3 de ${GUIDE}).`, 'gemini');
    }
    if (provider === 'experiential' && !process.env.EXPERIENTIAL_API_KEY) {
      throw new AiError('AI_CONFIG', 'AI_PROVIDER=experiential pero falta la variable EXPERIENTIAL_API_KEY.', `Cárgala en Vercel (Settings → Environment Variables) y haz Redeploy (sección 5.2 de ${GUIDE}).`, 'experiential');
    }
    return { ok: true as const, provider, models, fallbackAvailable: provider === 'experiential' && fallbackAvailable() };
  } catch (err) {
    const e = err as AiError;
    return { ok: false as const, provider: e.provider, code: e.code, message: e.message, hint: e.hint, models, fallbackAvailable: false };
  }
}

/** Modelo que se usaría para una petición (para mostrarlo en la prueba de IA). */
export function modelFor(provider: Provider, json: boolean): string {
  if (provider === 'gemini') return process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  return json
    ? process.env.EXPERIENTIAL_FAST_MODEL || EXPERIENTIAL_DEFAULT_FAST_MODEL
    : process.env.EXPERIENTIAL_MODEL || EXPERIENTIAL_DEFAULT_MODEL;
}

// Parsea la respuesta JSON del modelo. Si viene envuelta en ```json ... ``` o
// con texto alrededor, extrae el primer objeto.
export function parseModelJson(text: string | undefined): any {
  const raw = (text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // cae al error de abajo
      }
    }
    throw new AiError(
      'AI_BAD_RESPONSE',
      'La IA devolvió una respuesta que no es JSON válido.',
      'Vuelve a intentarlo; si se repite con un modelo concreto, prueba otro modelo.',
      'desconocido',
    );
  }
}
