/**
 * Auditoría 6 (Fase 1): cero números fisiológicos inventados, procedencia de las
 * zonas del reloj, política semanal única y carga con nivel de confianza.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateWorkoutTss } from '../src/utils/pmcCalculations.js';
import { getWorkoutLoad, windowLoad } from '../src/utils/trainingLoad.js';
import { evaluateReadiness, isLoadMostlyEstimated } from '../src/brain/readiness.js';
import { measuredAntHr } from '../src/brain/intensity.js';
import { formatWatchZones, availabilityLine } from '../server/brain/context.js';
import { validatePlanContract } from '../server/brain/decision/validate.js';
import { addDaysKey, deriveWeeklyStructurePolicy, DEFAULT_WEEK_POLICY } from '../src/utils/weekStructure.js';

// ── 1. Sin AnT medido nunca hay hrTSS (antes: AnT = 165 por defecto) ──────
test('avgHR sin AnT → nunca hrTSS con un umbral inventado', () => {
  const r = calculateWorkoutTss(60, 150);
  assert.notEqual(r.method, 'hrTSS');
  assert.doesNotMatch(r.formulaExplanation, /165/);
  // Con RPE cae a sRPE; sin nada, a duración
  assert.equal(calculateWorkoutTss(60, 150, undefined, 5).method, 'rpeTSS');
  assert.equal(calculateWorkoutTss(60, 150, 0).method, 'durationEstimate');
  // Con AnT medido sí
  assert.equal(calculateWorkoutTss(60, 150, 168).method, 'hrTSS');
});

test('getWorkoutLoad marca la confianza de la carga', () => {
  const base = { id: 'x', date: '2026-09-20', title: 't', type: 'easy_run', completed: true, actualDurationMin: 60 } as any;
  assert.equal(getWorkoutLoad({ ...base, actualAvgHr: 150 })!.confidence, 'estimated_duration');
  assert.equal(getWorkoutLoad({ ...base, actualAvgHr: 150 }, 168)!.confidence, 'estimated_hr');
  assert.equal(getWorkoutLoad({ ...base, athleteRpe: 4 })!.confidence, 'estimated_rpe');
  assert.equal(getWorkoutLoad({ ...base, suuntoWorkoutKey: 'k', actualTss: 60 })!.confidence, 'measured_suunto');
});

test('measuredAntHr: solo con origen Suunto o manual', () => {
  assert.equal(measuredAntHr({ antHr: 165 }), undefined);
  assert.equal(measuredAntHr({ antHr: 165, fieldSources: { antHr: 'manual' } } as any), 165);
});

// ── 2. Una Z3/Z5 del reloj no es AeT/AnT sin procedencia ─────────────────
const ADVICE = { watch: { maxHr: 185, zones: { z2: 120, z3: 140, z4: 155, z5: 170 } }, recommendations: [], notes: [] };

test('Z3/Z5 del reloj sin procedencia → nunca "= umbral aeróbico"', () => {
  const txt = formatWatchZones(ADVICE, {}, {});
  assert.doesNotMatch(txt, /= tu umbral|= umbral/);
  assert.match(txt, /NO se considera umbral aeróbico medido/);
  const factory = formatWatchZones({ ...ADVICE, recommendations: [{ field: 'zones', source: 'factory', label: 'x', evidence: 'y' }] }, {}, {});
  assert.match(factory, /FÁBRICA/);
});

test('Z3 del reloj = AeT del perfil con origen Suunto → se dice que es su umbral', () => {
  const txt = formatWatchZones(ADVICE, {}, { aetHr: 140, antHr: 170, fieldSources: { aetHr: 'suunto', antHr: 'suunto' } });
  assert.match(txt, /Z3 140 \(= tu umbral aeróbico en la app, origen Suunto\)/);
  assert.match(txt, /Z5 170 \(= tu umbral anaeróbico en la app, origen Suunto\)/);
});

// ── 5. El contrato semanal conoce la disponibilidad declarada ─────────────
const MONDAY = '2026-09-28';
const d = (n: number) => addDaysKey(MONDAY, n);
const run = (date: string) => ({ date, title: `s ${date}`, type: 'easy_run', plannedDurationMin: 50 });
const long = (date: string) => ({ date, title: 'larga', type: 'long_mountain_run', plannedDurationMin: 180, plannedDistanceKm: 22, plannedElevationGainM: 1200 });

test('availableDaysPerWeek = 2 (declarado) → un plan de 4 sesiones se rechaza', () => {
  const policy = deriveWeeklyStructurePolicy({ availableDaysPerWeek: 2, fieldSources: { availableDaysPerWeek: 'manual' } });
  assert.equal(policy.midweekRunsMax, 1);
  assert.equal(policy.maxTrainingDays, 2);
  const four = [run(d(1)), run(d(3)), run(d(4)), long(d(5))];
  const r = validatePlanContract(four, MONDAY, policy);
  assert.equal(r.status, 'rejected');
  assert.ok(r.issues.some((i) => /máximo 1/.test(i)));
  assert.equal(validatePlanContract([run(d(2)), long(d(6))], MONDAY, policy).status, 'valid');
  // Sin política declarada, el mismo plan de 4 es válido
  assert.equal(validatePlanContract(four, MONDAY).status, 'valid');
});

test('Disponibilidad de Suunto (historial) no es política; 3 días → 2 + larga', () => {
  assert.deepEqual(deriveWeeklyStructurePolicy({ availableDaysPerWeek: 2, fieldSources: { availableDaysPerWeek: 'suunto' } }), DEFAULT_WEEK_POLICY);
  const p3 = deriveWeeklyStructurePolicy({ availableDaysPerWeek: 3, fieldSources: { availableDaysPerWeek: 'manual' } });
  assert.equal(p3.midweekRunsMin, 2);
  assert.equal(p3.midweekRunsMax, 2);
  assert.match(availabilityLine({ availableDaysPerWeek: 2, fieldSources: { availableDaysPerWeek: 'manual' } }), /1 sesión\(es\) de carrera entre semana/);
});

// ── 6. Una carga estimada no decide sola el readiness ────────────────────
test('TSS de 7 días mayormente estimado → informa pero no sube el nivel', () => {
  const thresholds = { ctl: 40, chronicWeeklyTss: 280, low: 224, high: 308, veryHigh: 336 };
  const base = { hrvRmssd: 60, hrvBaseline: 60, sleepHours: 8, weeklyTss: 500, weeklyThresholds: thresholds, tsb: -35 };
  assert.equal(evaluateReadiness(base).level, 'amber');
  const est = evaluateReadiness({ ...base, weeklyNonMeasuredTss: 400 });
  assert.equal(est.level, 'green');
  assert.ok(est.reasons.some((r) => /ESTIMADA/.test(r)));
  assert.equal(isLoadMostlyEstimated(500, 200), false);
});

test('windowLoad separa la parte no medida', () => {
  const ws = [
    { id: 'a', date: '2026-09-20', title: 'a', type: 'easy_run', completed: true, suuntoWorkoutKey: 'k', actualTss: 50 },
    { id: 'b', date: '2026-09-21', title: 'b', type: 'easy_run', completed: true, actualDurationMin: 60 },
  ] as any[];
  const w = windowLoad(ws, '2026-09-20', '2026-09-21');
  assert.equal(w.tss, 50 + calculateWorkoutTss(60).tss);
  assert.equal(w.nonMeasuredTss, calculateWorkoutTss(60).tss);
});

// ── Fase 2: las métricas describen, solo readiness decide ────────────────
import { readFileSync } from 'node:fs';
import { describeTsb, describeRampRate } from '../src/utils/pmcCalculations.js';
import { calculateACWRSummary } from '../src/utils/acwrCalculations.js';
import { calculateHRVLoadCorrelation } from '../src/utils/hrvLoadCalculations.js';
import { localDateKey } from '../src/utils/trainingLoad.js';

test('PMC / ACWR / HRV-carga no llevan recomendaciones de acción', () => {
  for (const f of ['src/utils/pmcCalculations.ts', 'src/utils/acwrCalculations.ts', 'src/utils/hrvLoadCalculations.ts']) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /actionRecommendation|coachTacticalAdvice|actionableSteps|recommendedDeload|actionableRecommendations|isDeloadRecommended|injuryRisk/, f);
    assert.doesNotMatch(src, /Peak Form|Supercompensaci|Sweet Spot|non_functional_overreaching|mitocondrial/i, f);
  }
  const t = describeTsb(-35) as any;
  assert.equal(t.zone, 'very_negative');
  assert.equal(t.actionRecommendation, undefined);
  assert.doesNotMatch(t.description, /descarga|descanso|48-72/i);
  assert.doesNotMatch(describeRampRate(12).description, /lesi|riesgo/i);
});

const today = localDateKey();
const daily = (fromDaysAgo: number, toDaysAgo: number, tss: number) => {
  const out: any[] = [];
  for (let i = fromDaysAgo; i >= toDaysAgo; i--) {
    const date = addDaysKey(today, -i);
    out.push({ id: `w${date}`, date, title: 'r', type: 'easy_run', completed: true, suuntoWorkoutKey: `k${date}`, actualTss: tss });
  }
  return out;
};

test('ACWR desacoplado: la crónica NO incluye los 7 días agudos', () => {
  // Solo carga en los últimos 7 días: acoplado daría 4,0; desacoplado no hay crónica
  const onlyRecent = calculateACWRSummary(daily(6, 0, 60));
  assert.equal(onlyRecent.zone, 'insufficient_data');
  assert.equal(onlyRecent.currentAcwr, 0);
  // Carga constante → ratio 1
  const steady = calculateACWRSummary(daily(70, 0, 50));
  assert.equal(steady.currentAcwr, 1);
  assert.equal(steady.zone, 'similar');
  assert.match(steady.description, /1,00 veces la media de las 4 semanas previas/);
  // Doble carga los últimos 7 días → 2
  const spike = calculateACWRSummary([...daily(70, 7, 50), ...daily(6, 0, 100)]);
  assert.equal(spike.currentAcwr, 2);
  assert.equal(spike.zone, 'very_high');
});

test('HRV-carga: estados descriptivos, sin recomendar descarga', () => {
  const s = calculateHRVLoadCorrelation(daily(40, 0, 50), [], {} as any) as any;
  assert.equal(s.currentStatus, 'insufficient_data');
  assert.equal(s.isDeloadRecommended, undefined);
  assert.equal(s.actionableRecommendations, undefined);
  assert.equal(typeof s.loadRecoveryTrendScore, 'number');
});

// ── #9. Memoria: la negación no apoya lo que niega ───────────────────────
import { applyEvidence, isNegatedObservation, observationSimilarity, sanitizeEvidenceItems } from '../src/brain/memory.js';

const PAIN = () => ({
  id: 'p', category: 'biomechanics_injury', observation: 'Me duele el sóleo en bajadas largas', ruleForFuturePlans: '', confidenceScore: 0, learnedFromDate: '2026-09-01', sourceEvent: '',
  evidence: [
    { date: '2026-09-01', source: 'workout_analysis', supports: true, summary: 'dolor', refId: 'w1' },
    { date: '2026-09-08', source: 'workout_analysis', supports: true, summary: 'dolor', refId: 'w2' },
  ],
}) as any;
const CTX = { date: '2026-09-20', source: 'workout_analysis' as const, refId: 'w9', sourceEvent: '' };

test('Polaridad: "no me duele" no es la misma observación que "me duele"', () => {
  assert.equal(isNegatedObservation('Hoy no me duele el sóleo en bajadas largas'), true);
  assert.equal(isNegatedObservation('No pude terminar por el dolor de sóleo'), false);
  assert.equal(observationSimilarity('Me duele el sóleo en bajadas largas', 'Ya no me duele el sóleo en bajadas largas'), 0);
});

test('"Ya no me duele el sóleo" como hallazgo nuevo → evidencia EN CONTRA del aprendizaje', () => {
  const memory = { insights: [PAIN()] } as any;
  const items = sanitizeEvidenceItems([{ insightId: null, supports: true, summary: 'bajada larga sin molestias', category: 'biomechanics_injury', observation: 'Ya no me duele el sóleo en bajadas largas' }], memory);
  const { memory: next } = applyEvidence(memory, items, CTX);
  assert.equal(next.insights.length, 1);
  const ev = next.insights[0].evidence!;
  assert.equal(ev[ev.length - 1].supports, false);
  assert.equal(next.insights[0].status, 'observation'); // 2 a favor → hipótesis; 1 en contra baja un nivel
});

test('La IA marca a favor un resumen que niega el aprendizaje → cuenta en contra', () => {
  const memory = { insights: [PAIN()] } as any;
  const items = sanitizeEvidenceItems([{ insightId: 'p', supports: true, summary: 'Hoy no me duele el sóleo en bajadas largas' }], memory);
  const { memory: next, changes } = applyEvidence(memory, items, CTX);
  const ev = next.insights[0].evidence!;
  assert.equal(ev[ev.length - 1].supports, false);
  assert.ok(changes.some((c) => /lo contrario/.test(c)));
  // Un apoyo afirmativo sigue sumando a favor
  const ok = applyEvidence(memory, sanitizeEvidenceItems([{ insightId: 'p', supports: true, summary: 'Otra vez dolor de sóleo al bajar' }], memory), CTX).memory;
  assert.equal(ok.insights[0].evidence!.at(-1)!.supports, true);
});
