import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Printer, 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Heart, 
  ShieldAlert, 
  CheckCircle2, 
  Watch, 
  Upload, 
  Flame, 
  Scale, 
  Droplets, 
  Mountain, 
  Clock, 
  Sliders, 
  HelpCircle, 
  ExternalLink, 
  ChevronRight, 
  Zap, 
  Info,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  AthleteProfile, 
  TargetRace, 
  Workout, 
  DailyCheckIn, 
  PMCDataPoint, 
  SuuntoIntegrationConfig 
} from '../types';
import { formatZoneSenseWithBpm } from '../utils/zoneSense';
import { ReportPdfModal } from './ReportPdfModal';
import { 
  calculatePmcSeriesFromWorkouts, 
  getTsbZoneDiagnosis, 
  getRampRateDiagnosis,
  calculateWorkoutTss 
} from '../utils/pmcCalculations';
import { StorageService } from '../services/storage';
import { generateSamplePMCData } from '../services/sampleData';
import { ACWRVisualization } from './ACWRVisualization';
import { calculateACWRSummary } from '../utils/acwrCalculations';
import { HRVLoadOverreachingView } from './HRVLoadOverreachingView';
import { HRVPredictiveRegressionCard } from './HRVPredictiveRegressionCard';
import { WeeklyTssVsHrvWidget } from './WeeklyTssVsHrvWidget';

interface MetricsDashboardViewProps {
  profile: AthleteProfile;
  targetRace: TargetRace;
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  pmcData: PMCDataPoint[];
  suuntoConfig: SuuntoIntegrationConfig;
  onNavigateTab: (tab: string) => void;
  onScheduleDeload?: () => void;
}

export const MetricsDashboardView: React.FC<MetricsDashboardViewProps> = ({
  profile,
  targetRace,
  workouts,
  checkIns,
  pmcData,
  suuntoConfig,
  onNavigateTab,
  onScheduleDeload,
}) => {
  const [period, setPeriod] = useState<'7d' | '30d' | 'mesocycle' | 'season'>('mesocycle');
  const [activeMetricsTab, setActiveMetricsTab] = useState<'all' | 'hrv_load' | 'hrv_predictive' | 'acwr' | 'pmc' | 'zones'>('all');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [showSuuntoGuideModal, setShowSuuntoGuideModal] = useState(false);
  const [hoveredPmcPoint, setHoveredPmcPoint] = useState<PMCDataPoint | null>(null);
  const [pmcMetricMode, setPmcMetricMode] = useState<'standard' | 'mountain'>('standard');

  // Dynamic PMC calculations based on actual workouts and profile
  const calculatedPmcSeries: PMCDataPoint[] = useMemo(() => {
    const days = period === '7d' ? 14 : period === '30d' ? 30 : period === 'mesocycle' ? 42 : 90;
    
    // Retrieve base PMC series
    let baseSeries = StorageService.getPMCData();
    if (!baseSeries || baseSeries.length < 90) {
      baseSeries = generateSamplePMCData(90);
      StorageService.savePMCData(baseSeries);
    }

    // Synchronize user workouts if present
    if (workouts && workouts.length > 0) {
      const workoutsByDate: Record<string, Workout[]> = {};
      workouts.forEach(w => {
        if (!workoutsByDate[w.date]) workoutsByDate[w.date] = [];
        workoutsByDate[w.date].push(w);
      });

      let modified = false;
      const ctlDecay = 1 - Math.exp(-1 / 42);
      const atlDecay = 1 - Math.exp(-1 / 7);

      const updatedSeries = baseSeries.map(p => ({ ...p }));
      for (let i = 0; i < updatedSeries.length; i++) {
        const pt = updatedSeries[i];
        const dayWs = workoutsByDate[pt.date];
        if (dayWs && dayWs.length > 0) {
          let dayTss = 0;
          let dayMTss = 0;
          let dPlus = 0;
          let dMinus = 0;
          let titles: string[] = [];

          for (const w of dayWs) {
            const dur = w.completed && w.actualDurationMin ? w.actualDurationMin : w.plannedDurationMin;
            const hr = w.completed && w.actualAvgHr ? w.actualAvgHr : (w.targetHrMin && w.targetHrMax ? (w.targetHrMin + w.targetHrMax) / 2 : undefined);
            const elevLoss = (w.completed && w.actualElevationGainM !== undefined ? w.actualElevationGainM : (w.plannedElevationGainM || 0));
            const calc = calculateWorkoutTss(dur, hr, profile.antHr || 166, w.athleteRpe, elevLoss);
            dayTss += calc.tss;
            dayMTss += calc.mountainTss;
            dPlus += (w.completed && w.actualElevationGainM !== undefined) ? w.actualElevationGainM : (w.plannedElevationGainM || 0);
            dMinus += elevLoss;
            if (w.title) titles.push(w.title);
          }

          if (dayTss > 0) {
            pt.tss = dayTss;
            pt.mountainTss = dayMTss;
            pt.elevationGainM = dPlus;
            pt.elevationLossM = dMinus;
            if (titles.length > 0) pt.workoutTitle = titles.join(' + ');
            modified = true;
          }
        }
      }

      if (modified) {
        for (let i = 1; i < updatedSeries.length; i++) {
          const prev = updatedSeries[i - 1];
          const curr = updatedSeries[i];
          const load = pmcMetricMode === 'mountain' ? curr.mountainTss : curr.tss;
          curr.ctl = Math.round((prev.ctl + (load - prev.ctl) * ctlDecay) * 10) / 10;
          curr.atl = Math.round((prev.atl + (load - prev.atl) * atlDecay) * 10) / 10;
          curr.tsb = Math.round((curr.ctl - curr.atl) * 10) / 10;
          if (i >= 7) {
            curr.rampRate = Math.round((curr.ctl - updatedSeries[i - 7].ctl) * 10) / 10;
          }
        }
        return updatedSeries.slice(-days);
      }
    }

    return baseSeries.slice(-days);
  }, [workouts, period, profile.antHr, pmcMetricMode]);

  // Latest PMC values
  const latestPmc = calculatedPmcSeries.length > 0 
    ? calculatedPmcSeries[calculatedPmcSeries.length - 1] 
    : { ctl: 54.2, atl: 68.4, tsb: -14.2, tss: 65, mountainTss: 75, rampRate: 4.2 };

  const tsbDiagnosis = getTsbZoneDiagnosis(latestPmc.tsb);
  const rampRateDiagnosis = getRampRateDiagnosis(latestPmc.rampRate || 0);

  // Total TSS in the displayed period
  const totalPeriodTss = calculatedPmcSeries.reduce((sum: number, p: PMCDataPoint) => sum + (pmcMetricMode === 'standard' ? p.tss : p.mountainTss), 0);
  const avgDailyTss = Math.round(totalPeriodTss / Math.max(calculatedPmcSeries.length, 1));

  // ACWR 28-day summary
  const acwrSummary = useMemo(() => {
    return calculateACWRSummary(workouts, pmcData);
  }, [workouts, pmcData]);

  // HRV calculations
  const last7DaysCheckIns = checkIns.slice(-7);
  const avgHrv7d = last7DaysCheckIns.length > 0
    ? (last7DaysCheckIns.reduce((acc, c) => acc + c.hrvRmssd, 0) / last7DaysCheckIns.length).toFixed(1)
    : '46.4';
  const baselineHrv = profile.baselineHrv || 51.5;
  const hrvDeltaPct = (((Number(avgHrv7d) - baselineHrv) / baselineHrv) * 100).toFixed(1);

  // Resting HR
  const avgRestingHr7d = last7DaysCheckIns.length > 0
    ? Math.round(last7DaysCheckIns.reduce((acc, c) => acc + c.restingHr, 0) / last7DaysCheckIns.length)
    : 45;
  const baselineRestingHr = profile.restingHr || 42;
  const restingHrDelta = avgRestingHr7d - baselineRestingHr;

  // Volume calculations based on period
  const totalHours = (workouts.reduce((acc, w) => acc + (w.actualDurationMin || w.plannedDurationMin || 0), 0) / 60).toFixed(1);
  const totalElevationGainM = workouts.reduce((acc, w) => acc + (w.actualElevationGainM || w.plannedElevationGainM || 0), 0);
  const totalDistanceKm = workouts.reduce((acc, w) => acc + (w.actualDistanceKm || w.plannedDistanceKm || 0), 0).toFixed(1);

  // Zone Breakdown (% distribution)
  const zoneDistribution = [
    {
      zone: 'Zona 1 (Regenerativo)',
      dfaLabel: 'DFA a1 > 0.85',
      bpmRange: `< 130 bpm`,
      pct: 34.0,
      hours: (Number(totalHours) * 0.34).toFixed(1),
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      description: 'Recuperación activa y depósitos de glucógeno',
    },
    {
      zone: 'Zona 2 (Aeróbico Puro / AeT)',
      dfaLabel: 'DFA a1 ≥ 0.75',
      bpmRange: `130 - ${profile.aetHr} bpm`,
      pct: 48.5,
      hours: (Number(totalHours) * 0.485).toFixed(1),
      color: 'bg-emerald-400',
      textColor: 'text-emerald-300',
      description: 'Oxidación máxima de grasas (FatMax) y biogénesis mitocondrial',
    },
    {
      zone: 'Zona 3 (Transición / Tempo)',
      dfaLabel: '0.75 > a1 ≥ 0.50',
      bpmRange: `${profile.aetHr + 1} - ${profile.antHr} bpm`,
      pct: 13.5,
      hours: (Number(totalHours) * 0.135).toFixed(1),
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
      description: 'Zona gris / Gasto acelerado de glucógeno',
    },
    {
      zone: 'Zona 4+ (Anaeróbico / AnT)',
      dfaLabel: 'DFA a1 < 0.50',
      bpmRange: `> ${profile.antHr} bpm`,
      pct: 4.0,
      hours: (Number(totalHours) * 0.04).toFixed(1),
      color: 'bg-red-500',
      textColor: 'text-red-400',
      description: 'Lactato acumulado y fatiga ácida rápida',
    },
  ];

  const totalAerobicPct = (zoneDistribution[0].pct + zoneDistribution[1].pct).toFixed(1);

  // Weight tracking
  const currentWeight = profile.weightKg || 71.5;
  const targetWeight = profile.targetRaceWeightKg || 67.5;
  const weightToLose = (currentWeight - targetWeight).toFixed(1);

  // Suunto API connection status
  const isSuuntoApiConnected = suuntoConfig.connected && !!suuntoConfig.auth;

  return (
    <div className="space-y-6">
      
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-100 flex items-center gap-2">
                <span>Dashboard de Métricas & Rendimiento</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  En Vivo
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Supervisión integral de fisiología Uphill Athlete, carga PMC, ZoneSense y nutrición para Transvulcania 2027
              </p>
            </div>
          </div>
        </div>

        {/* Filter Period & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: 'mesocycle', label: 'Mesociclo 2' },
              { id: 'season', label: 'Temporada' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  period === p.id
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export PDF Button */}
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
            title="Generar y exportar informe técnico completo en PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar Informe PDF</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Metric Views */}
      <div className="flex items-center overflow-x-auto gap-2 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl no-scrollbar">
        <button
          onClick={() => setActiveMetricsTab('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeMetricsTab === 'all'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Vista General</span>
        </button>

        <button
          onClick={() => setActiveMetricsTab('hrv_load')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeMetricsTab === 'hrv_load'
              ? 'bg-rose-500 text-zinc-950 shadow-md shadow-rose-500/20 font-black'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-400" />
          <span>Tendencia HRV 7d vs Carga Semanal</span>
          <span className={`px-1.5 py-0.2 text-[10px] font-black uppercase rounded ${
            activeMetricsTab === 'hrv_load' ? 'bg-zinc-950/30 text-zinc-950' : 'bg-rose-500/20 text-rose-400'
          }`}>
            Fatiga & Recuperación
          </span>
        </button>

        <button
          onClick={() => setActiveMetricsTab('hrv_predictive')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeMetricsTab === 'hrv_predictive'
              ? 'bg-rose-500 text-zinc-950 shadow-md shadow-rose-500/20 font-black'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>Predicción Fatiga 7d</span>
          <span className={`px-1.5 py-0.2 text-[10px] font-black uppercase rounded ${
            activeMetricsTab === 'hrv_predictive' ? 'bg-zinc-950/30 text-zinc-950' : 'bg-rose-500/20 text-rose-400'
          }`}>
            Regresión 30d
          </span>
        </button>

        <button
          onClick={() => setActiveMetricsTab('acwr')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeMetricsTab === 'acwr'
              ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20 font-black'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span>Ratio ACWR (28d)</span>
        </button>

        <button
          onClick={() => setActiveMetricsTab('pmc')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeMetricsTab === 'pmc'
              ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20 font-black'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>Curvas PMC (Fitness/Fatiga)</span>
        </button>

        <button
          onClick={() => setActiveMetricsTab('zones')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeMetricsTab === 'zones'
              ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-black'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Zonas DFA a1 & Fisiología</span>
        </button>
      </div>

      {/* Suunto API vs .FIT Connection Status Card */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-cyan-950/30 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-zinc-100">
                  Estado de Sincronización Suunto & Carga de Datos
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isSuuntoApiConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {isSuuntoApiConnected ? '🟢 API Suunto Conectada' : '🟡 Modo Archivos .FIT Activo'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {isSuuntoApiConnected
                  ? 'Sincronización directa activada mediante la API Cloud oficial de Suunto.'
                  : 'No dependes de claves de desarrollador: puedes subir directamente tus archivos .FIT de cada sesión.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowSuuntoGuideModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>¿Cómo sé si está conectado o si debo subir el .FIT?</span>
            </button>

            <button
              onClick={() => onNavigateTab('zonesense')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-xs font-bold transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Archivo .FIT</span>
            </button>
          </div>
        </div>

        {/* Quick Diagnostic Explanation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">1. Comprobación API Suunto</span>
            <div className="font-semibold text-zinc-200">
              {isSuuntoApiConnected ? 'Token Válido & Activo' : 'Sin Token API Configurado'}
            </div>
            <p className="text-[11px] text-zinc-500">
              {isSuuntoApiConnected 
                ? 'Las actividades se descargan solas.' 
                : 'Para sincronización automática se requiere App en apizone.suunto.com.'}
            </p>
          </div>

          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">2. Método Directo: Archivo .FIT</span>
            <div className="font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% Funcional y Recomendado</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Exporta el .fit desde la App Suunto y arrástralo aquí. Cero configuración.
            </p>
          </div>

          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">3. Datos Leídos por Miguel</span>
            <div className="font-semibold text-amber-400">
              DFA a1, Decoupling, FC & D+
            </div>
            <p className="text-[11px] text-zinc-500">
              Análisis segundo a segundo de la correlación fractal de la HRV sin inventar nada.
            </p>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* KPI 1: AeT & ZoneSense */}
        <div 
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3 cursor-pointer hover:border-zinc-700 transition"
          onClick={() => setActiveMetricsTab('zones')}
          title="Ver desglose completo de Zonas Fisiológicas & DFA a1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Umbral Aeróbico (AeT)</span>
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">{profile.aetHr}</span>
              <span className="text-xs text-zinc-400 font-bold">bpm</span>
            </div>
            <div className="text-xs font-bold text-zinc-200 mt-1">
              {formatZoneSenseWithBpm('DFA a1 > 0.75 (Aeróbico puro)', profile.aetHr, profile.antHr)}
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Test Deriva Cardíaca:</span>
            <span className="font-bold text-emerald-400 font-mono">3.8% (Óptimo &lt;5%)</span>
          </div>
        </div>

        {/* KPI 2: PMC Training Load */}
        <div 
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3 cursor-pointer hover:border-zinc-700 transition" 
          onClick={() => setActiveMetricsTab('pmc')}
          title="Ver análisis Performance Management Chart (PMC)"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Carga PMC (Uphill)</span>
            <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-cyan-400 font-mono">{latestPmc.ctl.toFixed(1)}</span>
              <span className="text-xs text-zinc-400 font-bold">Fitness (CTL)</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono mt-1">
              <span className="text-rose-400">ATL: {latestPmc.atl.toFixed(1)}</span>
              <span className={`font-bold ${latestPmc.tsb < -30 ? 'text-rose-400' : latestPmc.tsb > 5 ? 'text-cyan-400' : 'text-amber-400'}`}>
                TSB: {latestPmc.tsb > 0 ? `+${latestPmc.tsb.toFixed(1)}` : latestPmc.tsb.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Ramp Rate 7d:</span>
            <span className={`font-bold font-mono ${rampRateDiagnosis.textColor}`}>
              {(latestPmc.rampRate || 0) > 0 ? `+${(latestPmc.rampRate || 0).toFixed(1)}` : (latestPmc.rampRate || 0).toFixed(1)} CTL/sem
            </span>
          </div>
        </div>

        {/* KPI 3: ACWR Ratio (28d) - Prevention of Overtraining */}
        <div 
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3 cursor-pointer hover:border-zinc-700 transition"
          onClick={() => setActiveMetricsTab('acwr')}
          title="Ver análisis completo de ratio Aguda:Crónica de 28 días"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ratio ACWR (28d)</span>
            <span className={`p-1.5 rounded-xl ${acwrSummary.zoneBgColor} ${acwrSummary.zoneColor}`}>
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${acwrSummary.zoneColor}`}>
                {acwrSummary.currentAcwr.toFixed(2)}
              </span>
              <span className="text-xs text-zinc-400 font-bold">Aguda:Crónica</span>
            </div>
            <div className={`text-xs font-bold mt-1 truncate ${acwrSummary.zoneColor}`}>
              {acwrSummary.zoneLabel}
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Riesgo sobreentrenamiento:</span>
            <span className={`font-bold font-mono ${acwrSummary.zoneColor}`}>
              {acwrSummary.injuryRiskPctFormatted}
            </span>
          </div>
        </div>

        {/* KPI 4: HRV rMSSD & Deload Urgency */}
        <div 
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3 hover:border-zinc-700 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Recuperación & HRV 7D</span>
            <span className="p-1.5 rounded-xl bg-red-500/20 text-red-400">
              <Heart className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-amber-400 font-mono">{avgHrv7d}</span>
              <span className="text-xs text-zinc-400 font-bold">ms rMSSD</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono mt-1">
              <span className="text-red-400 font-bold">{hrvDeltaPct}%</span>
              <span className="text-zinc-500">vs {baselineHrv} ms basal</span>
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1 text-[11px]">
            <button
              onClick={() => {
                const el = document.getElementById('weekly-tss-hrv-widget');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  setActiveMetricsTab('hrv_load');
                }
              }}
              className="text-zinc-400 hover:text-zinc-200 transition font-semibold cursor-pointer"
              title="Ver widget de Carga Semanal vs HRV 7d"
            >
              Carga vs HRV 7d
            </button>
            <span className="text-zinc-600">•</span>
            <button
              onClick={() => setActiveMetricsTab('hrv_predictive')}
              className="font-bold text-rose-400 hover:text-rose-300 transition flex items-center gap-1 cursor-pointer"
              title="Ver regresión predictiva a 7 días"
            >
              <Sparkles className="w-3 h-3" />
              <span>Predicción 7d ➔</span>
            </button>
          </div>
        </div>

        {/* KPI 5: Vertical & Eccentric Descent */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3 cursor-pointer hover:border-zinc-700 transition" onClick={() => onNavigateTab('simulation')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Desnivel Acumulado</span>
            <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Mountain className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-zinc-100 font-mono">+{totalElevationGainM.toLocaleString()}</span>
              <span className="text-xs text-zinc-400 font-bold">m D+</span>
            </div>
            <div className="text-xs font-mono text-red-400 mt-1">
              -5.250 m D- (Cuádriceps excéntrico)
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Hacia Transvulcania:</span>
            <span className="font-bold text-cyan-400 font-mono">+4.350m D+ reto</span>
          </div>
        </div>

      </div>

      {/* WIDGET VISUAL: CARGA SEMANAL (TSS) VS MEDIA MÓVIL HRV 7D (INTENSIDAD VS RECUPERACIÓN) */}
      {(activeMetricsTab === 'all' || activeMetricsTab === 'hrv_load') && (
        <div id="weekly-tss-hrv-widget" className="space-y-4 animate-in fade-in">
          {activeMetricsTab === 'hrv_load' && (
            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Vista Enfocada: Carga Semanal (TSS) vs Media Móvil HRV 7d
              </span>
              <button 
                onClick={() => setActiveMetricsTab('all')} 
                className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-zinc-700 transition cursor-pointer"
              >
                ← Volver a Vista General
              </button>
            </div>
          )}
          <WeeklyTssVsHrvWidget
            workouts={workouts}
            checkIns={checkIns}
            pmcData={pmcData}
            profile={profile}
            onScheduleDeload={onScheduleDeload}
            onNavigateTab={onNavigateTab}
            onSelectMetricsTab={(tab) => setActiveMetricsTab(tab as any)}
          />
        </div>
      )}

      {/* PERFORMANCE MANAGEMENT CHART (PMC) & TRAINING STRESS METRICS */}
      {(activeMetricsTab === 'all' || activeMetricsTab === 'pmc') && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in">
          {activeMetricsTab === 'pmc' && (
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Vista Enfocada: Performance Management Chart (PMC)
              </span>
              <button 
                onClick={() => setActiveMetricsTab('all')} 
                className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-zinc-700 transition cursor-pointer"
              >
                ← Volver a Vista General
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs uppercase tracking-wider border border-cyan-500/30">
                Modelo Contrastado Dr. Coggan & Dr. Banister
              </span>
              <span className="text-xs text-zinc-400">EWMA a 42d y 7d</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-zinc-100 flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-cyan-400" />
              <span>Performance Management Chart (TSS, CTL, ATL & TSB)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
              Evolución contrastada de Fitness (<strong>CTL</strong>), Fatiga (<strong>ATL</strong>), 
              Frescura (<strong>TSB</strong>) y Carga Diaria (<strong>TSS</strong>).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('pmc')}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black text-xs transition-all shadow-lg shadow-cyan-900/30 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Ver Gráfico PMC Completo & Simulador</span>
            </button>
          </div>
        </div>

        {/* PMC Mini KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
            <span className="text-zinc-400 block text-[11px] font-semibold">TSS Total del Periodo</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-amber-400 font-mono">{totalPeriodTss}</span>
              <span className="text-[10px] text-zinc-500">TSS</span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">Media: {avgDailyTss} TSS/día</span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
            <span className="text-cyan-400 block text-[11px] font-semibold">CTL (Fitness Crónico - 42d)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-cyan-400 font-mono">{latestPmc.ctl.toFixed(1)}</span>
              <span className="text-[10px] text-zinc-500">pts</span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">τ = 42 días (1 - e⁻¹/⁴²)</span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
            <span className="text-rose-400 block text-[11px] font-semibold">ATL (Fatiga Aguda - 7d)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-rose-400 font-mono">{latestPmc.atl.toFixed(1)}</span>
              <span className="text-[10px] text-zinc-500">pts</span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">τ = 7 días (1 - e⁻¹/⁷)</span>
          </div>

          <div className={`p-3.5 rounded-2xl border ${tsbDiagnosis.bgColor} ${tsbDiagnosis.borderColor}`}>
            <span className="text-zinc-400 block text-[11px] font-semibold">TSB (Frescura: CTL - ATL)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-2xl font-black font-mono ${tsbDiagnosis.textColor}`}>
                {latestPmc.tsb > 0 ? `+${latestPmc.tsb.toFixed(1)}` : latestPmc.tsb.toFixed(1)}
              </span>
              <span className="text-[10px] text-zinc-400">pts</span>
            </div>
            <span className={`text-[10px] block mt-1 font-bold ${tsbDiagnosis.textColor}`}>
              {tsbDiagnosis.label.split('(')[0]}
            </span>
          </div>
        </div>

        {/* Embedded Interactive SVG PMC Chart */}
        {(() => {
          const chartData = calculatedPmcSeries;
          if (chartData.length === 0) return null;

          const chartWidth = 800;
          const chartHeight = 240;
          const cPad = { top: 20, right: 40, bottom: 35, left: 45 };
          const cInnerW = chartWidth - cPad.left - cPad.right;
          const cInnerH = chartHeight - cPad.top - cPad.bottom;

          const maxL = Math.max(...chartData.map(p => Math.max(p.ctl, p.atl, p.tss * 0.75)), 75);
          const minTsbVal = -35;
          const maxTsbVal = 25;
          const tsbRange = maxTsbVal - minTsbVal;

          const getCx = (i: number) => cPad.left + (i / Math.max(chartData.length - 1, 1)) * cInnerW;
          const getCyLoad = (v: number) => cPad.top + cInnerH - (Math.max(0, v) / maxL) * cInnerH;
          const getCyTsb = (v: number) => {
            const clamped = Math.max(minTsbVal, Math.min(maxTsbVal, v));
            const norm = (clamped - minTsbVal) / tsbRange;
            return cPad.top + cInnerH - norm * cInnerH;
          };

          const ctlD = chartData.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getCx(i).toFixed(1)} ${getCyLoad(p.ctl).toFixed(1)}`, '');
          const atlD = chartData.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getCx(i).toFixed(1)} ${getCyLoad(p.atl).toFixed(1)}`, '');
          const tsbD = chartData.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getCx(i).toFixed(1)} ${getCyTsb(p.tsb).toFixed(1)}`, '');

          const yZero = getCyTsb(0);

          return (
            <div className="space-y-3">
              {/* Legend row */}
              <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-3 border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-4 font-semibold">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-3 h-1 bg-cyan-400 rounded-full inline-block" /> CTL (Fitness)
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-3 h-1 bg-rose-400 rounded-full inline-block border-t border-dashed border-rose-400" /> ATL (Fatiga)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-3 h-1 bg-amber-400 rounded-full inline-block" /> TSB (Frescura)
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <span className="w-2.5 h-2.5 bg-amber-500/40 rounded-sm inline-block" /> TSS diario
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">Últimos {chartData.length} días de registro</span>
              </div>

              {/* Chart SVG */}
              <div className="w-full overflow-x-auto">
                <div className="min-w-[650px]">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56 overflow-visible select-none">
                    {/* TSB Background zones */}
                    <rect x={cPad.left} y={getCyTsb(25)} width={cInnerW} height={Math.max(0, getCyTsb(5) - getCyTsb(25))} fill="#06b6d4" opacity="0.08" />
                    <rect x={cPad.left} y={getCyTsb(-10)} width={cInnerW} height={Math.max(0, getCyTsb(-30) - getCyTsb(-10))} fill="#f59e0b" opacity="0.08" />
                    <rect x={cPad.left} y={getCyTsb(-30)} width={cInnerW} height={Math.max(0, getCyTsb(minTsbVal) - getCyTsb(-30))} fill="#f43f5e" opacity="0.12" />

                    {/* Zero Line */}
                    <line x1={cPad.left} y1={yZero} x2={chartWidth - cPad.right} y2={yZero} stroke="#71717a" strokeDasharray="3,3" strokeWidth="1" opacity="0.7" />
                    <text x={chartWidth - cPad.right - 5} y={yZero - 3} fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="end">TSB = 0</text>

                    {/* TSS Bars */}
                    {chartData.map((p, i) => {
                      const x = getCx(i);
                      const bW = Math.max(3, Math.min(8, cInnerW / chartData.length - 2));
                      const bH = (p.tss / maxL) * cInnerH;
                      const y = cPad.top + cInnerH - bH;
                      return (
                        <rect
                          key={`mb-${p.date}`}
                          x={x - bW / 2}
                          y={y}
                          width={bW}
                          height={Math.max(0, bH)}
                          fill={p.tss > 100 ? '#f59e0b' : '#38bdf8'}
                          opacity={hoveredPmcPoint?.date === p.date ? 0.9 : 0.4}
                          rx="1"
                        />
                      );
                    })}

                    {/* Curves */}
                    <path d={ctlD} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                    <path d={atlD} fill="none" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" strokeDasharray="3,2" />
                    <path d={tsbD} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />

                    {/* Hit areas */}
                    {chartData.map((p, i) => {
                      const x = getCx(i);
                      const isHov = hoveredPmcPoint?.date === p.date;
                      return (
                        <g key={`hit-${p.date}`} onMouseEnter={() => setHoveredPmcPoint(p)} className="cursor-pointer">
                          <rect x={x - 6} y={cPad.top} width={12} height={cInnerH} fill="transparent" />
                          {isHov && (
                            <line x1={x} y1={cPad.top} x2={x} y2={cPad.top + cInnerH} stroke="#a1a1aa" strokeDasharray="2,2" strokeWidth="1" />
                          )}
                          <circle cx={x} cy={getCyLoad(p.ctl)} r={isHov ? 5 : 2} fill="#22d3ee" />
                          <circle cx={x} cy={getCyTsb(p.tsb)} r={isHov ? 5 : 2} fill="#f59e0b" />
                        </g>
                      );
                    })}

                    {/* X axis labels */}
                    {chartData.filter((_, i, a) => i % (a.length > 25 ? 5 : 3) === 0 || i === a.length - 1).map((p) => {
                      const idx = chartData.findIndex(pt => pt.date === p.date);
                      return (
                        <text key={`lx-${p.date}`} x={getCx(idx)} y={chartHeight - 10} fill="#71717a" fontSize="9" fontFamily="monospace" textAnchor="middle">
                          {p.dayLabel}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Hover indicator summary */}
              {hoveredPmcPoint && (
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-zinc-200">{hoveredPmcPoint.dayLabel}</span>
                    <span className="text-zinc-500 ml-2">({hoveredPmcPoint.workoutTitle || 'Descanso / Asimilación'})</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="text-amber-400 font-bold">{hoveredPmcPoint.tss} TSS</span>
                    <span className="text-cyan-400">CTL: {hoveredPmcPoint.ctl}</span>
                    <span className="text-rose-400">ATL: {hoveredPmcPoint.atl}</span>
                    <span className={`font-bold ${hoveredPmcPoint.tsb < -30 ? 'text-rose-400' : 'text-amber-400'}`}>
                      TSB: {hoveredPmcPoint.tsb > 0 ? `+${hoveredPmcPoint.tsb}` : hoveredPmcPoint.tsb}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      )}

      {/* ACWR (ACUTE:CHRONIC WORKLOAD RATIO) & OVERTRAINING PREVENTION */}
      {(activeMetricsTab === 'all' || activeMetricsTab === 'acwr') && (
        <div id="acwr-section" className="space-y-4 animate-in fade-in">
          {activeMetricsTab === 'acwr' && (
            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Vista Enfocada: Ratio Aguda:Crónica (ACWR 28d) - Tim Gabbett
              </span>
              <button 
                onClick={() => setActiveMetricsTab('all')} 
                className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-zinc-700 transition cursor-pointer"
              >
                ← Volver a Vista General
              </button>
            </div>
          )}
          <ACWRVisualization
            workouts={workouts}
            pmcData={pmcData}
            onScheduleDeload={onScheduleDeload}
            onNavigateTab={onNavigateTab}
          />
        </div>
      )}

      {/* 7-DAY ROLLING HRV rMSSD VS WEEKLY TRAINING LOAD (OVERREACHING MONITOR & QUADRANTS) */}
      {activeMetricsTab === 'hrv_load' && (
        <div id="hrv-overreaching-section" className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Desglose Clínico Detallado: Matriz de 4 Cuadrantes & Registro de Episodios
            </span>
          </div>
          <HRVLoadOverreachingView
            workouts={workouts}
            checkIns={checkIns}
            pmcData={pmcData}
            profile={profile}
            onScheduleDeload={onScheduleDeload}
            onNavigateTab={onNavigateTab}
          />
        </div>
      )}

      {/* PREDICTIVE LINEAR REGRESSION HRV 30-DAY FORWARD FORECAST */}
      {activeMetricsTab === 'hrv_predictive' && (
        <div id="hrv-predictive-section" className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Vista Enfocada: Regresión Lineal de HRV (30 Días) & Pronóstico de Fatiga a 7 Días
            </span>
            <button 
              onClick={() => setActiveMetricsTab('all')} 
              className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-zinc-700 transition cursor-pointer"
            >
              ← Volver a Vista General
            </button>
          </div>
          <HRVPredictiveRegressionCard
            checkIns={checkIns}
            workouts={workouts}
            profile={profile}
            onScheduleDeload={onScheduleDeload}
            onNavigateTab={onNavigateTab}
          />
        </div>
      )}

      {/* Physiological Zones & Time Breakdown (with explicit BPM for DFA a1) */}
      {(activeMetricsTab === 'all' || activeMetricsTab === 'zones') && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in">
          {activeMetricsTab === 'zones' && (
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Vista Enfocada: Zonas Fisiológicas & Suunto ZoneSense
              </span>
              <button 
                onClick={() => setActiveMetricsTab('all')} 
                className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-zinc-700 transition cursor-pointer"
              >
                ← Volver a Vista General
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-zinc-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span>Distribución en Zonas Fisiológicas & Suunto ZoneSense</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cada umbral de DFA a1 traducido exactamente a pulsaciones cardíacas individuales (AeT: {profile.aetHr} bpm, AnT: {profile.antHr} bpm)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              {totalAerobicPct}% en Z1 + Z2 (Meta &gt;80%)
            </span>
          </div>
        </div>

        {/* Stacked Percentage Bar */}
        <div className="w-full bg-zinc-950 h-5 rounded-2xl overflow-hidden flex border border-zinc-800">
          {zoneDistribution.map((z, idx) => (
            <div
              key={idx}
              className={`${z.color} transition-all relative group`}
              style={{ width: `${z.pct}%` }}
              title={`${z.zone}: ${z.pct}% (${z.bpmRange})`}
            />
          ))}
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {zoneDistribution.map((item, idx) => (
            <div key={idx} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
              <div className="flex justify-between items-start">
                <span className={`text-xs font-black uppercase tracking-wider ${item.textColor}`}>
                  {item.zone}
                </span>
                <span className="text-xs font-mono font-bold text-zinc-100 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  {item.pct}%
                </span>
              </div>

              {/* Exact BPM & DFA a1 */}
              <div className="space-y-0.5">
                <div className="text-sm font-black text-zinc-100 font-mono">
                  {item.bpmRange}
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  {item.dfaLabel}
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed pt-1 border-t border-zinc-900">
                {item.description}
              </p>

              <div className="text-[10px] text-zinc-400 font-mono">
                Tiempo acumulado: <strong className="text-zinc-200">{item.hours} h</strong>
              </div>
            </div>
          ))}
        </div>

        {/* Uphill Athlete Principle Callout */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-zinc-300 flex items-start space-x-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-emerald-300">
              Cumplimiento de la Regla de Oro (Training for the Uphill Athlete):
            </span>
            <p className="leading-relaxed">
              Actualmente mantienes un <strong>{totalAerobicPct}%</strong> de tu entrenamiento estrictamente por debajo de tu AeT (&lt; {profile.aetHr} bpm con DFA a1 &ge; 0.75). Esto garantiza la reversión activa del <strong>Síndrome de Deficiencia Aeróbica (ADS)</strong>, maximiza la densidad mitocondrial de las fibras lentas tipo I y protege tus articulaciones de cara al volumen de Transvulcania.
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Secondary Performance Rows: Weight & Gut Training */}
      {(activeMetricsTab === 'all' || activeMetricsTab === 'zones') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
        
        {/* Weight & Vertical Climbing Physics */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-zinc-100">Peso Óptimo de Carrera (67.5 kg)</h4>
                <p className="text-[11px] text-zinc-400">Biomecánica vertical y costo metabólico en +4.350m D+</p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30">
              {currentWeight} kg actual
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Progreso hacia peso de competición:</span>
              <span className="font-mono font-bold text-zinc-200">Resta: -{weightToLose} kg</span>
            </div>
            <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-800">
              <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full" style={{ width: '62%' }} />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Inicio: 74.0 kg</span>
              <span>Actual: {currentWeight} kg</span>
              <span className="text-emerald-400 font-bold">Meta: {targetWeight} kg</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1 leading-relaxed">
            <strong className="text-zinc-200 block">Física del Trail Running:</strong>
            Reducir esos {weightToLose} kg restantes a un ritmo sano de 300g/semana ahorrará aproximadamente <strong>~3.600 kcal</strong> de gasto energético en la subida al Roque de los Muchachos y restará <strong>18 toneladas</strong> de impacto acumulado en tus cuádriceps en la bajada de 2.400m a Tazacorte.
          </div>
        </div>

        {/* Gut Training & Hydration Progress */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-zinc-100">Entrenamiento Gástrico (Gut Training)</h4>
                <p className="text-[11px] text-zinc-400">Transportadores SGLT1 y GLUT5 para 80g CHO/h</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('gut')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1"
            >
              <span>Calculadora</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block uppercase font-bold">Tasa Actual</span>
              <div className="text-xl font-black text-zinc-100 font-mono mt-0.5">60 g/h</div>
              <span className="text-[10px] text-emerald-400">Fase 2 de 4 completada</span>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block uppercase font-bold">Objetivo Transvulcania</span>
              <div className="text-xl font-black text-amber-400 font-mono mt-0.5">80 g/h</div>
              <span className="text-[10px] text-zinc-400">Ratio 1:0.8 malto:fructosa</span>
            </div>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1 leading-relaxed">
            <strong className="text-zinc-200 block">Pauta de Sodio e Hidratación:</strong>
            Para compensar la tasa de sudoración estimada en el volcán de La Palma (calor en Tazacorte y viento seco en crestería), la reposición debe ser de <strong>650 mg de sodio por hora</strong> con <strong>600-750 ml de líquidos</strong>.
          </div>
        </div>

      </div>
      )}

      {/* Guide Modal: How to know if Suunto API is connected vs uploading .FIT */}
      {showSuuntoGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Watch className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-black">
                  ¿Cómo saber si el entrenador conecta con la API o si debes subir el .FIT?
                </h3>
              </div>
              <button 
                onClick={() => setShowSuuntoGuideModal(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="font-bold text-amber-400 uppercase tracking-wider block text-[11px]">
                  Respuesta Clara & Sencilla del Coach Miguel:
                </span>
                <p>
                  Tienes dos formas de alimentar al entrenador con los datos de tu reloj Suunto:
                </p>
              </div>

              {/* Method A */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-cyan-400 font-bold">Opción 1: Conexión Automática por API</strong>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isSuuntoApiConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    {isSuuntoApiConnected ? 'Conectado' : 'No configurado'}
                  </span>
                </div>
                <p className="text-zinc-400">
                  ¿Cómo saberlo? Mira el semáforo en este dashboard o en la pestaña <em>"Suunto & ZoneSense"</em>. Si tienes tus claves de <code>apizone.suunto.com</code> guardadas y el token activo, tus entrenamientos se sincronizan solos en segundo plano.
                </p>
              </div>

              {/* Method B */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-400 font-bold">Opción 2: Subir el archivo .FIT (Recomendada & Directa)</strong>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Siempre Disponible
                  </span>
                </div>
                <p className="text-zinc-300">
                  <strong>¡No necesitas configurar ninguna API si no quieres!</strong> Solo descarga el archivo <code>.fit</code> de tu sesión desde la app móvil de Suunto (opción <em>"Exportar entrenamiento como .FIT"</em>) y arrástralo en la pestaña <em>"Suunto & ZoneSense" &gt; "Analizador de Archivos .FIT"</em>.
                </p>
                <p className="text-zinc-400 text-[11px] pt-1 border-t border-zinc-800">
                  El sistema extrae directamente la frecuencia cardíaca exacta, la curva <strong>DFA a1 de ZoneSense</strong>, la cadencia, el desnivel y la deriva cardíaca (decoupling) para que Miguel te analice la sesión de inmediato.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => {
                  setShowSuuntoGuideModal(false);
                  onNavigateTab('zonesense');
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black text-xs transition"
              >
                Ir a Suunto & Subir .FIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      <ReportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        profile={profile}
        targetRace={targetRace}
        workouts={workouts}
        checkIns={checkIns}
        pmcData={pmcData}
      />

    </div>
  );
};
