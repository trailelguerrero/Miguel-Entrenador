/**
 * Auditoría 2 (septiembre 2026): datos que no se correspondían con la realidad.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage en memoria para probar StorageService en Node
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

const { deriveProfileFromSuunto, isDefaultSuuntoZones } = await import('../server/suunto-profile.js');
const { computeWatchZoneAdvice } = await import('../server/zone-advice.js');
const { mapSuuntoWorkouts } = await import('../server/suunto-map.js');
const { applySuuntoProfile } = await import('../src/utils/suuntoProfile.js');
const { getWorkoutLoad } = await import('../src/utils/trainingLoad.js');
const { calculateHeartRateDrift, hasAerobicDeficiency } = await import('../src/utils/uphillAthlete.js');
const { StorageService, sportGroup } = await import('../src/services/storage.js');
const { localDateKey } = await import('../src/utils/trainingLoad.js');

const NOW = Date.parse('2026-09-25T12:00:00Z');
const run = (over: Record<string, unknown> = {}) => ({
  workoutKey: `k${Math.random()}`, activityId: 1, description: null, startTime: NOW - 86400000, timeOffsetInMinutes: 120,
  totalTimeSec: 3600, totalDistanceM: 10000, totalAscentM: 100, totalDescentM: 100, avgHR: 140, maxHR: 160, tss: 60, energyKcal: 600,
  timeInAerobicZoneMs: 3000000, timeInAnaerobicZoneMs: 0, timeInVo2MaxZoneMs: 0,
  userMaxHR: 184, hrZoneLowerLimits: { z2: 132, z3: 142, z4: 151, z5: 160 }, zoneSenseAerobicThreshold: null, zoneSenseAnaerobicThreshold: null, vo2Max: 53,
  ...over,
});

// ── Zonas de fábrica del reloj ─────────────────────────────────────────────
test('Las zonas de fábrica de Suunto (72/77/82/87 % de 184) se detectan', () => {
  assert.equal(isDefaultSuuntoZones({ z2: 132, z3: 142, z4: 151, z5: 160 }, 184), true);
  // Zonas personalizadas (p. ej. tras un test) no son de fábrica
  assert.equal(isDefaultSuuntoZones({ z2: 128, z3: 148, z4: 158, z5: 166 }, 184), false);
});

test('Con zonas de fábrica NO se deducen AeT/AnT ni ADS, y se vacían los de Suunto', () => {
  const s = deriveProfileFromSuunto([run() as any], [], NOW);
  assert.equal(s.values.aetHr, undefined);
  assert.equal(s.values.antHr, undefined);
  assert.equal(s.values.hasAds, undefined);
  assert.deepEqual(s.cleared, ['aetHr', 'antHr', 'hasAds']);
  assert.match(s.evidence.aetHr!, /de fábrica/);
  // Un perfil que ya tenía 142/160 "de Suunto" (y ADS) se limpia; lo manual no se toca
  const prev: any = { aetHr: 142, antHr: 160, hasAds: true, maxHr: 184, fieldSources: { aetHr: 'suunto', antHr: 'manual', hasAds: 'suunto', maxHr: 'suunto' } };
  const { profile } = applySuuntoProfile(prev, s);
  assert.equal(profile.aetHr, 0);
  assert.equal(profile.antHr, 160); // manual
  assert.equal(profile.hasAds, false);
  assert.equal(profile.fieldSources!.aetHr, undefined);
  // Y Miguel recibe el aviso
  assert.ok(computeWatchZoneAdvice([run() as any], NOW).notes.some((n) => /de fábrica/.test(n)));
});

test('Con zonas personalizadas se siguen usando Z3/Z5 del reloj', () => {
  const s = deriveProfileFromSuunto([run({ hrZoneLowerLimits: { z2: 128, z3: 152, z4: 158, z5: 166 } }) as any], [], NOW);
  assert.equal(s.values.aetHr, 152);
  assert.equal(s.values.antHr, 166);
  assert.equal(s.values.hasAds, false); // 14/166 = 8,4 %
});

// ── TSS de actividades añadidas a mano en Suunto ─────────────────────────
test('Actividad añadida a mano en Suunto: su TSS es ASIGNADO por Suunto, no medido', () => {
  const [manual] = mapSuuntoWorkouts([run({ activityId: 73, isManuallyAdded: true, avgHR: 0, maxHR: 0, tss: 35, totalDistanceM: 0, description: 'Entrenamiento funcional con Julia' }) as any]);
  assert.equal(manual.suuntoManualEntry, true);
  assert.equal(manual.type, 'strength_core');
  assert.deepEqual(getWorkoutLoad(manual), { tss: 35, source: 'suunto_assigned', confidence: 'assigned_suunto' }); // C21: ni medido ni estimado por la app
  const [measured] = mapSuuntoWorkouts([run() as any]);
  assert.equal(getWorkoutLoad(measured)!.source, 'suunto');
});

// ── Test de deriva y ADS ─────────────────────────────────────────────────
test('Test de deriva: > 5 % = test por encima del AeT, NO es ADS', () => {
  const hi = calculateHeartRateDrift(150, 160); // 6,7 %
  assert.equal(hi.hasAds, false);
  assert.match(hi.statusText, /por encima de tu AeT/);
  assert.match(calculateHeartRateDrift(140, 145).statusText, /es tu AeT/); // 3,6 %
  assert.match(calculateHeartRateDrift(140, 142).statusText, /por debajo/); // 1,4 %
});

test('ADS: una sola regla y sin umbrales medidos no hay diagnóstico', () => {
  assert.equal(hasAerobicDeficiency(0, 160), null); // antes: 160 − 0 > 20 → "ADS"
  assert.equal(hasAerobicDeficiency(142, 160), true); // 11,25 %
  assert.equal(hasAerobicDeficiency(150, 160), false);
});

// ── Sincronización con Suunto ────────────────────────────────────────────
test('Un pilates de Suunto no completa las series planificadas de ese día', () => {
  mem.clear();
  const today = localDateKey();
  StorageService.saveWorkouts([{ id: 'plan-1', date: today, title: 'Series en cuesta', type: 'hill_intervals', plannedDurationMin: 60, description: '', mainSet: '', completed: false } as any]);
  const [pilates] = mapSuuntoWorkouts([run({ activityId: 51, startTime: Date.now(), timeOffsetInMinutes: -new Date().getTimezoneOffset() }) as any]);
  const r = StorageService.mergeSuuntoSync([{ ...pilates, date: today }], []);
  assert.equal(r.completedPlanned, 0);
  assert.equal(StorageService.getWorkouts().find((w) => w.id === 'plan-1')!.completed, false);
  assert.equal(sportGroup('hill_intervals'), 'run');
  assert.equal(sportGroup('strength_core'), 'strength');
});

test('Suunto pone lo medido aunque haya check-in manual, y conserva tu dolor y estrés', () => {
  mem.clear();
  const date = '2026-09-20';
  localStorage.setItem('uphill_coach_checkins', JSON.stringify([{ date, restingHr: 48, hrvRmssd: 55, hrvBaseline: 50, sleepHours: 7.5, sleepQuality: 80, muscleSoreness: 7, stressLevel: 9, status: 'optimal', coachAdvice: '' }]));
  StorageService.mergeSuuntoSync([], [{ date, restingHr: 47, hrvRmssd: 38, hrvBaseline: 45, sleepHours: 7.1, sleepQuality: 81, status: 'optimal', coachAdvice: 'x', source: 'suunto' }]);
  const ci = StorageService.getCheckIns().find((c) => c.date === date)!;
  assert.equal(ci.hrvRmssd, 38); // de Suunto, no el 55 manual
  assert.equal(ci.source, 'suunto');
  assert.equal(ci.muscleSoreness, 7);
  assert.equal(ci.stressLevel, 9);
  assert.equal(ci.status, 'fatigued'); // HRV −16 % + dolor 7 = ámbar, estrés 9 lo sube a rojo (antes quedaba el "óptimo" manual)
});

test('Cargar y quitar los datos de prueba no borra tus entrenos ni tus check-ins', () => {
  mem.clear();
  StorageService.saveWorkouts([{ id: 'suunto-real', suuntoWorkoutKey: 'real', date: '2026-09-01', title: 'Carrera real', type: 'easy_run', plannedDurationMin: 60, description: '', mainSet: '', completed: true, actualTss: 50 } as any]);
  localStorage.setItem('uphill_coach_checkins', JSON.stringify([
    { date: '2026-08-01', restingHr: 50, hrvRmssd: 44, hrvBaseline: 45, sleepHours: 7, sleepQuality: 80, status: 'optimal', coachAdvice: '', source: 'suunto' },
    { date: '2026-08-02', restingHr: 50, hrvRmssd: 40, hrvBaseline: 45, sleepHours: 6, sleepQuality: 70, status: 'moderate', coachAdvice: '' },
  ]));
  StorageService.loadFullTestData();
  assert.ok(StorageService.getWorkouts().some((w) => w.id === 'suunto-real'));
  assert.ok(StorageService.getCheckIns().some((c) => c.isSample));
  StorageService.clearOnlySampleData();
  assert.deepEqual(StorageService.getWorkouts().map((w) => w.id), ['suunto-real']);
  assert.deepEqual(StorageService.getCheckIns().map((c) => c.date).sort(), ['2026-08-01', '2026-08-02']);
});
