/**
 * Jerarquía de prescripción de intensidad (formalizada en datos, no solo en el prompt):
 *
 *   1. Con banda de pecho            → ZoneSense (colores) = fuente principal
 *   2. Sin ZoneSense, umbral medido  → zonas de FC del reloj (respaldo)
 *   3. Sin FC fiable                 → esfuerzo percibido (RPE) / test del habla / terreno
 *   4. Sin datos                     → 'unknown': no se inventa nada
 *
 * Un umbral de FC solo cuenta como "medido" si es > 0 Y su origen es Suunto o
 * el atleta lo fijó a mano (profile.fieldSources). Nunca valores por defecto.
 */
import type { AthleteProfile, IntensitySource } from '../types';

export type { IntensitySource };

export interface IntensityPrescription {
  /** Fuente principal a usar en la prescripción. */
  primary: IntensitySource;
  /** Se pueden dar topes de FC (umbral aeróbico medido). */
  hrAllowed: boolean;
  aetHr: number | null;
  antHr: number | null;
  maxHr: number | null;
  /** Qué falta, para decírselo al atleta en vez de suponerlo. */
  missing: string[];
}

type Measurable = 'aetHr' | 'antHr' | 'maxHr';

/** ¿La FC máx coincide con la fórmula 220 − edad? Entonces no es medida (típico valor de fábrica del reloj). */
export function isFormulaMaxHr(profile: Partial<AthleteProfile> | undefined): boolean {
  const age = profile?.age;
  const max = profile?.maxHr;
  return typeof age === 'number' && age > 0 && typeof max === 'number' && max > 0 && Math.abs(max - (220 - age)) <= 1;
}

function measured(profile: Partial<AthleteProfile> | undefined, field: Measurable): number | null {
  const v = profile?.[field];
  if (typeof v !== 'number' || !(v > 0)) return null;
  const src = profile?.fieldSources?.[field];
  // La FC máx de Suunto que es justo 220 − edad es la fórmula, no una medida (si la fijas a mano, vale)
  if (field === 'maxHr' && src === 'suunto' && isFormulaMaxHr(profile)) return null;
  return src === 'suunto' || src === 'manual' ? v : null;
}

/**
 * @param hasChestStrap true/false si se sabe; undefined si no se sabe (se
 *   asume que puede usar ZoneSense pero se añade la FC como respaldo si existe).
 */
export function resolveIntensityPrescription(
  profile: Partial<AthleteProfile> | undefined,
  hasChestStrap?: boolean,
): IntensityPrescription {
  const aetHr = measured(profile, 'aetHr');
  const antHr = measured(profile, 'antHr');
  const maxHr = measured(profile, 'maxHr');
  const missing: string[] = [];
  if (aetHr == null) missing.push('umbral aeróbico por FC medido');
  if (antHr == null) missing.push('umbral anaeróbico por FC medido');
  if (maxHr == null) missing.push(isFormulaMaxHr(profile) ? 'FC máxima medida (la del reloj es 220 − edad)' : 'FC máxima medida');

  const hrAllowed = aetHr != null;
  let primary: IntensitySource;
  if (hasChestStrap !== false) primary = 'zonesense';
  else if (hrAllowed) primary = 'heart_rate_measured';
  else primary = 'rpe';

  return { primary, hrAllowed, aetHr, antHr, maxHr, missing };
}

/** Texto para los prompts de Miguel. */
export function describeIntensityPrescription(p: IntensityPrescription): string {
  const lines = [
    `Fuente principal de intensidad: ${p.primary === 'zonesense' ? 'ZoneSense (con banda de pecho)' : p.primary === 'heart_rate_measured' ? 'zonas de FC del reloj (umbral medido)' : 'esfuerzo percibido / test del habla / terreno'}.`,
    p.hrAllowed
      ? `Respaldo por FC permitido (sin banda): [REAL] umbral aeróbico medido ${p.aetHr} ppm${p.antHr ? `, anaeróbico ${p.antHr} ppm` : ''}.`
      : 'NO hay umbral de FC medido: targetHrMin y targetHrMax deben ser null; no des pulsaciones.',
  ];
  if (p.missing.length) lines.push(`Datos que faltan: ${p.missing.join(', ')}.`);
  return lines.join('\n');
}
