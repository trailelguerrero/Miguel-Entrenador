/**
 * Performance Management Chart (PMC) & Training Stress Metrics
 * Based exclusively on peer-reviewed, empirically verified exercise science:
 * - Dr. Eric W. Banister (1975, 1991): Impulse-Response Model
 * - Dr. Andrew R. Coggan (2003): Training Stress Score (TSS), Intensity Factor (IF), CTL, ATL, TSB
 * - Joe Friel (2009): The Cyclist's/Triathlete's Training Bible & Fast After 50 (PMC application & Ramp Rates)
 * - Scott Johnston, Steve House & Kilian Jornet (2019): Training for the Uphill Athlete (enfoque de entrenamiento)
 */


export interface TSSCalculationResult {
  tss: number;
  intensityFactor: number;
  method: 'hrTSS' | 'rpeTSS' | 'durationEstimate';
  formulaExplanation: string;
}

/**
 * Descripción NEUTRA del TSB: solo dice qué relación hay entre carga reciente
 * (ATL) y crónica (CTL). No diagnostica ni recomienda: la decisión del día es
 * del motor de readiness (src/brain/readiness.ts).
 */
export interface TSBDescription {
  zone: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  label: string;
  rangeDescription: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

/** Descripción neutra del cambio semanal de CTL (sin juicio de riesgo ni recomendación). */
export interface RampRateDescription {
  rate: number;
  status: 'falling' | 'stable' | 'rising' | 'fast_rising' | 'very_fast_rising';
  label: string;
  textColor: string;
  badgeColor: string;
  description: string;
}

/**
 * Calculates Training Stress Score (TSS) according to Andrew Coggan's validated standard.
 * 
 * 1. hrTSS (Heart Rate TSS):
 *    IF = HR_avg / AnT (LTHR - Lactate / Anaerobic Threshold Heart Rate)
 *    TSS = (Duration_hours * IF^2) * 100 = (Duration_minutes / 60) * (HR_avg / AnT)^2 * 100
 *    Note: 1 hour exactly at Anaerobic Threshold (IF = 1.0) produces exactly 100 TSS.
 * 
 * 2. rpeTSS (sRPE - Session Rating of Perceived Exertion):
 *    Validated proxy when heart rate monitor is unavailable (Foster et al., 2001).
 *    Mapped to equivalent IF: RPE 5 = IF 0.70; RPE 7 = IF 0.88; RPE 8 = IF 1.00 (Threshold).
 * 
 *
 * IMPORTANTE: es solo una ESTIMACIÓN para sesiones sin TSS de Suunto
 * (planificadas o registradas a mano). Suunto calcula su propio TSS con otro
 * método (p. ej. TRIMP por FC o MET), así que no coincidirá exactamente. Para
 * los entrenos sincronizados siempre se usa el TSS de Suunto (ver trainingLoad.ts).
 */
export function calculateWorkoutTss(
  durationMin: number,
  avgHr?: number,
  /** Umbral anaeróbico MEDIDO (Suunto o manual). Sin él no hay hrTSS: nunca se usa un valor por defecto. */
  antHr?: number,
  rpe?: number
): TSSCalculationResult {
  if (durationMin <= 0) {
    return {
      tss: 0,
      intensityFactor: 0,
      method: 'durationEstimate',
      formulaExplanation: 'Duración cero (descanso)',
    };
  }

  let tss = 0;
  let intensityFactor = 0;
  let method: 'hrTSS' | 'rpeTSS' | 'durationEstimate' = 'durationEstimate';
  let formulaExplanation = '';

  const durationHours = durationMin / 60;

  if (avgHr && avgHr > 0 && antHr && antHr > 0) {
    // Exact hrTSS formula
    intensityFactor = Math.round((avgHr / antHr) * 100) / 100;
    tss = Math.round(durationHours * Math.pow(intensityFactor, 2) * 100);
    method = 'hrTSS';
    formulaExplanation = `hrTSS = (${durationMin} min / 60) × (${avgHr} bpm / ${antHr} AnT)² × 100 = ${tss} TSS (IF: ${intensityFactor.toFixed(2)})`;
  } else if (rpe && rpe >= 1) {
    // Validated sRPE conversion to Intensity Factor
    // RPE 1-10 mapped to physiological intensity factor curve
    const rpeIfMap: Record<number, number> = {
      1: 0.50, // Recuperación muy suave
      2: 0.58,
      3: 0.65, // Z1 aeróbica regenerativa
      4: 0.72,
      5: 0.78, // Z2 aeróbica AeT
      6: 0.85, // Sub-umbral / Tempo
      7: 0.92, // Umbral aeróbico-anaeróbico
      8: 1.00, // Umbral anaeróbico AnT / LTHR (1h = 100 TSS)
      9: 1.08, // Intervalos VO2max
      10: 1.18 // Esfuerzo máximo / Sprint anaeróbico
    };
    intensityFactor = rpeIfMap[Math.min(10, Math.max(1, Math.round(rpe)))] || 0.75;
    tss = Math.round(durationHours * Math.pow(intensityFactor, 2) * 100);
    method = 'rpeTSS';
    formulaExplanation = `rpeTSS = (${durationMin} min / 60) × (IF estimado ${intensityFactor.toFixed(2)} por RPE ${rpe})² × 100 = ${tss} TSS`;
  } else {
    // Default standard endurance pace (IF ~ 0.72)
    intensityFactor = 0.72;
    tss = Math.round(durationHours * Math.pow(intensityFactor, 2) * 100);
    method = 'durationEstimate';
    formulaExplanation = `TSS estimado por duración = (${durationMin} min / 60) × (IF base 0.72)² × 100 = ${tss} TSS`;
  }

  // Sin ajuste por desnivel: no hay un factor validado que convierta D- en TSS
  // (la carga mecánica del trail se limita aparte, con el presupuesto mecánico).

  return {
    tss,
    intensityFactor,
    method,
    formulaExplanation,
  };
}

/** Cortes de referencia (bandas de Friel/Coggan, orientativas: no validadas para este atleta). */
export function describeTsb(tsb: number): TSBDescription {
  const t = Math.round(tsb * 10) / 10;
  if (tsb < -30) {
    return {
      zone: 'very_negative',
      label: 'Carga reciente muy por encima de la crónica',
      rangeDescription: 'TSB < -30',
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-950/40',
      borderColor: 'border-rose-500/40',
      description: `TSB ${t}: la carga de los últimos días (ATL) supera en más de 30 puntos a la carga habitual (CTL). Es un dato; el estado de hoy lo decide el motor de readiness.`,
    };
  }
  if (tsb < -10) {
    return {
      zone: 'negative',
      label: 'Carga reciente por encima de la crónica',
      rangeDescription: '-30 ≤ TSB < -10',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-500/40',
      description: `TSB ${t}: la carga de los últimos días (ATL) es mayor que la carga habitual (CTL).`,
    };
  }
  if (tsb <= 5) {
    return {
      zone: 'neutral',
      label: 'Carga reciente similar a la crónica',
      rangeDescription: '-10 ≤ TSB ≤ +5',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-500/40',
      description: `TSB ${t}: la carga de los últimos días (ATL) está cerca de la carga habitual (CTL).`,
    };
  }
  if (tsb <= 25) {
    return {
      zone: 'positive',
      label: 'Carga reciente por debajo de la crónica',
      rangeDescription: '+5 < TSB ≤ +25',
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40',
      borderColor: 'border-cyan-500/40',
      description: `TSB ${t}: la carga de los últimos días (ATL) es menor que la carga habitual (CTL).`,
    };
  }
  return {
    zone: 'very_positive',
    label: 'Carga reciente muy por debajo de la crónica',
    rangeDescription: 'TSB > +25',
    textColor: 'text-zinc-400',
    bgColor: 'bg-zinc-900/60',
    borderColor: 'border-zinc-700/40',
    description: `TSB ${t}: la carga de los últimos días (ATL) es más de 25 puntos menor que la carga habitual (CTL).`,
  };
}

/**
 * Cambio semanal del CTL descrito sin juicio. Cortes orientativos (guía habitual
 * de Friel/TrainingPeaks: +3 a +7 CTL/semana), no validados para este atleta.
 */
export function describeRampRate(weeklyCtlChange: number): RampRateDescription {
  const r = weeklyCtlChange;
  const sign = r > 0 ? `+${r}` : `${r}`;
  if (r < 0) return { rate: r, status: 'falling', label: `${sign} CTL/sem (bajando)`, textColor: 'text-cyan-400', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', description: 'La carga crónica baja esta semana.' };
  if (r <= 2) return { rate: r, status: 'stable', label: `${sign} CTL/sem (estable)`, textColor: 'text-zinc-300', badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700', description: 'La carga crónica se mantiene.' };
  if (r <= 7) return { rate: r, status: 'rising', label: `${sign} CTL/sem (subiendo)`, textColor: 'text-emerald-400', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', description: 'La carga crónica sube dentro de la guía habitual (+3 a +7/semana).' };
  if (r <= 10) return { rate: r, status: 'fast_rising', label: `${sign} CTL/sem (subida rápida)`, textColor: 'text-amber-400', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30', description: 'La carga crónica sube por encima de la guía habitual (+3 a +7/semana).' };
  return { rate: r, status: 'very_fast_rising', label: `${sign} CTL/sem (subida muy rápida)`, textColor: 'text-rose-400', badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30', description: 'La carga crónica sube más de 10 puntos en una semana.' };
}
