/**
 * Suunto ZoneSense
 *
 * ZoneSense mide la intensidad con DDFA (análisis de fluctuaciones sin
 * tendencia dinámico) sobre los intervalos R-R de la banda de pecho. Las zonas
 * (verde = aeróbico, amarillo = entre umbrales, rojo = sobre el umbral
 * anaeróbico) se evalúan como desplazamiento respecto a la línea base aeróbica
 * de CADA entreno (se fija en los ~10 primeros minutos suaves).
 *
 * Por eso NO equivalen a ninguna frecuencia cardíaca concreta: la misma FC
 * puede caer en verde un día y en amarillo otro (fatiga, calor, cafeína,
 * altitud) o en otro deporte. Esta app nunca traduce los colores de
 * ZoneSense a pulsaciones.
 */
import type { LegacyZoneSenseTarget, ZoneSenseTarget } from '../types';

export const ZONESENSE_TARGETS: ZoneSenseTarget[] = [
  'ZoneSense verde (aeróbico)',
  'Regenerativo (verde, muy suave)',
  'ZoneSense amarillo (entre umbrales)',
  'ZoneSense rojo (sobre umbral anaeróbico)',
];

const LEGACY_MAP: Record<LegacyZoneSenseTarget, ZoneSenseTarget> = {
  'DFA a1 > 0.75 (Aeróbico puro)': 'ZoneSense verde (aeróbico)',
  'DFA a1 0.75 - 0.50 (Transición)': 'ZoneSense amarillo (entre umbrales)',
  'DFA a1 < 0.50 (Anaeróbico)': 'ZoneSense rojo (sobre umbral anaeróbico)',
  Regenerativo: 'Regenerativo (verde, muy suave)',
};

/** Normaliza objetivos antiguos ("DFA a1 > 0.75…") al color de ZoneSense. */
export function normalizeZoneSenseTarget(t: string | undefined): ZoneSenseTarget | undefined {
  if (!t) return undefined;
  if ((ZONESENSE_TARGETS as string[]).includes(t)) return t as ZoneSenseTarget;
  if (t in LEGACY_MAP) return LEGACY_MAP[t as LegacyZoneSenseTarget];
  const l = t.toLowerCase();
  if (l.includes('regenerativo')) return 'Regenerativo (verde, muy suave)';
  if (l.includes('< 0.50') || l.includes('rojo') || l.includes('anaeróbico)')) return 'ZoneSense rojo (sobre umbral anaeróbico)';
  if (l.includes('0.50') || l.includes('amarillo') || l.includes('transición')) return 'ZoneSense amarillo (entre umbrales)';
  if (l.includes('0.75') || l.includes('verde') || l.includes('aeróbico')) return 'ZoneSense verde (aeróbico)';
  return undefined;
}

/** Texto del objetivo de intensidad. Sin pulsaciones: ZoneSense no se corresponde con una FC. */
export function describeZoneSenseTarget(t: string | undefined): string {
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
