/**
 * Suunto ZoneSense & DFA alpha-1 (Detrended Fluctuation Analysis) Engine
 * 
 * ZoneSense measures heart rate variability (HRV) DURING exercise via DFA a1.
 * Unlike static HR zones that drift with heat, caffeine, altitude, and dehydration,
 * DFA a1 directly reflects autonomic nervous system balance and cellular metabolic stress.
 */

export interface ZoneSenseInterpretation {
  zone: 'Aeróbico (Z1-Z2)' | 'Transición Aeróbica-Anaeróbica (Z3)' | 'Anaeróbico (Z4-Z5)';
  dfaAlpha1Range: string;
  bpmRangeLabel: string;
  metabolism: string;
  lactateState: string;
  recommendation: string;
  color: string;
}

export function formatZoneSenseWithBpm(
  targetLabel: string, 
  aetHr: number = 142, 
  antHr: number = 167
): string {
  if (!targetLabel) return '';
  if (targetLabel.includes('0.75') && targetLabel.includes('>')) {
    return `DFA a1 > 0.75 (Aeróbico puro: < ${aetHr} bpm)`;
  }
  if (targetLabel.includes('0.75') && targetLabel.includes('0.50')) {
    return `DFA a1 0.75 - 0.50 (Transición: ${aetHr + 1} - ${antHr} bpm)`;
  }
  if (targetLabel.includes('< 0.50') || targetLabel.includes('Anaeróbico')) {
    return `DFA a1 < 0.50 (Anaeróbico: > ${antHr} bpm)`;
  }
  if (targetLabel.toLowerCase().includes('regenerativo') || targetLabel.includes('0.85')) {
    return `DFA a1 > 0.85 (Regenerativo Z1: < ${Math.min(130, aetHr - 12)} bpm)`;
  }
  return targetLabel;
}

export function interpretDfaAlpha1(
  dfaAlpha1: number, 
  aetHr: number = 142, 
  antHr: number = 167
): ZoneSenseInterpretation {
  if (dfaAlpha1 >= 0.75) {
    return {
      zone: 'Aeróbico (Z1-Z2)',
      dfaAlpha1Range: '≥ 0.75',
      bpmRangeLabel: `< ${aetHr} bpm (Aeróbico puro)`,
      metabolism: `Predominio de oxidación de grasas y alta eficiencia mitocondrial (< ${aetHr} bpm). Tono parasimpático aún presente.`,
      lactateState: 'Lactato basal (< 1.5 - 2.0 mmol/L). Eliminación igual o superior a la producción.',
      recommendation: `Esta es la zona sagrada de Uphill Athlete (< ${aetHr} bpm). Aquí debes acumular el 80-90% de tus horas para construir la base de Transvulcania sin fatigar el sistema nervioso.`,
      color: '#10b981' // emerald
    };
  } else if (dfaAlpha1 >= 0.50) {
    return {
      zone: 'Transición Aeróbica-Anaeróbica (Z3)',
      dfaAlpha1Range: '0.75 - 0.50',
      bpmRangeLabel: `${aetHr + 1} - ${antHr} bpm (Zona de Transición)`,
      metabolism: `Zona gris / Tempo (${aetHr + 1}-${antHr} bpm). Comienza el consumo rápido de glucógeno y la pérdida de fractalidad cardíaca.`,
      lactateState: 'Lactato en aumento (2.0 a 4.0 mmol/L). Por encima del umbral aeróbico (AeT).',
      recommendation: `¡Cuidado con esta zona (${aetHr + 1}-${antHr} bpm) en días suaves! Si tu sesión era un rodaje regenerativo y tu ZoneSense marca aquí, baja el ritmo de subida y camina si es necesario.`,
      color: '#f59e0b' // amber
    };
  } else {
    return {
      zone: 'Anaeróbico (Z4-Z5)',
      dfaAlpha1Range: '< 0.50',
      bpmRangeLabel: `> ${antHr} bpm (Régimen Anaeróbico)`,
      metabolism: `Régimen glucolítico puro (> ${antHr} bpm). Fatiga rápida, acidez muscular y estrés simpático masivo.`,
      lactateState: `Lactato por encima de AnT (> 4.0 mmol/L en > ${antHr} bpm). Estado no sostenible en ultras.`,
      recommendation: `Solo debe verse en series específicas de potencia aeróbica máxima (VO2max a > ${antHr} bpm) o en los últimos metros de una subida corta. Reservar para fases específicas de la temporada.`,
      color: '#ef4444' // red
    };
  }
}

/**
 * Explains ZoneSense vs Heart Rate Decoupling (Cardiac Drift)
 */
export function explainZoneSenseDecoupling(avgHr: number, aetHr: number, dfaAlpha1: number): string {
  if (avgHr > aetHr && dfaAlpha1 >= 0.75) {
    return 'Decoupling fisiológico positivo: Tus pulsaciones están algo más altas que tu AeT teórico (probablemente por calor, pendiente o cafeína), pero tu ZoneSense (DFA a1 ≥ 0.75) confirma que a nivel celular sigues trabajando en régimen aeróbico limpio.';
  } else if (avgHr <= aetHr && dfaAlpha1 < 0.75) {
    return 'Alerta de Fatiga Oculta: Aunque tu pulsómetro marca que vas dentro de tus pulsaciones teóricas de Zona 2, tu ZoneSense (DFA a1 < 0.75) detecta que tu cuerpo ya está bajo estrés de transición o fatiga acumulada. ¡Haz caso a ZoneSense y afloja!';
  } else if (dfaAlpha1 < 0.50) {
    return 'Intensidad Anaeróbica Excesiva: Estás quemando glucógeno a máxima velocidad. Incompatible con rodajes aeróbicos o tiradas largas para ultra trail.';
  }
  return 'Sincronización perfecta: Tus pulsaciones y tu estado metabólico ZoneSense están completamente alineados en zona aeróbica limpia.';
}
