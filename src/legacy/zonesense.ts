/**
 * CAPA DE COMPATIBILIDAD (legado). Aquí vive lo que solo sirve para leer datos
 * guardados por versiones anteriores de la app: objetivos DFA a1 y textos
 * antiguos de ZoneSense. REGLA: ningún módulo de src/brain importa de src/legacy
 * (lo comprueba tests/audit6.test.ts). El cerebro trabaja solo con tipos actuales.
 */
import type { ZoneSenseTarget } from '../types';
import { ZONESENSE_TARGETS } from '../brain/zonesense';

/** Objetivos de intensidad de versiones antiguas (DFA a1): solo para leer sesiones guardadas. */
export type LegacyZoneSenseTarget =
  | 'DFA a1 > 0.75 (Aeróbico puro)'
  | 'DFA a1 0.75 - 0.50 (Transición)'
  | 'DFA a1 < 0.50 (Anaeróbico)'
  | 'Regenerativo';

// Textos antiguos guardados en sesiones de versiones previas: se traducen a color
// y nunca se muestran.
const LEGACY_MAP: Record<LegacyZoneSenseTarget, ZoneSenseTarget> = {
  'DFA a1 > 0.75 (Aeróbico puro)': 'ZoneSense verde (aeróbico)',
  'DFA a1 0.75 - 0.50 (Transición)': 'ZoneSense amarillo (entre umbrales)',
  'DFA a1 < 0.50 (Anaeróbico)': 'ZoneSense rojo (sobre umbral anaeróbico)',
  Regenerativo: 'Regenerativo (verde, muy suave)',
};

/** Normaliza cualquier objetivo (actual, antiguo o texto libre de la IA) a un objetivo canónico. */
export function normalizeZoneSenseTarget(t: string | undefined | null): ZoneSenseTarget | undefined {
  if (!t) return undefined;
  if ((ZONESENSE_TARGETS as string[]).includes(t)) return t as ZoneSenseTarget;
  if (t in LEGACY_MAP) return LEGACY_MAP[t as LegacyZoneSenseTarget];
  const l = t.toLowerCase();
  if (l.includes('regenerativo')) return 'Regenerativo (verde, muy suave)';
  if (l.includes('rojo') || l.includes('vo2') || l.includes('sobre umbral anaer')) return 'ZoneSense rojo (sobre umbral anaeróbico)';
  if (l.includes('amarillo') || l.includes('entre umbrales') || l.includes('transición')) return 'ZoneSense amarillo (entre umbrales)';
  if (l.includes('verde') || l.includes('aeróbico')) return 'ZoneSense verde (aeróbico)';
  return undefined;
}

/** Texto del objetivo de intensidad. Sin pulsaciones: ZoneSense no se corresponde con una FC. */
export function describeZoneSenseTarget(t: string | undefined | null): string {
  const n = normalizeZoneSenseTarget(t);
  if (!n) return t || '';
  switch (n) {
    case 'ZoneSense verde (aeróbico)':
      return 'ZoneSense en verde (aeróbico) toda la sesión';
    case 'Regenerativo (verde, muy suave)':
      return 'Regenerativo: verde y muy cómodo, lejos del amarillo';
    case 'ZoneSense amarillo (entre umbrales)':
      return 'ZoneSense en amarillo (entre umbral aeróbico y anaeróbico) en los bloques de trabajo';
    case 'ZoneSense rojo (sobre umbral anaeróbico)':
      return 'ZoneSense en rojo (sobre el umbral anaeróbico) solo en los bloques de trabajo';
  }
}

