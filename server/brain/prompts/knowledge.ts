// Fragmentos de la Biblioteca de Miguel (RAG) convertidos en texto para el prompt.
import type { ChatTurn } from '../../ai.js';

export interface KnowledgeSnippet {
  title: string;
  source: string | null;
  content: string;
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
