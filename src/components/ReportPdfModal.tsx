import { resolveIntensityPrescription } from '../brain/intensity';
import { hrAerobicShare } from '../utils/trainingLoad';
import { describeTsb } from '../utils/pmcCalculations';
import { isAppliedRule } from '../brain/memory';
import { localDateKey } from '../utils/trainingLoad';
import { StorageService } from '../services/storage';
import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  CheckCircle2, 
  Mountain, 
  Heart, 
  Activity, 
  ShieldAlert, 
  Brain,
  Scale,
  Flame,
  Droplets,
  Calendar,
  Zap
} from 'lucide-react';
import { AthleteProfile, TargetRace, Workout, DailyCheckIn, PMCDataPoint } from '../types';

interface ReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AthleteProfile;
  targetRace: TargetRace;
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  pmcData: PMCDataPoint[];
}

export const ReportPdfModal: React.FC<ReportPdfModalProps> = ({
  isOpen,
  onClose,
  profile,
  targetRace,
  workouts,
  checkIns,
  pmcData,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Calculate dynamic metrics
  const latestPmc = pmcData.length > 0 ? pmcData[pmcData.length - 1] : { ctl: 0, atl: 0, tsb: 0 };
  
  // Last 7 days HRV average
  // (los check-ins pueden venir en cualquier orden: se ordenan por fecha)
  const last7CheckIns = [...checkIns]
    .filter(c => c.hrvRmssd > 0)
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(-7);
  const avgHrv7d = last7CheckIns.length > 0 
    ? (last7CheckIns.reduce((acc, c) => acc + c.hrvRmssd, 0) / last7CheckIns.length).toFixed(1)
    : '--';
  const baselineHrv = profile.baselineHrv || 0;
  const hrvDiffPct = baselineHrv > 0 && last7CheckIns.length > 0
    ? (((Number(avgHrv7d) - baselineHrv) / baselineHrv) * 100).toFixed(1)
    : '0.0';

  // Volume and Elevation in last 30 days (solo entrenos completados)
  const since30d = localDateKey(new Date(Date.now() - 29 * 86400000));
  const completedWorkouts = workouts.filter(w => w.completed && w.date >= since30d);
  const totalVolumeHours = (completedWorkouts.reduce((acc, w) => acc + (w.actualDurationMin || 0), 0) / 60).toFixed(1);
  const totalAscentM = completedWorkouts.reduce((acc, w) => acc + (w.actualElevationGainM || 0), 0);
  const descentWorkouts = completedWorkouts.filter(w => w.actualElevationLossM != null);
  const totalDescentM = descentWorkouts.reduce((acc, w) => acc + (w.actualElevationLossM || 0), 0);
  // Gut training e hidratación: solo lo registrado por el atleta
  const gutProfile = StorageService.getGutProfile();
  const gutStagesDone = (gutProfile.stages || []).filter(st => st.status === 'completed').length;
  const gutEntries = gutProfile.entries || [];
  const avgGiTolerance = gutEntries.length > 0
    ? (gutEntries.reduce((acc, e) => acc + e.giToleranceRating, 0) / gutEntries.length).toFixed(1)
    : null;
  const lastSweatTest = [...StorageService.getHydrationTests()].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const totalDistanceKm = completedWorkouts.reduce((acc, w) => acc + (w.actualDistanceKm || 0), 0).toFixed(1);
  // % de tiempo aeróbico (ZoneSense) ponderado por duración, solo entrenos con ese dato
  const zsWorkouts = completedWorkouts.filter(w => w.zoneSenseBreakdown && (w.actualDurationMin || 0) > 0);
  const zsMinutes = zsWorkouts.reduce((acc, w) => acc + (w.actualDurationMin || 0), 0);
  // ZoneSense (segunda opinión)
  const zsAerobicPct30d = zsMinutes > 0
    ? Math.round(zsWorkouts.reduce((acc, w) => acc + (w.actualDurationMin || 0) * w.zoneSenseBreakdown!.aerobicPct, 0) / zsMinutes)
    : null;
  // La referencia: FC media frente al umbral aeróbico (estimación)
  const aerobicPct30d = hrAerobicShare(completedWorkouts, resolveIntensityPrescription(profile).aetHr).pct;

  // Reglas reales de la memoria de Miguel (no textos fijos)
  const learnedRules = StorageService.getCoachMemory().insights.filter(i => isAppliedRule(i.status)).slice(0, 3).map(i => i.ruleForFuturePlans);

  // Handle browser native print (PDF export)
  const handlePrint = () => {
    window.print();
  };

  // Handle HTML report download
  const handleDownloadHtml = () => {
    if (!reportRef.current) return;
    const content = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe_Rendimiento_Uphill_Coach_${profile.name.replace(/\s+/g, '_')}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #18181b; padding: 24px; max-width: 900px; margin: 0 auto; line-height: 1.5; }
    h1, h2, h3, h4 { color: #09090b; margin-top: 0; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #f4f4f5; border: 1px solid #e4e4e7; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .table th, .table td { border: 1px solid #e4e4e7; padding: 8px 12px; text-align: left; }
    .table th { background: #f4f4f5; font-weight: 700; }
    .card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${reportRef.current.innerHTML}
</body>
</html>`;
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_Rendimiento_Uphill_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {/* Container */}
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Control Bar (Hidden in Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800 text-zinc-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-100">Informe Fisiológico & Rendimiento (PDF)</h3>
              <p className="text-[11px] text-zinc-400">Generador de Documento Técnico Uphill Athlete</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black shadow-lg transition-all cursor-pointer"
              title="Abre la ventana de impresión para guardar directamente como archivo PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Guardar / Imprimir PDF</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-all cursor-pointer"
              title="Descargar archivo HTML del informe"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HTML</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-zinc-900 text-zinc-100 font-sans print:p-0 print:bg-white print:text-zinc-900">
          <div 
            id="printable-report-content" 
            ref={reportRef} 
            className="space-y-6 max-w-3xl mx-auto bg-zinc-950/70 p-6 sm:p-8 rounded-2xl border border-zinc-800 print:border-none print:bg-white print:p-0 print:shadow-none"
          >
            
            {/* Header / Brand */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 print:border-zinc-300 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center text-zinc-950 font-black shadow-md print:bg-amber-500">
                  <Mountain className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-black tracking-tight text-zinc-100 print:text-black">UPHILL COACH</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 print:border-amber-600 print:text-amber-800">
                      MIGUEL
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 print:text-zinc-600 font-medium">
                    Informe Técnico de Fisiología, Carga & Periodización de Montaña
                  </p>
                </div>
              </div>

              <div className="text-right text-xs space-y-0.5 print:text-zinc-600">
                <div className="font-mono text-zinc-300 print:text-zinc-900 font-bold">
                  Fecha: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="text-zinc-500 print:text-zinc-600">
                  Método: Uphill Athlete & Suunto ZoneSense
                </div>
              </div>
            </div>

            {/* Athlete Bio & Race Target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/90 print:bg-zinc-50 p-4 rounded-xl border border-zinc-800 print:border-zinc-200 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 print:text-amber-700 tracking-wider">
                  Ficha del Atleta
                </span>
                <div className="text-sm font-black text-zinc-100 print:text-zinc-900">{profile.name}</div>
                <div className="text-zinc-400 print:text-zinc-600 grid grid-cols-2 gap-x-2">
                  <span>Edad: <strong>{profile.age || '—'} años</strong></span>
                  <span>Altura: <strong>{profile.heightCm || '—'} cm</strong></span>
                  <span>Peso Actual: <strong>{profile.weightKg || '—'} kg</strong></span>
                  <span>Objetivo: <strong>{profile.targetRaceWeightKg || '—'} kg</strong></span>
                </div>
              </div>

              <div className="space-y-1 sm:border-l sm:border-zinc-800 sm:pl-4 print:border-zinc-200">
                <span className="text-[10px] uppercase font-bold text-emerald-400 print:text-emerald-700 tracking-wider">
                  Objetivo Principal de la Temporada
                </span>
                <div className="text-sm font-black text-zinc-100 print:text-zinc-900">{targetRace.name}</div>
                <div className="text-zinc-400 print:text-zinc-600 space-y-0.5">
                  <div>Distancia: <strong>{targetRace.distanceKm} km</strong> | Desnivel: <strong>+{targetRace.elevationGainM}m D+</strong></div>
                  <div>Fecha Objetivo: <strong>{targetRace.date}</strong>{targetRace.dateConfirmed === false ? ' (por confirmar)' : ''}</div>
                  <div>Prioridad: <strong>{targetRace.priority}</strong> (Transvulcania Ultra)</div>
                </div>
              </div>
            </div>

            {/* Coach Executive Summary */}
            <div className="p-4 rounded-xl bg-amber-500/10 print:bg-amber-50 border border-amber-500/20 print:border-amber-200 text-xs space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-400 print:text-amber-800 font-bold uppercase tracking-wider text-[11px]">
                <Brain className="w-4 h-4" />
                <span>Dictamen Fisiológico del Coach Miguel:</span>
              </div>
              <p className="text-zinc-200 print:text-zinc-800 leading-relaxed">
                Últimos 30 días: <strong>{completedWorkouts.length} entrenos completados</strong>, {totalVolumeHours} h, {totalDistanceKm} km y +{totalAscentM} m D+.
                AeT <strong>{profile.aetHr} bpm</strong> / AnT <strong>{profile.antHr} bpm</strong> (spread de {profile.antHr - profile.aetHr} bpm).
                {aerobicPct30d !== null
                  ? <> Según tus pulsaciones (FC media de cada entreno), el <strong>{aerobicPct30d}%</strong> del tiempo fue por debajo de tu umbral aeróbico{zsAerobicPct30d !== null ? <> (ZoneSense, como segunda opinión: {zsAerobicPct30d}% en verde)</> : null}.</>
                  : <> No hay entrenos con datos de ZoneSense en este periodo.</>}
                {' '}Estado de carga actual: CTL {latestPmc.ctl.toFixed(1)}, ATL {latestPmc.atl.toFixed(1)}, TSB {latestPmc.tsb.toFixed(1)}.
              </p>
            </div>

            {/* ZoneSense (colores, sin pulsaciones) y zonas de FC del reloj, por separado */}
            <div className="space-y-2 text-xs">
              <h4 className="text-xs font-bold text-zinc-300 print:text-zinc-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Activity className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
                <span>Intensidad: Suunto ZoneSense y zonas de FC</span>
              </h4>
              <p className="text-zinc-300 print:text-zinc-700">
                ZoneSense (banda de pecho) clasifica la intensidad en verde (aeróbico), amarillo (entre umbrales) y rojo (sobre el umbral anaeróbico)
                respecto a la línea base de cada entreno; no equivale a pulsaciones fijas.
                {aerobicPct30d !== null ? <> Últimos 30 días: <strong>{aerobicPct30d}%</strong> del tiempo bajo tu umbral aeróbico (FC media).</> : ' Sin FC o sin umbral aeróbico en los últimos 30 días.'}
              </p>
              <p className="text-zinc-400 print:text-zinc-600">
                Tus umbrales de FC (la referencia de intensidad): umbral aeróbico {profile.aetHr || '—'} ppm · umbral anaeróbico {profile.antHr || '—'} ppm · FC máx {profile.maxHr || '—'} ppm.
              </p>
            </div>

            {/* Key Training Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-zinc-900/60 print:bg-zinc-50 p-3 rounded-xl border border-zinc-800 print:border-zinc-200">
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">Fitness (CTL)</span>
                <div className="text-xl font-black text-emerald-400 print:text-emerald-700 font-mono">{latestPmc.ctl.toFixed(1)}</div>
                <span className="text-[10px] text-zinc-500">Carga Crónica (42d)</span>
              </div>

              <div className="bg-zinc-900/60 print:bg-zinc-50 p-3 rounded-xl border border-zinc-800 print:border-zinc-200">
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">Fatiga (ATL)</span>
                <div className="text-xl font-black text-amber-400 print:text-amber-700 font-mono">{latestPmc.atl.toFixed(1)}</div>
                <span className="text-[10px] text-zinc-500">Carga Aguda (7d)</span>
              </div>

              <div className="bg-zinc-900/60 print:bg-zinc-50 p-3 rounded-xl border border-zinc-800 print:border-zinc-200">
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">Forma (TSB)</span>
                <div className="text-xl font-black text-red-400 print:text-red-700 font-mono">{latestPmc.tsb.toFixed(1)}</div>
                <span className="text-[10px] text-zinc-500">{describeTsb(latestPmc.tsb).label}</span>
              </div>

              <div className="bg-zinc-900/60 print:bg-zinc-50 p-3 rounded-xl border border-zinc-800 print:border-zinc-200">
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">HRV 7d rMSSD</span>
                <div className="text-xl font-black text-amber-400 print:text-amber-700 font-mono">{avgHrv7d} ms</div>
                <span className="text-[10px] text-red-400 font-bold font-mono">
                  {baselineHrv > 0 && last7CheckIns.length > 0 ? `${hrvDiffPct}% vs basal (${baselineHrv}ms)` : 'Sin referencia de HRV'}
                </span>
              </div>
            </div>

            {/* Volume & Elevation Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-zinc-900/60 print:bg-zinc-50 p-4 rounded-xl border border-zinc-800 print:border-zinc-200">
              <div>
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">Volumen Total Acumulado</span>
                <span className="text-base font-black text-zinc-100 print:text-zinc-900 font-mono">{totalVolumeHours} horas</span>
                <span className="text-[11px] text-zinc-400 print:text-zinc-600 block">{totalDistanceKm} km recorridos</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">Desnivel Positivo (+D)</span>
                <span className="text-base font-black text-amber-400 print:text-amber-700 font-mono">+{totalAscentM.toLocaleString()} m</span>
                <span className="text-[11px] text-zinc-400 print:text-zinc-600 block">Adaptación vertical aeróbica</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">Descenso Excéntrico (-D)</span>
                <span className="text-base font-black text-red-400 print:text-red-700 font-mono">
                  {descentWorkouts.length > 0 ? `-${totalDescentM.toLocaleString()} m` : 'Sin dato'}
                </span>
                <span className="text-[11px] text-zinc-400 print:text-zinc-600 block">Blindaje de cuádriceps 3-1-1</span>
              </div>
            </div>

            {/* Nutrition & Gut Training Status */}
            <div className="p-4 rounded-xl bg-zinc-900/60 print:bg-zinc-50 border border-zinc-800 print:border-zinc-200 text-xs space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-400 print:text-amber-700 font-bold uppercase tracking-wider text-[11px]">
                <Flame className="w-4 h-4" />
                <span>Estado de Adaptación Gástrica (Gut Training) & Hidratación:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-zinc-400 print:text-zinc-600 block">Tasa de Carbohidratos:</span>
                  <span className="font-bold text-zinc-200 print:text-zinc-900">
                    {gutProfile.currentMaxCarbsPerHour > 0 ? `${gutProfile.currentMaxCarbsPerHour} g CHO/h (${gutStagesDone} fase(s) completada(s))` : 'Sin tolerancia registrada'}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    {gutProfile.goalCarbsPerHour > 0 ? `Tu objetivo: ${gutProfile.goalCarbsPerHour} g/h` : 'Objetivo sin definir'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 print:text-zinc-600 block">Tolerancia Digestiva:</span>
                  <span className="font-bold text-emerald-400 print:text-emerald-700">
                    {avgGiTolerance ? `${avgGiTolerance} / 5.0` : 'Sin registros'}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    {gutEntries.length > 0 ? `Media de ${gutEntries.length} sesión(es) registrada(s)` : 'Registra tus sesiones de gut training'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 print:text-zinc-600 block">Tasa de sudoración:</span>
                  <span className="font-bold text-zinc-200 print:text-zinc-900">
                    {lastSweatTest ? `${lastSweatTest.sweatRateLitersPerHour} L/h` : 'Sin test'}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    {lastSweatTest ? `Test del ${lastSweatTest.date} a ${lastSweatTest.temperatureC} °C` : 'Sin test no hay pauta personal de sodio'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign-off & Rules Applied */}
            <div className="pt-4 border-t border-zinc-800 print:border-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 uppercase font-bold block">
                  Reglas de Aprendizaje Acumuladas por Miguel:
                </span>
                <p className="text-[11px] text-zinc-400 print:text-zinc-600">
                  {learnedRules.length > 0 ? learnedRules.map((r, i) => `${i + 1}. ${r}`).join(' • ') : 'Miguel aún no ha registrado aprendizajes.'}
                </p>
              </div>

              <div className="text-right sm:shrink-0">
                <div className="text-xs font-bold text-zinc-200 print:text-zinc-900">Miguel • Head Coach</div>
                <div className="text-[10px] text-zinc-500 print:text-zinc-600 font-mono">Uphill Athlete Certified</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
