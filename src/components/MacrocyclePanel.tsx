import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Compass, Loader2, RefreshCw, HelpCircle } from 'lucide-react';
import type { AthleteProfile, MacrocyclePlan, TargetRace, Workout } from '../types';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import { evaluateMarkers, PHASE_LABEL, weekActual } from '../brain/macrocycle';
import { mondayOfKey } from '../utils/weekStructure';
import { localDateKey } from '../utils/trainingLoad';

interface Props {
  targetRace: TargetRace;
  profile: AthleteProfile;
  workouts: Workout[];
}

/** '/10' va pegado al número; el resto de unidades, con espacio. */
const unitText = (u?: string) => (!u ? '' : u.startsWith('/') ? u : ` ${u}`);

const KIND_LABEL = { load: 'Carga', recovery: 'Descarga', taper: 'Afinado', race: 'Carrera' } as const;
const KIND_COLOR = {
  load: 'bg-amber-500/70',
  recovery: 'bg-emerald-500/60',
  taper: 'bg-sky-500/60',
  race: 'bg-red-500/80',
} as const;

/**
 * Plan hasta la carrera: el CÓDIGO fija fechas, fases y topes semanales
 * (src/brain/macrocycle.ts); Miguel solo explica cada fase.
 */
export const MacrocyclePanel: React.FC<Props> = ({ targetRace, profile, workouts }) => {
  const [macro, setMacro] = useState<MacrocyclePlan | null>(() => StorageService.getMacrocycle());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = localDateKey();
  const thisMonday = mondayOfKey(today);
  const checkIns = useMemo(() => StorageService.getCheckIns().filter((c) => !c.isSample), [workouts]);

  const create = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await ApiService.generateMacrocycle(targetRace, profile, workouts, checkIns, macro);
      StorageService.saveMacrocycle(r.macrocycle);
      StorageService.markMacroLogSeen(r.macrocycle);
      setMacro(r.macrocycle);
      setNote(r.note ?? (r.aiUsed ? null : 'Plan guardado con los textos del sistema.'));
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el plan.');
    } finally {
      setBusy(false);
    }
  };

  const current = macro?.weeks?.find((w) => w.monday === thisMonday) ?? null;
  const currentActual = current ? weekActual(workouts, checkIns, current.monday) : null;
  const stale = !!macro && macro.raceDate !== targetRace.date;
  const markerCtx = {
    aetHr: profile.aetHr || null,
    gutMaxCarbsPerHour: StorageService.getGutProfile()?.currentMaxCarbsPerHour ?? null,
    driftTestResultPct: profile.driftTestResultPct ?? null,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-zinc-100 flex items-center space-x-2">
            <Compass className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Plan hasta {targetRace.name}</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Fases y topes semanales calculados a partir de tu carga real. Tu estado de cada mañana sigue mandando.
          </p>
        </div>
        <button
          onClick={create}
          disabled={busy}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-xs font-black text-zinc-950 transition-all"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{macro ? 'Rehacer plan hasta la carrera' : 'Crear plan hasta la carrera'}</span>
        </button>
      </div>

      {error && <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl p-3">{error}</div>}
      {note && <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/40 rounded-xl p-3">{note}</div>}
      {stale && (
        <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/40 rounded-xl p-3">
          La fecha de la carrera ha cambiado ({macro!.raceDate} → {targetRace.date}). Rehaz el plan.
        </div>
      )}

      {!macro?.weeks?.length ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-400">
          Aún no hay plan hasta la carrera. Pulsa «Crear plan hasta la carrera»: el sistema mide tu carga de las últimas semanas y reparte las fases hasta el {targetRace.date}.
        </div>
      ) : (
        <>
          {/* Línea de tiempo: una barra por semana, altura = horas objetivo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-end gap-[2px] h-24 overflow-hidden" aria-label="Horas objetivo por semana">
              {(() => {
                const maxH = Math.max(...macro.weeks!.map((w) => w.targetHours), 1);
                return macro.weeks!.map((w) => (
                  <div
                    key={w.monday}
                    title={`${w.monday} · ${PHASE_LABEL[w.phase]} · ${KIND_LABEL[w.kind]} · ${w.targetHours} h · ${w.targetElevationGainM} m D+`}
                    className={`flex-1 min-w-0 rounded-t ${KIND_COLOR[w.kind]} ${w.monday === thisMonday ? 'ring-2 ring-white' : ''} ${w.monday < thisMonday ? 'opacity-40' : ''}`}
                    style={{ height: `${Math.max(8, (w.targetHours / maxH) * 100)}%` }}
                  />
                ));
              })()}
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-zinc-400">
              {(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((k) => (
                <span key={k} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${KIND_COLOR[k]}`} />{KIND_LABEL[k]}</span>
              ))}
              <span>
                · {macro.totalWeeks} semanas desde el {macro.startDate}
                {macro.baseline ? ` · base medida ${macro.baseline.weeklyHours} h y ${macro.baseline.weeklyElevationGainM} m D+/semana${macro.baseline.conservative ? ' (pocos datos: base conservadora)' : ''}` : ''}
              </span>
            </div>
          </div>

          {current && currentActual && (
            <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-4 font-black text-zinc-100">
                Esta semana · {PHASE_LABEL[current.phase]} · {KIND_LABEL[current.kind]} (semana {current.index + 1} de {macro.totalWeeks})
              </div>
              <div><span className="text-zinc-500 block">Horas a pie</span><b className="text-zinc-100">{currentActual.hours}</b> / {current.targetHours} h</div>
              <div><span className="text-zinc-500 block">D+</span><b className="text-zinc-100">{currentActual.elevationGainM}</b> / {current.targetElevationGainM} m</div>
              <div><span className="text-zinc-500 block">Tirada más larga</span><b className="text-zinc-100">{currentActual.longestRunMin}</b> / {current.longRunMin} min</div>
              <div><span className="text-zinc-500 block">Días en rojo</span><b className="text-zinc-100">{currentActual.redDays}</b></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {macro.mesocycles.map((m) => {
              const active = thisMonday >= m.startDate && thisMonday <= m.endDate;
              const started = m.startDate <= today;
              const progress = started ? evaluateMarkers(m, workouts, checkIns, markerCtx, today) : [];
              return (
                <div key={m.id} className={`bg-zinc-900 border rounded-2xl p-5 space-y-3 ${active ? 'border-amber-500/50' : 'border-zinc-800'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-amber-400 border border-zinc-700">
                      {m.startDate} → {m.endDate}
                    </span>
                    <span className="text-xs font-black text-zinc-600">{active ? 'EN CURSO' : `Fase ${m.number}`}</span>
                  </div>
                  <h4 className="text-sm font-black text-zinc-100">{m.title}</h4>
                  <div className="text-xs font-bold text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/30">{m.focus}</div>
                  {m.rationale && <p className="text-xs text-zinc-400 leading-relaxed">{m.rationale}</p>}
                  {m.keyWorkouts?.length > 0 && (
                    <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                      {m.keyWorkouts.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                  )}
                  {m.markers?.length ? (
                    <div className="border-t border-zinc-800/80 pt-3 space-y-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Adaptaciones buscadas</span>
                      {m.markers.map((mk) => {
                        const p = progress.find((x) => x.marker.id === mk.id);
                        const Icon = p?.achieved === true ? CheckCircle2 : p?.achieved === false ? Circle : HelpCircle;
                        return (
                          <div key={mk.id} className="flex items-start gap-1.5 text-xs text-zinc-300">
                            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${p?.achieved ? 'text-emerald-400' : 'text-zinc-500'}`} />
                            <span>
                              {mk.label}
                              {mk.target !== null ? ` · objetivo ${mk.target}${unitText(mk.unit)}` : ''}
                              {started ? ` · ${p?.value != null ? `medido ${p.value}${unitText(mk.unit)}` : 'sin dato'}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {macro.log?.length ? (
            <details className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400">
              <summary className="cursor-pointer font-bold text-zinc-300">Cambios del plan (versión {macro.version ?? 1})</summary>
              <ul className="mt-2 space-y-1">
                {[...macro.log].reverse().map((l, i) => <li key={i}><b className="text-zinc-300">{l.date}</b> · {l.message}</li>)}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
};
