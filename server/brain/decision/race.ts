// Verificación DETERMINISTA de los datos de una carrera obtenidos con la
// búsqueda de Google de Gemini. Regla: sin fuente = sin verificar = null.
//   - Una cifra solo vale si aparece en un fragmento de la búsqueda respaldado
//     por al menos una página (groundingSupports).
//   - Un texto (lugar, terreno…) solo vale si la IA cita páginas reales que
//     respaldan algún fragmento donde aparece alguna de sus palabras clave.
import type { GroundedSegment, SearchResult, WebSource } from '../../ai.js';

export const RACE_NUMERIC_FIELDS = ['distanceKm', 'elevationGainM', 'elevationLossM'] as const;
export const RACE_TEXT_FIELDS = ['name', 'date', 'location', 'terrainDescription', 'altitudeRange'] as const;
export type RaceField = (typeof RACE_NUMERIC_FIELDS)[number] | (typeof RACE_TEXT_FIELDS)[number];

export const RACE_FIELD_LABEL: Record<RaceField, string> = {
  name: 'nombre oficial',
  date: 'fecha',
  distanceKm: 'distancia',
  elevationGainM: 'desnivel positivo',
  elevationLossM: 'desnivel negativo',
  location: 'lugar',
  terrainDescription: 'terreno',
  altitudeRange: 'altitud mínima y máxima',
};

export interface VerifiedField<T> {
  value: T;
  sources: WebSource[];
}

export interface VerifiedRaceInfo {
  fields: Partial<Record<RaceField, VerifiedField<string | number>>>;
  /** Campos que la búsqueda no pudo respaldar (se dejan vacíos). */
  unverified: RaceField[];
  /** Páginas que respaldan algún dato. */
  sources: WebSource[];
  queries: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Formas en que puede aparecer una cifra en una web: 4350, 4.350, 4,350, 4 350; 42.2 / 42,2. */
export function numberAppears(n: number, text: string): boolean {
  if (!Number.isFinite(n) || n <= 0) return false;
  const t = text.replace(/(\d)[.,\s](\d{3})(?!\d)/g, '$1$2'); // quita separadores de miles
  const variants = Number.isInteger(n) ? [String(n)] : [String(n), String(n).replace('.', ',')];
  return variants.some((v) => new RegExp(`(^|[^\\d.,])${v.replace('.', '\\.')}(?![\\d])`).test(t));
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Una fecha AAAA-MM-DD está respaldada si el fragmento trae año, día y mes (nombre o número). */
export function dateAppears(iso: string, text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [, y, mo, d] = m;
  const t = norm(text);
  const day = String(Number(d));
  const month = Number(mo) - 1;
  const hasYear = new RegExp(`(^|\\D)${y}(\\D|$)`).test(t);
  const hasDay = new RegExp(`(^|\\D)0?${day}(\\D|$)`).test(t);
  const hasMonth = t.includes(MONTHS[month]) || t.includes(MONTHS_EN[month]) || new RegExp(`(^|\\D)0?${Number(mo)}[/.-]`).test(t) || new RegExp(`[/.-]0?${Number(mo)}(\\D|$)`).test(t);
  return hasYear && hasDay && hasMonth;
}

const keywords = (s: string) => norm(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4);

function validIdx(raw: unknown, max: number): number[] {
  return (Array.isArray(raw) ? raw : []).filter((i): i is number => Number.isInteger(i) && i >= 0 && i < max);
}

function pick(segments: GroundedSegment[], claimed: number[], test: (seg: GroundedSegment) => boolean): number[] | null {
  const hits = segments.filter((s) => test(s) && (claimed.length === 0 || s.sourceIdx.some((i) => claimed.includes(i))));
  if (!hits.length) return null;
  return [...new Set(hits.flatMap((h) => (claimed.length ? h.sourceIdx.filter((i) => claimed.includes(i)) : h.sourceIdx)))];
}

/**
 * @param extracted JSON de la IA: { campo: { value, sources: [índices] } }
 */
export function verifyRaceInfo(extracted: any, search: SearchResult): VerifiedRaceInfo {
  const fields: VerifiedRaceInfo['fields'] = {};
  const unverified: RaceField[] = [];
  const used = new Set<number>();
  const n = search.sources.length;

  for (const f of RACE_NUMERIC_FIELDS) {
    const raw = extracted?.[f];
    const value = typeof raw?.value === 'number' ? raw.value : Number(raw?.value);
    const idx = Number.isFinite(value) && value > 0 ? pick(search.segments, validIdx(raw?.sources, n), (s) => numberAppears(value, s.text)) : null;
    if (idx) {
      fields[f] = { value, sources: idx.map((i) => search.sources[i]) };
      idx.forEach((i) => used.add(i));
    } else unverified.push(f);
  }

  for (const f of RACE_TEXT_FIELDS) {
    const raw = extracted?.[f];
    const value = typeof raw?.value === 'string' ? raw.value.trim() : '';
    const claimed = validIdx(raw?.sources, n);
    const words = keywords(value);
    const matches =
      f === 'date'
        ? (seg: GroundedSegment) => dateAppears(value, seg.text)
        : (seg: GroundedSegment) => {
            const t = norm(seg.text);
            return words.some((w) => t.includes(w));
          };
    // Para textos se exige que la IA cite páginas concretas
    const idx = value && claimed.length && (f === 'date' || words.length) ? pick(search.segments, claimed, matches) : null;
    if (idx) {
      fields[f] = { value, sources: idx.map((i) => search.sources[i]) };
      idx.forEach((i) => used.add(i));
    } else unverified.push(f);
  }

  return { fields, unverified, sources: [...used].sort((a, b) => a - b).map((i) => search.sources[i]), queries: search.queries };
}

/** Texto con solo los datos verificados, para que Miguel dé su consejo sin inventar. */
export function describeVerifiedRace(v: VerifiedRaceInfo): string {
  const lines = Object.entries(v.fields).map(([k, f]) => `- ${RACE_FIELD_LABEL[k as RaceField]}: ${f!.value} (fuente: ${f!.sources.map((s) => s.title).join(', ')})`);
  if (v.unverified.length) lines.push(`- SIN VERIFICAR (no uses ni supongas estos datos): ${v.unverified.map((f) => RACE_FIELD_LABEL[f]).join(', ')}`);
  return lines.join('\n');
}
