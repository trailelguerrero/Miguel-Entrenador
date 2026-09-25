import React, { useState } from 'react';
import { 
  X, 
  Watch, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Workout, AthleteProfile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout;
  profile: AthleteProfile;
}

export const SuuntoExportModal: React.FC<Props> = ({ isOpen, onClose, workout, profile }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !workout) return null;

  // Build SuuntoPlus structured workout format
  const structuredData = {
    title: workout.title,
    sport: 'trail_running',
    targetRace: 'Transvulcania 2027',
    athleteAeT: profile.aetHr,
    athleteAnT: profile.antHr,
    steps: [
      {
        stepName: '1. Calentamiento Progresivo',
        durationMin: 15,
        intensityTarget: 'Z1 Regenerativo',
        targetHrRange: [profile.restingHr + 40, profile.aetHr - 15],
        suuntoVibrationAlert: true,
        notes: 'Movilidad articular y trote suave con respiración nasal.',
      },
      {
        stepName: '2. Bloque Principal ZoneSense',
        durationMin: Math.max(workout.plannedDurationMin - 25, 20),
        intensityTarget: workout.zoneSenseTarget,
        targetHrRange: [profile.aetHr - 15, profile.aetHr],
        suuntoVibrationAlert: true,
        vibrateIfHrExceeds: profile.aetHr,
        notes: 'Si en subida ZoneSense pasa a amarillo, cambia a power-hiking.',
      },
      {
        stepName: '3. Enfriamiento y Vuelta a la Calma',
        durationMin: 10,
        intensityTarget: 'Z1 Regenerativo',
        targetHrRange: [profile.restingHr + 30, profile.aetHr - 20],
        suuntoVibrationAlert: false,
        notes: 'Caminata lenta y normalización de la frecuencia cardíaca.',
      }
    ],
    fuelingAlerts: {
      intervalMinutes: 20,
      reminderText: `Beber sorbo de agua + sales (${workout.plannedFluidsPerHourMl || 600} ml/h). Cada 45 min: Carbohidratos (${workout.plannedCarbsPerHourG || 55} g/h).`
    }
  };

  const jsonString = JSON.stringify(structuredData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suunto-workout-${workout.date}-${workout.type}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-2xl text-stone-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-100">
                Exportar a Reloj Suunto
              </h3>
              <p className="text-xs text-stone-400">
                Guía estructurada con alertas de pulso AeT y ZoneSense
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Workout Overview */}
          <div className="p-3 rounded-xl bg-stone-950 border border-stone-850 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-stone-400 block font-mono">{workout.date}</span>
              <strong className="text-stone-200 text-sm">{workout.title}</strong>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold">
              Límite: {profile.aetHr} bpm
            </span>
          </div>

          {/* Structured Steps Preview */}
          <div className="space-y-2">
            <span className="font-semibold text-stone-300 block text-[11px]">
              Fases Programadas para la Pantalla de tu Suunto:
            </span>
            {structuredData.steps.map((st, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-stone-850/80 border border-stone-800 flex items-center justify-between">
                <div>
                  <strong className="text-stone-200 block">{st.stepName}</strong>
                  <span className="text-[11px] text-stone-400">{st.notes}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-emerald-400">{st.durationMin} min</span>
                  <span className="block text-[10px] text-stone-500">
                    {st.targetHrRange[0]} - {st.targetHrRange[1]} bpm
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Fueling Reminder Step */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <strong className="block text-[11px] text-amber-200 mb-0.5">
              Alarma de Nutrición SuuntoPlus (Cada 20 min):
            </strong>
            <span>{structuredData.fuelingAlerts.reminderText}</span>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-stone-800 flex flex-wrap gap-2.5">

          <button
            onClick={handleDownload}
            className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 flex items-center gap-1.5 transition cursor-pointer"
            title="Descargar archivo JSON/FIT compatible con SuuntoPlus"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Guía</span>
          </button>

          <button
            onClick={handleCopy}
            className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 flex items-center gap-1.5 transition cursor-pointer"
            title="Copiar texto de configuración"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
