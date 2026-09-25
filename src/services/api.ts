import { 
  AthleteProfile, 
  DailyCheckIn, 
  TargetRace, 
  Workout, 
  AthleteHistoryDocument,
  SuuntoAuth,
  SuuntoProfileSuggestion,
  CoachLearnedMemory,
  CoachLearnedInsight,
  WatchZoneAdvice,
  KnowledgeSource,
  MemorySource,
  ChatMessage
} from '../types';

import { ApiError, apiStatus } from './apiStatus';
import { StorageService } from './storage';
import { AppSecret } from './appSecret';
import type { RaceInfoResult } from '../types';
import type { EvidenceItem } from '../brain/memory';
import type { BrainContext, summarizeWeekWorkouts } from '../brain/context';
import type { ReadinessState } from '../brain/readiness';

/** Evidencia nutricional real del atleta (mismo tipo que server/brain/validate.ts). */
export interface NutritionEvidence {
  maxCarbsPerHourG?: number | null;
  sweatRateLph?: number | null;
  sodiumProfile?: string | null;
}

export { ApiError };

/** Llamada común a la API de la app: traduce cualquier fallo (sin red, API
 * inexistente, error de IA/Suunto) en un ApiError con mensaje claro y qué
 * hacer, e informa al estado global (indicador + banner "Error de API"). */
async function apiFetch(
  path: string,
  body: unknown,
  kind: 'ai' | 'suunto',
  fallbackMessage: string,
  options: { allowStatus?: number[] } = {},
  retried = false,
): Promise<any> {
  let res: Response;
  try {
    const secret = AppSecret.get();
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-app-secret': secret } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    const err = !navigator.onLine
      ? new ApiError('OFFLINE', 'No hay conexión a internet.', 'Comprueba tu conexión y vuelve a intentarlo.')
      : new ApiError('NETWORK', 'No hay conexión con el servidor de la app.', 'Vuelve a intentarlo en un momento. Si persiste, revisa en Vercel que el último despliegue esté en "Ready".');
    apiStatus.reportBackendDown(err);
    throw err;
  }

  const raw = await res.text();
  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // HTML u otra cosa: típicamente la API no está desplegada (vercel.json/función)
    const err = new ApiError(
      'BACKEND_MISSING',
      'La API de la app no responde (el servidor devolvió una página en vez de datos).',
      'Revisa el despliegue en Vercel (sección 3 de CONFIGURACION-POR-USUARIO.md) y los logs de Vercel (3.6).',
    );
    apiStatus.reportBackendDown(err);
    throw err;
  }
  apiStatus.reportBackendUp();

  // El servidor exige la clave de la app (APP_SECRET / INGEST_SECRET): se pide una vez y se reintenta
  if (res.status === 401 && data.code === 'APP_AUTH' && !retried && typeof window !== 'undefined') {
    const typed = window.prompt(
      `${AppSecret.get() ? 'La clave de la app no es correcta.' : 'La app está protegida con clave.'}\n\nEscribe la clave de la app (el valor de APP_SECRET o, si no la tienes, INGEST_SECRET en Vercel). Se guardará en este dispositivo.`,
    );
    if (typed && typed.trim()) {
      AppSecret.set(typed.trim(), true);
      return apiFetch(path, body, kind, fallbackMessage, options, true);
    }
  }

  if (!res.ok && !options.allowStatus?.includes(res.status)) {
    const err = new ApiError(data.code || `HTTP_${res.status}`, data.error || data.message || fallbackMessage, data.hint);
    if (kind === 'ai') apiStatus.reportAiError(err);
    else apiStatus.reportSuuntoError(err);
    throw err;
  }

  if (kind === 'ai') {
    const fallback = res.headers.get('X-AI-Fallback');
    apiStatus.reportAiOk(fallback ? decodeURIComponent(fallback) : undefined);
  }
  return data;
}

/** Respuesta del chat: texto de Miguel + documentos de la biblioteca que usó. */
export interface ChatReply {
  reply: string;
  knowledgeSources: KnowledgeSource[];
  memorySources: MemorySource[];
  /** La biblioteca no respondió (sin configurar bien, caída…): Miguel contestó sin ella. */
  knowledgeWarning?: string;
}

/** Hechos calculados en el cliente para Miguel (ver src/brain/context.ts). */
export type PlanLoadContext = BrainContext;

export const ApiService = {
  async sendMessage(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    athleteProfile: AthleteProfile,
    currentReadiness?: DailyCheckIn,
    targetRace?: TargetRace,
    context?: string,
    athleteHistoryDoc?: AthleteHistoryDocument | null,
    coachMemory?: CoachLearnedMemory | null,
    brainContext?: BrainContext
  ): Promise<ChatReply> {
    const data = await apiFetch('/api/chat', {
        messages,
        athleteProfile,
        currentReadiness,
        targetRace,
        context,
        athleteHistoryDoc,
        coachMemory,
        brainContext,
        // Solo para que Miguel no "recuerde" la conversación que ya tiene abierta.
        sessionId: StorageService.getChatSessionId(),
      }, 'ai', 'Error al comunicar con Miguel');
    if (data.knowledgeWarning) console.warn(`[Biblioteca de Miguel] ${data.knowledgeWarning}`);
    return {
      reply: data.reply,
      knowledgeSources: Array.isArray(data.knowledgeSources) ? data.knowledgeSources : [],
      memorySources: Array.isArray(data.memorySources) ? data.memorySources : [],
      knowledgeWarning: data.knowledgeWarning,
    };
  },

  async generatePlan(
    athleteProfile: AthleteProfile,
    targetRace: TargetRace,
    weekStartDate: string,
    phaseFocus?: string,
    athleteHistoryDoc?: AthleteHistoryDocument | null,
    coachMemory?: CoachLearnedMemory | null,
    loadContext?: PlanLoadContext,
    existingWorkouts?: ReturnType<typeof summarizeWeekWorkouts>,
    nutritionEvidence?: NutritionEvidence
  ): Promise<{ weekSummary: string; workouts: Workout[]; validationNotes?: string[]; structureIssues?: string[] }> {
    return await apiFetch('/api/generate-plan', {
        athleteProfile,
        targetRace,
        weekStartDate,
        phaseFocus,
        athleteHistoryDoc,
        coachMemory,
        loadContext,
        existingWorkouts,
        nutritionEvidence,
      }, 'ai', 'Error al generar el plan personalizado');
  },

  async adaptSession(
    originalWorkout: Workout,
    checkIn: DailyCheckIn,
    athleteProfile: AthleteProfile,
    athleteHistoryDoc?: AthleteHistoryDocument | null,
    readinessState?: ReadinessState | null,
    /** Carga con la que el servidor recalcula el estado (no se fía del estado del cliente). */
    readinessInputs?: { tsb?: number; weeklyTss?: number; ctl?: number } | null
  ): Promise<{
    miguelMessage: string;
    adaptedWorkout: Partial<Workout>;
    corrections?: string[];
  }> {
    return await apiFetch('/api/adapt-session', {
        originalWorkout,
        checkIn,
        athleteProfile,
        athleteHistoryDoc,
        readinessState,
        readinessInputs,
      }, 'ai', 'Error al adaptar la sesión');
  },

  async analyzeWorkout(
    workout: Workout,
    fitMetrics: any,
    athleteProfile: AthleteProfile,
    athleteFeedback?: { rpe: number; notes: string },
    athleteHistoryDoc?: AthleteHistoryDocument | null,
    coachMemory?: CoachLearnedMemory | null
  ): Promise<{
    feedback: string;
    /** Evidencias ya validadas por el servidor; el estado lo calcula src/brain/memory.ts. */
    evidence: EvidenceItem[];
  }> {
    return await apiFetch('/api/analyze-workout', {
        workout,
        fitMetrics,
        athleteProfile,
        athleteFeedback,
        athleteHistoryDoc,
        coachMemory,
      }, 'ai', 'Error al analizar el entrenamiento');
  },

  async extractInsightFromNote(
    noteText: string,
    athleteProfile: AthleteProfile,
    currentMemory?: CoachLearnedMemory | null
  ): Promise<{
    evidence: EvidenceItem[];
    miguelConfirmation?: string;
  }> {
    return await apiFetch('/api/coach-memory/extract-insight', {
        noteText,
        athleteProfile,
        currentMemory,
      }, 'ai', 'Error al extraer aprendizaje de la nota');
  },

  /** Evidencias que el atleta contó en el chat (quedan pendientes de su confirmación). */
  async extractChatEvidence(
    messages: { role: string; content: string }[],
    currentMemory: CoachLearnedMemory,
  ): Promise<{ evidence: EvidenceItem[] }> {
    return await apiFetch('/api/coach-memory/extract-chat-evidence', {
        messages,
        currentMemory,
      }, 'ai', 'Error al extraer aprendizajes de la conversación');
  },

  async getRaceInfo(
    raceName: string,
    approximateDate?: string,
    distanceKm?: number
  ): Promise<RaceInfoResult> {
    return await apiFetch('/api/race-info', {
        raceName,
        approximateDate,
        distanceKm,
      }, 'ai', 'Error al consultar datos de la carrera');
  },

  async parseMarkdownHistory(
    markdownContent: string,
    fileName?: string
  ): Promise<{
    summary: NonNullable<AthleteHistoryDocument['parsedSummary']>;
    miguelAnalysis: string;
    extractedProfileUpdates: Partial<AthleteProfile>;
  }> {
    return await apiFetch('/api/parse-markdown-history', {
        markdownContent,
        fileName: fileName || 'historial_atleta.md',
      }, 'ai', 'Error al procesar el archivo Markdown con Miguel');
  },

  /** Trae workouts y sueño/HRV reales de Suunto (vía el servidor MCP de Suunto).
   * Si el token se renovó, `newAuth` trae los tokens nuevos para guardarlos. */
  async syncSuuntoHistory(auth: SuuntoAuth | undefined, days = 28): Promise<{
    success: boolean;
    message: string;
    needsReconnect?: boolean;
    workouts?: Workout[];
    checkIns?: DailyCheckIn[];
    lastSync?: string;
    newAuth?: SuuntoAuth;
    profileFromSuunto?: SuuntoProfileSuggestion;
    watchZoneAdvice?: WatchZoneAdvice;
  }> {
    return await apiFetch('/api/suunto/sync-history', { auth, days }, 'suunto', 'Error en la sincronización con Suunto', {
      // 401 needsReconnect no es un fallo de la API: lo gestiona App (pide reconectar)
      allowStatus: [401],
    });
  },
  /** Estado de configuración del servidor (no gasta tokens). */
  async getHealth(): Promise<HealthStatus> {
    let res: Response;
    try {
      res = await fetch('/api/health');
    } catch {
      const err = new ApiError('NETWORK', 'No hay conexión con el servidor de la app.', 'Vuelve a intentarlo en un momento.');
      apiStatus.reportBackendDown(err);
      throw err;
    }
    let data: HealthStatus;
    try {
      data = await res.json();
    } catch {
      const err = new ApiError(
        'BACKEND_MISSING',
        'La API de la app no responde (el servidor devolvió una página en vez de datos).',
        'Revisa el despliegue en Vercel (sección 3 de CONFIGURACION-POR-USUARIO.md) y los logs de Vercel (3.6).',
      );
      apiStatus.reportBackendDown(err);
      throw err;
    }
    apiStatus.reportBackendUp();
    apiStatus.setHealth(data);
    if (!data.ai.ok) {
      apiStatus.reportAiError(new ApiError(data.ai.code || 'AI_CONFIG', data.ai.message || 'La IA no está configurada.', data.ai.hint));
    }
    return data;
  },

  /** Prueba real de la IA (gasta muy pocos tokens). */
  async testAi(): Promise<{ ok: boolean; provider: string; model: string; latencyMs: number; reply: string; fallback?: { reason: string } }> {
    const data = await apiFetch('/api/health/ai-test', {}, 'ai', 'La prueba de IA falló');
    if (data.fallback) apiStatus.reportAiOk(`${data.fallback.code}: ${data.fallback.reason}`);
    return data;
  },
};

export interface HealthStatus {
  ok: boolean;
  ai: {
    ok: boolean;
    provider: string;
    code?: string;
    message?: string;
    hint?: string;
    models: { gemini: string; experientialChat: string; experientialFast: string };
    fallbackAvailable: boolean;
  };
  knowledge?: KnowledgeStatus;
  /** false = las rutas de IA están abiertas (no hay APP_SECRET ni INGEST_SECRET en Vercel). */
  apiProtected?: boolean;
  suuntoMcpUrl: string;
}

export interface KnowledgeStatus {
  /** Biblioteca activa (Supabase + proveedor de embeddings configurados). */
  enabled: boolean;
  /** Supabase configurado: se pueden guardar y cargar conversaciones. */
  chatHistoryEnabled: boolean;
  missing: string[];
  embeddingModel: string;
  ingestProtected: boolean;
}

export interface KnowledgeDocument {
  title: string;
  source: string | null;
  chunks: number;
  embeddingModel: string | null;
  createdAt: string;
}

/** Llamada a la Biblioteca de Miguel con la clave INGEST_SECRET en la cabecera. */
async function knowledgeFetch(path: string, secret: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { 'x-ingest-secret': secret, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK', 'No hay conexión con el servidor de la app.', 'Vuelve a intentarlo en un momento.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.code || `HTTP_${res.status}`, data.error || 'Error en la Biblioteca de Miguel.', data.hint);
  }
  return data;
}

export const KnowledgeService = {
  async list(secret: string): Promise<KnowledgeDocument[]> {
    return (await knowledgeFetch('/api/knowledge/documents', secret, 'GET')).documents ?? [];
  },
  async ingest(secret: string, doc: { title: string; text: string; source?: string }): Promise<{ chunks: number; replaced: number }> {
    return await knowledgeFetch('/api/knowledge/ingest', secret, 'POST', doc);
  },
  async remove(secret: string, title: string): Promise<number> {
    return (await knowledgeFetch('/api/knowledge/documents', secret, 'DELETE', { title })).deleted ?? 0;
  },
};

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/** Mensajes que se pueden guardar en Supabase: los de la conversación real,
 * sin el saludo inicial ni los avisos de error. */
export function isSavableMessage(m: ChatMessage): boolean {
  return (m.role === 'user' || m.role === 'assistant') && m.id !== 'welcome-miguel' && !m.id.startsWith('error-') && !!m.content.trim();
}

/** Conversaciones guardadas en Supabase. Solo se escribe al pulsar "Guardar". */
export const ConversationService = {
  /** Guarda los mensajes aún no guardados en `sessionId` (o en una conversación nueva). */
  async save(
    secret: string,
    sessionId: string | null,
    messages: ChatMessage[],
  ): Promise<{ sessionId: string; saved: number; clientIds: string[]; memoryIndexed: number; memoryWarning?: string }> {
    return await knowledgeFetch('/api/conversations/save', secret, 'POST', {
      sessionId,
      messages: messages.map((m) => ({
        clientId: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        knowledgeSources: m.knowledgeSources,
      })),
    });
  },

  async list(secret: string): Promise<ConversationSummary[]> {
    return (await knowledgeFetch('/api/conversations', secret, 'GET')).conversations ?? [];
  },

  /** Mensajes de una conversación, ya en el formato del chat de la app. */
  async load(secret: string, sessionId: string): Promise<ChatMessage[]> {
    const data = await knowledgeFetch(`/api/conversations/${encodeURIComponent(sessionId)}`, secret, 'GET');
    return (data.messages ?? []).map((m: any) => ({
      id: m.clientId,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      knowledgeSources: m.knowledgeSources,
      savedAt: m.savedAt,
    }));
  },
};
