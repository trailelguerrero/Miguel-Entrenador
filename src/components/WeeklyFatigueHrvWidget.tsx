import React, { useMemo, useState } from 'react';
import { Activity, Battery, Calendar, Info, TrendingDown } from 'lucide-react';
import { localDateKey } from '../utils/trainingLoad';
import { DailyCheckIn, AthleteProfile, WeeklyHrvFatigueTrend } from '../types';

/**
 * HRV nocturna y FC de reposo por semanas (últimas 4) y noche a noche (28 días).
 * Solo DESCRIBE: compara con tu referencia. No predice ni programa descargas;
 * qué hacer hoy lo decide el motor de readiness (src/brain/readiness.ts).
 * Los colores por noche usan los mismos cortes que el readiness (−10 % / −20 %).
 */
interface WeeklyFatigueHrvWidgetProps {
  profile: AthleteProfile;
  checkIns: DailyCheckIn[];
}

/** Clasificación descriptiva de la HRV media semanal frente a la referencia. */
export function classifyWeek(avgHrv: number, hrvDevPct: number, baselineHrv: number): WeeklyHrvFatigueTrend['hrvClassification'] {
  if (!(avgHrv > 0) || !(baselineHrv > 0)) return 'no_data';
  if (hrvDevPct < -10) return 'below';
  if (hrvDevPct < -5) return 'slightly_below';
  return 'in_reference';
}

const CLASS_LABEL: Record<WeeklyHrvFatigueTrend['hrvClassification'], { text: string; color: string }> = {
  no_data: { text: 'Sin HRV o sin referencia', color: 'text-stone-400' },
  in_reference: { text: 'HRV en tu referencia', color: 'text-emerald-400' },
  slightly_below: { text: 'HRV algo por debajo', color: 'text-amber-400' },
  below: { text: 'HRV por debajo (> 10 %)', color: 'text-red-400' },
};

export const WeeklyFatigueHrvWidget: React.FC<WeeklyFatigueHrvWidgetProps> = ({ profile, checkIns }) => {
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(4);
  const [activeTab, setActiveTab] = useState<'trends' | 'daily_chart'>('trends');

  // Misma HRV de referencia que el resto de la app: la del perfil
  const baselineHrv = profile.baselineHrv || 0;
  const baselineRestingHr = profile.restingHr || 0;

  const weeklyTrends = useMemo<WeeklyHrvFatigueTrend[]>(() => {
    const labels = ['Hace 3 semanas', 'Hace 2 semanas', 'Semana pasada', 'Últimos 7 días'];
    const avgOf = (vals: Array<number | undefined>) => {
      const v = vals.filter((x): x is number => typeof x === 'number' && x > 0);
      return v.length > 0 ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0;
    };
    // Semanas por FECHA (no por posición): la 4ª son los últimos 7 días hasta hoy
    const today = new Date();
    const keyDaysAgo = (n: number) => localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
    const weeks: WeeklyHrvFatigueTrend[] = [];
    for (let w = 0; w < 4; w++) {
      const from = keyDaysAgo(27 - w * 7);
      const to = keyDaysAgo(21 - w * 7);
      const days = checkIns.filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date));
      if (days.length === 0) continue;
      const avgHrv = avgOf(days.map((d) => d.hrvRmssd));
      const avgRestHr = avgOf(days.map((d) => d.restingHr));
      const hrvDevPct = baselineHrv > 0 && avgHrv > 0 ? Math.round(((avgHrv - baselineHrv) / baselineHrv) * 1000) / 10 : 0;
      const restHrDelta = baselineRestingHr > 0 && avgRestHr > 0 ? Math.round((avgRestHr - baselineRestingHr) * 10) / 10 : 0;
      weeks.push({
        weekIndex: w + 1,
        weekLabel: labels[w],
        startDate: days[0].date,
        endDate: days[days.length - 1].date,
        avgHrvRmssd: avgHrv,
        baselineHrv,
        hrvDeviationPct: hrvDevPct,
        avgRestingHr: avgRestHr,
        restingHrDelta: restHrDelta,
        avgSleepQuality: avgOf(days.map((d) => d.sleepQuality)),
        avgMuscleSoreness: avgOf(days.map((d) => d.muscleSoreness)),
        avgStressLevel: avgOf(days.map((d) => d.stressLevel)),
        avgReadinessScore: Math.round(avgOf(days.map((d) => d.readinessScore))),
        totalDays: days.length,
        hrvClassification: classifyWeek(avgHrv, hrvDevPct, baselineHrv),
        isCurrentWeek: w === 3,
      });
    }
    return weeks;
  }, [checkIns, baselineHrv, baselineRestingHr]);

  const last28 = useMemo(() => {
    const from = localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 27));
    return checkIns.filter((c) => c.date >= from && c.hrvRmssd > 0).sort((a, b) => a.date.localeCompare(b.date));
  }, [checkIns]);

  if (weeklyTrends.length === 0) {
    return (
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 text-sm text-stone-400">
        No hay check-ins de HRV en las últimas 4 semanas. Sincroniza Suunto o registra el check-in matutino para ver la tendencia.
      </div>
    );
  }

  const selectedWeek = weeklyTrends.find((w) => w.weekIndex === selectedWeekIndex) || weeklyTrends[weeklyTrends.length - 1];
  const chartMax = Math.max(65, ...last28.map((c) => c.hrvRmssd * 1.1));
  const nightColor = (hrv: number) => {
    if (!(baselineHrv > 0)) return 'bg-stone-500 group-hover:bg-stone-400';
    const pct = ((hrv - baselineHrv) / baselineHrv) * 100;
    return pct < -20 ? 'bg-red-500 group-hover:bg-red-400' : pct < -10 ? 'bg-amber-500 group-hover:bg-amber-400' : 'bg-emerald-500 group-hover:bg-emerald-400';
  };
  const tabBtn = (active: boolean) =>
    `px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
      active ? 'bg-amber-500 text-stone-950 shadow-md font-black' : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
    }`;

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
      <div className="space-y-1.5 border-b border-stone-800 pb-5">
        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider border border-amber-500/30 inline-flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Suunto y check-ins diarios
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-stone-100 flex items-center gap-2.5">
          <Battery className="w-6 h-6 text-amber-400" />
          HRV y FC de reposo por semanas
        </h2>
        <p className="text-xs text-stone-300 max-w-3xl leading-relaxed">
          Cómo evolucionan tu <strong>HRV nocturna (rMSSD)</strong> y tu <strong>FC de reposo</strong> frente a tu referencia
          {baselineHrv > 0 ? ` (${baselineHrv} ms)` : ' (aún sin referencia de HRV)'}. Es una descripción: la sesión de cada día la decide el estado de readiness.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-stone-800/80 pb-3">
        <button onClick={() => setActiveTab('trends')} className={tabBtn(activeTab === 'trends')}>
          <TrendingDown className="w-4 h-4" />
          <span>Últimas 4 semanas</span>
        </button>
        <button onClick={() => setActiveTab('daily_chart')} className={tabBtn(activeTab === 'daily_chart')}>
          <Activity className="w-4 h-4" />
          <span>Noche a noche (28 días)</span>
        </button>
      </div>

      {activeTab === 'trends' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Comparativa semanal
            </h3>
            <span className="text-xs text-stone-400">
              Referencia HRV: <strong className="text-stone-200">{baselineHrv || '—'} ms</strong> | FC reposo: <strong className="text-stone-200">{baselineRestingHr || '—'} bpm</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {weeklyTrends.map((week) => {
              const isSelected = selectedWeek.weekIndex === week.weekIndex;
              const cls = CLASS_LABEL[week.hrvClassification];
              return (
                <div
                  key={week.weekIndex}
                  onClick={() => setSelectedWeekIndex(week.weekIndex)}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    isSelected ? 'bg-stone-850 border-amber-500 shadow-xl shadow-amber-500/10' : week.isCurrentWeek ? 'bg-stone-900 border-amber-500/50' : 'bg-stone-950 border-stone-800/80 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-stone-200">{week.weekLabel}</span>
                    <span className="text-[10px] text-stone-400 font-mono">{week.startDate.slice(5)} al {week.endDate.slice(5)}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <span className="text-[10px] text-stone-400 block font-medium">HRV media nocturna</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-stone-100 font-mono">{week.avgHrvRmssd || '—'}</span>
                      {week.avgHrvRmssd > 0 && baselineHrv > 0 && (
                        <span className={`text-xs font-bold font-mono ${cls.color}`}>
                          {week.hrvDeviationPct > 0 ? `+${week.hrvDeviationPct}%` : `${week.hrvDeviationPct}%`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                    <div className="bg-stone-950 p-2 rounded-lg border border-stone-850">
                      <span className="text-[9px] text-stone-400 block">FC reposo</span>
                      <span className="font-bold text-stone-200">{week.avgRestingHr || '—'} bpm</span>
                    </div>
                    <div className="bg-stone-950 p-2 rounded-lg border border-stone-850">
                      <span className="text-[9px] text-stone-400 block">Agujetas</span>
                      <span className="font-bold text-stone-200">{week.avgMuscleSoreness || '—'}/10</span>
                    </div>
                  </div>
                  <div className={`pt-2 border-t border-stone-800/80 text-[11px] font-bold ${cls.color}`}>{cls.text}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              Detalle: {selectedWeek.weekLabel}
            </h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              {selectedWeek.totalDays} noche{selectedWeek.totalDays === 1 ? '' : 's'} con check-in.
              {selectedWeek.avgHrvRmssd > 0 ? (
                <> HRV media <strong>{selectedWeek.avgHrvRmssd} ms</strong>{baselineHrv > 0 ? <> ({selectedWeek.hrvDeviationPct}% frente a tu referencia de {baselineHrv} ms)</> : null}.</>
              ) : (
                ' Sin HRV medida.'
              )}
              {selectedWeek.avgRestingHr > 0 && baselineRestingHr > 0 ? (
                <> FC de reposo {selectedWeek.avgRestingHr} bpm ({selectedWeek.restingHrDelta >= 0 ? `+${selectedWeek.restingHrDelta}` : selectedWeek.restingHrDelta} bpm frente a tu referencia).</>
              ) : null}{' '}
              La HRV baja también por sueño, estrés, calor, alcohol o enfermedad: la app no puede saber la causa.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'daily_chart' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              HRV noche a noche (últimos 28 días)
            </h3>
            {baselineHrv > 0 && (
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ≥ −10 %</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> −10 a −20 %</span>
                <span className="flex items-center gap-1 text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> &lt; −20 %</span>
              </div>
            )}
          </div>

          <div className="bg-stone-950 border border-stone-850 p-4 rounded-2xl overflow-x-auto">
            <div className="min-w-[650px] flex items-end justify-between gap-1.5 h-44 pt-6 pb-2 border-b border-stone-800 relative">
              {baselineHrv > 0 && (
                <div
                  className="absolute left-0 right-0 border-b border-dashed border-stone-500 pointer-events-none z-10 flex justify-end"
                  style={{ bottom: `${(baselineHrv / chartMax) * 100}%` }}
                >
                  <span className="text-[10px] text-stone-400 font-mono bg-stone-950 px-1 -translate-y-2">Referencia {baselineHrv} ms</span>
                </div>
              )}
              {last28.map((entry, idx) => (
                <div key={entry.date} className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-stone-900 border border-stone-750 text-stone-100 text-[10px] p-1.5 rounded-lg whitespace-nowrap shadow-xl z-20 pointer-events-none font-mono">
                    <div>{entry.date}</div>
                    <div>HRV: {entry.hrvRmssd} ms{entry.restingHr ? ` | FC: ${entry.restingHr} bpm` : ''}</div>
                  </div>
                  <div className={`w-full max-w-[14px] rounded-t-sm transition-all ${nightColor(entry.hrvRmssd)}`} style={{ height: `${Math.min(100, Math.max(5, (entry.hrvRmssd / chartMax) * 100))}%` }} />
                  <span className="text-[8px] text-stone-500 font-mono">{idx % 3 === 0 ? entry.date.slice(8) : ''}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-stone-500 pt-2 font-mono">
              <span>Hace 28 días</span>
              <span>Hoy</span>
            </div>
          </div>
          <p className="text-[11px] text-stone-400">Colores con los mismos cortes que el estado de readiness para una noche (HRV −10 % y −20 % frente a tu referencia).</p>
        </div>
      )}
    </div>
  );
};
