/**
 * Acute:Chronic Workload Ratio (ACWR) Calculation Engine
 * 
 * Based on Dr. Tim Gabbett's validated sports science framework (2016, British Journal of Sports Medicine):
 * "The training-injury prevention paradox: should athletes be training smarter and harder?"
 * 
 * In Mountain Ultra-Trail (Uphill Athlete):
 * - Acute Load: Fatigue/Workload over the last 7 days (representing recent fatigue).
 * - Chronic Load: Historical Workload over the last 28 days (4 weeks, representing chronic fitness & tissue conditioning).
 * - ACWR = Acute Workload (7d avg) / Chronic Workload (28d avg).
 * 
 * Sweet Spot Framework:
 * - < 0.80: Undertraining / Detraining (Increased injury risk if load spikes suddenly).
 * - 0.80 - 1.30: "The Sweet Spot" (Optimal training adaptation with lowest injury & overtraining risk < 10%).
 * - 1.30 - 1.50: Alert Zone (Elevated injury likelihood ~15-25%).
 * - > 1.50: The Danger Zone (Substantially elevated overtraining & tissue breakdown risk > 35-50%).
 */

import { Workout } from '../types';
import { buildDailyLoadMap, buildDailyLoadSeries, localDateKey } from './trainingLoad';

export type ACWRZone = 'undertraining' | 'sweet_spot' | 'overload_risk' | 'danger_overtraining';

export interface ACWRDataPoint {
  date: string;
  dayLabel: string;
  dayTss: number;
  acuteLoad7d: number;      // 7-day rolling average
  acuteLoad7dTotal: number; // 7-day sum
  chronicLoad28d: number;   // 28-day rolling average
  chronicLoad28dTotal: number; // 28-day sum
  acwr: number;             // acuteLoad / chronicLoad
  ewmaAcwr: number;         // Exponentially weighted ratio
  zone: ACWRZone;
  workoutTitles: string[];
}

export interface ACWRSummary {
  currentAcwr: number;
  currentEwmaAcwr: number;
  acuteLoad7dTotal: number;
  acuteLoad7dAvg: number;
  chronicLoad28dTotal: number;
  chronicLoad28dAvg: number;
  weeklyChangePct: number;    // % change of acute vs previous 7d
  zone: ACWRZone;
  zoneLabel: string;
  zoneColor: string;
  zoneBgColor: string;
  zoneBorderColor: string;
  riskLevel: string;
  injuryRiskPctFormatted: string;
  diagnosis: string;
  coachTacticalAdvice: string;
  actionableSteps: string[];
  series28d: ACWRDataPoint[];
}

/**
 * Builds a continuous date-indexed TSS map (oldest → today) from the
 * athlete's COMPLETED workouts only (Suunto TSS when available).
 * Days without training count as 0 TSS.
 */
export function buildContinuousTssMap(
  workouts: Workout[],
  daysCount: number = 60,
  antHr?: number
): Map<string, { tss: number; titles: string[] }> {
  const map = new Map<string, { tss: number; titles: string[] }>();
  for (const day of buildDailyLoadSeries(workouts, daysCount, antHr)) {
    map.set(day.date, { tss: day.tss, titles: day.titles });
  }
  return map;
}

/**
 * Categorizes an ACWR score into Gabbett's sports science zones
 */
export function getACWRZone(acwr: number): {
  zone: ACWRZone;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  riskLevel: string;
  injuryRiskPctFormatted: string;
  diagnosis: string;
} {
  if (acwr < 0.80) {
    return {
      zone: 'undertraining',
      label: 'Infracarga / Recuperación (< 0.80)',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      riskLevel: 'Riesgo Bajo Inmediato (Infracarga)',
      injuryRiskPctFormatted: '< 8% (Pérdida de adaptación)',
      diagnosis: 'La fatiga reciente de los últimos 7 días está por debajo de tu nivel crónico. Si estás en semana de asimilación o descarga, es óptimo. Sin embargo, no mantengas este ratio prolongadamente para evitar desentrenamiento cardiovascular.',
    };
  } else if (acwr <= 1.30) {
    return {
      zone: 'sweet_spot',
      label: 'Sweet Spot Óptimo (0.80 - 1.30)',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      riskLevel: 'Mínimo Riesgo de Lesión (< 10%)',
      injuryRiskPctFormatted: '< 10% (Zona Segura)',
      diagnosis: '¡Zona ideal de sobrecarga progresiva! El incremento semanal de estrés fisiológico está respaldado por tu volumen base de las últimas 4 semanas. Máxima ganancia aeróbica con mínima probabilidad de sobreentrenamiento.',
    };
  } else if (acwr <= 1.50) {
    return {
      zone: 'overload_risk',
      label: 'Zona de Alerta (1.30 - 1.50)',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      riskLevel: 'Riesgo Moderado de Lesión / Sobrecarga',
      injuryRiskPctFormatted: '15% - 25% de probabilidad',
      diagnosis: 'Atención: Tu carga aguda ha crecido con rapidez respecto al mes precedente. Aunque estimula adaptaciones fuertes, tus sóleos, tendones de Aquiles y cartílagos necesitan tiempo para sintetizar colágeno.',
    };
  } else {
    return {
      zone: 'danger_overtraining',
      label: 'Zona de Peligro (> 1.50 - Sobreentrenamiento)',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      riskLevel: 'Riesgo Crítico de Sobreentrenamiento y Rotura',
      injuryRiskPctFormatted: '> 35% - 50% de probabilidad',
      diagnosis: '¡Alerta Fisiológica Crítica! Has superado el umbral seguro de Tim Gabbett (ACWR > 1.50). La fatiga aguda duplica con creces la capacidad crónica de absorción muscular. Continuar con este ritmo conduce a Síndrome de Sobreentrenamiento (OTS) o lesión músculo-tendinosa.',
    };
  }
}

/**
 * Calculates complete 28-day ACWR history and current status summary.
 */
export function calculateACWRSummary(
  workouts: Workout[],
  antHr?: number
): ACWRSummary {
  // At least 56 days for full 28-day chronic windows; the EWMA uses the whole
  // history since the first completed workout (starting at 0, no seed value).
  const loggedDates = [...buildDailyLoadMap(workouts, antHr).keys()].sort();
  const today = localDateKey();
  const firstDate = loggedDates[0] && loggedDates[0] < today ? loggedDates[0] : today;
  const daysSinceFirst = Math.round((new Date(today).getTime() - new Date(firstDate).getTime()) / 86400000) + 1;
  const daysNeeded = Math.max(56, daysSinceFirst);
  const tssMap = buildContinuousTssMap(workouts, daysNeeded, antHr);
  const sortedDates = Array.from(tssMap.keys()).sort();

  const series28d: ACWRDataPoint[] = [];

  // EWMA tracking state
  let ewmaAcute = 0;
  let ewmaChronic = 0;
  const acuteAlpha = 2 / (7 + 1);   // ~0.25
  const chronicAlpha = 2 / (28 + 1); // ~0.069

  // Calculate day-by-day ACWR
  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const dayEntry = tssMap.get(dateStr)!;
    const dayTss = dayEntry.tss;

    // Update EWMA
    ewmaAcute = dayTss * acuteAlpha + (1 - acuteAlpha) * ewmaAcute;
    ewmaChronic = dayTss * chronicAlpha + (1 - chronicAlpha) * ewmaChronic;

    // Only collect data points for the evaluation window (last 28 days)
    if (i >= sortedDates.length - 28) {
      // 7-day acute window: days [i-6 .. i]
      let acuteSum = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        acuteSum += tssMap.get(sortedDates[j])?.tss || 0;
      }
      const acuteAvg = Math.round((acuteSum / 7) * 10) / 10;

      // 28-day chronic window: days [i-27 .. i]
      let chronicSum = 0;
      for (let j = Math.max(0, i - 27); j <= i; j++) {
        chronicSum += tssMap.get(sortedDates[j])?.tss || 0;
      }
      const chronicAvg = Math.round((chronicSum / 28) * 10) / 10;

      // ACWR standard ratio (0 when there is no chronic load yet)
      const rawAcwr = chronicSum > 0 ? (acuteSum / 7) / (chronicSum / 28) : 0;
      const roundedAcwr = Math.round(rawAcwr * 100) / 100;

      // EWMA ratio
      const roundedEwma = ewmaChronic > 0 ? Math.round((ewmaAcute / ewmaChronic) * 100) / 100 : 0;

      const zoneInfo = getACWRZone(roundedAcwr);

      const [yy, mm, dd] = dateStr.split('-').map(Number);
      const d = new Date(yy, mm - 1, dd);
      const dayLabel = `${d.getDate()} ${d.toLocaleString('es-ES', { month: 'short' })}`;

      series28d.push({
        date: dateStr,
        dayLabel,
        dayTss,
        acuteLoad7d: acuteAvg,
        acuteLoad7dTotal: acuteSum,
        chronicLoad28d: chronicAvg,
        chronicLoad28dTotal: chronicSum,
        acwr: roundedAcwr,
        ewmaAcwr: roundedEwma,
        zone: zoneInfo.zone,
        workoutTitles: dayEntry.titles,
      });
    }
  }

  // Current status (today / latest point)
  const latestPoint = series28d[series28d.length - 1] || {
    acwr: 1.05,
    ewmaAcwr: 1.02,
    acuteLoad7dTotal: 350,
    acuteLoad7d: 50,
    chronicLoad28dTotal: 1400,
    chronicLoad28d: 50,
    zone: 'sweet_spot' as ACWRZone,
  };

  // Compare acute load of today vs acute load 7 days ago
  const point7DaysAgo = series28d[series28d.length - 8] || series28d[0];
  const weeklyChangePct = point7DaysAgo.acuteLoad7d > 0
    ? Math.round(((latestPoint.acuteLoad7d - point7DaysAgo.acuteLoad7d) / point7DaysAgo.acuteLoad7d) * 100)
    : 0;

  const currentZone = getACWRZone(latestPoint.acwr);

  // Generate Coach Miguel's contextual tactical advice
  let coachTacticalAdvice = '';
  const actionableSteps: string[] = [];

  if (latestPoint.acwr < 0.80) {
    coachTacticalAdvice = `Actualmente tu ratio es de ${latestPoint.acwr.toFixed(2)} (Infracarga). Si vienes saliendo de un microciclo de descarga o competición, es la respuesta biológica deseada. Sin embargo, antes de volver a meter tiradas largas de montaña (+1.200m D+), progresa un máximo de +10% semanal en volumen aeróbico Z1/Z2 para no disparar el ACWR violentamente la próxima semana.`;
    actionableSteps.push('Mantén rodajes cómodos en Zona 1 y Zona 2 (sub-AeT).');
    actionableSteps.push('Evita saltar de golpe de 35 a 70 km semanales; reparte la carga en 4 días.');
    actionableSteps.push('Introduce sesiones de fuerza excéntrica para preparar los sóleos.');
  } else if (latestPoint.acwr <= 1.30) {
    coachTacticalAdvice = `Excelente dosificación: Ratio ACWR en ${latestPoint.acwr.toFixed(2)} (Sweet Spot de Gabbett). Estás construyendo fitness mitocondrial sólido para Transvulcania 73K sin saturar el sistema nervioso. La regla de oro aquí es la regularidad: no te dejes llevar por la euforia acelerando en las cuestas; continúa vigilando que tu DFA a1 se mantenga en Zona 2 (&ge; 0.75).`;
    actionableSteps.push('Continúa con el plan previsto sin modificaciones bruscas.');
    actionableSteps.push('Prioriza la hidratación con 500-650 mg/h de sodio en tiradas de fin de semana.');
    actionableSteps.push('Monitorea que tu HRV nocturna se mantenga dentro del rango basal.');
  } else if (latestPoint.acwr <= 1.50) {
    coachTacticalAdvice = `Precaución: Tu ACWR ha subido a ${latestPoint.acwr.toFixed(2)} (+${weeklyChangePct}% vs semana previa). Estás rozando el techo de asimilación. Si las piernas se sienten pesadas o tu HRV rMSSD cae por debajo del rango habitual, sustituye la sesión de intensidad o cuestas por rodaje regenerativo suave o descanso activo.`;
    actionableSteps.push('No agregues kilómetros ni desnivel extra este fin de semana.');
    actionableSteps.push('Prioriza masaje fascial en sóleos y cuádriceps al terminar.');
    actionableSteps.push('Si tu HRV matutina indica fatiga moderada, pulsa el botón de adaptar sesión.');
  } else {
    coachTacticalAdvice = `¡ALERTA ROJA DE SOBREENTRENAMIENTO! Tu ACWR actual es de ${latestPoint.acwr.toFixed(2)}. Un incremento agudo tan pronunciado multiplica entre 2x y 4x el riesgo de rotura fibrilar, periostitis o fatiga simpática profunda. Como tu entrenador, te ordeno no sumar más estrés esta semana: programa de inmediato 2 a 4 días de descarga regenerativa Z1 (< 130 bpm).`;
    actionableSteps.push('Activar Microciclo de Descarga (-45% volumen, 100% regenerativo).');
    actionableSteps.push('Prohibido el trabajo de bajadas pronunciadas (impacto excéntrico).');
    actionableSteps.push('Maximizar horas de sueño (&ge; 8h) y aporte proteico (1.6 g/kg) para reparación tisular.');
  }

  return {
    currentAcwr: latestPoint.acwr,
    currentEwmaAcwr: latestPoint.ewmaAcwr,
    acuteLoad7dTotal: latestPoint.acuteLoad7dTotal,
    acuteLoad7dAvg: latestPoint.acuteLoad7d,
    chronicLoad28dTotal: latestPoint.chronicLoad28dTotal,
    chronicLoad28dAvg: latestPoint.chronicLoad28d,
    weeklyChangePct,
    zone: currentZone.zone,
    zoneLabel: currentZone.label,
    zoneColor: currentZone.color,
    zoneBgColor: currentZone.bgColor,
    zoneBorderColor: currentZone.borderColor,
    riskLevel: currentZone.riskLevel,
    injuryRiskPctFormatted: currentZone.injuryRiskPctFormatted,
    diagnosis: currentZone.diagnosis,
    coachTacticalAdvice,
    actionableSteps,
    series28d,
  };
}
