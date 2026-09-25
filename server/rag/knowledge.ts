// Biblioteca de Miguel (RAG): documentos propios troceados, convertidos en
// embeddings (proveedor en embeddings.ts) y guardados en la tabla `documents`
// de Supabase con pgvector.
//
//   KNOWLEDGE_MATCH_THRESHOLD → opcional: similitud mínima (0.55)
//   INGEST_SECRET             → clave para añadir/listar/borrar documentos
//
// Sin configurar, la app funciona igual que antes: Miguel no consulta la biblioteca.
import { timingSafeEqual } from 'node:crypto';
import { chunkText } from './chunker.js';
import { embedTexts, embeddingModelId, missingEmbeddingVars } from './embeddings.js';
import { GUIDE, KnowledgeError, dbError, getSupabase, missingSupabaseVars } from './supabase.js';

const DEFAULT_MATCH_THRESHOLD = 0.55;
const MATCH_COUNT = 5;
const INSERT_BATCH = 100;
/** Límite de texto por documento: la ingesta debe caber en una función de 60 s. */
export const MAX_DOCUMENT_CHARS = 200_000;

export function matchThreshold(): number {
  const v = Number(process.env.KNOWLEDGE_MATCH_THRESHOLD);
  return process.env.KNOWLEDGE_MATCH_THRESHOLD && Number.isFinite(v) && v > -1 && v < 1 ? v : DEFAULT_MATCH_THRESHOLD;
}

/** Estado de Supabase, biblioteca y memoria de chat (no hace llamadas; para /api/health). */
export function knowledgeConfigStatus() {
  const supabaseMissing = missingSupabaseVars();
  const missing = [...supabaseMissing, ...missingEmbeddingVars()];
  return {
    enabled: missing.length === 0,
    chatHistoryEnabled: supabaseMissing.length === 0,
    missing,
    embeddingModel: embeddingModelId(),
    ingestProtected: !!process.env.INGEST_SECRET,
  };
}

export interface KnowledgeMatch {
  id: number;
  title: string;
  source: string | null;
  similarity: number;
  content: string;
}

/** Embedding de la pregunta del atleta: uno solo sirve para buscar en la
 * biblioteca y en las conversaciones anteriores. */
export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query], 'query');
  return embedding;
}

/** Fragmentos de la biblioteca más parecidos a la pregunta (vacío si no hay nada relevante). */
export async function searchKnowledge(embedding: number[]): Promise<KnowledgeMatch[]> {
  const db = getSupabase();
  const { data, error } = await db.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: matchThreshold(),
    match_count: MATCH_COUNT,
    filter_model: embeddingModelId(),
  });
  if (error) throw dbError('buscar en la biblioteca', error);

  return ((data ?? []) as { id: number; content: string; metadata: any; similarity: number }[]).map((row) => ({
    id: row.id,
    title: typeof row.metadata?.title === 'string' ? row.metadata.title : 'Sin título',
    source: typeof row.metadata?.source === 'string' ? row.metadata.source : null,
    similarity: Math.round(row.similarity * 1000) / 1000,
    content: row.content,
  }));
}

export interface IngestInput {
  title: string;
  text: string;
  source?: string;
}

/** Valida el cuerpo de una ingesta; lanza KB_INPUT con el motivo. */
export function parseIngestInput(body: any): IngestInput {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const source = typeof body?.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 1000) : undefined;
  const bad = (msg: string) => new KnowledgeError('KB_INPUT', msg, 'Envía JSON con "title" y "text" (y "source" opcional).', 400);
  if (!title) throw bad('Falta el título del documento.');
  if (title.length > 300) throw bad('El título no puede superar 300 caracteres.');
  if (!text) throw bad('El documento está vacío.');
  if (text.length > MAX_DOCUMENT_CHARS) {
    throw new KnowledgeError(
      'KB_INPUT',
      `El documento tiene ${text.length.toLocaleString('es-ES')} caracteres; el máximo por documento es ${MAX_DOCUMENT_CHARS.toLocaleString('es-ES')}.`,
      'Divídelo en varias partes con títulos distintos (por ejemplo "Libro X – parte 1").',
      413,
    );
  }
  return { title, text, source };
}

/**
 * Trocea, vectoriza y guarda un documento. Si ya había uno con el mismo título,
 * lo sustituye (volver a subirlo no duplica fragmentos).
 */
export async function ingestDocument(input: IngestInput): Promise<{ chunks: number; replaced: number }> {
  const db = getSupabase();
  const chunks = chunkText(input.text);
  if (chunks.length === 0) return { chunks: 0, replaced: 0 };

  // Primero los embeddings: si fallan, el documento anterior sigue intacto.
  const embeddings = await embedTexts(chunks, 'document');
  const model = embeddingModelId();
  const rows = chunks.map((content, i) => ({
    content,
    embedding: embeddings[i],
    metadata: {
      title: input.title,
      ...(input.source ? { source: input.source } : {}),
      chunk_index: i,
      chunk_count: chunks.length,
      embedding_model: model,
    },
  }));

  const replaced = await deleteDocument(input.title);
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error } = await db.from('documents').insert(rows.slice(i, i + INSERT_BATCH));
    if (error) throw dbError('guardar el documento', error);
  }
  return { chunks: chunks.length, replaced };
}

export interface KnowledgeDocument {
  title: string;
  source: string | null;
  chunks: number;
  embeddingModel: string | null;
  createdAt: string;
}

/** Documentos de la biblioteca (agrupados por título). */
export async function listDocuments(): Promise<KnowledgeDocument[]> {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(20_000);
  if (error) throw dbError('listar los documentos', error);

  const byTitle = new Map<string, KnowledgeDocument>();
  for (const row of (data ?? []) as { metadata: any; created_at: string }[]) {
    const title = typeof row.metadata?.title === 'string' ? row.metadata.title : 'Sin título';
    const doc = byTitle.get(title);
    if (doc) doc.chunks += 1;
    else {
      byTitle.set(title, {
        title,
        source: typeof row.metadata?.source === 'string' ? row.metadata.source : null,
        chunks: 1,
        embeddingModel: typeof row.metadata?.embedding_model === 'string' ? row.metadata.embedding_model : null,
        createdAt: row.created_at,
      });
    }
  }
  return [...byTitle.values()];
}

/** Borra todos los fragmentos de un documento. Devuelve cuántos había. */
export async function deleteDocument(title: string): Promise<number> {
  const { data, error } = await getSupabase().from('documents').delete().eq('metadata->>title', title).select('id');
  if (error) throw dbError('borrar el documento', error);
  return data?.length ?? 0;
}

/** Comprueba la cabecera x-ingest-secret (comparación en tiempo constante). */
export function checkIngestSecret(provided: string | undefined): void {
  const expected = process.env.INGEST_SECRET;
  if (!expected) {
    throw new KnowledgeError(
      'KB_CONFIG',
      'Falta la variable de entorno INGEST_SECRET: la biblioteca no admite cambios sin ella.',
      `Crea un secreto largo, cárgalo en Vercel como INGEST_SECRET y haz Redeploy (sección 10 de ${GUIDE}).`,
    );
  }
  const a = Buffer.from(provided ?? '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new KnowledgeError('KB_AUTH', 'Clave de la biblioteca incorrecta.', 'Usa el mismo valor que INGEST_SECRET en Vercel.', 401);
  }
}
