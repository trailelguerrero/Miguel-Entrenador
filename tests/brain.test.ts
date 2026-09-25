/**
 * Banco de pruebas de consistencia del cerebro de Miguel.
 * Comprueba, para cada situación, QUÉ dato se usa y QUÉ regla se aplica,
 * solo sobre las partes deterministas (código, no IA).
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { AthleteProfile, Workout } from '../src/types/index.js';
import { resolveIntensityPrescription } from '../src/brain/intensity.js';
import { evaluateReadiness } from '../src/brain/readiness.js';
import { normalizeSuuntoZoneSense, toStoredBreakdown, normalizeZoneSenseTarget } from '../src/brain/zonesense.js';
import { getWorkoutLoad, getLoadHistoryInfo, localDateKey, weeklyLoadThresholds } from '../src/utils/trainingLoad.js';
import { analyzeWeekStructure, mondayOfKey, addDaysKey } from '../src/utils/weekStructure.js';
import { computeReadiness } from '../src/utils/readiness.js';
import { sanitizePlanWorkouts, sanitizeAdaptation } from '../server/brain/decision/validate.js';

// ── Atleta de referencia: umbrales medidos por Suunto ──────────────────────
const measured: Partial<AthleteProfile> = {
  maxHr: 185,
  aetHr: 145,
  antHr: 168,
  fieldSources: { maxHr: 'suunto', aetHr: 'suunto', antHr: 'suunto' } as AthleteProfile['fieldSources'],
};
const without = (...fields: ('maxHr' | 'aetHr' | 'antHr')[]): Partial<AthleteProfile> => {
  const p: any = { ...measured, fieldSources: { ...measured.fieldSources } };
  for (const f of fields) {
    p[f] = 0;
    delete p.fieldSources[f];
  }
  return p;
};

const wk = (over: Partial<Workout>): Workout =>
  ({ id: 'w', date: '2026-09-21', title: 'Sesión', type: 'easy_run', plannedDurationMin: 60, description: '', mainSet: '', completed: false, ...over }) as Workout;

// Respuesta típica de la IA que INVENTA pulsaciones y nutrición
const aiPlan = () => [
  { date: '2026-09-22', title: 'Rodaje', type: 'easy_run', plannedDurationMin: 60, zoneSenseTarget: 'DFA a1 > 0.75 (Aeróbico)', targetHrMin: 130, targetHrMax: 150, plannedCarbsPerHourG: 60, plannedFluidsPerHourMl: 650, plannedSodiumPerHourMg: 550 },
  { date: '2026-09-23', title: 'Cuestas', type: 'hill_intervals', plannedDurationMin: 70, zoneSenseTarget: 'ZoneSense rojo (anaeróbico)', targetHrMin: 160, targetHrMax: 175 },
  { date: '2026-09-25', title: 'Rodaje', type: 'easy_run', plannedDurationMin: 50, zoneSenseTarget: 'ZoneSense verde (aeróbico)' },
  { date: '2026-09-27', title: 'Tirada larga', type: 'long_mountain_run', plannedDurationMin: 180, zoneSenseTarget: 'ZoneSense verde (aeróbico)' },
];

// ── 1. Sin FC máx ──────────────────────────────────────────────────────────
test('1. Sin FC máx: se avisa, pero la FC aeróbica medida sigue siendo válida', () => {
  const p = resolveIntensityPrescription(without('maxHr'));
  assert.equal(p.maxHr, null);
  assert.equal(p.hrAllowed, true);
  assert.ok(p.missing.includes('FC máxima medida'));
});

// ── 2. Sin AeT ─────────────────────────────────────────────────────────────
test('2. Sin AeT: sin pulsaciones en el plan (null), intensidad por ZoneSense o RPE', () => {
  const { workouts, notes } = sanitizePlanWorkouts(aiPlan(), without('aetHr'));
  for (const w of workouts) {
    assert.equal(w.targetHrMin, null);
    assert.equal(w.targetHrMax, null);
    assert.ok(['zonesense', 'rpe'].includes(w.intensitySource), w.intensitySource);
  }
  assert.ok(notes.some((n) => n.includes('se quitaron pulsaciones')));
  // Un umbral por defecto (sin origen medido) tampoco cuenta
  const def = resolveIntensityPrescription({ aetHr: 150, fieldSources: {} as any });
  assert.equal(def.hrAllowed, false);
});

// ── 3. Sin AnT ─────────────────────────────────────────────────────────────
test('3. Sin AnT: la FC de respaldo se limita al umbral aeróbico medido', () => {
  const p = resolveIntensityPrescription(without('antHr'));
  assert.equal(p.hrAllowed, true);
  assert.equal(p.antHr, null);
  const { workouts } = sanitizePlanWorkouts(aiPlan(), without('antHr'));
  // Sesión verde: el tope de FC no pasa del AeT medido (150 → 145)
  assert.equal(workouts[0].targetHrMax, 145);
});

// ── 4. Sin banda ───────────────────────────────────────────────────────────
test('4. Sin banda de pecho: FC medida si hay umbral; si no, RPE', () => {
  assert.equal(resolveIntensityPrescription(measured, false).primary, 'heart_rate_measured');
  assert.equal(resolveIntensityPrescription(without('aetHr', 'antHr', 'maxHr'), false).primary, 'rpe');
  assert.equal(resolveIntensityPrescription(measured, true).primary, 'zonesense');
});

// ── 5. ZoneSense verde + HRV muy baja ──────────────────────────────────────
test('5. ZoneSense verde + HRV muy baja: manda la HRV → ROJO, sin series, ≤35 min', () => {
  const state = evaluateReadiness({ hrvRmssd: 40, hrvBaseline: 60, sleepHours: 7.5, plannedWorkout: { type: 'hill_intervals', plannedDurationMin: 70 } });
  assert.equal(state.level, 'red');
  assert.equal(state.limits.allowIntervals, false);
  assert.equal(state.limits.maxZoneSense, 'green');
  assert.equal(state.limits.maxDurationMin, 35);
  const { adapted, corrections } = sanitizeAdaptation(
    { type: 'hill_intervals', plannedDurationMin: 70, zoneSenseTarget: 'ZoneSense rojo (anaeróbico)' },
    state,
    measured,
  );
  assert.equal(adapted.type, 'easy_run');
  assert.equal(adapted.plannedDurationMin, 35);
  assert.equal(adapted.zoneSenseTarget, 'Regenerativo (verde, muy suave)');
  assert.ok(corrections.length >= 3);
});

// ── 6. HRV buena + TSB muy negativo ────────────────────────────────────────
test('6. HRV buena + TSB muy negativo: sube un nivel (VERDE → ÁMBAR), no más', () => {
  const state = evaluateReadiness({ hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8, tsb: -35 });
  assert.equal(state.level, 'amber');
  assert.equal(state.limits.allowIntervals, false);
  // Dos escaladores a la vez siguen siendo UN paso
  const both = evaluateReadiness({ hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8, tsb: -35, stressLevel: 9 });
  assert.equal(both.level, 'amber');
  // Carga de 7 días por encima del umbral "muy alta" de su CTL
  const th = weeklyLoadThresholds(40)!;
  const load = evaluateReadiness({ hrvRmssd: 62, hrvBaseline: 60, sleepHours: 8, weeklyTss: th.veryHigh + 1, weeklyThresholds: th });
  assert.equal(load.level, 'amber');
});

test('6b. HRV de referencia 0 o ausente: sin NaN, se declara el dato que falta', () => {
  const state = evaluateReadiness({ hrvRmssd: 55, hrvBaseline: 0, sleepHours: 7 });
  assert.equal(state.hrvDeltaPct, null);
  assert.ok(state.missingData.includes('HRV de referencia'));
  assert.equal(state.level, 'green');
  const none = evaluateReadiness({});
  assert.equal(none.level, 'unknown');
  // El semáforo usa el mismo motor
  const semaforo = computeReadiness({ hrvRmssd: 40, hrvBaseline: 60, sleepHours: 7.5 });
  assert.equal(semaforo.status, 'fatigued');
  assert.ok(Number.isFinite(computeReadiness({ hrvRmssd: 50, hrvBaseline: 0, sleepHours: 7 }).hrvDropPct));
});

// ── 7. Semana con un entreno perdido ───────────────────────────────────────
test('7. Semana con un entreno perdido: sigue siendo 3(2) + tirada larga, se ve el hueco', () => {
  const monday = mondayOfKey('2026-09-21');
  const week = [
    wk({ id: 'a', date: monday, completed: true }),
    wk({ id: 'b', date: addDaysKey(monday, 2), completed: false }), // perdido
    wk({ id: 'c', date: addDaysKey(monday, 4), completed: true }),
    wk({ id: 'd', date: addDaysKey(monday, 6), type: 'long_mountain_run', plannedDurationMin: 180 }),
  ];
  const s = analyzeWeekStructure(week, monday);
  assert.deepEqual(s.issues, []);
  assert.equal(s.midweekPlanned, 3);
  assert.equal(s.midweekCompleted, 2);
  assert.equal(s.longRunDay, 'domingo');
  // La IA que mete 4 entre semana y ninguna tirada larga queda señalada
  const bad = sanitizePlanWorkouts(
    [0, 1, 2, 3].map((i) => ({ date: addDaysKey(monday, i), title: `S${i}`, type: 'easy_run', plannedDurationMin: 45 })),
    measured,
    monday,
  );
  assert.ok(bad.structureIssues.some((i) => i.includes('máximo 3')));
  assert.ok(bad.structureIssues.some((i) => i.includes('sin tirada larga')));
});

// ── 8. FIT sin TSS ─────────────────────────────────────────────────────────
test('8. FIT sin TSS: TSS estimado (etiquetado), nunca atribuido a Suunto; sin datos → sin carga', () => {
  const fit = wk({ completed: true, actualDurationMin: 60, actualAvgHr: 140 });
  const load = getWorkoutLoad(fit, 168);
  assert.ok(load);
  assert.equal(load!.source, 'estimated');
  assert.ok(load!.tss > 0);
  assert.equal(getWorkoutLoad(wk({ completed: true, actualDurationMin: 0, plannedDurationMin: 0 }), 168), null);
  assert.equal(getWorkoutLoad(wk({ completed: false }), 168), null);
});

// ── 9. Suunto con TSS ──────────────────────────────────────────────────────
test('9. Suunto con TSS: se usa el TSS de Suunto tal cual; sin TSS de Suunto = 0, no se estima', () => {
  const s = wk({ completed: true, suuntoWorkoutKey: 'k1', actualTss: 87, actualDurationMin: 90, actualAvgHr: 150 });
  assert.deepEqual(getWorkoutLoad(s, 168), { tss: 87, source: 'suunto' });
  const noTss = wk({ completed: true, suuntoWorkoutKey: 'k2', actualDurationMin: 90, actualAvgHr: 150 });
  assert.deepEqual(getWorkoutLoad(noTss, 168), { tss: 0, source: 'suunto' });
});

test('9b. Historial de carga: "en calentamiento" con < 42 días, "estabilizado" con ≥ 42', () => {
  const today = localDateKey();
  const recent = [wk({ date: addDaysKey(today, -10), completed: true, suuntoWorkoutKey: 'k', actualTss: 50 })];
  assert.equal(getLoadHistoryInfo(recent).status, 'warming_up');
  const old = [...recent, wk({ id: 'o', date: addDaysKey(today, -60), completed: true, suuntoWorkoutKey: 'k0', actualTss: 40 })];
  const info = getLoadHistoryInfo(old);
  assert.equal(info.status, 'stabilized');
  assert.equal(info.startDate, addDaysKey(today, -60));
  assert.equal(getLoadHistoryInfo([]).status, 'none');
});

// ── 10. Carrera desconocida: ver tests/race.test.ts ──

// ── ZoneSense y nutrición ─────────────────────────────────────────────────
test('ZoneSense de Suunto → colores canónicos (aeróbica=verde, anaeróbica=amarillo, VO2max=rojo)', () => {
  const z = normalizeSuuntoZoneSense({ timeInAerobicZoneMs: 3_000_000, timeInAnaerobicZoneMs: 600_000, timeInVo2MaxZoneMs: 0 } as any);
  assert.ok(z);
  assert.equal(z!.greenPct + z!.yellowPct + z!.redPct, 100);
  assert.equal(z!.greenPct, 83);
  assert.deepEqual(toStoredBreakdown(z!), { aerobicPct: 83, transitionPct: 17, anaerobicPct: 0 });
  assert.equal(normalizeSuuntoZoneSense({ timeInAerobicZoneMs: 0, timeInAnaerobicZoneMs: 0, timeInVo2MaxZoneMs: 0 } as any), null);
  // Textos antiguos "DFA a1" se traducen a colores
  assert.equal(normalizeZoneSenseTarget('DFA a1 > 0.75 (Aeróbico)'), 'ZoneSense verde (aeróbico)');
});

test('Nutrición: sin evidencia del atleta no hay cifras; con evidencia, nunca por encima de ella', () => {
  const none = sanitizePlanWorkouts(aiPlan(), measured).workouts[0];
  assert.equal(none.plannedCarbsPerHourG, null);
  assert.equal(none.plannedFluidsPerHourMl, null);
  assert.equal(none.plannedSodiumPerHourMg, null);
  const ev = sanitizePlanWorkouts(aiPlan(), measured, undefined, { maxCarbsPerHourG: 50, sweatRateLph: 0.6, sodiumProfile: 'medio' }).workouts[0];
  assert.equal(ev.plannedCarbsPerHourG, 50);
  assert.equal(ev.plannedFluidsPerHourMl, 600);
  // C23: un perfil cualitativo ("medio") no genera una cifra de sodio
  assert.equal(ev.plannedSodiumPerHourMg, null);
  // Con un rango medido, dentro del rango
  const ranged = sanitizePlanWorkouts(aiPlan(), measured, undefined, { sweatRateLph: 0.6, sodiumRangeMgPerHour: { min: 300, max: 450 } }).workouts[0];
  assert.equal(ranged.plannedSodiumPerHourMg, 450);
});

// ── Barrido del repositorio: ni DFA a1 ni cortes 0,75/0,50 fuera de compatibilidad ──
const ROOT = join(import.meta.dirname, '..');
const ALLOWED = new Set([
  'src/brain/zonesense.ts', // LEGACY_MAP (compatibilidad con sesiones guardadas)
  'src/types/index.ts', // LegacyZoneSenseTarget
  'src/services/sampleData.ts', // datos de ejemplo antiguos (se normalizan al leer)
  'src/services/storage.ts', // migración de memoria/perfil guardados
  'src/components/ZoneSenseSuuntoView.tsx', // explica por qué ZoneSense NO es el DFA a1 clásico
  'tests/brain.test.ts',
]);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (['node_modules', 'dist', '.git'].includes(f)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|md)$/.test(f) ? [p] : [];
  });

test('Ningún "DFA a1" ni corte 0,75/0,50 de DFA fuera de las listas de compatibilidad', () => {
  const offenders: string[] = [];
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file);
    if (ALLOWED.has(rel)) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/DFA\s*a1|DFA[^\n]{0,20}0[.,](75|50?)\b/i.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, []);
});
