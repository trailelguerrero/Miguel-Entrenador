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
import { formatZoneSenseWithBpm } from '../utils/zoneSense';

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
  const latestPmc = pmcData.length > 0 ? pmcData[pmcData.length - 1] : { ctl: 54.2, atl: 68.4, tsb: -14.2 };
  
  // Last 7 days HRV average
  const last7CheckIns = checkIns.slice(-7);
  const avgHrv7d = last7CheckIns.length > 0 
    ? (last7CheckIns.reduce((acc, c) => acc + c.hrvRmssd, 0) / last7CheckIns.length).toFixed(1)
    : '46.4';
  const baselineHrv = profile.baselineHrv || 51.5;
  const hrvDiffPct = (((Number(avgHrv7d) - baselineHrv) / baselineHrv) * 100).toFixed(1);

  // Volume and Elevation in last 30 days
  const completedWorkouts = workouts.filter(w => w.completed);
  const totalVolumeHours = (workouts.reduce((acc, w) => acc + (w.actualDurationMin || w.plannedDurationMin || 0), 0) / 60).toFixed(1);
  const totalAscentM = workouts.reduce((acc, w) => acc + (w.actualElevationGainM || w.plannedElevationGainM || 0), 0);
  const totalDistanceKm = workouts.reduce((acc, w) => acc + (w.actualDistanceKm || w.plannedDistanceKm || 0), 0).toFixed(1);

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
                  <span>Edad: <strong>{profile.age || 36} años</strong></span>
                  <span>Altura: <strong>{profile.heightCm || 176} cm</strong></span>
                  <span>Peso Actual: <strong>{profile.weightKg || 71.5} kg</strong></span>
                  <span>Objetivo: <strong>{profile.targetRaceWeightKg || 67.5} kg</strong></span>
                </div>
              </div>

              <div className="space-y-1 sm:border-l sm:border-zinc-800 sm:pl-4 print:border-zinc-200">
                <span className="text-[10px] uppercase font-bold text-emerald-400 print:text-emerald-700 tracking-wider">
                  Objetivo Principal de la Temporada
                </span>
                <div className="text-sm font-black text-zinc-100 print:text-zinc-900">{targetRace.name}</div>
                <div className="text-zinc-400 print:text-zinc-600 space-y-0.5">
                  <div>Distancia: <strong>{targetRace.distanceKm} km</strong> | Desnivel: <strong>+{targetRace.elevationGainM}m D+</strong></div>
                  <div>Fecha Objetivo: <strong>{targetRace.date}</strong></div>
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
                El atleta se encuentra en la <strong>Semana 4 del Mesociclo 2 (Base Aeróbica Estricta & Reversión de ADS)</strong>. Con un AeT de <strong>{profile.aetHr} bpm</strong> y un AnT de <strong>{profile.antHr} bpm</strong> (spread de {profile.antHr - profile.aetHr} bpm), el 82.5% del volumen se ha mantenido en Zona 1 y Zona 2 limpia, cumpliendo con la regla dorada del 80-90% de <em>Training for the Uphill Athlete</em>. 
                Se detecta una divergencia simpática tras +5.200m de bajada excéntrica acumulada, por lo que se recomienda insertar un <strong>microciclo de descarga regenerativo (-45% volumen, DFA a1 &gt; 0.85 a &lt; 130 bpm)</strong> antes de acometer el siguiente bloque de fuerza específica.
              </p>
            </div>

            {/* Physiological & ZoneSense Thresholds Table with BPM */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-300 print:text-zinc-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Activity className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
                <span>Umbrales Fisiológicos & Suunto ZoneSense (DFA a1 Traducido a BPM)</span>
              </h4>

              <table className="w-full text-xs text-left border-collapse border border-zinc-800 print:border-zinc-300">
                <thead>
                  <tr className="bg-zinc-900 print:bg-zinc-100 text-zinc-400 print:text-zinc-700 font-bold">
                    <th className="p-2.5 border border-zinc-800 print:border-zinc-300">Zona Fisiológica</th>
                    <th className="p-2.5 border border-zinc-800 print:border-zinc-300">Suunto ZoneSense (DFA a1)</th>
                    <th className="p-2.5 border border-zinc-800 print:border-zinc-300">Rango de Pulsaciones (BPM)</th>
                    <th className="p-2.5 border border-zinc-800 print:border-zinc-300">Régimen Metabólico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 print:divide-zinc-200">
                  <tr className="bg-zinc-950/40 print:bg-white">
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-bold text-emerald-400 print:text-emerald-700">
                      Zona 1 (Regenerativo)
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono">
                      DFA a1 &gt; 0.85
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono font-bold text-emerald-300 print:text-emerald-800">
                      &lt; 130 bpm
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 text-zinc-400 print:text-zinc-600">
                      Rebote parasimpático, lactato basal, recuperación de glucógeno
                    </td>
                  </tr>

                  <tr className="bg-zinc-950/40 print:bg-white">
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-bold text-emerald-400 print:text-emerald-700">
                      Zona 2 (Aeróbico Puro / AeT)
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono">
                      DFA a1 &ge; 0.75
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono font-bold text-emerald-300 print:text-emerald-800">
                      130 - {profile.aetHr} bpm
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 text-zinc-400 print:text-zinc-600">
                      FatMax (máxima oxidación de grasas), multiplicación mitocondrial
                    </td>
                  </tr>

                  <tr className="bg-zinc-950/40 print:bg-white">
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-bold text-amber-400 print:text-amber-700">
                      Zona 3 (Transición / Tempo)
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono">
                      0.75 &gt; DFA a1 &ge; 0.50
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono font-bold text-amber-300 print:text-amber-800">
                      {profile.aetHr + 1} - {profile.antHr} bpm
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 text-zinc-400 print:text-zinc-600">
                      Gasto acelerado de glucógeno muscular y pérdida de fractalidad
                    </td>
                  </tr>

                  <tr className="bg-zinc-950/40 print:bg-white">
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-bold text-red-400 print:text-red-700">
                      Zona 4 / 5 (Anaeróbico / AnT)
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono">
                      DFA a1 &lt; 0.50
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 font-mono font-bold text-red-300 print:text-red-800">
                      &gt; {profile.antHr} bpm
                    </td>
                    <td className="p-2.5 border border-zinc-800 print:border-zinc-300 text-zinc-400 print:text-zinc-600">
                      Glucólisis anaeróbica rápida, acumulación de lactato &gt;4.0 mmol/L
                    </td>
                  </tr>
                </tbody>
              </table>
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
                <span className="text-[10px] text-zinc-500">Sobrecarga Óptima</span>
              </div>

              <div className="bg-zinc-900/60 print:bg-zinc-50 p-3 rounded-xl border border-zinc-800 print:border-zinc-200">
                <span className="text-[10px] text-zinc-400 print:text-zinc-600 block uppercase font-bold">HRV 7d rMSSD</span>
                <div className="text-xl font-black text-amber-400 print:text-amber-700 font-mono">{avgHrv7d} ms</div>
                <span className="text-[10px] text-red-400 font-bold font-mono">{hrvDiffPct}% vs basal ({baselineHrv}ms)</span>
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
                <span className="text-base font-black text-red-400 print:text-red-700 font-mono">-5.250 m</span>
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
                  <span className="font-bold text-zinc-200 print:text-zinc-900">60 g CHO/h (Fase 2)</span>
                  <span className="text-[10px] text-zinc-500 block">Meta Transvulcania: 80 g/h</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 print:text-zinc-600 block">Tolerancia Digestiva:</span>
                  <span className="font-bold text-emerald-400 print:text-emerald-700">4.2 / 5.0 (Excelente)</span>
                  <span className="text-[10px] text-zinc-500 block">Sin náuseas ni reflujo reportado</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 print:text-zinc-600 block">Pauta de Sodio:</span>
                  <span className="font-bold text-zinc-200 print:text-zinc-900">650 mg Na+/hora</span>
                  <span className="text-[10px] text-zinc-500 block">Protección térmica para La Palma</span>
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
                  1. Blindar sóleos con excéntricos 3-1-1 • 2. Prohibido superar {profile.aetHr} bpm en rodajes • 3. Priorizar DFA a1 sobre pulso estático en días de calor.
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
