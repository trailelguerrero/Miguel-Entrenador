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
        : `Alerta de fatiga (${why}). Hoy nada de series ni tirada dura: descanso o como mucho ${state.limits.maxDurationMin}' regenerativos en ZoneSense verde.`,
    };
  }
  if (state.level === 'amber') {
    return {
      hrvDropPct,
      status: 'moderate',
      suggestedAction: 'maintain',
      coachAdvice: `Recuperación intermedia (${why}). Puedes entrenar sin series: con banda de pecho, mantén ZoneSense en verde.`,
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
 * Recalcula un check-in de Suunto contra la HRV de referencia del perfil, para
 * que el semáforo, las gráficas y la ficha usen siempre la MISMA referencia.
 */
export function rebaseSuuntoCheckIn(ci: DailyCheckIn, hrvBaseline: number): DailyCheckIn {
  if (!(hrvBaseline > 0) || ci.source !== 'suunto') return ci;
  const r = computeReadiness({ hrvRmssd: ci.hrvRmssd, hrvBaseline, sleepHours: ci.sleepHours, muscleSoreness: ci.muscleSoreness, stressLevel: ci.stressLevel });
  const balance = ci.coachAdvice.match(/ Recovery Suunto del día: \d+%\./)?.[0] ?? '';
  return {
    ...ci,
    hrvBaseline,
    status: r.status,
    suggestedAction: r.suggestedAction,
    coachAdvice: `${r.coachAdvice} (Datos de Suunto: sueño ${ci.sleepHours} h, HRV ${ci.hrvRmssd} ms vs referencia ${hrvBaseline} ms.${balance})`,
  };
}
