import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Flame, 
  Droplet, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Mountain, 
  ChevronRight, 
  Sparkles, 
  Apple, 
  Utensils, 
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  PieChart,
  Calendar
} from 'lucide-react';
import { AthleteProfile, GutTrainingProfile } from '../types';
import { StorageService } from '../services/storage';

interface NutritionCalculatorProps {
  profile: AthleteProfile;
  gutProfile: GutTrainingProfile;
  onApplyGoalToGutProfile?: (targetPerHour: number) => void;
  onLinkedSuccess?: (workoutTitle: string, workoutDate: string) => void;
}

export const NutritionCalculator: React.FC<NutritionCalculatorProps> = ({
  profile,
  gutProfile,
  onLinkedSuccess,
}) => {
  // Calculator inputs
  const [sessionType, setSessionType] = useState<'recovery_base' | 'long_run_mountain' | 'threshold_intervals' | 'race_transvulcania'>('long_run_mountain');
  const [durationHours, setDurationHours] = useState<number>(3.5);
  const [elevationGainM, setElevationGainM] = useState<number>(1400);
  const [temperatureC, setTemperatureC] = useState<number>(22);
  const [athleteWeight, setAthleteWeight] = useState<number>(profile.weightKg || 0);
  const [selectedChoPerHour, setSelectedChoPerHour] = useState<number>(gutProfile.currentMaxCarbsPerHour || 55);
  const [activeTab, setActiveTab] = useState<'strategy' | 'timeline' | 'recovery'>('strategy');
  const [linkedWorkoutFeedback, setLinkedWorkoutFeedback] = useState<string | null>(null);

  // Quick Presets
  const applyPreset = (preset: 'base' | 'long_mountain' | 'simulation' | 'race') => {
    switch (preset) {
      case 'base':
        setSessionType('recovery_base');
        setDurationHours(1.5);
        setElevationGainM(250);
        setTemperatureC(18);
        setSelectedChoPerHour(Math.min(45, gutProfile.currentMaxCarbsPerHour));
        break;
      case 'long_mountain':
        setSessionType('long_run_mountain');
        setDurationHours(3.5);
        setElevationGainM(1400);
        setTemperatureC(22);
        setSelectedChoPerHour(gutProfile.currentMaxCarbsPerHour);
        break;
      case 'simulation':
        setSessionType('long_run_mountain');
        setDurationHours(5.5);
        setElevationGainM(2400);
        setTemperatureC(26);
        setSelectedChoPerHour(Math.max(60, gutProfile.currentMaxCarbsPerHour));
        break;
      case 'race':
        setSessionType('race_transvulcania');
        setDurationHours(11.5);
        setElevationGainM(4350);
        setTemperatureC(28);
        setSelectedChoPerHour(Math.min(80, gutProfile.goalCarbsPerHour || 80));
        break;
    }
  };

  // Physiological & Metabolic calculations (Metodología Uphill Athlete)
  const results = useMemo(() => {
    const weight = Number(athleteWeight) || 71.5;
    const hours = Number(durationHours) || 1;
    const dPlus = Number(elevationGainM) || 0;
    const temp = Number(temperatureC) || 20;

    // Base metabolic rate on trail: ~9-11 kcal/kg/hour + vertical cost (~1 kcal per kg per 100m D+)
    let intensityMetFactor = 9.2; // Sub-AeT base
    if (sessionType === 'recovery_base') intensityMetFactor = 8.0;
    if (sessionType === 'threshold_intervals') intensityMetFactor = 11.5;
    if (sessionType === 'race_transvulcania') intensityMetFactor = 9.8;

    const flatCostKcal = intensityMetFactor * weight * hours;
    const climbCostKcal = (weight * dPlus * 0.95) / 100; // Work against gravity in mountain
    const totalKcal = Math.round(flatCostKcal + climbCostKcal);
    const kcalPerHour = Math.round(totalKcal / hours);

    // Substrate partition: Fat oxidation vs Carbohydrates (Uphill Athlete Zone 2 FatMax)
    let fatPct = 65; // At sub-AeT pace (< 142 bpm), highly trained aerobic system burns predominantly fat
    if (sessionType === 'threshold_intervals') fatPct = 25; // Anaerobic threshold relies 75%+ on glycogen
    if (sessionType === 'recovery_base') fatPct = 75; // Low intensity fat burn
    if (sessionType === 'race_transvulcania') fatPct = 60; // Sustained ultra pace

    const choPct = 100 - fatPct;
    const fatKcal = Math.round(totalKcal * (fatPct / 100));
    const choKcal = Math.round(totalKcal * (choPct / 100));
    const fatGrams = Math.round(fatKcal / 9); // 9 kcal per g fat
    const choGramsBurned = Math.round(choKcal / 4); // 4 kcal per g CHO

    // Exogenous CHO intake target based on gut tolerance
    const choTargetPerHour = selectedChoPerHour;
    const totalChoToIngest = Math.round(choTargetPerHour * hours);

    // Fuel item translation (Gels, solids, liquid)
    // For runs > 2.5 hours, we balance liquid/gels with real solids to prevent sweetness fatigue
    let gelsCount = 0;
    let solidPortions = 0;
    let liquidChoGrams = 0;

    if (hours <= 2) {
      gelsCount = Math.ceil(totalChoToIngest / 30);
    } else {
      // Half from gels/liquids, half from easily digestible solids/bars
      const solidChoTarget = totalChoToIngest * 0.35;
      const liquidOrGelsChoTarget = totalChoToIngest * 0.65;
      gelsCount = Math.round((liquidOrGelsChoTarget * 0.6) / 25);
      liquidChoGrams = Math.round(liquidOrGelsChoTarget * 0.4);
      solidPortions = Math.max(1, Math.round(solidChoTarget / 25)); // 25g CHO per portion (e.g. 1 banana or 2 dates or 1 rice cake)
    }

    // Hydration & Sodium based on temperature and duration
    let fluidsPerHourMl = 550;
    if (temp >= 28) fluidsPerHourMl = 800;
    else if (temp >= 24) fluidsPerHourMl = 700;
    else if (temp >= 18) fluidsPerHourMl = 600;
    else fluidsPerHourMl = 450;

    // Do not exceed 800ml/h to avoid gastric sloshing/distension
    fluidsPerHourMl = Math.min(800, fluidsPerHourMl);
    const totalFluidsL = Math.round((fluidsPerHourMl * hours) / 100) / 10;

    // Sodium: 500-750 mg/h (mandatory for SGLT1 intestinal glucose transport)
    let sodiumPerHourMg = 500;
    if (temp >= 26) sodiumPerHourMg = 700;
    else if (temp >= 22) sodiumPerHourMg = 600;
    const totalSodiumMg = Math.round(sodiumPerHourMg * hours);

    // Post-workout recovery window (3:1 to 4:1 CHO:Protein ratio within 45 min)
    const recoveryChoGrams = Math.round(weight * 1.1); // ~75-80g CHO for 71.5kg
    const recoveryProteinGrams = Math.round(weight * 0.32); // ~23-25g protein

    // Timeline schedule (every 20 or 30 min)
    const timeline = [];
    const intervalMin = hours > 4 ? 30 : 20;
    const totalIntervals = Math.floor((hours * 60) / intervalMin);

    for (let i = 1; i <= Math.min(totalIntervals, 12); i++) {
      const min = i * intervalMin;
      const isSolidInterval = i % 3 === 0 && hours >= 2.5;
      const isSodiumCapsule = i % 3 === 0 && sodiumPerHourMg >= 600;
      
      let item = '';
      let detail = '';
      let type: 'gel' | 'solid' | 'drink' = 'gel';

      if (isSolidInterval) {
        type = 'solid';
        item = 'Porción sólida (dátil/plátano/barrita)';
        detail = `~25g CHO + sorbo de agua clara. Ingerir caminando si estás en rampa >10% para no ahogar la digestión.`;
      } else {
        type = 'gel';
        item = `Gel con ratio dual 1:0.8 (${Math.round(choTargetPerHour / (60 / intervalMin))}g CHO)`;
        detail = `Tomar con 150ml de agua para evitar hiperosmolaridad estomacal.${isSodiumCapsule ? ' + Cápsula de sal.' : ''}`;
      }

      timeline.push({
        minute: min,
        timeFormatted: `${Math.floor(min / 60)}h ${min % 60 ? (min % 60) + 'm' : '00m'}`,
        type,
        item,
        detail,
        hydrationSip: `${Math.round(fluidsPerHourMl / (60 / intervalMin))} ml de líquido`,
      });
    }

    return {
      totalKcal,
      kcalPerHour,
      fatPct,
      choPct,
      fatGrams,
      choGramsBurned,
      choTargetPerHour,
      totalChoToIngest,
      gelsCount,
      solidPortions,
      liquidChoGrams,
      fluidsPerHourMl,
      totalFluidsL,
      sodiumPerHourMg,
      totalSodiumMg,
      recoveryChoGrams,
      recoveryProteinGrams,
      timeline,
    };
  }, [athleteWeight, durationHours, elevationGainM, temperatureC, sessionType, selectedChoPerHour]);

  const handleLinkToUpcomingWorkout = () => {
    const workouts = StorageService.getWorkouts();
    const today = new Date().toISOString().split('T')[0];
    const upcoming = workouts.find(w => !w.completed && w.date >= today) || workouts.find(w => !w.completed) || workouts[0];

    if (upcoming) {
      const fuelAdvice = `Estrategia (${selectedChoPerHour}g/h CHO): ${results.gelsCount} geles duales (1:0.8) + ${results.solidPortions} porciones sólidas. Hidratación: ${results.fluidsPerHourMl}ml/h con ${results.sodiumPerHourMg}mg/h sodio. Post: ${results.recoveryChoGrams}g CHO + ${results.recoveryProteinGrams}g Proteína.`;
      const updatedWorkout = {
        ...upcoming,
        nutritionAdvice: fuelAdvice,
        plannedCarbsPerHourG: selectedChoPerHour,
        plannedFluidsPerHourMl: results.fluidsPerHourMl,
        plannedSodiumPerHourMg: results.sodiumPerHourMg,
      };
      StorageService.addOrUpdateWorkout(updatedWorkout);
      setLinkedWorkoutFeedback(`Estrategia asignada a "${upcoming.title}" (${upcoming.date})`);
      onLinkedSuccess?.(upcoming.title, upcoming.date);
      setTimeout(() => setLinkedWorkoutFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Presets Row */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold text-stone-200 uppercase tracking-wider">
              Plantillas Rápidas de Tirada:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPreset('base')}
              className="px-3 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-750 border border-stone-750 text-xs font-semibold text-stone-300 transition cursor-pointer"
            >
              🏃 Rodaje Base 1h30 (Sub-AeT)
            </button>
            <button
              onClick={() => applyPreset('long_mountain')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-300 transition cursor-pointer"
            >
              ⛰️ Tirada Montaña 3h30 (+1.400m)
            </button>
            <button
              onClick={() => applyPreset('simulation')}
              className="px-3 py-1.5 rounded-xl bg-stone-850 hover:bg-stone-750 border border-stone-750 text-xs font-semibold text-stone-300 transition cursor-pointer"
            >
              🌋 Simulación Cumbre 5h30 (+2.400m)
            </button>
            <button
              onClick={() => applyPreset('race')}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-xs font-bold text-red-300 transition cursor-pointer"
            >
              🏆 Transvulcania 73K (+4.350m)
            </button>
          </div>
        </div>
      </div>

      {/* Main Parameters Configuration Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-100">
                Calculadora Fisiológica de Nutrición de Montaña
              </h2>
              <p className="text-xs text-stone-400">
                Alineada con tu peso actual ({profile.weightKg} kg) y tu adaptación gástrica de {gutProfile.currentMaxCarbsPerHour} g/h
              </p>
            </div>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Session Type */}
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5">
              Tipo de Sesión / Intensidad
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as any)}
              className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-medium focus:border-amber-400 focus:outline-none"
            >
              <option value="long_run_mountain">Tirada Larga Montaña (Sub-AeT & D+)</option>
              <option value="recovery_base">Rodaje Regenerativo / Base Z1-Z2</option>
              <option value="threshold_intervals">Cuestas & Umbral Anaeróbico (Alto glucógeno)</option>
              <option value="race_transvulcania">Carrera Transvulcania 73K (Máxima exigencia)</option>
            </select>
          </div>

          {/* 2. Duration */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-stone-300">
                Duración Prevista
              </label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {Math.floor(durationHours)}h {Math.round((durationHours % 1) * 60)}m
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="14"
              step="0.5"
              value={durationHours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
              <span>1 hora</span>
              <span>7 horas</span>
              <span>14 horas (Ultra)</span>
            </div>
          </div>

          {/* 3. Elevation Gain */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-stone-300">
                Desnivel Positivo (+D)
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                +{elevationGainM} m
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="4500"
              step="100"
              value={elevationGainM}
              onChange={(e) => setElevationGainM(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
              <span>Llano</span>
              <span>+2.000m</span>
              <span>+4.350m (La Palma)</span>
            </div>
          </div>

          {/* 4. Temperature */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-stone-300">
                Temperatura Prevista (°C)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {temperatureC}°C
              </span>
            </div>
            <input
              type="range"
              min="8"
              max="38"
              step="1"
              value={temperatureC}
              onChange={(e) => setTemperatureC(parseInt(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
              <span>8°C (Cresta fría)</span>
              <span>22°C (Templado)</span>
              <span>38°C (Tazacorte)</span>
            </div>
          </div>

          {/* 5. Athlete Weight */}
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5">
              Peso del Atleta (kg)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="50"
                max="110"
                value={athleteWeight}
                onChange={(e) => setAthleteWeight(parseFloat(e.target.value) || 71.5)}
                className="w-full bg-stone-950 border border-stone-750 rounded-xl px-3.5 py-2 text-xs font-mono text-stone-100 font-semibold focus:border-amber-400 focus:outline-none"
              />
              <span className="absolute right-3 top-2 text-xs text-stone-500 font-mono">
                kg
              </span>
            </div>
          </div>

          {/* 6. Ingestion Target per Hour */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-stone-300">
                Meta de Carbohidratos (g/h)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {selectedChoPerHour} g/h
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="90"
              step="5"
              value={selectedChoPerHour}
              onChange={(e) => setSelectedChoPerHour(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
              <span>30g (Base)</span>
              <span className="text-amber-400 font-bold">
                {gutProfile.currentMaxCarbsPerHour ? `Tu tolerancia: ${gutProfile.currentMaxCarbsPerHour}g` : 'Sin tolerancia registrada: valor general, no tuyo'}
              </span>
              <span>90g (Élite)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metabolic Substrate & Energetics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Energy Demanded */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-1">
            <span>Gasto Calórico Total</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-stone-100 font-mono">
              {results.totalKcal.toLocaleString()}
            </span>
            <span className="text-xs text-stone-400 ml-1 font-semibold">kcal</span>
          </div>
          <div className="text-[11px] text-stone-400 font-mono">
            ~{results.kcalPerHour} kcal/hora en esfuerzo
          </div>
        </div>

        {/* Fat Oxidation (Uphill Athlete FatMax) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-1">
            <span>Oxidación de Grasas (FatMax)</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {results.fatPct}%
              </span>
              <span className="text-xs text-stone-300 font-semibold font-mono">
                ({results.fatGrams}g grasa)
              </span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-300/80 leading-tight">
            Ahorras ~{(results.fatGrams * 9 / 4).toFixed(0)}g de glucógeno gracias a tu base sub-AeT.
          </div>
        </div>

        {/* Exogenous Carb Target */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-1">
            <span>Carbohidratos a Ingerir</span>
            <Apple className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400 font-mono">
                {results.totalChoToIngest}
              </span>
              <span className="text-xs text-stone-400 font-semibold">g totales</span>
            </div>
          </div>
          <div className="text-[11px] text-stone-300 font-mono">
            {results.choTargetPerHour} g/h · {Math.round(results.totalChoToIngest * 4)} kcal intra-entreno
          </div>
        </div>

        {/* Hydration & Sodium */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-1">
            <span>Líquidos & Sodio Necesarios</span>
            <Droplet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400 font-mono">
                {results.totalFluidsL}
              </span>
              <span className="text-xs text-stone-400 font-semibold">L agua</span>
            </div>
          </div>
          <div className="text-[11px] text-cyan-300/90 font-mono">
            {results.fluidsPerHourMl} ml/h · {results.totalSodiumMg} mg Na+
          </div>
        </div>
      </div>

      {/* Substrate Breakdown Visual Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-stone-300 font-semibold flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-stone-400" />
            Partición Metabólica de Sustratos Energéticos:
          </span>
          <div className="flex gap-4 font-mono text-[11px]">
            <span className="text-emerald-400">Grasas: {results.fatPct}% ({Math.round(results.totalKcal * results.fatPct / 100)} kcal)</span>
            <span className="text-amber-400">Glucógeno: {results.choPct}% ({Math.round(results.totalKcal * results.choPct / 100)} kcal)</span>
          </div>
        </div>
        <div className="w-full bg-stone-950 h-3 rounded-full overflow-hidden flex">
          <div 
            style={{ width: `${results.fatPct}%` }} 
            className="bg-emerald-500 h-full transition-all duration-500" 
            title={`Grasas: ${results.fatPct}%`}
          />
          <div 
            style={{ width: `${results.choPct}%` }} 
            className="bg-amber-500 h-full transition-all duration-500" 
            title={`Carbohidratos: ${results.choPct}%`}
          />
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          💡 <strong>Principio de Miguel:</strong> Cuanto más tiempo pases por debajo de tu <strong>AeT ({profile.aetHr} bpm)</strong>, 
          mayor es la fracción verde (ácidos grasos). Si compites en Transvulcania a pulso de umbral, agotarás tus ~450g de glucógeno hepático 
          y muscular en las primeras 2 horas y media.
        </p>
      </div>

      {/* Tabs Navigation: Strategy vs Timeline vs Recovery */}
      <div className="flex border-b border-stone-800 gap-4">
        <button
          onClick={() => setActiveTab('strategy')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'strategy' 
              ? 'border-amber-400 text-amber-400' 
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Estrategia de Avituallamiento & Qué Empacar</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'timeline' 
              ? 'border-amber-400 text-amber-400' 
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Cronograma Táctico Minuto a Minuto</span>
        </button>

        <button
          onClick={() => setActiveTab('recovery')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'recovery' 
              ? 'border-amber-400 text-amber-400' 
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Ventana de Recuperación Anabólica (3:1)</span>
        </button>
      </div>

      {/* Tab 1: Strategy & Gear Packing */}
      {activeTab === 'strategy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gels */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Geles de Ratio Dual (1:0.8)
                </span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-stone-100 font-mono">
                  {results.gelsCount}
                </span>
                <span className="text-xs text-stone-400 font-semibold">unidades</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                Recomendado: Geles con maltodextrina y fructosa (1:0.8). Aportan ~25g de carbohidratos de absorción 
                rápida sin sobrecargar el transportador SGLT1.
              </p>
              <div className="mt-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400">
                Consumo: 1 gel cada 25-35 minutos acompañado siempre de 2-3 sorbos de agua.
              </div>
            </div>

            {/* Solids */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Alimento Real & Sólidos
                </span>
                <Apple className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-stone-100 font-mono">
                  {results.solidPortions}
                </span>
                <span className="text-xs text-stone-400 font-semibold">porciones</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                Opciones ideales para montaña: 2 dátiles Medjool despipados, 1 plátano maduro pequeño, o barrita de avena con sal. 
                Evita la fatiga de sabor dulce en tiradas largas.
              </p>
              <div className="mt-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-emerald-400/90">
                Regla de oro: Masticar solo en zonas de subida caminando o ritmo suave sub-AeT.
              </div>
            </div>

            {/* Electrolytes and Flasks */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Bidones & Sodio
                </span>
                <Droplet className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-cyan-400 font-mono">
                  {results.sodiumPerHourMg}
                </span>
                <span className="text-xs text-stone-400 font-semibold">mg Na+/hora</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                Reparto en tus 2 soft-flasks de 500ml: 
                <strong> Flask 1:</strong> Isotónico con electrolitos e hidratos. 
                <strong> Flask 2:</strong> Agua pura para enjuague bucal y pastillas de sales.
              </p>
              <div className="mt-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-cyan-400/90">
                Total sodio a portar: {results.totalSodiumMg} mg (~{Math.ceil(results.totalSodiumMg / 250)} cápsulas de sales).
              </div>
            </div>
          </div>

          {/* Coach Miguel Advice Card */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4 sm:p-5 flex items-start gap-4">
            <Flame className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-200">
                Consejo Fisiológico de Miguel para esta sesión:
              </h4>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                {selectedChoPerHour > 65
                  ? `Estás pidiendo ${selectedChoPerHour} g/h. Para asimilar esta carga sin náuseas, tu pulso NO puede superar los ${profile.aetHr} bpm en las subidas. Si entras en zona anaeróbica, el estómago detiene la digestión por vasoconstricción y el carbohidrato fermentará en el intestino.`
                  : `Una pauta conservadora de ${selectedChoPerHour} g/h es perfecta para consolidar la base. Asegúrate de beber pequeños sorbos cada 10-15 minutos en lugar de tragar 300ml de golpe.`}
              </p>
            </div>
          </div>

          {/* Cross-linking to Calendar Workout */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                Sincronización Directa con el Calendario
              </span>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Asigna esta estrategia ({selectedChoPerHour} g/h CHO, {results.sodiumPerHourMg} mg/h Na+) a tu próxima sesión programada.
              </p>
            </div>
            <button
              onClick={handleLinkToUpcomingWorkout}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition cursor-pointer shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Vincular a Próximo Entrenamiento</span>
            </button>
          </div>

          {linkedWorkoutFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{linkedWorkoutFeedback}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Timeline Schedule */}
      {activeTab === 'timeline' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Pauta Cronometrada de Ingesta en Carrera
              </h3>
              <p className="text-xs text-stone-400">
                Sigue este protocolo para mantener el flujo constante de glucosa a los músculos sin picos de insulina
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 font-mono text-xs">
              Tomas cada {durationHours > 4 ? '30' : '20'} min
            </span>
          </div>

          <div className="space-y-3">
            {results.timeline.map((item, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 rounded-xl bg-stone-950 border border-stone-850 hover:border-stone-750 transition"
              >
                <div className="w-16 shrink-0 text-center py-1 rounded-lg bg-stone-900 border border-stone-800 font-mono font-bold text-xs text-amber-400">
                  {item.timeFormatted}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-200">
                      {item.item}
                    </span>
                    <span className="text-[11px] font-mono text-cyan-400">
                      💧 {item.hydrationSip}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Recovery Window */}
      {activeTab === 'recovery' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-5">
          <div className="border-b border-stone-800 pb-3">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Protocolo de Recuperación Anabólica Post-Entrenamiento (0 - 45 min)
            </h3>
            <p className="text-xs text-stone-400">
              La ventana donde la sintasa de glucógeno está estimulada al 300% para rellenar depósitos y reparar miofibrillas
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
              <span className="text-xs text-stone-400 block mb-1">Carbohidratos de Rápida Asimilación</span>
              <span className="text-3xl font-black text-amber-400 font-mono">{results.recoveryChoGrams} g</span>
              <span className="text-[10px] text-stone-500 block mt-1">1.1g por kg de tu peso corporal</span>
              <p className="text-[11px] text-stone-400 mt-2">
                Ejemplos: Batido con plátano y miel, arroz blanco, o bebida de recuperación específica.
              </p>
            </div>

            <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
              <span className="text-xs text-stone-400 block mb-1">Proteína de Alta Calidad</span>
              <span className="text-3xl font-black text-emerald-400 font-mono">{results.recoveryProteinGrams} g</span>
              <span className="text-[10px] text-stone-500 block mt-1">~0.32g por kg para detener catabolismo</span>
              <p className="text-[11px] text-stone-400 mt-2">
                Aislado de suero (whey), yogur griego con frutos secos, o huevos revueltos.
              </p>
            </div>

            <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
              <span className="text-xs text-stone-400 block mb-1">Ratio de Recuperación</span>
              <span className="text-3xl font-black text-cyan-400 font-mono">3.5 : 1</span>
              <span className="text-[10px] text-stone-500 block mt-1">CHO : Proteína</span>
              <p className="text-[11px] text-stone-400 mt-2">
                Acompañar con 1.5L de agua con una pizca de sal marina en las 3 horas posteriores.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2 text-xs text-stone-300">
            <div className="font-bold text-stone-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Checklist de Recuperación de Miguel:
            </div>
            <ul className="space-y-1.5 text-[11px] text-stone-400 list-disc list-inside">
              <li>Tomar el batido o refrigerio en los primeros 30 minutos tras descalzarse.</li>
              <li>Evitar grasas pesadas en esa primera ingesta (ralentizan el vaciado gástrico e impiden el pico de glucógeno).</li>
              <li>Poner las piernas en alto 10-15 min para facilitar el retorno venoso y drenaje de lactato residual.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
