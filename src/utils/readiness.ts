import { DailyCheckIn } from '../types';

// Semáforo diario (verde/ámbar/rojo) a partir de HRV, sueño y dolor muscular.
// La puntuación numérica NO se calcula aquí: es el Recovery de Suunto del día
// (DailyCheckIn.readinessScore), que solo existe si viene de Suunto.
// Lo usan el check-in manual (DailyReadinessModal) y la sincronización con
// Suunto (server/suunto-map.ts), para que ambos den el mismo semáforo.
export function computeReadiness(input: {
  hrvRmssd: number;
  hrvBaseline: number;
  sleepHours: number;
  muscleSoreness?: number;
}): Pick<DailyCheckIn, 'status' | 'coachAdvice' | 'suggestedAction'> & { hrvDropPct: number } {
  const { hrvRmssd, hrvBaseline, sleepHours } = input;
  const muscleSoreness = input.muscleSoreness ?? 0;
  const hrvDropPct = hrvBaseline > 0 ? Math.round(((hrvRmssd - hrvBaseline) / hrvBaseline) * 100) : 0;

  if (hrvDropPct < -20 || sleepHours < 5.5 || muscleSoreness >= 8) {
    return {
      hrvDropPct,
      status: 'fatigued',
      suggestedAction: 'downgrade_easy',
      coachAdvice: `Alerta de fatiga acumulada: Tu HRV ha caído un ${Math.abs(hrvDropPct)}% y descansaste solo ${sleepHours}h. Meter hoy series o tirada dura sería un sabotaje a tu adaptación aeróbica. Te recomiendo descanso total o 35' regenerativo a menos de tu AeT.`,
    };
  }
  if (hrvDropPct < -10 || sleepHours < 6.5 || muscleSoreness >= 6) {
    return {
      hrvDropPct,
      status: 'moderate',
      suggestedAction: 'maintain',
      coachAdvice: `Recuperación intermedia (HRV con variación del ${hrvDropPct}%). Puedes entrenar, pero no te pases de pulsaciones en las cuestas. ZoneSense debe mantenerse estrictamente en DFA a1 > 0.75.`,
    };
  }
  return {
    hrvDropPct,
    status: 'optimal',
    suggestedAction: 'maintain',
    coachAdvice: `Recuperación excelente. Sistema nervioso parasimpático activo y listo para asimilar la sesión programada de hoy.`,
  };
}

/**
 * Recalcula un check-in de Suunto contra la HRV de referencia del perfil, para
 * que el semáforo, las gráficas y la ficha usen siempre la MISMA referencia.
 */
export function rebaseSuuntoCheckIn(ci: DailyCheckIn, hrvBaseline: number): DailyCheckIn {
  if (!(hrvBaseline > 0) || ci.source !== 'suunto') return ci;
  const r = computeReadiness({ hrvRmssd: ci.hrvRmssd, hrvBaseline, sleepHours: ci.sleepHours });
  const balance = ci.coachAdvice.match(/ Recovery Suunto del día: \d+%\./)?.[0] ?? '';
  return {
    ...ci,
    hrvBaseline,
    status: r.status,
    suggestedAction: r.suggestedAction,
    coachAdvice: `${r.coachAdvice} (Datos de Suunto: sueño ${ci.sleepHours} h, HRV ${ci.hrvRmssd} ms vs referencia ${hrvBaseline} ms.${balance})`,
  };
}
