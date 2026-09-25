/**
 * Fichas de carrera: "sin fuente = sin verificar" (fase 3).
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SearchResult } from '../server/ai.js';
import { dateAppears, numberAppears, verifyRaceInfo } from '../server/brain/decision/race.js';

const search: SearchResult = {
  text: '...',
  sources: [
    { title: 'Web oficial', uri: 'https://ejemplo-oficial.test' },
    { title: 'Blog', uri: 'https://blog.test' },
  ],
  segments: [
    { text: 'La Ultra del Ejemplo tiene 45,5 km y 2.850 m de desnivel positivo.', sourceIdx: [0] },
    { text: 'Se celebra el 16 de mayo de 2027 con salida en Villaejemplo.', sourceIdx: [0] },
    { text: 'Terreno volcánico y pistas de tierra.', sourceIdx: [1] },
  ],
  queries: ['ultra del ejemplo'],
};

test('Cifras: 2.850 / 2,850 / 2850 y decimales con coma', () => {
  assert.ok(numberAppears(2850, 'desnivel de 2.850 m'));
  assert.ok(numberAppears(2850, 'desnivel de 2,850 m'));
  assert.ok(numberAppears(45.5, 'tiene 45,5 km'));
  assert.ok(!numberAppears(285, 'desnivel de 2.850 m'));
  assert.ok(!numberAppears(0, '0 km'));
});

test('Fechas: exige año, día y mes', () => {
  assert.ok(dateAppears('2027-05-16', 'el 16 de mayo de 2027'));
  assert.ok(!dateAppears('2027-05-17', 'el 16 de mayo de 2027'));
  assert.ok(!dateAppears('2027-06-16', 'el 16 de mayo de 2027'));
});

test('10. Carrera desconocida: sin fuente = sin verificar (null), aunque la IA lo afirme', () => {
  const v = verifyRaceInfo(
    {
      name: { value: 'Ultra del Ejemplo', sources: [0] },
      date: { value: '2027-05-16', sources: [0] },
      location: { value: 'Villaejemplo', sources: [0] },
      distanceKm: { value: 45.5, sources: [0] },
      elevationGainM: { value: 2850, sources: [0] },
      elevationLossM: { value: 2900, sources: [0] }, // inventado: no aparece en ninguna fuente
      altitudeRange: { value: '200 - 2400', sources: [] }, // sin fuente citada
      terrainDescription: { value: 'Terreno volcánico', sources: [5] }, // índice inexistente
    },
    search,
  );
  assert.equal(v.fields.distanceKm?.value, 45.5);
  assert.equal(v.fields.elevationGainM?.value, 2850);
  assert.equal(v.fields.date?.value, '2027-05-16');
  assert.equal(v.fields.location?.value, 'Villaejemplo');
  assert.equal(v.fields.elevationGainM?.sources[0].uri, 'https://ejemplo-oficial.test');
  for (const f of ['elevationLossM', 'altitudeRange', 'terrainDescription'] as const) {
    assert.equal(v.fields[f], undefined, f);
    assert.ok(v.unverified.includes(f), f);
  }
  assert.deepEqual(v.sources.map((s) => s.title), ['Web oficial']);
});

test('Una cifra citando una página que no la respalda no vale', () => {
  const v = verifyRaceInfo({ elevationGainM: { value: 2850, sources: [1] } }, search);
  assert.equal(v.fields.elevationGainM, undefined);
});

test('Sin búsqueda con fuentes, todo queda sin verificar', () => {
  const v = verifyRaceInfo({ distanceKm: { value: 73, sources: [0] } }, { text: '73 km', sources: [], segments: [], queries: [] });
  assert.deepEqual(v.fields, {});
  assert.equal(v.unverified.length, 8);
});

test('Historial .md: una cifra que no está escrita en el documento se anula', async () => {
  const { verifyHistoryNumbers } = await import('../server/brain/decision/history.js');
  const md = 'Mi FC máxima es 185 lpm y el umbral aeróbico 145. Hago unos 50 km a la semana.';
  const r = verifyHistoryNumbers(
    { summary: { maxHr: 185, aetHr: 145, antHr: 168, weeklyVolumeKm: 50 }, extractedProfileUpdates: { maxHr: 185, restingHr: 48 } },
    md,
  );
  assert.equal(r.parsed.summary.maxHr, 185);
  assert.equal(r.parsed.summary.aetHr, 145);
  assert.equal(r.parsed.summary.antHr, null); // inventado
  assert.equal(r.parsed.extractedProfileUpdates.restingHr, null); // inventado
  assert.deepEqual(r.removed.sort(), ['profile.restingHr=48', 'summary.antHr=168']);
});
