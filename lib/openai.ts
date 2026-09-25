import OpenAI from "openai";
import { ConfigError } from "./supabaseAdmin";

let client: OpenAI | null = null;

/**
 * Cliente de OpenAI creado de forma perezosa. Solo para código de servidor.
 * Lanza ConfigError si falta OPENAI_API_KEY en el momento de usarse.
 */
export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ConfigError("Falta la variable de entorno OPENAI_API_KEY.");
  }

  client = new OpenAI({ apiKey });
  return client;
}

export function getEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}

export function getChatModel(): string {
  return process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
}

/** Dimensión del vector en scripts/init.sql (vector(1536)). */
export const EMBEDDING_DIMENSIONS = 1536;

/** Máximo de entradas por petición de embeddings (margen bajo el límite de OpenAI). */
const EMBEDDING_BATCH_SIZE = 96;

/** Genera embeddings para varios textos, en lotes, preservando el orden. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const model = getEmbeddingModel();
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const res = await openai.embeddings.create({
      model,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding);
  }

  return out;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
