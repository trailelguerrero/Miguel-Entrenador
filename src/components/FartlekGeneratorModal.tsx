import React, { useState, useMemo } from 'react';
import { 
  X, 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Mountain, 
  Activity, 
  Heart, 
  Calendar, 
  ShieldCheck, 
  Flame, 
  AlertCircle,
  HelpCircle,
  Dumbbell,
  Compass
} from 'lucide-react';
import { 
  AthleteProfile, 
  Workout, 
  FartlekFocus, 
  FartlekGeneratorParams, 
  GeneratedFartlekPlan,
  DailyCheckIn 
} from '../types';
import { StorageService } from '../services/storage';
import { estimateFromRecentRuns, formatPace } from '../utils/runEstimates';
import { describeZoneSenseTarget } from '../utils/zoneSense';
import { calculateWorkoutTss } from '../utils/pmcCalculations';

interface FartlekGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AthleteProfile;
  todayCheckIn?: DailyCheckIn;
  onWorkoutAdded?: (workout: Workout) => void;
  initialDate?: string;
}

export const FartlekGeneratorModal: React.FC<FartlekGeneratorModalProps> = ({
  isOpen,
  onClose,
  profile,
  todayCheckIn,
  onWorkoutAdded,
  initialDate,
}) => {
  if (!isOpen) return null;

  // Defaults based on current athlete and season moment
  const [seasonPhase, setSeasonPhase] = useState<FartlekGeneratorParams['seasonPhase']>(
    'mesocycle_2_aerobic_base'
  );
  const [currentHrvStatus, setCurrentHrvStatus] = useState<FartlekGeneratorParams['currentHrvStatus']>(
    todayCheckIn?.status || 'optimal'
  );
  const [durationMinutes, setDurationMinutes] = useState<FartlekGeneratorParams['durationMinutes']>(60);
  const [focus, setFocus] = useState<FartlekFocus>('ads_reversal_aet_control');
  const [terrainType, setTerrainType] = useState<FartlekGeneratorParams['terrainType']>('rolling_trail');
  const [usePoles, setUsePoles] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Athlete physiology constants
  const aet = profile.aetHr || 0;
  const ant = profile.antHr || 0;
  const restingHr = profile.restingHr || 0;

  // Distancia y desnivel estimados con TUS carreras reales (no cifras fijas)
  const allWorkouts = useMemo(() => StorageService.getWorkouts(), []);
  const estimateAll = useMemo(() => estimateFromRecentRuns(allWorkouts, durationMinutes, 'all'), [allWorkouts, durationMinutes]);
  const estimateHilly = useMemo(() => estimateFromRecentRuns(allWorkouts, durationMinutes, 'hilly'), [allWorkouts, durationMinutes]);

  // Generate the strictly tailored Fartlek
  const fartlekPlan = useMemo<GeneratedFartlekPlan>(() => {
    // If in deload phase or fatigued, force recovery dynamic mode
    const isFatiguedOrDeload = currentHrvStatus === 'fatigued' || seasonPhase === 'deload_week';

    if (isFatiguedOrDeload) {
      const repsCount = durationMinutes === 45 ? 4 : durationMinutes === 60 ? 5 : 6;
      const reps = [];
      for (let i = 1; i <= repsCount; i++) {
        reps.push({
          repNumber: i,
          fastDurationMinutes: 1.5,
          fastPaceLabel: 'Zancada ágil y fluida',
          fastTargetHrMax: 0,
          fastZoneSense: 'ZoneSense verde, muy cómodo',
          fastTacticalCue: 'Aumenta solo la cadencia de pies, respiración 100% nasal. No fuerces la zancada.',
          recoveryDurationMinutes: 3.5,
          recoveryPaceLabel: 'Trote muy suave o caminata activa',
          recoveryTargetHrMax: 0,
          recoveryDescription: 'Recupera hasta sentirte completamente relajado. Sensación de esfuerzo 2/10.',
        });
      }

      return {
        id: `fartlek-recovery-${Date.now()}`,
        title: `Fartlek Regenerativo Dinámico (Modo Descarga)`,
        workoutType: 'easy_run',
        totalDurationMin: durationMinutes,
        estimatedDistanceKm: estimateAll?.distanceKm ?? 0,
        estimatedElevationGainM: estimateAll?.elevationGainM ?? 0,
        targetHrMin: 0,
        targetHrMax: 0,
        zoneSenseTarget: 'Regenerativo (verde, muy suave)',
        description: 'Fartlek de descarga adaptado a tu estado de fatiga acumulada. Prohibido acumular lactato.',
        whyThisFitsAthlete: `Tu HRV actual o el momento de la temporada exigen descarga activa. Este estímulo activa la circulación y la economía neuromuscular sin estresar el sistema simpático ni los depósitos de glucógeno.`,
        uphillAthleteScienceNote: '',
        warmup: '12 min de trote muy lento sobre terreno blando + movilidad suave de cadera y tobillos.',
        mainSetStructured: reps,
        mainSetSummary: `${repsCount} bloques de [1'30" zancada ágil / 3'30" trote muy suave], todo en ZoneSense verde y muy cómodo. 100% respiración nasal.`,
        cooldown: '10 min caminando descalzo sobre césped o trote a paso de caminata.',
        postWorkoutEccentricRoutine: '3 series de 10 elevaciones de sóleo en escalón (tempo 3-1-1) sin peso para mantener elasticidad tendinosa.',
        nutritionAdvice: 'Hidratación con 500 ml de agua con sales. No se requieren geles de alta concentración.',
      };
    }

    // Standard Mesocycle 2: Base Aeróbica & Reversión de ADS
    if (focus === 'ads_reversal_aet_control') {
      const repsCount = durationMinutes === 45 ? 6 : durationMinutes === 60 ? 8 : 10;
      const reps = [];
      for (let i = 1; i <= repsCount; i++) {
        reps.push({
          repNumber: i,
          fastDurationMinutes: 3,
          fastPaceLabel: 'Ritmo Vivo Sub-AeT',
          fastTargetHrMax: aet,
          fastZoneSense: 'ZoneSense verde (sin tocar el amarillo)',
          fastTacticalCue: `Rodaje vivo y alegre sin salir del verde de ZoneSense${aet ? ` (sin banda: sin pasar de ${aet} ppm)` : ''}. Si ves el amarillo, acorta la zancada.`,
          recoveryDurationMinutes: 2,
          recoveryPaceLabel: 'Trote suave Z1',
          recoveryTargetHrMax: 0,
          recoveryDescription: 'Recupera al trote suave antes del siguiente cambio de ritmo.',
        });
      }

      return {
        id: `fartlek-ads-${Date.now()}`,
        title: `Fartlek Aeróbico en verde (${repsCount}x3' / 2')`,
        workoutType: 'easy_run',
        totalDurationMin: durationMinutes,
        estimatedDistanceKm: estimateAll?.distanceKm ?? 0,
        estimatedElevationGainM: estimateAll?.elevationGainM ?? 0,
        targetHrMin: 0,
        targetHrMax: aet,
        zoneSenseTarget: 'ZoneSense verde (aeróbico)',
        description: `Entrenamiento de cambios de ritmo aeróbicos para revertir el ADS (Aerobic Deficiency Syndrome). Enfoque en densidad mitocondrial sin fatiga por lactato.`,
        whyThisFitsAthlete: `Con un AeT de ${aet} bpm y un AnT de ${ant} bpm (spread de ${ant - aet} bpm), cualquier trabajo a intensidades anaeróbicas bloquea la oxidación de grasas (FatMax). Este fartlek enseña a tu organismo a sostener velocidad de crucero sin entrar en glucólisis ácida.`,
        uphillAthleteScienceNote: '',
        warmup: '15 min de rodaje continuo muy suave (ZoneSense toma aquí tu línea base del día) + 4 aceleraciones progresivas de 15s en llano.',
        mainSetStructured: reps,
        mainSetSummary: `${repsCount} repeticiones de [3 min ritmo vivo en ZoneSense verde + 2 min recuperación al trote suave].`,
        cooldown: '10 min de trote suave regenerativo + estiramientos suaves.',
        postWorkoutEccentricRoutine: '3 series de 12 repeticiones de sóleo en escalón (tempo 3-1-1).',
        nutritionAdvice: 'Llevar 1 bidón de 500 ml de agua con sales (400 mg Na+). Tomar un trago largo en cada recuperación de 2 minutos.',
      };
    }

    if (focus === 'uphill_cadence_poles') {
      const repsCount = durationMinutes === 45 ? 5 : durationMinutes === 60 ? 7 : 9;
      const reps = [];
      for (let i = 1; i <= repsCount; i++) {
        reps.push({
          repNumber: i,
          fastDurationMinutes: 2.5,
          fastPaceLabel: 'Subida Uphill con Bastones (Power-Hiking)',
          fastTargetHrMax: aet,
          fastZoneSense: 'ZoneSense verde (sin tocar el amarillo)',
          fastTacticalCue: 'Clava los bastones a la altura del talón delantero e impulsa con el dorsal. Si la pendiente supera el 12%, zancada amplia sin saltar.',
          recoveryDurationMinutes: 2.5,
          recoveryPaceLabel: 'Bajada al paso o trote suave amortiguado',
          recoveryTargetHrMax: 0,
          recoveryDescription: 'Desciende trotando con pisada corta de mediopié sin frenar de golpe.',
        });
      }

      return {
        id: `fartlek-uphill-${Date.now()}`,
        title: `Fartlek Uphill en Cuesta: Transición & Bastones (${repsCount}x2.5' / 2.5')`,
        workoutType: 'muscular_endurance',
        totalDurationMin: durationMinutes,
        estimatedDistanceKm: estimateHilly?.distanceKm ?? 0,
        estimatedElevationGainM: estimateHilly?.elevationGainM ?? 0,
        targetHrMin: 0,
        targetHrMax: aet,
        zoneSenseTarget: 'ZoneSense verde (aeróbico)',
        description: 'Fartlek específico en pendiente para trabajar potencia aeróbica en cuádriceps y gemelos simulando los pinares de Fuencaliente.',
        whyThisFitsAthlete: `Transvulcania tiene subidas muy largas. Este fartlek trabaja la subida con bastones sin salir del verde de ZoneSense.`,
        uphillAthleteScienceNote: '',
        warmup: '15 min de aproximación al pie de la cuesta al trote muy suave (ZoneSense fija tu línea base del día).',
        mainSetStructured: reps,
        mainSetSummary: `${repsCount} series de [2 min 30s de subida activa con bastones en ZoneSense verde + 2 min 30s de descenso suave amortiguado].`,
        cooldown: '10 min de trote en llano + 5 min de marcha relajada.',
        postWorkoutEccentricRoutine: '3 series de 10 Step-Downs excéntricos en escalón (tempo 3-1-1) por pierna para preparar la bajada de El Time.',
        nutritionAdvice: '40g de carbohidratos en gel o barrita energética a los 35 minutos + 600 ml de electrolitos.',
      };
    }

    // Default: Rompepiernas Cresta Transvulcania
    const repsCount = durationMinutes === 45 ? 5 : durationMinutes === 60 ? 6 : 8;
    const reps = [];
    for (let i = 1; i <= repsCount; i++) {
      reps.push({
        repNumber: i,
        fastDurationMinutes: 4,
        fastPaceLabel: 'Ritmo de Cresta / Falsos Llanos',
        fastTargetHrMax: aet,
        fastZoneSense: 'ZoneSense verde (sin tocar el amarillo)',
        fastTacticalCue: 'Zancada reactiva y mirada 5 metros por delante para anticipar piedras y terreno volcánico suelto.',
        recoveryDurationMinutes: 2,
        recoveryPaceLabel: 'Trote suave regenerativo',
        recoveryTargetHrMax: 0,
        recoveryDescription: 'Recuperación al trote regular en terreno llano o sendero cómodo.',
      });
    }

    return {
      id: `fartlek-crest-${Date.now()}`,
      title: `Fartlek Rompepiernas: Simulación de Cresta (${repsCount}x4' / 2')`,
      workoutType: 'muscular_endurance',
      totalDurationMin: durationMinutes,
      estimatedDistanceKm: estimateHilly?.distanceKm ?? 0,
      estimatedElevationGainM: estimateHilly?.elevationGainM ?? 0,
      targetHrMin: 0,
      targetHrMax: aet,
      zoneSenseTarget: 'ZoneSense verde (aeróbico)',
      description: 'Fartlek en terreno técnico y variado para automatizar la cadencia rápida y la estabilidad de tobillo bajo fatiga.',
      whyThisFitsAthlete: `Cambios de pendiente como los de la cresta de Transvulcania, sin salir del verde de ZoneSense.`,
      uphillAthleteScienceNote: '',
      warmup: '15 min de carrera suave en sendero + ejercicios de técnica de tobillo (skipping bajo y talones a glúteo).',
      mainSetStructured: reps,
      mainSetSummary: `${repsCount} bloques de [4 min a ritmo de cresta vivo en ZoneSense verde + 2 min de trote suave recuperador].`,
      cooldown: '10 min de trote muy relajado.',
      postWorkoutEccentricRoutine: '3 series de sóleo excéntrico en escalón 3-1-1 + estiramientos de psoas.',
      nutritionAdvice: '500 ml de agua con sales y 1 gel isotónico a mitad de sesión.',
    };
  }, [seasonPhase, currentHrvStatus, durationMinutes, focus, aet, ant, restingHr, estimateAll, estimateHilly]);

  // Handler to add the generated fartlek to Calendar
  const handleAddToCalendar = () => {
    const tssResult = calculateWorkoutTss(fartlekPlan.totalDurationMin, undefined, profile.antHr || undefined);

    const workoutToAdd: Workout = {
      id: `workout-fartlek-${Date.now()}`,
      date: selectedDate,
      title: fartlekPlan.title,
      type: fartlekPlan.workoutType,
      plannedDurationMin: fartlekPlan.totalDurationMin,
      plannedDistanceKm: fartlekPlan.estimatedDistanceKm || undefined,
      plannedElevationGainM: fartlekPlan.estimatedElevationGainM || undefined,
      plannedTss: tssResult.tss,
      intensityFactor: tssResult.intensityFactor,
      targetHrMin: fartlekPlan.targetHrMin || undefined,
      targetHrMax: fartlekPlan.targetHrMax || undefined,
      zoneSenseTarget: fartlekPlan.zoneSenseTarget,
      description: fartlekPlan.description,
      personalizedReasoning: fartlekPlan.whyThisFitsAthlete,
      learnedAdjustment: 'Aplicada regla de memoria: En subidas >12% transición a power-hiking y trabajo excéntrico de sóleo post-sesión.',
      warmup: fartlekPlan.warmup,
      mainSet: fartlekPlan.mainSetSummary,
      cooldown: fartlekPlan.cooldown,
      terrainRecommendation: terrainType === 'rolling_trail' 
        ? 'Sendero de tierra con desniveles suaves y terreno no técnico.' 
        : terrainType === 'uphill_dirt' 
        ? 'Cuesta prolongada de tierra o grava (6-12% pendiente).' 
        : terrainType === 'technical_volcanic' 
        ? 'Pista con piedra suelta o picón simulado.' 
        : 'Pista de grava o parque llano.',
      nutritionAdvice: fartlekPlan.nutritionAdvice,
      completed: false,
    };

    StorageService.addOrUpdateWorkout(workoutToAdd);
    if (onWorkoutAdded) {
      onWorkoutAdded(workoutToAdd);
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-stone-100">
                  Generador de Fartlek Fisiológico
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  AeT {aet} bpm • Uphill Athlete
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Alineado estrictamente con tu condición de ADS, tu momento de la temporada y tu ZoneSense
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1.5 rounded-xl hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          
          {/* Athlete Context Guardrail Banner */}
          <div className="bg-stone-950 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-stone-300">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-200 block mb-0.5 font-bold">
                Principio Innegociable de Miguel: Cero Lactato Glucolítico
              </strong>
              <p className="leading-relaxed text-stone-400 text-[11px]">
                Tu perfil presenta <strong>ADS activo</strong> (separación de {ant - aet} bpm entre AeT {aet} bpm y AnT {ant} bpm). 
                Los fartleks tradicionales de pista a ritmo de VO2max inundan el músculo de ácido láctico y frenan la biogénesis mitocondrial. 
                Los fartleks generados aquí son <strong>estrictamente aeróbicos sub-AeT o de potencia neuromuscular en cuesta</strong>, en ZoneSense verde (con banda de pecho).
              </p>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            
            {/* 1. Season Phase */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-850 space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                1. Momento de la Temporada
              </label>
              <select
                value={seasonPhase}
                onChange={(e) => setSeasonPhase(e.target.value as any)}
                className="w-full bg-stone-900 border border-stone-750 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-medium"
              >
                <option value="mesocycle_2_aerobic_base">Mesociclo 2: Base & Reversión ADS (Actual)</option>
                <option value="mesocycle_3_muscular_endurance">Mesociclo 3: Resistencia Muscular Uphill</option>
                <option value="mesocycle_4_race_prep">Mesociclo 4: Simulación Transvulcania</option>
                <option value="deload_week">Semana de Descarga / Recuperación Activa</option>
              </select>
            </div>

            {/* 2. Current HRV / Readiness */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-850 space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                2. Estado Fisiológico de Hoy
              </label>
              <select
                value={currentHrvStatus}
                onChange={(e) => setCurrentHrvStatus(e.target.value as any)}
                className="w-full bg-stone-900 border border-stone-750 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-medium"
              >
                <option value="optimal">🟢 Óptimo (HRV alta, &gt;50 ms)</option>
                <option value="moderate">🟡 Moderado (Fatiga normal, 45-49 ms)</option>
                <option value="fatigued">🔴 Fatigado (HRV baja &lt;45 ms, FC Reposo alta)</option>
              </select>
            </div>

            {/* 3. Duration */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-850 space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                3. Duración Disponible
              </label>
              <div className="flex gap-2">
                {[45, 60, 75].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationMinutes(d as any)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      durationMinutes === d
                        ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-sm'
                        : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Focus Objective */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-850 space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                4. Objetivo Fisiológico
              </label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value as any)}
                className="w-full bg-stone-900 border border-stone-750 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-medium"
              >
                <option value="ads_reversal_aet_control">Aeróbico en verde (control sub-AeT)</option>
                <option value="uphill_cadence_poles">Cuestas Uphill & Zancada con Bastones</option>
                <option value="transvulcania_rolling_crest">Cresta & Terreno Volcánico Rompepiernas</option>
                <option value="recovery_dynamic">Regenerativo Dinámico (Descarga)</option>
              </select>
            </div>

            {/* 5. Terrain */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-850 space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                5. Terreno Disponible
              </label>
              <select
                value={terrainType}
                onChange={(e) => setTerrainType(e.target.value as any)}
                className="w-full bg-stone-900 border border-stone-750 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 font-medium"
              >
                <option value="rolling_trail">Sendero de montaña ondulado</option>
                <option value="uphill_dirt">Cuesta prolongada de tierra (+D)</option>
                <option value="technical_volcanic">Piedra rota / Picón volcánico</option>
                <option value="easy_gravel">Pista forestal o parque cómodo</option>
              </select>
            </div>

            {/* 6. Equipment / Poles */}
            <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-850 space-y-1.5 flex flex-col justify-between">
              <label className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                6. Equipamiento
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-200">
                <input
                  type="checkbox"
                  checked={usePoles}
                  onChange={(e) => setUsePoles(e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>Llevar bastones de trail (Uphill)</span>
              </label>
            </div>
          </div>

          {/* Generated Fartlek Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-2xl p-5 sm:p-6 space-y-5">
            
            {/* Title & Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                  Plan Fartlek Generado
                </span>
                <h4 className="text-lg sm:text-xl font-black text-stone-100 mt-0.5">
                  {fartlekPlan.title}
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-750 font-mono text-xs text-stone-300 font-bold">
                  ⏱️ {fartlekPlan.totalDurationMin} min
                </span>
                {fartlekPlan.estimatedDistanceKm > 0 ? (
                  <>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-750 font-mono text-xs text-emerald-400 font-bold">
                      🏃 ~{fartlekPlan.estimatedDistanceKm} km
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-750 font-mono text-xs text-amber-400 font-bold">
                      ⛰️ ~+{fartlekPlan.estimatedElevationGainM} m
                    </span>
                  </>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-750 font-mono text-xs text-stone-400">
                    Sin carreras registradas para estimar distancia y desnivel
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-750 font-mono text-xs text-cyan-400 font-bold">
                  {fartlekPlan.targetHrMax > 0 ? `❤️ Sin banda: máx ${fartlekPlan.targetHrMax} ppm` : '🟢 ZoneSense verde'}
                </span>
              </div>
              {(() => {
                const est = (currentHrvStatus === 'fatigued' || seasonPhase === 'deload_week' || focus === 'ads_reversal_aet_control') ? estimateAll : estimateHilly;
                return est ? (
                  <p className="text-[10px] text-stone-500 mt-1.5">
                    Estimación con tus {est.runsUsed} carreras de Suunto ({est.windowLabel}): ritmo medio {formatPace(est.paceMinPerKm)} y {est.ascentMPerHour} m D+/h.
                  </p>
                ) : null;
              })()}
            </div>

            {/* Target Biomarkers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Solo si no llevas banda (zonas de FC)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-amber-400 font-mono">
                    {fartlekPlan.targetHrMax > 0 ? <>&le; {fartlekPlan.targetHrMax} ppm</> : 'Sin umbral de FC en tu perfil'}
                  </span>
                </div>
                <p className="text-[10px] text-stone-400">Referencia de respaldo por FC (tu umbral aeróbico). Con banda de pecho manda ZoneSense.</p>
              </div>

              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Objetivo Suunto ZoneSense (banda de pecho)</span>
                <span className="text-sm font-black text-emerald-400 font-mono block">
                  {describeZoneSenseTarget(fartlekPlan.zoneSenseTarget)}
                </span>
                <p className="text-[10px] text-stone-400">Los colores de ZoneSense no equivalen a una FC fija: se miden contra tu línea base del día (primeros ~10 min suaves).</p>
              </div>
            </div>

            {/* Warmup */}
            <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800 text-xs text-stone-300 space-y-1">
              <strong className="text-amber-400 text-[11px] uppercase block font-bold">
                1. Calentamiento (15 min):
              </strong>
              <p>{fartlekPlan.warmup}</p>
            </div>

            {/* Main Set Structured Interval Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-xs text-stone-200 uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  2. Bloque Principal: Intervalos & Variaciones
                </strong>
                <span className="text-xs text-stone-400 font-mono">
                  {fartlekPlan.mainSetStructured.length} repeticiones programadas
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {fartlekPlan.mainSetStructured.map((rep) => (
                  <div 
                    key={rep.repNumber} 
                    className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        #{rep.repNumber}
                      </span>
                      <div>
                        <div className="font-bold text-stone-100 flex items-center gap-2">
                          <span>{rep.fastDurationMinutes} min {rep.fastPaceLabel}</span>
                          <span className="text-[10px] font-mono text-amber-400 font-semibold bg-stone-950 px-1.5 py-0.5 rounded border border-stone-800">
                            {rep.fastZoneSense}{rep.fastTargetHrMax > 0 ? ` · sin banda ≤ ${rep.fastTargetHrMax} ppm` : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-0.5">{rep.fastTacticalCue}</p>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 font-mono text-[11px] text-stone-400 pl-8 sm:pl-0">
                      <div>Recup: <strong className="text-cyan-400">{rep.recoveryDurationMinutes} min</strong> trote Z1</div>
                      {rep.recoveryTargetHrMax > 0 && <div className="text-[10px] text-stone-500">&lt; {rep.recoveryTargetHrMax} ppm</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cooldown & Eccentric Routine */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800 text-stone-300 space-y-1">
                <strong className="text-cyan-400 text-[11px] uppercase block font-bold">
                  3. Enfriamiento:
                </strong>
                <p>{fartlekPlan.cooldown}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800 text-stone-300 space-y-1">
                <strong className="text-emerald-400 text-[11px] uppercase block font-bold">
                  4. Rutina Excéntrica Post-Sesión:
                </strong>
                <p>{fartlekPlan.postWorkoutEccentricRoutine}</p>
              </div>
            </div>

            {/* Why This Fits & Science Note */}
            <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-850 space-y-2 text-xs">
              <div className="text-stone-300 leading-relaxed">
                <strong className="text-amber-400 font-bold block mb-0.5">
                  Razonamiento Personalizado de Miguel:
                </strong>
                {fartlekPlan.whyThisFitsAthlete}
              </div>
              {fartlekPlan.uphillAthleteScienceNote && (
                <div className="pt-2 border-t border-stone-800/80 text-[11px] text-stone-400 italic">
                  📖 {fartlekPlan.uphillAthleteScienceNote}
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs text-stone-400 font-medium">Fecha para programar:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-100 font-mono"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleAddToCalendar}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-stone-950 text-xs font-black shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-950" />
                    <span>¡Sesión Añadida con Éxito!</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Añadir Fartlek al Calendario</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
