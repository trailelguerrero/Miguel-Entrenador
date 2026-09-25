/**
 * Arreglos de la auditoría funcional del cerebro (readiness, procedencia, carreras).
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SearchResult } from '../server/ai.js';
import { describeReadiness, evaluateReadiness, strictestReadiness } from '../src/brain/readiness.js';
import { weeklyLoadThresholds } from '../src/utils/trainingLoad.js';
import { formatLoadContext, resolveReadinessState, verifyTodayReadiness } from '../server/brain/context.js';
import { adviceUsesOnlyVerifiedNumbers, filterRaceAdvice, keywords, numberAppears, textAppears, verifyRaceInfo } from '../server/brain/decision/race.js';

// ── Readiness: varios riesgos a la vez ─────────────────────────────────────
test('ROJO de base + escalador → descanso obligatorio (no es lo mismo que un rojo por dormir mal)', () => {
  const soloRojo = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5 }); // −25 %
  assert.equal(soloRojo.level, 'red');
  assert.equal(soloRojo.limits.mandatoryRest, false);
  assert.equal(soloRojo.limits.maxDurationMin, 35);
  const rojoYCarga = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5, tsb: -45 });
  assert.equal(rojoYCarga.level, 'red');
  assert.equal(rojoYCarga.limits.mandatoryRest, true);
  assert.equal(rojoYCarga.limits.maxDurationMin, 0);
});

test('ÁMBAR + ≥2 escaladores → ROJO con descanso; ÁMBAR + 1 → ROJO normal', () => {
  const th = weeklyLoadThresholds(40)!;
  const multi = evaluateReadiness({ hrvRmssd: 51, hrvBaseline: 60, sleepHours: 7.5, tsb: -45, stressLevel: 9, weeklyTss: th.veryHigh + 50, weeklyThresholds: th });
  assert.equal(multi.level, 'red');
  assert.equal(multi.limits.mandatoryRest, true);
  const one = evaluateReadiness({ hrvRmssd: 51, hrvBaseline: 60, sleepHours: 7.5, tsb: -45 });
  assert.equal(one.level, 'red');
  assert.equal(one.limits.mandatoryRest, false);
});

test('El prompt deja claro que los límites son máximos y el Recovery es informativo', () => {
  const txt = describeReadiness(evaluateReadiness({ hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8, recoveryPct: 20 }));
  assert.ok(txt.includes('Recovery Suunto 20% (informativo)'));
  assert.ok(txt.includes('Los límites son MÁXIMOS'));
});

// ── Readiness: el servidor no se fía del cliente ───────────────────────────
const checkIn = { hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5 }; // HRV −25 % → rojo

test('Un cliente que manda "verde" con HRV −25 % no relaja el estado', () => {
  const fakeGreen = { level: 'green', reasons: [], missingData: [], hrvDeltaPct: 0, limits: { maxDurationMin: null, maxZoneSense: 'red', allowIntervals: true, mandatoryRest: false } };
  const s = resolveReadinessState({ checkIn, readinessState: fakeGreen });
  assert.equal(s.level, 'red');
  assert.equal(s.limits.allowIntervals, false);
});

test('El servidor recalcula con la carga enviada (TSB) y acepta un estado del cliente más estricto', () => {
  const s = resolveReadinessState({ checkIn, readinessInputs: { tsb: -40, weeklyTss: 300, ctl: 50 } });
  assert.equal(s.limits.mandatoryRest, true);
  // Entradas corruptas se ignoran
  const bad = resolveReadinessState({ checkIn: { hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8 }, readinessInputs: { tsb: 'x', ctl: NaN } });
  assert.equal(bad.level, 'green');
  // El cliente (versión antigua o con más contexto) puede endurecer
  const base = evaluateReadiness({ hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8 });
  const stricter = strictestReadiness(base, { ...base, level: 'amber', reasons: ['carga del cliente'], limits: { maxDurationMin: 40, maxZoneSense: 'green', allowIntervals: false, mandatoryRest: false } });
  assert.equal(stricter.level, 'amber');
  assert.equal(stricter.limits.maxDurationMin, 40);
  assert.ok(stricter.reasons.includes('carga del cliente'));
  // Un estado malformado no cuenta
  assert.equal(strictestReadiness(base, { level: 'red', limits: { maxDurationMin: 'x' } }), base);
});

// ── Procedencia ────────────────────────────────────────────────────────────
test('Cada línea de datos del contexto de carga lleva etiqueta de procedencia', () => {
  const state = evaluateReadiness({ hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5 });
  const txt = formatLoadContext({
    ctl: 50, atl: 60, tsb: -10, weeklyTss: 400,
    loadHistory: { status: 'stabilized', startDate: '2025-09-01', days: 380 },
    recentCheckIns: [{ date: '2026-09-25', hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5, status: 'fatigued', fromSuunto: true }],
    todayReadiness: state,
    todayReadinessInputs: { hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5 },
  });
  const untagged = txt.split('\n').filter((l) => !l.includes('Ventanas de datos') && !/\[(REAL|DERIVADO|ESTIMADO)\]/.test(l));
  assert.deepEqual(untagged, []);
});

// ── Readiness del chat y del plan ──────────────────────────────────────────
const fakeGreenState = { level: 'green', reasons: [], missingData: [], hrvDeltaPct: 0, limits: { maxDurationMin: null, maxZoneSense: 'red', allowIntervals: true, mandatoryRest: false } };

test('Chat/plan: un "verde" del cliente con HRV −25 % se describe como ROJO', () => {
  const lc = { tsb: -5, weeklyTss: 300, ctl: 50, recentCheckIns: [], todayReadiness: fakeGreenState, todayReadinessInputs: { hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5 } };
  assert.equal(verifyTodayReadiness(lc)!.level, 'red');
  const txt = formatLoadContext(lc);
  assert.ok(txt.includes('ROJO'));
  assert.ok(!txt.includes('VERDE'));
});

test('Chat/plan: la carga del contexto (TSB) entra en el recálculo', () => {
  const lc = { tsb: -45, weeklyTss: 300, ctl: 50, recentCheckIns: [], todayReadinessInputs: { hrvRmssd: 45, hrvBaseline: 60, sleepHours: 7.5 } };
  assert.equal(verifyTodayReadiness(lc)!.limits.mandatoryRest, true);
});

test('Chat/plan: sin datos crudos no se describe un estado sin verificar', () => {
  const lc = { recentCheckIns: [], todayReadiness: fakeGreenState };
  assert.equal(verifyTodayReadiness(lc), null);
  const txt = formatLoadContext(lc);
  assert.ok(txt.includes('no verificable'));
  assert.ok(!txt.includes('LÍMITES OBLIGATORIOS'));
  // Sin check-in de hoy no se dice nada
  assert.ok(!formatLoadContext({ recentCheckIns: [] }).includes('readiness'));
});

// ── Carreras ───────────────────────────────────────────────────────────────
test('Cifras con apóstrofo, espacio fino o dígitos de ancho completo', () => {
  assert.ok(numberAppears(4350, "4'350 m D+"));
  assert.ok(numberAppears(4350, '4 350 m'));
  assert.ok(numberAppears(4350, '４３５０ｍ'));
  assert.ok(numberAppears(4350, '4,350m of climbing'));
});

test('Textos: sin palabras genéricas, admite nombres de 3 letras y exige la mitad de las palabras', () => {
  assert.deepEqual(keywords('Terreno alpino técnico'), ['alpino', 'tecnico']);
  assert.deepEqual(keywords('Pas de la Casa'), ['pas', 'casa']);
  // Antes bastaba "terreno" para verificar cualquier descripción
  assert.ok(!textAppears(keywords('Terreno con cadenas y nieve'), 'Terreno volcánico y pistas de tierra.'));
  assert.ok(textAppears(keywords('Terreno alpino técnico'), 'recorrido alpino con tramos técnicos'));
  assert.ok(!textAppears(keywords('Terreno alpino técnico'), 'alta montaña con scree'));
});

const src = (title: string) => ({ title, uri: `https://${title}.test` });

test('Coherencia: desnivel imposible para la distancia se descarta; páginas distintas → aviso', () => {
  const search: SearchResult = {
    text: '', queries: [],
    sources: [src('a'), src('b')],
    segments: [
      { text: 'La carrera tiene 10 km.', sourceIdx: [0] },
      { text: 'Con 4000 m de desnivel positivo.', sourceIdx: [1] },
      { text: 'Otra prueba de 2000 m de desnivel positivo.', sourceIdx: [1] },
    ],
  };
  const imposible = verifyRaceInfo({ distanceKm: { value: 10, sources: [0] }, elevationGainM: { value: 4000, sources: [1] } }, search);
  assert.equal(imposible.fields.elevationGainM, undefined);
  assert.ok(imposible.unverified.includes('elevationGainM'));
  assert.ok(imposible.warnings.some((w) => w.includes('imposible')));
  assert.deepEqual(imposible.sources.map((s) => s.title), ['a']);
  const distintas = verifyRaceInfo({ distanceKm: { value: 10, sources: [0] }, elevationGainM: { value: 2000, sources: [1] } }, search);
  assert.equal(distintas.fields.elevationGainM?.value, 2000);
  assert.ok(distintas.warnings.some((w) => w.includes('páginas distintas')));
});

test('El consejo no puede citar cifras de km/m que no estén verificadas', () => {
  const v = { fields: { distanceKm: { value: 45.5, sources: [] }, elevationGainM: { value: 2850, sources: [] } }, unverified: [], sources: [], queries: [], warnings: [] } as any;
  assert.ok(adviceUsesOnlyVerifiedNumbers('Sus 45,5 km y 2.850 m D+ son buen ensayo para los 73 km de la Transvulcania.', v));
  assert.ok(!adviceUsesOnlyVerifiedNumbers('Con 45,5 km y unos 3.100 m de desnivel...', v));
  assert.ok(!adviceUsesOnlyVerifiedNumbers('Baja unos 2900 metros.', v));
  assert.ok(adviceUsesOnlyVerifiedNumbers('Buena carrera B a 8 semanas.', v));
});

test('El consejo admite cifras derivadas al comparar con la Transvulcania', () => {
  const v = { fields: { distanceKm: { value: 45.5, sources: [] }, elevationGainM: { value: 2850, sources: [] } }, unverified: [], sources: [], queries: [], warnings: [] } as any;
  // 73 − 45,5 = 27,5 km; 4350 − 2850 = 1500 m; 2850/45,5 ≈ 63 m/km
  assert.ok(adviceUsesOnlyVerifiedNumbers('Le faltan 27,5 km y 1.500 m de desnivel respecto a la Transvulcania.', v));
  assert.ok(adviceUsesOnlyVerifiedNumbers('Unos 63 m/km de desnivel, algo más que los 60 m/km de La Palma.', v));
  // Unidades separadas: 1500 no vale como km
  assert.ok(!adviceUsesOnlyVerifiedNumbers('Son 1500 km.', v));
});

test('Solo se quitan las frases con cifras sin respaldo, no todo el consejo', () => {
  const v = { fields: { distanceKm: { value: 45.5, sources: [] }, elevationGainM: { value: 2850, sources: [] } }, unverified: [], sources: [], queries: [], warnings: [] } as any;
  const r = filterRaceAdvice('Buena carrera B con 45,5 km. Tiene una bajada de 2.900 m. Colócala a 8 semanas de La Palma.', v);
  assert.equal(r.advice, 'Buena carrera B con 45,5 km. Colócala a 8 semanas de La Palma.');
  assert.deepEqual(r.removed, ['2900 m']);
  // Si todas las frases tienen cifras inventadas, no queda consejo
  assert.equal(filterRaceAdvice('Tiene 3.100 m de desnivel.', v).advice, null);
});
