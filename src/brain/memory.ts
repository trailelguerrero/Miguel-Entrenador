/**
 * MEMORIA DE MIGUEL BASADA EN EVIDENCIAS (determinista).
 *
 * La IA solo describe lo que ocurrió (una evidencia) y, como mucho, propone una
 * hipótesis. El ESTADO de cada aprendizaje lo decide este código:
 *
 *   1 evidencia a favor            → observación      (no se aplica)
 *   2 evidencias a favor           → hipótesis        (se vigila, no se aplica)
 *   ≥ 3 a favor                    → regla provisional (se aplica)
 *   ≥ 5 a favor y ninguna en contra → regla consolidada (se aplica)
 *   cada evidencia en contra baja un nivel; por debajo de observación → descartada
 *   evidencia en contra GRAVE (lesión, dolor agudo, sobreentrenamiento) → descartada
 *     hasta que acumule ≥ 3 evidencias a favor POSTERIORES (solo cuentan esas)
 *   90 días sin evidencias nuevas  → caducada (no se aplica hasta nueva evidencia;
 *     la nueva evidencia la reactiva con todo su historial)
 *
 * Una misma sesión o nota solo cuenta una vez por aprendizaje (refId), y lo que
 * cuenta el atleta (chat o nota) suma como mucho una evidencia por aprendizaje y día.
 */
import type { CoachLearnedInsight, CoachLearnedMemory, InsightEvidence, InsightStatus, PendingMemoryEvidence } from '../types';

export const PROVISIONAL_MIN = 3;
export const CONSOLIDATED_MIN = 5;
export const EXPIRY_DAYS = 90;
/** Máximo de evidencias que se aceptan de una sola llamada a la IA. */
export const MAX_EVIDENCE_PER_EVENT = 3;
/** Solo en estas categorías una evidencia en contra puede ser grave (seguridad del atleta). */
export const CRITICAL_CATEGORIES: CoachLearnedInsight['category'][] = ['biomechanics_injury', 'fatigue_recovery'];
/** Pendientes del chat: se olvidan a los 30 días y se guardan como mucho 20. */
export const PENDING_MAX_DAYS = 30;
export const PENDING_MAX = 20;
/** Máximo de observaciones/hipótesis y de caducadas/descartadas que se pasan a Miguel. */
export const PROMPT_MAX_WATCH = 10;
export const PROMPT_MAX_OLD = 5;
/** Máximo de reglas aplicables que se pasan a Miguel. */
export const PROMPT_MAX_RULES = 20;

export const INSIGHT_CATEGORIES: CoachLearnedInsight['category'][] = [
  'physiology_zonesense',
  'fatigue_recovery',
  'biomechanics_injury',
  'nutrition_hydration',
  'terrain_technique',
];

const LEVELS: InsightStatus[] = ['observation', 'hypothesis', 'provisional_rule', 'consolidated_rule'];

export const STATUS_LABEL: Record<InsightStatus, string> = {
  observation: 'Observación',
  hypothesis: 'Hipótesis',
  provisional_rule: 'Regla provisional',
  consolidated_rule: 'Regla consolidada',
  refuted: 'Descartada',
  expired: 'Caducada',
};

/** Solo estas se aplican como reglas en los planes. */
export const isAppliedRule = (s: InsightStatus | undefined) => s === 'provisional_rule' || s === 'consolidated_rule';

function daysBetween(a: string, b: string): number {
  const pa = Date.parse(a.slice(0, 10));
  const pb = Date.parse(b.slice(0, 10));
  return Math.round((pb - pa) / 86400000);
}

export function countEvidence(evidence: InsightEvidence[] | undefined) {
  const ev = evidence || [];
  return { support: ev.filter((e) => e.supports).length, against: ev.filter((e) => !e.supports).length };
}

/** Estado según las evidencias (y la fecha de hoy, para la caducidad). */
export function computeInsightStatus(evidence: InsightEvidence[] | undefined, today: string): InsightStatus {
  // Una evidencia grave anula todo lo anterior: solo cuenta lo que venga después
  const lastCritical = (evidence || []).filter((e) => !e.supports && e.critical).map((e) => e.date).sort().pop();
  if (lastCritical) {
    const after = (evidence || []).filter((e) => e.date > lastCritical);
    if (countEvidence(after).support < PROVISIONAL_MIN) return 'refuted';
    return computeInsightStatus(after, today);
  }
  const { support, against } = countEvidence(evidence);
  if (support === 0) return against > 0 ? 'refuted' : 'observation';
  const base = support >= CONSOLIDATED_MIN ? 3 : support >= PROVISIONAL_MIN ? 2 : support - 1; // 1→0, 2→1
  // Cada evidencia en contra baja un nivel (así la consolidada exige cero contradicciones)
  const level = base - against;
  if (level < 0) return 'refuted';
  const last = lastEvidenceDate(evidence);
  if (last && daysBetween(last, today) > EXPIRY_DAYS) return 'expired';
  return LEVELS[level];
}

function lastEvidenceDate(evidence: InsightEvidence[] | undefined): string | null {
  const dates = (evidence || []).map((e) => e.date).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Recalcula estado, fecha de la última evidencia y confianza (derivada, no de la IA). */
export function refreshInsight(i: CoachLearnedInsight, today: string): CoachLearnedInsight {
  const evidence = i.evidence && i.evidence.length ? i.evidence : legacyEvidence(i);
  const { support, against } = countEvidence(evidence);
  const status = computeInsightStatus(evidence, today);
  return {
    ...i,
    evidence,
    status,
    lastEvidenceAt: lastEvidenceDate(evidence) ?? i.learnedFromDate,
    // Proporción de evidencias a favor (dato derivado, no una estimación de la IA)
    confidenceScore: support + against > 0 ? Math.round((support / (support + against)) * 100) : 0,
  };
}

/** Aprendizajes de versiones anteriores: pasan a observación con una sola evidencia. */
function legacyEvidence(i: CoachLearnedInsight): InsightEvidence[] {
  return [{ date: i.learnedFromDate || new Date().toISOString().slice(0, 10), source: 'legacy', supports: true, summary: i.observation }];
}

export function refreshMemory(m: CoachLearnedMemory, today: string): CoachLearnedMemory {
  const pendingEvidence = (m.pendingEvidence || []).filter((p) => daysBetween(p.date, today) <= PENDING_MAX_DAYS).slice(0, PENDING_MAX);
  return { ...m, insights: (m.insights || []).map((i) => refreshInsight(i, today)), pendingEvidence };
}

/** Lo que devuelve la IA por cada cosa observada (ya validado con sanitizeEvidenceItems). */
export interface EvidenceItem {
  /** Id de un aprendizaje existente al que apoya o contradice; null = hallazgo nuevo. */
  insightId: string | null;
  supports: boolean;
  summary: string;
  /** Evidencia en contra grave (solo en CRITICAL_CATEGORIES). */
  critical?: boolean;
  /** Solo para hallazgos nuevos. */
  category?: CoachLearnedInsight['category'];
  observation?: string;
  hypothesis?: string;
}

/** Prioridad al recortar: grave en contra, en contra, apoyo a lo existente, hallazgo nuevo. */
const evidencePriority = (e: EvidenceItem) => (e.critical ? 0 : !e.supports ? 1 : e.insightId ? 2 : 3);

/**
 * Limpia la salida de la IA: ids que existen, categorías válidas, máximo por evento.
 * Si sobran, se quedan las más importantes (no las primeras que listó la IA).
 */
export function sanitizeEvidenceItems(raw: unknown, memory: CoachLearnedMemory | null | undefined): EvidenceItem[] {
  const categoryById = new Map((memory?.insights || []).map((i) => [i.id, i.category]));
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: EvidenceItem[] = [];
  for (const r of list as any[]) {
    if (!r || typeof r !== 'object') continue;
    const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
    if (!summary) continue;
    const insightId = typeof r.insightId === 'string' && categoryById.has(r.insightId) ? r.insightId : null;
    // El modelo a veces devuelve el booleano como texto: "false" es EN CONTRA, nunca a favor
    const supports = r.supports === true || r.supports === 'true' ? true : r.supports === false || r.supports === 'false' ? false : r.supports == null ? true : null;
    if (supports === null) continue;
    if (insightId) {
      const critical = !supports && r.critical === true && CRITICAL_CATEGORIES.includes(categoryById.get(insightId)!);
      out.push(critical ? { insightId, supports, summary, critical } : { insightId, supports, summary });
    } else {
      // Un hallazgo nuevo solo puede nacer de algo que SÍ ocurrió
      const category = INSIGHT_CATEGORIES.includes(r.category) ? r.category : null;
      const observation = typeof r.observation === 'string' ? r.observation.trim() : '';
      if (!supports || !category || !observation) continue;
      out.push({ insightId: null, supports: true, summary, category, observation, hypothesis: typeof r.hypothesis === 'string' ? r.hypothesis.trim() : '' });
    }
  }
  if (out.length > MAX_EVIDENCE_PER_EVENT) {
    console.warn(`[memoria] ${out.length - MAX_EVIDENCE_PER_EVENT} evidencia(s) descartada(s) por superar el máximo de ${MAX_EVIDENCE_PER_EVENT} por evento`);
  }
  // sort es estable: dentro de la misma prioridad se respeta el orden de la IA
  return out.sort((a, b) => evidencePriority(a) - evidencePriority(b)).slice(0, MAX_EVIDENCE_PER_EVENT);
}

export interface EvidenceContext {
  date: string;
  source: InsightEvidence['source'];
  /** Sesión, nota o conversación de origen: evita contar dos veces lo mismo. */
  refId?: string;
  sourceEvent: string;
}

/** Fuentes que son lo que cuenta el atleta (no una sesión medida). */
const SUBJECTIVE_SOURCES: InsightEvidence['source'][] = ['chat', 'athlete_note'];

/** Palabras que no distinguen un aprendizaje de otro. */
const STOP = new Set(['para', 'como', 'cuando', 'pero', 'porque', 'desde', 'hasta', 'entre', 'sobre', 'tras', 'durante', 'despues', 'antes', 'mucho', 'poco', 'mas', 'menos', 'muy', 'esta', 'este', 'esto', 'tiene', 'hace', 'sesion', 'sesiones', 'entreno', 'entrenos', 'atleta', 'siempre', 'veces']);
const words = (s: string) => new Set(normSummary(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOP.has(w)));

/**
 * Rasgos que distinguen aprendizajes aunque el resto de palabras coincida:
 * lado del cuerpo, subida frente a bajada, calor frente a frío. Si dos
 * observaciones dicen cosas distintas en uno de estos rasgos, NO son la misma.
 */
const CONTRAST_FEATURES: Record<string, RegExp>[] = [
  { izquierdo: /\bizq/, derecho: /\bderech/ },
  { subida: /\b(subid|ascens|cuesta arriba|rampa)/, bajada: /\b(bajad|descens|cuesta abajo)/ },
  { calor: /\b(calor|caluros)/, frio: /\b(frio|fria)/ },
];

function featureValues(text: string): string[] {
  const t = normSummary(text);
  return CONTRAST_FEATURES.map((group) => {
    const hits = Object.entries(group).filter(([, re]) => re.test(t)).map(([k]) => k);
    return hits.length === 1 ? hits[0] : '';
  });
}

/** ¿Dos observaciones chocan en un rasgo distintivo (p. ej. sóleo izquierdo vs derecho)? */
export function contrastingObservations(a: string, b: string): boolean {
  const fa = featureValues(a);
  const fb = featureValues(b);
  return fa.some((v, i) => v !== fb[i] && (v !== '' || fb[i] !== ''));
}

/**
 * POLARIDAD: ¿el texto dice que algo NO ocurrió o ya no ocurre? ("ya no me duele",
 * "sin molestias", "no noté carga", "ha desaparecido"). Se busca la negación
 * pegada al síntoma, no cualquier "no": "no pude terminar por el dolor" sigue
 * siendo afirmativo.
 */
const NEGATION = new RegExp(
  [
    String.raw`\bya no\b`,
    String.raw`\bno (me |le |se |te |lo |la |he |ha |hubo )?(duel|dolio|dolia|molest|carg|not|aparec|hub|tuv|sent|sint|volvi|repiti)`,
    String.raw`\bni (rastro|una) (de )?(dolor|molesti|carga)`,
    String.raw`\bsin (ningun[ao]? )?(dolor|molesti|carga|problema|sintoma|rastro|pinchazo|calambre)`,
    String.raw`\b(desaparecid|desaparecio|se (me )?ha ido|se (me )?fue|ya esta bien|recuperad[oa] del todo|curad[oa])`,
  ].join('|'),
);

export function isNegatedObservation(text: string): boolean {
  return NEGATION.test(normSummary(text));
}

/** Palabras clave compartidas / las de la más corta (0 si chocan en lado, pendiente o temperatura). Ignora la polaridad. */
function topicSimilarity(a: string, b: string): number {
  if (contrastingObservations(a, b)) return 0;
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

/**
 * Parecido entre dos observaciones. Si una afirma y la otra niega ("me duele el sóleo"
 * frente a "ya no me duele el sóleo") NO son la misma observación: 0.
 */
export function observationSimilarity(a: string, b: string): number {
  if (isNegatedObservation(a) !== isNegatedObservation(b)) return 0;
  return topicSimilarity(a, b);
}

/** Umbral para considerar que un "hallazgo nuevo" es el mismo que uno existente. */
export const SAME_INSIGHT_SIMILARITY = 0.6;

/**
 * Aprendizaje existente sobre el MISMO tema pero con la polaridad contraria (lo
 * nuevo niega lo que dice el aprendizaje, o al revés). Esa evidencia va EN CONTRA
 * del existente; nunca a favor ni como observación nueva.
 */
export function findOppositeInsight(insights: CoachLearnedInsight[], category: CoachLearnedInsight['category'], observation: string): CoachLearnedInsight | null {
  const neg = isNegatedObservation(observation);
  let best: CoachLearnedInsight | null = null;
  let bestScore = SAME_INSIGHT_SIMILARITY;
  for (const i of insights) {
    if (i.category !== category || isNegatedObservation(i.observation) === neg) continue;
    const score = topicSimilarity(i.observation, observation);
    if (score >= bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Aprendizaje existente de la misma categoría que dice lo mismo que un hallazgo nuevo.
 * Evita que una misma observación, redactada distinta cada vez, quede repartida en
 * varias observaciones de 1 evidencia que nunca llegan a regla.
 */
export function findSimilarInsight(insights: CoachLearnedInsight[], category: CoachLearnedInsight['category'], observation: string): CoachLearnedInsight | null {
  let best: CoachLearnedInsight | null = null;
  let bestScore = SAME_INSIGHT_SIMILARITY;
  for (const i of insights) {
    if (i.category !== category) continue;
    const score = observationSimilarity(i.observation, observation);
    if (score >= bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/** ¿El resumen niega lo que afirma la observación (o al revés) sobre el mismo tema? */
function contradicts(observation: string, summary: string): boolean {
  return isNegatedObservation(observation) !== isNegatedObservation(summary) && topicSimilarity(observation, summary) >= SAME_INSIGHT_SIMILARITY;
}

let idSeq = 0;
const newId = () => `insight-${Date.now()}-${idSeq++}`;

/** Aplica evidencias a la memoria. Devuelve la memoria nueva y qué cambió (para mostrarlo). */
export function applyEvidence(
  memory: CoachLearnedMemory,
  items: EvidenceItem[],
  ctx: EvidenceContext,
  today: string = ctx.date,
): { memory: CoachLearnedMemory; changes: string[] } {
  const insights = [...(memory.insights || [])];
  const changes: string[] = [];
  for (const raw of items) {
    // Hallazgo "nuevo" que ya existe con otras palabras → evidencia del existente;
    // si dice lo contrario ("ya no me duele" frente a "me duele") → evidencia EN CONTRA
    const isNew = raw.insightId == null && !!raw.category && !!raw.observation;
    const similar = isNew ? findSimilarInsight(insights, raw.category!, raw.observation!) : null;
    const opposite = isNew && !similar ? findOppositeInsight(insights, raw.category!, raw.observation!) : null;
    let item: EvidenceItem = similar
      ? { insightId: similar.id, supports: true, summary: raw.summary }
      : opposite
        ? { insightId: opposite.id, supports: false, summary: raw.summary }
        : raw;
    // La IA marca "a favor" algo que niega el aprendizaje ("ya no me duele el sóleo" como
    // apoyo de "me duele el sóleo") → no puede apoyarlo: cuenta en contra
    if (item.insightId && item.supports) {
      const target = insights.find((i) => i.id === item.insightId);
      if (target && contradicts(target.observation, item.summary)) {
        item = { insightId: item.insightId, supports: false, summary: item.summary };
        changes.push(`"${target.observation}": la evidencia dice lo contrario ("${item.summary}"), se cuenta en contra`);
      }
    }
    const ev: InsightEvidence = { date: ctx.date, source: ctx.source, supports: item.supports, summary: item.summary, refId: ctx.refId };
    if (item.critical) ev.critical = true;
    const idx = item.insightId ? insights.findIndex((i) => i.id === item.insightId) : -1;
    if (idx >= 0) {
      const prev = refreshInsight(insights[idx], today);
      // Lo que cuenta el atleta (chat o nota) suele ser el mismo hecho que ya contó ese día
      // la sesión u otra nota: como mucho UNA evidencia por aprendizaje y día. Repetir la
      // misma nota tres veces no la convierte en regla.
      const subjective = SUBJECTIVE_SOURCES.includes(ctx.source);
      const sameRef = (e: InsightEvidence) => !!ctx.refId && e.refId === ctx.refId && e.source === ctx.source;
      const sameDay = subjective
        ? (prev.evidence || []).some(
            (e) => e.date === ctx.date && e.supports === item.supports && !!e.critical === !!item.critical && !sameRef(e),
          )
        : false;
      if (sameDay) {
        changes.push(`"${prev.observation}": ya estaba contada una evidencia de ese día (no se suma dos veces)`);
        continue;
      }
      // Como mucho UNA evidencia subjetiva por aprendizaje y día: si el atleta cambia de
      // sentido ese mismo día (por la mañana "me carga", por la tarde "hoy no"), la
      // nueva SUSTITUYE a la anterior; no cuentan como dos días de evidencia.
      const supersededSubjective = subjective
        ? (prev.evidence || []).filter((e) => e.date === ctx.date && SUBJECTIVE_SOURCES.includes(e.source) && !sameRef(e))
        : [];
      if (supersededSubjective.length) changes.push(`"${prev.observation}": lo que contaste hoy sustituye a lo anotado antes ese mismo día`);
      // Misma sesión/nota ya contada para este aprendizaje → se sustituye, no se suma
      const kept = (prev.evidence || []).filter((e) => !sameRef(e) && !supersededSubjective.includes(e));
      const next = refreshInsight({ ...prev, evidence: [...kept, ev] }, today);
      insights[idx] = next;
      if (next.status !== prev.status) changes.push(`"${next.observation}": ${STATUS_LABEL[prev.status!]} → ${STATUS_LABEL[next.status!]}`);
      else changes.push(`"${next.observation}": evidencia ${item.supports ? 'a favor' : item.critical ? 'en contra GRAVE' : 'en contra'} (${STATUS_LABEL[next.status!]})`);
    } else if (item.insightId == null && item.category && item.observation) {
      const created = refreshInsight(
        {
          id: newId(),
          category: item.category,
          observation: item.observation,
          ruleForFuturePlans: item.hypothesis || '',
          confidenceScore: 0,
          learnedFromDate: ctx.date,
          sourceEvent: ctx.sourceEvent,
          evidence: [ev],
        },
        today,
      );
      insights.unshift(created);
      changes.push(`Nueva observación: "${created.observation}"`);
    }
  }
  return { memory: { ...memory, insights, lastUpdated: new Date().toISOString() }, changes };
}

/** Memoria para los prompts: reglas aplicables separadas de lo que solo se vigila. */
export function describeMemoryForPrompt(memory: CoachLearnedMemory | null | undefined, today: string): string {
  if (!memory) return '';
  const all = (memory.insights || []).map((i) => refreshInsight(i, today));
  const line = (i: CoachLearnedInsight) => {
    const { support, against } = countEvidence(i.evidence);
    return `  * [${i.id}] [${i.category}] ${i.observation}${i.ruleForFuturePlans ? ` → ${i.ruleForFuturePlans}` : ''} (${STATUS_LABEL[i.status!]}; ${support} a favor, ${against} en contra; última ${i.lastEvidenceAt})`;
  };
  // Topes para que el prompt no crezca sin límite (lo más reciente primero)
  const recent = (xs: CoachLearnedInsight[], n: number) => [...xs].sort((a, b) => String(b.lastEvidenceAt).localeCompare(String(a.lastEvidenceAt))).slice(0, n);
  // Reglas: las consolidadas primero y luego las más recientes, con tope
  const rules = [...all.filter((i) => isAppliedRule(i.status))]
    .sort((a, b) => (a.status === b.status ? String(b.lastEvidenceAt).localeCompare(String(a.lastEvidenceAt)) : a.status === 'consolidated_rule' ? -1 : 1))
    .slice(0, PROMPT_MAX_RULES);
  const watch = recent(all.filter((i) => i.status === 'observation' || i.status === 'hypothesis'), PROMPT_MAX_WATCH);
  const expired = recent(all.filter((i) => i.status === 'expired'), PROMPT_MAX_OLD);
  const refuted = recent(all.filter((i) => i.status === 'refuted'), PROMPT_MAX_OLD);
  return [
    '[MEMORIA DE MIGUEL — estado calculado por código a partir de evidencias]',
    `REGLAS QUE SE APLICAN (≥${PROVISIONAL_MIN} evidencias a favor):`,
    rules.length ? rules.map(line).join('\n') : '  (ninguna todavía)',
    '[HIPÓTESIS] A VIGILAR — observaciones e hipótesis: NO las apliques como reglas; úsalas para fijarte en si se repiten:',
    watch.length ? watch.map(line).join('\n') : '  (ninguna)',
    expired.length ? `CADUCADAS — no las uses; si vuelve a pasar, usa su id (se reactivan con todo su historial) en vez de crear un aprendizaje nuevo:\n${expired.map(line).join('\n')}` : '',
    refuted.length ? `DESCARTADAS — no las uses:\n${refuted.map(line).join('\n')}` : '',
    memory.coachNotebookNotes?.length ? `Notas de la libreta (texto del atleta o de Miguel, no reglas):\n${memory.coachNotebookNotes.slice(0, 10).map((n) => `  * ${n}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Pendientes (del chat) → se aplican solo cuando el atleta los confirma. */
export function confirmPending(memory: CoachLearnedMemory, pendingId: string, today: string) {
  const p = (memory.pendingEvidence || []).find((x) => x.id === pendingId);
  if (!p) return { memory, changes: [] as string[] };
  const rest = (memory.pendingEvidence || []).filter((x) => x.id !== pendingId);
  const items = sanitizeEvidenceItems([p.item], memory);
  if (!items.length) {
    // El aprendizaje al que apuntaba ya no existe (se borró): se avisa en vez de perderlo en silencio
    return { memory: { ...memory, pendingEvidence: rest }, changes: [`No se pudo anotar "${p.item.summary}": el aprendizaje al que se refería ya no existe.`] };
  }
  const r = applyEvidence({ ...memory, pendingEvidence: rest }, items, {
    date: p.date,
    source: 'chat',
    refId: p.refId,
    sourceEvent: 'Conversación con Miguel (confirmado por el atleta)',
  }, today);
  return r;
}

export function discardPending(memory: CoachLearnedMemory, pendingId: string): CoachLearnedMemory {
  return { ...memory, pendingEvidence: (memory.pendingEvidence || []).filter((x) => x.id !== pendingId) };
}

const normSummary = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** Pendiente repetido: misma conversación y mismo aprendizaje/sentido, o mismo texto. */
function isSamePending(p: PendingMemoryEvidence, item: EvidenceItem, refId: string): boolean {
  if (normSummary(p.item.summary) === normSummary(item.summary)) return true;
  return p.refId === refId && p.item.insightId != null && p.item.insightId === item.insightId && p.item.supports === item.supports;
}

export function addPending(memory: CoachLearnedMemory, items: EvidenceItem[], date: string, refId: string): CoachLearnedMemory {
  const existing = memory.pendingEvidence || [];
  const fresh: PendingMemoryEvidence[] = [];
  items.forEach((item, k) => {
    if ([...existing, ...fresh].some((p) => isSamePending(p, item, refId))) return;
    fresh.push({ id: `pending-${Date.now()}-${k}`, date, refId, item });
  });
  return { ...memory, pendingEvidence: [...fresh, ...existing].slice(0, PENDING_MAX) };
}
