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
    lines.push(`- ${c.date}: ${c.fromSuunto ? `${tag('real')} (Suunto)` : `${tag('real')} (declarado por el atleta)`} HRV ${c.hrvRmssd} ms (referencia ${c.hrvBaseline} ms), sueño ${c.sleepHours} h${c.napMinutes ? ` (+ ${c.napMinutes} min que Suunto marcó como siesta; puede ser parte de la noche, no se suman)` : ''}${c.recoveryPct != null ? `, Recovery Suunto ${c.recoveryPct}%` : ''}, semáforo ${tag('derived')} ${c.status}`);
  }
  // El estado de hoy se recalcula aquí con los datos crudos; el del cliente solo puede endurecerlo
  const today = verifyTodayReadiness(lc);
  if (today) lines.push(`- ${tag('derived')} ${describeReadiness(today).split('\n').join(`\n  ${tag('derived')} `)}`);
  else if (lc.todayReadiness) lines.push('- Estado de readiness de hoy: no verificable (la app no envió los datos del check-in). No supongas un nivel ni unos límites.');
  lines.push(`- ${describeDataWindows()}`);
  return lines.join('\n');
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Carga enviada por el cliente (TSB, TSS 7 días, CTL), saneada. */
function loadInputs(load: any) {
  const ctl = finite(load?.ctl);
  return { tsb: finite(load?.tsb), weeklyTss: finite(load?.weeklyTss), weeklyThresholds: weeklyLoadThresholds(ctl ?? undefined) };
}

function plannedFrom(w: any) {
  return w && typeof w === 'object' ? { type: typeof w.type === 'string' ? w.type : undefined, plannedDurationMin: finite(w.plannedDurationMin) ?? undefined } : null;
}

/**
 * Estado de hoy para el chat y el plan: se recalcula con los datos crudos del check-in
 * (todayReadinessInputs) y la carga del contexto. El todayReadiness del cliente solo
 * puede endurecerlo. Sin datos crudos → null (no se describe un estado sin verificar).
 */
export function verifyTodayReadiness(lc: any): ReadinessState | null {
  const i = lc?.todayReadinessInputs;
  if (!i || typeof i !== 'object') return null;
  const computed = evaluateReadiness({
    hrvRmssd: finite(i.hrvRmssd),
    hrvBaseline: finite(i.hrvBaseline),
    sleepHours: finite(i.sleepHours),
    muscleSoreness: finite(i.muscleSoreness),
    stressLevel: finite(i.stressLevel),
    recoveryPct: finite(i.recoveryPct),
    ...loadInputs(lc),
    plannedWorkout: plannedFrom(i.plannedWorkout),
  });
  return strictestReadiness(computed, lc.todayReadiness);
}

/**
 * Estado de readiness para adaptar la sesión. El servidor SIEMPRE lo recalcula con el
 * motor a partir del check-in y de la carga que envía el cliente (readinessInputs:
 * TSB, TSS 7 días, CTL). El estado que calculó el cliente solo puede endurecerlo.
 */
export function resolveReadinessState(body: any): ReadinessState {
  const { readinessState, readinessInputs, checkIn, athleteProfile, originalWorkout } = body || {};
  const computed = evaluateReadiness({
    hrvRmssd: checkIn?.hrvRmssd,
    hrvBaseline: athleteProfile?.baselineHrv || checkIn?.hrvBaseline,
    sleepHours: checkIn?.sleepHours,
    muscleSoreness: checkIn?.muscleSoreness,
    stressLevel: checkIn?.stressLevel,
    recoveryPct: checkIn?.readinessScore,
    ...loadInputs(readinessInputs),
    plannedWorkout: plannedFrom(originalWorkout),
  });
  return strictestReadiness(computed, readinessState);
}

/** Carrera objetivo por defecto (si la app no la envía). */
export const DEFAULT_TARGET = { name: 'Transvulcania 2027', distanceKm: 73, elevationGainM: 4350, elevationLossM: 4057, location: 'La Palma', dateConfirmed: false } as const;

/**
 * La carrera objetivo en texto para Miguel, a partir de los DATOS de la app (no escrita
 * a mano en el prompt): si el atleta cambia de objetivo, Miguel cambia con él.
 */
export function describeTargetRace(t: any): string {
  const r = t && typeof t === 'object' && t.name ? t : DEFAULT_TARGET;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const parts = [
    r.date ? `fecha ${r.date}${r.dateConfirmed === false ? ' (ESTIMADA: la organización aún no la ha publicado; dilo si la mencionas)' : ''}` : 'fecha sin dato',
    n(r.distanceKm) ? `${r.distanceKm} km` : 'distancia sin dato',
    n(r.elevationGainM) ? `+${r.elevationGainM} m D+` : 'D+ sin dato',
    n(r.elevationLossM) ? `-${r.elevationLossM} m D-` : null,
    r.location ? `en ${r.location}` : null,
  ].filter(Boolean);
  return `${r.name}: ${parts.join(', ')}.${r.terrainDescription ? ` Terreno: ${r.terrainDescription}` : ''}`;
}
