import { StrengthExercise } from '../types';

/**
 * Uphill Athlete Methodology Utilities
 * Based on "Training for the Uphill Athlete" (Scott Johnston, Steve House, Kilian Jornet)
 */

export interface DriftTestResult {
  driftPercentage: number;
  hasAds: boolean;
  statusText: string;
  interpretation: string;
  recommendation: string;
}

/**
 * Calculates Heart Rate Drift for a constant-pace aerobic test.
 * Protocol: 15 min warm-up, followed by 60 min constant pace at target AeT HR.
 * Drift = ((HR2 / Pace2) - (HR1 / Pace1)) / (HR1 / Pace1) * 100
 * If pace is identical (e.g. constant speed on treadmill or flat loop):
 * Drift = ((HR2 - HR1) / HR1) * 100
 */
export function calculateHeartRateDrift(
  firstHalfAvgHr: number,
  secondHalfAvgHr: number,
  firstHalfPaceSecPerKm?: number,
  secondHalfPaceSecPerKm?: number
): DriftTestResult {
  let drift: number;

  if (firstHalfPaceSecPerKm && secondHalfPaceSecPerKm && firstHalfPaceSecPerKm > 0) {
    // Pace factor (velocity in m/s is inverse of pace)
    const v1 = 1000 / firstHalfPaceSecPerKm;
    const v2 = 1000 / secondHalfPaceSecPerKm;
    const ratio1 = firstHalfAvgHr / v1;
    const ratio2 = secondHalfAvgHr / v2;
    drift = ((ratio2 - ratio1) / ratio1) * 100;
  } else {
    drift = ((secondHalfAvgHr - firstHalfAvgHr) / firstHalfAvgHr) * 100;
  }

  drift = Math.round(drift * 10) / 10;

  if (drift < 3.5) {
    return {
      driftPercentage: drift,
      hasAds: false,
      statusText: 'Base aeróbica excelente (< 3.5%)',
      interpretation: 'Tu ritmo cardíaco se mantuvo perfectamente estable. Tu umbral aeróbico (AeT) medido es tu verdadero AeT.',
      recommendation: 'Puedes entrenar a estas pulsaciones con total confianza y comenzar a introducir trabajo específico de Muscular Endurance (ME) sin riesgo de sobreentrenamiento aeróbico.'
    };
  } else if (drift <= 5.0) {
    return {
      driftPercentage: drift,
      hasAds: false,
      statusText: 'Base aeróbica bien calibrada (3.5% - 5.0%)',
      interpretation: 'La deriva cardíaca está dentro del margen fisiológico normal aceptado por el manual Uphill Athlete.',
      recommendation: 'Este rango de pulsaciones representa con precisión tu AeT. Mantén el 85-90% de tus salidas por debajo de este valor.'
    };
  } else {
    return {
      driftPercentage: drift,
      hasAds: true,
      statusText: 'Deriva elevada (> 5%) - Síndrome de Deficiencia Aeróbica (ADS)',
      interpretation: `Deriva del ${drift}%. Tus fibras de contracción lenta no son capaces de soportar 60 minutos de trabajo continuo sin reclutar fibras anaeróbicas y fatigarse prematuramente.`,
      recommendation: 'Debes bajar tu frecuencia cardíaca de entrenamiento 5 a 10 ppm por debajo de este test. Es crucial realizar varias semanas de volumen estricto en Zona 1 y Zona 2 baja antes de añadir intensidad.'
    };
  }
}

/**
 * Detects Aerobic Deficiency Syndrome (ADS) from AeT and AnT spread.
 * In a healthy, well-developed mountain runner, AeT is typically within 10% of AnT (e.g. 150 bpm AeT vs 165 bpm AnT).
 * A spread greater than 10% (or >20-25 bpm) indicates ADS.
 */
export function checkAerobicDeficiency(aetHr: number, antHr: number): {
  hasAds: boolean;
  spreadBpm: number;
  spreadPercentage: number;
  message: string;
} {
  const spreadBpm = antHr - aetHr;
  const spreadPercentage = Math.round((spreadBpm / antHr) * 1000) / 10;
  const hasAds = spreadPercentage > 10 || spreadBpm > 20;

  let message = '';
  if (hasAds) {
    message = `Diferencia de ${spreadBpm} bpm (${spreadPercentage}%). Presentas ADS (Síndrome de Deficiencia Aeróbica). Necesitas dedicar el 90% de tu tiempo a volumen sub-AeT para ensanchar tu base mitocondrial.`;
  } else {
    message = `Diferencia de ${spreadBpm} bpm (${spreadPercentage}%). Tu motor aeróbico está equilibrado respecto a tu umbral anaeróbico.`;
  }

  return { hasAds, spreadBpm, spreadPercentage, message };
}

/**
 * Bodyweight & Outdoor Mountain Strength Library
 * Specifically designed for trail runners with NO gym equipment.
 */
export const UPHILL_ATHLETE_OUTDOOR_EXERCISES: StrengthExercise[] = [
  {
    name: 'Step-ups Unilaterales en Roca / Banco Alto',
    sets: 3,
    reps: '15-20 repeticiones por pierna',
    targetMuscle: 'Cuádriceps, glúteo mayor y gemelos',
    isOutdoorFriendly: true,
    notes: 'Busca una roca o banco a la altura de la rodilla. Impulsa exclusivamente con la pierna delantera, sin rebotar con la trasera. Extensión completa de cadera arriba.'
  },
  {
    name: 'Zancadas Búlgaras con Pausa Isométrica',
    sets: 3,
    reps: '12 repeticiones por pierna (2 seg de pausa abajo)',
    targetMuscle: 'Glúteos, estabilizadores de cadera y vasto medial',
    isOutdoorFriendly: true,
    notes: 'Pie trasero apoyado sobre una elevación. Baja verticalmente hasta rozar el suelo con la rodilla y mantén 2 segundos de tensión estricta.'
  },
  {
    name: 'Step-Downs Excéntricos (Entrenamiento de Descenso)',
    sets: 3,
    reps: '12-15 repeticiones lentas (3-4 seg de bajada)',
    targetMuscle: 'Cuádriceps (fuerza excéntrica antigravitatoria)',
    isOutdoorFriendly: true,
    notes: 'El ejercicio clave para Transvulcania. Simula el impacto destructor de los 4.000m de bajada. Baja sobre un escalón en 4 segundos sin dejarte caer.'
  },
  {
    name: 'Peso Muerto Rumano Unilateral a una Pierna',
    sets: 3,
    reps: '10-12 repeticiones por pierna',
    targetMuscle: 'Isquiosurales, glúteo medio y propiocepción de tobillo',
    isOutdoorFriendly: true,
    notes: 'Bisagra pura de cadera manteniendo la espalda recta y neutra. Excelente para estabilidad en senderos pedregosos y prevención de esguinces.'
  },
  {
    name: 'Elevaciones de Gemelos en Escalón / Borde de Roca',
    sets: 4,
    reps: '20 repeticiones (2 seg de estiramiento abajo + 1 seg arriba)',
    targetMuscle: 'Sóleo y gastrocnemio (Tendón de Aquiles)',
    isOutdoorFriendly: true,
    notes: 'Máximo rango de recorrido para blindar el tendón de Aquiles frente a las subidas prolongadas de montaña.'
  },
  {
    name: 'Circuito de Core Uphill Athlete',
    sets: 3,
    reps: 'Plancha frontal (45s) + Planchas laterales con abducción (30s/lado) + Hollow body (30s) + Bird-Dog (15/lado)',
    targetMuscle: 'Faja lumbopélvica, transverso del abdomen y multífidos',
    isOutdoorFriendly: true,
    notes: 'Esencial para sostener la postura erguida cuando llevas más de 5 horas de carrera con mochila y bastones.'
  },
  {
    name: 'Series ME: Power-Hiking en Cuesta Extrema (> 25% desnivel)',
    sets: 4,
    reps: 'Cuestas de 4-6 minutos a ritmo de zancada clavada con apoyo en muslos o bastones',
    targetMuscle: 'Muscular Endurance específica de montaña',
    isOutdoorFriendly: true,
    notes: 'Busca una rampa de tierra o sendero empinado. Zancada firme y rítmica. La sensación debe ser de quemazón muscular localizada en cuádriceps sin disparar las pulsaciones más allá de AeT.'
  }
];
