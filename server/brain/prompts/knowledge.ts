// Fragmentos de la Biblioteca de Miguel (RAG) convertidos en texto para el prompt.
import type { ChatTurn } from '../../ai.js';

export interface KnowledgeSnippet {
  title: string;
  source: string | null;
  content: string;
}

/** Mensajes del chat tal como los escribió el atleta. Para buscar no sirve la
 * conversación de buildChatConversation: lleva el contexto completo (perfil,
 * carga…) incrustado en el último mensaje y taparía la pregunta. */
export function chatTurnsFromBody(body: any): ChatTurn[] {
  return (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role, content: m.content }));
}

/**
 * Texto con el que se busca en la biblioteca: la última pregunta del atleta y,
 * si es corta (p. ej. "¿y en bajada?"), también la anterior para dar contexto.
 */
export function buildKnowledgeQuery(turns: ChatTurn[]): string {
  const userTurns = turns.filter((t) => t.role === 'user').map((t) => t.content.trim()).filter(Boolean);
  const last = userTurns.at(-1) ?? '';
  const previous = userTurns.at(-2);
  const query = last.length < 60 && previous ? `${previous}\n${last}` : last;
  return query.slice(0, 2000);
}

/** Bloque para añadir al system prompt; cadena vacía si no hay fragmentos. */
export function buildKnowledgeBlock(snippets: KnowledgeSnippet[]): string {
  if (!snippets.length) return '';
  const body = snippets
    .map((s, i) => `[B${i + 1}] ${s.title}${s.source ? ` (${s.source})` : ''}\n${s.content}`)
    .join('\n\n---\n\n');
  return `

BIBLIOTECA DE MIGUEL (fragmentos de documentos cargados por el atleta, recuperados por parecido con su pregunta):
- Úsalos como conocimiento de entrenamiento de referencia cuando sean relevantes para la pregunta; si no lo son, ignóralos.
- Cuando te apoyes en uno, cítalo con su etiqueta, por ejemplo [B1].
- NO son datos fisiológicos del atleta: FC, HRV, zonas y cargas del atleta salen solo de Suunto, su historial .md o sus tests.
- Si un fragmento contradice los datos reales del atleta, prevalecen los datos del atleta; si contradice tus pilares, dilo.
- No atribuyas a la biblioteca nada que no esté literalmente en estos fragmentos.

${body}`;
}

export interface MemorySnippet {
  date: string | null;
  sessionTitle: string | null;
  content: string;
}

/** Fecha corta (dd/mm/aaaa) o "fecha desconocida". */
function shortDate(iso: string | null): string {
  if (!iso) return 'fecha desconocida';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'fecha desconocida' : d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
}

/** Bloque con intercambios de conversaciones anteriores; cadena vacía si no hay. */
export function buildMemoryBlock(snippets: MemorySnippet[]): string {
  if (!snippets.length) return '';
  const body = snippets
    .map((s, i) => `[C${i + 1}] ${shortDate(s.date)}${s.sessionTitle ? ` · conversación "${s.sessionTitle}"` : ''}\n${s.content}`)
    .join('\n\n---\n\n');
  return `

CONVERSACIONES ANTERIORES (intercambios guardados por el atleta, recuperados por parecido con su pregunta):
- Son lo que el atleta te CONTÓ y lo que tú le RESPONDISTE en su momento: úsalos para dar continuidad ("hace unas semanas me dijiste…"), no como datos medidos.
- Pueden estar desactualizados: ten en cuenta la fecha. Si contradicen los datos actuales (Suunto, perfil, check-in, memoria), prevalecen los actuales; si algo ha cambiado, díselo.
- Cuando te apoyes en uno, cítalo con su etiqueta, por ejemplo [C1]. Si no son relevantes, ignóralos.
- No atribuyas a conversaciones anteriores nada que no esté literalmente aquí.

${body}`;
}
