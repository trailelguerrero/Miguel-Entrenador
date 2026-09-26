/**
 * Plan hasta la carrera: esqueleto del macrociclo, ajuste semanal, fusión del plan,
 * topes del contrato, textos de Miguel sin cifras y plan automático del domingo.
 *   npm test
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import type { DailyCheckIn, MacrocyclePlan, TargetRace, Workout } from '../src/types/index.js';
import { adjustedWeekTarget, buildMacrocycle, describeWeekTarget, evaluateMarkers, MAX_LOAD_INCREASE, needsReplan } from '../src/brain/macrocycle.js';
import { mergePlanIntoWorkouts } from '../src/brain/planMerge.js';
import { validatePlanContract } from '../server/brain/decision/validate.js';
import { applyMacroTexts, inheritPhaseTexts } from '../server/brain/macroService.js';
import { buildPlanPrompt } from '../server/brain/prompts/routes.js';
import { MemoryDocStore, setDocStoreForTests } from '../server/store/docStore.js';
import { getSingleton, importFromBrowser, listWorkouts } from '../server/store/athleteData.js';
import { runWeeklyPlan } from '../server/weekly-plan-cron.js';

const RACE: TargetRace = { id: 'tv', name: 'Transvulcania', date: '2027-05-08', dateConfirmed: true, distanceKm: 73, elevationGainM: 4350, elevationLossM: 4057, priority: 'A', location: 'La Palma' } as TargetRace;
const W = (o: Partial<Workout> & { id: string; date: string }): Workout => ({ title: 'Rodaje', type: 'easy_run', plannedDurationMin: 60, completed: false, ...o }) as Workout;
const done = (date: string, min: number, gain = 0): Workout => W({ id: `d-${date}`, date, type: 'long_mountain_run', completed: true, actualDurationMin: min, actualElevationGainM: gain });

test('Macro: empieza el lunes siguiente, acaba en la semana de carrera con 2 de afinado y descargas cada 4', () => {
  const m = buildMacrocycle({ race: RACE, today: '2026-09-26', workouts: [] });
  const weeks = m.weeks!;
  assert.equal(m.startDate, '2026-09-28');
  assert.equal(weeks[weeks.length - 1].monday, '2027-05-03');
  assert.equal(weeks[weeks.length - 1].kind, 'race');
  assert.deepEqual(weeks.slice(-3, -1).map((w) => w.kind), ['taper', 'taper']);
  assert.ok(m.baseline!.conservative, 'sin datos → base conservadora');
  // Cada 4.ª semana de construcción es descarga (70 % de la carga previa)
  const build = weeks.filter((w) => w.phase !== 'peak_taper');
  build.forEach((w, i) => assert.equal(w.kind === 'recovery', (i + 1) % 4 === 0, `semana ${i + 1}`));
  // Entre semanas de carga consecutivas la subida no pasa del 8 %
  const loads = weeks.filter((w) => w.kind === 'load');
  for (let i = 1; i < loads.length; i++) assert.ok(loads[i].targetHours <= loads[i - 1].targetHours * (1 + MAX_LOAD_INCREASE) + 0.1, loads[i].monday);
  // Fases en orden y mesociclos contiguos
  assert.deepEqual(m.mesocycles.map((x) => x.phase), ['base_aerobic', 'muscular_endurance', 'mountain_specific', 'peak_taper']);
  for (let i = 1; i < m.mesocycles.length; i++) assert.ok(m.mesocycles[i].startDate > m.mesocycles[i - 1].endDate);
});

test('Macro: la carga de partida sale de lo que el atleta hizo de verdad', () => {
  const ws: Workout[] = [];
  for (let k = 1; k <= 6; k++) {
    const mon = new Date(Date.parse('2026-09-28') - k * 7 * 86400000).toISOString().slice(0, 10);
    ws.push(done(mon, 120, 300), done(new Date(Date.parse(mon) + 5 * 86400000).toISOString().slice(0, 10), 150, 600));
  }
  const m = buildMacrocycle({ race: RACE, today: '2026-09-26', workouts: ws });
  assert.equal(m.baseline!.conservative, false);
  assert.equal(m.baseline!.weeklyHours, 4.5);
  assert.equal(m.weeks![0].targetHours, 4.5);
});

test('Ajuste semanal: semana floja → descarga; semana a medias → se repite; carrera cambiada o semanas perdidas → rehacer', () => {
  const m = buildMacrocycle({ race: RACE, today: '2026-09-26', workouts: [] });
  const [w0, w1] = m.weeks!;
  // Semana 1 casi vacía (1 h de 4) → la 2 baja a descarga
  const low = adjustedWeekTarget(m, w1.monday, [done(w0.monday, 60)], []);
  assert.equal(low!.decision, 'reduce');
  assert.ok(low!.target.targetHours < w1.targetHours);
  // Al 70 % → se repite el objetivo anterior en vez de progresar
  const mid = adjustedWeekTarget(m, w1.monday, [done(w0.monday, Math.round(w0.targetHours * 60 * 0.7))], []);
  assert.equal(mid!.decision, 'hold');
  assert.equal(mid!.target.targetHours, w0.targetHours);
  // 3 días en rojo → descarga aunque se entrenase
  const red = ['2026-09-29', '2026-09-30', '2026-10-01'].map((date) => ({ date, status: 'fatigued' }) as DailyCheckIn);
  assert.equal(adjustedWeekTarget(m, w1.monday, [done(w0.monday, 300)], red)!.decision, 'reduce');
  assert.match(describeWeekTarget(low!, m), /TOPES/);
  // Dos semanas de carga por debajo de la mitad → re-planificar
  assert.match(needsReplan(m, [], [], '2026-10-14') ?? '', /por debajo de la mitad/);
});

test('Fusión del plan: no toca lo hecho ni Suunto, sustituye lo planificado y descarta días pasados', () => {
  const existing = [
    W({ id: 'hecho', date: '2026-09-22', completed: true }),
    W({ id: 'suunto-1', date: '2026-09-23', suuntoWorkoutKey: 'k' } as any),
    W({ id: 'viejo', date: '2026-09-24' }),
  ];
  const r = mergePlanIntoWorkouts(existing, [
    { date: '2026-09-22', title: 'pasado', type: 'easy_run' },
    { date: '2026-09-23', title: 'nuevo mié', type: 'easy_run' },
    { date: '2026-09-24', title: 'nuevo jue', type: 'easy_run' },
  ] as any, '2026-09-21', '2026-09-23', 1);
  assert.deepEqual(r.replacedIds, ['viejo']);
  assert.deepEqual(r.dropped, ['pasado']);
  assert.ok(r.workouts.some((w) => w.id === 'hecho') && r.workouts.some((w) => w.id === 'suunto-1'));
  assert.equal(r.added.length, 2);
});

const plan = (midMin: number, longMin: number, longGain: number) => [
  { date: '2026-09-29', title: 'mar', type: 'easy_run', plannedDurationMin: midMin },
  { date: '2026-09-30', title: 'mié', type: 'easy_run', plannedDurationMin: midMin },
  { date: '2026-10-01', title: 'jue', type: 'easy_run', plannedDurationMin: midMin },
  { date: '2026-10-03', title: 'larga', type: 'long_mountain_run', plannedDurationMin: longMin, plannedDistanceKm: 12, plannedElevationGainM: longGain },
];

test('Contrato: rechaza la semana que se pasa de los topes del macro', () => {
  const weekTarget = { targetHours: 4, targetElevationGainM: 400, longRunMin: 90 };
  assert.notEqual(validatePlanContract(plan(40, 100, 400), '2026-09-28', undefined, { weekTarget }).status, 'rejected');
  const over = validatePlanContract(plan(60, 180, 1200), '2026-09-28', undefined, { weekTarget });
  assert.equal(over.status, 'rejected');
  assert.ok(over.issues.some((i) => /tope del plan es 4 h/.test(i)));
  assert.ok(over.issues.some((i) => /tope del plan es 400 m/.test(i)));
  assert.ok(over.issues.some((i) => /tirada larga dura 180 min/.test(i)));
  assert.match(buildPlanPrompt({ weekStartDate: '2026-09-28', weekTargetText: 'OBJETIVOS DE LA SEMANA (TOPES…)' }), /PLAN HASTA LA CARRERA: ESTA SEMANA/);
});

test('Textos de Miguel: se descartan los que llevan cifras; al rehacer sin IA se conservan por fase', () => {
  const m = buildMacrocycle({ race: RACE, today: '2026-09-26', workouts: [] });
  const r = applyMacroTexts(m, {
    mesocycles: [
      { id: 'meso-1', focus: 'Construir motor aeróbico sin prisa', rationale: 'Rodajes a 130 ppm', keyWorkouts: ['Rodaje suave por senderos', 'Series de 4x5 min'] },
      { id: 'meso-99', focus: 'id inventado' },
    ],
  });
  const b = r.macro.mesocycles[0];
  assert.equal(b.focus, 'Construir motor aeróbico sin prisa');
  assert.equal(b.rationale, undefined);
  assert.deepEqual(b.keyWorkouts, ['Rodaje suave por senderos']);
  assert.equal(r.rejected, 2);
  const again = inheritPhaseTexts(buildMacrocycle({ race: RACE, today: '2026-10-12', workouts: [] }), r.macro);
  assert.equal(again.mesocycles[0].focus, 'Construir motor aeróbico sin prisa');
});

test('Marcadores: los evalúa el código con lo medido', () => {
  const m = buildMacrocycle({ race: RACE, today: '2026-09-26', workouts: [] });
  const me = m.mesocycles.find((x) => x.phase === 'muscular_endurance')!;
  const p = evaluateMarkers(me, [done(me.startDate, 150, 1100)], [{ date: me.startDate, muscleSoreness: 7 } as DailyCheckIn], {}, me.endDate);
  assert.equal(p.find((x) => x.marker.id === 'long_run_elevation')!.achieved, true);
  assert.equal(p.find((x) => x.marker.id === 'descent_tolerance')!.achieved, false);
});

// --- Plan automático del domingo (con almacén en memoria e IA falsa) ---
const prevCron = process.env.CRON_SECRET;
beforeEach(() => setDocStoreForTests(new MemoryDocStore()));
after(() => {
  setDocStoreForTests(null);
  if (prevCron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prevCron;
});

test('Domingo: crea el macro, planifica la semana siguiente dentro de los topes y no la rehace', async () => {
  await importFromBrowser({ profile: { name: 'A' } as any, targetRace: RACE, workouts: [], checkIns: [] });
  const fakeAi = async () => JSON.stringify({ weekSummary: 'Semana de base', workouts: plan(40, 100, 400) });
  const r = await runWeeklyPlan('2026-09-27', false, fakeAi);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.monday, '2026-09-28');
  const saved = await listWorkouts();
  assert.ok(saved.filter((w) => w.id.startsWith('gen-2026-')).length >= 4);
  const macro = await getSingleton<MacrocyclePlan>('macrocycle');
  assert.equal(macro!.raceDate, '2027-05-08');
  assert.ok(macro!.log!.some((l) => /He planificado la semana del 2026-09-28/.test(l.message)));
  // Segunda vez: ya hay plan → no se toca
  const again = await runWeeklyPlan('2026-09-27', false, fakeAi);
  assert.match(again.skipped ?? '', /ya está planificada/);
  // Plan que se pasa de los topes → no se guarda nada y queda aviso
  setDocStoreForTests(new MemoryDocStore());
  await importFromBrowser({ profile: { name: 'A' } as any, targetRace: RACE, workouts: [], checkIns: [] });
  const bad = await runWeeklyPlan('2026-09-27', false, async () => JSON.stringify({ weekSummary: 'x', workouts: plan(90, 240, 2000) }));
  assert.equal(bad.ok, false);
  assert.equal((await listWorkouts()).length, 0);
});
