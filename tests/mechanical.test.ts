/**
 * #12: carga mecánica a pie (descriptiva) y parser FIT sin umbrales por defecto.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { computeMechanicalLoad, describeMechanicalLoad, isOnFoot } from '../src/utils/mechanicalLoad.js';
import { mapSuuntoWorkouts } from '../server/suunto-map.js';
import { formatLoadContext } from '../server/brain/context.js';
import { buildBrainContext } from '../src/brain/context.js';
import { addDaysKey } from '../src/utils/weekStructure.js';

const TODAY = '2026-09-26';
const act = (daysAgo: number, over: Record<string, unknown> = {}) =>
  ({ id: `a${daysAgo}-${Math.random()}`, date: addDaysKey(TODAY, -daysAgo), title: 't', type: 'easy_run', completed: true, actualDurationMin: 60, actualDistanceKm: 10, actualElevationGainM: 300, actualElevationLossM: 300, ...over }) as any;

test('Solo cuentan actividades a pie: la bici no', () => {
  assert.equal(isOnFoot(act(0, { suuntoActivityId: 11, type: 'cross_training' })), true); // senderismo
  assert.equal(isOnFoot(act(0, { suuntoActivityId: 10, type: 'cross_training' })), false); // bici de montaña
  assert.equal(isOnFoot(act(0, { type: 'cross_training' })), false); // sin deporte: no se supone
  assert.equal(isOnFoot(act(0)), true); // carrera sin deporte (datos antiguos)
  assert.equal(isOnFoot(act(0, { completed: false })), false);
});

test('La sync de Suunto guarda el deporte', () => {
  const [w] = mapSuuntoWorkouts([{ workoutKey: 'k', activityId: 11, startTime: Date.parse('2026-09-20T08:00:00Z'), timeOffsetInMinutes: 0, totalTimeSec: 3600, totalAscentM: 500, totalDescentM: 500 } as any]);
  assert.equal(w.suuntoActivityId, 11);
  assert.equal(w.suuntoSport, 'Senderismo');
  assert.equal(isOnFoot(w), true);
});

test('7 días frente a la media de las 4 semanas ANTERIORES (sin solaparse)', () => {
  const ws = [
    act(1, { actualElevationLossM: 1000 }), act(3, { actualElevationLossM: 1100 }), // últimos 7: 2100 m
    act(8), act(15), act(22), act(29), // 4 semanas previas: 300 m cada una → 300 m/sem
    act(2, { suuntoActivityId: 10, type: 'cross_training', actualElevationLossM: 5000 }), // bici: no cuenta
  ];
  const s = computeMechanicalLoad(ws, TODAY);
  assert.equal(s.descent.last7, 2100);
  assert.equal(s.descent.priorWeeklyAvg, 300);
  assert.equal(s.descent.ratio, 7);
  assert.equal(s.comparable, true);
  assert.equal(s.activities7d, 2);
});

test('Con < 3 semanas previas con actividad no hay ratio', () => {
  const s = computeMechanicalLoad([act(1), act(8), act(15)], TODAY);
  assert.equal(s.comparable, false);
  assert.equal(s.descent.ratio, null);
  assert.equal(s.descent.priorWeeklyAvg, null);
  assert.match(describeMechanicalLoad(s), /sin historial suficiente/);
});

test('Miguel la recibe como contexto etiquetado, nunca como límite', () => {
  const ctx = buildBrainContext([act(1), act(8), act(15), act(22)], { baselineHrv: 0 } as any, [], null, TODAY);
  const txt = formatLoadContext(ctx);
  assert.match(txt, /\[DERIVADO\][^\n]*Carga mecánica a pie/i);
  assert.match(txt, /NO un límite/);
});

test('Parser FIT: sin umbrales por defecto (antes AeT 142 / AnT 166)', () => {
  const src = readFileSync('src/utils/fitParser.ts', 'utf8');
  assert.doesNotMatch(src, /aetHr: number = \d+|antHr: number = \d+/);
});
