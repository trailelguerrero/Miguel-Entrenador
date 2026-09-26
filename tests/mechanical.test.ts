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

// ── #17. Tiempo aeróbico: medido (.FIT) antes que estimado (FC media) ────
import { hrAerobicShare, describeHrShareMethod } from '../src/utils/trainingLoad.js';

const run = (over: Record<string, unknown>) => ({ id: `r${Math.random()}`, date: '2026-09-20', title: '', type: 'easy_run', completed: true, actualDurationMin: 120, actualAvgHr: 138, ...over }) as any;

test('Con .FIT: usa el tiempo MEDIDO por zonas, no la FC media', () => {
  // FC media 138 ≤ AeT 140 → la estimación diría 120 min bajo AeT; el .FIT dice 80
  const w = run({ hrZoneSplit: { belowAetMin: 80, aetToAntMin: 35, aboveAntMin: 5, aetHr: 140, antHr: 165, source: 'fit' } });
  const s = hrAerobicShare([w], 140);
  assert.equal(s.method, 'measured');
  assert.equal(s.aerobicMin, 80);
  assert.equal(s.pct, 66.7);
  assert.match(describeHrShareMethod(s), /medido/);
});

test('Sin .FIT o con otro AeT: estimación por FC media, marcada como tal', () => {
  const stale = run({ hrZoneSplit: { belowAetMin: 80, aetToAntMin: 35, aboveAntMin: 5, aetHr: 150, antHr: 170, source: 'fit' } });
  assert.equal(hrAerobicShare([stale], 140).method, 'estimated');
  const mixed = hrAerobicShare([run({ hrZoneSplit: { belowAetMin: 60, aetToAntMin: 0, aboveAntMin: 0, aetHr: 140, antHr: 165, source: 'fit' } }), run({})], 140);
  assert.equal(mixed.method, 'mixed');
  assert.equal(mixed.measuredMin, 60);
  assert.equal(mixed.estimatedMin, 120);
  assert.match(describeHrShareMethod(mixed), /60 min medidos/);
  assert.equal(hrAerobicShare([run({})], null).pct, null);
});
