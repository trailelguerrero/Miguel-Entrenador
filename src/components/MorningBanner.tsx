import { localDateKey } from '../utils/trainingLoad';
import React from 'react';
import { AlertCircle, Heart, ArrowRight, ShieldAlert, Sparkles, CheckCircle2, Compass } from 'lucide-react';
import { DailyCheckIn, Workout, WatchZoneAdvice } from '../types';

interface MorningBannerProps {
  checkIn?: DailyCheckIn;
  todayWorkout?: Workout;
  onOpenCheckIn: () => void;
  onAdaptSession: () => void;
  isAdapting?: boolean;
  isSetupIncomplete?: boolean;
  onOpenSetupGuide?: () => void;
  /** La sesión de hoy ya está hecha (y no queda ninguna planificada pendiente): se muestra la recuperación. */
  todayDone?: boolean;
  /** Título de lo que se hizo hoy (p. ej. "Trail running 13.43 km"). */
  todayDoneTitle?: string;
}

/** Pauta de recuperación tras la sesión, según el estado del día (texto del código, sin cifras). */
export function recoveryAdvice(status: DailyCheckIn['status'] | undefined): string {
  switch (status) {
    case 'fatigued':
      return 'Hoy nada más de entrenamiento. Prioriza dormir bien esta noche, comer e hidratarte. Mañana decide el check-in: si sigue en rojo, toca descanso o algo muy suave.';
    case 'moderate':
      return 'Recupera bien esta tarde (sueño, comida, hidratación). Mañana, si el check-in no mejora, rodaje suave sin series.';
    case 'optimal':
      return 'Buen día para asimilar el trabajo: come, hidrátate y duerme. Mañana el check-in confirma la siguiente sesión.';
    default:
      return 'Recupera bien esta tarde. Mañana registra el check-in (HRV y sueño) para que Miguel valore la siguiente sesión.';
  }
}

export const MorningBanner: React.FC<MorningBannerProps> = ({
  checkIn,
  todayWorkout,
  onOpenCheckIn,
  onAdaptSession,
  isAdapting,
  isSetupIncomplete,
  onOpenSetupGuide,
  todayDone,
  todayDoneTitle,
}) => {
  // Puntuación = Recovery (Balance) medio del día según Suunto
  const recoveryText = checkIn?.readinessScore != null
    ? ` • Recovery Suunto ${checkIn.readinessScore}%${checkIn.date === localDateKey() ? ' (día en curso)' : ''}`
    : '';

  return (
    <div className="space-y-3">
      {/* Guía de Setup Callout si no se ha completado */}
      {isSetupIncomplete && onOpenSetupGuide && (
        <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-100 flex items-center space-x-1.5">
                <span>Guía de Setup Inicial de Miguel</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                  Recomendado
                </span>
              </h4>
              <p className="text-xs text-zinc-400">
                Calibra tus parámetros clave de ultra trail: entrevista de montaña, umbrales AeT/AnT, objetivo Transvulcania y datos de Suunto.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSetupGuide}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-zinc-950 text-xs font-black transition-all shadow-md shrink-0 flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Iniciar Guía de Setup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Morning Check-in / Readiness Status */}
      {!checkIn && (
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-100 flex items-center space-x-1.5">
                <span>Registra tu HRV matutina de Suunto</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-semibold">
                  Pendiente
                </span>
              </h4>
              <p className="text-xs text-zinc-400">
                Miguel necesita tu variabilidad cardíaca (rMSSD) y sueño de anoche para validar o ajustar la sesión de hoy.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenCheckIn}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all border border-zinc-700 shrink-0 flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Check-in Rápido</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sesión de hoy hecha: recuperación en lugar del aviso para entrenar */}
      {todayDone && (
        <div className="bg-zinc-900/60 border border-emerald-900/40 rounded-2xl p-3.5 flex items-start space-x-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-200 flex flex-wrap items-center gap-2">
              <span>Sesión de hoy hecha{todayDoneTitle ? `: ${todayDoneTitle}` : ''}</span>
              {checkIn && checkIn.status !== 'unknown' && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    checkIn.status === 'fatigued' ? 'bg-red-500/10 text-red-400' : checkIn.status === 'moderate' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  Estado de hoy: {checkIn.status === 'fatigued' ? 'fatiga' : checkIn.status === 'moderate' ? 'recuperación moderada' : 'bien'}
                  {checkIn.hrvRmssd > 0 && checkIn.hrvBaseline > 0 ? ` · HRV ${checkIn.hrvRmssd} ms vs ${checkIn.hrvBaseline} ms` : ''}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{recoveryAdvice(checkIn?.status)}</p>
          </div>
        </div>
      )}

      {!todayDone && checkIn && checkIn.status === 'fatigued' && (
        <div className="bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-950 border border-red-800/40 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30 shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-extrabold text-red-400 uppercase tracking-wide">
                    Fatiga Detectada por Suunto
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    (HRV: {checkIn.hrvRmssd}ms vs {checkIn.hrvBaseline}ms base • {checkIn.sleepHours}h sueño{recoveryText})
                  </span>
                </div>
                <p className="text-xs text-zinc-200 mt-1 font-medium leading-relaxed">
                  <strong className="text-amber-400">Coach Miguel:</strong> "{checkIn.coachAdvice}"
                </p>
              </div>
            </div>

            {todayWorkout && !todayWorkout.wasAdapted && todayWorkout.type !== 'rest' && (
              <button
                onClick={onAdaptSession}
                disabled={isAdapting}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-zinc-950 text-xs font-black transition-all shadow-lg shrink-0 flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAdapting ? 'Adaptando con Miguel...' : 'Adaptar sesión de hoy'}</span>
              </button>
            )}

            {todayWorkout?.wasAdapted && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center space-x-1.5 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sesión ya adaptada a tu fatiga</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!todayDone && checkIn && checkIn.status === 'moderate' && (
        <div className="bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-950 border border-amber-800/40 rounded-2xl p-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wide">
                    Recuperación Moderada
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    (HRV: {checkIn.hrvRmssd}ms • Sueño: {checkIn.sleepHours}h{recoveryText})
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  <strong className="text-amber-400">Miguel:</strong> "{checkIn.coachAdvice}"
                </p>
              </div>
            </div>
            <button
              onClick={onOpenCheckIn}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 shrink-0 cursor-pointer"
            >
              Editar Check-in
            </button>
          </div>
        </div>
      )}

      {!todayDone && checkIn && checkIn.status === 'optimal' && (
        <div className="bg-zinc-900/60 border border-emerald-900/30 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-200 flex items-center space-x-2">
                <span>Sistema Parasimpático Listo</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  HRV {checkIn.hrvRmssd}ms • Sueño {checkIn.sleepHours}h{recoveryText}
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Luz verde para la sesión de hoy. Respeta las pulsaciones que marca la sesión.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenCheckIn}
            className="text-xs text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 shrink-0 cursor-pointer"
          >
            Detalles
          </button>
        </div>
      )}
    </div>
  );
};
