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
  WatchZoneAdvice
} from '../types';

import { ApiError, apiStatus } from './apiStatus';
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
): Promise<any> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  ): Promise<string> {
    const data = await apiFetch('/api/chat', {
        messages,
        athleteProfile,
        currentReadiness,
        targetRace,
        context,
        athleteHistoryDoc,
        coachMemory,
        brainContext,
      }, 'ai', 'Error al comunicar con Miguel');
    return data.reply;
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
    readinessState?: ReadinessState | null
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
    newLearnedInsight?: Omit<CoachLearnedInsight, 'id' | 'learnedFromDate' | 'sourceEvent'>;
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
    category: CoachLearnedInsight['category'];
    observation: string;
    ruleForFuturePlans: string;
    confidenceScore: number;
    miguelConfirmation: string;
  }> {
    return await apiFetch('/api/coach-memory/extract-insight', {
        noteText,
        athleteProfile,
        currentMemory,
      }, 'ai', 'Error al extraer aprendizaje de la nota');
  },

  async getRaceInfo(
    raceName: string,
    approximateDate?: string,
    distanceKm?: number
  ): Promise<any> {
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
  suuntoMcpUrl: string;
}
