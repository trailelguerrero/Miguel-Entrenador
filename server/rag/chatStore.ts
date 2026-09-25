// Conversaciones con Miguel guardadas en Supabase (chat_sessions + chat_messages).
// Solo se escriben cuando el atleta pulsa "Guardar en Supabase" en el chat: el
// chat normal no toca la base de datos. Borrar el chat en el móvil no borra nada
// aquí, y la app no tiene ninguna ruta para borrar conversaciones de Supabase.
import { KnowledgeError, dbError, getSupabase } from './supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGES_PER_SAVE = 500;
const MAX_MESSAGE_CHARS = 50_000;

export type StoredRole = 'user' | 'assistant';

export interface IncomingMessage {
  /** Id del mensaje en el móvil: evita guardarlo dos veces. */
  clientId: string;
  role: StoredRole;
  content: string;
  /** Hora original del mensaje en el móvil (ISO). */
  timestamp?: string;
  knowledgeSources?: unknown[];
}

export interface StoredMessage extends IncomingMessage {
  savedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Valida los mensajes que envía el móvil; lanza KB_INPUT con el motivo. */
export function parseIncomingMessages(raw: unknown): IncomingMessage[] {
  const bad = (msg: string) => new KnowledgeError('KB_INPUT', msg, 'Envía { messages: [{ clientId, role, content }] }.', 400);
  if (!Array.isArray(raw)) throw bad('Faltan los mensajes a guardar.');
  if (raw.length > MAX_MESSAGES_PER_SAVE) throw bad(`Como máximo ${MAX_MESSAGES_PER_SAVE} mensajes por guardado.`);
  return raw.map((m: any) => {
    if (typeof m?.clientId !== 'string' || !m.clientId || m.clientId.length > 200) throw bad('Mensaje sin clientId válido.');
    if (m.role !== 'user' && m.role !== 'assistant') throw bad(`Rol no válido en ${m.clientId}.`);
    if (typeof m.content !== 'string' || !m.content.trim()) throw bad(`Mensaje vacío: ${m.clientId}.`);
    return {
      clientId: m.clientId,
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
      timestamp: typeof m.timestamp === 'string' ? m.timestamp : undefined,
      knowledgeSources: Array.isArray(m.knowledgeSources) ? m.knowledgeSources.slice(0, 10) : undefined,
    };
  });
}

/** Sesión existente (si el id es válido y existe) o una nueva con título.
 * Sin mensajes que guardar no se crean conversaciones vacías. */
async function resolveSession(sessionId: unknown, title: string | null, createIfMissing: boolean): Promise<string> {
  const db = getSupabase();
  if (isUuid(sessionId)) {
    const { data, error } = await db.from('chat_sessions').select('id').eq('id', sessionId).maybeSingle();
    if (error) throw dbError('consultar la conversación', error);
    if (data) return data.id as string;
  }
  if (!createIfMissing) {
    throw new KnowledgeError('KB_INPUT', 'No hay mensajes nuevos que guardar.', 'Escribe a Miguel y vuelve a pulsar Guardar.', 400);
  }
  const { data, error } = await db.from('chat_sessions').insert({ title }).select('id').single();
  if (error || !data) throw dbError('crear la conversación', error ?? { message: 'sin datos' });
  return data.id as string;
}

/**
 * Guarda en la conversación `sessionId` (o en una nueva) los mensajes que aún no
 * estén guardados. Devuelve los clientId que quedan guardados (nuevos + ya existentes).
 */
export async function saveConversation(
  sessionId: unknown,
  messages: IncomingMessage[],
): Promise<{ sessionId: string; saved: number; alreadySaved: number; clientIds: string[] }> {
  const db = getSupabase();
  const firstQuestion = messages.find((m) => m.role === 'user')?.content.trim().replace(/\s+/g, ' ').slice(0, 120) ?? null;
  const id = await resolveSession(sessionId, firstQuestion, messages.length > 0);
  if (!messages.length) return { sessionId: id, saved: 0, alreadySaved: 0, clientIds: [] };

  const { data: existing, error: readError } = await db
    .from('chat_messages')
    .select('metadata')
    .eq('session_id', id)
    .in('metadata->>client_id', messages.map((m) => m.clientId));
  if (readError) throw dbError('consultar la conversación', readError);
  const already = new Set((existing ?? []).map((r: any) => r.metadata?.client_id as string));

  const rows = messages
    .filter((m) => !already.has(m.clientId))
    .map((m) => ({
      session_id: id,
      role: m.role,
      content: m.content,
      metadata: {
        client_id: m.clientId,
        ...(m.timestamp ? { timestamp: m.timestamp } : {}),
        ...(m.knowledgeSources?.length ? { knowledge_sources: m.knowledgeSources } : {}),
      },
    }));

  if (rows.length) {
    const { error } = await db.from('chat_messages').insert(rows);
    if (error) throw dbError('guardar la conversación', error);
  }
  const { error: touchError } = await db.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', id);
  if (touchError) throw dbError('actualizar la conversación', touchError);
  // El título (primera pregunta) solo se pone si la conversación aún no tenía.
  if (firstQuestion) {
    const { error } = await db.from('chat_sessions').update({ title: firstQuestion }).eq('id', id).is('title', null);
    if (error) throw dbError('actualizar la conversación', error);
  }

  return { sessionId: id, saved: rows.length, alreadySaved: already.size, clientIds: messages.map((m) => m.clientId) };
}

/** Conversaciones guardadas, de la más reciente a la más antigua. */
export async function listConversations(limit = 50): Promise<ConversationSummary[]> {
  const { data, error } = await getSupabase()
    .from('chat_sessions')
    .select('id, title, created_at, updated_at, chat_messages(count)')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw dbError('listar las conversaciones', error);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messageCount: r.chat_messages?.[0]?.count ?? 0,
  }));
}

/** Mensajes de una conversación, en orden. */
export async function getConversation(sessionId: string): Promise<StoredMessage[]> {
  if (!isUuid(sessionId)) {
    throw new KnowledgeError('KB_INPUT', 'Identificador de conversación no válido.', 'Elige una conversación de la lista.', 400);
  }
  const { data, error } = await getSupabase()
    .from('chat_messages')
    .select('id, role, content, metadata, created_at')
    .eq('session_id', sessionId)
    .order('id', { ascending: true })
    .limit(5000);
  if (error) throw dbError('cargar la conversación', error);
  return (data ?? [])
    .filter((r: any) => r.role === 'user' || r.role === 'assistant')
    .map((r: any) => ({
      clientId: typeof r.metadata?.client_id === 'string' ? r.metadata.client_id : `cloud-${r.id}`,
      role: r.role,
      content: r.content,
      timestamp: typeof r.metadata?.timestamp === 'string' ? r.metadata.timestamp : r.created_at,
      knowledgeSources: Array.isArray(r.metadata?.knowledge_sources) ? r.metadata.knowledge_sources : undefined,
      savedAt: r.created_at,
    }));
}
