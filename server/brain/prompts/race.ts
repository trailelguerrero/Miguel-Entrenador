// Prompts de /api/race-info (búsqueda → extracción → consejo con datos verificados).
import type { SearchResult } from '../../ai.js';
import { describeVerifiedRace, type VerifiedRaceInfo } from '../decision/race.js';

export const RACE_SEARCH_SYSTEM =
  'Eres un documentalista de carreras de trail. Solo afirmas lo que encuentras en las páginas consultadas, citando cifras exactas tal como aparecen. Si no encuentras un dato, dices que no aparece.';

export function buildRaceSearchPrompt(raceName: string, approximateDate?: string, distanceKm?: number): string {
  return `Busca en la web oficial y en fuentes fiables la carrera de montaña "${raceName}"${distanceKm ? ` (distancia aproximada ${distanceKm} km)` : ''}${approximateDate ? `, edición cercana a ${approximateDate}` : ''}.
Indica, con la cifra exacta de la fuente: nombre oficial, fecha de la edición más próxima, lugar de salida/meta, distancia (km), desnivel positivo (m), desnivel negativo (m), altitud mínima y máxima y tipo de terreno.
Si la carrera tiene varias distancias, céntrate en la más parecida a ${distanceKm ? `${distanceKm} km` : 'la principal'}. No completes nada que no encuentres.`;
}

export const RACE_EXTRACTION_SYSTEM = 'Extraes datos a JSON. No añades nada que no esté en el texto.';

export function buildRaceExtractionPrompt(search: SearchResult): string {
  return `Texto de la búsqueda:
"""
${search.text}
"""
Páginas consultadas (índice: título — url):
${search.sources.map((src, i) => `${i}: ${src.title} — ${src.uri}`).join('\n')}

Devuelve JSON con este formato; value null si el dato no aparece en el texto; "sources" = índices de las páginas que lo dicen:
{
  "name": { "value": "texto o null", "sources": [0] },
  "date": { "value": "AAAA-MM-DD o null", "sources": [] },
  "location": { "value": "texto o null", "sources": [] },
  "distanceKm": { "value": número o null, "sources": [] },
  "elevationGainM": { "value": número o null, "sources": [] },
  "elevationLossM": { "value": número o null, "sources": [] },
  "altitudeRange": { "value": "mínima - máxima o null", "sources": [] },
  "terrainDescription": { "value": "texto o null", "sources": [] }
}`;
}

export function buildRaceAdvicePrompt(raceName: string, verified: VerifiedRaceInfo): string {
  return `Datos VERIFICADOS de la carrera "${raceName}":
${describeVerifiedRace(verified)}

En 2-3 frases, como Miguel, di cómo encaja como carrera preparatoria (prioridad B o C) para la Transvulcania 2027. Usa solo los datos verificados; si falta alguno importante, dilo. Responde en JSON: { "strategicAdvice": "texto" }`;
}
