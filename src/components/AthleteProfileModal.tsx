import React, { useState } from 'react';
import { 
  X, 
  User, 
  Heart, 
  Mountain, 
  Activity, 
  Shield, 
  Save, 
  Scale, 
  Flame, 
  Brain, 
  Sparkles, 
  HardDrive, 
  Check, 
  Compass, 
  Download,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Sun,
  Clock,
  Sliders,
  Footprints
} from 'lucide-react';
import { 
  AthleteProfile, 
  TargetRace, 
  AdvancedPhysiologicalProfile,
  ChronicInjuriesHistory,
  HighMountainExperience,
  DocumentedHeatTolerance,
  TrainingPreferencesQuestionnaire
} from '../types';

interface AthleteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AthleteProfile;
  onSaveProfile: (profile: AthleteProfile) => void;
  targetRace: TargetRace;
  onOpenSetupGuide?: () => void;
  onOpenBackup?: () => void;
}

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  targetRace,
  onOpenSetupGuide,
  onOpenBackup,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'advanced_physiology' | 'interview' | 'physiology' | 'general' | 'storage'>('advanced_physiology');

  // General fields
  const [name, setName] = useState(profile.name || 'Atleta');
  const [age, setAge] = useState(profile.age || 50);
  const [heightCm, setHeightCm] = useState(profile.heightCm || 176);
  const [weightKg, setWeightKg] = useState(profile.weightKg || 71.5);
  const [targetRaceWeightKg, setTargetRaceWeightKg] = useState(profile.targetRaceWeightKg || 67.5);
  const [availableDays, setAvailableDays] = useState(profile.availableDaysPerWeek || 4);
  const [longRunDay, setLongRunDay] = useState(profile.preferredLongRunDay || 'saturday');
  const [volumeHours, setVolumeHours] = useState(profile.currentWeeklyVolumeHours || 6.5);
  const [yearsTrail, setYearsTrail] = useState(profile.yearsTrailRunning || 12);

  // Physiology fields
  const [restingHr, setRestingHr] = useState(profile.restingHr || 48);
  const [maxHr, setMaxHr] = useState(profile.maxHr || 178);
  const [aetHr, setAetHr] = useState(profile.aetHr || 138);
  const [antHr, setAntHr] = useState(profile.antHr || 162);
  const [baselineHrv, setBaselineHrv] = useState(profile.baselineHrv || 51.5);

  // Ultra Experience & Miguel's Interview fields
  const ultra = profile.ultraExperience || {};
  const [longestKm, setLongestKm] = useState(ultra.longestRaceKm || 85);
  const [longestDPlus, setLongestDPlus] = useState(ultra.longestRaceElevationGainM || 5200);
  const [completedUltras, setCompletedUltras] = useState(ultra.completedUltras || 'Gran Trail Peñalara 60k, Ultra Sierra Nevada 75k, CSP 110k');
  const [downhillAbility, setDownhillAbility] = useState<'beginner' | 'intermediate' | 'expert_technical'>(
    ultra.downhillTechnicalAbility || 'intermediate'
  );
  const [polesUsage, setPolesUsage] = useState<'never' | 'steep_only' | 'expert_all_hills'>(
    ultra.polesUsage || 'expert_all_hills'
  );
  const [sleepHours, setSleepHours] = useState(ultra.sleepQualityAvgHours || 7.0);
  const [stressLevel, setStressLevel] = useState<'low' | 'moderate' | 'high_physical' | 'high_mental'>(
    ultra.dailyWorkStressLevel || 'moderate'
  );
  const [recoveryCapacity, setRecoveryCapacity] = useState(
    ultra.recoveryCapacityAt50 || 'A mis 50 años la asimilación neuromuscular de las bajadas tarda más; necesito 48-72h para recuperar tras tiradas con mucho desnivel negativo.'
  );
  const [selectedJoints, setSelectedJoints] = useState<string[]>(
    ultra.vulnerableJointsOrTissues || ['Tendón de Aquiles', 'Sóleos excéntrico', 'Cintilla iliotibial']
  );
  const [heatTolerance, setHeatTolerance] = useState<'poor' | 'moderate' | 'strong'>(
    ultra.heatTolerance || 'moderate'
  );
  const [gutHistory, setGutHistory] = useState(
    ultra.gutIssuesHistory || 'Tolerancia aceptable hasta las 5 horas; a partir de ahí necesito comida salada y repartir los carbohidratos en tomas pequeñas.'
  );
  const [motivation, setMotivation] = useState(
    ultra.personalMotivation || 'Coronar Transvulcania a mis 50 años con preparación quirúrgica, respetando la longevidad de mis piernas y disfrutando la crestería.'
  );

  // ================= PERFIL FISIOLÓGICO AVANZADO =================
  const adv = profile.advancedPhysiologicalProfile;
  
  // 1. Lesiones crónicas detalladas
  const [chronicDescription, setChronicDescription] = useState<string>(
    adv?.chronicInjuries?.description || 'Tendinopatía aquílea izquierda recurrente (origen en sobrecarga de sóleos en descensos continuados) y conato de cintilla iliotibial derecha si supera los 30 km sin calentar glúteo medio.'
  );
  const [chronicTrigger, setChronicTrigger] = useState<string>(
    adv?.chronicInjuries?.primaryTrigger || 'Descensos continuados de más de 800m negativos a ritmo vivo o calzado con drop inferior a 5mm.'
  );
  const [chronicWarningSigns, setChronicWarningSigns] = useState<string>(
    adv?.chronicInjuries?.activeWarningSigns || 'Rigidez matutina al apoyar el talón en los primeros pasos y tirantez en el sóleo lateral tras 2h de carrera.'
  );
  const [chronicManagementProtocol, setChronicManagementProtocol] = useState<string>(
    adv?.chronicInjuries?.managementProtocol || 'Trabajo excéntrico en escalón (soleus drops 3-1-1), automasaje con pelota dura en sóleos y descarga muscular con crioterapia.'
  );
  const [chronicOrthotics, setChronicOrthotics] = useState<boolean>(
    adv?.chronicInjuries?.orthoticsOrInsoles ?? true
  );

  // 2. Experiencia técnica en alta montaña y terreno volcánico
  const [hasVolcanicExp, setHasVolcanicExp] = useState<boolean>(
    adv?.highMountain?.hasVolcanicTerrainExperience ?? true
  );
  const [volcanicNotes, setVolcanicNotes] = useState<string>(
    adv?.highMountain?.volcanicTerrainNotes || 'Experiencia en senderos de Tenerife y La Palma; el lapilli negro suelto exige mayor cadencia para no perder tracción y el uso obligatorio de polainas bajas para evitar piedras abrasivas en zapatillas.'
  );
  const [technicalGrade, setTechnicalGrade] = useState<'moderate_trails' | 'technical_alpine_rocks' | 'extreme_ridge_scree'>(
    adv?.highMountain?.technicalTerrainGrade || 'technical_alpine_rocks'
  );
  const [maxAltitude, setMaxAltitude] = useState<number>(
    adv?.highMountain?.maxAltitudeReachedM || 3100
  );
  const [altitudeSens, setAltitudeSens] = useState<'none' | 'mild_headache_above_2000m' | 'significant_drop_in_pace'>(
    adv?.highMountain?.altitudeSensitivity || 'none'
  );

  // 3. Tolerancia al calor documentada
  const [heatLevel, setHeatLevel] = useState<'low' | 'moderate' | 'high' | 'heat_acclimated'>(
    adv?.heatTolerance?.level || 'moderate'
  );
  const [heatCramps, setHeatCramps] = useState<boolean>(
    adv?.heatTolerance?.crampHistoryInHeat ?? true
  );
  const [sweatRate, setSweatRate] = useState<number>(
    adv?.heatTolerance?.sweatRateDocumentedLitersPerHour || 1.15
  );
  const [sodiumProfile, setSodiumProfile] = useState<'low_salt' | 'medium_salt' | 'salty_sweater_white_crust'>(
    adv?.heatTolerance?.sodiumLossProfile || 'salty_sweater_white_crust'
  );
  const [heatStrategy, setHeatStrategy] = useState<string>(
    adv?.heatTolerance?.heatStrategyNotes || 'Alta pérdida de sal (costras blancas en tirantes de mochila). Requiere 650-750 mg de sodio por hora y bidón con cubrenucas mojado en avituallamientos.'
  );

  // 4. Cuestionario de Preferencias de Entrenamiento
  const [prefTime, setPrefTime] = useState<'early_morning' | 'midday' | 'evening' | 'flexible'>(
    adv?.trainingPreferences?.preferredTrainingTime || 'early_morning'
  );
  const [longRunTerrain, setLongRunTerrain] = useState<'steep_technical_trail' | 'rolling_mountain_paths' | 'high_alpine_scree' | 'mixed_fire_road'>(
    adv?.trainingPreferences?.longRunPreferredTerrain || 'steep_technical_trail'
  );
  const [crossSports, setCrossSports] = useState<string[]>(
    adv?.trainingPreferences?.crossTrainingSports || ['Bicicleta Gravel/MTB', 'Senderismo con desnivel (Power Hiking)']
  );
  const [weeklyFlex, setWeeklyFlex] = useState<'strict_fixed_days' | 'flexible_swap_days' | 'shift_work_adaptive'>(
    adv?.trainingPreferences?.weeklyFlexibility || 'flexible_swap_days'
  );
  const [treadmill, setTreadmill] = useState<'hate_it_outdoor_only' | 'emergency_weather_only' | 'regularly_for_steep_walk'>(
    adv?.trainingPreferences?.treadmillTolerance || 'emergency_weather_only'
  );
  const [restDay, setRestDay] = useState<'monday' | 'friday' | 'post_long_run' | 'flexible'>(
    adv?.trainingPreferences?.preferredRestDay || 'monday'
  );
  const [lifestyleNotes, setLifestyleNotes] = useState<string>(
    adv?.trainingPreferences?.lifestyleConstraintsNotes || 'Jornada laboral sedentaria entre semana con reuniones matutinas. Prefiero entrenar a primera hora (6:30 - 8:00 AM) para no interferir con la familia.'
  );

  // Live Calculations
  const heightM = (heightCm || 176) / 100;
  const currentBmi = ((weightKg || 71.5) / (heightM * heightM)).toFixed(1);
  const weightDiff = Number((weightKg - targetRaceWeightKg).toFixed(1));
  const estimatedCaloriesSaved = Math.round(Math.max(0, weightDiff) * 9.81 * 4.35 / 0.23);
  const estimatedMinutesSaved = Math.round(Math.max(0, weightDiff) * 6.5);
  const hasAds = (antHr - aetHr) > 20 || ((antHr - aetHr) / antHr) > 0.1;

  const toggleJoint = (joint: string) => {
    setSelectedJoints(prev => 
      prev.includes(joint) ? prev.filter(j => j !== joint) : [...prev, joint]
    );
  };

  const toggleCrossSport = (sport: string) => {
    setCrossSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const builtAdvProfile: AdvancedPhysiologicalProfile = {
      chronicInjuries: {
        description: chronicDescription,
        primaryTrigger: chronicTrigger,
        activeWarningSigns: chronicWarningSigns,
        managementProtocol: chronicManagementProtocol,
        orthoticsOrInsoles: chronicOrthotics,
      },
      highMountain: {
        hasVolcanicTerrainExperience: hasVolcanicExp,
        volcanicTerrainNotes: volcanicNotes,
        technicalTerrainGrade: technicalGrade,
        maxAltitudeReachedM: Number(maxAltitude),
        altitudeSensitivity: altitudeSens,
      },
      heatTolerance: {
        level: heatLevel,
        crampHistoryInHeat: heatCramps,
        sweatRateDocumentedLitersPerHour: Number(sweatRate),
        sodiumLossProfile: sodiumProfile,
        heatStrategyNotes: heatStrategy,
      },
      trainingPreferences: {
        preferredTrainingTime: prefTime,
        longRunPreferredTerrain: longRunTerrain,
        crossTrainingSports: crossSports,
        weeklyFlexibility: weeklyFlex,
        treadmillTolerance: treadmill,
        preferredRestDay: restDay,
        lifestyleConstraintsNotes: lifestyleNotes,
      },
    };

    const updated: AthleteProfile = {
      ...profile,
      name,
      age: Number(age),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      targetRaceWeightKg: Number(targetRaceWeightKg),
      restingHr: Number(restingHr),
      maxHr: Number(maxHr),
      aetHr: Number(aetHr),
      antHr: Number(antHr),
      baselineHrv: Number(baselineHrv),
      hasAds,
      availableDaysPerWeek: Number(availableDays),
      preferredLongRunDay: longRunDay,
      yearsTrailRunning: Number(yearsTrail),
      currentWeeklyVolumeHours: Number(volumeHours),
      injuryHistory: `Zonas sensibles: ${selectedJoints.join(', ')}. Lesiones crónicas: ${chronicDescription}`,
      ultraExperience: {
        longestRaceKm: Number(longestKm),
        longestRaceElevationGainM: Number(longestDPlus),
        completedUltras,
        downhillTechnicalAbility: downhillAbility,
        polesUsage,
        sleepQualityAvgHours: Number(sleepHours),
        dailyWorkStressLevel: stressLevel,
        recoveryCapacityAt50: recoveryCapacity,
        vulnerableJointsOrTissues: selectedJoints,
        heatTolerance: heatLevel === 'low' ? 'poor' : heatLevel === 'high' || heatLevel === 'heat_acclimated' ? 'strong' : 'moderate',
        gutIssuesHistory: gutHistory,
        personalMotivation: motivation,
        coachInitialInterviewCompleted: true,
      },
      advancedPhysiologicalProfile: builtAdvProfile,
    };

    onSaveProfile(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-emerald-600 flex items-center justify-center text-zinc-950 font-black shadow-lg">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-zinc-100">Perfil del Atleta & Fisiología</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {age} Años • Ultra Veteran
                </span>
              </div>
              <p className="text-xs text-zinc-400">Calibración exhaustiva para que Miguel adapte tu ruta a Transvulcania</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenSetupGuide && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSetupGuide();
                }}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs transition cursor-pointer"
                title="Lanzar la guía interactiva paso a paso"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Guía Setup</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center px-6 pt-2 pb-0 border-b border-zinc-800/80 bg-zinc-900/60 overflow-x-auto no-scrollbar gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('advanced_physiology')}
            className={`px-3 py-2 font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'advanced_physiology'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Perfil Fisiológico Avanzado</span>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-black border border-amber-500/30">
              NUEVO
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('interview')}
            className={`px-3 py-2 font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'interview'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Entrevista de Miguel (Ultra & 50 Años)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('physiology')}
            className={`px-3 py-2 font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'physiology'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Umbrales & FC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-2 font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'general'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Peso & Rutina</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-2 font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'storage'
                ? 'border-zinc-300 text-zinc-200'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Almacenamiento Local</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* ================= TAB: PERFIL FISIOLÓGICO AVANZADO ================= */}
          {activeTab === 'advanced_physiology' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Coach Miguel Talk Box */}
              <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 border border-amber-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <Brain className="w-4 h-4" />
                  <span>Coach Miguel: "La ciencia detrás de tus sensaciones"</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  En ultradistancia, los detalles biomecánicos y térmicos marcan la diferencia entre llegar al Roque de los Muchachos fresco o reventar con calambres en El Time. Aquí calibramos tus <strong>lesiones crónicas</strong>, tu destreza en <strong>terreno volcánico canario</strong>, tu <strong>sudoración y pérdida de sodio</strong>, y tus <strong>preferencias de vida</strong> para que el plan se adapte a ti y no al revés.
                </p>
              </div>

              {/* 1. HISTORIAL DETALLADO DE LESIONES CRÓNICAS */}
              <div className="bg-zinc-900/60 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>1. Historial Detallado de Lesiones Crónicas & Puntos Críticos</span>
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    Descripción exhaustiva de lesiones crónicas o recurrentes
                  </label>
                  <textarea
                    rows={2}
                    value={chronicDescription}
                    onChange={(e) => setChronicDescription(e.target.value)}
                    placeholder="Ej: Tendinopatía aquílea izquierda recurrente tras bajadas pronunciadas..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Detonante principal de la molestia
                    </label>
                    <input
                      type="text"
                      value={chronicTrigger}
                      onChange={(e) => setChronicTrigger(e.target.value)}
                      placeholder="Ej: Desniveles negativos continuados >800m, drop bajo..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Señales de aviso temprano (Red Flags)
                    </label>
                    <input
                      type="text"
                      value={chronicWarningSigns}
                      onChange={(e) => setChronicWarningSigns(e.target.value)}
                      placeholder="Ej: Rigidez matutina en primeros pasos, tirantez en sóleo..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Protocolo personal de descarga / tratamiento
                    </label>
                    <input
                      type="text"
                      value={chronicManagementProtocol}
                      onChange={(e) => setChronicManagementProtocol(e.target.value)}
                      placeholder="Ej: Soleus drops 3-1-1 en escalón, masaje con pelota dura, crioterapia..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Plantillas Podológicas
                    </label>
                    <button
                      type="button"
                      onClick={() => setChronicOrthotics(!chronicOrthotics)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                        chronicOrthotics
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      <Check className={`w-4 h-4 ${chronicOrthotics ? 'opacity-100' : 'opacity-30'}`} />
                      <span>{chronicOrthotics ? 'Usa plantillas podológicas' : 'Sin plantillas especiales'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. EXPERIENCIA TÉCNICA EN ALTA MONTAÑA & TERRENO VOLCÁNICO */}
              <div className="bg-zinc-900/60 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold uppercase tracking-wider text-xs">
                  <Mountain className="w-4 h-4 text-cyan-400" />
                  <span>2. Experiencia Técnica en Alta Montaña & Terreno Volcánico</span>
                </div>

                {/* Focus en Terreno Volcánico */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/30 to-zinc-950 border border-orange-800/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🌋</span>
                      <div>
                        <strong className="text-zinc-100 block text-xs">
                          Experiencia en Terreno Volcánico (Lapilli, Picón, Malpaís)
                        </strong>
                        <span className="text-[11px] text-zinc-400">
                          Específico para Transvulcania (La Palma) y carreras canarias
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHasVolcanicExp(!hasVolcanicExp)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 border transition cursor-pointer shrink-0 ${
                        hasVolcanicExp
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${hasVolcanicExp ? 'opacity-100' : 'opacity-20'}`} />
                      <span>{hasVolcanicExp ? 'Sí, tengo experiencia en volcán' : 'Sin experiencia en volcán'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
                    <strong className="text-orange-300">Nota táctica de Miguel:</strong> En Transvulcania el lapilli (picón volcánico) no perdona: en subida, cada zancada resbala hacia atrás un 20% aumentando el gasto metabólico de sóleos y gemelos; en bajada, las piedras volcánicas afiladas abrasan los pies si no usas polainas bajas de trail.
                  </p>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Observaciones sobre tu tracción, polainas o zapatillas en volcán
                    </label>
                    <input
                      type="text"
                      value={volcanicNotes}
                      onChange={(e) => setVolcanicNotes(e.target.value)}
                      placeholder="Ej: Uso zapatillas con taco de 5mm y polainas bajas; buena adaptación al picón..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>

                {/* Grado técnico y Altitud */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Grado Técnico en Montaña</label>
                    <select
                      value={technicalGrade}
                      onChange={(e) => setTechnicalGrade(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="moderate_trails">Senderos moderados y pistas</option>
                      <option value="technical_alpine_rocks">Terreno técnico alpino con bloques de roca</option>
                      <option value="extreme_ridge_scree">Pedreras extremas y cresterías expuestas</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Altitud Máxima Alcanzada (m)</label>
                    <input
                      type="number"
                      value={maxAltitude}
                      onChange={(e) => setMaxAltitude(Number(e.target.value))}
                      placeholder="Ej: 3100"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Roque de los Muchachos: 2.426m</span>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Sensibilidad a la Altitud / Hipoxia</label>
                    <select
                      value={altitudeSens}
                      onChange={(e) => setAltitudeSens(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="none">Buena aclimatación (sin molestias)</option>
                      <option value="mild_headache_above_2000m">Leve pesadez/cefalea &gt; 2.000m</option>
                      <option value="significant_drop_in_pace">Caída acusada de ritmo y taquicardia</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. TOLERANCIA AL CALOR DOCUMENTADA */}
              <div className="bg-zinc-900/60 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-red-400 font-bold uppercase tracking-wider text-xs">
                  <Sun className="w-4 h-4 text-red-400" />
                  <span>3. Tolerancia al Calor Documentada & Perfil de Sudor</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Nivel de Tolerancia Térmica</label>
                    <select
                      value={heatLevel}
                      onChange={(e) => setHeatLevel(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="low">Baja: Sufro a partir de 22ºC</option>
                      <option value="moderate">Moderada: Rindo bien si cuido sales</option>
                      <option value="high">Alta: Buena termorregulación</option>
                      <option value="heat_acclimated">Aclimatado al calor canario (&gt;28ºC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Tasa Sudoración Medida (L/h)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={sweatRate}
                      onChange={(e) => setSweatRate(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Test de sudor en verano o sauna</span>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Pérdida de Sodio en Sudor</label>
                    <select
                      value={sodiumProfile}
                      onChange={(e) => setSodiumProfile(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="salty_sweater_white_crust">Sudador salado (Costras blancas de sal)</option>
                      <option value="medium_salt">Pérdida de sal moderada</option>
                      <option value="low_salt">Pérdida de sal baja</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Pauta y estrategia de choque contra el calor
                    </label>
                    <input
                      type="text"
                      value={heatStrategy}
                      onChange={(e) => setHeatStrategy(e.target.value)}
                      placeholder="Ej: Cubrenucas húmedo en avituallamientos, 700mg sodio/h, hielo en gorra..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="text-zinc-400 font-semibold block mb-1">
                      Historial Calambres
                    </label>
                    <button
                      type="button"
                      onClick={() => setHeatCramps(!heatCramps)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                        heatCramps
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      <AlertTriangle className={`w-3.5 h-3.5 ${heatCramps ? 'opacity-100' : 'opacity-30'}`} />
                      <span>{heatCramps ? 'Vulnerable a calambres' : 'Sin calambres'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. CUESTIONARIO DE PREFERENCIAS DE ENTRENAMIENTO */}
              <div className="bg-zinc-900/60 p-4 sm:p-5 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold uppercase tracking-wider text-xs">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>4. Cuestionario de Preferencias de Entrenamiento & Estilo de Vida</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Franja Horaria Habitual</label>
                    <select
                      value={prefTime}
                      onChange={(e) => setPrefTime(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="early_morning">Mañanas tempranas (6:30 - 8:00 AM)</option>
                      <option value="midday">Mediodía (parón comida)</option>
                      <option value="evening">Tardes / Noches (post-trabajo)</option>
                      <option value="flexible">Flexible según el día</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Terreno Tirada Larga</label>
                    <select
                      value={longRunTerrain}
                      onChange={(e) => setLongRunTerrain(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="steep_technical_trail">Sendero técnico empinado con roca</option>
                      <option value="rolling_mountain_paths">Senderos de montaña ondulados</option>
                      <option value="high_alpine_scree">Alta montaña y cresterías</option>
                      <option value="mixed_fire_road">Pista forestal mixta</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Flexibilidad Semanal</label>
                    <select
                      value={weeklyFlex}
                      onChange={(e) => setWeeklyFlex(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                    >
                      <option value="flexible_swap_days">Flexible (permutar días si surge imprevisto)</option>
                      <option value="strict_fixed_days">Estructura estricta de días fijos</option>
                      <option value="shift_work_adaptive">Turnos laborales cambiantes</option>
                    </select>
                  </div>
                </div>

                {/* Deportes cruzados tolerados */}
                <div className="space-y-2">
                  <label className="text-zinc-300 font-semibold block">
                    Deportes cruzados que disfrutas o toleras (para descansos activos o semanas de descarga):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Bicicleta Gravel/MTB',
                      'Senderismo con desnivel (Power Hiking)',
                      'Natación',
                      'Esquí de travesía / montaña',
                      'Rodillo indoor',
                      'Elíptica'
                    ].map(sport => {
                      const isSelected = crossSports.includes(sport);
                      return (
                        <button
                          key={sport}
                          type="button"
                          onClick={() => toggleCrossSport(sport)}
                          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                          <span>{sport}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Tolerancia a Cinta Indoor</label>
                    <select
                      value={treadmill}
                      onChange={(e) => setTreadmill(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    >
                      <option value="emergency_weather_only">Solo en emergencias meteorológicas extremas</option>
                      <option value="hate_it_outdoor_only">La detesto: 100% aire libre y montaña</option>
                      <option value="regularly_for_steep_walk">La uso con frecuencia para desnivel estático (+15%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-semibold block mb-1">Día Preferido de Descanso Total</label>
                    <select
                      value={restDay}
                      onChange={(e) => setRestDay(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                    >
                      <option value="monday">Lunes (recuperar de la tirada del fin de semana)</option>
                      <option value="friday">Viernes (cargar pilas antes del fin de semana)</option>
                      <option value="post_long_run">Día inmediato tras la tirada larga</option>
                      <option value="flexible">Flexible según sensaciones de HRV</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">
                    Limitaciones de estilo de vida, trabajo o familia (para que Miguel no prescriba a ciegas)
                  </label>
                  <textarea
                    rows={2}
                    value={lifestyleNotes}
                    onChange={(e) => setLifestyleNotes(e.target.value)}
                    placeholder="Ej: Trabajo sedentario de oficina, viajes frecuentes los jueves, fines de semana libres..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100"
                  />
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 1: ENTREVISTA DE MIGUEL ================= */}
          {activeTab === 'interview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Miguel Greeting Banner */}
              <div className="bg-gradient-to-r from-amber-950/40 to-zinc-900 border border-amber-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <Brain className="w-4 h-4" />
                  <span>Coach Miguel: "Las preguntas que un buen entrenador debe hacerte"</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Para no prescribirte sesiones genéricas que revienten tus articulaciones, necesito que me respondas como a un compañero de cordada. A los 50 años la clave no es entrenar más, sino asimilar mejor y blindar los puntos débiles.
                </p>
              </div>

              {/* Distancia y carreras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">
                    Mayor Distancia en 1 Ultra (km)
                  </label>
                  <input
                    type="number"
                    value={longestKm}
                    onChange={(e) => setLongestKm(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">
                    Mayor Desnivel Positivo (+m D+)
                  </label>
                  <input
                    type="number"
                    value={longestDPlus}
                    onChange={(e) => setLongestDPlus(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-zinc-400 font-semibold block mb-1">
                    Ultras o Carreras Destacadas en tu Historial
                  </label>
                  <input
                    type="text"
                    value={completedUltras}
                    onChange={(e) => setCompletedUltras(e.target.value)}
                    placeholder="Ej. GTP 60k, CSP 110k, Ultra Sierra Nevada 75k..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              {/* Habilidad en bajadas y bastones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
                  <label className="text-amber-400 font-bold block">
                    ¿Cómo te defiendes en descensos técnicos rotos?
                  </label>
                  <p className="text-[11px] text-zinc-400">
                    Transvulcania tiene 2.400m negativos directos sobre roca volcánica hasta Tazacorte.
                  </p>
                  <select
                    value={downhillAbility}
                    onChange={(e) => setDownhillAbility(e.target.value as any)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                  >
                    <option value="beginner">Precavido / Piernas rígidas en roca suelta</option>
                    <option value="intermediate">Intermedio / Me defiendo bien pero acuso fatiga de cuádriceps</option>
                    <option value="expert_technical">Experto / Fluido en terreno muy técnico</option>
                  </select>
                </div>

                <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
                  <label className="text-amber-400 font-bold block">
                    Técnica y Uso de Bastones
                  </label>
                  <p className="text-[11px] text-zinc-400">
                    Para la subida al Roque de los Muchachos (+2.400m de D+ continuo).
                  </p>
                  <select
                    value={polesUsage}
                    onChange={(e) => setPolesUsage(e.target.value as any)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                  >
                    <option value="expert_all_hills">Experto: En cualquier subida constante</option>
                    <option value="steep_only">Solo en pendientes muy empinadas (&gt;15-20%)</option>
                    <option value="never">Rara vez o nunca los uso</option>
                  </select>
                </div>
              </div>

              {/* Zonas sensibles / historial de lesiones */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2.5">
                <label className="text-zinc-200 font-bold block">
                  Puntos vulnerables o lesiones históricas (selecciona las que apliquen):
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Tendón de Aquiles',
                    'Sóleos excéntrico',
                    'Fascia plantar',
                    'Cintilla iliotibial (TFL)',
                    'Sobrecarga de cuádriceps',
                    'Condromalacia rotuliana',
                    'Lumbar con mochila',
                    'Isquiotibiales'
                  ].map(joint => {
                    const isSelected = selectedJoints.includes(joint);
                    return (
                      <button
                        key={joint}
                        type="button"
                        onClick={() => toggleJoint(joint)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                        <span>{joint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Asimilación a los 50 años */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <label className="text-zinc-200 font-bold block">
                  Asimilación y Regeneración a los 50 Años:
                </label>
                <div>
                  <textarea
                    rows={2}
                    value={recoveryCapacity}
                    onChange={(e) => setRecoveryCapacity(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Horas Sueño</label>
                    <input
                      type="number"
                      step="0.5"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Estrés Diario</label>
                    <select
                      value={stressLevel}
                      onChange={(e) => setStressLevel(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                    >
                      <option value="low">Bajo</option>
                      <option value="moderate">Moderado</option>
                      <option value="high_mental">Alto (laboral/mental)</option>
                      <option value="high_physical">Alto (físico)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Calor Canario</label>
                    <select
                      value={heatTolerance}
                      onChange={(e) => setHeatTolerance(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                    >
                      <option value="strong">Alta tolerancia</option>
                      <option value="moderate">Moderada (cuidar sales)</option>
                      <option value="poor">Sensible (calambres)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Estómago y motivación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">
                    Historial Estomacal / Gut Issues en Ultras
                  </label>
                  <textarea
                    rows={2}
                    value={gutHistory}
                    onChange={(e) => setGutHistory(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">
                    Tu Motivación a los 50 Años
                  </label>
                  <textarea
                    rows={2}
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-200"
                  />
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 2: FISIOLOGÍA & UMBRALES ================= */}
          {activeTab === 'physiology' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>Frecuencias Cardíacas & Umbrales Fisiológicos</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400">FC Reposo</label>
                    <input
                      type="number"
                      value={restingHr}
                      onChange={(e) => setRestingHr(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400">FC Máxima Real</label>
                    <input
                      type="number"
                      value={maxHr}
                      onChange={(e) => setMaxHr(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400">Umbral AeT (VT1)</label>
                    <input
                      type="number"
                      value={aetHr}
                      onChange={(e) => setAetHr(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400">Umbral AnT (VT2)</label>
                    <input
                      type="number"
                      value={antHr}
                      onChange={(e) => setAntHr(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 pt-1">
                  Separación AeT - AnT: <strong className="text-zinc-200">{antHr - aetHr} bpm</strong>.
                  {hasAds && (
                    <span className="text-amber-400 ml-1">
                      Presentas Síndrome de Deficiencia Aeróbica (ADS). Miguel priorizará volumen estricto sub-AeT (&lt; {aetHr} bpm).
                    </span>
                  )}
                </div>
              </div>

              {/* HRV rMSSD */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-bold flex items-center space-x-1.5">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span>Línea Base HRV Nocturna rMSSD (ms)</span>
                  </label>
                  <span className="text-zinc-400 font-bold">{baselineHrv} ms</span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={baselineHrv}
                  onChange={(e) => setBaselineHrv(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                />
                <p className="text-[11px] text-zinc-500">
                  Referencia de variabilidad cardíaca para cuantificar fatiga del sistema nervioso autónomo.
                </p>
              </div>

            </div>
          )}

          {/* ================= TAB 3: PESO & RUTINA ================= */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400">Nombre o Apodo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Edad</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold"
                  />
                </div>
              </div>

              {/* Composición Corporal & Peso Óptimo */}
              <div className="space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span>Antropometría & Peso de Carrera</span>
                  </h4>
                  <span className="text-[11px] text-zinc-400">IMC actual: <strong className="text-zinc-200">{currentBmi}</strong></span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400">Altura (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400">Peso Actual (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400">Peso Óptimo (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetRaceWeightKg}
                      onChange={(e) => setTargetRaceWeightKg(Number(e.target.value))}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-bold"
                    />
                  </div>
                </div>

                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="flex items-center space-x-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400 inline" />
                      <span>Diferencia hacia meta:</span>
                    </span>
                    <strong className={weightDiff > 0 ? "text-amber-400" : "text-emerald-400"}>
                      {weightDiff > 0 ? `-${weightDiff} kg pendientes` : '¡En peso óptimo de competición!'}
                    </strong>
                  </div>
                  {weightDiff > 0 && (
                    <p className="text-zinc-500 leading-relaxed">
                      En los <strong className="text-zinc-300">+4.350m de D+</strong> de Transvulcania, alcanzar los {targetRaceWeightKg} kg te ahorrará <strong className="text-emerald-400">~{estimatedCaloriesSaved} kcal</strong> de esfuerzo metabólico (~{estimatedMinutesSaved} min menos en carrera).
                    </p>
                  )}
                </div>
              </div>

              {/* Rutina & Disponibilidad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400">Días Disponibles a la Semana</label>
                  <select
                    value={availableDays}
                    onChange={(e) => setAvailableDays(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  >
                    <option value={4}>4 días (3 entre semana + 1 fin de semana)</option>
                    <option value={5}>5 días (4 entre semana + 1 fin de semana)</option>
                    <option value={3}>3 días (2 entre semana + 1 fin de semana)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400">Día de Tirada Larga de Montaña</label>
                  <select
                    value={longRunDay}
                    onChange={(e) => setLongRunDay(e.target.value as 'saturday' | 'sunday')}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  >
                    <option value="saturday">Sábado</option>
                    <option value="sunday">Domingo</option>
                  </select>
                </div>
              </div>

              {/* Target Race reminder */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-amber-900/30 flex items-center space-x-3 text-xs">
                <Mountain className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-zinc-400">Objetivo Activo: </span>
                  <strong className="text-zinc-100">{targetRace.name} ({targetRace.distanceKm}km, +{targetRace.elevationGainM}m D+)</strong>
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 4: ALMACENAMIENTO LOCAL SEGURO ================= */}
          {activeTab === 'storage' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-700/80 space-y-3">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <HardDrive className="w-5 h-5 text-amber-400" />
                  <span className="text-sm">¿Cómo se almacenan mis datos? (100% en Local)</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-xs">
                  Tu plan de entrenamiento, métricas de Suunto, diario de check-ins de HRV y conversaciones con Coach Miguel se guardan de forma exclusiva en el <strong>almacenamiento local de tu navegador (localStorage)</strong>.
                </p>

                <div className="space-y-2 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start space-x-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-200 block">Privacidad absoluta y soberanía de datos</strong>
                      <span className="text-zinc-400">Tus datos biológicos y médicos nunca se envían a servidores de analítica ni se comparten. Solo tú tienes la llave.</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start space-x-2.5">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-200 block">Funciona 100% offline</strong>
                      <span className="text-zinc-400">Puedes consultar tus entrenamientos y ritmos en el refugio o en la crestería sin cobertura móvil.</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-amber-900/40 flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-200 block">Recomendación: Descarga tu Copia JSON periódica</strong>
                      <span className="text-zinc-400">Si borras los datos del navegador o cambias de ordenador, necesitarás tu archivo .JSON para restaurar tu historial con 1 clic.</span>
                    </div>
                  </div>
                </div>

                {onOpenBackup && (
                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-zinc-400">¿Quieres respaldar tu plan ahora mismo?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBackup();
                      }}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Copia JSON</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Save Button */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-lg transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Perfil Calibrado</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
