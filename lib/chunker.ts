export interface ChunkOptions {
  /** Tamaño objetivo de cada fragmento, en caracteres. */
  chunkSize?: number;
  /** Solapamiento entre fragmentos consecutivos, en caracteres. */
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 200;

/**
 * Divide un texto en fragmentos de tamaño acotado con solapamiento.
 * Intenta cortar en límites naturales (párrafo, línea, frase, espacio)
 * para no partir ideas a mitad.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = Math.max(100, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.min(
    Math.max(0, options.overlap ?? DEFAULT_OVERLAP),
    Math.floor(chunkSize / 2)
  );

  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      end = findBreak(normalized, start, end);
    }

    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= normalized.length) break;

    // Retrocede para solapar, pero avanza siempre al menos un carácter.
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/** Busca el mejor punto de corte en la segunda mitad de la ventana [start, end). */
function findBreak(text: string, start: number, end: number): number {
  const minEnd = start + Math.floor((end - start) / 2);
  const separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

  for (const sep of separators) {
    const idx = text.lastIndexOf(sep, end - sep.length);
    if (idx >= minEnd) return idx + sep.length;
  }
  return end;
}
