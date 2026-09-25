import React, { useState } from 'react';
import { 
  Brain, 
  Sparkles, 
  Lightbulb, 
  ShieldCheck, 
  Activity, 
  Flame, 
  Heart, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  TrendingUp,
  Compass,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { CoachLearnedMemory, CoachLearnedInsight, AthleteProfile } from '../types';
import { ApiService } from '../services/api';
import { applyEvidence, confirmPending, countEvidence, discardPending, isAppliedRule, STATUS_LABEL } from '../brain/memory';
import { localDateKey } from '../utils/trainingLoad';

interface CoachMemoryViewProps {
  memory: CoachLearnedMemory;
  onUpdateMemory: (updated: CoachLearnedMemory) => void;
  profile: AthleteProfile;
  onRegeneratePlanWithMemory?: () => void;
}

export const CoachMemoryView: React.FC<CoachMemoryViewProps> = ({
  memory,
  onUpdateMemory,
  profile,
  onRegeneratePlanWithMemory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newNoteText, setNewNoteText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [miguelFeedback, setMiguelFeedback] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'Todos los aprendizajes', icon: Brain },
    { id: 'physiology_zonesense', label: 'Fisiología & ZoneSense', icon: Activity },
    { id: 'fatigue_recovery', label: 'Fatiga & HRV', icon: Heart },
    { id: 'biomechanics_injury', label: 'Biomecánica & Sóleo/Cuádriceps', icon: ShieldCheck },
    { id: 'nutrition_hydration', label: 'Nutrición & Hidratación', icon: Flame },
    { id: 'terrain_technique', label: 'Técnica & Desnivel', icon: Compass },
  ];

  const filteredInsights = selectedCategory === 'all'
    ? memory.insights
    : memory.insights.filter((i) => i.category === selectedCategory);

  const handleRegisterObservation = async () => {
    if (!newNoteText.trim() || isExtracting) return;

    setIsExtracting(true);
    setMiguelFeedback(null);

    try {
      const extracted = await ApiService.extractInsightFromNote(newNoteText, profile, memory);
      const today = localDateKey();
      // La nota es UNA evidencia; el estado (observación → regla) lo calcula el código
      const { memory: withEvidence, changes } = applyEvidence(memory, extracted.evidence || [], {
        date: today,
        source: 'athlete_note',
        refId: `note-${Date.now()}`,
        sourceEvent: 'Nota del atleta en la libreta de Miguel',
      }, today);

      const updatedMemory: CoachLearnedMemory = {
        ...withEvidence,
        coachNotebookNotes: [
          newNoteText,
          ...(memory.coachNotebookNotes || []),
        ],
      };

      onUpdateMemory(updatedMemory);
      setMiguelFeedback(
        [extracted.miguelConfirmation || 'Anotado en mi libreta.', changes.length ? `(${changes.join(' · ')})` : '(La guardo como nota: no aporta evidencia concreta.)'].join(' '),
      );
      setNewNoteText('');
    } catch (err: any) {
      // El banner "Error de API de IA" ya muestra el detalle y qué hacer
      console.error('Error al procesar la nota:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const pending = memory.pendingEvidence || [];
  const appliedCount = memory.insights.filter((i) => isAppliedRule(i.status)).length;
  const handleConfirmPending = (id: string) => onUpdateMemory(confirmPending(memory, id, localDateKey()).memory);
  const handleDiscardPending = (id: string) => onUpdateMemory(discardPending(memory, id));

  const getStatusBadge = (status: CoachLearnedInsight['status']) => {
    switch (status) {
      case 'consolidated_rule':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'provisional_rule':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'hypothesis':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'refuted':
      case 'expired':
        return 'bg-stone-700/40 text-stone-400 border-stone-600';
      default:
        return 'bg-stone-500/20 text-stone-300 border-stone-500/30';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'physiology_zonesense':
        return { label: 'ZoneSense / AeT', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'fatigue_recovery':
        return { label: 'Recuperación & HRV', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'biomechanics_injury':
        return { label: 'Biomecánica & Lesiones', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'nutrition_hydration':
        return { label: 'Nutrición / Digestión', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      case 'terrain_technique':
        return { label: 'Técnica & Terreno', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      default:
        return { label: 'General', bg: 'bg-stone-500/20 text-stone-400 border-stone-500/30' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Evolutionary Coaching Philosophy */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-tr from-emerald-500 to-teal-400 text-stone-950 rounded-xl shadow-lg shadow-emerald-500/20">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Memoria Evolutiva de Miguel
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Cero Plantillas Genéricas
                  </span>
                </h1>
                <p className="text-xs text-stone-400">
                  Miguel aprende de cada zancada, RPE, fatiga y descanso para conocer tu fisiología mejor cada día
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-stone-800 text-stone-300 px-3 py-1.5 rounded-lg border border-stone-700 flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {appliedCount} reglas aplicadas · {memory.insights.length} aprendizajes
              </span>
              {onRegeneratePlanWithMemory && (
                <button
                  onClick={onRegeneratePlanWithMemory}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Prescribir Plan con mi Memoria
                </button>
              )}
            </div>
          </div>

          {/* Tactical Assessment Box */}
          <div className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider mb-1">
                  Diagnóstico Táctico Personalizado de Miguel
                </h3>
                <p className="text-sm text-stone-200 leading-relaxed font-sans">
                  {memory.overallPhilosophySummary}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input: Teach or Tell Miguel Something New */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Enseña a Miguel: Cuéntale cómo responde tu cuerpo
        </h2>
        <p className="text-xs text-stone-400 mb-3">
          ¿Has probado un nuevo desayuno? ¿Te molestó el tendón tras una bajada con barro? Escríbelo con tus palabras: Miguel lo anota como una evidencia. Solo se convierte en regla si se repite (3 o más evidencias a favor; 5 sin contradicciones para consolidarla).
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Ej: Ayer bajando por terreno de piedras sueltas se me cargaron los tibiales, pero con bastones en subida dura mantengo el pulso 10 pulsaciones más bajo..."
            className="flex-1 bg-stone-950 border border-stone-700/80 rounded-xl p-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none h-20"
          />
          <button
            onClick={handleRegisterObservation}
            disabled={!newNoteText.trim() || isExtracting}
            className="sm:w-44 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-stone-950 font-bold text-xs rounded-xl p-3 transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {isExtracting ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                Aprendiendo...
              </span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Grabar en Memoria</span>
              </>
            )}
          </button>
        </div>

        {miguelFeedback && (
          <div className="mt-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200">
              <strong className="text-emerald-300">Miguel:</strong> "{miguelFeedback}"
            </p>
          </div>
        )}
      </div>

      {/* Evidencias del chat pendientes de confirmar */}
      {pending.length > 0 && (
        <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Evidencias de tus conversaciones pendientes de confirmar ({pending.length})
          </h2>
          <p className="text-xs text-stone-400 mb-3">
            Miguel las ha sacado del chat. Solo cuentan si confirmas que son ciertas.
          </p>
          <div className="space-y-2">
            {pending.map((p) => {
              const target = p.item.insightId ? memory.insights.find((i) => i.id === p.item.insightId) : null;
              return (
                <div key={p.id} className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1">
                    <p>{p.item.summary}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {target
                        ? `${p.item.supports ? 'Apoya' : 'Contradice'}: "${target.observation}"`
                        : `Nuevo hallazgo: "${p.item.observation}"`}{' '}
                      · {p.date}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleConfirmPending(p.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-stone-950 font-bold cursor-pointer">
                      Es cierto
                    </button>
                    <button onClick={() => handleDiscardPending(p.id)} className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 font-bold cursor-pointer">
                      Descartar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                isActive
                  ? 'bg-emerald-500 text-stone-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:border-stone-700 hover:text-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              {cat.id === 'all' && (
                <span className="bg-stone-950/40 px-1.5 py-0.5 rounded-full text-[10px]">
                  {memory.insights.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Learned Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInsights.map((insight) => {
          const badge = getCategoryBadge(insight.category);
          return (
            <div
              key={insight.id}
              className="bg-stone-900 border border-stone-800/90 rounded-2xl p-5 hover:border-stone-700 transition-all flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${getStatusBadge(insight.status)}`}>
                    {STATUS_LABEL[insight.status ?? 'observation']}
                  </span>
                </div>

                {/* Observation */}
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Observación:
                  </h4>
                  <p className="text-sm font-medium text-stone-100 leading-snug">
                    "{insight.observation}"
                  </p>
                </div>

                {/* Regla (solo si ya se aplica) o hipótesis a vigilar */}
                {insight.ruleForFuturePlans && (
                  <div className={`bg-stone-950/70 border rounded-xl p-3 mb-3 ${isAppliedRule(insight.status) ? 'border-emerald-500/20' : 'border-stone-700/60'}`}>
                    <h5 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1 ${isAppliedRule(insight.status) ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isAppliedRule(insight.status) ? 'Regla aplicada en tus planes:' : 'A vigilar (todavía no se aplica):'}
                    </h5>
                    <p className="text-xs text-stone-300 leading-relaxed font-mono">
                      {insight.ruleForFuturePlans}
                    </p>
                  </div>
                )}

                {/* Evidencias */}
                <div className="mb-3">
                  <p className="text-[11px] text-stone-400 flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    {countEvidence(insight.evidence).support} a favor · {countEvidence(insight.evidence).against} en contra · última {insight.lastEvidenceAt}
                  </p>
                  <ul className="space-y-0.5">
                    {(insight.evidence || []).slice(-4).map((e, k) => (
                      <li key={k} className="text-[11px] text-stone-400">
                        <span className={e.supports ? 'text-emerald-400' : 'text-red-400'}>{e.supports ? '+' : '−'}</span> {e.date}: {e.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                <span className="truncate max-w-[200px]">{insight.sourceEvent}</span>
                <span>{insight.learnedFromDate}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Internal Notebook & Adaptation History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Coach Personal Notebook */}
        <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Notas en la Libreta de Miguel
          </h3>
          <div className="space-y-2.5">
            {(memory.coachNotebookNotes || []).map((note, idx) => (
              <div
                key={idx}
                className="bg-stone-950 border border-stone-800/70 rounded-xl p-3 text-xs text-stone-300 flex items-start gap-2.5"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                <p className="leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Adaptations History */}
        <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Historial de Adaptaciones en Vivo
          </h3>
          {memory.adaptationHistory && memory.adaptationHistory.length > 0 ? (
            <div className="space-y-2.5">
              {memory.adaptationHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-stone-950 border border-stone-800/70 rounded-xl p-3 text-xs text-stone-300"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                    <span className="font-semibold text-amber-400">{item.triggerReason}</span>
                    <span>{item.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-200">
                    <span className="line-through text-stone-400">{item.originalWorkoutTitle}</span>
                    <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-400">{item.adaptedWorkoutTitle}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-stone-950/50 border border-stone-800/50 rounded-xl p-4 text-center">
              <p className="text-xs text-stone-400">
                Aún no has necesitado adaptar ninguna sesión por fatiga. Cuando el HRV caiga o reportes dolor, aquí quedará registrado el ajuste para no sobreentrenarte.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
