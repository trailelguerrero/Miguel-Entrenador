import { localDateKey } from '../utils/trainingLoad';
import React, { useState } from 'react';
import { 
  Scale, 
  TrendingDown, 
  Plus, 
  Flame, 
  Timer, 
  ShieldAlert, 
  ChevronRight, 
  CheckCircle2, 
  X,
  History,
  Info
} from 'lucide-react';
import { AthleteProfile, WeightEntry } from '../types';
import { StorageService } from '../services/storage';

interface WeightQuickWidgetProps {
  profile: AthleteProfile;
  onUpdateProfile: (updated: AthleteProfile) => void;
  onOpenFullPerformance?: () => void;
}

export const WeightQuickWidget: React.FC<WeightQuickWidgetProps> = ({
  profile,
  onUpdateProfile,
  onOpenFullPerformance
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWeight, setNewWeight] = useState<number>(profile.weightKg || 0);
  const [newFatPct, setNewFatPct] = useState<string>('14.5');
  const [notes, setNotes] = useState<string>('Pesaje matutino en ayunas');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  // Misma fuente que el resto de la app: último pesaje, o el peso del perfil
  const history = [...StorageService.getWeightHistory()].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = StorageService.getCurrentWeightKg();
  const targetWeight = Number(profile.targetRaceWeightKg) || 0;
  const heightM = (Number(profile.heightCm) || 0) / 100;
  const bmi = currentWeight > 0 && heightM > 0 ? (currentWeight / (heightM * heightM)).toFixed(1) : '—';
  const deltaKg = (currentWeight - targetWeight).toFixed(1);
  const isTargetReached = targetWeight > 0 && currentWeight <= targetWeight;

  // Progreso desde el primer pesaje registrado hasta el objetivo
  const startWeight = history.length > 0 ? history[0].weightKg : currentWeight;
  const totalToLose = startWeight - targetWeight;
  const lostSoFar = startWeight - currentWeight;
  const progressPct = targetWeight > 0 && totalToLose > 0
    ? Math.min(100, Math.max(0, Math.round((lostSoFar / totalToLose) * 100)))
    : 0;

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight || newWeight <= 30 || newWeight >= 250) return;

    const entry: Omit<WeightEntry, 'id'> = {
      date: localDateKey(),
      weightKg: Number(newWeight),
      bodyFatPct: newFatPct ? Number(newFatPct) : undefined,
      notes: notes.trim() || undefined
    };

    StorageService.addWeightEntry(entry);
    const updatedProfile = StorageService.getProfile();
    onUpdateProfile(updatedProfile);

    setIsSavedSuccess(true);
    setTimeout(() => {
      setIsSavedSuccess(false);
      setIsModalOpen(false);
    }, 1200);
  };

  return (
    <>
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-950 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-72 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          
          {/* Left Block: Current Weight & Target */}
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Scale className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Control de Peso de Carrera
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Transvulcania 73K
                </span>
              </div>

              <div className="flex items-baseline space-x-2.5 mt-0.5">
                <span className="text-2xl font-black text-zinc-100 tracking-tight">
                  {currentWeight} <span className="text-xs font-semibold text-zinc-400">kg</span>
                </span>

                <span className="text-xs text-zinc-400">
                  Objetivo: <strong className="text-emerald-400">{targetWeight > 0 ? `${targetWeight} kg` : 'sin definir'}</strong>
                </span>

                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isTargetReached 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {targetWeight <= 0 ? 'Define tu peso objetivo' : isTargetReached ? '¡Peso objetivo alcanzado!' : `-${deltaKg} kg restantes`}
                </span>
              </div>

              {/* Progress bar towards race weight */}
              <div className="w-48 sm:w-60 bg-zinc-800/80 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Center Block: Biomechanical Impact on Transvulcania (+4,350m D+) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-zinc-950/80 p-2.5 sm:p-3 rounded-xl border border-zinc-800/70 text-xs">
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-orange-400 shrink-0" />
              <div>
                <span className="text-[10px] text-zinc-500 block leading-tight">Inicio registro</span>
                <span className="text-xs font-bold text-zinc-200">{startWeight > 0 ? `${startWeight} kg` : '—'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Timer className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-zinc-500 block leading-tight">Pesajes</span>
                <span className="text-xs font-bold text-emerald-400">{history.length}</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="text-[10px] text-zinc-500 block leading-tight">IMC actual</span>
                <span className="text-xs font-bold text-zinc-200">{bmi}</span>
              </div>
            </div>
          </div>

          {/* Right Action: Quick Weigh-in Button */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-102 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Peso</span>
            </button>

            {onOpenFullPerformance && (
              <button
                onClick={onOpenFullPerformance}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition"
                title="Ver gráfica completa de evolución y pesajes"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Quick Weigh-In Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Nuevo Registro de Peso</h3>
                <p className="text-xs text-zinc-400">Monitoriza tu peso óptimo para Transvulcania</p>
              </div>
            </div>

            {isSavedSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-zinc-100">¡Pesaje guardado con éxito!</h4>
                <p className="text-xs text-zinc-400">Miguel ha actualizado tu perfil y cálculos metabólicos.</p>
              </div>
            ) : (
              <form onSubmit={handleSaveWeight} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Peso Actual (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={newWeight}
                      onChange={(e) => setNewWeight(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-base font-black text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Grasa Corporal (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="14.5"
                      value={newFatPct}
                      onChange={(e) => setNewFatPct(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-base font-semibold text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Notas de Contexto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. En ayunas tras descanso, post-tirada larga..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Physiology Advice Note */}
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-start space-x-2 text-[11px] text-zinc-400 leading-relaxed">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Pauta de Miguel: </strong>
                    Pésate siempre en ayunas tras orinar. Una bajada sana es de 300 a 400g/semana para no sacrificar masa muscular ni provocar fatiga en subidas.
                  </span>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
                  >
                    Guardar Pesaje
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}
    </>
  );
};
