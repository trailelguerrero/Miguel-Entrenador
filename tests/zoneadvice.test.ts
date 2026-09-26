/** Miguel te avisa de cambiar las zonas de FC de tu reloj Suunto (4 señales, sin repetir). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWatchZoneAdvice } from '../server/zone-advice.js';
import { driftZoneRecommendation, mergeSuuntoSyncData, pendingZoneAdvice, updateZoneAdviceState, zoneAdviceKey } from '../src/brain/suuntoMerge.js';
import { formatWatchZones } from '../server/brain/context.js';
import type { AthleteProfile, WatchZoneAdvice } from '../src/types/index.js';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const run = (over: Record<string, unknown> = {}) => ({
  workoutKey: `k${Math.random()}`, activityId: 1, description: null, startTime: NOW - 86400000, timeOffsetInMinutes: 120,
  totalTimeSec: 3600, totalDistanceM: 10000, totalAscentM: 100, totalDescentM: 100, avgHR: 140, maxHR: 160, tss: 60, energyKcal: 600,
  timeInAerobicZoneMs: 3000000, timeInAnaerobicZoneMs: 0, timeInVo2MaxZoneMs: 0,
  userMaxHR: 184, hrZoneLowerLimits: { z2: 128, z3: 148, z4: 158, z5: 166 }, zoneSenseAerobicThreshold: null, zoneSenseAnaerobicThreshold: null, vo2Max: 53,
  ...over,
});
const ADVICE: WatchZoneAdvice = { checkedAt: '2026-09-25', watch: { maxHr: 184, zones: { z2: 128, z3: 148, z4: 158, z5: 166 }, sport: 'carrera' }, recommendations: [], notes: [] };

test('Zonas de fábrica → recomendación "configura tus zonas"', () => {
  const a = computeWatchZoneAdvice([run({ hrZoneLowerLimits: { z2: 132, z3: 142, z4: 151, z5: 160 } }) as any], NOW);
  const r = a.recommendations.find((x) => x.field === 'zones');
  assert.ok(r);
  assert.equal(r!.source, 'factory');
  assert.equal(r!.suggested, null);
});

test('Test de deriva / AeT fijado a mano ≠ Z3 (≥ 3 ppm) → cambiar Z3; con < 3 ppm, nada', () => {
  const manual = { aetHr: 152, fieldSources: { aetHr: 'manual' }, driftTestResultPct: 4.1 } as unknown as AthleteProfile;
  const r = driftZoneRecommendation(manual, ADVICE);
  assert.equal(r?.source, 'drift');
  assert.equal(r?.current, 148);
  assert.equal(r?.suggested, 152);
  assert.match(r!.evidence, /test de deriva: 4.1 %/);
  assert.equal(driftZoneRecommendation({ ...manual, aetHr: 150 } as AthleteProfile, ADVICE), null);
  // Si el AeT viene del reloj, no hay nada que cambiar
  assert.equal(driftZoneRecommendation({ ...manual, fieldSources: { aetHr: 'suunto' } } as AthleteProfile, ADVICE), null);
});

test('Estado: nueva → pendiente; ignorada se conserva y no se anuncia; la que desaparece se quita', () => {
  const rec = { field: 'maxHr' as const, label: 'FC máxima', current: 184, suggested: 190, direction: 'up' as const, evidence: 'x', source: 'maxhr' as const };
  const s1 = updateZoneAdviceState(undefined, [rec], '2026-09-25');
  assert.equal(s1[zoneAdviceKey(rec)].status, 'pending');
  const ignored = { [zoneAdviceKey(rec)]: { ...s1[zoneAdviceKey(rec)], status: 'ignored' as const } };
  const s2 = updateZoneAdviceState(ignored, [rec], '2026-09-26');
  assert.equal(s2[zoneAdviceKey(rec)].status, 'ignored');
  assert.deepEqual(updateZoneAdviceState(s2, [], '2026-09-27'), {});
  const profile = { watchZoneAdvice: { ...ADVICE, recommendations: [rec] }, zoneAdviceState: s2 } as AthleteProfile;
  assert.equal(pendingZoneAdvice(profile).length, 0);
});

test('La sincronización deja las nuevas pendientes y sin anunciar; las ya anunciadas no se repiten', () => {
  const rec = { field: 'maxHr' as const, label: 'FC máxima', current: 184, suggested: 190, direction: 'up' as const, evidence: 'x', source: 'maxhr' as const };
  const payload = { workouts: [], checkIns: [], watchZoneAdvice: { ...ADVICE, recommendations: [rec] } };
  const first = mergeSuuntoSyncData({ profile: {} as AthleteProfile, workouts: [], checkIns: [] }, payload, '2026-09-25');
  assert.equal(first.freshZoneAdvice.length, 1);
  const announced = { ...first.profile, zoneAdviceState: { [zoneAdviceKey(rec)]: { status: 'pending' as const, firstSeen: 'x', announcedAt: 'y' } } };
  const second = mergeSuuntoSyncData({ profile: announced, workouts: [], checkIns: [] }, payload, '2026-09-26');
  assert.equal(second.freshZoneAdvice.length, 0, 'Miguel no lo repite');
  assert.equal(pendingZoneAdvice(second.profile).length, 1, 'el aviso fijo sigue hasta que lo marques');
});

test('Miguel recibe el estado: no insiste con lo ignorado', () => {
  const rec = { field: 'maxHr', label: 'FC máxima', current: 184, suggested: 190, evidence: 'x' };
  const txt = formatWatchZones({ ...ADVICE, recommendations: [rec] }, { 'maxHr:190': { status: 'ignored' } });
  assert.match(txt, /lo ignoró: no insistas/);
  assert.match(formatWatchZones({ ...ADVICE, recommendations: [rec] }, {}), /PENDIENTE/);
});
