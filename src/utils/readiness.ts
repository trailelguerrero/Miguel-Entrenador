import type { DailyCheckIn } from '../types/index.js';
import { evaluateReadiness } from '../brain/readiness.js';

// Semáforo diario (verde/ámbar/rojo). La decisión la toma el motor único de
// readiness (src/brain/readiness.ts); esto solo lo traduce al formato del
// check-in. La puntuación numérica NO se calcula aquí: es el Recovery de
// Suunto del día (DailyCheckIn.readinessScore).
// Lo usan el check-in manual (DailyReadinessModal) y la sincronización con
// Suunto (server/suunto-map.ts), para que ambos den el mismo semáforo.
export function computeReadiness(input: {
  hrvRmssd: number;
  hrvBaseline: number;
  sleepHours: number;
  muscleSoreness?: number;
  /** Estrés vital declarado (1-10): ≥ 8 sube un nivel, igual que en el motor. */
  stressLevel?: number;
}): Pick<DailyCheckIn, 'status' | 'coachAdvice' | 'suggestedAction'> & { hrvDropPct: number } {
  const state = evaluateReadiness(input);
  const hrvDropPct = state.hrvDeltaPct ?? 0;
  const why = state.reasons.join(', ');

  if (state.level === 'red') {
    return {
      hrvDropPct,
      status: 'fatigued',
      suggestedAction: state.limits.mandatoryRest ? 'full_rest' : 'downgrade_easy',
      coachAdvice: state.limits.mandatoryRest
        ? `Alerta de fatiga (${why}). Hoy toca descanso total.`
        : `Alerta de fatiga (${why}). Hoy nada de series ni tirada dura: descanso o como mucho ${state.limits.maxDurationMin}' regenerativos, con la FC al menos 10 ppm por debajo de tu umbral aeróbico.`,
    };
  }
  if (state.level === 'amber') {
    return {
      hrvDropPct,
      status: 'moderate',
      suggestedAction: 'maintain',
      coachAdvice: `Recuperación intermedia (${why}). Puedes entrenar sin series, con la FC por debajo de tu umbral aeróbico.`,
    };
  }
  if (state.level === 'unknown') {
    // Sin datos NO es verde: no se puede valorar la recuperación de hoy
    return {
      hrvDropPct,
      status: 'unknown',
      suggestedAction: 'maintain',
      coachAdvice: 'Sin datos de HRV ni de sueño: no se puede valorar la recuperación de hoy.',
    };
  }
  return {
    hrvDropPct,
    status: 'optimal',
    suggestedAction: 'maintain',
    coachAdvice: 'Recuperación buena: listo para la sesión programada de hoy.',
  };
}

/**
 * Versión del motor que calculó el estado derivado de un check-in. Súbela cuando
 * cambien los cortes de src/brain/readiness.ts: lo guardado con otra versión es caché
 * obsoleta (igualmente, al LEER siempre se recalcula con deriveCheckIn).
 */
export const READINESS_ENGINE_VERSION = 'readiness-v3';

/**
 * El check-in guarda DATOS CRUDOS (HRV, sueño, dolor, estrés, Recovery de Suunto).
 * status / coachAdvice / suggestedAction son DERIVADOS: se recalculan aquí con el
 * motor actual cada vez que se leen, para que el historial y el chat no usen un
 * semáforo calculado con reglas o una referencia de HRV antiguas.
 * Referencia de HRV: en los de Suunto, la del perfil (la misma que usa el cerebro);
 * en los manuales, la que declaró el atleta en ese check-in.
 */
export function deriveCheckIn(ci: DailyCheckIn, profileBaseline?: number | null): DailyCheckIn {
  const hrvBaseline = ci.source === 'suunto' && typeof profileBaseline === 'number' && profileBaseline > 0 ? profileBaseline : ci.hrvBaseline;
  const r = computeReadiness({
    hrvRmssd: ci.hrvRmssd,
    hrvBaseline,
    sleepHours: ci.sleepHours,
    muscleSoreness: ci.muscleSoreness,
    stressLevel: ci.stressLevel,
  });
  const balance = ci.readinessScore != null ? ` Recovery Suunto del día: ${ci.readinessScore}%.` : '';
  return {
    ...ci,
    hrvBaseline,
    status: r.status,
    suggestedAction: r.suggestedAction,
    coachAdvice:
      ci.source === 'suunto'
        ? `${r.coachAdvice} (Datos de Suunto: sueño ${ci.sleepHours} h, HRV ${ci.hrvRmssd} ms vs referencia ${hrvBaseline} ms.${balance})`
        : r.coachAdvice,
    derivedEngineVersion: READINESS_ENGINE_VERSION,
  };
}

/** Recalcula un check-in de Suunto contra la HRV de referencia del perfil (los manuales no cambian). */
export function rebaseSuuntoCheckIn(ci: DailyCheckIn, profileBaseline: number): DailyCheckIn {
  return ci.source === 'suunto' ? deriveCheckIn(ci, profileBaseline) : ci;
}
