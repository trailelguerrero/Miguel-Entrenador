// Verificación DETERMINISTA de los datos de una carrera obtenidos con la
// búsqueda de Google de Gemini. Regla: sin fuente = sin verificar = null.
//   - Una cifra solo vale si aparece en un fragmento de la búsqueda respaldado
//     por al menos una página (groundingSupports).
//   - Un texto (lugar, terreno…) solo vale si la IA cita páginas reales que
//     respaldan un fragmento donde aparecen al menos la mitad de sus palabras
//     clave (sin contar palabras genéricas como "terreno" o "carrera").
//   - Coherencia entre campos: un desnivel imposible para la distancia no vale,
//     y se avisa si distancia y desnivel salen de páginas distintas.
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
  /** Avisos de coherencia entre campos (datos que no encajan entre sí). */
  warnings: string[];
}

/** Más de 250 m de D+ por km no existe ni en un kilómetro vertical: el dato no es de esta carrera. */
export const MAX_GAIN_PER_KM = 250;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Formas en que puede aparecer una cifra en una web: 4350, 4.350, 4,350, 4 350
 * (también con espacio fino), 4'350; 42.2 / 42,2; dígitos de ancho completo (４３５０).
 */
export function numberAppears(n: number, text: string): boolean {
  if (!Number.isFinite(n) || n <= 0) return false;
  const t = text.normalize('NFKC').replace(/(\d)[.,\s'’](\d{3})(?!\d)/g, '$1$2'); // quita separadores de miles
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

/** Palabras que aparecen en cualquier página de trail: no prueban nada. */
const GENERIC_WORDS = new Set([
  'terreno', 'terrenos', 'carrera', 'carreras', 'trail', 'running', 'montana', 'montanas', 'recorrido', 'tramo', 'tramos',
  'zona', 'zonas', 'salida', 'meta', 'ruta', 'camino', 'caminos', 'con', 'del', 'los', 'las', 'una', 'por', 'para', 'que',
  'entre', 'desde', 'hasta', 'muy', 'mas', 'the', 'and', 'race', 'course', 'km', 'metros',
]);
export const keywords = (s: string) => [...new Set(norm(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w)))];

/** Un texto está respaldado si el fragmento contiene al menos la mitad de sus palabras clave. */
export function textAppears(words: string[], text: string): boolean {
  if (!words.length) return false;
  const t = norm(text);
  const hits = words.filter((w) => new RegExp(`(^|[^a-z0-9ñ])${w}`).test(t)).length;
  return hits >= Math.ceil(words.length / 2);
}

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
        : (seg: GroundedSegment) => textAppears(words, seg.text);
    // Para textos se exige que la IA cite páginas concretas
    const idx = value && claimed.length && (f === 'date' || words.length) ? pick(search.segments, claimed, matches) : null;
    if (idx) {
      fields[f] = { value, sources: idx.map((i) => search.sources[i]) };
      idx.forEach((i) => used.add(i));
    } else unverified.push(f);
  }

  const warnings = checkRaceCoherence(fields, unverified);
  // Las páginas usadas se recalculan por si la coherencia quitó algún campo
  const kept = new Set(Object.values(fields).flatMap((f) => f!.sources.map((s) => search.sources.indexOf(s))));
  return { fields, unverified, sources: [...kept].filter((i) => i >= 0).sort((a, b) => a - b).map((i) => search.sources[i]), queries: search.queries, warnings };
}

/** Comprueba que los datos verificados encajan entre sí. Modifica fields/unverified y devuelve avisos. */
export function checkRaceCoherence(fields: VerifiedRaceInfo['fields'], unverified: RaceField[]): string[] {
  const warnings: string[] = [];
  const dist = fields.distanceKm;
  if (!dist) return warnings;
  const km = Number(dist.value);
  for (const f of ['elevationGainM', 'elevationLossM'] as const) {
    const el = fields[f];
    if (!el) continue;
    if (Number(el.value) / km > MAX_GAIN_PER_KM) {
      warnings.push(`${RACE_FIELD_LABEL[f]} ${el.value} m imposible para ${km} km (más de ${MAX_GAIN_PER_KM} m/km): descartado`);
      delete fields[f];
      unverified.push(f);
      continue;
    }
    const shared = el.sources.some((s) => dist.sources.some((d) => d.uri === s.uri));
    if (!shared) warnings.push(`${RACE_FIELD_LABEL[f]} y distancia salen de páginas distintas: comprueba que son de la misma prueba`);
  }
  return warnings;
}

/**
 * El consejo de Miguel no puede traer cifras de la carrera que no estén verificadas:
 * toda cifra seguida de km / m / metros / D+ debe coincidir (±1) con un dato verificado.
 */
/** Cifras del objetivo principal que Miguel puede citar al comparar (por defecto, la Transvulcania). */
export const TARGET_RACE = { distanceKm: 73, metres: [4350, 4057, 2426, 2400] };

/** Cifras de la carrera objetivo que envía la app; sin datos válidos, las de la Transvulcania. */
export function targetFigures(t: any): { distanceKm: number; metres: number[] } {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const dist = n(t?.distanceKm);
  const metres = [n(t?.elevationGainM), n(t?.elevationLossM)].filter((x): x is number => x != null);
  if (!dist || !metres.length) return TARGET_RACE;
  return { distanceKm: dist, metres };
}

const thousands = (s: string) => s.normalize('NFKC').replace(/(\d)[.,\s'’](\d{3})(?!\d)/g, '$1$2');
const FIGURE_RE = /(\d+(?:[.,]\d+)?)\s*(km|kms|kil[oó]metros|m\b|metros|mts|d\+|d-)/gi;

/**
 * Cifras que el consejo puede citar, por unidad: las verificadas, las de la
 * Transvulcania y lo que se deriva de ellas al compararlas (diferencias, sumas
 * y metros de desnivel por km).
 */
export function allowedAdviceFigures(v: VerifiedRaceInfo, target = TARGET_RACE): { km: number[]; m: number[] } {
  const val = (f: RaceField) => (typeof v.fields[f]?.value === 'number' ? (v.fields[f]!.value as number) : null);
  const dist = val('distanceKm');
  const km = [target.distanceKm, ...(dist != null ? [dist] : [])];
  const m = [...target.metres, ...[val('elevationGainM'), val('elevationLossM')].filter((x): x is number => x != null)];
  const alt = v.fields.altitudeRange?.value;
  if (typeof alt === 'string') for (const x of thousands(alt).matchAll(/\d+(?:[.,]\d+)?/g)) m.push(Number(x[0].replace(',', '.')));
  const derive = (xs: number[]) => {
    const out = [...xs];
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push(Math.abs(xs[i] - xs[j]), xs[i] + xs[j]);
    return out;
  };
  // Desnivel por km ("60 m/km"), de esta carrera y de la Transvulcania
  const perKm: number[] = [target.metres[0] / target.distanceKm];
  const gain = val('elevationGainM');
  if (gain != null && dist) perKm.push(gain / dist);
  return { km: derive(km), m: [...derive(m), ...perKm] };
}

/** Una cifra vale si coincide con una permitida (±1 o ±0,5 % por redondeo). */
const matchesAllowed = (n: number, allowed: number[]) => allowed.some((a) => Math.abs(a - n) <= Math.max(1, a * 0.005));

/** Cifras de km/m de un texto que no se pueden respaldar. */
export function unverifiedAdviceFigures(text: string, allowed: { km: number[]; m: number[] }): string[] {
  const bad: string[] = [];
  for (const x of thousands(text).matchAll(FIGURE_RE)) {
    const n = Number(x[1].replace(',', '.'));
    const unit = /^k/i.test(x[2]) ? 'km' : 'm';
    if (!matchesAllowed(n, allowed[unit])) bad.push(x[0].trim());
  }
  return bad;
}

/**
 * El consejo de Miguel no puede traer cifras de la carrera que no estén verificadas
 * ni se deriven de ellas. Se quitan SOLO las frases con cifras sin respaldo; si no
 * queda nada, el consejo es null.
 */
export function filterRaceAdvice(advice: string, v: VerifiedRaceInfo, target = TARGET_RACE): { advice: string | null; removed: string[] } {
  const allowed = allowedAdviceFigures(v, target);
  const sentences = advice.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const kept: string[] = [];
  const removed: string[] = [];
  for (const sentence of sentences) {
    const bad = unverifiedAdviceFigures(sentence, allowed);
    if (bad.length) removed.push(...bad);
    else kept.push(sentence);
  }
  return { advice: kept.length ? kept.join(' ') : null, removed };
}

export function adviceUsesOnlyVerifiedNumbers(advice: string, v: VerifiedRaceInfo, target = TARGET_RACE): boolean {
  return unverifiedAdviceFigures(advice, allowedAdviceFigures(v, target)).length === 0;
}

/** Texto con solo los datos verificados, para que Miguel dé su consejo sin inventar. */
export function describeVerifiedRace(v: VerifiedRaceInfo): string {
  const lines = Object.entries(v.fields).map(([k, f]) => `- ${RACE_FIELD_LABEL[k as RaceField]}: ${f!.value} (fuente: ${f!.sources.map((s) => s.title).join(', ')})`);
  if (v.unverified.length) lines.push(`- SIN VERIFICAR (no uses ni supongas estos datos): ${v.unverified.map((f) => RACE_FIELD_LABEL[f]).join(', ')}`);
  for (const w of v.warnings || []) lines.push(`- AVISO DE COHERENCIA: ${w}`);
  return lines.join('\n');
}
