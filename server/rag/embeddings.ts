// Capa única de embeddings para la Biblioteca de Miguel. El proveedor se elige
// con variables de entorno (sin tocar código), igual que AI_PROVIDER en ai.ts:
//
//   EMBEDDING_PROVIDER=gemini (por defecto) → GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL
//   EMBEDDING_PROVIDER=openai               → OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL
//
// Todos devuelven vectores de EMBEDDING_DIMENSIONS (columna vector(1536) de
// scripts/init.sql). Cada fragmento guarda "proveedor:modelo" en su metadata y la
// búsqueda solo compara con fragmentos del mismo modelo: al cambiar de proveedor
// hay que volver a subir los documentos.
//
// Para añadir otro proveedor: una entrada más en PROVIDERS.
import { GoogleGenAI } from '@google/genai';
import { classifyAiError } from '../ai.js';
import { GUIDE, KnowledgeError } from './supabase.js';

export const EMBEDDING_DIMENSIONS = 1536;
/** Documento que se guarda o pregunta con la que se busca (algunos modelos los tratan distinto). */
export type EmbeddingPurpose = 'document' | 'query';

interface EmbeddingProvider {
  /** Variable con la API key. */
  keyVar: string;
  /** Variable con el nombre del modelo y su valor por defecto. */
  modelVar: string;
  defaultModel: string;
  /** Máximo de textos por petición. */
  batchSize: number;
  embed(texts: string[], purpose: EmbeddingPurpose, model: string): Promise<number[][]>;
}

let geminiClient: GoogleGenAI | null = null;

const PROVIDERS: Record<string, EmbeddingProvider> = {
  gemini: {
    keyVar: 'GEMINI_API_KEY',
    modelVar: 'GEMINI_EMBEDDING_MODEL',
    defaultModel: 'gemini-embedding-001',
    batchSize: 50,
    async embed(texts, purpose, model) {
      geminiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      try {
        const res = await geminiClient.models.embedContent({
          model,
          contents: texts,
          config: {
            taskType: purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        });
        return res.embeddings?.map((e) => e.values ?? []) ?? [];
      } catch (err) {
        throw classifyAiError(err, 'gemini');
      }
    },
  },
  openai: {
    keyVar: 'OPENAI_API_KEY',
    modelVar: 'OPENAI_EMBEDDING_MODEL',
    defaultModel: 'text-embedding-3-small',
    batchSize: 96,
    async embed(texts, _purpose, model) {
      const resp = await fetch(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: texts, dimensions: EMBEDDING_DIMENSIONS }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new KnowledgeError(
          'KB_EMBED',
          `OpenAI devolvió ${resp.status} al crear embeddings con "${model}".`,
          resp.status === 401 ? 'Revisa OPENAI_API_KEY en Vercel y haz Redeploy.' : 'Revisa OPENAI_EMBEDDING_MODEL y tu cuenta de OpenAI.',
          resp.status === 429 ? 429 : 502,
          text.slice(0, 400),
        );
      }
      const data = JSON.parse(text) as { data: { index: number; embedding: number[] }[] };
      return [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },
  },
};

function providerName(): string {
  return (process.env.EMBEDDING_PROVIDER || 'gemini').trim().toLowerCase();
}

function provider(): EmbeddingProvider {
  const p = PROVIDERS[providerName()];
  if (!p) {
    throw new KnowledgeError(
      'KB_CONFIG',
      `EMBEDDING_PROVIDER="${process.env.EMBEDDING_PROVIDER}" no es válido.`,
      `Usa uno de: ${Object.keys(PROVIDERS).join(', ')} (sección 10 de ${GUIDE}).`,
    );
  }
  return p;
}

/** Identificador "proveedor:modelo" que se guarda con cada fragmento. */
export function embeddingModelId(): string {
  const p = PROVIDERS[providerName()];
  if (!p) return `${providerName()}:?`;
  return `${providerName()}:${process.env[p.modelVar] || p.defaultModel}`;
}

/** Variables de embeddings que faltan (vacío = configurado). */
export function missingEmbeddingVars(): string[] {
  const p = PROVIDERS[providerName()];
  if (!p) return ['EMBEDDING_PROVIDER'];
  return process.env[p.keyVar] ? [] : [p.keyVar];
}

/** Embeddings con el proveedor configurado, en lotes y en el mismo orden. */
export async function embedTexts(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
  const p = provider();
  const missing = missingEmbeddingVars();
  if (missing.length) {
    throw new KnowledgeError('KB_CONFIG', `Falta ${missing.join(', ')} para los embeddings.`, `Cárgala en Vercel y haz Redeploy (sección 10 de ${GUIDE}).`);
  }
  const model = process.env[p.modelVar] || p.defaultModel;
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += p.batchSize) {
    const batch = texts.slice(i, i + p.batchSize);
    let vectors: number[][];
    try {
      vectors = await p.embed(batch, purpose, model);
    } catch (err) {
      if (err instanceof KnowledgeError) throw err;
      const aiErr = err as { code?: string; message: string; hint?: string; httpStatus?: number; detail?: string };
      const hint = aiErr.code === 'AI_MODEL'
        ? `Corrige ${p.modelVar} en Vercel (o bórrala para usar ${p.defaultModel}) y haz Redeploy.`
        : aiErr.hint ?? '';
      throw new KnowledgeError('KB_EMBED', `Embeddings: ${aiErr.message}`, hint, aiErr.httpStatus ?? 502, aiErr.detail);
    }
    if (vectors.length !== batch.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new KnowledgeError(
        'KB_EMBED',
        `El modelo de embeddings "${model}" no devolvió vectores de ${EMBEDDING_DIMENSIONS} dimensiones.`,
        `Usa un modelo que admita ${EMBEDDING_DIMENSIONS} dimensiones (por defecto: ${p.defaultModel}).`,
        502,
      );
    }
    out.push(...vectors);
  }
  return out;
}
