/**
 * Planificación: qué semana planifica el botón, semana en curso en el contrato y
 * tarjeta de recuperación cuando la sesión de hoy ya está hecha.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planningWindow, shortDayMonth } from '../src/utils/weekStructure.js';
import { validatePlanContract } from '../server/brain/decision/validate.js';
import { buildPlanPrompt } from '../server/brain/prompts/routes.js';
import { recoveryAdvice } from '../src/components/MorningBanner.js';

test('Sábado (y viernes/domingo) → la semana SIGUIENTE entera', () => {
  assert.deepEqual(planningWindow('2026-09-26'), { monday: '2026-09-28', fromDate: '2026-09-28', sunday: '2026-10-04' });
  assert.equal(planningWindow('2026-09-25').monday, '2026-09-28');
  assert.equal(planningWindow('2026-09-27').monday, '2026-09-28');
  assert.equal(shortDayMonth('2026-09-28'), '28 sept');
});

test('Lunes a jueves → los días que quedan de la semana en curso', () => {
  assert.deepEqual(planningWindow('2026-09-23'), { monday: '2026-09-21', fromDate: '2026-09-23', sunday: '2026-09-27' });
  assert.deepEqual(planningWindow('2026-09-21'), { monday: '2026-09-21', fromDate: '2026-09-21', sunday: '2026-09-27' });
});

const run = (date: string) => ({ date, title: `s ${date}`, type: 'easy_run', plannedDurationMin: 50 });
const long = (date: string) => ({ date, title: 'larga', type: 'long_mountain_run', plannedDurationMin: 180, plannedDistanceKm: 22, plannedElevationGainM: 1200 });

test('Semana en curso: se descartan los días pasados y cuenta lo ya hecho', () => {
  // Miércoles: ya hizo lunes y martes; Miguel solo debe planificar mié–dom
  const plan = [run('2026-09-21'), run('2026-09-23'), long('2026-09-26')];
  const r = validatePlanContract(plan, '2026-09-21', undefined, {
    fromDate: '2026-09-23',
    done: [{ date: '2026-09-21', type: 'easy_run' }, { date: '2026-09-22', type: 'easy_run' }],
  });
  assert.equal(r.status, 'repaired');
  assert.ok(r.workouts.every((w) => w.date >= '2026-09-23'));
  assert.ok(r.repairs.some((x) => /ya ha pasado/.test(x)));
  // Sin lo hecho, 1 sesión entre semana no llega al mínimo
  assert.equal(validatePlanContract([run('2026-09-23'), long('2026-09-26')], '2026-09-21', undefined, { fromDate: '2026-09-23' }).status, 'rejected');
});

test('El prompt dice qué días planificar cuando la semana está en curso', () => {
  const p = buildPlanPrompt({ weekStartDate: '2026-09-21', planFromDate: '2026-09-23' });
  assert.match(p, /YA ESTÁ EN CURSO: planifica SOLO los días desde el 2026-09-23/);
  assert.match(buildPlanPrompt({ weekStartDate: '2026-09-28', planFromDate: '2026-09-28' }), /7 días \(comenzando el lunes 2026-09-28\)/);
});

test('Sesión hecha: pauta de recuperación sin cifras ni botón de adaptar', () => {
  assert.match(recoveryAdvice('fatigued'), /nada más de entrenamiento/);
  assert.doesNotMatch(recoveryAdvice('fatigued'), /\d/);
  assert.match(recoveryAdvice(undefined), /check-in/);
});
