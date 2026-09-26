import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Footprints, Minus } from 'lucide-react';
import type { Workout } from '../types';
import { computeMechanicalLoad, MIN_COMPARABLE_WEEKS, type MechanicalMetric } from '../utils/mechanicalLoad';

/**
 * Carga mecánica a pie (descriptiva): D−, D+, km y horas de los últimos 7 días
 * frente a la media semanal de las 4 semanas previas. Sin colores de alerta: no decide nada.
 */
export const MechanicalLoadCard: React.FC<{ workouts: Workout[] }> = ({ workouts }) => {
  const s = useMemo(() => computeMechanicalLoad(workouts), [workouts]);
  const rows: Array<{ label: string; m: MechanicalMetric; unit: string }> = [
    { label: 'Desnivel negativo (D−)', m: s.descent, unit: 'm' },
    { label: 'Desnivel positivo (D+)', m: s.ascent, unit: 'm' },
    { label: 'Distancia', m: s.km, unit: 'km' },
    { label: 'Tiempo', m: s.hours, unit: 'h' },
  ];
  const Arrow = ({ r }: { r: number | null }) =>
    r == null ? null : r > 1.05 ? <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300" /> : r < 0.95 ? <ArrowDownRight className="w-3.5 h-3.5 text-zinc-300" /> : <Minus className="w-3.5 h-3.5 text-zinc-500" />;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Footprints className="w-4 h-4 text-cyan-400" />
          Carga mecánica a pie · últimos 7 días
        </h3>
        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
          Carrera, trail, senderismo, caminata y marcha nórdica (la bici no cuenta). Frente a la media semanal de las 4 semanas anteriores.
          Es un dato: no cambia el estado de readiness ni el desnivel permitido.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map(({ label, m, unit }) => (
          <div key={label} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 space-y-1">
            <span className="text-[10px] text-zinc-400 block">{label}</span>
            <span className="text-xl font-black font-mono text-zinc-100">
              {m.last7} <span className="text-xs text-zinc-400 font-semibold">{unit}</span>
            </span>
            {m.priorWeeklyAvg != null && (
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                <Arrow r={m.ratio} />
                <span>media {m.priorWeeklyAvg} {unit}/sem{m.ratio != null ? ` · ${m.ratio.toFixed(2).replace('.', ',')}×` : ''}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {!s.comparable && (
        <p className="text-[11px] text-zinc-500">
          Sin historial suficiente para comparar: hubo actividad a pie en {s.priorWeeksWithActivity} de las 4 semanas previas (hacen falta {MIN_COMPARABLE_WEEKS}).
        </p>
      )}
    </div>
  );
};
