// Hechos del atleta convertidos en texto para los prompts (sin recalcular nada:
// los números vienen calculados del cliente o de src/brain).
import { describeDataWindows } from '../../src/brain/dataWindows.js';
import { describeReadiness, evaluateReadiness, strictestReadiness, type ReadinessState } from '../../src/brain/readiness.js';
import { describeLoadHistory, weeklyLoadThresholds } from '../../src/utils/trainingLoad.js';
import { tag } from '../../src/brain/provenance.js';

/** Disponibilidad: solo la que el atleta declara a mano; lo de Suunto es historial, no disponibilidad. */
export function availabilityLine(p: any): string {
  const days = p?.availableDaysPerWeek;
  if (days && p?.fieldSources?.availableDaysPerWeek === 'manual') {
    return `Disponibilidad declarada por el atleta: ${days} días/semana${days <= 3 ? ' → como máximo 2 sesiones entre semana + tirada larga' : ''}.`;
  }
  if (days) return `Disponibilidad no declarada por el atleta. Según Suunto entrena de media ${days} días/semana (incluye otros deportes); no es un límite.`;
  return 'Disponibilidad no declarada por el atleta.';
}

/** Zonas del reloj y, SOLO si hay tendencia sostenida, la recomendación de cambio. */
export function formatWatchZones(a: any): string {
  if (!a?.watch) return 'sin datos';
  const z = a.watch.zones;
  const base = `FC máx ${a.watch.maxHr ?? '?'}; inicio Z2 ${z?.z2 ?? '?'}, Z3 ${z?.z3 ?? '?'}, Z4 ${z?.z4 ?? '?'}, Z5 ${z?.z5 ?? '?'}`;
  const recs = (a.recommendations || []).map((r: any) => `${r.label} ${r.current}→${r.suggested} (${r.evidence})`);
  return recs.length
    ? `${base}. RECOMENDACIÓN POR TENDENCIA SOSTENIDA: ${recs.join('; ')}. Díselo al atleta.`
    : `${base}. Sin tendencia sostenida que justifique cambiarlas: no recomiendes cambiar zonas por datos de un solo día.${(a.notes || []).length ? ` Notas: ${a.notes.join(' ')}` : ''}`;
}

export function formatLoadContext(lc: any): string {
  if (!lc) return '- Sin datos de carga ni recuperación.';
  const lines: string[] = [];
  if (lc.ctl != null) lines.push(`- ${tag('derived')} CTL ${lc.ctl} · ATL ${lc.atl} · TSB ${lc.tsb}${lc.weeklyTss != null ? ` · TSS últimos 7 días ${lc.weeklyTss}` : ''}`);
  if (lc.loadHistory) lines.push(`- ${tag('derived')} ${describeLoadHistory(lc.loadHistory)}`);
  for (const c of lc.recentCheckIns || []) {
    lines.push(`- ${c.date}: ${c.fromSuunto ? `${tag('real')} (Suunto)` : `${tag('real')} (declarado por el atleta)`} HRV ${c.hrvRmssd} ms (referencia ${c.hrvBaseline} ms), sueño ${c.sleepHours} h${c.recoveryPct != null ? `, Recovery Suunto ${c.recoveryPct}%` : ''}, semáforo ${tag('derived')} ${c.status}`);
  }
  if (lc.todayReadiness) lines.push(`- ${tag('derived')} ${describeReadiness(lc.todayReadiness as ReadinessState).split('\n').join(`\n  ${tag('derived')} `)}`);
  lines.push(`- ${describeDataWindows()}`);
  return lines.join('\n');
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Estado de readiness. El servidor SIEMPRE lo recalcula con el motor a partir del
 * check-in y de la carga que envía el cliente (readinessInputs: TSB, TSS 7 días, CTL).
 * El estado que calculó el cliente solo puede endurecerlo, nunca relajarlo.
 */
export function resolveReadinessState(body: any): ReadinessState {
  const { readinessState, readinessInputs, checkIn, athleteProfile, originalWorkout } = body || {};
  const ctl = finite(readinessInputs?.ctl);
  const computed = evaluateReadiness({
    hrvRmssd: checkIn?.hrvRmssd,
    hrvBaseline: athleteProfile?.baselineHrv || checkIn?.hrvBaseline,
    sleepHours: checkIn?.sleepHours,
    muscleSoreness: checkIn?.muscleSoreness,
    stressLevel: checkIn?.stressLevel,
    recoveryPct: checkIn?.readinessScore,
    tsb: finite(readinessInputs?.tsb),
    weeklyTss: finite(readinessInputs?.weeklyTss),
    weeklyThresholds: weeklyLoadThresholds(ctl ?? undefined),
    plannedWorkout: originalWorkout,
  });
  return strictestReadiness(computed, readinessState);
}
