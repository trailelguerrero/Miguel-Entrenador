import React, { useState } from 'react';
import { 
  Droplets, 
  Flame, 
  Activity, 
  ShieldAlert, 
  Plus, 
  Scale, 
  Thermometer, 
  Clock, 
  Mountain, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Sparkles,
  ArrowRight,
  TrendingDown,
  Trash2,
  Brain,
  Compass
} from 'lucide-react';
import { AthleteProfile, SweatRateTest, TransvulcaniaHydrationSection, WUTDailyCheck } from '../types';
import { StorageService } from '../services/storage';

interface HydrationViewProps {
  profile: AthleteProfile;
}

export const HydrationView: React.FC<HydrationViewProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'analysis' | 'wut'>('plan');

  // Hydration Tests State
  const [tests, setTests] = useState<SweatRateTest[]>(StorageService.getHydrationTests());
  const sections = StorageService.getTransvulcaniaHydrationSections();

  // Interactive Tactical Planner State
  const [simTemp, setSimTemp] = useState<number>(26); // Celsius
  const [simDurationHours, setSimDurationHours] = useState<number>(3.5); // Hours
  const [simElevationGain, setSimElevationGain] = useState<number>(1200); // meters
  const [sweatRateProfile, setSweatRateProfile] = useState<'normal' | 'heavy' | 'light'>('normal');

  // New Sweat Test Form State
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [workoutTitle, setWorkoutTitle] = useState<string>('Tirada con calor y desnivel');
  const [preWeight, setPreWeight] = useState<number>(Number(profile.weightKg) || 71.5);
  const [postWeight, setPostWeight] = useState<number>((Number(profile.weightKg) || 71.5) - 1.2);
  const [fluidsConsumed, setFluidsConsumed] = useState<number>(1400); // ml
  const [urineProduced, setUrineProduced] = useState<number>(100); // ml
  const [durationMin, setDurationMin] = useState<number>(150); // min
  const [ambientTemp, setAmbientTemp] = useState<number>(27); // C
  const [testNotes, setTestNotes] = useState<string>('');

  // Daily WUT Check State
  const [wutCheck, setWutCheck] = useState<WUTDailyCheck | null>(StorageService.getWUTCheck());
  const [selectedUrineScore, setSelectedUrineScore] = useState<number>(wutCheck?.urineColorScore || 2);
  const [weightDown, setWeightDown] = useState<boolean>(wutCheck?.weightDown || false);
  const [morningThirst, setMorningThirst] = useState<boolean>(wutCheck?.morningThirst || false);
  const [isWutSaved, setIsWutSaved] = useState<boolean>(false);

  // Dynamic Planner Calculations
  const baseSweatRate = sweatRateProfile === 'heavy' ? 1.3 : sweatRateProfile === 'light' ? 0.8 : 1.05;
  const tempFactor = simTemp > 24 ? 1 + (simTemp - 24) * 0.04 : 1 - (24 - simTemp) * 0.02;
  const calculatedHourlyRateL = Math.round(baseSweatRate * tempFactor * 100) / 100;
  const targetIntakePerHourMl = Math.round(calculatedHourlyRateL * 1000 * 0.8); // 80% rule
  const totalFluidsNeededL = Math.round((targetIntakePerHourMl * simDurationHours) / 100) / 10;
  
  // Sodium calculation based on temperature
  const hourlySodiumMg = simTemp >= 28 ? 750 : simTemp >= 22 ? 600 : 450;
  const totalSodiumMg = Math.round(hourlySodiumMg * simDurationHours);

  // Calculate live preview for the test modal
  const calcWeightLossKg = Math.max(0, preWeight - postWeight);
  const calcTotalSweatMl = Math.round(calcWeightLossKg * 1000 + fluidsConsumed - urineProduced);
  const calcTotalSweatL = Math.round((calcTotalSweatMl / 1000) * 100) / 100;
  const calcSweatRateLPerHour = durationMin > 0 ? Math.round((calcTotalSweatL / (durationMin / 60)) * 100) / 100 : 0;
  const calcWeightLossPct = preWeight > 0 ? Math.round(((calcWeightLossKg) / preWeight) * 1000) / 10 : 0;

  const handleSaveSweatTest = (e: React.FormEvent) => {
    e.preventDefault();
    
    let riskLevel: 'optimal' | 'moderate_dehydration' | 'severe_dehydration' = 'optimal';
    if (calcWeightLossPct > 2.5) {
      riskLevel = 'severe_dehydration';
    } else if (calcWeightLossPct > 1.8) {
      riskLevel = 'moderate_dehydration';
    }

    const sodiumLossMgPerHour = Math.round(calcSweatRateLPerHour * 650);
    const recFluidsMl = Math.round(calcSweatRateLPerHour * 800);

    const feedback = calcWeightLossPct <= 1.5
      ? `Excelente balance hídrico (${calcWeightLossPct}% de pérdida). Volumen plasmático y gasto cardíaco perfectamente estables.`
      : calcWeightLossPct <= 2.5
      ? `Deshidratación moderada (${calcWeightLossPct}%). Tu frecuencia cardíaca sufrió deriva de ~4-6 ppm en la última hora. Sube la ingesta a ${recFluidsMl} ml/h con ${sodiumLossMgPerHour} mg de sodio.`
      : `¡Alerta de hipohidratación severa (${calcWeightLossPct}%)! Rendimiento comprometido (>15%) y riesgo de fallo muscular excéntrico. Inicia protocolo de rehidratación inmediata al 150%.`;

    const newTest: Omit<SweatRateTest, 'id'> = {
      date: new Date().toISOString().split('T')[0],
      workoutTitle,
      preWeightKg: preWeight,
      postWeightKg: postWeight,
      fluidsConsumedMl: fluidsConsumed,
      urineMl: urineProduced,
      durationMin,
      temperatureC: ambientTemp,
      sweatLossLiters: calcTotalSweatL,
      sweatRateLitersPerHour: calcSweatRateLPerHour,
      bodyWeightLossPct: calcWeightLossPct,
      sodiumLossEstimateMgPerHour: sodiumLossMgPerHour,
      recommendedFluidsPerHourMl: recFluidsMl,
      hydrationRiskLevel: riskLevel,
      notes: testNotes.trim() || undefined,
      coachFeedback: feedback
    };

    const updated = StorageService.addHydrationTest(newTest);
    setTests(updated);
    setIsTestModalOpen(false);
  };

  const handleDeleteTest = (id: string) => {
    const updated = StorageService.deleteHydrationTest(id);
    setTests(updated);
  };

  const handleSaveWUT = () => {
    let score = 0;
    if (weightDown) score++;
    if (selectedUrineScore >= 5) score++;
    if (morningThirst) score++;

    let status: 'optimal' | 'mild_risk' | 'dehydrated' = 'optimal';
    let advice = 'Estado de hidratación óptimo (Euhidratado). Orina clara y sin sed matutina. Puedes entrenar con tu pauta habitual.';

    if (score === 1) {
      status = 'mild_risk';
      advice = 'Riesgo leve de hipohidratación. Bebe 400-500 ml de agua con una pizca de sal o electrolitos 60 min antes de la sesión.';
    } else if (score >= 2) {
      status = 'dehydrated';
      advice = 'Hipohidratación confirmada (2 o 3 factores positivos). Inicia prehidratación con 600-800 ml de electrolitos y reduce la intensidad en subidas.';
    }

    const check: WUTDailyCheck = {
      id: `wut-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      weightDown,
      urineColorScore: selectedUrineScore,
      morningThirst,
      score,
      status,
      advice
    };

    StorageService.saveWUTCheck(check);
    setWutCheck(check);
    setIsWutSaved(true);
    setTimeout(() => setIsWutSaved(false), 2000);
  };

  // Urine scale colors (Armstrong Scale 1 to 8)
  const urineScale = [
    { score: 1, color: '#F7FEE7', label: '1. Transparente', desc: 'Muy bien hidratado / Posible sobrehidratación' },
    { score: 2, color: '#FEF08A', label: '2. Amarillo Pajizo', desc: 'Euhidratado (Ideal)' },
    { score: 3, color: '#FACC15', label: '3. Amarillo Claro', desc: 'Euhidratado (Óptimo)' },
    { score: 4, color: '#EAB308', label: '4. Amarillo Ámbar', desc: 'Deshidratación Leve' },
    { score: 5, color: '#CA8A04', label: '5. Ámbar Oscuro', desc: 'Deshidratación Significativa' },
    { score: 6, color: '#A16207', label: '6. Tono Té Claro', desc: 'Deshidratación Severa' },
    { score: 7, color: '#854D0E', label: '7. Tono Cerveza', desc: 'Hipohidratación Crítica' },
    { score: 8, color: '#713F12', label: '8. Marrón Oscuro', desc: 'Peligro / Rabdomiólisis' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 via-zinc-900 to-zinc-900 border border-blue-900/40 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <Droplets className="w-4 h-4 text-blue-400 animate-pulse" />
              <span>Dirección de Hidratación & Termorregulación • Coach Miguel</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              Plan de Hidratación & Análisis de Sudor
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              En los +4.350m de Transvulcania, la deshidratación no solo causa calambres: reduce tu volumen plasmático, 
              dispara la deriva cardíaca (+6 a 10 ppm) y destruye la capacidad contráctil excéntrica en el descenso de El Time.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-3 bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800 shrink-0">
            <div className="text-center px-2">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">Tasa Media</span>
              <span className="text-sm font-black text-blue-400">1.02 L/h</span>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center px-2">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">Objetivo Na+</span>
              <span className="text-sm font-black text-emerald-400">650 mg/h</span>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center px-2">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">Regla Oro</span>
              <span className="text-sm font-black text-amber-400">80% Reposición</span>
            </div>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex space-x-2 mt-6 pt-4 border-t border-zinc-800/80">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'plan'
                ? 'bg-blue-500 text-zinc-950 shadow-lg shadow-blue-500/20'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Plan Táctico & Transvulcania</span>
          </button>

          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'analysis'
                ? 'bg-blue-500 text-zinc-950 shadow-lg shadow-blue-500/20'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Análisis de Sudor (Sweat Rate)</span>
          </button>

          <button
            onClick={() => setActiveTab('wut')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'wut'
                ? 'bg-blue-500 text-zinc-950 shadow-lg shadow-blue-500/20'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Control WUT & Color Orina</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PLAN DE HIDRATACIÓN (TACTICAL PLANNER & TRANSVULCANIA SECTIONS) */}
      {/* ========================================================================= */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          
          {/* Tactical Condition-Based Calculator */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Calculadora Predictiva</span>
                <h3 className="text-lg font-black text-zinc-100 flex items-center space-x-2">
                  <span>Planificador de Hidratación por Condiciones Climáticas</span>
                </h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                Pauta Uphill Athlete adaptada a tu fisiología
              </span>
            </div>

            {/* Input Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Temperature Slider */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400 flex items-center space-x-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Temperatura Prevista:</span>
                  </span>
                  <span className="text-amber-400 font-black text-sm">{simTemp}°C</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="35"
                  value={simTemp}
                  onChange={(e) => setSimTemp(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>12°C (Cresta fría)</span>
                  <span>24°C (Normal)</span>
                  <span>35°C (Horno Tazacorte)</span>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Duración Estimada:</span>
                  </span>
                  <span className="text-blue-400 font-black text-sm">{simDurationHours} h</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={simDurationHours}
                  onChange={(e) => setSimDurationHours(Number(e.target.value))}
                  className="w-full accent-blue-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>1h (Rodaje)</span>
                  <span>4h (Tirada)</span>
                  <span>12h (Transvulcania)</span>
                </div>
              </div>

              {/* Sweat Rate Profile Selector */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 block">Perfil de Sudoración Individual:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['light', 'normal', 'heavy'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSweatRateProfile(mode)}
                      className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                        sweatRateProfile === mode
                          ? 'bg-blue-500 text-zinc-950 border-blue-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      {mode === 'light' ? 'Baja (0.8L)' : mode === 'normal' ? 'Normal (1.1L)' : 'Alta (1.4L)'}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-zinc-500 block">Basado en tus tests de sudor guardados</span>
              </div>

            </div>

            {/* Prescribed Output Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-blue-900/40 text-center space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Ingesta Horaria</span>
                <div className="text-2xl font-black text-blue-400">{targetIntakePerHourMl} ml/h</div>
                <span className="text-[10px] text-zinc-400">Regla del 80% de absorción</span>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-emerald-900/40 text-center space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Sodio Requerido</span>
                <div className="text-2xl font-black text-emerald-400">{hourlySodiumMg} mg/h</div>
                <span className="text-[10px] text-zinc-400">Total sesión: {totalSodiumMg} mg</span>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-amber-900/40 text-center space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Volumen Total</span>
                <div className="text-2xl font-black text-amber-400">{totalFluidsNeededL} L</div>
                <span className="text-[10px] text-zinc-400">Para {simDurationHours} horas</span>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-indigo-900/40 text-center space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Esquema Bidones</span>
                <div className="text-base font-black text-indigo-300">2 Soft Flasks 500ml</div>
                <span className="text-[10px] text-zinc-400">1 Isotónico + 1 Sales neutras</span>
              </div>
            </div>

            {/* Coach Tactical Guideline Notice */}
            <div className="bg-blue-950/20 p-4 rounded-2xl border border-blue-900/50 flex items-start space-x-3 text-xs text-zinc-300">
              <Brain className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-blue-300 font-bold block">Pauta de Campo de Miguel para esta sesión:</strong>
                <p className="leading-relaxed">
                  Bebe pequeños sorbos cada 15 minutos exactos programando una alarma en tu Suunto. 
                  {simTemp >= 26 
                    ? ' Con temperatura superior a 26°C, utiliza el Flask 1 para aportar 40g de carbohidratos con 350mg de sales, y el Flask 2 exclusivamente con agua y sales disueltas para no saturar tu estómago.'
                    : ' A ritmo de base aeróbica mantendrás un vaciado gástrico regular sin distensión abdominal.'}
                </p>
              </div>
            </div>

          </div>

          {/* Transvulcania 73K Section-by-Section Hydration Plan */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Estrategia Oficial</span>
                <h3 className="text-lg font-black text-zinc-100">Plan de Hidratación por Tramos de Transvulcania 73K</h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono">6 Estaciones de Avituallamiento</span>
            </div>

            <div className="space-y-3.5">
              {sections.length === 0 && (
                <p className="text-xs text-zinc-400">
                  Sin plan de hidratación por tramos: la app no inventa cifras. Registra tests de sudoración para que Miguel pueda calcularlo con tus datos.
                </p>
              )}
              {sections.map((sec, index) => (
                <div
                  key={sec.segmentId}
                  className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-zinc-100">{sec.name}</h4>
                        <div className="flex items-center space-x-2 text-[11px] text-zinc-400 mt-0.5">
                          <span>{sec.distanceKm} km</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">+{sec.dPlusM}m D+</span>
                          <span>•</span>
                          <span className="text-blue-400 font-semibold">-{sec.dMinusM}m D-</span>
                          <span>•</span>
                          <span>Tiempo estimado: ~{sec.estimatedHours}h</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-amber-400">
                        {sec.tempRangeC}
                      </span>
                      <span className="text-[11px] font-mono bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/20 font-bold">
                        Llevar: {sec.recommendedCarryMl} ml
                      </span>
                    </div>
                  </div>

                  {/* Section Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">Condición Climática</span>
                      <strong className="text-zinc-200 text-xs">{sec.climateZone}</strong>
                    </div>

                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">Pauta Horaria</span>
                      <strong className="text-blue-400 text-xs">{sec.hourlyTargetMl} ml/h</strong>
                      <span className="text-[10px] text-emerald-400 ml-1.5 font-bold">• {sec.hourlySodiumMg} mg Na/h</span>
                    </div>

                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 block">Avituallamiento Destino</span>
                      <strong className="text-zinc-200 text-xs">{sec.aidStationName}</strong>
                    </div>
                  </div>

                  {/* Flask Setup & Coach Warning */}
                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/60 flex items-start space-x-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-[11px] text-zinc-400 block font-mono">
                        <strong className="text-zinc-200">Setup de Bidones: </strong>{sec.flaskSetup}
                      </span>
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        <strong className="text-amber-400">Aviso del Coach: </strong>{sec.coachWarning}
                      </p>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Pre-Race and Post-Race Protocols */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Protocolo de Pre-Hidratación (24h y 2h antes)</span>
              </div>
              <ul className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>24 horas antes:</strong> Ingiere 40-50 ml por kg de peso corporal distribuidos a lo largo del día. Añade sales electrolíticas en las comidas para expandir el volumen plasmático sin orinarlo de golpe.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>2 horas antes de la salida:</strong> Bebe 500 ml de agua con 500 mg de sodio a pequeños sorbos. Detén la ingesta 45 min antes para permitir vaciar la vejiga en el Faro de Fuencaliente.</span>
                </li>
              </ul>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-blue-400">
                <Droplets className="w-4 h-4 text-blue-400" />
                <span>Protocolo de Rehidratación Post-Carrera</span>
              </div>
              <ul className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold">•</span>
                  <span><strong>Reponer al 150%:</strong> Por cada kilogramo de peso perdido al cruzar la meta en Los Llanos, bebe 1.5 litros de líquidos en las siguientes 3 a 4 horas.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold">•</span>
                  <span><strong>Sodio y Proteína:</strong> Beber agua pura sola desencadena diuresis refleja. Combina el líquido con caldo salado, bebida recuperadora con ratio 4:1 carbohidrato/proteína y alimentos salados.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ANÁLISIS DE SUDOR (SWEAT RATE TEST & HISTORICAL LOGS) */}
      {/* ========================================================================= */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          
          {/* Action Header for Tests */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Test de Laboratorio de Campo</span>
              <h3 className="text-xl font-black text-zinc-100">Análisis Científico de Tasa de Sudoración</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Calcula tu tasa de sudoración exacta en L/h, porcentaje de pérdida de peso por deshidratación y miligramos de sodio eliminados.
              </p>
            </div>

            <button
              onClick={() => setIsTestModalOpen(true)}
              className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-bold text-xs shadow-lg shadow-blue-500/20 transition hover:scale-102 active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Test de Sudor</span>
            </button>
          </div>

          {/* Tests Historical Grid */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-300">Historial de Tests de Sudoración Guardados</h4>

            {tests.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center space-y-3">
                <Droplets className="w-12 h-12 text-zinc-600 mx-auto" />
                <h5 className="text-sm font-bold text-zinc-300">Aún no has registrado tests de sudoración</h5>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Pésate antes y después de tu próxima tirada larga para que Miguel calcule tu tasa individual de reposición de líquidos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tests.map((t) => {
                  const isOptimal = t.hydrationRiskLevel === 'optimal';
                  const isSevere = t.hydrationRiskLevel === 'severe_dehydration';

                  return (
                    <div
                      key={t.id}
                      className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-lg hover:border-zinc-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isOptimal 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : isSevere
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {isOptimal ? 'Balance Óptimo' : isSevere ? 'Hipohidratación Severa' : 'Deshidratación Moderada'}
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">{t.date}</span>
                          </div>
                          <h4 className="text-sm font-black text-zinc-100 mt-1">{t.workoutTitle}</h4>
                        </div>

                        <button
                          onClick={() => handleDeleteTest(t.id)}
                          className="text-zinc-600 hover:text-red-400 p-1 rounded-lg transition"
                          title="Eliminar este test"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Key Computed Metrics */}
                      <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-center">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Tasa de Sudor</span>
                          <span className="text-sm font-black text-blue-400">{t.sweatRateLitersPerHour} L/h</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Pérdida de Peso</span>
                          <span className={`text-sm font-black ${
                            isOptimal ? 'text-emerald-400' : isSevere ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {t.bodyWeightLossPct}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Sodio Estimado</span>
                          <span className="text-sm font-black text-zinc-200">{t.sodiumLossEstimateMgPerHour} mg/h</span>
                        </div>
                      </div>

                      {/* Test Context Details */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
                        <span>Peso: {t.preWeightKg}kg ➔ {t.postWeightKg}kg</span>
                        <span>Bebido: {t.fluidsConsumedMl}ml</span>
                        <span>Temp: {t.temperatureC}°C</span>
                        <span>{t.durationMin} min</span>
                      </div>

                      {/* Coach Miguel Assessment */}
                      {t.coachFeedback && (
                        <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 flex items-start space-x-2 text-xs">
                          <Brain className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-zinc-300 leading-relaxed">{t.coachFeedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONTROL WUT & COLOR DE ORINA (DAILY HYDRATION CHECK) */}
      {/* ========================================================================= */}
      {activeTab === 'wut' && (
        <div className="space-y-6">
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Regla Clínica de Medicina Deportiva</span>
                <h3 className="text-xl font-black text-zinc-100">Control Matutino WUT (Weight - Urine - Thirst)</h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                Chequeo previo al entrenamiento
              </span>
            </div>

            {/* Armstrong Urine Scale Picker */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-200 block">
                1. Selecciona el Color de tu Primera Orina de la Mañana (Escala de Armstrong 1 a 8):
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                {urineScale.map((item) => (
                  <button
                    key={item.score}
                    type="button"
                    onClick={() => setSelectedUrineScore(item.score)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between space-y-2 ${
                      selectedUrineScore === item.score
                        ? 'border-blue-400 ring-2 ring-blue-500/50 bg-zinc-800'
                        : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-850'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full border border-black/40 shadow-inner"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-bold text-zinc-200 block">{item.label}</span>
                    <span className="text-[9px] text-zinc-400 block leading-tight">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Questions: Weight drop & Thirst */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div 
                onClick={() => setWeightDown(!weightDown)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                  weightDown ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="space-y-1">
                  <strong className="text-xs block text-zinc-200">2. ¿Tu peso hoy es &gt; 1% más bajo de lo habitual?</strong>
                  <span className="text-[11px] text-zinc-400 block">Indica posible pérdida de agua intracelular en lugar de grasa.</span>
                </div>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  weightDown ? 'bg-amber-500 text-zinc-950 border-amber-400' : 'border-zinc-700'
                }`}>
                  {weightDown && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </div>

              <div 
                onClick={() => setMorningThirst(!morningThirst)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                  morningThirst ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="space-y-1">
                  <strong className="text-xs block text-zinc-200">3. ¿Sientes sequedad de boca o sed al despertar?</strong>
                  <span className="text-[11px] text-zinc-400 block">La sed matutina activa el centro osmolar hipotalámico.</span>
                </div>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  morningThirst ? 'bg-amber-500 text-zinc-950 border-amber-400' : 'border-zinc-700'
                }`}>
                  {morningThirst && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </div>
            </div>

            {/* Diagnosis Result Banner */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Diagnóstico Clínico Actual</span>
                {!wutCheck ? (
                  <p className="text-xs text-zinc-400">Aún no has registrado ningún chequeo WUT.</p>
                ) : (<>
                <div className="flex items-center space-x-2">
                  <span className={`text-base font-black ${
                    wutCheck.status === 'optimal' ? 'text-emerald-400' : wutCheck.status === 'mild_risk' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {wutCheck.status === 'optimal' ? '✓ Euhidratado (Listo)' : wutCheck.status === 'mild_risk' ? '⚠ Riesgo Leve de Hipohidratación' : '⛔ Hipohidratación Confirmada'}
                  </span>
                  <span className="text-xs text-zinc-400">({wutCheck.score}/3 criterios presentes)</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed max-w-xl">{wutCheck.advice}</p>
                </>)}
              </div>

              <button
                onClick={handleSaveWUT}
                className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-bold text-xs shadow-lg shadow-blue-500/20 transition shrink-0"
              >
                {isWutSaved ? '¡Guardado!' : 'Guardar Chequeo WUT'}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR NUEVO TEST DE SUDOR (SWEAT RATE TEST MODAL) */}
      {/* ========================================================================= */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-100">Nuevo Test de Tasa de Sudoración</h3>
                  <p className="text-[11px] text-zinc-400">Cálculo de pérdida neta de fluidos</p>
                </div>
              </div>

              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSweatTest} className="space-y-4 text-xs">
              
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Título de la Sesión</label>
                <input
                  type="text"
                  required
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200"
                />
              </div>

              {/* Weights: Pre vs Post */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Peso Antes (kg) *</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={preWeight}
                    onChange={(e) => setPreWeight(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-amber-400 font-black"
                  />
                  <span className="text-[10px] text-zinc-500">En ayunas y descalzo</span>
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Peso Después (kg) *</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={postWeight}
                    onChange={(e) => setPostWeight(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-blue-400 font-black"
                  />
                  <span className="text-[10px] text-zinc-500">Secando el sudor</span>
                </div>
              </div>

              {/* Fluids & Urine */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Líquido Bebido (ml)</label>
                  <input
                    type="number"
                    step="50"
                    value={fluidsConsumed}
                    onChange={(e) => setFluidsConsumed(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Orina Producida (ml)</label>
                  <input
                    type="number"
                    step="50"
                    value={urineProduced}
                    onChange={(e) => setUrineProduced(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 font-semibold"
                  />
                </div>
              </div>

              {/* Duration & Temperature */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Duración (minutos)</label>
                  <input
                    type="number"
                    step="5"
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Temperatura (°C)</label>
                  <input
                    type="number"
                    step="1"
                    value={ambientTemp}
                    onChange={(e) => setAmbientTemp(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 font-semibold"
                  />
                </div>
              </div>

              {/* Real-time Computed Preview */}
              <div className="bg-zinc-950 p-3.5 rounded-2xl border border-blue-900/40 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Tasa Calculada</span>
                  <strong className="text-sm text-blue-400 font-black">{calcSweatRateLPerHour} L/h</strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Pérdida Peso</span>
                  <strong className={`text-sm font-black ${
                    calcWeightLossPct <= 1.5 ? 'text-emerald-400' : calcWeightLossPct <= 2.5 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {calcWeightLossPct}%
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Sudor Total</span>
                  <strong className="text-sm text-zinc-200 font-black">{calcTotalSweatL} L</strong>
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Notas y Sensaciones</label>
                <textarea
                  rows={2}
                  placeholder="Sensación de sed, sales utilizadas, temperatura en bajadas..."
                  value={testNotes}
                  onChange={(e) => setTestNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-bold shadow-lg shadow-blue-500/20 transition"
                >
                  Guardar Test de Sudor
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
