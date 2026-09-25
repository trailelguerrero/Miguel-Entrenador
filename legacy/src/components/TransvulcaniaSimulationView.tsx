import React, { useState } from 'react';
import { 
  Mountain, 
  Flame, 
  Droplet, 
  ShieldAlert, 
  Clock, 
  Gauge, 
  Compass, 
  CheckCircle2, 
  Printer, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { AthleteProfile, RaceSimulationSegment, TransvulcaniaSimulationPlan } from '../types';
import { StorageService } from '../services/storage';

interface Props {
  profile: AthleteProfile;
  onAskMiguel?: (prompt: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const TransvulcaniaSimulationView: React.FC<Props> = ({ 
  profile,
  onAskMiguel,
  onNavigateToTab
}) => {
  const [targetHours, setTargetHours] = useState<number>(12.5);
  const [plan, setPlan] = useState<TransvulcaniaSimulationPlan>(() => 
    StorageService.getTransvulcaniaPlan(12.5)
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('seg-7'); // Default highlight on the brutal descent of El Time

  const handleHoursChange = (hours: number) => {
    setTargetHours(hours);
    const updated = StorageService.getTransvulcaniaPlan(hours);
    setPlan(updated);
  };

  const selectedSegment = plan.segments.find(s => s.id === selectedSegmentId) || plan.segments[0];

  const totalCarbsGrams = plan.segments.reduce((acc, s) => acc + s.targetCarbsGrams, 0);
  const totalFluidsLiters = Math.round(plan.segments.reduce((acc, s) => acc + s.targetFluidsMl, 0) / 100) / 10;
  const totalSodiumGrams = Math.round(plan.segments.reduce((acc, s) => acc + s.targetSodiumMg, 0) / 100) / 10;

  if (plan.segments.length === 0 || !selectedSegment) {
    return (
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 text-sm text-stone-300 space-y-2">
        <h2 className="text-lg font-black text-stone-100">Simulador Transvulcania</h2>
        <p>
          Los tramos, tiempos y pautas del simulador eran datos de ejemplo (no verificados del recorrido ni tuyos) y solo se muestran en modo prueba.
          Con tus datos reales, pide a Miguel un plan de carrera: lo hará con tu carga, tus ritmos de Suunto y tu tolerancia registrada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Race Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/30">
                Simulador Táctico Uphill
              </span>
              <span className="text-xs text-stone-400 font-medium">
                Objetivo A: 8 de Mayo 2027 • La Palma
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-100 flex items-center gap-3">
              <Mountain className="w-8 h-8 text-emerald-400 shrink-0" />
              Transvulcania Ultramarathon (73K)
            </h1>
            <p className="text-sm text-stone-300 mt-1 max-w-2xl">
              Cálculo tramo a tramo calibrado con tu umbral aeróbico real (<strong>AeT: {profile.aetHr} bpm</strong>), 
              gestión del impacto excéntrico en el descenso de El Time y dosificación estricta de glucógeno.
            </p>
          </div>

          {/* Target Finish Time Controller */}
          <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 min-w-[280px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Tiempo Objetivo:
              </span>
              <span className="text-lg font-black text-emerald-400">
                {plan.estimatedFinishTimeFormatted}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="16.5"
              step="0.5"
              value={targetHours}
              onChange={(e) => handleHoursChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono mt-1">
              <span>10h (Top)</span>
              <span>12h30 (Equilibrado)</span>
              <span>16h30 (Cierre 17h)</span>
            </div>

            {/* Cross-linking Actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-800">
              {onAskMiguel && (
                <button
                  onClick={() => onAskMiguel(`Hola Miguel, estoy analizando la simulación de Transvulcania 73K con tiempo objetivo de ${plan.estimatedFinishTimeFormatted}. ¿Qué estrategia de pulso me aconsejas mantener en la ascensión volcánica a Los Muchachos (2.426m) y cómo afronto muscularmente los -2.400m del descenso de El Time?`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                  title="Preguntar a Miguel sobre este plan de ritmo"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Consultar a Miguel</span>
                </button>
              )}
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('gut')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs font-semibold transition cursor-pointer"
                  title="Ir al entrenamiento digestivo"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ajustar Nutrición</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Race Vital Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-medium mb-1">
            <Compass className="w-4 h-4 text-emerald-400" />
            Distancia & Desnivel
          </div>
          <div className="text-xl font-black text-stone-100">
            73.0 km
          </div>
          <div className="text-xs text-emerald-400/90 font-medium mt-0.5">
            +4.350m D+ / -4.057m D-
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-medium mb-1">
            <Flame className="w-4 h-4 text-amber-400" />
            Glucógeno & Carbohidratos
          </div>
          <div className="text-xl font-black text-stone-100">
            {totalCarbsGrams} g
          </div>
          <div className="text-xs text-amber-400/90 font-medium mt-0.5">
            Promedio: {Math.round(totalCarbsGrams / targetHours)} g/h
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-medium mb-1">
            <Droplet className="w-4 h-4 text-cyan-400" />
            Hidratación & Sales
          </div>
          <div className="text-xl font-black text-stone-100">
            {totalFluidsLiters} L
          </div>
          <div className="text-xs text-cyan-400/90 font-medium mt-0.5">
            {totalSodiumGrams} g Sodio ({Math.round((totalSodiumGrams * 1000) / targetHours)} mg/h)
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-medium mb-1">
            <Gauge className="w-4 h-4 text-rose-400" />
            Límite Cardíaco Crítico
          </div>
          <div className="text-xl font-black text-stone-100">
            ≤ {profile.aetHr} bpm
          </div>
          <div className="text-xs text-rose-400/90 font-medium mt-0.5">
            Sub-AeT obligatorio en subida
          </div>
        </div>
      </div>

      {/* Critical Warning: The 2,410m Descent */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-stone-300">
          <strong className="text-amber-300 block mb-0.5">
            Punto Fisiológico Decisivo: Descenso de El Roque de los Muchachos a Tazacorte (-2.410m en 17 km)
          </strong>
          {plan.eccentricImpactWarning} Miguel te recomienda mantener el pulso bajo (&lt; 132 bpm), acortar la zancada (180+ pasos/min) 
          y evitar frenar clavando el talón para preservar los vastos internos para la subida final al pueblo.
        </div>
      </div>

      {/* Main Interactive Grid: Segments List + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Segments Progression List */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold px-2">
            <span>Tramos del Recorrido Oficial (9 sectores)</span>
            <span>Distancia / Tiempo Estimado</span>
          </div>

          <div className="space-y-2">
            {plan.segments.map((seg, idx) => {
              const isSelected = seg.id === selectedSegmentId;
              const isDescent = seg.elevationLossM > seg.elevationGainM;

              return (
                <button
                  key={seg.id}
                  onClick={() => setSelectedSegmentId(seg.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-stone-850 border-emerald-500 ring-1 ring-emerald-500/50 shadow-lg'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700 hover:bg-stone-850/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-emerald-500 text-stone-950' : 'bg-stone-800 text-stone-400'
                    }`}>
                      {idx + 1}
                    </span>

                    <div className="truncate">
                      <div className="text-xs sm:text-sm font-bold text-stone-100 truncate flex items-center gap-2">
                        {seg.name}
                        {seg.isCutoffPoint && (
                          <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                            Corte
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                        <span>Km {seg.fromKm.toFixed(1)} ➔ {seg.toKm.toFixed(1)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          {isDescent ? (
                            <TrendingDown className="w-3 h-3 text-cyan-400" />
                          ) : (
                            <TrendingUp className="w-3 h-3 text-amber-400" />
                          )}
                          +{seg.elevationGainM}m / -{seg.elevationLossM}m
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                      {Math.floor(seg.estimatedTimeMin / 60) > 0 ? `${Math.floor(seg.estimatedTimeMin / 60)}h ` : ''}
                      {seg.estimatedTimeMin % 60}m
                    </div>
                    <div className="text-[10px] text-stone-500 font-mono">
                      Cap: {seg.targetHrCap} bpm
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Segment Tactical Briefing */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 rounded-2xl bg-stone-900 border border-stone-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                  Instrucción Táctica de Miguel
                </span>
                <h3 className="text-base font-black text-stone-100">
                  {selectedSegment.name}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 font-mono text-xs font-bold">
                Km {selectedSegment.fromKm} - {selectedSegment.toKm} ({(selectedSegment.toKm - selectedSegment.fromKm).toFixed(1)} km)
              </span>
            </div>

            {/* Segment Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                <span className="text-stone-400 block text-[10px]">Pulsaciones Límite</span>
                <span className="text-sm font-bold text-rose-400">≤ {selectedSegment.targetHrCap} bpm</span>
              </div>
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                <span className="text-stone-400 block text-[10px]">Intensidad Recomendada</span>
                <span className="text-xs font-semibold text-emerald-400">{selectedSegment.recommendedEffort}</span>
              </div>
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                <span className="text-stone-400 block text-[10px]">Carbohidratos Tramo</span>
                <span className="text-sm font-bold text-amber-400">{selectedSegment.targetCarbsGrams} g</span>
              </div>
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                <span className="text-stone-400 block text-[10px]">Agua + Sodio</span>
                <span className="text-xs font-semibold text-cyan-400">
                  {selectedSegment.targetFluidsMl} ml / {selectedSegment.targetSodiumMg} mg
                </span>
              </div>
            </div>

            {/* Tactical Advice Box */}
            <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-200">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>Estrategia de Terreno:</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                {selectedSegment.tacticalAdvice}
              </p>
            </div>

            {selectedSegment.isCutoffPoint && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center justify-between">
                <span>Tiempo límite de corte oficial:</span>
                <span className="font-mono font-bold">
                  {Math.floor((selectedSegment.cutoffTimeLimitMinutes || 0) / 60)}h {(selectedSegment.cutoffTimeLimitMinutes || 0) % 60}m
                </span>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Hoja de Ruta para Mochila</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
