// Conversaciones con Miguel guardadas en Supabase (chat_sessions + chat_messages).
// El navegador sigue guardando su copia para mostrar el chat; esto es la memoria
// persistente del servidor, que no se pierde al borrar el navegador o cambiar de móvil.
import { dbError, getSupabase } from './supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoredRole = 'user' | 'assistant' | 'system';

/**
 * Devuelve un sessionId válido: reutiliza el recibido si existe en Supabase;
 * si no llega, no es un UUID o no existe, crea una sesión nueva.
 */
export async function ensureSession(sessionId?: unknown): Promise<string> {
  const db = getSupabase();

  if (typeof sessionId === 'string' && UUID_RE.test(sessionId)) {
    const { data, error } = await db.from('chat_sessions').select('id').eq('id', sessionId).maybeSingle();
    if (error) throw dbError('consultar la conversación', error);
    if (data) return data.id as string;
  }

  const { data, error } = await db.from('chat_sessions').insert({}).select('id').single();
  if (error || !data) throw dbError('crear la conversación', error ?? { message: 'sin datos' });
  return data.id as string;
}

/** Guarda mensajes en orden (una sola inserción). */
export async function saveMessages(sessionId: string, messages: { role: StoredRole; content: string }[]): Promise<void> {
  const rows = messages
    .filter((m) => m.content.trim())
    .map((m) => ({ session_id: sessionId, role: m.role, content: m.content }));
  if (!rows.length) return;
  const { error } = await getSupabase().from('chat_messages').insert(rows);
  if (error) throw dbError('guardar la conversación', error);
}

