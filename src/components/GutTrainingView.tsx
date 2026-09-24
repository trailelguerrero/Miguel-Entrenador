import React, { useState } from 'react';
import { 
  Flame, 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Apple, 
  Star, 
  Activity, 
  Calendar, 
  Utensils,
  Calculator,
  TrendingUp,
  History
} from 'lucide-react';
import { AthleteProfile, GutTrainingEntry, GutTrainingProfile } from '../types';
import { StorageService, DEFAULT_PROFILE } from '../services/storage';
import { NutritionCalculator } from './NutritionCalculator';
import { AdaptationProgress } from './AdaptationProgress';

interface GutTrainingViewProps {
  profile?: AthleteProfile;
  onNutritionLinked?: (title: string, date: string) => void;
}

export const GutTrainingView: React.FC<GutTrainingViewProps> = ({ 
  profile = DEFAULT_PROFILE,
  onNutritionLinked
}) => {
  const [gutProfile, setGutProfile] = useState<GutTrainingProfile>(() => StorageService.getGutProfile());
  const [activeTab, setActiveTab] = useState<'calculator' | 'progress' | 'history'>('calculator');
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  // New entry form state
  const [newTitle, setNewTitle] = useState('Tirada Larga Montaña');
  const [newDurationMin, setNewDurationMin] = useState(180);
  const [newCarbsPerHour, setNewCarbsPerHour] = useState(gutProfile.currentMaxCarbsPerHour || 55);
  const [newSodiumPerHour, setNewSodiumPerHour] = useState(500);
  const [newFluidsPerHour, setNewFluidsPerHour] = useState(600);
  const [newFuels, setNewFuels] = useState('Geles maltodextrina:fructosa (1:0.8), plátano, sales');
  const [newRating, setNewRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [newSymptoms, setNewSymptoms] = useState<string>('Ninguno');

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: GutTrainingEntry = {
      id: `gut-entry-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      workoutTitle: newTitle,
      durationMin: Number(newDurationMin),
      carbsTargetGramsPerHour: gutProfile.currentMaxCarbsPerHour,
      carbsIngestedGramsPerHour: Number(newCarbsPerHour),
      sodiumTargetMgPerHour: Number(newSodiumPerHour),
      hydrationMlPerHour: Number(newFluidsPerHour),
      fuelsUsed: newFuels.split(',').map(s => s.trim()).filter(Boolean),
      giToleranceRating: newRating,
      symptomsReported: newSymptoms.split(',').map(s => s.trim()).filter(Boolean),
      miguelDigestiveFeedback: newRating >= 4 
        ? `Excelente digestión y asimilación a ${newCarbsPerHour} g/h. Los transportadores SGLT1/GLUT5 absorbieron la carga sin retención ni fermentación gástrica.`
        : `Tolerancia ajustada a ${newCarbsPerHour} g/h. Ajustaremos la dosis y vigilaremos que el pulso sub-AeT no se desvíe en subidas para mantener el flujo sanguíneo intestinal.`,
    };

    const updated = StorageService.addGutEntry(entry);
    setGutProfile({ ...updated });
    setIsAddingEntry(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider border border-amber-500/30">
                Nutrición Fisiológica & Adaptación Gástrica
              </span>
              <span className="text-xs text-stone-400">
                Metodología Uphill Ultra Trail
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-100 flex items-center gap-3">
              <Flame className="w-8 h-8 text-amber-400 shrink-0" />
              Calculadora de Nutrición & Progreso de Adaptación
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-2xl leading-relaxed">
              El estómago es un músculo entrenable. Calcula el gasto metabólico, la partición FatMax de grasas vs glucógeno y planifica tu avance hacia los <strong>80-90 g/h</strong> para Transvulcania 73K.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <button
              onClick={() => setIsAddingEntry(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Test Digestivo</span>
            </button>
          </div>
        </div>

        {/* Global Tab Navigation */}
        <div className="flex flex-wrap border-t border-stone-800/80 mt-6 pt-4 gap-2">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'bg-stone-950/70 hover:bg-stone-800 text-stone-300 border border-stone-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Calculadora de Nutrición Táctica</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'progress'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'bg-stone-950/70 hover:bg-stone-800 text-stone-300 border border-stone-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Progreso de Adaptación (SGLT1 / GLUT5)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'bg-stone-950/70 hover:bg-stone-800 text-stone-300 border border-stone-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Tests Gástricos ({gutProfile.entries?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Dynamic View Content */}
      {activeTab === 'calculator' && (
        <NutritionCalculator 
          profile={profile}
          gutProfile={gutProfile}
          onLinkedSuccess={onNutritionLinked}
        />
      )}

      {activeTab === 'progress' && (
        <AdaptationProgress 
          profile={profile}
          gutProfile={gutProfile}
          onUpdateGutProfile={(updated) => setGutProfile({ ...updated })}
        />
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Historial de Tests Gástricos en Tiradas Largas
            </h3>
            <button
              onClick={() => setIsAddingEntry(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              + Añadir nuevo test
            </button>
          </div>

          <div className="space-y-3">
            {gutProfile.entries.map((entry) => (
              <div 
                key={entry.id} 
                className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-md space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                  <div>
                    <span className="text-xs text-stone-400 font-mono">{entry.date}</span>
                    <h4 className="text-sm font-bold text-stone-100">{entry.workoutTitle}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-400">
                      {[...Array(entry.giToleranceRating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-stone-800 text-emerald-400 font-mono text-xs font-bold">
                      {entry.carbsIngestedGramsPerHour} g/h
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-stone-950 p-2 rounded-lg">
                    <span className="text-stone-400 text-[10px] block">Duración</span>
                    <span className="font-semibold text-stone-200">{Math.round(entry.durationMin / 60)}h {entry.durationMin % 60}m</span>
                  </div>
                  <div className="bg-stone-950 p-2 rounded-lg">
                    <span className="text-stone-400 text-[10px] block">Hidratación</span>
                    <span className="font-semibold text-cyan-400">{entry.hydrationMlPerHour} ml/h</span>
                  </div>
                  <div className="bg-stone-950 p-2 rounded-lg">
                    <span className="text-stone-400 text-[10px] block">Sodio</span>
                    <span className="font-semibold text-stone-200">{entry.sodiumTargetMgPerHour} mg/h</span>
                  </div>
                  <div className="bg-stone-950 p-2 rounded-lg">
                    <span className="text-stone-400 text-[10px] block">Alimentos</span>
                    <span className="font-semibold text-stone-300 truncate block">{entry.fuelsUsed.join(', ')}</span>
                  </div>
                </div>

                {entry.miguelDigestiveFeedback && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed flex items-start gap-2">
                    <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-200 mb-0.5">Dictamen de Miguel:</strong>
                      {entry.miguelDigestiveFeedback}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: New Gut Test Entry */}
      {isAddingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-2xl text-stone-100">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Apple className="w-5 h-5 text-amber-400" />
              Registrar Test de Asimilación Gástrica
            </h3>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div>
                <label className="text-xs text-stone-400 block mb-1">Sesión realizada:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-400 block mb-1">Duración (minutos):</label>
                  <input
                    type="number"
                    value={newDurationMin}
                    onChange={(e) => setNewDurationMin(parseInt(e.target.value) || 60)}
                    className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-400 block mb-1">Carbohidratos (g/h):</label>
                  <input
                    type="number"
                    value={newCarbsPerHour}
                    onChange={(e) => setNewCarbsPerHour(parseInt(e.target.value) || 30)}
                    className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-400 block mb-1">Agua bebida (ml/h):</label>
                  <input
                    type="number"
                    value={newFluidsPerHour}
                    onChange={(e) => setNewFluidsPerHour(parseInt(e.target.value) || 500)}
                    className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-400 block mb-1">Sodio ingerido (mg/h):</label>
                  <input
                    type="number"
                    value={newSodiumPerHour}
                    onChange={(e) => setNewSodiumPerHour(parseInt(e.target.value) || 500)}
                    className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">Alimentos / Suplementos tomados:</label>
                <input
                  type="text"
                  value={newFuels}
                  onChange={(e) => setNewFuels(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                  placeholder="Geles maltodextrina:fructosa 1:0.8, plátano, sales..."
                />
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">
                  Tolerancia digestiva (1 a 5 estrellas):
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star as any)}
                      className={`p-2 rounded-xl border flex items-center gap-1 text-xs cursor-pointer ${
                        newRating >= star 
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                          : 'bg-stone-950 border-stone-800 text-stone-500'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">Síntomas digestivos (si hubo):</label>
                <input
                  type="text"
                  value={newSymptoms}
                  onChange={(e) => setNewSymptoms(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3 py-2 text-sm text-stone-100"
                  placeholder="Ninguno, o: pesadez, reflujo, náuseas..."
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingEntry(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer"
                >
                  Guardar y Analizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
