import React, { useState, useMemo } from 'react';
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
  WeightEntry,
  DailyCheckIn,
  Workout
} from '../types';
import { buildWeeklySummaries, buildFourWeekBlocks } from '../utils/weeklySummaries';
import { localDateKey } from '../utils/trainingLoad';
import { StorageService } from '../services/storage';
import { WeeklyFatigueHrvWidget } from './WeeklyFatigueHrvWidget';

interface PerformanceSummaryViewProps {
  profile: AthleteProfile;
  onUpdateProfile: (profile: AthleteProfile) => void;
  checkIns?: DailyCheckIn[];
  workouts?: Workout[];
  onScheduleDeload?: (startDate: string) => void;
  onOpenFartlekGenerator?: () => void;
}

export const PerformanceSummaryView: React.FC<PerformanceSummaryViewProps> = ({
  profile,
  onUpdateProfile,
  checkIns = StorageService.getCheckIns(),
  workouts = StorageService.getWorkouts(),
  onScheduleDeload,
  onOpenFartlekGenerator,
}) => {
  // State
  // Semanas y bloques de 4 semanas calculados con los entrenos completados reales
  const weeklySummaries = useMemo(() => buildWeeklySummaries(workouts, 12, profile.antHr), [workouts, profile.antHr]);
  const blocks = useMemo(() => buildFourWeekBlocks(weeklySummaries), [weeklySummaries]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(
    StorageService.getWeightHistory()
  );
  const [selectedWeekId, setSelectedWeekId] = useState<string>(
    weeklySummaries[weeklySummaries.length - 1]?.weekId || ''
  );
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [newWeightKg, setNewWeightKg] = useState<number>(profile.weightKg || 0);
  const [newBodyFatPct, setNewBodyFatPct] = useState<number>(0);
  const [newWeightNotes, setNewWeightNotes] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<
    'fatigue_hrv' | 'volume_zones' | 'mesocycles' | 'weight_tracker' | 'coach_nutrition'
  >('fatigue_hrv');

  // Sweat Rate Calculator state
  const [preRunWeight, setPreRunWeight] = useState<number>(profile.weightKg || 0);
  const [postRunWeight, setPostRunWeight] = useState<number>(profile.weightKg || 0);
  const [fluidsConsumedMl, setFluidsConsumedMl] = useState<number>(1200);
  const [durationHours, setDurationHours] = useState<number>(2.0);
  const [tempCelsius, setTempCelsius] = useState<number>(24);

  // Derived calculations for selected week
  const selectedWeek = weeklySummaries.find(w => w.weekId === selectedWeekId) || weeklySummaries[weeklySummaries.length - 1];

  // Aggregates (últimas 12 semanas)
  const totalKm = weeklySummaries.reduce((acc, w) => acc + w.distanceKm, 0);
  const totalElevationGain = weeklySummaries.reduce((acc, w) => acc + w.elevationGainM, 0);
  const totalElevationLoss = weeklySummaries.reduce((acc, w) => acc + w.elevationLossM, 0);
  const totalHours = (weeklySummaries.reduce((acc, w) => acc + w.durationMin, 0) / 60).toFixed(1);

  // % bajo AeT según ZoneSense (solo entrenos que traen ese dato)
  const zsTracked = weeklySummaries.reduce((acc, w) => acc + w.zoneSense.trackedMin, 0);
  const zsAerobic = weeklySummaries.reduce((acc, w) => acc + w.zoneSense.aerobicMin, 0);
  const globalAerobicPct = zsTracked > 0 ? ((zsAerobic / zsTracked) * 100).toFixed(1) : null;

  // Weight metrics (misma fuente que el resto de la app: último pesaje)
  const sortedWeights = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].weightKg : (profile.weightKg || 0);
  const startWeight = sortedWeights.length > 0 ? sortedWeights[0].weightKg : currentWeight;
  const latestBodyFat = [...sortedWeights].reverse().find(e => e.bodyFatPct != null)?.bodyFatPct;
  const heightM = (profile.heightCm || 0) / 100;
  const currentBmi = currentWeight > 0 && heightM > 0 ? (currentWeight / (heightM * heightM)).toFixed(1) : '—';
  const targetWeight = profile.targetRaceWeightKg || 0;
  const weightDeltaToTarget = targetWeight > 0 ? Number((currentWeight - targetWeight).toFixed(1)) : 0;
  const weightProgressPct = targetWeight > 0 && startWeight > targetWeight
    ? Math.min(100, Math.max(0, Math.round(((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)))
    : 0;

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
      date: localDateKey(),
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
              Supervisión de volumen semanal, desnivel positivo y negativo acumulado, tiempo en zonas ZoneSense de Suunto 
              y monitorización del peso óptimo hacia los <strong>+4.350m de Transvulcania 2027</strong>.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Volumen Total</div>
              <div className="text-lg font-black text-zinc-100">{totalKm.toFixed(0)} <span className="text-xs font-normal text-zinc-500">km</span></div>
              <div className="text-[10px] text-zinc-500">{totalHours} h · últimas 12 semanas</div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Desnivel D+ / D-</div>
              <div className="text-lg font-black text-amber-400">+{totalElevationGain.toLocaleString()} <span className="text-xs font-normal text-zinc-500">m</span></div>
              <div className="text-[10px] text-zinc-500">-{totalElevationLoss.toLocaleString()} m excéntrico</div>
            </div>

            <div className="bg-zinc-950/80 border border-emerald-900/40 p-3 rounded-2xl">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">Base Aeróbica</div>
              <div className="text-lg font-black text-emerald-400">{globalAerobicPct !== null ? `${globalAerobicPct}%` : '—'}</div>
              <div className="text-[10px] text-zinc-400">{globalAerobicPct !== null ? 'En verde (ZoneSense) · 12 sem.' : 'Sin datos ZoneSense'}</div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
              <div className="text-[10px] text-zinc-400 uppercase font-bold">Peso vs Óptimo</div>
              <div className="text-lg font-black text-zinc-100">{currentWeight || '—'} <span className="text-xs font-normal text-zinc-500">kg</span></div>
              <div className="text-[10px] text-amber-400">Meta: {targetWeight || '—'} kg</div>
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
              <span>Evolución por Bloques de 4 Semanas</span>
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

      {/* TAB 1: VOLUMEN & DISTRIBUCIÓN DE ZONAS (datos reales de los entrenos completados) */}
      {activeSubTab === 'volume_zones' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Weekly Volume & D+ list */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <span>Progresión Semanal de Kilómetros y Desnivel</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Entrenos completados (Suunto o registrados). Haz clic en una semana para ver el detalle.</p>
                </div>
                <span className="text-xs text-zinc-500">Últimas {weeklySummaries.length} semanas</span>
              </div>

              <div className="space-y-3">
                {[...weeklySummaries].reverse().map((w) => {
                  const isSelected = w.weekId === selectedWeek?.weekId;
                  const maxKm = Math.max(...weeklySummaries.map(x => x.distanceKm), 1);
                  const maxGain = Math.max(...weeklySummaries.map(x => x.elevationGainM), 1);
                  const zsTotal = w.zoneSense.trackedMin || 1;
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
                          <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                          <span className="text-xs font-bold text-zinc-100">{w.weekLabel}</span>
                          <span className="text-[11px] text-zinc-500">• {w.completedCount} entrenos</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold">
                          <span className="text-zinc-200">{w.distanceKm} km</span>
                          <span className="text-amber-400">+{w.elevationGainM} m D+</span>
                          <span className="text-zinc-400">{w.tss} TSS</span>
                          <span className="text-emerald-400">{w.aerobicPct !== null ? `${w.aerobicPct}% en verde` : 'sin ZoneSense'}</span>
                          <span className="text-zinc-500">{(w.durationMin / 60).toFixed(1)} h</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="w-16 text-zinc-400">Distancia:</span>
                          <div className="flex-1 bg-zinc-900 rounded-full h-2 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full" style={{ width: `${Math.round((w.distanceKm / maxKm) * 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-zinc-300 font-mono">{w.distanceKm}k</span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="w-16 text-zinc-400">Desnivel:</span>
                          <div className="flex-1 bg-zinc-900 rounded-full h-2 overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full" style={{ width: `${Math.round((w.elevationGainM / maxGain) * 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-amber-400 font-mono">+{w.elevationGainM}m</span>
                        </div>
                      </div>

                      {w.zoneSense.trackedMin > 0 && (
                        <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center space-x-2 text-[10px]">
                          <span className="text-zinc-500 w-16">ZoneSense:</span>
                          <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-zinc-900">
                            <div style={{ width: `${(w.zoneSense.aerobicMin / zsTotal) * 100}%` }} className="bg-emerald-500" title="Verde (aeróbico)" />
                            <div style={{ width: `${(w.zoneSense.transitionMin / zsTotal) * 100}%` }} className="bg-amber-500" title="Entre AeT y AnT" />
                            <div style={{ width: `${(w.zoneSense.anaerobicMin / zsTotal) * 100}%` }} className="bg-red-500" title="Sobre AnT" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected week detail */}
            {selectedWeek && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Detalle de Semana</span>
                    <h3 className="text-base font-black text-zinc-100">{selectedWeek.weekLabel}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400">Total</div>
                    <div className="text-sm font-black text-zinc-200">{(selectedWeek.durationMin / 60).toFixed(1)} horas</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">D+ / D-</span>
                    <strong className="text-zinc-200">+{selectedWeek.elevationGainM} / -{selectedWeek.elevationLossM} m</strong>
                  </div>
                  <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">Carga</span>
                    <strong className="text-zinc-200">{selectedWeek.tss} TSS</strong>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Tiempo en zonas ZoneSense (Suunto)</h4>
                  {selectedWeek.zoneSense.trackedMin > 0 ? (
                    ([
                      { label: 'Verde · aeróbico', min: selectedWeek.zoneSense.aerobicMin, bar: 'bg-emerald-400', text: 'text-emerald-400' },
                      { label: 'Amarillo · entre umbrales', min: selectedWeek.zoneSense.transitionMin, bar: 'bg-amber-400', text: 'text-amber-400' },
                      { label: 'Rojo · sobre umbral anaeróbico', min: selectedWeek.zoneSense.anaerobicMin, bar: 'bg-red-400', text: 'text-red-400' },
                    ]).map((z) => (
                      <div key={z.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold ${z.text}`}>{z.label}</span>
                          <span className="text-zinc-300 font-mono">{z.min} min ({Math.round((z.min / selectedWeek.zoneSense.trackedMin) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                          <div className={`${z.bar} h-full rounded-full`} style={{ width: `${(z.min / selectedWeek.zoneSense.trackedMin) * 100}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500">Ningún entreno de esta semana trae datos de ZoneSense.</p>
                  )}
                  {selectedWeek.zoneSense.trackedMin > 0 && selectedWeek.zoneSense.trackedMin < selectedWeek.durationMin && (
                    <p className="text-[10px] text-zinc-500">
                      ZoneSense cubre {selectedWeek.zoneSense.trackedMin} de {selectedWeek.durationMin} min de la semana.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EVOLUCIÓN POR BLOQUES DE 4 SEMANAS (datos reales) */}
      {activeSubTab === 'mesocycles' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <div className="mb-6">
              <h3 className="text-base font-black text-zinc-100 flex items-center space-x-2">
                <Mountain className="w-5 h-5 text-amber-400" />
                <span>Evolución por Bloques de 4 Semanas</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Medias semanales de cada bloque de 4 semanas (el último termina en la semana actual). Calculado con tus entrenos completados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {blocks.map((b, idx) => (
                <div
                  key={b.id}
                  className={`bg-zinc-950 border rounded-2xl p-5 space-y-3 ${
                    idx === blocks.length - 1 ? 'border-amber-500/80 ring-1 ring-amber-500/30' : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      {idx === blocks.length - 1 ? 'Bloque actual' : 'Bloque anterior'}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">{b.weeksCount} semanas</span>
                  </div>
                  <h4 className="text-sm font-black text-zinc-100">{b.label}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Media semanal</span>
                      <strong className="text-zinc-200">{b.avgWeeklyKm} km</strong>
                      <span className="text-[10px] text-amber-400 block">+{b.avgWeeklyGainM} m D+</span>
                    </div>
                    <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Horas / TSS semana</span>
                      <strong className="text-zinc-200">{b.avgWeeklyHours} h</strong>
                      <span className="text-[10px] text-zinc-400 block">{b.avgWeeklyTss} TSS</span>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/60 text-xs flex items-center justify-between">
                    <span className="text-zinc-400 text-[11px]">En verde (ZoneSense):</span>
                    <span className="text-emerald-400 font-bold text-[11px]">{b.aerobicPct !== null ? `${b.aerobicPct}%` : 'sin datos'}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">D+ total del bloque: <strong className="text-zinc-300">+{b.totalGainM} m</strong></div>
                </div>
              ))}
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
                <span className="text-4xl sm:text-5xl font-black text-zinc-100 tracking-tight">{currentWeight || '—'}</span>
                <span className="text-base text-zinc-400 font-bold">kg actuales</span>
                <span className="text-xs text-zinc-500 ml-auto font-mono">Altura: {profile.heightCm || '—'} cm</span>
              </div>

              {/* Progress to target */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Peso objetivo:</span>
                  <span className="text-emerald-400 font-bold">{targetWeight || '—'} kg</span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-700"
                    style={{ 
                      width: `${weightProgressPct}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Primer pesaje: {startWeight || '—'} kg</span>
                  <span className="text-amber-400 font-semibold">{targetWeight <= 0 ? 'Define tu peso objetivo' : weightDeltaToTarget > 0 ? `-${weightDeltaToTarget} kg restantes` : '¡Peso objetivo alcanzado!'}</span>
                </div>
              </div>

              {/* Quick Vital Stats */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-500 block uppercase">Índice Masa Corporal</span>
                  <strong className="text-zinc-200 text-base">{currentBmi}</strong>
                  <span className="text-[10px] text-zinc-400 block">peso / altura²</span>
                </div>

                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-500 block uppercase">% Grasa Corporal</span>
                  <strong className="text-zinc-200 text-base">{latestBodyFat != null ? `${latestBodyFat}%` : '—'}</strong>
                  <span className="text-[10px] text-zinc-400 block">{latestBodyFat != null ? 'Último pesaje con % grasa' : 'Sin registrar'}</span>
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
                  Peso y desnivel
                </h3>
                <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                  Cada kilo de más hay que subirlo durante todo el desnivel positivo de la carrera. La app no calcula kcal ni minutos ahorrados por kilo: no hay un dato validado para ti.
                </p>
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
