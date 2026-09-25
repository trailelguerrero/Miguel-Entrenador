import React, { useState } from 'react';
import { X, Plus, Calendar, Mountain, Clock, Activity, Save } from 'lucide-react';
import { Workout, WorkoutType } from '../types';
import { calculateWorkoutTss } from '../utils/pmcCalculations';

interface AddWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workout: Workout) => void;
  initialDateStr?: string;
  defaultAetHr?: number;
  defaultAntHr?: number;
}

export const AddWorkoutModal: React.FC<AddWorkoutModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDateStr,
  defaultAetHr = 142,
  defaultAntHr,
}) => {
  if (!isOpen) return null;

  const [date, setDate] = useState(initialDateStr || new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('Rodaje Aeróbico Z1/Z2');
  const [type, setType] = useState<WorkoutType>('easy_run');
  const [durationMin, setDurationMin] = useState(60);
  const [distanceKm, setDistanceKm] = useState(10);
  const [elevationGainM, setElevationGainM] = useState(300);
  const [zoneSenseTarget, setZoneSenseTarget] = useState<Workout['zoneSenseTarget']>(
    'ZoneSense verde (aeróbico)'
  );
  const [mainSet, setMainSet] = useState(
    'Rodaje continuo a ritmo suave, respiración nasal constante. En las subidas camina si tus pulsaciones rozan tu AeT.'
  );
  const [terrain, setTerrain] = useState('Pista de tierra o sendero cómodo con poco desnivel técnico.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const estAvgHr = Math.round(defaultAetHr * 0.94);
    const tssResult = calculateWorkoutTss(Number(durationMin), estAvgHr, defaultAntHr || undefined);

    const newWorkout: Workout = {
      id: `custom-workout-${Date.now()}`,
      date,
      title,
      type,
      plannedDurationMin: Number(durationMin),
      plannedDistanceKm: distanceKm ? Number(distanceKm) : undefined,
      plannedElevationGainM: elevationGainM ? Number(elevationGainM) : undefined,
      plannedTss: tssResult.tss,
      intensityFactor: tssResult.intensityFactor,
      targetHrMax: defaultAetHr,
      zoneSenseTarget,
      description: 'Sesión personalizada programada por el atleta.',
      mainSet,
      terrainRecommendation: terrain,
      completed: false,
    };

    onSave(newWorkout);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Escribir Sesión en el Calendario</h3>
              <p className="text-xs text-zinc-400">Personaliza y añade cualquier entrenamiento al plan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400">Tipo de Sesión</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-medium"
              >
                <option value="easy_run">Rodaje Aeróbico Z1/Z2</option>
                <option value="long_mountain_run">Tirada Larga Montaña con D+</option>
                <option value="muscular_endurance">Muscular Endurance (Cuestas ME)</option>
                <option value="hill_intervals">Series en Subida</option>
                <option value="intensity_run">Carrera con intensidad</option>
                <option value="strength_core">Fuerza en Casa / Outdoor</option>
                <option value="drift_test">Test de Deriva Cardíaca</option>
                <option value="cross_training">Entrenamiento Cruzado</option>
                <option value="rest">Descanso Total</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Título de la Sesión</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Duración (min)</label>
              <input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-semibold"
                required
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400">Distancia (km)</label>
              <input
                type="number"
                step="0.5"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400">D+ Desnivel (m)</label>
              <input
                type="number"
                value={elevationGainM}
                onChange={(e) => setElevationGainM(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Objetivo Suunto ZoneSense</label>
            <select
              value={zoneSenseTarget}
              onChange={(e) => setZoneSenseTarget(e.target.value as any)}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
            >
              <option value="ZoneSense verde (aeróbico)">ZoneSense verde (aeróbico)</option>
              <option value="Regenerativo (verde, muy suave)">Regenerativo (verde, muy suave)</option>
              <option value="ZoneSense amarillo (entre umbrales)">ZoneSense amarillo (entre umbrales)</option>
              <option value="ZoneSense rojo (sobre umbral anaeróbico)">ZoneSense rojo (sobre umbral anaeróbico)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Instrucciones / Parte Principal</label>
            <textarea
              rows={3}
              value={mainSet}
              onChange={(e) => setMainSet(e.target.value)}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100"
              required
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400">Terreno Recomendado</label>
            <input
              type="text"
              value={terrain}
              onChange={(e) => setTerrain(e.target.value)}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-lg transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Añadir a Calendario</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
