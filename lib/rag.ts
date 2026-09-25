import { chunkText } from "./chunker";
import { embedText, embedTexts, getChatModel, getOpenAI } from "./openai";
import { getSupabaseAdmin } from "./supabaseAdmin";

/** Número de mensajes previos de la sesión que se envían al LLM. */
export const HISTORY_LIMIT = 8;
/** Similitud coseno mínima para considerar relevante un fragmento. */
export const MATCH_THRESHOLD = 0.3;
/** Máximo de fragmentos recuperados por pregunta. */
export const MATCH_COUNT = 5;

export const NO_CONTEXT_ANSWER =
  "No tengo suficiente información en mi base de conocimiento para responder a eso. " +
  "Prueba a reformular la pregunta o pide que se ingieran documentos sobre ese tema.";

const SYSTEM_PROMPT = `Eres Miguel, un asistente de entrenamiento de trail running.
Respondes en español, de forma clara y práctica.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con la información del CONTEXTO proporcionado en este mensaje.
2. NO inventes datos, cifras, ritmos, frecuencias cardiacas, fechas, nombres ni estudios.
3. Si el CONTEXTO no contiene información suficiente para responder, dilo explícitamente:
   "No tengo suficiente información para responder a eso." No completes con conocimiento general.
4. El historial de conversación sirve solo para entender la pregunta; no es una fuente de datos.
5. Cuando uses un fragmento, cita su número entre corchetes, por ejemplo [1].
6. No des diagnósticos médicos. Ante dolor, lesión o síntomas, recomienda consultar a un profesional sanitario.`;

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Source {
  id: number;
  title: string | null;
  source: string | null;
  similarity: number;
  excerpt: string;
}

interface MatchRow {
  id: number;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
}

/**
 * Devuelve un sessionId válido: reutiliza el recibido si existe en la base de datos;
 * si no se recibió o no existe, crea una sesión nueva.
 */
export async function ensureSession(sessionId?: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (sessionId) {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw new Error(`Error consultando la sesión: ${error.message}`);
    if (data) return data.id as string;
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({})
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Error creando la sesión: ${error?.message ?? "sin datos"}`);
  }
  return data.id as string;
}

/** Últimos `limit` mensajes de la sesión, en orden cronológico. */
export async function getRecentMessages(
  sessionId: string,
  limit = HISTORY_LIMIT
): Promise<ChatMessage[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("chat_messages")
    .select("role, content, created_at, id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Error leyendo el historial: ${error.message}`);

  return (data ?? [])
    .reverse()
    .map((row) => ({ role: row.role as ChatRole, content: row.content as string }));
}

export async function saveMessage(
  sessionId: string,
  role: ChatRole,
  content: string
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("chat_messages")
    .insert({ session_id: sessionId, role, content });
  if (error) throw new Error(`Error guardando el mensaje: ${error.message}`);
}

/** Busca en `documents` los fragmentos más similares a la consulta. */
export async function retrieveContext(query: string): Promise<MatchRow[]> {
  const embedding = await embedText(query);

  const { data, error } = await getSupabaseAdmin().rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`Error en la búsqueda vectorial: ${error.message}`);

  return (data ?? []) as MatchRow[];
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function toSource(row: MatchRow): Source {
  return {
    id: row.id,
    title: metaString(row.metadata, "title"),
    source: metaString(row.metadata, "source"),
    similarity: Number(row.similarity.toFixed(4)),
    excerpt: row.content.length > 240 ? `${row.content.slice(0, 240)}…` : row.content,
  };
}

function buildContextBlock(rows: MatchRow[]): string {
  return rows
    .map((row, i) => {
      const title = metaString(row.metadata, "title") ?? "Sin título";
      return `[${i + 1}] (${title})\n${row.content}`;
    })
    .join("\n\n---\n\n");
}

export interface AnswerResult {
  answer: string;
  sources: Source[];
}

/**
 * Pipeline RAG: recupera contexto para `message` y genera la respuesta con el LLM.
 * Si no hay fragmentos relevantes, no llama al LLM y devuelve NO_CONTEXT_ANSWER.
 */
export async function answerWithRag(
  message: string,
  history: ChatMessage[]
): Promise<AnswerResult> {
  const rows = await retrieveContext(message);
  if (rows.length === 0) {
    return { answer: NO_CONTEXT_ANSWER, sources: [] };
  }

  const completion = await getOpenAI().chat.completions.create({
    model: getChatModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      {
        role: "user",
        content: `CONTEXTO:\n${buildContextBlock(rows)}\n\nPREGUNTA:\n${message}`,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() || NO_CONTEXT_ANSWER;
  return { answer, sources: rows.map(toSource) };
}

export interface IngestInput {
  title: string;
  text: string;
  source?: string;
}

/** Trocea, vectoriza e inserta un documento. Devuelve el número de fragmentos. */
export async function ingestDocument(input: IngestInput): Promise<number> {
  const chunks = chunkText(input.text);
  if (chunks.length === 0) return 0;

  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((content, i) => ({
    content,
    embedding: embeddings[i],
    metadata: {
      title: input.title,
      ...(input.source ? { source: input.source } : {}),
      chunk_index: i,
      chunk_count: chunks.length,
    },
  }));

  const supabase = getSupabaseAdmin();
  const INSERT_BATCH = 100;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error } = await supabase.from("documents").insert(rows.slice(i, i + INSERT_BATCH));
    if (error) throw new Error(`Error insertando fragmentos: ${error.message}`);
  }

  return chunks.length;
}
