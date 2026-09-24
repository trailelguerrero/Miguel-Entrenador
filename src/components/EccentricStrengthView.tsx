import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Flame, 
  Layers,
  ChevronRight
} from 'lucide-react';
import { EccentricOutdoorExercise } from '../types';
import { StorageService } from '../services/storage';

export const EccentricStrengthView: React.FC = () => {
  const [exercises] = useState<EccentricOutdoorExercise[]>(() => StorageService.getEccentricExercises());
  const [selectedExId, setSelectedExId] = useState<string>(exercises[0].id);

  // Metronome / Tempo Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'down' | 'pause' | 'up'>('down');
  const [secondsRemainingInPhase, setSecondsRemainingInPhase] = useState(3);
  const [currentRep, setCurrentRep] = useState(1);
  const [targetReps, setTargetReps] = useState(10);
  const [currentSet, setCurrentSet] = useState(1);
  const [targetSets, setTargetSets] = useState(3);

  const selectedExercise = exercises.find(e => e.id === selectedExId) || exercises[0];

  // Metronome Timer Effect
  useEffect(() => {
    let interval: any = null;

    if (isRunning) {
      interval = setInterval(() => {
        setSecondsRemainingInPhase((prev) => {
          if (prev > 1) {
            return prev - 1;
          }

          // Phase transition logic (3s down -> 1s pause -> 1s up -> next rep)
          if (currentPhase === 'down') {
            setCurrentPhase('pause');
            return selectedExercise.pauseSeconds;
          } else if (currentPhase === 'pause') {
            setCurrentPhase('up');
            return selectedExercise.upSeconds;
          } else {
            // Completed 1 full rep
            setCurrentPhase('down');
            setCurrentRep((rep) => {
              if (rep >= targetReps) {
                // Completed set
                setCurrentSet((s) => Math.min(s + 1, targetSets));
                return 1;
              }
              return rep + 1;
            });
            return selectedExercise.downSeconds;
          }
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, currentPhase, selectedExercise, targetReps, targetSets]);

  const handleReset = () => {
    setIsRunning(false);
    setCurrentPhase('down');
    setSecondsRemainingInPhase(selectedExercise.downSeconds);
    setCurrentRep(1);
    setCurrentSet(1);
  };

  const phaseColors = {
    down: {
      bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      label: 'BAJADA LENTA (Excéntrica)',
      hint: 'Controla el descenso en 3 segundos sin dejarte caer',
    },
    pause: {
      bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      label: 'PAUSA (Isométrica)',
      hint: 'Sostén la tensión abajo sin rebotar',
    },
    up: {
      bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      label: 'SUBIDA (Concéntrica)',
      hint: 'Sube en 1 segundo de forma potente',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/30">
                Uphill Athlete • Fuerza sin Gimnasio
              </span>
              <span className="text-xs text-stone-400">
                Preparación Biomecánica Transvulcania
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-100 flex items-center gap-3">
              <Dumbbell className="w-8 h-8 text-emerald-400 shrink-0" />
              Guía de Fuerza Excéntrica al Aire Libre
            </h1>
            <p className="text-sm text-stone-300 mt-1 max-w-2xl">
              Entrena la fuerza excéntrica en el sendero, bordillos y escaleras con el tempo <strong>3-1-1</strong>. 
              Este estímulo añade sarcómeros en serie a tus cuádriceps para no sufrir fallos musculares en el descenso a Tazacorte.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Timer + Exercise Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metronome & Interactive Timer (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-xl text-center space-y-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 text-xs text-stone-400">
              <span className="font-semibold">Metrónomo de Tempo Excéntrico</span>
              <span className="font-mono text-emerald-400 font-bold">{selectedExercise.tempoPattern}</span>
            </div>

            {/* Big Visual Pulse Ring */}
            <div className="relative flex flex-col items-center justify-center py-6">
              <div className={`w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-2xl ${
                currentPhase === 'down' 
                  ? 'border-rose-500 bg-rose-500/10 shadow-rose-500/20 scale-105' 
                  : currentPhase === 'pause'
                  ? 'border-amber-500 bg-amber-500/10 shadow-amber-500/20'
                  : 'border-emerald-500 bg-emerald-500/10 shadow-emerald-500/20 scale-95'
              }`}>
                <span className="text-5xl font-black font-mono text-stone-100">
                  {secondsRemainingInPhase}s
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-300 mt-1">
                  {phaseColors[currentPhase].label}
                </span>
              </div>
            </div>

            {/* Instruction Cue */}
            <p className="text-xs text-stone-300 font-medium px-4">
              {phaseColors[currentPhase].hint}
            </p>

            {/* Reps & Sets Tracker */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-850">
                <span className="text-[10px] text-stone-400 block font-semibold">Repetición</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {currentRep} / {targetReps}
                </span>
              </div>
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-850">
                <span className="text-[10px] text-stone-400 block font-semibold">Serie</span>
                <span className="text-xl font-black text-cyan-400 font-mono">
                  {currentSet} / {targetSets}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                  isRunning 
                    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950' 
                    : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar Tempo</span>
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition cursor-pointer"
                title="Reiniciar series"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Exercises Directory & Technical Guide (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="text-xs text-stone-400 font-semibold px-1">
            Biblioteca de Ejercicios Uphill para Terreno Natural (5 Claves)
          </div>

          <div className="space-y-3">
            {exercises.map((ex) => {
              const isSelected = ex.id === selectedExId;

              return (
                <div
                  key={ex.id}
                  onClick={() => {
                    setSelectedExId(ex.id);
                    setIsRunning(false);
                    setSecondsRemainingInPhase(ex.downSeconds);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-850 border-emerald-500 ring-1 ring-emerald-500/50 shadow-xl'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700 hover:bg-stone-850/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                      {ex.name}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-stone-800 text-stone-300 rounded-md">
                      {ex.sets} series x {ex.reps}
                    </span>
                  </div>

                  <p className="text-xs text-stone-300 leading-relaxed mb-3">
                    {ex.instruction}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                      <span className="text-stone-400 font-medium block text-[10px]">Dónde hacerlo al aire libre:</span>
                      <span className="text-stone-200">{ex.outdoorSetup}</span>
                    </div>

                    <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                      <span className="text-stone-400 font-medium block text-[10px]">Músculos objetivo:</span>
                      <span className="text-emerald-400 font-medium">{ex.targetMuscles}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-stone-800/80 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-[11px] text-amber-200">Precaución técnica:</strong>
                          <span>{ex.riskWarning}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-stone-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-[11px] text-emerald-300">Por qué salvará tus piernas en Transvulcania:</strong>
                          <span>{ex.biomechanicalPurpose}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
