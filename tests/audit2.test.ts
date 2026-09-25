/**
 * Arreglos de la auditoría del cerebro de septiembre de 2026 (G1–G3, M1–M2).
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateReadiness } from '../src/brain/readiness.js';
import { computeReadiness } from '../src/utils/readiness.js';
import { sanitizeAdaptation } from '../server/brain/decision/validate.js';
import { applyEvidence, sanitizeEvidenceItems } from '../src/brain/memory.js';
import type { CoachLearnedMemory } from '../src/types/index.js';

const TODAY = '2026-09-25';
const emptyMemory = (): CoachLearnedMemory => ({ insights: [], lastUpdated: '', overallPhilosophySummary: '' } as any);

// ── G1: la adaptación se valida sobre la sesión resultante ─────────────────
test('G1. Día ÁMBAR: si la IA no devuelve el tipo, las series de la sesión original no pasan', () => {
  const state = evaluateReadiness({ hrvRmssd: 50, hrvBaseline: 60, sleepHours: 8, plannedWorkout: { type: 'hill_intervals', plannedDurationMin: 90 } });
  assert.equal(state.level, 'amber');
  const original = { id: 'w1', type: 'hill_intervals', plannedDurationMin: 90, zoneSenseTarget: 'ZoneSense rojo (sobre umbral anaeróbico)' };
  const { adapted } = sanitizeAdaptation({ title: 'Suave', mainSet: 'rodaje' }, state, {}, original);
  const saved = { ...original, ...adapted }; // como lo guarda la app
  assert.equal(saved.type, 'easy_run');
  assert.equal(saved.zoneSenseTarget, 'ZoneSense verde (aeróbico)');
});

test('G1. Día ROJO: duración en texto o ausente no se salta el máximo de 35 min', () => {
  const state = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 8, plannedWorkout: { type: 'long_mountain_run', plannedDurationMin: 180 } });
  assert.equal(state.limits.maxDurationMin, 35);
  const original = { type: 'long_mountain_run', plannedDurationMin: 180 };
  assert.equal(sanitizeAdaptation({ type: 'easy_run', plannedDurationMin: '120' }, state, {}, original).adapted.plannedDurationMin, 35);
  assert.equal(sanitizeAdaptation({ type: 'easy_run' }, state, {}, original).adapted.plannedDurationMin, 35);
  assert.equal(sanitizeAdaptation({ type: 'easy_run', plannedDurationMin: '30' }, state, {}, original).adapted.plannedDurationMin, 30);
});

test('G1. Descanso obligatorio aunque la IA no devuelva nada', () => {
  const state = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 5, tsb: -40 });
  assert.equal(state.limits.mandatoryRest, true);
  const { adapted } = sanitizeAdaptation(undefined, state, {}, { type: 'hill_intervals', plannedDurationMin: 70 });
  assert.equal(adapted.type, 'rest');
  assert.equal(adapted.plannedDurationMin, 0);
});

// ── G3: el semáforo del check-in = motor ──────────────────────────────────
test('G3. El estrés alto sube el semáforo del check-in, igual que en el motor', () => {
  const ok = { hrvRmssd: 60, hrvBaseline: 60, sleepHours: 8 };
  assert.equal(computeReadiness(ok).status, 'optimal');
  assert.equal(computeReadiness({ ...ok, stressLevel: 9 }).status, 'moderate');
  assert.equal(evaluateReadiness({ ...ok, stressLevel: 9 }).level, 'amber');
});

test('G3. Sin HRV, sueño ni dolor el semáforo es "sin datos", no verde', () => {
  const r = computeReadiness({ hrvRmssd: 0, hrvBaseline: 0, sleepHours: 0 });
  assert.equal(r.status, 'unknown');
  assert.match(r.coachAdvice, /Sin datos/);
});

// ── M1: repetir la misma nota no crea una regla ───────────────────────────
test('M1. Tres notas iguales el mismo día cuentan como UNA evidencia', () => {
  const nuevo = sanitizeEvidenceItems([{ insightId: null, supports: true, summary: 'sóleo', category: 'biomechanics_injury', observation: 'Sóleo en bajadas' }], emptyMemory());
  let { memory } = applyEvidence(emptyMemory(), nuevo, { date: TODAY, source: 'athlete_note', refId: 'note-1', sourceEvent: 'n' });
  const id = memory.insights[0].id;
  for (const ref of ['note-2', 'note-3']) {
    memory = applyEvidence(memory, [{ insightId: id, supports: true, summary: 'sóleo otra vez' }], { date: TODAY, source: 'athlete_note', refId: ref, sourceEvent: 'n' }).memory;
  }
  assert.equal(memory.insights[0].evidence!.length, 1);
  assert.equal(memory.insights[0].status, 'observation');
  // Otro día sí suma
  memory = applyEvidence(memory, [{ insightId: id, supports: true, summary: 'sóleo' }], { date: '2026-09-26', source: 'athlete_note', refId: 'note-4', sourceEvent: 'n' }, TODAY).memory;
  assert.equal(memory.insights[0].evidence!.length, 2);
  // Y una sesión medida el mismo día también suma (no es lo que cuenta el atleta)
  memory = applyEvidence(memory, [{ insightId: id, supports: true, summary: 'sesión' }], { date: TODAY, source: 'workout_analysis', refId: 'w1', sourceEvent: 's' }).memory;
  assert.equal(memory.insights[0].evidence!.length, 3);
});

test('M1. Una nota en contra el mismo día sí cuenta (sentido distinto)', () => {
  const mem = { ...emptyMemory(), insights: [{ id: 'a', category: 'fatigue_recovery', observation: 'o', ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: TODAY, sourceEvent: '', evidence: [{ date: TODAY, source: 'athlete_note', supports: true, summary: 's', refId: 'note-1' }] }] } as any;
  const { memory } = applyEvidence(mem, [{ insightId: 'a', supports: false, summary: 'no' }], { date: TODAY, source: 'athlete_note', refId: 'note-2', sourceEvent: 'n' });
  assert.equal(memory.insights[0].evidence!.length, 2);
});

// ── M2: "false" en texto es una contradicción ─────────────────────────────
test('M2. supports "false" (texto) cuenta EN CONTRA; valores raros se descartan', () => {
  const mem = { insights: [{ id: 'a', category: 'fatigue_recovery' }] } as any;
  assert.deepEqual(sanitizeEvidenceItems([{ insightId: 'a', supports: 'false', summary: 's' }], mem), [{ insightId: 'a', supports: false, summary: 's' }]);
  assert.equal(sanitizeEvidenceItems([{ insightId: 'a', supports: 'true', summary: 's' }], mem)[0].supports, true);
  assert.equal(sanitizeEvidenceItems([{ insightId: 'a', supports: 'quizá', summary: 's' }], mem).length, 0);
  // Sin el campo se mantiene el comportamiento anterior (a favor)
  assert.equal(sanitizeEvidenceItems([{ insightId: 'a', summary: 's' }], mem)[0].supports, true);
});
