import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Scale, 
  Flame, 
  Activity, 
  Mountain, 
  Heart, 
  Droplets, 
  Plus, 
  CheckCircle2, 
  Calendar, 
  ArrowUpRight, 
  Info, 
  Zap, 
  ShieldAlert, 
  Clock,
  Sparkles,
  ChevronRight,
  Trash2,
  Battery
} from 'lucide-react';
import { 
  AthleteProfile, 
  WeeklyPerformanceSummary, 
  MesocycleProgressionSummary, 
  WeightEntry,
  WeeklyZoneDistribution,
  DailyCheckIn
} from '../types';
import { StorageService } from '../services/storage';
import { WeeklyFatigueHrvWidget } from './WeeklyFatigueHrvWidget';

interface PerformanceSummaryViewProps {
  profile: AthleteProfile;
  onUpdateProfile: (profile: AthleteProfile) => void;
  checkIns?: DailyCheckIn[];
  onScheduleDeload?: (startDate: string) => void;
  onOpenFartlekGenerator?: () => void;
}

export const PerformanceSummaryView: React.FC<PerformanceSummaryViewProps> = ({
  profile,
  onUpdateProfile,
  checkIns = StorageService.getCheckIns(),
  onScheduleDeload,
  onOpenFartlekGenerator,
}) => {
  // State
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklyPerformanceSummary[]>(
    StorageService.getWeeklySummaries()
  );
  const [mesocycles, setMesocycles] = useState<MesocycleProgressionSummary[]>(
    StorageService.getMesocycleProgression()
  );
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(
    StorageService.getWeightHistory()
  );
  const [selectedWeekId, setSelectedWeekId] = useState<string>(
    weeklySummaries[weeklySummaries.length - 1]?.weekId || ''
  );
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [newWeightKg, setNewWeightKg] = useState<number>(profile.weightKg || 71.5);
  const [newBodyFatPct, setNewBodyFatPct] = useState<number>(14.5);
  const [newWeightNotes, setNewWeightNotes] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<
    'fatigue_hrv' | 'volume_zones' | 'mesocycles' | 'weight_tracker' | 'coach_nutrition'
  >('fatigue_hrv');

  // Sweat Rate Calculator state
  const [preRunWeight, setPreRunWeight] = useState<number>(71.5);
  const [postRunWeight, setPostRunWeight] = useState<number>(70.8);
  const [fluidsConsumedMl, setFluidsConsumedMl] = useState<number>(1200);
  const [durationHours, setDurationHours] = useState<number>(2.0);
  const [tempCelsius, setTempCelsius] = useState<number>(24);

  // Derived calculations for selected week
  const selectedWeek = weeklySummaries.find(w => w.weekId === selectedWeekId) || weeklySummaries[weeklySummaries.length - 1];

  // Aggregates
  const totalKm = weeklySummaries.reduce((acc, w) => acc + w.totalDistanceKm, 0);
  const totalElevationGain = weeklySummaries.reduce((acc, w) => acc + w.totalElevationGainM, 0);
  const totalElevationLoss = weeklySummaries.reduce((acc, w) => acc + w.totalElevationLossM, 0);
  const totalHours = (weeklySummaries.reduce((acc, w) => acc + w.totalDurationMin, 0) / 60).toFixed(1);

  // Global Zone Distribution
  const totalZ1Min = weeklySummaries.reduce((acc, w) => acc + w.zoneDistribution.zone1Min, 0);
  const totalZ2Min = weeklySummaries.reduce((acc, w) => acc + w.zoneDistribution.zone2Min, 0);
  const totalZ3Min = weeklySummaries.reduce((acc, w) => acc + w.zoneDistribution.zone3Min, 0);
  const totalZ4Min = weeklySummaries.reduce((acc, w) => acc + w.zoneDistribution.zone4Min, 0);
  const totalZ5Min = weeklySummaries.reduce((acc, w) => acc + w.zoneDistribution.zone5Min, 0);
  const allMinutes = totalZ1Min + totalZ2Min + totalZ3Min + totalZ4Min + totalZ5Min || 1;
  const globalAerobicPct = (((totalZ1Min + totalZ2Min) / allMinutes) * 100).toFixed(1);

  // Weight metrics
  const heightM = (profile.heightCm || 176) / 100;
  const currentBmi = (profile.weightKg / (heightM * heightM)).toFixed(1);
  const weightDeltaToTarget = Number((profile.weightKg - (profile.targetRaceWeightKg || 67.5)).toFixed(1));
  const estimatedTransvulcaniaKcal = Math.round(Math.max(0, weightDeltaToTarget) * 9.81 * 4.35 / 0.23);
  const estimatedTransvulcaniaMinutes = Math.round(Math.max(0, weightDeltaToTarget) * 6.5);

  // Sweat rate calculation
  // Sweat Loss (L) = (Pre - Post) + Fluids consumed (L) - Urine (assume 0)
  const weightLossKg = Math.max(0, preRunWeight - postRunWeight);
  const totalSweatLiters = weightLossKg + (fluidsConsumedMl / 1000);
  const hourlySweatRateMl = durationHours > 0 ? Math.round((totalSweatLiters / durationHours) * 1000) : 0;
  const targetHourlyHydrationMl = Math.round(hourlySweatRateMl * 0.80); // 80% replacement rule

  // Handlers
  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = StorageService.addWeightEntry({
      date: new Date().toISOString().split('T')[0],
      weightKg: Number(newWeightKg),
      bodyFatPct: newBodyFatPct ? Number(newBodyFatPct) : undefined,
      notes: newWeightNotes.trim() || undefined,
    });
    setWeightHistory(updated);
    
    // Update local profile state
    const updatedProfile = {
      ...profile,
      weightKg: Number(newWeightKg),
      weightHistory: updated,
    };
    onUpdateProfile(updatedProfile);
    setIsWeightModalOpen(false);
    setNewWeightNotes('');
  };

  const handleDeleteWeight = (id: string) => {
    const updated = StorageService.deleteWeightEntry(id);
    setWeightHistory(updated);
    if (updated.length > 0) {
      const latest = updated[updated.length - 1];
      const updatedProfile = {
        ...profile,
        weightKg: latest.weightKg,
        weightHistory: updated,
      };
      onUpdateProfile(updatedProfile);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/40 border border-zinc-800 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" />
              <span>Resumen de Rendimiento & Progresión de la Base Aeróbica</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              Evolución Metabólica & Potencia en Montaña
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl leading-relaxed">
              Supervisión de volumen semanal, desnivel positivo y negativo acumulado, tiempo en zonas cardíacas (Z1-Z5), 
              reversión del ADS y monitorización del peso óptimo hacia los <strong>+4.350m de Transvulcania 2027</strong>.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Volumen Total</div>
              <div className="text-lg font-black text-zinc-100">{totalKm.toFixed(0)} <span className="text-xs font-normal text-zinc-500">km</span></div>
              <div className="text-[10px] text-zinc-500">{totalHours} horas acumuladas</div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Desnivel D+ / D-</div>
              <div className="text-lg font-black text-amber-400">+{totalElevationGain.toLocaleString()} <span className="text-xs font-normal text-zinc-500">m</span></div>
              <div className="text-[10px] text-zinc-500">-{totalElevationLoss.toLocaleString()} m excéntrico</div>
            </div>

            <div className="bg-zinc-950/80 border border-emerald-900/40 p-3 rounded-2xl">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">Base Aeróbica</div>
              <div className="text-lg font-black text-emerald-400">{globalAerobicPct}%</div>
              <div className="text-[10px] text-zinc-400">Target Uphill: &gt; 85%</div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Peso vs Óptimo</div>
              <div className="text-lg font-black text-zinc-100">{profile.weightKg} <span className="text-xs font-normal text-zinc-500">kg</span></div>
              <div className="text-[10px] text-amber-400">Meta: {profile.targetRaceWeightKg || 67.5} kg</div>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSubTab('fatigue_hrv')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'fatigue_hrv'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Battery className="w-4 h-4 text-amber-400" />
              <span>Tendencia de Fatiga & Descarga (HRV)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-mono border border-red-500/30 font-black">
                Alerta
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('volume_zones')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'volume_zones'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Volumen & Distribución de Zonas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('mesocycles')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'mesocycles'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Mountain className="w-4 h-4" />
              <span>Evolución por Mesociclos & ADS</span>
            </button>

            <button
              onClick={() => setActiveSubTab('weight_tracker')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'weight_tracker'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Monitorización de Peso de Carrera</span>
            </button>

            <button
              onClick={() => setActiveSubTab('coach_nutrition')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'coach_nutrition'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Droplets className="w-4 h-4" />
              <span>Pautas & Formación del Coach en Nutrición</span>
            </button>
          </div>

          {/* Quick Fartlek Generator Launcher Button */}
          {onOpenFartlekGenerator && (
            <button
              onClick={onOpenFartlekGenerator}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 transition-all shadow-sm cursor-pointer ml-auto"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Generar Fartlek Aeróbico</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 0: TENDENCIA DE FATIGA SEMANAL & PREDICTOR DE DESCARGA */}
      {activeSubTab === 'fatigue_hrv' && (
        <WeeklyFatigueHrvWidget
          profile={profile}
          checkIns={checkIns}
          onScheduleDeload={onScheduleDeload}
        />
      )}

      {/* TAB 1: VOLUMEN & DISTRIBUCIÓN DE ZONAS */}
      {activeSubTab === 'volume_zones' && (
        <div className="space-y-6">
          
          {/* Week Selection & Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Weekly Volume & D+ Progression Chart List */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <span>Progresión Semanal de Kilómetros y Desnivel</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Haz clic en una semana para analizar la descomposición en zonas</p>
                </div>
                <span className="text-xs text-zinc-500">{weeklySummaries.length} semanas registradas</span>
              </div>

              {/* Interactive Weekly Volume Bars */}
              <div className="space-y-3">
                {weeklySummaries.map((w) => {
                  const isSelected = w.weekId === selectedWeekId;
                  const maxKm = Math.max(...weeklySummaries.map(s => s.totalDistanceKm), 50);
                  const maxGain = Math.max(...weeklySummaries.map(s => s.totalElevationGainM), 2000);
                  const kmBarPct = Math.round((w.totalDistanceKm / maxKm) * 100);
                  const gainBarPct = Math.round((w.totalElevationGainM / maxGain) * 100);

                  return (
                    <div
                      key={w.weekId}
                      onClick={() => setSelectedWeekId(w.weekId)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-zinc-950 border-amber-500/80 shadow-lg ring-1 ring-amber-500/20' 
                          : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
                          <span className="text-xs font-bold text-zinc-100">{w.weekLabel}</span>
                          <span className="text-[11px] text-zinc-500">• {w.mesocycleName.split(':')[0]}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-xs font-semibold">
                          <span className="text-zinc-200">{w.totalDistanceKm} km</span>
                          <span className="text-amber-400">+{w.totalElevationGainM} m D+</span>
                          <span className="text-emerald-400">{w.zoneDistribution.aerobicRatioPct}% Aeróbico</span>
                          <span className="text-zinc-500">{(w.totalDurationMin / 60).toFixed(1)} h</span>
                        </div>
                      </div>

                      {/* Visual Bars for Km & Gain */}
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="w-16 text-zinc-400">Distancia:</span>
                          <div className="flex-1 bg-zinc-900 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${kmBarPct}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-zinc-300 font-mono">{w.totalDistanceKm}k</span>
                        </div>

                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="w-16 text-zinc-400">Desnivel:</span>
                          <div className="flex-1 bg-zinc-900 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${gainBarPct}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-amber-400 font-mono">+{w.totalElevationGainM}m</span>
                        </div>
                      </div>

                      {/* Stacked Zone bar */}
                      <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center space-x-2 text-[10px]">
                        <span className="text-zinc-500 w-16">Zonas Z1-Z5:</span>
                        <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-zinc-900">
                          <div style={{ width: `${(w.zoneDistribution.zone1Min / w.zoneDistribution.totalDurationMin) * 100}%` }} className="bg-sky-500" title="Z1 Recuperación" />
                          <div style={{ width: `${(w.zoneDistribution.zone2Min / w.zoneDistribution.totalDurationMin) * 100}%` }} className="bg-emerald-500" title="Z2 Base Aeróbica Sub-AeT" />
                          <div style={{ width: `${(w.zoneDistribution.zone3Min / w.zoneDistribution.totalDurationMin) * 100}%` }} className="bg-amber-500" title="Z3 Tempo" />
                          <div style={{ width: `${(w.zoneDistribution.zone4Min / w.zoneDistribution.totalDurationMin) * 100}%` }} className="bg-orange-500" title="Z4 Umbral" />
                          <div style={{ width: `${(w.zoneDistribution.zone5Min / w.zoneDistribution.totalDurationMin) * 100}%` }} className="bg-red-500" title="Z5 Anaeróbico" />
                        </div>
                        <span className="text-emerald-400 font-bold">{w.zoneDistribution.aerobicRatioPct}% Z1-Z2</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Week Zone Detail Panel */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Detalle de Semana</span>
                    <h3 className="text-base font-black text-zinc-100">{selectedWeek.weekLabel}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400">Total</div>
                    <div className="text-sm font-black text-zinc-200">{(selectedWeek.totalDurationMin / 60).toFixed(1)} horas</div>
                  </div>
                </div>

                {/* Zone Breakdown Metrics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Desglose de Tiempo en Zonas</h4>

                  {/* Z1 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-sky-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                        <span>Z1: Recuperación Activa (&lt; {profile.aetHr - 15} bpm)</span>
                      </span>
                      <span className="text-zinc-300 font-mono">{selectedWeek.zoneDistribution.zone1Min} min ({Math.round((selectedWeek.zoneDistribution.zone1Min / selectedWeek.zoneDistribution.totalDurationMin) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-sky-400 h-full rounded-full" 
                        style={{ width: `${(selectedWeek.zoneDistribution.zone1Min / selectedWeek.zoneDistribution.totalDurationMin) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Z2 Base Aeróbica */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                        <span>Z2: Base Aeróbica Sub-AeT ({profile.aetHr - 15} - {profile.aetHr} bpm)</span>
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">{selectedWeek.zoneDistribution.zone2Min} min ({Math.round((selectedWeek.zoneDistribution.zone2Min / selectedWeek.zoneDistribution.totalDurationMin) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full rounded-full" 
                        style={{ width: `${(selectedWeek.zoneDistribution.zone2Min / selectedWeek.zoneDistribution.totalDurationMin) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500 pl-4">
                      ZoneSense: {selectedWeek.zoneDistribution.zoneSenseAerobicMin} min con DFA &alpha;1 &ge; 0.75 (&lt; {profile.aetHr} bpm)
                    </div>
                  </div>

                  {/* Z3 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-amber-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        <span>Z3: Transición / Tempo ({profile.aetHr} - {profile.antHr - 10} bpm)</span>
                      </span>
                      <span className="text-zinc-300 font-mono">{selectedWeek.zoneDistribution.zone3Min} min ({Math.round((selectedWeek.zoneDistribution.zone3Min / selectedWeek.zoneDistribution.totalDurationMin) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-amber-400 h-full rounded-full" 
                        style={{ width: `${(selectedWeek.zoneDistribution.zone3Min / selectedWeek.zoneDistribution.totalDurationMin) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Z4 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-orange-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                        <span>Z4: Umbral Anaeróbico AnT ({profile.antHr - 10} - {profile.antHr + 5} bpm)</span>
                      </span>
                      <span className="text-zinc-300 font-mono">{selectedWeek.zoneDistribution.zone4Min} min ({Math.round((selectedWeek.zoneDistribution.zone4Min / selectedWeek.zoneDistribution.totalDurationMin) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-orange-400 h-full rounded-full" 
                        style={{ width: `${(selectedWeek.zoneDistribution.zone4Min / selectedWeek.zoneDistribution.totalDurationMin) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Z5 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-red-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                        <span>Z5: Máxima Intensidad (&gt; {profile.antHr + 5} bpm)</span>
                      </span>
                      <span className="text-zinc-300 font-mono">{selectedWeek.zoneDistribution.zone5Min} min</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-red-400 h-full rounded-full" 
                        style={{ width: `${(selectedWeek.zoneDistribution.zone5Min / selectedWeek.zoneDistribution.totalDurationMin) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Uphill Rule Compliance Box */}
                <div className={`p-4 rounded-2xl border ${
                  selectedWeek.zoneDistribution.aerobicRatioPct >= 85 
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' 
                    : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                }`}>
                  <div className="flex items-center space-x-2 text-xs font-black uppercase">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Ratio Aeróbico: {selectedWeek.zoneDistribution.aerobicRatioPct}% en Z1-Z2</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    {selectedWeek.zoneDistribution.aerobicRatioPct >= 85
                      ? 'Cumple con la regla Uphill Athlete (≥ 85%). Permite proliferación mitocondrial sin fatiga del sistema nervioso simpático.'
                      : 'Atención: Ligero exceso de tiempo en Z3+. Miguel recalibrará las siguientes sesiones para forzar el paso a caminata en subida.'}
                  </p>
                </div>
              </div>

              {/* Coach Assessment Note */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-xs space-y-1.5">
                <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Evaluación Semanal de Miguel</span>
                </div>
                <p className="text-zinc-300 italic leading-relaxed text-[11px]">
                  "{selectedWeek.coachWeeklyAssessment}"
                </p>
              </div>

            </div>

          </div>

          {/* Global Multi-Zone Legend & Science Explanation */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Modelo de Intensidad Uphill Athlete & Suunto ZoneSense</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400 leading-relaxed">
              <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80 space-y-1.5">
                <span className="text-emerald-400 font-bold block">1. Umbral Aeróbico (AeT / VT1)</span>
                <p>
                  Corresponde a {profile.aetHr} bpm y DFA &alpha;1 &gt; 0.75. Es el límite superior donde las grasas son el combustible primario. 
                  En Transvulcania, cualquier minuto por encima de este pulso en las subidas agota prematuramente el glucógeno hepático.
                </p>
              </div>

              <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80 space-y-1.5">
                <span className="text-amber-400 font-bold block">2. Umbral Anaeróbico (AnT / VT2)</span>
                <p>
                  Situado en {profile.antHr} bpm. La diferencia de {profile.antHr - profile.aetHr} bpm respecto a tu AeT evidencia un leve Síndrome de Deficiencia Aeróbica (ADS) 
                  que se va reduciendo progresivamente conforme expandes tu volumen en Z2.
                </p>
              </div>

              <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80 space-y-1.5">
                <span className="text-indigo-400 font-bold block">3. Desacoplamiento &amp; Drift Test</span>
                <p>
                  Si la FC aumenta más del 3.5%-5% manteniendo velocidad constante en 60 min, la base aeróbica aún no es autosuficiente. 
                  Tu progresión actual refleja un desacoplamiento descendente desde 6.8% hasta 4.2%.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: EVOLUCIÓN POR MESOCICLOS & ADS */}
      {activeSubTab === 'mesocycles' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-black text-zinc-100 flex items-center space-x-2">
                  <Mountain className="w-5 h-5 text-amber-400" />
                  <span>Progresión de la Base Aeróbica a lo Largo de los Mesociclos</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Evolución del ritmo a umbral aeróbico constante ({profile.aetHr} bpm), porcentaje de volumen en base y reversión del ADS.
                </p>
              </div>
              <div className="flex items-center space-x-2 bg-emerald-950/30 border border-emerald-800/50 px-3 py-1.5 rounded-xl text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>ADS en vías de erradicación</span>
              </div>
            </div>

            {/* Mesocycle Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {mesocycles.map((meso, idx) => (
                <div 
                  key={meso.id}
                  className={`bg-zinc-950 border rounded-2xl p-5 space-y-4 flex flex-col justify-between ${
                    idx === 1 
                      ? 'border-amber-500/80 ring-1 ring-amber-500/30 shadow-xl' 
                      : 'border-zinc-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        {idx === 0 ? 'Fase Completada' : idx === 1 ? 'Mesociclo Activo' : 'Próxima Fase'}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">{meso.weeksCount} semanas</span>
                    </div>

                    <h4 className="text-sm font-black text-zinc-100">{meso.name}</h4>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 block">Media Semanal</span>
                        <strong className="text-zinc-200">{meso.avgWeeklyDistanceKm} km</strong>
                        <span className="text-[10px] text-amber-400 block">+{meso.avgWeeklyElevationGainM}m D+</span>
                      </div>

                      <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 block">Base Aeróbica</span>
                        <strong className="text-emerald-400 font-bold">{meso.aerobicBasePct}%</strong>
                        <span className="text-[10px] text-zinc-400 block">{meso.avgWeeklyDurationHours}h / sem</span>
                      </div>
                    </div>

                    {/* Drift Test & AeT Pace Evolution */}
                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[11px]">Ritmo a {profile.aetHr} bpm:</span>
                        <span className="text-zinc-200 font-bold text-[11px]">{meso.aeTPaceEvolution}</span>
                      </div>

                      {meso.driftTestEvolutionPct !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-[11px]">Drift Test (Deriva):</span>
                          <span className={`font-bold text-[11px] ${meso.driftTestEvolutionPct <= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {meso.driftTestEvolutionPct}% {meso.driftTestEvolutionPct <= 5 ? '(Normalizado)' : '(ADS presente)'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Milestone badge */}
                    <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60">
                      <strong className="text-amber-400 block mb-0.5">Hito Fisiológico:</strong>
                      {meso.keyMilestone}
                    </div>
                  </div>

                  {/* Coach Directive */}
                  <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 italic">
                    "{meso.coachNote}"
                  </div>
                </div>
              ))}
            </div>

            {/* Aerobic Base Expansion Visual Graph */}
            <div className="mt-8 bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Velocidad de Crucero al Umbral AeT ({profile.aetHr} bpm)</span>
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El verdadero marcador de una base aeróbica ensanchada en trail running no es subir el pulso, sino <strong>ir más rápido y subir pendientes más pronunciadas manteniendo las mismas pulsaciones de 142 bpm</strong> y quemando grasa intramuscular.
              </p>

              {/* Progress step bars */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Mesociclo 1 (Inicio): 6:35 min/km @ 142 bpm</span>
                    <span className="text-amber-400 font-mono font-bold">Deriva 6.8% (ADS)</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-200 font-bold">Mesociclo 2 (Actual): 5:58 min/km @ 142 bpm (-37 seg/km de mejora)</span>
                    <span className="text-emerald-400 font-mono font-bold">Deriva 4.2% (&lt; 5% Target)</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-500">Mesociclo 3 (Objetivo): 5:35 min/km en falso llano y 750m D+/h en ascenso continuo</span>
                    <span className="text-zinc-500 font-mono">Deriva &lt; 3.5%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-zinc-700 h-full rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: MONITORIZACIÓN DE PESO DE CARRERA */}
      {activeSubTab === 'weight_tracker' && (
        <div className="space-y-6">
          
          {/* Top Weight Progress & Biomechanical Impact Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Primary Gauge */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Antropometría del Atleta</span>
                  <h3 className="text-lg font-black text-zinc-100">Control de Peso Óptimo</h3>
                </div>
                <button
                  onClick={() => setIsWeightModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Pesaje</span>
                </button>
              </div>

              {/* Big Display */}
              <div className="flex items-baseline space-x-3">
                <span className="text-4xl sm:text-5xl font-black text-zinc-100 tracking-tight">{profile.weightKg}</span>
                <span className="text-base text-zinc-400 font-bold">kg actuales</span>
                <span className="text-xs text-zinc-500 ml-auto font-mono">Altura: {profile.heightCm} cm</span>
              </div>

              {/* Progress to target */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Meta Transvulcania:</span>
                  <span className="text-emerald-400 font-bold">{profile.targetRaceWeightKg || 67.5} kg</span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-700"
                    style={{ 
                      width: `${Math.min(100, Math.max(10, 100 - (weightDeltaToTarget / 10) * 100))}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Punto de partida (73.2 kg)</span>
                  <span className="text-amber-400 font-semibold">{weightDeltaToTarget > 0 ? `-${weightDeltaToTarget} kg restantes` : '¡Peso óptimo conseguido!'}</span>
                </div>
              </div>

              {/* Quick Vital Stats */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-500 block uppercase">Índice Masa Corporal</span>
                  <strong className="text-zinc-200 text-base">{currentBmi}</strong>
                  <span className="text-[10px] text-emerald-400 block">Normopeso atlético</span>
                </div>

                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-500 block uppercase">% Grasa Corporal</span>
                  <strong className="text-zinc-200 text-base">{weightHistory[weightHistory.length - 1]?.bodyFatPct || 14.5}%</strong>
                  <span className="text-[10px] text-zinc-400 block">Meta: 11.5 - 12.0%</span>
                </div>
              </div>
            </div>

            {/* Physics of Mountain Climbing (Transvulcania 4.350m D+) */}
            <div className="lg:col-span-2 bg-gradient-to-br from-zinc-900 to-amber-950/30 border border-zinc-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Flame className="w-4 h-4" />
                  <span>Impacto Biomecánico &amp; Fisiológico en Transvulcania</span>
                </div>
                <h3 className="text-lg font-black text-zinc-100 mt-1">
                  ¿Por qué cada kilogramo optimizado vale oro en La Palma?
                </h3>
                <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                  Para elevar 1 kg de masa verticalmente a lo largo de los <strong className="text-amber-400">+4.350 metros</strong> de desnivel positivo de Transvulcania (desde el nivel del mar en Fuencaliente hasta los 2.426m del Roque de los Muchachos y subida final):
                </p>
              </div>

              {/* Energy Calculation Display */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Ahorro Metabólico</div>
                  <div className="text-xl font-black text-emerald-400 mt-1">~{estimatedTransvulcaniaKcal} kcal</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Equivale a <strong>{Math.round(estimatedTransvulcaniaKcal / 4)}g</strong> de glucógeno no consumido</div>
                </div>

                <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Tiempo Estimado Ahorrado</div>
                  <div className="text-xl font-black text-amber-400 mt-1">~{estimatedTransvulcaniaMinutes} min</div>
                  <div className="text-[10px] text-zinc-400 mt-1">A igualdad de potencia aeróbica en umbral AeT</div>
                </div>

                <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Protección Articular D-</div>
                  <div className="text-xl font-black text-sky-400 mt-1">-4.057 m</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Menos microimpactos excéntricos en rodillas y cuádriceps</div>
                </div>
              </div>

              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400">
                <strong className="text-zinc-200">Pauta del Entrenador: </strong>
                La pérdida de peso debe ser gradual (máximo 300-400 g semanales) mediante recomposición corporal. Nunca en déficits calóricos severos que comprometan la síntesis proteica de los tendones o la disponibilidad energética (evitar RED-S).
              </div>
            </div>

          </div>

          {/* Historical Weight Entries Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Historial de Pesajes &amp; Composición Corporal</span>
              </h4>
              <span className="text-xs text-zinc-500">{weightHistory.length} registros</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Peso (kg)</th>
                    <th className="py-2.5 px-3">% Grasa</th>
                    <th className="py-2.5 px-3">Diferencia vs Inicio</th>
                    <th className="py-2.5 px-3">Observaciones / Contexto</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {weightHistory.map((entry, index) => {
                    const firstWeight = weightHistory[0]?.weightKg || entry.weightKg;
                    const diff = Number((entry.weightKg - firstWeight).toFixed(1));

                    return (
                      <tr key={entry.id} className="hover:bg-zinc-950/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-zinc-400">{entry.date}</td>
                        <td className="py-3 px-3 font-bold text-zinc-100">{entry.weightKg} kg</td>
                        <td className="py-3 px-3 text-zinc-400">{entry.bodyFatPct ? `${entry.bodyFatPct}%` : '—'}</td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold ${diff < 0 ? 'text-emerald-400' : diff > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {diff > 0 ? `+${diff}` : diff} kg
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-400 max-w-md">{entry.notes || '—'}</td>
                        <td className="py-3 px-3 text-right">
                          {weightHistory.length > 1 && (
                            <button
                              onClick={() => handleDeleteWeight(entry.id)}
                              className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors"
                              title="Eliminar pesaje"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: PAUTAS & FORMACIÓN DEL COACH EN NUTRICIÓN */}
      {activeSubTab === 'coach_nutrition' && (
        <div className="space-y-6">
          
          {/* Miguel's Nutrition Coaching Framework */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Droplets className="w-4 h-4" />
                  <span>Dirección Nutricional &amp; Aprendizaje del Entrenador</span>
                </div>
                <h3 className="text-xl font-black text-zinc-100">
                  Formación y Pautas de Miguel para Alimentación e Hidratación
                </h3>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Coach Activo en Nutrición</span>
              </div>
            </div>

            {/* Philosophy Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">1</div>
                <h4 className="text-sm font-bold text-zinc-100">Tasa de Sudoración &amp; Sodio</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  En el clima de La Palma (sol implacable en Fuencaliente y Tazacorte, baja humedad relativa en El Roque a 2.400m), la pérdida de sodio puede alcanzar los <strong>550-750 mg/h</strong>. Beber solo agua pura provocaría hiponatremia y calambres.
                </p>
                <div className="text-[11px] text-amber-400 font-semibold bg-zinc-900 p-2.5 rounded-xl">
                  Regla de Miguel: Reponer el 80% del líquido perdido + 500-600mg de Na+ por bidón de 500ml.
                </div>
              </div>

              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">2</div>
                <h4 className="text-sm font-bold text-zinc-100">Transportadores SGLT1 &amp; GLUT5</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Hasta 60 g/h de carbohidratos, la glucosa/maltodextrina satura el transportador intestinal SGLT1. Para superar los <strong>65-80 g/h</strong> sin diarrea osmótica, Miguel te prescribe mezcla con fructosa en ratio <strong>1:0.8 o 2:1</strong>.
                </p>
                <div className="text-[11px] text-emerald-400 font-semibold bg-zinc-900 p-2.5 rounded-xl">
                  Regla de Miguel: Entrenar el estómago cada fin de semana con la comida exacta de carrera.
                </div>
              </div>

              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">3</div>
                <h4 className="text-sm font-bold text-zinc-100">Fatiga de Paladar &amp; Comida Real</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  En una ultradistancia de más de 12 horas como Transvulcania, consumir solo geles dulces produce náuseas por empalago. Miguel integrará en tu plan patatas cocidas con sal, membrillo y papas arrugadas canarias en avituallamientos clave.
                </p>
                <div className="text-[11px] text-orange-400 font-semibold bg-zinc-900 p-2.5 rounded-xl">
                  Regla de Miguel: Alternar dulce y salado cada 45 minutos a partir de la 4ª hora.
                </div>
              </div>
            </div>

            {/* Interactive Sweat Rate Calculator (Test de Tasa de Sudoración) */}
            <div className="bg-zinc-950 p-6 rounded-2xl border border-amber-900/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
                    <Droplets className="w-4 h-4 text-blue-400" />
                    <span>Calculadora de Tasa de Sudoración Real (Sweat Rate Test)</span>
                  </h4>
                  <p className="text-xs text-zinc-400">Pésate desnudo antes y después de tu tirada para calibrar tu reposición</p>
                </div>
                <span className="text-xs text-amber-400 font-semibold">Herramienta Diagnóstica de Miguel</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400">Peso Pre-Entreno (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={preRunWeight}
                    onChange={(e) => setPreRunWeight(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-100 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400">Peso Post-Entreno (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={postRunWeight}
                    onChange={(e) => setPostRunWeight(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-100 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400">Líquido Bebido (ml)</label>
                  <input
                    type="number"
                    step="50"
                    value={fluidsConsumedMl}
                    onChange={(e) => setFluidsConsumedMl(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-100 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400">Duración (horas)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-100 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400">Temperatura (°C)</label>
                  <input
                    type="number"
                    value={tempCelsius}
                    onChange={(e) => setTempCelsius(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-100 font-bold"
                  />
                </div>
              </div>

              {/* Diagnostic Results */}
              <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Tasa de Pérdida</span>
                  <div className="text-lg font-black text-blue-400">{hourlySweatRateMl} ml / hora</div>
                  <span className="text-[10px] text-zinc-400">Sudoración total: {totalSweatLiters.toFixed(2)} L</span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Pauta de Ingesta Sugerida</span>
                  <div className="text-lg font-black text-emerald-400">{targetHourlyHydrationMl} ml / hora</div>
                  <span className="text-[10px] text-zinc-400">2 sorbos cada 15 min con sales</span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Sodio Recomendado</span>
                  <div className="text-lg font-black text-amber-400">
                    {tempCelsius >= 24 ? '650 - 750 mg/h' : '450 - 550 mg/h'}
                  </div>
                  <span className="text-[10px] text-zinc-400">Ajustado al clima de La Palma</span>
                </div>
              </div>
            </div>

            {/* Miguel's Nutrition Rules Stored in Memory */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Reglas Nutricionales Aprendidas por Miguel</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300 font-bold">
                    <span>Progresión Gástrica Semanal</span>
                    <span className="text-emerald-400 text-[10px]">Confianza 90%</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    "Tolerancia consolidada en 55-60 g/h. En las próximas tiradas largas de montaña elevaremos a 65 g/h usando geles con hidrogel o bebida isotónica para no sobrecargar el estómago en pendientes."
                  </p>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300 font-bold">
                    <span>Protocolo de Descenso en El Time</span>
                    <span className="text-amber-400 text-[10px]">Confianza 95%</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    "Durante los 2.410m de caída vertical, el impacto de frenado impide ingerir sólidos. Miguel pauta exclusivamente líquidos isotónicos y geles muy fluidos en sorbos diminutos para evitar náuseas mecánicas."
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Modal: Add New Weight Entry */}
      {isWeightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-zinc-100">Registrar Nuevo Pesaje</h3>
              </div>
              <button 
                onClick={() => setIsWeightModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleAddWeight} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400">Peso en Ayunas (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={newWeightKg}
                  onChange={(e) => setNewWeightKg(Number(e.target.value))}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-zinc-400">% Grasa Corporal (Opcional)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newBodyFatPct}
                  onChange={(e) => setNewBodyFatPct(Number(e.target.value))}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100"
                />
              </div>

              <div>
                <label className="text-zinc-400">Notas / Contexto del pesaje</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Tras semana de carga aeróbica, buena energía en subidas..."
                  value={newWeightNotes}
                  onChange={(e) => setNewWeightNotes(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWeightModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black"
                >
                  Guardar Pesaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
