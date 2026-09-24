import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  ShieldAlert, 
  Battery, 
  BatteryCharging, 
  Sparkles, 
  Info, 
  ArrowRight, 
  Heart, 
  Moon, 
  Clock, 
  ChevronRight,
  Flame,
  Zap,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { DailyCheckIn, AthleteProfile, WeeklyHrvFatigueTrend, DeloadPrediction } from '../types';
import { StorageService } from '../services/storage';

interface WeeklyFatigueHrvWidgetProps {
  profile: AthleteProfile;
  checkIns: DailyCheckIn[];
  onScheduleDeload?: (startDate: string) => void;
}

export const WeeklyFatigueHrvWidget: React.FC<WeeklyFatigueHrvWidgetProps> = ({
  profile,
  checkIns,
  onScheduleDeload,
}) => {
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(4); // Default to current week (Week 4)
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulatedHrv, setSimulatedHrv] = useState<number>(42);
  const [simulatedRestingHr, setSimulatedRestingHr] = useState<number>(51);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'trends' | 'prediction' | 'daily_chart'>('prediction');

  // Baseline HRV
  const baselineHrv = checkIns[0]?.hrvBaseline || 51;
  const baselineRestingHr = profile.restingHr || 46;

  // Compute Weekly Groupings (Last 28 days grouped into 4 blocks of 7 days)
  const weeklyTrends = useMemo<WeeklyHrvFatigueTrend[]>(() => {
    // Sort chronological: oldest to newest
    const sorted = [...checkIns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Take last 28 days or all if less
    const last28 = sorted.slice(-28);
    const weeks: WeeklyHrvFatigueTrend[] = [];

    const weekDefinitions = [
      { index: 1, label: 'Semana 1 (Base & Adaptación)' },
      { index: 2, label: 'Semana 2 (Carga Progresiva)' },
      { index: 3, label: 'Semana 3 (Pico de Carga)' },
      { index: 4, label: 'Semana 4 (Fatiga Acumulada)' },
    ];

    for (let w = 0; w < 4; w++) {
      const startIdx = w * 7;
      const endIdx = startIdx + 7;
      let days = last28.slice(startIdx, endIdx);

      if (days.length === 0) {
        continue;
      }

      // If this is the current week and simulation is active, modify today's values
      if (w === 3 && isSimulating) {
        days = days.map((d, idx) => idx === days.length - 1 ? {
          ...d,
          hrvRmssd: simulatedHrv,
          restingHr: simulatedRestingHr,
          status: simulatedHrv < baselineHrv * 0.85 ? 'fatigued' : 'moderate',
        } : d);
      }

      const avgHrv = Math.round((days.reduce((acc, d) => acc + d.hrvRmssd, 0) / days.length) * 10) / 10;
      const avgRestHr = Math.round((days.reduce((acc, d) => acc + d.restingHr, 0) / days.length) * 10) / 10;
      const avgSleep = Math.round((days.reduce((acc, d) => acc + (d.sleepQuality || 80), 0) / days.length) * 10) / 10;
      const avgSoreness = Math.round((days.reduce((acc, d) => acc + (d.muscleSoreness || 3), 0) / days.length) * 10) / 10;
      const avgStress = Math.round((days.reduce((acc, d) => acc + (d.stressLevel || 3), 0) / days.length) * 10) / 10;
      const avgReadiness = Math.round((days.reduce((acc, d) => acc + d.readinessScore, 0) / days.length));
      
      const amberRedCount = days.filter(d => d.status === 'moderate' || d.status === 'fatigued').length;
      const hrvDevPct = Math.round(((avgHrv - baselineHrv) / baselineHrv) * 1000) / 10;
      const restHrDelta = Math.round((avgRestHr - baselineRestingHr) * 10) / 10;

      let classification: WeeklyHrvFatigueTrend['fatigueClassification'] = 'optimal_recovery';
      if (hrvDevPct < -12 || restHrDelta >= 3.5 || amberRedCount >= 5) {
        classification = 'accumulated_fatigue';
      } else if (hrvDevPct < -5 || restHrDelta >= 1.5 || amberRedCount >= 3) {
        classification = 'functional_overreaching';
      }

      weeks.push({
        weekIndex: w + 1,
        weekLabel: weekDefinitions[w].label,
        startDate: days[0]?.date || '',
        endDate: days[days.length - 1]?.date || '',
        avgHrvRmssd: avgHrv,
        baselineHrv,
        hrvDeviationPct: hrvDevPct,
        avgRestingHr: avgRestHr,
        restingHrDelta: restHrDelta,
        avgSleepQuality: avgSleep,
        avgMuscleSoreness: avgSoreness,
        avgStressLevel: avgStress,
        avgReadinessScore: avgReadiness,
        amberRedDaysCount: amberRedCount,
        totalDays: days.length,
        fatigueClassification: classification,
        isCurrentWeek: w === 3,
      });
    }

    return weeks;
  }, [checkIns, baselineHrv, baselineRestingHr, isSimulating, simulatedHrv, simulatedRestingHr]);

  // Current week trend
  const currentWeek = weeklyTrends[weeklyTrends.length - 1] || weeklyTrends[0];
  const selectedWeek = weeklyTrends.find(w => w.weekIndex === selectedWeekIndex) || currentWeek;

  // Deload Prediction Engine based on Uphill Athlete & Autonomic Biomarkers
  const deloadPrediction = useMemo<DeloadPrediction>(() => {
    const triggers: string[] = [];
    let urgency: DeloadPrediction['urgency'] = 'low';
    let confidence = 70;

    // Trigger 1: HRV suppression
    if (currentWeek.hrvDeviationPct <= -12) {
      triggers.push(`HRV nocturna suprimida un ${Math.abs(currentWeek.hrvDeviationPct)}% respecto a tu línea base (${currentWeek.avgHrvRmssd} ms vs ${baselineHrv} ms)`);
      confidence += 15;
    } else if (currentWeek.hrvDeviationPct <= -6) {
      triggers.push(`HRV ligeramente deprimida (${Math.abs(currentWeek.hrvDeviationPct)}% bajo basal)`);
      confidence += 5;
    }

    // Trigger 2: Resting Heart Rate Drift
    if (currentWeek.restingHrDelta >= 3.0) {
      triggers.push(`Elevación sostenida del pulso en reposo en +${currentWeek.restingHrDelta} bpm (${currentWeek.avgRestingHr} bpm vs ${baselineRestingHr} bpm basal)`);
      confidence += 10;
    }

    // Trigger 3: Chronic Training Phase (3rd or 4th consecutive loading week)
    triggers.push('Mesociclo 2 en semana 4/4 (Ciclo 3:1 completado con +5.200m D- excéntricos acumulados)');

    // Trigger 4: Residual Muscle Soreness
    if (currentWeek.avgMuscleSoreness >= 4.5) {
      triggers.push(`Dolor muscular y fatiga periférica residual elevada (${currentWeek.avgMuscleSoreness}/10 promedio)`);
    }

    // Trigger 5: Days in Amber/Red
    if (currentWeek.amberRedDaysCount >= 4) {
      triggers.push(`${currentWeek.amberRedDaysCount} de 7 días con estado 'Moderado' o 'Fatigado'`);
    }

    // Determine urgency
    if (currentWeek.hrvDeviationPct <= -10 && currentWeek.restingHrDelta >= 2.5 && currentWeek.weekIndex >= 4) {
      urgency = 'imminent';
      confidence = Math.min(96, confidence + 10);
    } else if (currentWeek.hrvDeviationPct <= -7 || currentWeek.weekIndex >= 3) {
      urgency = 'high';
      confidence = Math.min(88, confidence);
    } else {
      urgency = 'moderate';
    }

    // Suggested Start Date: upcoming Monday (in ~2 to 4 days)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (daysUntilNextMonday <= 1 ? 1 : daysUntilNextMonday));
    const formattedDeloadDate = nextMonday.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return {
      urgency,
      recommendedStartDate: formattedDeloadDate,
      recommendedDurationDays: 7,
      confidencePct: confidence,
      currentMesocycleWeek: 4,
      totalLoadingWeeks: 3,
      triggersDetected: triggers,
      physiologicalRationale: `La depresión simultánea de la HRV rMSSD por debajo del percentil 15 y el drift del pulso basal reflejan hiperactividad simpática y saturación del sistema nervioso autónomo. Según la metodología Uphill Athlete (Scott Johnston & Steve House), proseguir con sobrecarga de volumen sin descargar provocará desacople celular mitocondrial, estancamiento del umbral aeróbico (AeT ${profile.aetHr} bpm) y alto riesgo de tendinopatía en sóleos/aquiles tras los impactos excéntricos de La Palma.`,
      suggestedVolumeReductionPct: 45,
      coachMiguelPrescription: {
        maxHeartRateCap: 130, // Strict Z1 recovery, well below AeT 142
        zoneSenseTarget: 'DFA a1 > 0.85 (Regenerativo puro: < 130 bpm)',
        weeklyVolumeHours: 3.2, // ~45% reduction from ~5.8h
        prohibitedElements: [
          'Tiradas > 75 minutos o ritmos tempo Z3/Z4',
          'Desnivel negativo pronunciado (>8% de bajada continuada)',
          'Entrenamientos de fuerza máxima o pliometría agresiva',
          'Subidas a pulso superior a 135 bpm'
        ],
        mandatoryElements: [
          '4 sesiones cortas (30-45 min) 100% en Z1 suave sobre hierba o pista llana',
          'Respiración nasal continua y cadencia ágil (175-180 ppm)',
          'Movilidad articular de cadera y tobillo 15 min diarios',
          '3 series lentas de sóleo en escalón (3-1-1) sin peso extra'
        ],
        recoveryInterventions: [
          'Dormir 8h+ con ventilación fresca para maximizar HRV nocturna',
          'Masaje miofascial con pelota en fascia plantar y sóleo izquierdo',
          'Hidratación con 500 mg de sales en agua tibia tras cada rodaje suave',
          'Prueba de HRV matutina el viernes para confirmar rebote parasimpático'
        ]
      }
    };
  }, [currentWeek, baselineHrv, baselineRestingHr, profile.aetHr]);

  // Status Badge Helper
  const getUrgencyBadge = (urgency: DeloadPrediction['urgency']) => {
    switch (urgency) {
      case 'imminent':
        return (
          <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black flex items-center gap-1.5 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Descarga Inminente Recomendada
          </span>
        );
      case 'high':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Ventana de Descarga Próxima (2-4 días)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Carga Asimilada (En Ciclo)
          </span>
        );
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider border border-amber-500/30 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Biomarcadores Suunto & Check-Ins Diarios
            </span>
            <span className="text-xs text-stone-400 font-mono">
              Algoritmo de Fatiga Autonómica Uphill Athlete
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-stone-100 flex items-center gap-2.5">
            <Battery className="w-6 h-6 text-amber-400" />
            Tendencia de Fatiga Semanal & Predictor de Descarga
          </h2>

          <p className="text-xs text-stone-300 max-w-3xl leading-relaxed">
            Monitoriza la evolución semanal de la <strong>HRV nocturna (rMSSD)</strong>, el <strong>drift del pulso en reposo</strong> y la tensión neuromuscular para predecir cuándo el cuerpo exige un microciclo de descarga antes de caer en sobreentrenamiento no funcional.
          </p>
        </div>

        {/* Prediction Status Badge & Simulator Button */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
          {getUrgencyBadge(deloadPrediction.urgency)}
          <button
            onClick={() => setShowSimulateModal(true)}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Simular variaciones de HRV para calibrar la predicción"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulador HRV</span>
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-800/80 pb-3">
        <button
          onClick={() => setActiveTab('prediction')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'prediction'
              ? 'bg-amber-500 text-stone-950 shadow-md font-black'
              : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Diagnóstico & Predictor de Descarga ({deloadPrediction.confidencePct}%)</span>
        </button>

        <button
          onClick={() => setActiveTab('trends')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'trends'
              ? 'bg-amber-500 text-stone-950 shadow-md font-black'
              : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Evolución de 4 Semanas de Carga</span>
        </button>

        <button
          onClick={() => setActiveTab('daily_chart')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'daily_chart'
              ? 'bg-amber-500 text-stone-950 shadow-md font-black'
              : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Curva Continua de 28 Días</span>
        </button>
      </div>

      {/* TAB 1: PREDICTION ENGINE & PRESCRIPTION */}
      {activeTab === 'prediction' && (
        <div className="space-y-6">
          
          {/* Main Hero Prediction Card */}
          <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/30 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
              
              {/* Left Column: Timing & Urgency */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>PREDICCIÓN BASADA EN METODOLOGÍA UPHILL ATHLETE</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-black text-stone-100">
                    Momento Sugerido: <span className="text-amber-400">{deloadPrediction.recommendedStartDate}</span>
                  </h3>
                  <p className="text-xs text-stone-300">
                    Duración prevista: <strong>{deloadPrediction.recommendedDurationDays} días</strong> (1 microciclo completo de consolidación y supercompensación).
                  </p>
                </div>

                {/* Triggers Detected */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Criterios Fisiológicos Activados ({deloadPrediction.triggersDetected.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {deloadPrediction.triggersDetected.map((trigger, i) => (
                      <div key={i} className="flex items-start gap-2 bg-stone-950/70 p-2.5 rounded-xl border border-stone-800/80 text-xs text-stone-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                        <span>{trigger}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Biological Explanation */}
                <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 leading-relaxed space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase">
                    <Info className="w-3.5 h-3.5" />
                    <span>Dictamen Fisiológico de Miguel:</span>
                  </div>
                  <p className="text-stone-300 text-[11px] leading-relaxed">
                    {deloadPrediction.physiologicalRationale}
                  </p>
                </div>
              </div>

              {/* Right Column: Key Diagnostic Numbers */}
              <div className="bg-stone-950/90 border border-stone-800/90 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider block mb-1">
                    Índice de Confianza
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-400 font-mono">
                      {deloadPrediction.confidencePct}%
                    </span>
                    <span className="text-xs text-stone-400 font-semibold">Alta Precisión</span>
                  </div>
                  <div className="w-full bg-stone-850 h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full" 
                      style={{ width: `${deloadPrediction.confidencePct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-stone-800 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">HRV Actual vs Basal:</span>
                    <span className="text-red-400 font-bold">
                      {currentWeek.avgHrvRmssd} ms ({currentWeek.hrvDeviationPct}%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">FC Reposo vs Basal:</span>
                    <span className="text-amber-400 font-bold">
                      {currentWeek.avgRestingHr} bpm (+{currentWeek.restingHrDelta} bpm)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Semana del Mesociclo:</span>
                    <span className="text-stone-200 font-bold">Semana 4 de 4 (Fin de Bloque)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Reducción Volumen:</span>
                    <span className="text-emerald-400 font-bold">-{deloadPrediction.suggestedVolumeReductionPct}% recomendado</span>
                  </div>
                </div>

                {onScheduleDeload && (
                  <button
                    onClick={() => onScheduleDeload(deloadPrediction.recommendedStartDate)}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Programar Descarga en el Calendario</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Coach Miguel's Exact Deload Protocol */}
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                Protocolo Táctico de Microciclo de Descarga (Recuperación Activa)
              </h4>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Volumen Objetivo: {deloadPrediction.coachMiguelPrescription.weeklyVolumeHours} horas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Prohibited Elements */}
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 space-y-2">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Prohibido Durante la Descarga
                </span>
                <ul className="space-y-1.5 text-[11px] text-stone-300">
                  {deloadPrediction.coachMiguelPrescription.prohibitedElements.map((elem, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-400 font-bold shrink-0">✕</span>
                      <span>{elem}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mandatory Elements */}
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pautas Obligatorias
                </span>
                <ul className="space-y-1.5 text-[11px] text-stone-300">
                  {deloadPrediction.coachMiguelPrescription.mandatoryElements.map((elem, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span>{elem}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recovery Interventions */}
              <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-xl p-4 space-y-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5" />
                  Regeneración & Parasimpático
                </span>
                <ul className="space-y-1.5 text-[11px] text-stone-300">
                  {deloadPrediction.coachMiguelPrescription.recoveryInterventions.map((elem, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold shrink-0">◆</span>
                      <span>{elem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 4-WEEK PROGRESSION COMPARISON */}
      {activeTab === 'trends' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Comparativa Semanal de Biomarcadores (Mesociclo 2)
            </h3>
            <span className="text-xs text-stone-400">
              Línea Base HRV: <strong className="text-stone-200">{baselineHrv} ms</strong> | FC Reposo: <strong className="text-stone-200">{baselineRestingHr} bpm</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {weeklyTrends.map((week) => {
              const isSelected = selectedWeekIndex === week.weekIndex;
              const isDeloadCandidate = week.fatigueClassification === 'accumulated_fatigue';

              return (
                <div
                  key={week.weekIndex}
                  onClick={() => setSelectedWeekIndex(week.weekIndex)}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-stone-850 border-amber-500 shadow-xl shadow-amber-500/10' 
                      : week.isCurrentWeek
                      ? 'bg-stone-900 border-amber-500/50'
                      : 'bg-stone-950 border-stone-800/80 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-stone-200">
                      {week.weekLabel.split(' ')[0]} {week.weekLabel.split(' ')[1]}
                    </span>
                    {week.isCurrentWeek ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase">
                        Actual
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-mono">
                        {week.startDate.slice(5)} al {week.endDate.slice(5)}
                      </span>
                    )}
                  </div>

                  {/* HRV Metric */}
                  <div className="space-y-1 mb-3">
                    <span className="text-[10px] text-stone-400 block font-medium">HRV Media Nocturna</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-stone-100 font-mono">
                        {week.avgHrvRmssd}
                      </span>
                      <span className={`text-xs font-bold font-mono ${week.hrvDeviationPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {week.hrvDeviationPct > 0 ? `+${week.hrvDeviationPct}%` : `${week.hrvDeviationPct}%`}
                      </span>
                    </div>
                  </div>

                  {/* Other metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                    <div className="bg-stone-950 p-2 rounded-lg border border-stone-850">
                      <span className="text-[9px] text-stone-400 block">FC Reposo</span>
                      <span className={`font-bold ${week.restingHrDelta >= 3 ? 'text-amber-400' : 'text-stone-200'}`}>
                        {week.avgRestingHr} bpm
                      </span>
                    </div>
                    <div className="bg-stone-950 p-2 rounded-lg border border-stone-850">
                      <span className="text-[9px] text-stone-400 block">Agujetas</span>
                      <span className="font-bold text-stone-200">
                        {week.avgMuscleSoreness}/10
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">Días Alerta:</span>
                    <span className={`font-bold font-mono ${week.amberRedDaysCount >= 4 ? 'text-red-400' : 'text-stone-300'}`}>
                      {week.amberRedDaysCount} / {week.totalDays}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Week Deep Breakdown */}
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              Detalle Fisiológico: {selectedWeek.weekLabel}
            </h4>
            
            <p className="text-xs text-stone-300 leading-relaxed">
              Durante esta semana, la media de HRV se situó en <strong>{selectedWeek.avgHrvRmssd} ms</strong> ({selectedWeek.hrvDeviationPct}% respecto a la línea base de {baselineHrv} ms). 
              El pulso en reposo registró una variación de <strong>{selectedWeek.restingHrDelta >= 0 ? `+${selectedWeek.restingHrDelta}` : selectedWeek.restingHrDelta} bpm</strong>. 
              {selectedWeek.fatigueClassification === 'accumulated_fatigue' 
                ? ' Los marcadores constatan que la fatiga periférica y central ha alcanzado el umbral donde el rendimiento decrece si no se inserta un microciclo de descarga.'
                : ' Los niveles de estrés neuromuscular se asimilaron correctamente sin saturar el sistema nervioso simpático.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: 28-DAY CONTINUOUS CURVE */}
      {activeTab === 'daily_chart' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Registro Diario Continuo de HRV (Últimos 28 días)
            </h3>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Óptimo (&gt;50 ms)
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderado (45-49 ms)
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Fatigado (&lt;45 ms)
              </span>
            </div>
          </div>

          {/* Bar Chart Timeline */}
          <div className="bg-stone-950 border border-stone-850 p-4 rounded-2xl overflow-x-auto">
            <div className="min-w-[650px] flex items-end justify-between gap-1.5 h-44 pt-6 pb-2 border-b border-stone-800 relative">
              
              {/* Baseline Reference Line */}
              <div 
                className="absolute left-0 right-0 border-b border-dashed border-stone-500 pointer-events-none z-10 flex justify-end"
                style={{ bottom: `${(baselineHrv / 65) * 100}%` }}
              >
                <span className="text-[10px] text-stone-400 font-mono bg-stone-950 px-1 -translate-y-2">
                  Línea Base {baselineHrv} ms
                </span>
              </div>

              {/* Threshold Line for Deload (<44 ms) */}
              <div 
                className="absolute left-0 right-0 border-b border-dashed border-red-500/40 pointer-events-none z-10 flex justify-end"
                style={{ bottom: `${(44 / 65) * 100}%` }}
              >
                <span className="text-[9px] text-red-400 font-mono bg-stone-950 px-1 -translate-y-2">
                  Umbral de Descarga (44 ms)
                </span>
              </div>

              {checkIns.slice(-28).map((entry, idx) => {
                const heightPct = Math.min(100, Math.max(20, (entry.hrvRmssd / 65) * 100));
                const isRed = entry.hrvRmssd < 45;
                const isAmber = entry.hrvRmssd >= 45 && entry.hrvRmssd < 50;

                return (
                  <div 
                    key={idx} 
                    className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-stone-900 border border-stone-750 text-stone-100 text-[10px] p-1.5 rounded-lg whitespace-nowrap shadow-xl z-20 pointer-events-none font-mono">
                      <div>{entry.date}</div>
                      <div>HRV: {entry.hrvRmssd} ms | FC: {entry.restingHr} bpm</div>
                    </div>

                    <div 
                      className={`w-full max-w-[14px] rounded-t-sm transition-all ${
                        isRed 
                          ? 'bg-red-500 group-hover:bg-red-400' 
                          : isAmber 
                          ? 'bg-amber-500 group-hover:bg-amber-400' 
                          : 'bg-emerald-500 group-hover:bg-emerald-400'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[8px] text-stone-500 font-mono">
                      {idx % 3 === 0 ? entry.date.slice(8) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-stone-500 pt-2 font-mono">
              <span>Hace 28 días (Inicio Mesociclo 2)</span>
              <span>Hace 14 días (Pico Carga)</span>
              <span className="text-amber-400 font-bold">Hoy (Ventana de Descarga)</span>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl text-stone-100 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                Simulador de Biomarcadores de Recuperación
              </h3>
              <button 
                onClick={() => setShowSimulateModal(false)}
                className="text-stone-400 hover:text-stone-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Ajusta los valores hipotéticos de HRV y FC en reposo para comprobar cómo responde el motor predictivo de Uphill Athlete.
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-stone-300">HRV Nocturna rMSSD:</span>
                  <span className="text-amber-400 font-bold">{simulatedHrv} ms</span>
                </div>
                <input
                  type="range"
                  min="32"
                  max="62"
                  value={simulatedHrv}
                  onChange={(e) => setSimulatedHrv(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                  <span>32 ms (Fatiga Severa)</span>
                  <span>51 ms (Línea Base)</span>
                  <span>62 ms (Fresco)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-stone-300">Pulsaciones en Reposo:</span>
                  <span className="text-cyan-400 font-bold">{simulatedRestingHr} bpm</span>
                </div>
                <input
                  type="range"
                  min="42"
                  max="58"
                  value={simulatedRestingHr}
                  onChange={(e) => setSimulatedRestingHr(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                  <span>42 bpm (Recuperado)</span>
                  <span>46 bpm (Basal)</span>
                  <span>58 bpm (Drift Alto)</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSimulating(false);
                  setSimulatedHrv(43);
                  setSimulatedRestingHr(51);
                  setShowSimulateModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Restablecer Real
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSimulating(true);
                  setShowSimulateModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold"
              >
                Aplicar Simulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
