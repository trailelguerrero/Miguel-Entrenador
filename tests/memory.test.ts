/**
 * Memoria de Miguel basada en evidencias (fase 2).
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CoachLearnedMemory, InsightEvidence } from '../src/types/index.js';
import {
  addPending,
  applyEvidence,
  computeInsightStatus,
  confirmPending,
  describeMemoryForPrompt,
  MAX_EVIDENCE_PER_EVENT,
  PENDING_MAX,
  discardPending,
  refreshMemory,
  sanitizeEvidenceItems,
} from '../src/brain/memory.js';

const TODAY = '2026-09-25';
const ev = (n: number, supports = true, date = TODAY): InsightEvidence[] =>
  Array.from({ length: n }, (_, k) => ({ date, source: 'workout_analysis', supports, summary: `e${k}`, refId: `w${k}-${supports}` }));

const emptyMemory = (): CoachLearnedMemory => ({
  athleteId: 'a',
  lastUpdated: '',
  overallPhilosophySummary: '',
  insights: [],
  adaptationHistory: [],
  coachNotebookNotes: [],
});

test('Estado por número de evidencias: 1 observación, 2 hipótesis, 3 provisional, 5 consolidada', () => {
  assert.equal(computeInsightStatus(ev(1), TODAY), 'observation');
  assert.equal(computeInsightStatus(ev(2), TODAY), 'hypothesis');
  assert.equal(computeInsightStatus(ev(3), TODAY), 'provisional_rule');
  assert.equal(computeInsightStatus(ev(4), TODAY), 'provisional_rule');
  assert.equal(computeInsightStatus(ev(5), TODAY), 'consolidated_rule');
});

test('Cada evidencia en contra baja un nivel; consolidada exige cero contradicciones', () => {
  assert.equal(computeInsightStatus([...ev(5), ...ev(1, false)], TODAY), 'provisional_rule'); // consolidada − 1
  assert.equal(computeInsightStatus([...ev(5), ...ev(2, false)], TODAY), 'hypothesis');
  assert.equal(computeInsightStatus([...ev(3), ...ev(1, false)], TODAY), 'hypothesis');
  assert.equal(computeInsightStatus([...ev(1), ...ev(1, false)], TODAY), 'refuted');
  assert.equal(computeInsightStatus(ev(1, false), TODAY), 'refuted');
});

test('Caduca a los 90 días sin evidencias nuevas', () => {
  assert.equal(computeInsightStatus(ev(4, true, '2026-06-01'), TODAY), 'expired'); // 116 días
  assert.equal(computeInsightStatus(ev(4, true, '2026-07-01'), TODAY), 'provisional_rule'); // 86 días
});

test('Aprendizajes antiguos (sin evidencias) pasan a observación con una evidencia', () => {
  const m = refreshMemory(
    { ...emptyMemory(), insights: [{ id: 'old', category: 'fatigue_recovery', observation: 'x', ruleForFuturePlans: 'y', confidenceScore: 90, learnedFromDate: TODAY, sourceEvent: 's' }] },
    TODAY,
  );
  assert.equal(m.insights[0].status, 'observation');
  assert.equal(m.insights[0].evidence!.length, 1);
  assert.equal(m.insights[0].evidence![0].source, 'legacy');
});

test('Una sesión crea observación; tres sesiones distintas la convierten en regla provisional', () => {
  const newItem = sanitizeEvidenceItems(
    [{ insightId: null, supports: true, summary: 'Deriva a amarillo tras 90 min', category: 'physiology_zonesense', observation: 'Deriva en tiradas largas', hypothesis: 'Vigilar a partir de 90 min' }],
    emptyMemory(),
  );
  let { memory } = applyEvidence(emptyMemory(), newItem, { date: TODAY, source: 'workout_analysis', refId: 'w1', sourceEvent: 'a' });
  const id = memory.insights[0].id;
  assert.equal(memory.insights[0].status, 'observation');
  memory = applyEvidence(memory, [{ insightId: id, supports: true, summary: 'otra vez' }], { date: TODAY, source: 'workout_analysis', refId: 'w2', sourceEvent: 'b' }).memory;
  assert.equal(memory.insights[0].status, 'hypothesis');
  // Re-analizar la MISMA sesión no suma
  memory = applyEvidence(memory, [{ insightId: id, supports: true, summary: 'repetido' }], { date: TODAY, source: 'workout_analysis', refId: 'w2', sourceEvent: 'b' }).memory;
  assert.equal(memory.insights[0].status, 'hypothesis');
  memory = applyEvidence(memory, [{ insightId: id, supports: true, summary: 'tercera' }], { date: TODAY, source: 'workout_analysis', refId: 'w3', sourceEvent: 'c' }).memory;
  assert.equal(memory.insights[0].status, 'provisional_rule');
  assert.equal(memory.insights[0].confidenceScore, 100);
});

test('La salida de la IA se valida: ids inexistentes, categorías inválidas, hallazgos "en contra" y exceso', () => {
  const mem = { ...emptyMemory(), insights: [{ id: 'real', category: 'fatigue_recovery' as const, observation: 'o', ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: TODAY, sourceEvent: '' }] };
  const out = sanitizeEvidenceItems(
    [
      { insightId: 'inventado', supports: true, summary: 'x' }, // id que no existe → hallazgo nuevo sin categoría → fuera
      { insightId: null, supports: true, summary: 's', category: 'magia', observation: 'o' }, // categoría inválida → fuera
      { insightId: null, supports: false, summary: 's', category: 'fatigue_recovery', observation: 'o' }, // nuevo "en contra" → fuera
      { insightId: 'real', supports: false, summary: 'contradice' },
      { insightId: 'real', supports: true, summary: 'a' },
      { insightId: 'real', supports: true, summary: 'b' },
      { insightId: 'real', supports: true, summary: 'c' }, // excede el máximo por evento
    ],
    mem,
  );
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { insightId: 'real', supports: false, summary: 'contradice' });
  assert.deepEqual(sanitizeEvidenceItems(undefined, mem), []);
});

test('Prompt: solo provisionales/consolidadas como REGLAS; el resto A VIGILAR o descartado', () => {
  const mem = refreshMemory(
    {
      ...emptyMemory(),
      insights: [
        { id: 'r', category: 'fatigue_recovery', observation: 'REGLA_OK', ruleForFuturePlans: 'aplicar', confidenceScore: 0, learnedFromDate: TODAY, sourceEvent: '', evidence: ev(3) },
        { id: 'h', category: 'fatigue_recovery', observation: 'HIPO', ruleForFuturePlans: 'vigilar', confidenceScore: 0, learnedFromDate: TODAY, sourceEvent: '', evidence: ev(2) },
        { id: 'x', category: 'fatigue_recovery', observation: 'VIEJA', ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: TODAY, sourceEvent: '', evidence: ev(5, true, '2026-01-01') },
      ],
    },
    TODAY,
  );
  const txt = describeMemoryForPrompt(mem, TODAY);
  const rulesBlock = txt.slice(txt.indexOf('REGLAS QUE SE APLICAN'), txt.indexOf('A VIGILAR'));
  assert.ok(rulesBlock.includes('REGLA_OK'));
  assert.ok(!rulesBlock.includes('HIPO'));
  assert.ok(!rulesBlock.includes('VIEJA'));
  // Caducadas aparte de las descartadas, indicando que se reactivan con su id
  assert.ok(txt.includes('CADUCADAS — no las uses; si vuelve a pasar, usa su id'));
  assert.ok(txt.slice(txt.indexOf('CADUCADAS')).includes('VIEJA'));
});

test('Chat: las evidencias quedan pendientes y solo cuentan al confirmarlas', () => {
  const items = sanitizeEvidenceItems(
    [{ insightId: null, supports: true, summary: 'Me duele el tibial en bajadas', category: 'biomechanics_injury', observation: 'Tibial en bajadas técnicas' }],
    emptyMemory(),
  );
  let m = addPending(emptyMemory(), items, TODAY, 'chat-1');
  assert.equal(m.insights.length, 0);
  assert.equal(m.pendingEvidence!.length, 1);
  const discarded = discardPending(m, m.pendingEvidence![0].id);
  assert.equal(discarded.pendingEvidence!.length, 0);
  assert.equal(discarded.insights.length, 0);
  m = confirmPending(m, m.pendingEvidence![0].id, TODAY).memory;
  assert.equal(m.pendingEvidence!.length, 0);
  assert.equal(m.insights.length, 1);
  assert.equal(m.insights[0].status, 'observation');
  assert.equal(m.insights[0].evidence![0].source, 'chat');
});

// ── Auditoría: evidencias graves, prioridad, reactivación y pendientes ─────
const insight = (id: string, category: any, evidence: InsightEvidence[]) => ({
  id, category, observation: id, ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: TODAY, sourceEvent: '', evidence,
});

test('Una evidencia en contra GRAVE descarta incluso una regla consolidada', () => {
  const crit: InsightEvidence = { date: TODAY, source: 'workout_analysis', supports: false, summary: 'lesión', refId: 'x', critical: true };
  assert.equal(computeInsightStatus([...ev(5, true, '2026-09-01'), crit], TODAY), 'refuted');
  // Solo vuelve cuando acumula ≥3 a favor DESPUÉS de la grave
  const after = ev(2, true, '2026-09-26');
  assert.equal(computeInsightStatus([...ev(5, true, '2026-09-01'), crit, ...after], '2026-09-26'), 'refuted');
  const after3 = ev(3, true, '2026-09-26');
  assert.equal(computeInsightStatus([...ev(5, true, '2026-09-01'), crit, ...after3], '2026-09-26'), 'provisional_rule');
});

test('"critical" solo vale en contra y en categorías de lesión/fatiga', () => {
  const mem = { ...emptyMemory(), insights: [insight('lesion', 'biomechanics_injury', ev(5)), insight('nutri', 'nutrition_hydration', ev(5))] };
  const out = sanitizeEvidenceItems(
    [
      { insightId: 'lesion', supports: false, summary: 'dolor agudo', critical: true },
      { insightId: 'nutri', supports: false, summary: 'flato', critical: true }, // categoría no admite grave
      { insightId: 'lesion', supports: true, summary: 'bien', critical: true }, // a favor no puede ser grave
    ],
    mem,
  );
  assert.equal(out[0].critical, true);
  assert.equal(out.find((e) => e.insightId === 'nutri')!.critical, undefined);
  assert.equal(out.find((e) => e.supports)!.critical, undefined);
  const { memory } = applyEvidence(mem, [out[0]], { date: TODAY, source: 'workout_analysis', refId: 'w9', sourceEvent: '' });
  assert.equal(memory.insights.find((i) => i.id === 'lesion')!.status, 'refuted');
});

test('Si la IA da más evidencias de la cuenta, se quedan las contradicciones antes que lo nuevo', () => {
  const mem = { ...emptyMemory(), insights: [insight('a', 'fatigue_recovery', ev(3))] };
  const nuevo = (k: number) => ({ insightId: null, supports: true, summary: `n${k}`, category: 'terrain_technique', observation: `o${k}` });
  const out = sanitizeEvidenceItems([nuevo(1), nuevo(2), nuevo(3), { insightId: 'a', supports: false, summary: 'contradice' }], mem);
  assert.equal(out.length, MAX_EVIDENCE_PER_EVENT);
  assert.equal(out[0].summary, 'contradice');
  assert.deepEqual(out.slice(1).map((e) => e.summary), ['n1', 'n2']); // orden estable
});

test('Una regla caducada se reactiva con todo su historial al recibir evidencia nueva', () => {
  const mem = refreshMemory({ ...emptyMemory(), insights: [insight('sodio', 'nutrition_hydration', ev(5, true, '2026-01-10'))] }, TODAY);
  assert.equal(mem.insights[0].status, 'expired');
  const { memory } = applyEvidence(mem, [{ insightId: 'sodio', supports: true, summary: 'calor otra vez' }], { date: TODAY, source: 'workout_analysis', refId: 'w-new', sourceEvent: '' });
  assert.equal(memory.insights[0].status, 'consolidated_rule');
});

test('Pendientes: sin duplicados, caducan a los 30 días y hay un máximo', () => {
  const item = { insightId: null, supports: true, summary: 'Me duele el tibial', category: 'biomechanics_injury' as const, observation: 'Tibial' };
  let m = addPending(emptyMemory(), [item], TODAY, 'chat-1');
  m = addPending(m, [{ ...item, summary: '  me duele el TIBIAL ' }], TODAY, 'chat-2'); // mismo texto
  assert.equal(m.pendingEvidence!.length, 1);
  // Caducan
  const old = { ...m, pendingEvidence: m.pendingEvidence!.map((p) => ({ ...p, date: '2026-08-01' })) };
  assert.equal(refreshMemory(old, TODAY).pendingEvidence!.length, 0);
  // Máximo
  const many = Array.from({ length: PENDING_MAX + 5 }, (_, k) => ({ ...item, summary: `hecho ${k}` }));
  assert.equal(addPending(emptyMemory(), many, TODAY, 'chat-3').pendingEvidence!.length, PENDING_MAX);
});

test('Confirmar desde el chat un hecho que ya contó la sesión de ese día no suma dos veces', () => {
  const mem = { ...emptyMemory(), insights: [insight('a', 'fatigue_recovery', [{ date: TODAY, source: 'workout_analysis', supports: true, summary: 'sesión', refId: 'w1' }])] };
  const m = addPending(mem, [{ insightId: 'a', supports: true, summary: 'lo mismo contado en el chat' }], TODAY, 'chat-9');
  const r = confirmPending(m, m.pendingEvidence![0].id, TODAY);
  assert.equal(r.memory.insights[0].evidence!.length, 1);
  assert.equal(r.memory.pendingEvidence!.length, 0);
});
