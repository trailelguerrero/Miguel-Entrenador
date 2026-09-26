/** La FC es la verdad; ZoneSense solo complementa el análisis de entrenos hechos. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveProfileFromSuunto } from '../server/suunto-profile.js';
import { buildDeload } from '../src/brain/deload.js';
import { hrAerobicShare } from '../src/utils/trainingLoad.js';
import { ZONESENSE_PROMPT_RULES } from '../src/brain/zonesense.js';
import { describeIntensityPrescription, resolveIntensityPrescription } from '../src/brain/intensity.js';
import { describeReadiness, evaluateReadiness, hrCeiling } from '../src/brain/readiness.js';
import { buildPlanPrompt } from '../server/brain/prompts/routes.js';
import { sanitizePlanWorkouts } from '../server/brain/decision/validate.js';
import type { Workout } from '../src/types/index.js';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const run = (over: Record<string, unknown> = {}) => ({
  workoutKey: `k${Math.random()}`, activityId: 1, description: null, startTime: NOW - 86400000, timeOffsetInMinutes: 120,
  totalTimeSec: 3600, totalDistanceM: 10000, totalAscentM: 100, totalDescentM: 100, avgHR: 140, maxHR: 160, tss: 60, energyKcal: 600,
  timeInAerobicZoneMs: 3000000, timeInAnaerobicZoneMs: 0, timeInVo2MaxZoneMs: 0,
  userMaxHR: 184, hrZoneLowerLimits: { z2: 128, z3: 148, z4: 158, z5: 166 }, zoneSenseAerobicThreshold: 139, zoneSenseAnaerobicThreshold: 161, vo2Max: 53,
  ...over,
});
const PROFILE: any = { aetHr: 148, antHr: 166, maxHr: 184, hasChestStrap: true, fieldSources: { aetHr: 'suunto', antHr: 'suunto', maxHr: 'suunto' } };

test('Umbrales de Suunto = zonas de FC del reloj; el umbral de ZoneSense es solo una sugerencia', () => {
  const s = deriveProfileFromSuunto([run() as any], [], NOW);
  assert.equal(s.values.aetHr, 148, 'Z3 del reloj, no los 139 de ZoneSense');
  assert.equal(s.values.antHr, 166);
  assert.match(s.evidence.aetHr!, /ZoneSense sugiere 139/);
});

test('Con banda de pecho la fuente sigue siendo la FC; el texto para Miguel pide ppm y no colores', () => {
  const p = resolveIntensityPrescription(PROFILE);
  assert.equal(p.primary, 'heart_rate_measured');
  const txt = describeIntensityPrescription(p, PROFILE);
  assert.match(txt, /PULSACIONES/);
  assert.match(txt, /zonas de FC de tu reloj Suunto/);
  assert.match(txt, /ZoneSense NO se usa para prescribir/);
});

test('Techos de FC del readiness: verde libre, ámbar/sin datos AeT, rojo AeT − 10; sin AeT, ninguno', () => {
  assert.equal(hrCeiling('green', 148), null);
  assert.equal(hrCeiling('amber', 148), 148);
  assert.equal(hrCeiling('unknown', 148), 148);
  assert.equal(hrCeiling('red', 148), 138);
  assert.equal(hrCeiling('red', null), null);
  const red = evaluateReadiness({ hrvRmssd: 40, hrvBaseline: 60, sleepHours: 7.5, aetHr: 148 });
  assert.match(describeReadiness(red), /FC máxima 138 ppm/);
  assert.doesNotMatch(describeReadiness(red), /ZoneSense/);
});

test('El plan: rodajes con techo = AeT, sin objetivo de ZoneSense, fuente FC', () => {
  const { workouts } = sanitizePlanWorkouts(
    [
      { type: 'easy_run', date: '2026-09-21', plannedDurationMin: 60, zoneSenseTarget: 'ZoneSense verde (aeróbico)', intensitySource: 'zonesense' },
      { type: 'long_mountain_run', date: '2026-09-27', plannedDurationMin: 180, targetHrMax: 160 },
    ],
    PROFILE,
  );
  assert.equal(workouts[0].targetHrMax, 148);
  assert.equal(workouts[0].zoneSenseTarget, undefined);
  assert.equal(workouts[0].intensitySource, 'heart_rate_measured');
  assert.equal(workouts[1].targetHrMax, 148, 'la tirada larga no pasa del AeT');
});

test('Prompts de Miguel: la FC manda; ZoneSense no es la referencia principal', () => {
  assert.match(ZONESENSE_PROMPT_RULES, /LA VERDAD SON LAS PULSACIONES/);
  assert.doesNotMatch(ZONESENSE_PROMPT_RULES, /ZoneSense es la referencia principal/);
  const prompt = buildPlanPrompt({ athleteProfile: PROFILE, weekStartDate: '2026-09-21' });
  assert.doesNotMatch(prompt, /"zoneSenseTarget"/);
  assert.match(prompt, /"targetHrMax": number o null \(ppm/);
});

test('La descarga conserva el techo de FC (AeT) en vez de borrar las pulsaciones', () => {
  const planned: Workout[] = [{ id: 'a', date: '2026-09-28', title: 'Series', type: 'hill_intervals', plannedDurationMin: 60, completed: false } as Workout];
  const r = buildDeload(planned, '2026-09-28', 148);
  assert.equal(r.workouts[0].targetHrMax, 148);
  assert.equal(r.workouts[0].zoneSenseTarget, undefined);
  assert.match(r.workouts[0].mainSet!, /148 ppm/);
  // Sin AeT: por sensaciones, sin pulsaciones inventadas
  const none = buildDeload(planned, '2026-09-28', null);
  assert.equal(none.workouts[0].targetHrMax, undefined);
  assert.match(none.workouts[0].mainSet!, /puedas hablar/);
});

test('% bajo el AeT por FC media (estimación): ZoneSense no cuenta', () => {
  const w = (avg: number, min: number) => ({ id: `${avg}`, date: '2026-09-20', title: '', type: 'easy_run', plannedDurationMin: min, completed: true, actualDurationMin: min, actualAvgHr: avg, zoneSenseBreakdown: { aerobicPct: 10, transitionPct: 90, anaerobicPct: 0 } }) as unknown as Workout;
  const r = hrAerobicShare([w(140, 60), w(155, 40)], 148);
  assert.equal(r.pct, 60);
  assert.equal(hrAerobicShare([w(140, 60)], null).pct, null);
});
