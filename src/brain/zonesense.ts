/**
 * FUENTE ÚNICA de todo lo relativo a Suunto ZoneSense (UI, mapeo Suunto,
 * prompts de Miguel, validación y documentación deben usar esto).
 *
 * ZoneSense mide la intensidad con DDFA (análisis de fluctuaciones sin
 * tendencia DINÁMICO, Universidad de Tampere / MoniCardi) sobre los intervalos
 * R-R de la banda de pecho. Clasifica la intensidad en colores respecto a la
 * línea base aeróbica que el reloj fija en los ~10 primeros minutos suaves de
 * CADA entreno:
 *   - verde    = aeróbico (bajo el umbral aeróbico de ese día)
 *   - amarillo = entre umbral aeróbico y anaeróbico de ese día
 *   - rojo     = sobre el umbral anaeróbico (zona VO2máx)
 *
 * NO es el DFA a1 clásico con cortes fijos y NO equivale a ninguna frecuencia
 * cardíaca concreta. Nunca se traduce a pulsaciones.
 */
import type { LegacyZoneSenseTarget, ZoneSenseTarget } from '../types';

export type ZoneSenseColor = 'green' | 'yellow' | 'red';

export const ZONESENSE_TARGETS: ZoneSenseTarget[] = [
  'ZoneSense verde (aeróbico)',
  'Regenerativo (verde, muy suave)',
  'ZoneSense amarillo (entre umbrales)',
  'ZoneSense rojo (sobre umbral anaeróbico)',
];

/** Color máximo que implica cada objetivo de sesión. */
export const TARGET_COLOR: Record<ZoneSenseTarget, ZoneSenseColor> = {
  'ZoneSense verde (aeróbico)': 'green',
  'Regenerativo (verde, muy suave)': 'green',
  'ZoneSense amarillo (entre umbrales)': 'yellow',
  'ZoneSense rojo (sobre umbral anaeróbico)': 'red',
};

const COLOR_RANK: Record<ZoneSenseColor, number> = { green: 0, yellow: 1, red: 2 };
export const colorRank = (c: ZoneSenseColor) => COLOR_RANK[c];

// Compatibilidad: textos antiguos guardados en sesiones de versiones previas.
// Es el ÚNICO sitio (junto con el tipo LegacyZoneSenseTarget) donde pueden
// aparecer; se traducen a color y nunca se muestran.
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

/** Tiempo en zonas ZoneSense de un entreno, en forma canónica (verde/amarillo/rojo). */
export interface CanonicalZoneSense {
  greenMs: number;
  yellowMs: number;
  redMs: number;
  greenPct: number;
  yellowPct: number;
  redPct: number;
}

/** Campos crudos que devuelve el MCP de Suunto (suunto_list_workouts_summary). */
export interface SuuntoRawZoneSense {
  timeInAerobicZoneMs?: number | null; // Suunto "Aerobic zone"   → verde
  timeInAnaerobicZoneMs?: number | null; // Suunto "Anaerobic zone" → amarillo (entre umbrales)
  timeInVo2MaxZoneMs?: number | null; // Suunto "VO2max zone"    → rojo (sobre umbral anaeróbico)
}

/**
 * Traducción EXPLÍCITA de los nombres de Suunto a los colores de ZoneSense.
 * Ojo: la "Anaerobic zone" de Suunto es el AMARILLO (entre umbrales), no el
 * rojo; el rojo es la "VO2max zone". Devuelve null si el entreno no trae ZoneSense.
 */
export function normalizeSuuntoZoneSense(raw: SuuntoRawZoneSense): CanonicalZoneSense | null {
  const greenMs = raw.timeInAerobicZoneMs ?? 0;
  const yellowMs = raw.timeInAnaerobicZoneMs ?? 0;
  const redMs = raw.timeInVo2MaxZoneMs ?? 0;
  const total = greenMs + yellowMs + redMs;
  if (total <= 0) return null;
  const pct = (v: number) => Math.round((v / total) * 100);
  return { greenMs, yellowMs, redMs, greenPct: pct(greenMs), yellowPct: pct(yellowMs), redPct: pct(redMs) };
}

/**
 * Forma guardada en Workout.zoneSenseBreakdown (se mantiene por compatibilidad):
 * aerobicPct = verde, transitionPct = amarillo, anaerobicPct = rojo.
 */
export function toStoredBreakdown(
  z: CanonicalZoneSense,
  totalDurationSec?: number | null,
): { aerobicPct: number; transitionPct: number; anaerobicPct: number; measuredPct?: number } {
  const out = { aerobicPct: z.greenPct, transitionPct: z.yellowPct, anaerobicPct: z.redPct };
  if (!totalDurationSec || totalDurationSec <= 0) return out;
  const measured = (z.greenMs + z.yellowMs + z.redMs) / 1000;
  return { ...out, measuredPct: Math.min(100, Math.round((measured / totalDurationSec) * 100)) };
}

/** Por debajo de este % medido, el reparto de colores no representa la sesión. */
export const ZONESENSE_MIN_MEASURED_PCT = 50;

/** ¿El reparto cubre lo bastante de la sesión para sacar conclusiones? (sin dato de cobertura: sí, por compatibilidad) */
export const breakdownIsReliable = (b: { measuredPct?: number } | null | undefined) =>
  !!b && (b.measuredPct == null || b.measuredPct >= ZONESENSE_MIN_MEASURED_PCT);

/** Texto de un reparto guardado, siempre en colores y sin pulsaciones. */
export function describeBreakdown(b: { aerobicPct: number; transitionPct: number; anaerobicPct: number; measuredPct?: number }): string {
  const base = `verde ${b.aerobicPct}% · amarillo ${b.transitionPct}% · rojo ${b.anaerobicPct}%`;
  if (b.measuredPct == null) return base;
  return `${base} (sobre el ${b.measuredPct}% de la sesión que ZoneSense midió${b.measuredPct < ZONESENSE_MIN_MEASURED_PCT ? ': poco representativo, no saques conclusiones' : ''})`;
}

/** Reglas de ZoneSense para los prompts de Miguel (mismo contenido que arriba). */
export const ZONESENSE_PROMPT_RULES = `SUUNTO ZONESENSE (CÓMO FUNCIONA Y CÓMO USARLO):
- ZoneSense mide la intensidad con DDFA (análisis de fluctuaciones sin tendencia DINÁMICO) sobre los intervalos R-R de la banda de pecho (Universidad de Tampere / MoniCardi). No es el índice clásico de cortes fijos: nunca hables de "valores" de ZoneSense ni de cortes numéricos; el reloj muestra colores.
- Colores: VERDE = aeróbico (bajo el umbral aeróbico de ese día); AMARILLO = entre umbral aeróbico y anaeróbico; ROJO = por encima del umbral anaeróbico (zona VO2máx).
- REGLA CARDINAL: los colores de ZoneSense NO equivalen a ninguna frecuencia cardíaca concreta. Se evalúan contra la línea base aeróbica que el reloj fija en los primeros ~10 minutos suaves de CADA entreno. La misma FC puede ser verde un día y amarilla otro (fatiga, calor, cafeína, altitud) o en otro deporte. NUNCA traduzcas un color a pulsaciones.
- Jerarquía de intensidad: 1) con banda de pecho, ZoneSense es la referencia principal; 2) sin banda, las zonas de FC del reloj SOLO si el umbral está medido (te lo indicamos en los datos); 3) sin FC fiable, esfuerzo percibido / test del habla / terreno; 4) sin datos suficientes, dilo y no inventes.
- Requisitos y límites: banda de pecho obligatoria; ~10 min de calentamiento suave para fijar la línea base; retraso de 1-2 min, así que sirve para esfuerzos continuos, no para series cortas ni fuerza.
- En esfuerzos largos a ritmo constante es normal que tienda hacia el amarillo con las horas (sensible a la duración y a la fatiga): es una señal para aflojar o caminar, no un error.
- Base aeróbica: la inmensa mayoría del tiempo debe estar en VERDE según el tiempo en zonas que registra Suunto.`;
