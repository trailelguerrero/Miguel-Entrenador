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
 * Bandas descriptivas (Gabbett). NO se usan como predictor de lesiones: la
 * evidencia posterior no respalda un uso causal del ACWR.
 * - < 0.80: Undertraining / Detraining (Increased injury risk if load spikes suddenly).
 * - 0.80 - 1.30: "The Sweet Spot" (lowest relative injury risk in Gabbett's data).
 * - 1.30 - 1.50: Alert Zone (higher relative risk).
 * - > 1.50: The Danger Zone (highest relative risk).
 * Gabbett's zones compare RELATIVE risk in team-sport cohorts; there is no
 * validated injury probability (%) for an individual trail runner, so the app
 * shows qualitative levels only.
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
export function getACWRZone(acwr: number, chronicTotal?: number): {
  zone: ACWRZone;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  riskLevel: string;
  injuryRiskPctFormatted: string;
  diagnosis: string;
} {
  // ACWR es un INDICADOR DESCRIPTIVO de la relación entre la carga de 7 días y la
  // de 28 (la evidencia no respalda usarlo como predictor causal de lesiones). Se
  // interpreta junto con HRV, sueño, RPE, dolor y rendimiento.
  const CONTEXT = 'Por sí solo no diagnostica riesgo de lesión: interprétalo junto con HRV, sueño, sensaciones, dolor y rendimiento.';
  if (chronicTotal !== undefined && !(chronicTotal > 0)) {
    return {
      zone: 'undertraining',
      label: 'Sin carga de las últimas 4 semanas',
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-700/20',
      borderColor: 'border-zinc-600',
      riskLevel: 'Sin datos suficientes',
      injuryRiskPctFormatted: 'Sin datos',
      diagnosis: 'No hay carga registrada en las últimas 4 semanas: no se puede calcular la relación entre carga aguda y crónica.',
    };
  }
  if (acwr < 0.80) {
    return {
      zone: 'undertraining',
      label: 'Carga aguda baja respecto a la habitual (< 0,80)',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      riskLevel: 'Carga reciente por debajo de tu media de 4 semanas',
      injuryRiskPctFormatted: 'Carga aguda baja',
      diagnosis: `Tus últimos 7 días están por debajo de tu media de 4 semanas: normal en una semana de descarga o tras una carrera. Si se prolonga, pierdes parte de lo ganado. ${CONTEXT}`,
    };
  } else if (acwr <= 1.30) {
    return {
      zone: 'sweet_spot',
      label: 'Carga aguda similar a la habitual (0,80–1,30)',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      riskLevel: 'Carga reciente en línea con tu media de 4 semanas',
      injuryRiskPctFormatted: 'Carga aguda similar',
      diagnosis: `Tus últimos 7 días están en línea con tu media de las últimas 4 semanas. ${CONTEXT}`,
    };
  } else if (acwr <= 1.50) {
    return {
      zone: 'overload_risk',
      label: 'Carga aguda elevada (1,30–1,50)',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      riskLevel: 'Carga reciente por encima de tu media de 4 semanas',
      injuryRiskPctFormatted: 'Carga aguda elevada',
      diagnosis: `Tus últimos 7 días superan claramente tu media de 4 semanas. Los tejidos (sóleos, tendones) se adaptan más despacio que el sistema cardiovascular: vigila las sensaciones. ${CONTEXT}`,
    };
  }
  return {
    zone: 'danger_overtraining',
    label: 'Carga aguda muy elevada (> 1,50)',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    riskLevel: 'Carga reciente muy por encima de tu media de 4 semanas',
    injuryRiskPctFormatted: 'Carga aguda muy elevada',
    diagnosis: `Tus últimos 7 días superan en más de un 50 % tu media de las últimas 4 semanas. ${CONTEXT}`,
  };
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

      const zoneInfo = getACWRZone(roundedAcwr, chronicSum);

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

  const currentZone = getACWRZone(latestPoint.acwr, latestPoint.chronicLoad28dTotal);

  // Generate Coach Miguel's contextual tactical advice
  let coachTacticalAdvice = '';
  const actionableSteps: string[] = [];

  // Consejos descriptivos: sin cifras que no salgan de tus datos. Qué hacer hoy lo
  // decide el motor de readiness; la descarga, si hace falta, la genera el motor.
  const ratio = latestPoint.acwr.toFixed(2).replace('.', ',');
  if (latestPoint.chronicLoad28dTotal <= 0) {
    coachTacticalAdvice = 'Aún no hay carga de las últimas 4 semanas para comparar. Sincroniza Suunto.';
    actionableSteps.push('Sincroniza Suunto para tener historial de carga.');
  } else if (latestPoint.acwr < 0.80) {
    coachTacticalAdvice = `Tu ratio es ${ratio}: estás cargando menos que tu media de 4 semanas. Si es una descarga buscada, bien; al volver a subir, hazlo de forma gradual para no disparar la carga de golpe.`;
    actionableSteps.push('Vuelve a subir la carga de forma gradual, no de golpe.');
  } else if (latestPoint.acwr <= 1.30) {
    coachTacticalAdvice = `Tu ratio es ${ratio}: tu carga reciente está en línea con la habitual. Sigue el plan y vigila que los rodajes sigan en ZoneSense verde.`;
    actionableSteps.push('Sigue el plan previsto.');
  } else if (latestPoint.acwr <= 1.50) {
    coachTacticalAdvice = `Tu ratio es ${ratio} (${weeklyChangePct >= 0 ? '+' : ''}${weeklyChangePct}% frente a la semana anterior): has cargado bastante más de lo habitual. Si notas piernas pesadas, dolor o el semáforo del día sale ámbar o rojo, sustituye la intensidad por algo suave.`;
    actionableSteps.push('No añadas kilómetros ni desnivel extra esta semana.');
    actionableSteps.push('Haz el check-in cada mañana y adapta la sesión si el semáforo lo indica.');
  } else {
    coachTacticalAdvice = `Tu ratio es ${ratio}: tu carga de 7 días supera en más de un 50 % tu media de 4 semanas. No es un diagnóstico por sí solo, pero es mucha carga nueva de golpe: considera una descarga y mira cómo responden tu HRV, tu sueño y tus sensaciones.`;
    actionableSteps.push('Considera una descarga (la genera el motor según el semáforo del día).');
    actionableSteps.push('Evita bajadas largas y rápidas hasta que la carga se normalice.');
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
