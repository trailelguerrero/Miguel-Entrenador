// Verificación DETERMINISTA de lo extraído del historial .md. No basta con que la
// cifra aparezca en el documento ("150 km" no es una FC de 150): tiene que aparecer
// JUNTO A lo que dice ser (FC máxima, umbral aeróbico…), y la palabra clave más
// cercana a esa cifra tiene que ser la de ese campo. Si la IA da la frase literal
// ("quote"), la frase tiene que estar en el documento y cumplir lo mismo.

type Field = 'aetHr' | 'antHr' | 'maxHr' | 'restingHr' | 'weeklyVolumeKm';

const SUMMARY_NUMBERS: Field[] = ['aetHr', 'antHr', 'maxHr', 'restingHr', 'weeklyVolumeKm'];
const PROFILE_NUMBERS: Field[] = ['aetHr', 'antHr', 'maxHr', 'restingHr'];

/** Palabras que identifican cada dato en un texto en español o inglés (texto ya normalizado). */
const FIELD_KEYWORDS: Record<Field, RegExp> = {
  maxHr: /(fc|frecuencia cardiaca|pulso|hr|pulsaciones)\s*(max|maxima|maximo)|max(imo|ima)? hr|hr max/g,
  aetHr: /\baet\b|umbral aerobico|aerobic threshold|\bvt1\b|\blt1\b/g,
  antHr: /\bant\b|umbral anaerobico|anaerobic threshold|\bvt2\b|\blt2\b|umbral lactico/g,
  restingHr: /(fc|frecuencia cardiaca|pulso|hr)\s*(en\s*)?(reposo|basal)|resting hr|\brhr\b/g,
  weeklyVolumeKm: /km\s*(a la|por|\/)\s*semana|km semanales|volumen semanal|km\/week|km per week|kilometros a la semana/g,
};

/** Unidades que contradicen el campo si van pegadas a la cifra. */
const WRONG_UNIT: Record<Field, RegExp> = {
  maxHr: /^\s*(km|m\b|min|kg|h\b|%)/,
  aetHr: /^\s*(km|m\b|min|kg|h\b|%)/,
  antHr: /^\s*(km|m\b|min|kg|h\b|%)/,
  restingHr: /^\s*(km|m\b|min|kg|h\b|%)/,
  weeklyVolumeKm: /^\s*(bpm|ppm|lpm|min|kg|%)/,
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[.,\s](\d{3})(?!\d)/g, '$1$2');

/** Posiciones de todas las palabras clave de todos los campos. */
function keywordHits(text: string): { field: Field; start: number; end: number }[] {
  const hits: { field: Field; start: number; end: number }[] = [];
  for (const field of Object.keys(FIELD_KEYWORDS) as Field[]) {
    const re = new RegExp(FIELD_KEYWORDS[field].source, 'g');
    for (const m of text.matchAll(re)) hits.push({ field, start: m.index!, end: m.index! + m[0].length });
  }
  return hits;
}

/** Distancia máxima (caracteres) entre la cifra y su palabra clave. */
const MAX_GAP = 40;

/**
 * ¿La cifra aparece en el texto como valor de ESTE campo? Para alguna aparición de
 * la cifra: sin una unidad contradictoria pegada, y con la palabra clave más cercana
 * (de cualquier campo) siendo la de este campo, a menos de MAX_GAP caracteres.
 */
export function valueStatedFor(field: Field, value: number, rawText: string): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const text = norm(rawText);
  const hits = keywordHits(text);
  const re = new RegExp(`(^|[^\\d.,])(${String(value).replace('.', '[.,]')})(?![\\d])`, 'g');
  for (const m of text.matchAll(re)) {
    const start = m.index! + m[1].length;
    const end = start + m[2].length;
    if (WRONG_UNIT[field].test(text.slice(end, end + 6))) continue;
    let best: { field: Field; gap: number } | null = null;
    for (const h of hits) {
      const gap = h.end <= start ? start - h.end : h.start >= end ? h.start - end : 0;
      if (!best || gap < best.gap) best = { field: h.field, gap };
    }
    if (best && best.field === field && best.gap <= MAX_GAP) return true;
  }
  return false;
}

/** Valor de la IA: número suelto o { value, quote }. */
function readValue(v: unknown): { value: number; quote: string | null } | null {
  if (v == null) return null;
  if (typeof v === 'object') {
    const o = v as { value?: unknown; quote?: unknown };
    const n = typeof o.value === 'number' ? o.value : Number(o.value);
    return Number.isFinite(n) ? { value: n, quote: typeof o.quote === 'string' && o.quote.trim() ? o.quote : null } : { value: NaN, quote: null };
  }
  const n = typeof v === 'number' ? v : Number(v);
  return { value: n, quote: null };
}

export function verifyHistoryNumbers(parsed: any, markdown: string): { parsed: any; removed: string[] } {
  const out = { ...(parsed || {}) };
  const removed: string[] = [];
  const doc = norm(markdown);
  const check = (obj: any, keys: Field[], prefix: string) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    for (const k of keys) {
      const r = readValue(copy[k]);
      if (!r) continue;
      // Con frase literal: tiene que estar en el documento y decir ese dato; sin ella, el documento entero
      const quoteOk = r.quote == null || doc.includes(norm(r.quote).trim());
      const ok = Number.isFinite(r.value) && quoteOk && valueStatedFor(k, r.value, r.quote ?? markdown);
      if (!ok) {
        removed.push(`${prefix}${k}=${r.value}`);
        copy[k] = null;
      } else {
        copy[k] = r.value; // la app recibe siempre el número
      }
    }
    return copy;
  };
  out.summary = check(out.summary, SUMMARY_NUMBERS, 'summary.');
  out.extractedProfileUpdates = check(out.extractedProfileUpdates, PROFILE_NUMBERS, 'profile.');
  return { parsed: out, removed };
}
