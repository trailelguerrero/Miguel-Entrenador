import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Heart, 
  Mountain, 
  Activity, 
  Shield, 
  Save, 
  Scale, 
  Flame, 
  Watch, 
  FileText, 
  Brain, 
  Check, 
  Download,
  AlertTriangle,
  HelpCircle,
  HardDrive
} from 'lucide-react';
import { AthleteProfile, TargetRace, SuuntoIntegrationConfig } from '../types';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AthleteProfile;
  onSaveProfile: (profile: AthleteProfile) => void;
  targetRace: TargetRace;
  suuntoConfig: SuuntoIntegrationConfig;
  onOpenSuuntoTab: () => void;
  onOpenBackup: () => void;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  targetRace,
  suuntoConfig,
  onOpenSuuntoTab,
  onOpenBackup,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(profile.setupStep || 1);

  // Form states
  const [name, setName] = useState(profile.name || 'Atleta');
  const [age, setAge] = useState(profile.age || 50);
  const [heightCm, setHeightCm] = useState(profile.heightCm || 176);
  const [weightKg, setWeightKg] = useState(profile.weightKg || 71.5);
  const [targetRaceWeightKg, setTargetRaceWeightKg] = useState(profile.targetRaceWeightKg || 67.5);
  
  // Physiology states
  const [restingHr, setRestingHr] = useState(profile.restingHr || 48);
  const [maxHr, setMaxHr] = useState(profile.maxHr || 178);
  const [aetHr, setAetHr] = useState(profile.aetHr || 138);
  const [antHr, setAntHr] = useState(profile.antHr || 162);
  const [baselineHrv, setBaselineHrv] = useState(profile.baselineHrv || 51.5);

  // Routine states
  const [availableDays, setAvailableDays] = useState(profile.availableDaysPerWeek || 4);
  const [longRunDay, setLongRunDay] = useState(profile.preferredLongRunDay || 'saturday');
  const [yearsTrail, setYearsTrail] = useState(profile.yearsTrailRunning || 12);
  const [currentVolume, setCurrentVolume] = useState(profile.currentWeeklyVolumeHours || 6.5);

  // Ultra Experience & Miguel's Interview
  const initialUltra = profile.ultraExperience || {};
  const [longestKm, setLongestKm] = useState(initialUltra.longestRaceKm || 85);
  const [longestDPlus, setLongestDPlus] = useState(initialUltra.longestRaceElevationGainM || 5200);
  const [completedUltras, setCompletedUltras] = useState(initialUltra.completedUltras || 'GTP 60k, Ultra Sierra Nevada 75k, CSP 110k');
  const [downhillAbility, setDownhillAbility] = useState<'beginner' | 'intermediate' | 'expert_technical'>(
    initialUltra.downhillTechnicalAbility || 'intermediate'
  );
  const [polesUsage, setPolesUsage] = useState<'never' | 'steep_only' | 'expert_all_hills'>(
    initialUltra.polesUsage || 'expert_all_hills'
  );
  const [sleepHours, setSleepHours] = useState(initialUltra.sleepQualityAvgHours || 7.0);
  const [stressLevel, setStressLevel] = useState<'low' | 'moderate' | 'high_physical' | 'high_mental'>(
    initialUltra.dailyWorkStressLevel || 'moderate'
  );
  const [recoveryCapacity, setRecoveryCapacity] = useState(
    initialUltra.recoveryCapacityAt50 || 'A mis 50 años necesito entre 48 y 72h tras tiradas largas con mucho desnivel negativo para disipar la fatiga neuromuscular.'
  );
  const [selectedJoints, setSelectedJoints] = useState<string[]>(
    initialUltra.vulnerableJointsOrTissues || ['Tendón de Aquiles', 'Sóleos excéntrico', 'Cintilla iliotibial']
  );
  const [heatTolerance, setHeatTolerance] = useState<'poor' | 'moderate' | 'strong'>(
    initialUltra.heatTolerance || 'moderate'
  );
  const [gutHistory, setGutHistory] = useState(
    initialUltra.gutIssuesHistory || 'Tolerancia aceptable hasta 5h; a partir de ahí necesito comida salada y repartir los carbohidratos en tomas pequeñas.'
  );
  const [motivation, setMotivation] = useState(
    initialUltra.personalMotivation || 'Coronar Transvulcania a mis 50 años con preparación quirúrgica, respetando mi longevidad deportiva y disfrutando la montaña.'
  );
  const [hasVolcanicExp, setHasVolcanicExp] = useState<boolean>(
    profile.advancedPhysiologicalProfile?.highMountain?.hasVolcanicTerrainExperience ?? true
  );

  if (!isOpen) return null;

  const totalSteps = 6;
  const progressPct = Math.round((currentStep / totalSteps) * 100);

  // Calculations
  const heightM = heightCm / 100;
  const currentBmi = (weightKg / (heightM * heightM)).toFixed(1);
  const weightDiff = Number((weightKg - targetRaceWeightKg).toFixed(1));
  const hasAdsCalculated = (antHr - aetHr) > 20 || ((antHr - aetHr) / antHr) > 0.1;

  const toggleJoint = (joint: string) => {
    setSelectedJoints(prev => 
      prev.includes(joint) ? prev.filter(j => j !== joint) : [...prev, joint]
    );
  };

  const handleSaveAndAdvance = (isFinal = false) => {
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
      hasAds: hasAdsCalculated,
      availableDaysPerWeek: Number(availableDays),
      preferredLongRunDay: longRunDay,
      yearsTrailRunning: Number(yearsTrail),
      currentWeeklyVolumeHours: Number(currentVolume),
      injuryHistory: `Zonas sensibles: ${selectedJoints.join(', ')}. Recuperación a los 50: ${recoveryCapacity}`,
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
        heatTolerance,
        gutIssuesHistory: gutHistory,
        personalMotivation: motivation,
        coachInitialInterviewCompleted: true,
      },
      advancedPhysiologicalProfile: profile.advancedPhysiologicalProfile ? {
        ...profile.advancedPhysiologicalProfile,
        highMountain: {
          ...profile.advancedPhysiologicalProfile.highMountain,
          hasVolcanicTerrainExperience: hasVolcanicExp,
        }
      } : undefined,
      setupStep: isFinal ? totalSteps : currentStep + 1,
      setupCompleted: isFinal ? true : profile.setupCompleted,
    };

    onSaveProfile(updated);

    if (isFinal) {
      onClose();
    } else {
      setCurrentStep(prev => Math.min(totalSteps, prev + 1));
    }
  };

  const stepsList = [
    { num: 1, title: 'Entrevista & Experiencia', sub: 'Conociendo al atleta de 50 años' },
    { num: 2, title: 'Umbrales & Fisiología', sub: 'AeT, AnT, FC Reposo y ADS' },
    { num: 3, title: 'Objetivo & Rutina', sub: 'Transvulcania y 4 días/semana' },
    { num: 4, title: 'Datos & Suunto', sub: 'Sincronización y archivos FIT' },
    { num: 5, title: 'Nutrición & Estómago', sub: 'Gut training e hidratación' },
    { num: 6, title: 'Veredicto & Almacenamiento', sub: 'Checklist y privacidad local' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        
        {/* Header con Barra de Progreso */}
        <div className="p-5 sm:p-6 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-amber-950/30">
                <Mountain className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Guía de Setup de Miguel
                  </span>
                  <span className="text-xs text-zinc-400">Paso {currentStep} de {totalSteps}</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-zinc-100 tracking-tight">
                  {stepsList[currentStep - 1].title}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 transition"
              title="Cerrar guía (puedes volver en cualquier momento)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper bar */}
          <div className="mt-4 space-y-1.5">
            <div className="w-full bg-zinc-850 h-2 rounded-full overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="hidden sm:grid grid-cols-6 gap-1 pt-1 text-[10px]">
              {stepsList.map(step => (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className={`text-left px-1.5 py-1 rounded transition text-ellipsis overflow-hidden ${
                    currentStep === step.num
                      ? 'text-amber-400 font-bold bg-zinc-900 border border-zinc-800'
                      : currentStep > step.num
                      ? 'text-emerald-400'
                      : 'text-zinc-500'
                  }`}
                >
                  <span className="block truncate">{step.num}. {step.title.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form Body - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* ================= STEP 1: ENTREVISTA DEL ENTRENADOR ================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Coach Miguel Talk Box */}
              <div className="bg-gradient-to-r from-amber-950/30 to-zinc-900 border border-amber-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <Brain className="w-4 h-4" />
                  <span>Coach Miguel: "Te hablo de tú a tú, colega."</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  A tus <strong>{age} años</strong> y con años de montaña a tus espaldas, no necesitas que te trate como a un novato de asfalto. Pero como tu co-entrenador, necesito conocer al milímetro tu chasis: tus bajadas técnicas, cómo recuperan tus fibras musculares tras un desnivel demoledor, y qué puntos vulnerables han encendido las alarmas en el pasado.
                </p>
              </div>

              {/* Datos biográficos básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Nombre o Apodo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Edad (Años)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Años en Ultra Trail</label>
                  <input
                    type="number"
                    value={yearsTrail}
                    onChange={(e) => setYearsTrail(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Volumen Actual (h/sem)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={currentVolume}
                    onChange={(e) => setCurrentVolume(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
              </div>

              {/* Mayor distancia y ultras completadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Distancia Máxima en 1 Carrera (km)</label>
                  <input
                    type="number"
                    value={longestKm}
                    onChange={(e) => setLongestKm(Number(e.target.value))}
                    placeholder="Ej. 85"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Desnivel Positivo Máximo (+m D+)</label>
                  <input
                    type="number"
                    value={longestDPlus}
                    onChange={(e) => setLongestDPlus(Number(e.target.value))}
                    placeholder="Ej. 5200"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-zinc-400 font-semibold block mb-1">Ultras y Carreras Destacadas Completadas</label>
                  <input
                    type="text"
                    value={completedUltras}
                    onChange={(e) => setCompletedUltras(e.target.value)}
                    placeholder="Ej. Gran Trail Peñalara 60k, CSP 110k, Ultra Sierra Nevada 75k..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              {/* Habilidad técnica en bajadas y bastones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800 space-y-1.5">
                  <label className="text-amber-400 font-bold block">
                    ¿Cómo te defiendes en bajadas técnicas rotas?
                  </label>
                  <p className="text-[11px] text-zinc-400">
                    Transvulcania tiene el descenso de 2.400m de El Time a Tazacorte sobre roca volcánica.
                  </p>
                  <select
                    value={downhillAbility}
                    onChange={(e) => setDownhillAbility(e.target.value as any)}
                    className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                  >
                    <option value="beginner">Precavido / Me cuesta soltar pierna en roca suelta</option>
                    <option value="intermediate">Intermedio / Me defiendo bien pero acuso fatiga de cuádriceps</option>
                    <option value="expert_technical">Experto / Cabra montesa veterana en terreno técnico</option>
                  </select>
                </div>

                <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800 space-y-1.5">
                  <label className="text-amber-400 font-bold block">
                    Uso de Bastones de Trail
                  </label>
                  <p className="text-[11px] text-zinc-400">
                    Clave para descargar el tren inferior en la ascensión al Roque (+2.400m).
                  </p>
                  <select
                    value={polesUsage}
                    onChange={(e) => setPolesUsage(e.target.value as any)}
                    className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-semibold"
                  >
                    <option value="expert_all_hills">Experto: Los uso en cualquier subida prolongada</option>
                    <option value="steep_only">Solo en rampas duras (&gt; 15-20% de pendiente)</option>
                    <option value="never">No suelo usar bastones</option>
                  </select>
                </div>

                {/* Terreno volcánico */}
                <div className="bg-gradient-to-r from-orange-950/20 to-zinc-900/60 p-3.5 rounded-2xl border border-orange-800/40 space-y-1.5 sm:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-orange-400 font-bold block flex items-center space-x-1.5">
                        <span>🌋 ¿Experiencia en Terreno Volcánico (Lapilli, Picón, Malpaís)?</span>
                      </label>
                      <p className="text-[11px] text-zinc-400">
                        Crucial para Transvulcania: el picón suelto de La Palma exige técnica de zancada corta y polainas bajas para no abrasar los pies.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasVolcanicExp(!hasVolcanicExp)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 border transition cursor-pointer shrink-0 ${
                        hasVolcanicExp
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${hasVolcanicExp ? 'opacity-100' : 'opacity-20'}`} />
                      <span>{hasVolcanicExp ? 'Sí, conozco el lapilli' : 'Sin experiencia previa'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Zonas vulnerables / lesiones históricas */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <label className="text-zinc-200 font-bold block">
                  Zonas sensibles o puntos débiles históricos (marca las que apliquen):
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

              {/* Recuperación a los 50 años y sueño */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Horas Sueño Habitual</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Nivel Estrés Diario</label>
                  <select
                    value={stressLevel}
                    onChange={(e) => setStressLevel(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  >
                    <option value="low">Bajo / Tranquilo</option>
                    <option value="moderate">Moderado</option>
                    <option value="high_mental">Alto (mental / laboral)</option>
                    <option value="high_physical">Alto (físico / activo)</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Tolerancia al Calor Canario</label>
                  <select
                    value={heatTolerance}
                    onChange={(e) => setHeatTolerance(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  >
                    <option value="strong">Alta: Rindo bien con calor</option>
                    <option value="moderate">Moderada: Necesito cuidar sales</option>
                    <option value="poor">Sensible: Me deshidrato rápido</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-semibold block mb-1">
                  ¿Cómo notas tu asimilación y recuperación muscular tras una tirada dura?
                </label>
                <textarea
                  rows={2}
                  value={recoveryCapacity}
                  onChange={(e) => setRecoveryCapacity(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-200"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-semibold block mb-1">
                  Tu motivación personal para el objetivo
                </label>
                <input
                  type="text"
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 2: UMBRALES Y FISIOLOGÍA ================= */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-gradient-to-r from-emerald-950/30 to-zinc-900 border border-emerald-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <Activity className="w-4 h-4" />
                  <span>Fisiología Uphill Athlete & Jason Koop</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Para no caer en la <em>zona basura</em> de fatiga sin adaptación, calculamos tus dos umbrales clave. En ultra trail, el <strong>Umbral Aeróbico (AeT / VT1 / DFA a1 &ge; 0.75)</strong> es tu techo de combustible de grasas: por encima de él, quemas glucógeno escaso.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">FC Reposo Matutina</label>
                  <input
                    type="number"
                    value={restingHr}
                    onChange={(e) => setRestingHr(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">Medida al despertar</span>
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">FC Máxima Real</label>
                  <input
                    type="number"
                    value={maxHr}
                    onChange={(e) => setMaxHr(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">Test o carrera reciente</span>
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Umbral AeT (VT1)</label>
                  <input
                    type="number"
                    value={aetHr}
                    onChange={(e) => setAetHr(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-emerald-400 font-bold"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">DFA a1 &ge; 0.75 / Test deriva</span>
                </div>
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Umbral AnT (VT2 / LTHR)</label>
                  <input
                    type="number"
                    value={antHr}
                    onChange={(e) => setAntHr(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-amber-400 font-bold"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">DFA a1 = 0.50</span>
                </div>
              </div>

              {/* Diagnóstico ADS */}
              <div className={`p-4 rounded-2xl border ${
                hasAdsCalculated 
                  ? 'bg-amber-950/20 border-amber-800/40 text-amber-300' 
                  : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
              } space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center space-x-1.5">
                    <Shield className="w-4 h-4" />
                    <span>Diferencia AnT - AeT: {antHr - aetHr} bpm</span>
                  </span>
                  <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700">
                    {hasAdsCalculated ? 'ADS Detectado' : 'Base Aeróbica Óptima'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {hasAdsCalculated ? (
                    <>
                      Tu brecha entre AeT y AnT supera los 20 bpm (o el 10%). Según Johnston y Jornet, presentas <strong>Síndrome de Deficiencia Aeróbica (ADS)</strong>. Miguel blindará el 85% de tus rodajes estrictamente por debajo de {aetHr} bpm para reconstruir tu base mitocondrial.
                    </>
                  ) : (
                    <>
                      Excelente: Tu base aeróbica está bien acoplada (brecha &le; 20 bpm). Tus adaptaciones de resistencia son estables.
                    </>
                  )}
                </p>
              </div>

              {/* HRV rMSSD Nocturna de Suunto */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-bold flex items-center space-x-1.5">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span>Línea Base HRV Nocturna (rMSSD ms)</span>
                  </label>
                  <span className="text-zinc-400 font-semibold">{baselineHrv} ms</span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={baselineHrv}
                  onChange={(e) => setBaselineHrv(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                />
                <p className="text-[11px] text-zinc-400">
                  Tu reloj Suunto registrará cada noche el rMSSD. Lo compararemos contra esta línea base para calcular la banda SWC (Smallest Worthwhile Change) y alertar de sobreentrenamiento o necesidad de descarga.
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP 3: OBJETIVO Y RUTINA SEMANAL ================= */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-gradient-to-r from-amber-950/30 to-zinc-900 border border-amber-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <Mountain className="w-4 h-4" />
                  <span>Objetivo Diana & Calendario Semanal</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Para un corredor de 50 años con responsabilidades y vida real, la consistencia supera al volumen suicida. La fórmula recomendada por Jason Koop para ultra es <strong>3 sesiones clave entre semana + 1 tirada larga el fin de semana</strong>.
                </p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <h4 className="font-bold text-zinc-200 flex items-center space-x-1.5">
                  <Mountain className="w-4 h-4 text-amber-400" />
                  <span>Carrera Objetivo A Activa</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-zinc-300">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase block font-bold">Carrera</span>
                    <strong className="text-zinc-100">{targetRace.name}</strong>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase block font-bold">Distancia & D+</span>
                    <strong className="text-amber-400">{targetRace.distanceKm} km • +{targetRace.elevationGainM}m D+</strong>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase block font-bold">Desnivel Negativo</span>
                    <strong className="text-red-400">-{targetRace.elevationLossM}m D- (El Time)</strong>
                  </div>
                </div>
              </div>

              {/* Disponibilidad y tirada larga */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Días Disponibles a la Semana</label>
                  <select
                    value={availableDays}
                    onChange={(e) => setAvailableDays(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  >
                    <option value={4}>4 días (3 entre semana + 1 fin de semana) [Óptimo]</option>
                    <option value={5}>5 días (4 entre semana + 1 fin de semana)</option>
                    <option value={3}>3 días (2 entre semana + 1 fin de semana)</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-400 font-semibold block mb-1">Día de Tirada Larga de Montaña</label>
                  <select
                    value={longRunDay}
                    onChange={(e) => setLongRunDay(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                  >
                    <option value="saturday">Sábado (Domingo regenerativo o descanso)</option>
                    <option value="sunday">Domingo</option>
                  </select>
                </div>
              </div>

              {/* Peso actual y peso óptimo */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span>Control de Peso de Carrera (W/kg)</span>
                  </h4>
                  <span className="text-zinc-400 text-[11px]">IMC: <strong className="text-zinc-200">{currentBmi}</strong></span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Peso Actual (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-amber-400 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Peso Meta (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetRaceWeightKg}
                      onChange={(e) => setTargetRaceWeightKg(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-emerald-400 font-bold"
                    />
                  </div>
                </div>

                {weightDiff > 0 && (
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Perder esos <strong className="text-amber-400">{weightDiff} kg</strong> de forma progresiva reducirá en <strong>~{Math.round(weightDiff * 9.81 * 4.35 / 0.23)} kcal</strong> el coste energético en los +4.350m de Transvulcania y ahorrará cientos de toneladas de impacto excéntrico sobre tus rodillas.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 4: ORIGEN DE DATOS Y SUUNTO ================= */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-gradient-to-r from-cyan-950/30 to-zinc-900 border border-cyan-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                  <Watch className="w-4 h-4" />
                  <span>Conexión Suunto & Carga de Entrenamientos</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Cero invención de datos: Coach Miguel se alimenta exclusivamente de tus datos reales de reloj. Puedes sincronizar directamente con tu cuenta Suunto o arrastrar archivos <strong>.FIT</strong> de cualquier sesión.
                </p>
              </div>

              {/* Suunto Card */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-3 h-3 rounded-full ${suuntoConfig.connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="font-bold text-zinc-200">
                      {suuntoConfig.connected ? 'Cuenta Suunto Conectada' : 'Cuenta Suunto Pendiente de Conectar'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSuuntoTab();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black text-xs transition cursor-pointer"
                  >
                    Abrir Conexión Suunto
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Con la cuenta conectada, un solo clic sincroniza tus últimos 28 días: métricas nocturnas de HRV rMSSD, horas de sueño y desglose en zonas aeróbica/transición de ZoneSense.
                </p>
              </div>

              {/* Archivo .FIT o .MD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <FileText className="w-4 h-4" />
                    <span>Archivos .FIT de Suunto</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Puedes soltar archivos <code>.fit</code> exportados de tu app Suunto en cualquier sesión del calendario o en la pestaña Suunto para análisis de cadencia y potencia.
                  </p>
                </div>

                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold">
                    <FileText className="w-4 h-4" />
                    <span>Historial en Markdown (.MD)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Si tienes un diario de entrenamientos en texto o notas de años anteriores, puedes cargarlo en la pestaña <em>Historial (.MD)</em> para que Miguel lo memorice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: ESTRATEGIA DE ESTÓMAGO E HIDRATACIÓN ================= */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-gradient-to-r from-amber-950/30 to-zinc-900 border border-amber-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <Flame className="w-4 h-4" />
                  <span>Entrenamiento Intestinal (Gut Training) & Hidratación</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  En ultras de más de 6-8 horas, la causa número uno de abandono no son las piernas, sino el colapso estomacal. Entrenar el intestino para tolerar 60-80 g/h de carbohidratos es tan entrenable como el VO2max.
                </p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <label className="text-zinc-300 font-bold block">
                  Historial de tolerancia digestiva en tiradas largas (&gt; 4 horas):
                </label>
                <textarea
                  rows={2}
                  value={gutHistory}
                  onChange={(e) => setGutHistory(e.target.value)}
                  placeholder="Ej: A partir de la hora 5 me cuesta tragar geles dulces; prefiero comida real y sales..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <span className="font-bold text-amber-400 block">Estrategia de Carbohidratos</span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Comenzaremos en tiradas largas con <strong>45-50 g/h</strong> para progresar gradualmente hacia <strong>70-80 g/h</strong> en las semanas cumbre de Transvulcania combinando maltodextrina y fructosa (ratio 1:0.8).
                  </p>
                </div>

                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <span className="font-bold text-cyan-400 block">Sodio y Reposición de Sudor</span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Para el calor canario y la calima volcánica, programaremos <strong>500 a 750 mg/h de sodio</strong> para prevenir la hiponatremia dilucional en las horas centrales del día.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 6: VEREDICTO DE MIGUEL Y ALMACENAMIENTO ================= */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Veredicto de Miguel */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-amber-950/30 border border-emerald-800/40 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle className="w-5 h-5" />
                  <span>Veredicto Táctico de Coach Miguel</span>
                </div>
                <p className="text-zinc-200 leading-relaxed">
                  ¡Ficha completa, <strong>{name}</strong>! Tienes <strong>{age} años</strong>, 12 años de poso montañero y un objetivo claro en <strong>Transvulcania 2027</strong>. Con tu umbral AeT en <strong>{aetHr} bpm</strong> y tu patrón de 4 días semanales, priorizaremos asimilación mitocondrial estricta y blindaje excéntrico de cuádriceps sin pisar un gimnasio.
                </p>
              </div>

              {/* DÓNDE SE GUARDAN LOS DATOS: EXPLICACIÓN TRANSPARENTE */}
              <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-700/80 space-y-3">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span>¿Dónde se guardan mis datos? (100% Local & Privado)</span>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Tus datos fisiológicos, entrenamientos, métricas de HRV y conversaciones con Miguel <strong>se guardan de forma segura y privada en el almacenamiento local de tu navegador (localStorage)</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start space-x-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-300">
                      <strong>Privacidad Total:</strong> Tus datos de salud no se venden ni van a bases de datos externas de terceros.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start space-x-2">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-300">
                      <strong>Offline / PWA:</strong> Funciona sin conexión en mitad de la montaña en tu móvil o portátil.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <span className="text-zinc-400 text-[11px]">
                    ¿Quieres guardar una copia o cambiar de equipo?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBackup();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Copia JSON</span>
                  </button>
                </div>
              </div>

              {/* Checklist de Parámetros */}
              <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <span className="font-bold text-zinc-300 block">Checklist de Configuración:</span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Perfil de atleta de 50 años y entrevista ultra registrada</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Umbrales AeT ({aetHr} bpm) y AnT ({antHr} bpm) calibrados</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Objetivo {targetRace.name} ({targetRace.distanceKm}k, +{targetRace.elevationGainM}m) asignado</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Estructura semanal de 4 días (3+1) y tirada en {longRunDay === 'saturday' ? 'sábado' : 'domingo'} fijada</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Pauta de hidratación y gut training programada</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 font-bold transition cursor-pointer text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => handleSaveAndAdvance(false)}
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-zinc-950 font-black shadow-lg transition cursor-pointer text-xs"
              >
                <span>Guardar y Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveAndAdvance(true)}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black shadow-lg shadow-emerald-950/40 transition cursor-pointer text-xs"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>¡Finalizar Setup y Empezar!</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
