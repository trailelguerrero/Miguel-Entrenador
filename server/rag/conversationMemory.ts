// Memoria de conversaciones: cada intercambio guardado (pregunta del atleta +
// respuesta de Miguel) se vectoriza para que, en conversaciones nuevas, Miguel
// recupere lo que se habló antes sobre el mismo tema.
//
// Se indexa al pulsar "Guardar en Supabase" (nunca por su cuenta). Es idempotente:
// solo vectoriza los intercambios que aún no lo estén, así que si falla una vez,
// el siguiente guardado lo completa.
import { getConversation, type StoredMessage } from './chatStore.js';
import { embedTexts, embeddingModelId } from './embeddings.js';
import { matchThreshold } from './knowledge.js';
import { dbError, getSupabase } from './supabase.js';

const MATCH_COUNT = 3;
const MAX_QUESTION_CHARS = 1500;
const MAX_REPLY_CHARS = 2500;

export interface Exchange {
  /** clientId de la pregunta: identifica el intercambio. */
  clientId: string;
  timestamp: string;
  question: string;
  reply: string;
}

/** Pregunta del atleta + la respuesta de Miguel que la sigue. Las preguntas aún
 * sin respuesta se dejan para un guardado posterior. */
export function buildExchanges(messages: Pick<StoredMessage, 'clientId' | 'role' | 'content' | 'timestamp'>[]): Exchange[] {
  const out: Exchange[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q.role === 'user' && a.role === 'assistant') {
      out.push({ clientId: q.clientId, timestamp: q.timestamp ?? '', question: q.content, reply: a.content });
    }
  }
  return out;
}

export function exchangeText(e: Exchange): string {
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);
  return `Atleta: ${clip(e.question.trim(), MAX_QUESTION_CHARS)}\nMiguel: ${clip(e.reply.trim(), MAX_REPLY_CHARS)}`;
}

/** Vectoriza los intercambios de la conversación que aún no estén en la memoria. */
export async function indexConversation(sessionId: string): Promise<{ indexed: number }> {
  const db = getSupabase();
  const exchanges = buildExchanges(await getConversation(sessionId));
  if (!exchanges.length) return { indexed: 0 };

  const { data: existing, error } = await db
    .from('conversation_memory')
    .select('metadata')
    .eq('session_id', sessionId);
  if (error) throw dbError('leer la memoria de conversaciones', error);
  const model = embeddingModelId();
  const done = new Set(
    (existing ?? []).filter((r: any) => r.metadata?.embedding_model === model).map((r: any) => r.metadata?.client_id as string),
  );

  const pending = exchanges.filter((e) => !done.has(e.clientId));
  if (!pending.length) return { indexed: 0 };

  const texts = pending.map(exchangeText);
  const embeddings = await embedTexts(texts, 'document');
  // Si había una versión con otro modelo de embeddings, se sustituye.
  const { error: delError } = await db
    .from('conversation_memory')
    .delete()
    .eq('session_id', sessionId)
    .in('metadata->>client_id', pending.map((e) => e.clientId));
  if (delError) throw dbError('actualizar la memoria de conversaciones', delError);

  const { error: insError } = await db.from('conversation_memory').insert(
    pending.map((e, i) => ({
      session_id: sessionId,
      content: texts[i],
      embedding: embeddings[i],
      metadata: { client_id: e.clientId, timestamp: e.timestamp, embedding_model: model },
    })),
  );
  if (insError) throw dbError('guardar la memoria de conversaciones', insError);
  return { indexed: pending.length };
}

export interface MemoryMatch {
  sessionId: string;
  sessionTitle: string | null;
  /** Fecha de la pregunta original (ISO). */
  date: string | null;
  similarity: number;
  content: string;
}

/** Intercambios de conversaciones anteriores parecidos a la pregunta. */
export async function searchConversationMemory(embedding: number[], excludeSessionId?: string | null): Promise<MemoryMatch[]> {
  const { data, error } = await getSupabase().rpc('match_conversation_memory', {
    query_embedding: embedding,
    match_threshold: matchThreshold(),
    match_count: MATCH_COUNT,
    filter_model: embeddingModelId(),
    exclude_session: excludeSessionId && /^[0-9a-f-]{36}$/i.test(excludeSessionId) ? excludeSessionId : null,
  });
  if (error) throw dbError('buscar en conversaciones anteriores', error);
  return ((data ?? []) as any[]).map((r) => ({
    sessionId: r.session_id,
    sessionTitle: r.session_title ?? null,
    date: typeof r.metadata?.timestamp === 'string' && r.metadata.timestamp ? r.metadata.timestamp : null,
    similarity: Math.round(r.similarity * 1000) / 1000,
    content: r.content,
  }));
}
