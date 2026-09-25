import React, { useState } from 'react';
import { X, Heart, Moon, Zap, AlertTriangle, CheckCircle, ArrowRight, Activity } from 'lucide-react';
import { DailyCheckIn } from '../types';
import { computeReadiness } from '../utils/readiness';
import { localDateKey } from '../utils/trainingLoad';
import { StorageService } from '../services/storage';

interface DailyReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (checkIn: DailyCheckIn) => void;
  currentCheckIn?: DailyCheckIn;
  onAdaptSessionRequest?: (checkIn: DailyCheckIn) => void;
}

export const DailyReadinessModal: React.FC<DailyReadinessModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentCheckIn,
  onAdaptSessionRequest,
}) => {
  const todayStr = localDateKey();

  const [restingHr, setRestingHr] = useState<number>(currentCheckIn?.restingHr || 48);
  const [hrvRmssd, setHrvRmssd] = useState<number>(currentCheckIn?.hrvRmssd || 55);
  // Misma HRV de referencia que el resto de la app: la del perfil
  const [hrvBaseline, setHrvBaseline] = useState<number>(StorageService.getProfile().baselineHrv || currentCheckIn?.hrvBaseline || 0);
  const [sleepHours, setSleepHours] = useState<number>(currentCheckIn?.sleepHours || 7.5);
  const [sleepQuality, setSleepQuality] = useState<number>(currentCheckIn?.sleepQuality || 80);
  const [muscleSoreness, setMuscleSoreness] = useState<number>(currentCheckIn?.muscleSoreness || 3);
  const [stressLevel, setStressLevel] = useState<number>(currentCheckIn?.stressLevel || 3);

  if (!isOpen) return null;

  // Calculate readiness status based on HRV deviation and sleep (misma lógica que la sync de Suunto)
  const { hrvDropPct, status: calculatedStatus, coachAdvice, suggestedAction } = computeReadiness({
    hrvRmssd,
    hrvBaseline,
    sleepHours,
    muscleSoreness,
    stressLevel,
  });

  const handleSave = () => {
    const checkIn: DailyCheckIn = {
      date: todayStr,
      restingHr,
      hrvRmssd,
      hrvBaseline,
      sleepHours,
      sleepQuality,
      muscleSoreness,
      stressLevel,
      // La puntuación es el Recovery de Suunto: se conserva si ese día ya venía de Suunto
      readinessScore: currentCheckIn?.date === todayStr ? currentCheckIn.readinessScore : undefined,
      recoverySamples: currentCheckIn?.date === todayStr ? currentCheckIn.recoverySamples : undefined,
      status: calculatedStatus,
      coachAdvice,
      suggestedAction,
    };

    onSave(checkIn);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Check-in Matutino Suunto & HRV</h2>
              <p className="text-xs text-zinc-400">Recuperación nocturna para calibrar la carga de hoy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Suunto Biometrics: HRV & Sleep */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* HRV rMSSD */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HRV Nocturna (rMSSD)</span>
                </span>
                <span className="text-emerald-400 font-bold">{hrvRmssd} ms</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                value={hrvRmssd}
                onChange={(e) => setHrvRmssd(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>Base: {hrvBaseline} ms</span>
                <span className={hrvDropPct < -15 ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                  {hrvDropPct > 0 ? `+${hrvDropPct}%` : `${hrvDropPct}%`}
                </span>
              </div>
            </div>

            {/* Resting HR */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium flex items-center space-x-1.5">
                  <Heart className="w-3.5 h-3.5 text-red-400" />
                  <span>FC Reposo Despertar</span>
                </span>
                <span className="text-zinc-200 font-bold">{restingHr} bpm</span>
              </div>
              <input
                type="range"
                min="38"
                max="75"
                value={restingHr}
                onChange={(e) => setRestingHr(Number(e.target.value))}
                className="w-full accent-red-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>Baja: &lt; 46 bpm</span>
                <span>Elevada: &gt; 54 bpm</span>
              </div>
            </div>

            {/* Sleep Hours */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium flex items-center space-x-1.5">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Horas de Sueño</span>
                </span>
                <span className="text-indigo-400 font-bold">{sleepHours} h</span>
              </div>
              <input
                type="range"
                min="4"
                max="10"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>Mínimo Uphill: 7.5h</span>
                <span>Calidad Suunto: {sleepQuality}/100</span>
              </div>
            </div>

            {/* Sleep Quality */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Puntuación de Sueño Suunto</span>
                </span>
                <span className="text-amber-400 font-bold">{sleepQuality}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                value={sleepQuality}
                onChange={(e) => setSleepQuality(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>&lt; 65: Recuperación deficiente</span>
                <span>&gt; 80: Óptimo</span>
              </div>
            </div>

          </div>

          {/* Optional Subjective Markers */}
          <div className="border-t border-zinc-800 pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Sensaciones Subjetivas (Opcionales)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Dolor Muscular / Agujetas</span>
                  <span className="font-semibold text-zinc-200">{muscleSoreness}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={muscleSoreness}
                  onChange={(e) => setMuscleSoreness(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Estrés Vital / Mental</span>
                  <span className="font-semibold text-zinc-200">{stressLevel}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={stressLevel}
                  onChange={(e) => setStressLevel(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Computed State Preview */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
            calculatedStatus === 'optimal'
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
              : calculatedStatus === 'unknown'
              ? 'bg-zinc-900/40 border-zinc-700 text-zinc-300'
              : calculatedStatus === 'moderate'
              ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
              : 'bg-red-950/20 border-red-800/40 text-red-200'
          }`}>
            {calculatedStatus === 'optimal' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${calculatedStatus === 'fatigued' ? 'text-red-400' : calculatedStatus === 'unknown' ? 'text-zinc-400' : 'text-amber-400'}`} />
            )}
            <div className="space-y-1 text-xs">
              <div className="font-bold text-sm">
                {calculatedStatus === 'optimal' && 'Estado Óptimo: Luz Verde'}
                {calculatedStatus === 'moderate' && 'Recuperación Media: Cuidado con la intensidad'}
                {calculatedStatus === 'fatigued' && 'Alerta de Fatiga: Miguel recomienda adaptar la sesión'}
                {calculatedStatus === 'unknown' && 'Sin datos: no se puede valorar la recuperación'}
              </div>
              <p className="opacity-90 leading-relaxed">
                {calculatedStatus === 'optimal' && 'Tu sistema nervioso autónomo está recuperado. Perfecto para cumplir la sesión programada.'}
                {calculatedStatus === 'moderate' && 'Variación perceptible en HRV o sueño. Mantente estricto por debajo de tu umbral AeT.'}
                {calculatedStatus === 'fatigued' && 'Caída acusada de HRV o déficit severo de descanso. No forces hoy o entrarás en déficit crónico.'}
                {calculatedStatus === 'unknown' && 'Faltan HRV, sueño y dolor muscular. Introdúcelos o sincroniza Suunto para que Miguel pueda valorar el día.'}
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg transition-all"
          >
            <span>Guardar y Analizar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
