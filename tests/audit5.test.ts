/**
 * Fase A de la auditoría independiente (C1–C36): contrato de sesión, política de
 * readiness, memoria, HRV/ACWR, nutrición, historial, carreras y zona horaria.
 * Los números de test (#N) siguen la lista del auditor.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateReadiness } from '../src/brain/readiness.js';
import { sanitizeAdaptation, sanitizePlanWorkouts, validatePlanContract } from '../server/brain/decision/validate.js';
import { resolveIntensityPrescription } from '../src/brain/intensity.js';
import { applyEvidence, observationSimilarity, describeMemoryForPrompt, PROMPT_MAX_RULES } from '../src/brain/memory.js';
import { calculateHrvPredictiveRegression, MIN_REGRESSION_NIGHTS } from '../src/utils/hrvLinearRegression.js';
import { calculateHRVLoadCorrelation } from '../src/utils/hrvLoadCalculations.js';
import { calculateACWRSummary } from '../src/utils/acwrCalculations.js';
import { verifyHistoryNumbers } from '../server/brain/decision/history.js';
import { allowedAdviceFigures, filterRaceAdvice } from '../server/brain/decision/race.js';
import { athleteToday, dateKeyInTimezone } from '../server/brain/context.js';
import { buildDeload } from '../src/brain/deload.js';
import { localDateKey } from '../src/utils/trainingLoad.js';
import { addDaysKey } from '../src/utils/weekStructure.js';

const RED = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 8, plannedWorkout: { type: 'long_mountain_run', plannedDurationMin: 180 } });
const MEASURED: any = { aetHr: 150, antHr: 168, maxHr: 186, fieldSources: { aetHr: 'manual', antHr: 'manual', maxHr: 'manual' } };

// ── Contrato de sesión y política de readiness ────────────────────────────
test('#4. ROJO + tirada larga → rodaje regenerativo: sin su distancia, desnivel ni texto de series', () => {
  assert.equal(RED.level, 'red');
  const { adapted } = sanitizeAdaptation(
    { type: 'long_mountain_run', plannedDurationMin: 180, zoneSenseTarget: 'ZoneSense verde (aeróbico)', plannedDistanceKm: 25, plannedElevationGainM: 1500, mainSet: '6x5 min fuertes en cuesta' },
    RED,
    {},
  );
  assert.equal(adapted.type, 'easy_run');
  assert.equal(adapted.plannedDurationMin, 35);
  assert.equal(adapted.plannedDistanceKm, null);
  assert.equal(adapted.plannedElevationGainM, null);
  assert.equal(adapted.zoneSenseTarget, undefined, 'ZoneSense no se prescribe');
  assert.doesNotMatch(adapted.mainSet, /fuertes|6x5/);
});

test('FC manda. ROJO con AeT 145: techo de FC 135 (AeT − 10) y texto en pulsaciones', () => {
  const red = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 8, aetHr: 145, plannedWorkout: { type: 'long_mountain_run', plannedDurationMin: 180 } });
  assert.equal(red.limits.maxHr, 135);
  const { adapted, corrections } = sanitizeAdaptation({ type: 'long_mountain_run', plannedDurationMin: 180, targetHrMax: 150, mainSet: '6x5 min fuertes' }, red, MEASURED);
  assert.equal(adapted.targetHrMax, 135);
  assert.match(adapted.mainSet, /135 ppm/);
  assert.ok(corrections.length > 0);
  // ÁMBAR: techo = AeT
  const amber = evaluateReadiness({ hrvRmssd: 50, hrvBaseline: 60, sleepHours: 8, aetHr: 145 });
  assert.equal(amber.level, 'amber');
  assert.equal(amber.limits.maxHr, 145);
  // VERDE: sin techo
  assert.equal(evaluateReadiness({ hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8, aetHr: 145 }).limits.maxHr, null);
});

test('#5. ROJO + test de deriva → no se hace (pasa a regenerativo)', () => {
  const { adapted } = sanitizeAdaptation({ type: 'drift_test', plannedDurationMin: 75 }, RED, {});
  assert.equal(adapted.type, 'easy_run');
  // Fuerza en rojo → descanso
  assert.equal(sanitizeAdaptation({ type: 'strength_core', plannedDurationMin: 40 }, RED, {}).adapted.type, 'rest');
});

test('#6. Un descanso no arrastra distancia, desnivel, nutrición ni textos de entreno', () => {
  const rest = evaluateReadiness({ hrvRmssd: 40, hrvBaseline: 60, sleepHours: 5 });
  assert.equal(rest.limits.mandatoryRest, true);
  const { adapted } = sanitizeAdaptation({ type: 'easy_run', plannedDurationMin: 60, plannedDistanceKm: 8, plannedElevationGainM: 500, plannedCarbsPerHourG: 60, warmup: 'x', terrainRecommendation: 'sendero' }, rest, {});
  assert.equal(adapted.type, 'rest');
  for (const f of ['plannedDistanceKm', 'plannedElevationGainM', 'plannedCarbsPerHourG', 'warmup', 'terrainRecommendation', 'zoneSenseTarget']) assert.equal(adapted[f], null, f);
  // Y un descanso del plan semanal también
  const [planRest] = sanitizePlanWorkouts([{ type: 'rest', date: '2026-09-28', plannedDistanceKm: 5, mainSet: 'trote' }], {}).workouts;
  assert.equal(planRest.plannedDistanceKm, null);
});

test('ÁMBAR: la IA no puede dejar series en el texto de un rodaje', () => {
  const amber = evaluateReadiness({ hrvRmssd: 50, hrvBaseline: 60, sleepHours: 8, plannedWorkout: { type: 'easy_run', plannedDurationMin: 60 } });
  const { adapted, corrections } = sanitizeAdaptation({ type: 'easy_run', plannedDurationMin: 45, mainSet: 'Rodaje con 4x3 min en amarillo' }, amber, {});
  assert.doesNotMatch(adapted.mainSet, /4x3|amarillo/);
  assert.ok(corrections.some((c) => /reescribe/.test(c)));
});

const MONDAY = '2026-09-28';
const d = (n: number) => addDaysKey(MONDAY, n);
const run = (date: string, over: Record<string, unknown> = {}) => ({ date, title: `s ${date}`, type: 'easy_run', plannedDurationMin: 50, ...over });
const long = (date: string, over: Record<string, unknown> = {}) => ({ date, title: 'larga', type: 'long_mountain_run', plannedDurationMin: 180, plannedDistanceKm: 22, plannedElevationGainM: 1200, ...over });
const goodWeek = () => [run(d(0)), run(d(2)), run(d(3)), long(d(5)), { date: d(1), type: 'rest' }, { date: d(4), type: 'rest' }, { date: d(6), type: 'rest' }];

test('#7/#8/#9. Contrato del plan: 4 entre semana, tirada sin D+ o dos carreras el mismo día → RECHAZADO', () => {
  assert.equal(validatePlanContract(goodWeek(), MONDAY).status, 'valid');
  assert.equal(validatePlanContract([...goodWeek().filter((w) => w.date !== d(1)), run(d(1))], MONDAY).status, 'rejected');
  const noGain = validatePlanContract(goodWeek().map((w) => (w.type === 'long_mountain_run' ? long(d(5), { plannedElevationGainM: 0 }) : w)), MONDAY);
  assert.equal(noGain.status, 'rejected');
  assert.ok(noGain.issues.some((i) => /desnivel/.test(i)));
  const twoSameDay = validatePlanContract([...goodWeek(), run(d(0))], MONDAY);
  assert.equal(twoSameDay.status, 'rejected');
  assert.equal(validatePlanContract([...goodWeek(), run('2026-10-10')], MONDAY).status, 'rejected');
  // Descanso duplicado → se repara, no se rechaza
  const dup = validatePlanContract([...goodWeek(), { date: d(1), type: 'rest' }], MONDAY);
  assert.equal(dup.status, 'repaired');
});

test('#10. Tope de FC por encima de la FC máxima medida → se ajusta a la FC máx', () => {
  const [w] = sanitizePlanWorkouts([{ type: 'hill_intervals', date: MONDAY, plannedDurationMin: 60, zoneSenseTarget: 'ZoneSense rojo (sobre umbral anaeróbico)', targetHrMax: 200 }], MEASURED).workouts;
  assert.equal(w.targetHrMax, 186);
});

test('#11 (FC manda). Con o sin banda, la fuente es la FC si hay AeT; sin AeT, RPE', () => {
  const p = resolveIntensityPrescription(MEASURED);
  assert.equal(p.chestStrap, 'unknown');
  assert.equal(p.primary, 'heart_rate_measured');
  assert.equal(resolveIntensityPrescription({}).primary, 'rpe');
  assert.equal(resolveIntensityPrescription({ ...MEASURED, hasChestStrap: true }).primary, 'heart_rate_measured');
  const [w] = sanitizePlanWorkouts([{ type: 'easy_run', date: MONDAY, plannedDurationMin: 50, zoneSenseTarget: 'ZoneSense verde (aeróbico)', intensitySource: 'zonesense' }], {}).workouts;
  assert.equal(w.intensitySource, 'rpe');
});

// ── Memoria ───────────────────────────────────────────────────────────────
test('#12. A favor y en contra el mismo día (subjetivo) → cuenta una sola', () => {
  const mem: any = { insights: [{ id: 'a', category: 'biomechanics_injury', observation: 'o', ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: '2026-09-01', sourceEvent: '', evidence: [{ date: '2026-09-01', source: 'workout_analysis', supports: true, summary: 'sesión', refId: 'w0' }] }] };
  let m = applyEvidence(mem, [{ insightId: 'a', supports: true, summary: 'me carga' }], { date: MONDAY, source: 'chat', refId: 'c1', sourceEvent: '' }).memory;
  m = applyEvidence(m, [{ insightId: 'a', supports: false, summary: 'hoy no' }], { date: MONDAY, source: 'athlete_note', refId: 'n1', sourceEvent: '' }).memory;
  const today = m.insights[0].evidence!.filter((e: any) => e.date === MONDAY);
  assert.equal(today.length, 1);
  assert.equal(today[0].supports, false); // la última sustituye a la anterior
});

test('#13/#14. Sóleo izquierdo ≠ derecho; subida ≠ bajada', () => {
  assert.equal(observationSimilarity('Sóleo izquierdo cargado en bajadas largas', 'Sóleo derecho cargado en bajadas largas'), 0);
  assert.equal(observationSimilarity('Sóleo cargado en subidas largas', 'Sóleo cargado en bajadas largas'), 0);
  assert.ok(observationSimilarity('Sóleo izquierdo cargado en bajadas largas', 'Carga del sóleo izquierdo tras bajadas largas') >= 0.6);
});

test('C13. Las reglas aplicadas que van al prompt tienen tope', () => {
  const ev = Array.from({ length: 5 }, (_, k) => ({ date: '2026-09-20', source: 'workout_analysis', supports: true, summary: 's', refId: `w${k}` }));
  const insights = Array.from({ length: 40 }, (_, k) => ({ id: `r${k}`, category: 'terrain_technique', observation: `regla ${k}`, ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: '2026-09-20', sourceEvent: '', evidence: ev }));
  const text = describeMemoryForPrompt({ insights } as any, '2026-09-25');
  assert.equal((text.match(/\[r\d+\]/g) || []).length, PROMPT_MAX_RULES);
});

// ── HRV y ACWR ────────────────────────────────────────────────────────────
const suuntoCi = (date: string, hrv: number) => ({ date, restingHr: 50, hrvRmssd: hrv, hrvBaseline: 45, sleepHours: 7, sleepQuality: 80, status: 'optimal', coachAdvice: '', source: 'suunto' }) as any;

test('#15/C35. HRV con 3 noches → datos insuficientes; y nunca autoriza subir carga', () => {
  const today = localDateKey();
  const three = [0, 1, 2].map((k) => suuntoCi(addDaysKey(today, -k), 50 + k));
  const r = calculateHrvPredictiveRegression(three, [], { baselineHrv: 45 } as any);
  assert.equal(r.fatigueRiskLevel, 'insufficient_data');
  assert.ok(r.n < MIN_REGRESSION_NIGHTS);
  // Tendencia claramente ascendente con datos suficientes → favorable pero SIN % de carga
  const up = Array.from({ length: 20 }, (_, k) => suuntoCi(addDaysKey(today, -19 + k), 35 + k));
  const r2 = calculateHrvPredictiveRegression(up, [], { baselineHrv: 40 } as any);
  assert.equal(r2.fatigueRiskLevel, 'supercompensation');
  assert.equal(r2.recommendedLoadAdjustmentPct, 0);
  assert.doesNotMatch(r2.recommendedAction, /\+\d+ ?%|Autorizado/);
});

test('#16. Sin HRV el panel HRV-carga no dice "estable" ni recomienda descarga', () => {
  const s = calculateHRVLoadCorrelation([], [], { baselineHrv: 45 } as any);
  assert.equal(s.currentStatus, 'insufficient_data');
  assert.equal(s.isDeloadRecommended, false);
  assert.match(s.statusLabel, /Sin datos de HRV/);
  assert.equal(s.fatigueRecoveryStatus, 'Sin datos de HRV');
});

test('#17. ACWR sin carga → "sin carga", sin zonas ni riesgos ficticios', () => {
  const a = calculateACWRSummary([]);
  assert.match(a.zoneLabel, /Sin carga/);
  assert.doesNotMatch(a.coachTacticalAdvice, /Sweet|ALERTA|2x|%/);
});

// ── Historial, carreras, nutrición, zona horaria ──────────────────────────
test('#18. Historial: "150 km" no puede convertirse en FC máxima 150', () => {
  const md = 'Mi FC máxima es 185 lpm. Ciclismo: 150 km en la última salida.';
  const r = verifyHistoryNumbers({ summary: { maxHr: 150 }, extractedProfileUpdates: { maxHr: { value: 185, quote: 'Mi FC máxima es 185 lpm' } } }, md);
  assert.equal(r.parsed.summary.maxHr, null);
  assert.equal(r.parsed.extractedProfileUpdates.maxHr, 185);
});

test('C16. El consejo de carreras solo admite derivaciones con significado', () => {
  const v = { fields: { distanceKm: { value: 45.5, sources: [] }, elevationGainM: { value: 2850, sources: [] } }, unverified: [], sources: [], queries: [], warnings: [] } as any;
  const allowed = allowedAdviceFigures(v);
  assert.ok(allowed.km.includes(73 - 45.5));
  assert.ok(!allowed.km.includes(73 + 45.5)); // una suma de distancias no significa nada
  assert.equal(filterRaceAdvice('Entre las dos suman 118,5 km.', v).advice, null);
});

test('#22. Nutrición: perfil de sodio sin rango medido → sodio null', () => {
  const [w] = sanitizePlanWorkouts([{ type: 'long_mountain_run', date: MONDAY, plannedDurationMin: 180, plannedSodiumPerHourMg: 600 }], {}, undefined, { sweatRateLph: 0.8, sodiumProfile: 'salty_sweater_white_crust' }).workouts;
  assert.equal(w.plannedSodiumPerHourMg, null);
});

test('#20. Zona horaria: a las 00:30 en Madrid el servidor (UTC) usa la fecha del atleta', () => {
  const t = new Date('2026-09-24T22:30:00Z'); // 00:30 del 25 en Madrid (UTC+2)
  assert.equal(dateKeyInTimezone('Europe/Madrid', t), '2026-09-25');
  assert.equal(athleteToday({ athleteTimezone: 'Europe/Madrid' }, t), '2026-09-25');
  assert.equal(athleteToday({ athleteToday: '2026-09-25' }, t), '2026-09-25');
});

// ── Descarga ──────────────────────────────────────────────────────────────
test('C22. La descarga sale de tus sesiones (75 %, sin intensidad) y sin cifras inventadas', () => {
  const start = '2026-10-05';
  const planned: any[] = [
    { id: 'p1', date: start, title: 'Series', type: 'hill_intervals', plannedDurationMin: 60, plannedDistanceKm: 10, plannedElevationGainM: 400, mainSet: '6x3 fuertes', completed: false },
    { id: 'p2', date: addDaysKey(start, 5), title: 'Larga', type: 'long_mountain_run', plannedDurationMin: 200, completed: false },
  ];
  const r = buildDeload(planned, start);
  assert.equal(r.basis, 'planned');
  assert.equal(r.workouts[0].type, 'easy_run');
  assert.equal(r.workouts[0].plannedDurationMin, 45);
  assert.equal(r.workouts[0].plannedDistanceKm, 7.5);
  assert.doesNotMatch(r.workouts[0].mainSet, /6x3|fuertes|bpm|ppm/);
  assert.equal(r.workouts[1].plannedDurationMin, 150);
  // Sin plan ni historial → no inventa nada
  assert.equal(buildDeload([], start).workouts.length, 0);
});
