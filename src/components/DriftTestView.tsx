import React, { useState } from 'react';
import { 
  Activity, 
  Heart, 
  Dumbbell, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  Save, 
  TrendingUp, 
  Zap,
  Info
} from 'lucide-react';
import { AthleteProfile } from '../types';
import { 
  calculateHeartRateDrift, 
  checkAerobicDeficiency, 
  UPHILL_ATHLETE_OUTDOOR_EXERCISES,
  DriftTestResult, hasAerobicDeficiency } from '../utils/uphillAthlete';

interface DriftTestViewProps {
  profile: AthleteProfile;
  onUpdateProfile: (updated: AthleteProfile) => void;
}

export const DriftTestView: React.FC<DriftTestViewProps> = ({
  profile,
  onUpdateProfile,
}) => {
  // Drift test inputs
  // Vacíos hasta que escribas las FC de TU test (antes venían rellenos con cifras de ejemplo)
  const [hrFirstHalf, setHrFirstHalf] = useState<number>(0);
  const [hrSecondHalf, setHrSecondHalf] = useState<number>(0);
  const [driftResult, setDriftResult] = useState<DriftTestResult | null>(null);

  // Umbrales manuales
  const [aetInput, setAetInput] = useState<number>(profile.aetHr);
  const [antInput, setAntInput] = useState<number>(profile.antHr);

  const adsDiagnostic = checkAerobicDeficiency(aetInput, antInput);
  const adsKnown = hasAerobicDeficiency(aetInput, antInput) != null;

  const handleCalculateDrift = () => {
    if (!(hrFirstHalf > 0 && hrSecondHalf > 0)) {
      alert('Escribe la FC media de cada mitad de tu test (la ves en la App de Suunto dividiendo el entreno en dos).');
      return;
    }
    const res = calculateHeartRateDrift(hrFirstHalf, hrSecondHalf);
    setDriftResult(res);
  };

  const handleApplyDriftToProfile = () => {
    if (!driftResult) return;

    // Manual Uphill Athlete: con deriva ≤ 5 % la FC de la primera mitad es tu AeT
    // (o un mínimo si < 3,5 %). Con > 5 % el test estuvo por encima: el AeT es más
    // bajo pero no se sabe cuánto, así que no se inventa ninguna cifra.
    const testHr = Math.round(hrFirstHalf);
    const aetKnown = driftResult.driftPercentage <= 5.0 && testHr > 0;
    const newAet = aetKnown ? testHr : profile.aetHr;
    const ads = aetKnown ? hasAerobicDeficiency(newAet, profile.antHr) : null;

    const updated: AthleteProfile = {
      ...profile,
      aetHr: newAet,
      ...(ads != null ? { hasAds: ads } : {}),
      driftTestResultPct: driftResult.driftPercentage,
    };

    onUpdateProfile(updated);
    alert(
      aetKnown
        ? `Test guardado. Umbral aeróbico (AeT) = ${newAet} ppm${driftResult.driftPercentage < 3.5 ? ' (como mínimo: repite el test algo más alto para afinarlo)' : ''}.`
        : `Test guardado (deriva ${driftResult.driftPercentage} %). Tu AeT está por debajo de ${testHr} ppm: repite el test 5–10 ppm más bajo. No se cambia tu AeT.`,
    );
  };

  const handleSaveThresholds = () => {
    const updated: AthleteProfile = {
      ...profile,
      aetHr: aetInput,
      antHr: antInput,
      hasAds: adsDiagnostic.hasAds,
    };
    onUpdateProfile(updated);
    alert('Umbrales actualizados.');
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-100">
              Fisiología Uphill Athlete & Test de Deriva Cardíaca
            </h2>
            <p className="text-xs text-zinc-400">
              Protocolo para determinar tu verdadero Umbral Aeróbico (AeT) y erradicar el ADS
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Drift Test Calculator & ADS Diagnosis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Heart Rate Drift Test (60 min) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center space-x-2 text-zinc-100 font-extrabold text-base">
            <Heart className="w-5 h-5 text-red-400" />
            <span>Test de Deriva Cardíaca (Heart Rate Drift Test)</span>
          </div>

          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-xs text-zinc-300 space-y-2 leading-relaxed">
            <div className="font-bold text-amber-400 flex items-center space-x-1.5">
              <Info className="w-4 h-4" />
              <span>Protocolo Oficial del Manual Uphill Athlete:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>15 minutos de calentamiento progresivo muy suave.</li>
              <li>60 minutos a ritmo estrictamente constante en llano o cinta a tu FC prevista de AeT ({profile.aetHr} bpm).</li>
              <li>Anota la FC media de los primeros 30 min y de los últimos 30 min.</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium">FC Media 1ª Mitad (bpm)</label>
              <input
                type="number"
                value={hrFirstHalf || ''}
                placeholder="ppm"
                onChange={(e) => setHrFirstHalf(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 font-bold"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">FC Media 2ª Mitad (bpm)</label>
              <input
                type="number"
                value={hrSecondHalf || ''}
                placeholder="ppm"
                onChange={(e) => setHrSecondHalf(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleCalculateDrift}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-zinc-950 font-black text-xs shadow-lg transition-all"
          >
            Calcular Deriva Cardíaca
          </button>

          {driftResult && (
            <div className={`p-5 rounded-2xl border space-y-3 ${
              driftResult.driftPercentage <= 5.0
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                : 'bg-red-950/20 border-red-800/40 text-red-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-extrabold">{driftResult.statusText}</span>
                <span className="text-lg font-black">{driftResult.driftPercentage}% deriva</span>
              </div>

              <p className="text-xs opacity-90 leading-relaxed">{driftResult.interpretation}</p>

              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 text-xs">
                <strong>Recomendación de Miguel:</strong> {driftResult.recommendation}
              </div>

              <button
                onClick={handleApplyDriftToProfile}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition-all border border-zinc-700"
              >
                Aplicar calibración a mi perfil
              </button>
            </div>
          )}
        </div>

        {/* Aerobic Deficiency Syndrome (ADS) Diagnostic */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center space-x-2 text-zinc-100 font-extrabold text-base">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Diagnóstico de ADS (Síndrome de Deficiencia Aeróbica)</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Según Scott Johnston y Steve House, en un corredor bien entrenado aeróbicamente, el umbral aeróbico (AeT) está a menos del 10% de diferencia (o menos de 20 bpm) de su umbral anaeróbico (AnT).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Tu Umbral Aeróbico (AeT)</label>
              <input
                type="number"
                value={aetInput}
                onChange={(e) => setAetInput(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 font-bold"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Tu Umbral Anaeróbico (AnT)</label>
              <input
                type="number"
                value={antInput}
                onChange={(e) => setAntInput(Number(e.target.value))}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleSaveThresholds}
            className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition-all"
          >
            Actualizar Umbrales
          </button>

          {/* Diagnostic Result */}
          <div className={`p-5 rounded-2xl border space-y-2 ${
            !adsKnown
              ? 'bg-zinc-900/40 border-zinc-700 text-zinc-300'
              : adsDiagnostic.hasAds
              ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
              : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
          }`}>
            <div className="flex items-center space-x-2">
              {adsDiagnostic.hasAds ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              <span className="text-sm font-bold">
                {!adsKnown ? 'Sin diagnóstico' : adsDiagnostic.hasAds ? 'ADS Detectado' : 'Motor Aeróbico Equilibrado'}
              </span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              {adsKnown ? adsDiagnostic.message : 'Hacen falta tu AeT y tu AnT medidos (test de deriva, test de umbral o ZoneSense) para saber si tienes ADS.'}
            </p>
          </div>
        </div>

      </div>

      {/* Bodyweight & Outdoor Mountain Strength Library */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-zinc-100 flex items-center space-x-2">
            <Dumbbell className="w-5 h-5 text-indigo-400" />
            <span>Biblioteca de Fuerza Uphill Athlete (Sin Gimnasio / Al Aire Libre)</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Ejercicios clave con peso corporal, escalones y cuestas naturales para blindar articulaciones y cuádriceps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {UPHILL_ATHLETE_OUTDOOR_EXERCISES.map((ex, idx) => (
            <div
              key={idx}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3 hover:border-zinc-700 transition-all"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-bold text-zinc-100">{ex.name}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Outdoor
                </span>
              </div>

              <div className="text-xs font-bold text-indigo-400">
                {ex.sets} series x {ex.reps}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">{ex.notes}</p>

              <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/80">
                <strong>Músculo objetivo:</strong> {ex.targetMuscle}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
