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
  assert.ok(txt.includes('DESCARTADAS O CADUCADAS'));
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
