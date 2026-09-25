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
  mountainTss: number;
  intensityFactor: number;
  method: 'hrTSS' | 'rpeTSS' | 'durationEstimate';
  formulaExplanation: string;
}

export interface TSBZoneDiagnosis {
  zone: 'danger' | 'overload' | 'maintenance' | 'race_ready' | 'detraining';
  label: string;
  rangeDescription: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  scientificExplanation: string;
  actionRecommendation: string;
}

export interface RampRateDiagnosis {
  rate: number;
  status: 'recovery' | 'maintenance' | 'optimal' | 'high' | 'excessive';
  label: string;
  textColor: string;
  badgeColor: string;
  recommendation: string;
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
  antHr: number = 165,
  rpe?: number
): TSSCalculationResult {
  if (durationMin <= 0) {
    return {
      tss: 0,
      mountainTss: 0,
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

  if (avgHr && avgHr > 0 && antHr > 0) {
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

  // Sin ajuste por desnivel: no hay un factor validado que convierta D- en TSS.
  const mountainTss = tss;

  return {
    tss,
    mountainTss,
    intensityFactor,
    method,
    formulaExplanation,
  };
}

/**
 * Returns scientifically validated diagnosis of Training Stress Balance (TSB)
 * based on Joe Friel's and Dr. Andrew Coggan's established zones.
 */
export function getTsbZoneDiagnosis(tsb: number): TSBZoneDiagnosis {
  if (tsb < -30) {
    return {
      zone: 'danger',
      label: 'Riesgo Severo de Sobreentrenamiento (Fatiga Crítica)',
      rangeDescription: 'TSB < -30',
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-950/40',
      borderColor: 'border-rose-500/40',
      scientificExplanation: 'La fatiga aguda (ATL) supera a la forma física (CTL) en más de 30 puntos. Se produce inmunosupresión temporal, depleción glucogénica crónica y estrés neuroendocrino severo.',
      actionRecommendation: 'Microciclo de descarga inmediato (-40% a -50% de volumen) o descanso pasivo de 48-72h antes de cualquier trabajo de intensidad.',
    };
  }

  if (tsb >= -30 && tsb < -10) {
    return {
      zone: 'overload',
      label: 'Sobrecarga Funcional Óptima (Fase de Carga)',
      rangeDescription: '-30 ≤ TSB < -10',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-500/40',
      scientificExplanation: 'Zona óptima de estímulo adaptativo según el modelo de Friel. El atleta acumula fatiga controlada que generará supercompensación aeróbica mitocondrial.',
      actionRecommendation: 'Continúa con el plan previsto. Monitorea la HRV matutina y prioriza la ingesta de hidratos y el descanso nocturno.',
    };
  }

  if (tsb >= -10 && tsb <= 5) {
    return {
      zone: 'maintenance',
      label: 'Zona Neutra / Asimilación y Mantenimiento',
      rangeDescription: '-10 ≤ TSB ≤ +5',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-500/40',
      scientificExplanation: 'Equilibrio fisiológico entre carga y recuperación. Fase ideal para consolidar adaptaciones de fuerza o testear ritmo y nutrición sin fatiga residual.',
      actionRecommendation: 'Ideal para semanas intermedias, transición entre mesociclos o rodajes de asimilación.',
    };
  }

  if (tsb > 5 && tsb <= 25) {
    return {
      zone: 'race_ready',
      label: 'Zona de Máximo Rendimiento / Competición (Peak Form)',
      rangeDescription: '+5 < TSB ≤ +25',
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40',
      borderColor: 'border-cyan-500/40',
      scientificExplanation: 'Tapering óptimo completado. La fatiga acumulada (ATL) se ha disipado casi por completo mientras el estado de forma (CTL) se mantiene elevado. Máxima potencia mitocondrial y frescura neuromuscular.',
      actionRecommendation: 'Estado óptimo para competir (ej. Transvulcania 73K). Mantén activaciones neuromusculares muy breves de alta cadencia.',
    };
  }

  return {
    zone: 'detraining',
    label: 'Desentrenamiento / Pérdida de Fitness',
    rangeDescription: 'TSB > +25',
    textColor: 'text-zinc-400',
    bgColor: 'bg-zinc-900/60',
    borderColor: 'border-zinc-700/40',
    scientificExplanation: 'El reposo o la inactividad han sido excesivos. Aunque la frescura es máxima, el estado de forma crónico (CTL) decae a un ritmo aproximado del 2.4% diario.',
    actionRecommendation: 'Reinicia progresivamente los microciclos de volumen aeróbico Z1/Z2 para restablecer la densidad mitocondrial.',
  };
}

/**
 * Returns Ramp Rate diagnosis (weekly change in CTL points).
 * Standard guidelines from Joe Friel & TrainingPeaks:
 * - Optimal: +3 to +7 CTL points per week
 * - High: +8 to +10 CTL points per week (monitor closely)
 * - Excessive: > +10 CTL points per week (drastic spike in injury risk)
 */
export function getRampRateDiagnosis(weeklyCtlChange: number): RampRateDiagnosis {
  if (weeklyCtlChange < 0) {
    return {
      rate: weeklyCtlChange,
      status: 'recovery',
      label: `${weeklyCtlChange} CTL/sem (Descarga)`,
      textColor: 'text-cyan-400',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      recommendation: 'Semana de asimilación/descarga. Fisiológicamente necesaria para permitir la regeneración de tejidos y glucógeno.',
    };
  }

  if (weeklyCtlChange <= 2) {
    return {
      rate: weeklyCtlChange,
      status: 'maintenance',
      label: `+${weeklyCtlChange} CTL/sem (Mantenimiento)`,
      textColor: 'text-zinc-300',
      badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      recommendation: 'Carga constante. El fitness se mantiene estable sin generar fatiga residual apreciable.',
    };
  }

  if (weeklyCtlChange <= 7) {
    return {
      rate: weeklyCtlChange,
      status: 'optimal',
      label: `+${weeklyCtlChange} CTL/sem (Rampa Óptima)`,
      textColor: 'text-emerald-400',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      recommendation: 'Tasa de rampa fisiológicamente ideal (+3 a +7/semana). Adaptación mitocondrial segura sin sobrecargar ligamentos ni tendones.',
    };
  }

  if (weeklyCtlChange <= 10) {
    return {
      rate: weeklyCtlChange,
      status: 'high',
      label: `+${weeklyCtlChange} CTL/sem (Rampa Elevada)`,
      textColor: 'text-amber-400',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      recommendation: 'Progresión en el límite superior recomendado. Mantén control estricto de la variabilidad cardíaca (HRV) y descanso nocturno.',
    };
  }

  return {
    rate: weeklyCtlChange,
    status: 'excessive',
    label: `+${weeklyCtlChange} CTL/sem (Rampa Excesiva > +10)`,
    textColor: 'text-rose-400',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    recommendation: 'Incremento excesivamente rápido de la carga (> 10 CTL/semana). Los estudios demuestran un incremento exponencial en el riesgo de tendinopatías y roturas musculares.',
  };
}
