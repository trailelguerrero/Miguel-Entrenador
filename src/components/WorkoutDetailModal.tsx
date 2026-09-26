import React, { useState } from 'react';
import { measuredAntHr, resolveIntensityPrescription } from '../brain/intensity';
import { 
  X, 
  Clock, 
  Mountain, 
  Activity, 
  Heart, 
  Dumbbell, 
  Compass, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Save, 
  Apple, 
  ShieldAlert,
  Flame,
  Brain,
  Watch,
  Download,
  Droplets,
  Star
} from 'lucide-react';
import { Workout, AthleteProfile, WorkoutType, CoachLearnedInsight } from '../types';
import { parseFitFile, ParsedFitResult } from '../utils/fitParser';
import { calculateWorkoutTss } from '../utils/pmcCalculations';
import { getWorkoutLoad } from '../utils/trainingLoad';
import { SuuntoExportModal } from './SuuntoExportModal';

interface WorkoutDetailModalProps {
  workout: Workout | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (workout: Workout) => void;
  onDelete: (workoutId: string) => void;
  onAskMiguel: (workout: Workout) => void;
  onAnalyzeWorkout: (workout: Workout, fitData?: any, athleteFeedback?: any) => Promise<any>;
  profile: AthleteProfile;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({
  workout,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onAskMiguel,
  onAnalyzeWorkout,
  profile,
}) => {
  if (!isOpen || !workout) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(workout.title);
  const [editedType, setEditedType] = useState<WorkoutType>(workout.type);
  const [editedDuration, setEditedDuration] = useState(workout.plannedDurationMin);
  const [editedDistance, setEditedDistance] = useState(workout.plannedDistanceKm || 0);
  const [editedElevation, setEditedElevation] = useState(workout.plannedElevationGainM || 0);
  const [editedMainSet, setEditedMainSet] = useState(workout.mainSet);
  const [editedDescription, setEditedDescription] = useState(workout.description);

  // Completion & FIT Upload State
  const [showLogForm, setShowLogForm] = useState(workout.completed);
  const [actualDuration, setActualDuration] = useState(workout.actualDurationMin || workout.plannedDurationMin);
  const [actualDistance, setActualDistance] = useState(workout.actualDistanceKm || workout.plannedDistanceKm || 0);
  const [actualElevation, setActualElevation] = useState(workout.actualElevationGainM || workout.plannedElevationGainM || 0);
  const [actualAvgHr, setActualAvgHr] = useState(workout.actualAvgHr || 138);
  const [actualMaxHr, setActualMaxHr] = useState(workout.actualMaxHr || 155);
  const [athleteRpe, setAthleteRpe] = useState(workout.athleteRpe || 6);
  const [athleteNotes, setAthleteNotes] = useState(workout.athleteNotes || '');
  
  // Fueling & Gut Training State
  const [actualCarbs, setActualCarbs] = useState(workout.actualCarbsPerHourG || workout.plannedCarbsPerHourG || (workout.plannedDurationMin > 90 ? 55 : 30));
  const [actualFluids, setActualFluids] = useState(workout.actualFluidsPerHourMl || workout.plannedFluidsPerHourMl || 600);
  const [actualSodium, setActualSodium] = useState(workout.actualSodiumPerHourMg || workout.plannedSodiumPerHourMg || 550);
  const [giTolerance, setGiTolerance] = useState<number>(workout.giToleranceRating || 5);
  const [fuelingNotes, setFuelingNotes] = useState(workout.fuelingNotes || '');

  const [parsedFit, setParsedFit] = useState<ParsedFitResult | null>(null);
  const [isParsingFit, setIsParsingFit] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [coachAnalysis, setCoachAnalysis] = useState(workout.coachFeedback || '');
  const [memoryChanges, setMemoryChanges] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Handle FIT File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFit(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseFitFile(buffer, file.name, resolveIntensityPrescription(profile).aetHr, resolveIntensityPrescription(profile).antHr);
      setParsedFit(result);

      // Auto fill actual metrics from FIT
      setActualDuration(result.totalDurationMin);
      setActualDistance(result.totalDistanceKm);
      setActualElevation(result.totalAscentM);
      setActualAvgHr(result.avgHeartRate);
      setActualMaxHr(result.maxHeartRate);
      setShowLogForm(true);
    } catch (err: any) {
      alert(`Error al procesar archivo FIT: ${err.message}`);
    } finally {
      setIsParsingFit(false);
    }
  };

  // Save changes
  const handleSaveEdits = () => {
    const updated: Workout = {
      ...workout,
      title: editedTitle,
      type: editedType,
      plannedDurationMin: Number(editedDuration),
      plannedDistanceKm: Number(editedDistance) || undefined,
      plannedElevationGainM: Number(editedElevation) || undefined,
      mainSet: editedMainSet,
      description: editedDescription,
    };
    onSave(updated);
    setIsEditing(false);
  };

  // Complete workout & request Miguel's feedback
  const handleCompleteAndAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const fitData = parsedFit || {
        totalDurationMin: actualDuration,
        totalDistanceKm: actualDistance,
        totalAscentM: actualElevation,
        avgHeartRate: actualAvgHr,
        maxHeartRate: actualMaxHr,
      };

      const analysisResult = await onAnalyzeWorkout(workout, fitData, {
        rpe: athleteRpe,
        notes: athleteNotes,
      });

      let feedbackText = '';
      if (typeof analysisResult === 'string') {
        feedbackText = analysisResult;
      } else if (analysisResult && typeof analysisResult === 'object') {
        feedbackText = analysisResult.feedback || '';
        setMemoryChanges(Array.isArray(analysisResult.memoryChanges) ? analysisResult.memoryChanges : []);
      }

      setCoachAnalysis(feedbackText);

      // Si el entreno viene de Suunto se conserva su TSS; solo se estima
      // cuando no hay TSS medido (registro manual).
      const hasSuuntoTss = !!workout.suuntoWorkoutKey;
      const tssResult = calculateWorkoutTss(
        Number(actualDuration),
        Number(actualAvgHr) || undefined,
        measuredAntHr(profile),
        Number(athleteRpe) || undefined
      );

      const completedWorkout: Workout = {
        ...workout,
        completed: true,
        actualDurationMin: Number(actualDuration),
        actualDistanceKm: Number(actualDistance),
        actualElevationGainM: Number(actualElevation),
        actualAvgHr: Number(actualAvgHr),
        actualMaxHr: Number(actualMaxHr),
        athleteRpe: Number(athleteRpe),
        athleteNotes,
        actualCarbsPerHourG: Number(actualCarbs),
        actualFluidsPerHourMl: Number(actualFluids),
        actualSodiumPerHourMg: Number(actualSodium),
        giToleranceRating: giTolerance as 1 | 2 | 3 | 4 | 5,
        fuelingNotes: fuelingNotes.trim() || undefined,
        coachFeedback: feedbackText,
        actualElevationLossM: parsedFit ? parsedFit.totalDescentM : workout.actualElevationLossM,
        tss: hasSuuntoTss ? workout.tss : tssResult.tss,
        actualTss: hasSuuntoTss ? workout.actualTss : undefined,
        intensityFactor: hasSuuntoTss ? workout.intensityFactor : tssResult.intensityFactor,
        // ZoneSense solo si viene de Suunto; el .FIT no trae ZoneSense y la
        // distribución por FC del .FIT no es ZoneSense.
        zoneSenseBreakdown: workout.zoneSenseBreakdown,
        // Tiempo por zonas de FC MEDIDO en el .FIT (con los umbrales con los que se calculó)
        hrZoneSplit: (() => {
          const p = resolveIntensityPrescription(profile);
          return parsedFit?.hrZoneMinutes && p.aetHr && p.antHr
            ? { ...parsedFit.hrZoneMinutes, aetHr: p.aetHr, antHr: p.antHr, source: 'fit' as const }
            : workout.hrZoneSplit;
        })(),
      };

      onSave(completedWorkout);
    } catch (err: any) {
      // El banner "Error de API de IA" ya muestra el detalle y qué hacer
      console.error('Error al analizar sesión:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {workout.date}
                </span>
                {workout.completed && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Completado
                  </span>
                )}
                {workout.wasAdapted && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    Adaptado por HRV
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-zinc-100">{workout.title}</h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
              title="Exportar guía estructurada a reloj Suunto"
            >
              <Watch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar a Suunto</span>
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-800"
              title="Editar sesión"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm('¿Eliminar esta sesión del calendario?')) {
                  onDelete(workout.id);
                  onClose();
                }
              }}
              className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-zinc-800"
              title="Eliminar sesión"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Edit Mode Form */}
          {isEditing ? (
            <div className="space-y-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-amber-400 uppercase">Editar Detalles de la Sesión</h3>
              <div>
                <label className="text-xs text-zinc-400">Título</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-400">Duración (min)</label>
                  <input
                    type="number"
                    value={editedDuration}
                    onChange={(e) => setEditedDuration(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Distancia (km)</label>
                  <input
                    type="number"
                    value={editedDistance}
                    onChange={(e) => setEditedDistance(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">D+ (metros)</label>
                  <input
                    type="number"
                    value={editedElevation}
                    onChange={(e) => setEditedElevation(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Parte Principal / Instrucciones</label>
                <textarea
                  rows={3}
                  value={editedMainSet}
                  onChange={(e) => setEditedMainSet(e.target.value)}
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <button
                onClick={handleSaveEdits}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          ) : null}

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <div className="text-[11px] text-zinc-500 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Tiempo Previsto</span>
              </div>
              <div className="text-base font-black text-zinc-200 mt-0.5">
                {workout.plannedDurationMin} min
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <div className="text-[11px] text-zinc-500 flex items-center space-x-1">
                <Mountain className="w-3.5 h-3.5 text-amber-400" />
                <span>Desnivel (D+)</span>
              </div>
              <div className="text-base font-black text-amber-400 mt-0.5">
                {workout.plannedElevationGainM ? `+${workout.plannedElevationGainM} m` : 'Variable'}
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 col-span-2">
              <div className="text-[11px] text-zinc-500 flex items-center space-x-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Objetivo de FC</span>
              </div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">
                {workout.targetHrMin || workout.targetHrMax
                  ? `${workout.targetHrMin ? `${workout.targetHrMin}–` : '≤ '}${workout.targetHrMax ?? ''} ppm`
                  : workout.completed
                    ? 'Sin objetivo (actividad importada de Suunto)'
                    : 'Sin umbral de FC: por sensaciones (pudiendo hablar)'}
              </div>
              {profile.aetHr > 0 && (
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Tu umbral aeróbico: {profile.aetHr} ppm
                </div>
              )}
            </div>
          </div>

          {/* Real Completed Metrics & Physiological Load (TSS & IF) */}
          {workout.completed && (
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-2">
                <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Métricas Reales & Carga TSS (Modelo Coggan)
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {workout.actualDurationMin || workout.plannedDurationMin} min | {workout.actualDistanceKm || workout.plannedDistanceKm || 0} km | +{workout.actualElevationGainM || workout.plannedElevationGainM || 0}m D+
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">TSS Sesión</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {getWorkoutLoad(workout, measuredAntHr(profile))?.tss ?? workout.plannedTss ?? calculateWorkoutTss(workout.plannedDurationMin, undefined, measuredAntHr(profile)).tss}
                    </span>
                    <span className="text-[10px] text-zinc-500">TSS</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Intensity Factor (IF)</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-cyan-400 font-mono">
                      {workout.intensityFactor != null
                        ? workout.intensityFactor.toFixed(2)
                        : workout.suuntoWorkoutKey
                          ? '—'
                          : calculateWorkoutTss(workout.actualDurationMin || workout.plannedDurationMin, workout.actualAvgHr || undefined, measuredAntHr(profile), workout.athleteRpe).intensityFactor.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-zinc-500">IF</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">FC Media Real</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-rose-400 font-mono">{workout.actualAvgHr || '--'}</span>
                    <span className="text-[10px] text-zinc-500">bpm</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">RPE Atleta</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-emerald-400 font-mono">{workout.athleteRpe || '—'}</span>
                    <span className="text-[10px] text-zinc-500">/ 10</span>
                  </div>
                </div>
              </div>
              {/* Datos medidos por Suunto (tiempo por zonas de FC, subida/bajada, sensación, temperatura) */}
              {(workout.suuntoHrZones || workout.ascentTimeMin != null || workout.descentTimeMin != null || workout.suuntoFeeling || workout.weatherTemperatureC != null) && (
                <div className="pt-2 mt-1 border-t border-zinc-800/80 space-y-1.5 text-[11px] text-zinc-400">
                  {workout.suuntoHrZones && (() => {
                    const z = workout.suuntoHrZones!;
                    const m = (sec: number) => Math.round(sec / 60);
                    const zones = [
                      { k: 'Z1', range: `<${z.lowerLimits.z2}`, min: m(z.timesSec.z1) },
                      { k: 'Z2', range: `${z.lowerLimits.z2}–${z.lowerLimits.z3 - 1}`, min: m(z.timesSec.z2) },
                      { k: 'Z3', range: `${z.lowerLimits.z3}–${z.lowerLimits.z4 - 1}`, min: m(z.timesSec.z3) },
                      { k: 'Z4', range: `${z.lowerLimits.z4}–${z.lowerLimits.z5 - 1}`, min: m(z.timesSec.z4) },
                      { k: 'Z5', range: `≥${z.lowerLimits.z5}`, min: m(z.timesSec.z5) },
                    ];
                    return (
                      <div>
                        <span className="font-semibold text-zinc-300">Tiempo por zonas de FC (medido por Suunto): </span>
                        <span className="font-mono">{zones.map((x) => `${x.k} ${x.range}: ${x.min}′`).join(' · ')}</span>
                      </div>
                    );
                  })()}
                  {(workout.ascentTimeMin != null || workout.descentTimeMin != null) && (
                    <div><span className="font-semibold text-zinc-300">Subiendo / bajando: </span><span className="font-mono">{workout.ascentTimeMin ?? '—'}′ / {workout.descentTimeMin ?? '—'}′</span></div>
                  )}
                  {(workout.suuntoFeeling || workout.weatherTemperatureC != null) && (
                    <div>
                      {workout.suuntoFeeling ? <span>Sensación en Suunto: <span className="font-mono text-zinc-300">{workout.suuntoFeeling}/5</span></span> : null}
                      {workout.suuntoFeeling && workout.weatherTemperatureC != null ? ' · ' : null}
                      {workout.weatherTemperatureC != null ? <span>Temperatura: <span className="font-mono text-zinc-300">{workout.weatherTemperatureC} °C</span></span> : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Adaptation warning if adapted */}
          {workout.wasAdapted && (
            <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-3.5 flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-red-300">Sesión Modificada por el Entrenador: </span>
                <span className="text-zinc-300">{workout.adaptationReason}</span>
              </div>
            </div>
          )}

          {/* Structure & Prescription */}
          <div className="space-y-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
            {/* 100% Personalized Coaching Rationale */}
            {workout.personalizedReasoning && (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  <span>Por qué esta sesión está personalizada para ti hoy:</span>
                </div>
                <p className="text-xs text-stone-200 leading-relaxed font-sans">
                  {workout.personalizedReasoning}
                </p>
                {workout.learnedAdjustment && (
                  <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-300 font-mono">
                    <strong>Regla de memoria aplicada:</strong> {workout.learnedAdjustment}
                  </div>
                )}
              </div>
            )}

            {workout.description && (
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Objetivo Fisiológico (Uphill Athlete)
                </h4>
                <p className="text-xs text-zinc-200 leading-relaxed">{workout.description}</p>
              </div>
            )}

            {workout.warmup && (
              <div className="border-t border-zinc-800/60 pt-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Calentamiento (15-20 min)
                </h4>
                <p className="text-xs text-zinc-300">{workout.warmup}</p>
              </div>
            )}

            <div className="border-t border-zinc-800/60 pt-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                Parte Principal
              </h4>
              <p className="text-xs text-zinc-100 font-medium leading-relaxed bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                {workout.mainSet}
              </p>
            </div>

            {workout.cooldown && (
              <div className="border-t border-zinc-800/60 pt-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Vuelta a la Calma
                </h4>
                <p className="text-xs text-zinc-300">{workout.cooldown}</p>
              </div>
            )}

            {/* Terrain & Mountain Specifics */}
            {workout.terrainRecommendation && (
              <div className="border-t border-zinc-800/60 pt-3 flex items-start space-x-2">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-400">Terreno Recomendado: </span>
                  <span className="text-zinc-300">{workout.terrainRecommendation}</span>
                </div>
              </div>
            )}

            {/* Nutrition & Fueling Guidelines by Coach Miguel */}
            <div className="border-t border-zinc-800/60 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                  <Apple className="w-4 h-4 text-amber-400" />
                  <span>Pauta de Nutrición & Hidratación del Coach Miguel:</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Transvulcania Protocol</span>
              </div>

              {/* 3 Targets: Carbs, Fluids, Sodium */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Carbohidratos</span>
                  <strong className="text-amber-400 text-xs">{workout.plannedCarbsPerHourG || (workout.plannedDurationMin > 90 ? 55 : 30)} g/h</strong>
                </div>
                <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Hidratación</span>
                  <strong className="text-blue-400 text-xs">{workout.plannedFluidsPerHourMl || 600} ml/h</strong>
                </div>
                <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Sodio / Sales</span>
                  <strong className="text-emerald-400 text-xs">{workout.plannedSodiumPerHourMg || 550} mg/h</strong>
                </div>
              </div>

              {workout.nutritionAdvice ? (
                <p className="text-xs text-zinc-300 leading-relaxed pl-1">{workout.nutritionAdvice}</p>
              ) : (
                <p className="text-xs text-zinc-400 leading-relaxed pl-1">
                  Bebe pequeños sorbos cada 15 min. Alterna gel con ratio glucosa:fructosa (1:0.8) con agua con sales electrolíticas.
                </p>
              )}
            </div>
          </div>

          {/* Strength Exercises (No Gym / Outdoor Friendly) */}
          {workout.strengthExercises && workout.strengthExercises.length > 0 && (
            <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-indigo-950/60">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Dumbbell className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Fuerza en Casa / Outdoor (Sin Gimnasio)
                </h4>
              </div>
              <div className="space-y-2">
                {workout.strengthExercises.map((ex, idx) => (
                  <div key={idx} className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 text-xs">
                    <div className="flex justify-between font-bold text-zinc-200">
                      <span>{ex.name}</span>
                      <span className="text-indigo-400">{ex.sets} series x {ex.reps}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">{ex.notes}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Enfoque: {ex.targetMuscle}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workout Completion & FIT Upload Section */}
          <div className="border-t border-zinc-800 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Registrar Realización & Archivo FIT de Suunto</span>
              </h3>
              {!showLogForm && (
                <button
                  onClick={() => setShowLogForm(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
                >
                  Registrar Datos
                </button>
              )}
            </div>

            {showLogForm && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                
                {/* Suunto connection preference reminder */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <Watch className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="block text-amber-200">Sincronización Suunto:</strong>
                    Si tu cuenta Suunto está conectada, pulsa <em>Sincronizar</em> en la pestaña Suunto y esta sesión se completará sola con
                    los datos reales del reloj. Para el análisis detallado, sube a continuación el archivo <strong>.FIT</strong> y Miguel
                    extraerá la curva cardíaca, el desnivel y el tiempo por FC respecto a tus umbrales (el .FIT no incluye DFA &alpha;1).
                  </div>
                </div>

                {/* Upload Real FIT file */}
                <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-center transition-all bg-zinc-900/40">
                  <Upload className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-200">
                    Sube tu archivo .FIT de Suunto
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Extrae automáticamente tiempo, distancia, desnivel, pulso y evalúa ZoneSense
                  </p>
                  <label className="mt-3 inline-block px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 cursor-pointer border border-zinc-700">
                    {isParsingFit ? 'Leyendo FIT...' : 'Seleccionar archivo .FIT'}
                    <input
                      type="file"
                      accept=".fit"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {parsedFit && (
                    <div className="mt-2 text-xs text-emerald-400 font-semibold">
                      Archivo cargado: {parsedFit.fileName} ({parsedFit.totalDistanceKm}km, +{parsedFit.totalAscentM}m D+)
                    </div>
                  )}
                </div>

                {/* Actual Metrics Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400">Duración Real (min)</label>
                    <input
                      type="number"
                      value={actualDuration}
                      onChange={(e) => setActualDuration(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Distancia Real (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={actualDistance}
                      onChange={(e) => setActualDistance(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">D+ Real (metros)</label>
                    <input
                      type="number"
                      value={actualElevation}
                      onChange={(e) => setActualElevation(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">FC Media (bpm)</label>
                    <input
                      type="number"
                      value={actualAvgHr}
                      onChange={(e) => setActualAvgHr(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                {/* Subjective RPE & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Esfuerzo Percibido (RPE 1-10)</span>
                      <span className="font-bold text-amber-400">{athleteRpe}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={athleteRpe}
                      onChange={(e) => setAthleteRpe(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Sensaciones / Molestias / Clima</label>
                    <input
                      type="text"
                      placeholder="Ej: Mucho viento arriba, piernas algo cargadas al bajar..."
                      value={athleteNotes}
                      onChange={(e) => setAthleteNotes(e.target.value)}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                {/* Actual Nutrition & GI Tolerance Logging (Pautas del Entrenador) */}
                <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      <span>Nutrición e Hidratación Real Consumida</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Miguel analizará tu tolerancia</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-zinc-400">CH Reales (g/h)</label>
                      <input
                        type="number"
                        value={actualCarbs}
                        onChange={(e) => setActualCarbs(Number(e.target.value))}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-amber-400 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400">Líquidos (ml/h)</label>
                      <input
                        type="number"
                        value={actualFluids}
                        onChange={(e) => setActualFluids(Number(e.target.value))}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-blue-400 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400">Sodio (mg/h)</label>
                      <input
                        type="number"
                        value={actualSodium}
                        onChange={(e) => setActualSodium(Number(e.target.value))}
                        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-emerald-400 font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 text-xs">
                    <span className="text-[11px] text-zinc-400">Tolerancia Digestiva (1 a 5):</span>
                    <div className="flex items-center space-x-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setGiTolerance(star)}
                          className={`p-1 rounded transition-colors ${
                            star <= giTolerance ? 'text-amber-400' : 'text-zinc-700'
                          }`}
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      ))}
                      <span className="text-[11px] text-zinc-400 ml-1">
                        {giTolerance === 5 ? 'Perfecta' : giTolerance >= 3 ? 'Aceptable' : 'Molestias/Náuseas'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Alimentos utilizados (ej: 2 geles 1:0.8, agua con sales, barrita)"
                      value={fuelingNotes}
                      onChange={(e) => setFuelingNotes(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300"
                    />
                  </div>
                </div>

                {/* Debrief Button */}
                <div className="pt-2">
                  <button
                    onClick={handleCompleteAndAnalyze}
                    disabled={isAnalyzing}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-lg transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAnalyzing ? 'Analizando datos con Miguel...' : 'Guardar y Recibir Evaluación de Miguel'}</span>
                  </button>
                </div>

                {/* Miguel Debrief Review */}
                {coachAnalysis && (
                  <div className="mt-4 bg-zinc-900/90 border border-emerald-900/40 p-4 rounded-xl space-y-3">
                    <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                      <MessageSquare className="w-4 h-4" />
                      <span>Evaluación Post-Entreno de Miguel</span>
                    </div>
                    <p className="text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
                      {coachAnalysis}
                    </p>

                    {memoryChanges.length > 0 && (
                      <div className="mt-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                          <Brain className="w-4 h-4 text-emerald-400" />
                          <span>Evidencias anotadas en la memoria de Miguel:</span>
                        </div>
                        <ul className="text-xs text-stone-200 space-y-0.5 list-disc pl-4">
                          {memoryChanges.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-stone-400 mt-1">
                          Una sesión es una evidencia: solo pasa a regla si se repite (3 o más).
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <button
            onClick={() => onAskMiguel(workout)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-amber-400 border border-zinc-700 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Hablar con Miguel sobre esta sesión</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>

        {/* Suunto Structured Workout Export Modal */}
        <SuuntoExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          workout={workout}
          profile={profile}
        />

      </div>
    </div>
  );
};
