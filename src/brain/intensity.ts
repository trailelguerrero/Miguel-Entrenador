/**
 * Jerarquía de prescripción de intensidad (formalizada en datos, no solo en el prompt).
 * LA VERDAD SON LAS PULSACIONES:
 *
 *   1. Umbral aeróbico por FC (zonas del reloj Suunto o fijado a mano) → prescripción en ppm
 *   2. Sin umbral                                                      → esfuerzo percibido / test del habla
 *   3. Sin datos                                                       → 'unknown': no se inventa nada
 *
 * ZoneSense NO prescribe: es un complemento para analizar entrenos hechos
 * (segunda opinión frente a la FC). La banda de pecho solo indica si la FC es
 * precisa (banda) o de muñeca (óptica).
 *
 * Un umbral de FC solo cuenta si es > 0 Y su origen es Suunto o el atleta lo fijó
 * a mano (profile.fieldSources). Nunca valores por defecto.
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
  /** Banda de pecho: sí, no o desconocido (desconocido ≠ sí). */
  chestStrap: 'yes' | 'no' | 'unknown';
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
 * @param hasChestStrap true/false si se sabe; si no se pasa, el del perfil. Solo
 *   indica la precisión de la FC; no cambia la fuente de intensidad.
 */
export function resolveIntensityPrescription(
  profile: Partial<AthleteProfile> | undefined,
  hasChestStrap: boolean | undefined = profile?.hasChestStrap,
): IntensityPrescription {
  const aetHr = measured(profile, 'aetHr');
  const antHr = measured(profile, 'antHr');
  const maxHr = measured(profile, 'maxHr');
  const missing: string[] = [];
  if (aetHr == null) missing.push('umbral aeróbico por FC (zonas de FC del reloj Suunto o fijado a mano)');
  if (antHr == null) missing.push('umbral anaeróbico por FC');
  if (maxHr == null) missing.push(isFormulaMaxHr(profile) ? 'FC máxima medida (la del reloj es 220 − edad)' : 'FC máxima medida');

  const hrAllowed = aetHr != null;
  const primary: IntensitySource = hrAllowed ? 'heart_rate_measured' : 'rpe';
  return { primary, hrAllowed, aetHr, antHr, maxHr, missing, chestStrap: hasChestStrap === undefined ? 'unknown' : hasChestStrap ? 'yes' : 'no' };
}

/** De dónde sale el umbral aeróbico (para decírselo al atleta). */
export function aetOrigin(profile: Partial<AthleteProfile> | undefined): string {
  const src = profile?.fieldSources?.aetHr;
  return src === 'manual' ? 'fijado por ti' : src === 'suunto' ? 'zonas de FC de tu reloj Suunto' : 'sin origen';
}

/** Texto para los prompts de Miguel. */
export function describeIntensityPrescription(p: IntensityPrescription, profile?: Partial<AthleteProfile>): string {
  const lines = [
    p.hrAllowed
      ? `Fuente de intensidad: PULSACIONES. [REAL] Umbral aeróbico (AeT) ${p.aetHr} ppm${p.antHr ? `, anaeróbico (AnT) ${p.antHr} ppm` : ''}${profile ? ` (${aetOrigin(profile)})` : ''}. Prescribe SIEMPRE en ppm (targetHrMin/targetHrMax): rodajes y tiradas largas por debajo del AeT; la intensidad, entre AeT y AnT o por encima según la sesión.`
      : 'Fuente de intensidad: esfuerzo percibido / test del habla. NO hay umbral de FC: targetHrMin y targetHrMax deben ser null; no inventes pulsaciones y di que falta el umbral (zonas de FC del reloj Suunto o fijarlo a mano).',
    'ZoneSense NO se usa para prescribir: no des objetivos en colores. Solo sirve para contrastar después un entreno hecho.',
    p.chestStrap === 'yes' ? 'FC medida con banda de pecho (precisa).' : p.chestStrap === 'no' ? 'FC de muñeca (óptica): puede ir con retraso en los cambios de ritmo y en frío.' : '',
  ].filter(Boolean);
  if (p.missing.length) lines.push(`Datos que faltan: ${p.missing.join(', ')}.`);
  return lines.join('\n');
}

/** Umbral anaeróbico MEDIDO (Suunto o manual) para estimar hrTSS; undefined si no hay (nunca un valor por defecto). */
export function measuredAntHr(profile: Partial<AthleteProfile> | undefined): number | undefined {
  return measured(profile, 'antHr') ?? undefined;
}
