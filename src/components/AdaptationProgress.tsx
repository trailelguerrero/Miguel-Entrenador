import React, { useState } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  Activity, 
  TrendingUp, 
  HelpCircle, 
  AlertCircle, 
  Layers, 
  Dna, 
  Award,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Apple
} from 'lucide-react';
import { AdaptationStage, AthleteProfile, GutTrainingProfile } from '../types';
import { StorageService } from '../services/storage';

interface AdaptationProgressProps {
  profile: AthleteProfile;
  gutProfile: GutTrainingProfile;
  onUpdateGutProfile: (updated: GutTrainingProfile) => void;
}

export const AdaptationProgress: React.FC<AdaptationProgressProps> = ({
  profile,
  gutProfile,
  onUpdateGutProfile,
}) => {
  const [selectedStageId, setSelectedStageId] = useState<number>(gutProfile.activeStageId || 2);
  const [expandedTroubleId, setExpandedTroubleId] = useState<string | null>(null);

  const stages = gutProfile.stages || [];
  const currentStage = stages.find(s => s.id === (gutProfile.activeStageId || 2)) || stages[1];

  // Calculate overall gut readiness %
  const totalRequired = stages.reduce((acc, s) => acc + s.sessionsRequired, 0);
  const totalDone = stages.reduce((acc, s) => acc + Math.min(s.sessionsCompleted, s.sessionsRequired), 0);
  const overallGutReadinessPct = Math.round((totalDone / totalRequired) * 100);

  const handleIncrementSession = (stageId: number) => {
    const updatedStages = stages.map(stage => {
      if (stage.id === stageId) {
        const newCompleted = stage.sessionsCompleted + 1;
        const isNowCompleted = newCompleted >= stage.sessionsRequired;
        return {
          ...stage,
          sessionsCompleted: newCompleted,
          status: isNowCompleted ? ('completed' as const) : ('in_progress' as const),
        };
      }
      return stage;
    });

    // Check if next stage should unlock
    const currentCompleted = updatedStages.find(s => s.id === stageId);
    if (currentCompleted && currentCompleted.sessionsCompleted >= currentCompleted.sessionsRequired && stageId < 4) {
      const nextStageIndex = updatedStages.findIndex(s => s.id === stageId + 1);
      if (nextStageIndex >= 0 && updatedStages[nextStageIndex].status === 'locked') {
        updatedStages[nextStageIndex].status = 'in_progress';
      }
    }

    const updatedProfile: GutTrainingProfile = {
      ...gutProfile,
      stages: updatedStages,
      currentMaxCarbsPerHour: Math.max(gutProfile.currentMaxCarbsPerHour, currentStage.minCarbsGramsPerHour + 5),
    };

    onUpdateGutProfile(updatedProfile);
    StorageService.saveGutProfile(updatedProfile);
  };

  const handleSetActiveStage = (stageId: number) => {
    setSelectedStageId(stageId);
    const stage = stages.find(s => s.id === stageId);
    if (stage) {
      const updatedProfile: GutTrainingProfile = {
        ...gutProfile,
        activeStageId: stageId,
        currentMaxCarbsPerHour: stage.minCarbsGramsPerHour + 5,
        trainingPhase: stageId === 1 
          ? 'Initiation (30-45g/h)' 
          : stageId === 2 
          ? 'Volume Tolerance (50-65g/h)' 
          : 'Race Pace High Load (70-90g/h)',
      };
      onUpdateGutProfile(updatedProfile);
      StorageService.saveGutProfile(updatedProfile);
    }
  };

  const gastroTroubleshooting = [
    {
      id: 'nausea_uphill',
      symptom: 'Náuseas o estómago bloqueado al subir cuestas empinadas',
      cause: 'Isquemia esplácnica por pulso excesivo (> AeT 142 bpm). El cuerpo desvía el 80% de la sangre a los cuádriceps y detiene el peristaltismo.',
      solution: 'Disminuir el ritmo a caminata asistida (power-hiking) inmediatamente hasta que el pulso vuelva a caer < 140 bpm. No comer nada sólido hasta estabilizar la respiración.',
    },
    {
      id: 'bloating_gas',
      symptom: 'Hinchazón abdominal, ruidos estomacales o gases',
      cause: 'Saturación del transportador GLUT5 por exceso de fructosa aislada sin suficiente glucosa o maltodextrina que arrastre el agua.',
      solution: 'Cambiar a geles con proporción maltodextrina:fructosa 1:0.8 o 2:1. Nunca superar 30g de fructosa por hora sin acompañamiento de sodio.',
    },
    {
      id: 'reflux_heartburn',
      symptom: 'Reflujo gastroesofágico o ardor en el pecho',
      cause: 'Tragar aire al respirar agitadamente o geles demasiado densos/ácidos sin suficiente agua clara para rebajar la concentración osmótica.',
      solution: 'Por cada gel de 25-30g, beber al menos 150ml de agua pura. Evitar productos con exceso de ácido cítrico artificial.',
    },
    {
      id: 'water_sloshing',
      symptom: 'Sensación de agua botando en el estómago ("estómago encharcado")',
      cause: 'Falta de sodio en la bebida. Sin sodio, el cotransportador SGLT1 no puede absorber el agua a través del enterocito y el líquido queda atrapado en el estómago.',
      solution: 'Añadir 500-600 mg de sodio por litro de agua o tomar una cápsula de sales con un sorbo de agua.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Gut Capacity & Roadmap Status */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/30">
                Progreso Fisiológico Intestinal
              </span>
              <span className="text-xs text-stone-400 font-mono">
                Adaptación de Transportadores SGLT1 / GLUT5
              </span>
            </div>
            <h2 className="text-2xl font-black text-stone-100 flex items-center gap-3">
              <Dna className="w-7 h-7 text-emerald-400" />
              Hoja de Ruta: De 30 g/h a 80-90 g/h
            </h2>
            <p className="text-xs text-stone-300 mt-1 max-w-2xl leading-relaxed">
              El intestino humano no puede absorber más de 60 g/h de glucosa por saturación del canal <strong>SGLT1</strong>. 
              Para llegar a los <strong>80g/h que exige Transvulcania</strong>, entrenamos el canal <strong>GLUT5</strong> mediante 
              ingestas progresivas de carbohidratos duales en tus tiradas de fin de semana.
            </p>
          </div>

          {/* Overall Readiness Circle / Card */}
          <div className="bg-stone-950 border border-stone-800 p-4 rounded-2xl flex items-center gap-4 shrink-0">
            <div className="w-16 h-16 rounded-full border-4 border-amber-500 flex flex-col items-center justify-center font-mono">
              <span className="text-lg font-black text-stone-100">{overallGutReadinessPct}%</span>
              <span className="text-[9px] text-stone-400 uppercase">Listo</span>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">Tolerancia Actual</span>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {gutProfile.currentMaxCarbsPerHour} g/h
              </span>
              <span className="text-[11px] text-stone-400 block mt-0.5">
                Meta Transvulcania: {gutProfile.goalCarbsPerHour} g/h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Interactive Adaptation Stages */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Fases de Adaptación Gastrointestinal
          </h3>
          <span className="text-xs text-stone-400 font-mono">
            Fase activa: <strong className="text-amber-400">{currentStage.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stages.map((stage) => {
            const isCompleted = stage.status === 'completed';
            const isInProgress = stage.status === 'in_progress';
            const isLocked = stage.status === 'locked';
            const isSelected = selectedStageId === stage.id;

            return (
              <div
                key={stage.id}
                onClick={() => !isLocked && setSelectedStageId(stage.id)}
                className={`rounded-2xl border p-5 transition-all relative ${
                  isSelected 
                    ? 'bg-stone-850 border-amber-500/80 shadow-xl shadow-amber-500/10' 
                    : isCompleted 
                    ? 'bg-stone-900 border-emerald-500/40 hover:border-emerald-500/70' 
                    : isInProgress
                    ? 'bg-stone-900 border-amber-500/40 hover:border-amber-500/70'
                    : 'bg-stone-900/60 border-stone-800 opacity-60'
                } ${!isLocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                {/* Header with status badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-stone-400">
                        {stage.shortName}
                      </span>
                      {stage.id === gutProfile.activeStageId && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] uppercase border border-amber-500/30">
                          Fase Actual
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-stone-100 mt-0.5">
                      {stage.name}
                    </h4>
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Superada
                      </span>
                    ) : isInProgress ? (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1 border border-amber-500/30 animate-pulse">
                        <Activity className="w-3.5 h-3.5" />
                        En Curso
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl bg-stone-800 text-stone-400 text-xs font-semibold flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        Bloqueada
                      </span>
                    )}
                  </div>
                </div>

                {/* Range and Transport Mechanism */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                    <span className="text-[10px] text-stone-400 block font-medium">Rango de Carga</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {stage.carbsRangeLabel}
                    </span>
                  </div>
                  <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                    <span className="text-[10px] text-stone-400 block font-medium">Canales Reclutados</span>
                    <span className="text-xs font-bold text-stone-300 truncate block">
                      {stage.targetTransporters}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-stone-400">Sesiones Específicas:</span>
                    <span className="text-stone-200 font-bold">
                      {stage.sessionsCompleted} / {stage.sessionsRequired} completadas
                    </span>
                  </div>
                  <div className="w-full bg-stone-950 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, (stage.sessionsCompleted / stage.sessionsRequired) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Biological Explanation */}
                <p className="text-xs text-stone-300 leading-relaxed mb-3">
                  {stage.biologicalMechanism}
                </p>

                {/* Action footer */}
                <div className="flex items-center justify-between pt-3 border-t border-stone-800/80">
                  <div className="text-[11px] text-stone-400">
                    💡 <strong>Criterio:</strong> {stage.coachGraduationCriteria}
                  </div>

                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIncrementSession(stage.id);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1"
                        title="Registrar sesión tolerada con éxito"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>+1 Test OK</span>
                      </button>

                      {stage.id !== gutProfile.activeStageId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActiveStage(stage.id);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs transition cursor-pointer"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metabolic Efficiency: FatMax & Glycogen Preservation */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-100">
                Eficiencia Metabólica FatMax & Preservación de Glucógeno
              </h3>
              <p className="text-xs text-stone-400">
                La combinación de tu base aeróbica sub-AeT (&lt;142 bpm) y tu absorción gástrica de {gutProfile.currentMaxCarbsPerHour} g/h
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs text-emerald-400 font-bold">
              🔥 Oxidación de Grasa: ~{gutProfile.fatMaxGramsPerHour || 48} g/h
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 space-y-2">
            <span className="text-xs text-stone-400 font-medium block">Reserva Muscular & Hepática</span>
            <span className="text-2xl font-black text-amber-400 font-mono">~450 gramos</span>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Equivale a unas 1.800 kcal de glucógeno almacenado. Si no consumes carbohidratos en carrera, 
              entrarás en la temida "pájara" o colapso glucémico antes del Refugio del Pilar (km 24).
            </p>
          </div>

          <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 space-y-2">
            <span className="text-xs text-stone-400 font-medium block">Aporte Exógeno Asimilado</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">+{gutProfile.currentMaxCarbsPerHour * 10} g</span>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              En una carrera de 10 horas, ingresar {gutProfile.currentMaxCarbsPerHour} g/h aporta 
              <strong> {gutProfile.currentMaxCarbsPerHour * 10 * 4} kcal</strong> directas al torrente sanguíneo, protegiendo 
              la fibra muscular de la autofagia.
            </p>
          </div>

          <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 space-y-2">
            <span className="text-xs text-stone-400 font-medium block">Blindaje de Bajada (El Time)</span>
            <span className="text-2xl font-black text-cyan-400 font-mono">-35% daño</span>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              El glucógeno no solo da energía: es imprescindible para la relajación de puentes cruzados de actina-miosina 
              en la contracción excéntrica de bajada. Correr con glucógeno reduce las roturas fibrilares.
            </p>
          </div>
        </div>
      </div>

      {/* Gastrointestinal Troubleshooting Accordion (Coach Miguel's Guide) */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="border-b border-stone-800 pb-3">
          <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            Protocolo de Urgencia Digestiva en Carrera (Solución de Síntomas)
          </h3>
          <p className="text-xs text-stone-400">
            Qué hacer si surge malestar durante las 73K de Transvulcania
          </p>
        </div>

        <div className="space-y-2">
          {gastroTroubleshooting.map((trouble) => {
            const isExpanded = expandedTroubleId === trouble.id;

            return (
              <div 
                key={trouble.id}
                className="bg-stone-950 border border-stone-850 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTroubleId(isExpanded ? null : trouble.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-stone-900/60 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-stone-200">
                      {trouble.symptom}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-3.5 border-t border-stone-850 bg-stone-900/40 space-y-2 text-xs">
                    <div>
                      <span className="text-stone-400 font-semibold block text-[11px]">Causa Fisiológica:</span>
                      <p className="text-stone-300 text-[11px] leading-relaxed mt-0.5">
                        {trouble.cause}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <strong className="block text-[11px] text-emerald-200 mb-0.5">Solución en Ruta de Miguel:</strong>
                      <p className="text-[11px] leading-relaxed">
                        {trouble.solution}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
