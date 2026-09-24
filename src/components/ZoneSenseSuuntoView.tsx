import React, { useState } from 'react';
import { 
  Watch, 
  Activity, 
  Upload, 
  Zap, 
  Heart, 
  CheckCircle2, 
  ShieldAlert, 
  Copy, 
  Check, 
  Code,
  Sliders,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Flame
} from 'lucide-react';
import { AthleteProfile, SuuntoIntegrationConfig } from '../types';
import { SUUNTO_MCP_CONNECTOR_URL } from '../services/storage';
import { parseFitFile, ParsedFitResult } from '../utils/fitParser';
import { interpretDfaAlpha1, explainZoneSenseDecoupling } from '../utils/zoneSense';

interface ZoneSenseSuuntoViewProps {
  profile: AthleteProfile;
  suuntoConfig: SuuntoIntegrationConfig;
  onDisconnectSuunto: () => void;
  onSyncSuunto: () => Promise<string>;
  isSyncingSuunto: boolean;
}

export const ZoneSenseSuuntoView: React.FC<ZoneSenseSuuntoViewProps> = ({
  profile,
  suuntoConfig,
  onDisconnectSuunto,
  onSyncSuunto,
  isSyncingSuunto,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'education' | 'fit_analyzer' | 'mcp_integration'>('education');
  
  // Interactive Simulator for DFA a1
  const [testHr, setTestHr] = useState(140);
  const [testDfa, setTestDfa] = useState(0.82);

  // FIT file state
  const [isParsingFit, setIsParsingFit] = useState(false);
  const [parsedFitData, setParsedFitData] = useState<ParsedFitResult | null>(null);

  // Suunto Config state
  const [copiedMcp, setCopiedMcp] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const interpretation = interpretDfaAlpha1(testDfa, profile.aetHr, profile.antHr);
  const decouplingNote = explainZoneSenseDecoupling(testHr, profile.aetHr, testDfa);

  const handleFitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFit(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseFitFile(buffer, file.name, profile.aetHr, profile.antHr);
      setParsedFitData(result);
      setNotification({ message: `Archivo ${file.name} procesado correctamente. Métricas extraídas con éxito.`, type: 'success' });
    } catch (err: any) {
      setNotification({ message: `Error al procesar archivo FIT: ${err.message}`, type: 'error' });
    } finally {
      setIsParsingFit(false);
    }
  };

  const handleSync = async () => {
    const message = await onSyncSuunto();
    setNotification({ message, type: message.startsWith('Fallo') ? 'error' : 'success' });
  };


  // Connector para claude.ai (Settings → Connectors → Add custom connector)
  const mcpConfigSnippet = SUUNTO_MCP_CONNECTOR_URL;

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpConfigSnippet);
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg ${
          notification.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
            : 'bg-red-950/80 border-red-500/40 text-red-200'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-zinc-100 ml-4 font-bold">✕</button>
        </div>
      )}

      {/* Connection Diagnostic Banner: Suunto API vs .FIT */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-cyan-950/30 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-zinc-100">
                  ¿Cómo saber si el entrenador conecta con la API o si debes subir el archivo .FIT?
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  suuntoConfig.connected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {suuntoConfig.connected ? '🟢 Cuenta Suunto Conectada' : '🟡 Modo Archivos .FIT Activo'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Dos vías directas y seguras para registrar tus sesiones sin inventar métricas fisiológicas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setActiveSubTab('fit_analyzer')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-black transition cursor-pointer flex items-center space-x-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Archivo .FIT Ahora</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-cyan-400 font-bold uppercase text-[11px] tracking-wider">
                1. Conexión Directa por API Oficial
              </strong>
              <span className="text-[10px] font-mono text-zinc-400">Suunto Cloud API</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              <strong>¿Cómo saber si está conectada?</strong> En la pestaña <em>"Conexión Suunto &amp; Claude MCP"</em> pulsa <strong>Conectar Suunto</strong> e inicia sesión con tu cuenta Suunto. Si el estado está en <strong>VERDE</strong>, pulsa <strong>Sincronizar</strong> para traer entrenos, sueño y HRV de los últimos 28 días.
            </p>
          </div>

          <div className="bg-zinc-950 p-4 rounded-2xl border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-emerald-400 font-bold uppercase text-[11px] tracking-wider">
                2. Subida de Archivos .FIT (Recomendada & Sin Claves)
              </strong>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">100% Plug & Play</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              <strong>¿No tienes API de Suunto? ¡No importa!</strong> Exporta el archivo <code>.fit</code> desde la app de Suunto en tu móvil o web y súbelo en la pestaña <em>"Analizador de Archivos .FIT"</em>. Miguel lee de inmediato las pulsaciones segundo a segundo, la curva DFA a1 de ZoneSense, la cadencia y el desnivel.
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex space-x-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveSubTab('education')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'education'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Watch className="w-4 h-4 text-amber-400" />
          <span>Fisiología Suunto ZoneSense</span>
        </button>

        <button
          onClick={() => setActiveSubTab('fit_analyzer')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'fit_analyzer'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          <span>Analizador de Archivos .FIT</span>
        </button>

        <button
          onClick={() => setActiveSubTab('mcp_integration')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'mcp_integration'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Code className="w-4 h-4 text-cyan-400" />
          <span>Conexión Suunto & Claude MCP</span>
        </button>
      </div>

      {/* 1. ZoneSense Physiology & Simulator */}
      {activeSubTab === 'education' && (
        <div className="space-y-6">
          
          {/* Header Explanation */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-100">
                  ¿Qué es Suunto ZoneSense y qué hay detrás?
                </h3>
                <p className="text-xs text-zinc-400">
                  El salto de las zonas fijas de pulso al monitoreo del estrés celular en tiempo real
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Tradicionalmente, los corredores de montaña nos guiamos por zonas de frecuencia cardíaca calculadas en laboratorio. Pero en un ultra trail como <strong>Transvulcania</strong>, el pulso sufre <em>deriva cardíaca</em> por calor, deshidratación, falta de sueño y altitud.
            </p>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              <strong>Suunto ZoneSense</strong> utiliza el análisis de fluctuación sin tendencia (<strong>DFA alpha-1</strong>) sobre la variabilidad de la frecuencia cardíaca (HRV) <em>durante el ejercicio</em>. Mide la correlación fractal de los latidos del corazón: cuando tu cuerpo entra en fatiga metabólica o acumula lactato, la fractalidad se desmorona de forma medible e instantánea.
            </p>

            {/* 3 Biological Thresholds with BPM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-emerald-900/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                    Aeróbico Puro (Z1 - Z2)
                  </span>
                  <span className="text-xs font-bold text-zinc-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    DFA a1 ≥ 0.75
                  </span>
                </div>
                <div className="text-sm font-black text-emerald-300 font-mono">
                  &lt; {profile.aetHr} bpm
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Tono parasimpático preservado. El motor funciona con oxidación de grasas y lactato basal (&lt;1.5 mmol/L). <strong>Aquí debe ocurrir el 85% de tu preparación para Transvulcania.</strong>
                </p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-amber-900/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                    Transición / Tempo (Z3)
                  </span>
                  <span className="text-xs font-bold text-zinc-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    0.75 &gt; a1 ≥ 0.50
                  </span>
                </div>
                <div className="text-sm font-black text-amber-300 font-mono">
                  {profile.aetHr + 1} - {profile.antHr} bpm
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Superado el Umbral Aeróbico (AeT). Comienza el consumo acelerado de glucógeno y la acumulación de metabolitos. En ultras, pasar horas aquí conduce al temido "muro".
                </p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-red-900/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-red-400 uppercase tracking-wider">
                    Anaeróbico (Z4 - Z5)
                  </span>
                  <span className="text-xs font-bold text-zinc-300 bg-red-950 px-2 py-0.5 rounded border border-red-800">
                    DFA a1 &lt; 0.50
                  </span>
                </div>
                <div className="text-sm font-black text-red-300 font-mono">
                  &gt; {profile.antHr} bpm
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Superado el Umbral Anaeróbico (AnT / LT2). Estrés simpático extremo, ácido láctico en sangre y fatiga en pocos minutos. Reservado para picos de potencia aeróbica.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive ZoneSense Diagnostic Simulator */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-2 text-zinc-100 font-black">
              <Sliders className="w-5 h-5 text-amber-400" />
              <span>Simulador Interactivo de Decoupling & ZoneSense</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Frecuencia Cardíaca en Subida</span>
                    <span className="font-bold text-zinc-200">{testHr} bpm (Tu AeT: {profile.aetHr} bpm)</span>
                  </div>
                  <input
                    type="range"
                    min="110"
                    max="180"
                    value={testHr}
                    onChange={(e) => setTestHr(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Métrica Suunto ZoneSense (DFA a1)</span>
                    <span className="font-bold text-emerald-400">{testDfa.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.30"
                    max="1.10"
                    step="0.02"
                    value={testDfa}
                    onChange={(e) => setTestDfa(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>&lt; 0.50 Anaeróbico</span>
                    <span>0.75 Umbral AeT</span>
                    <span>&gt; 0.85 Aeróbico Alto</span>
                  </div>
                </div>
              </div>

              {/* Real-Time Interpretation Result */}
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400">Estado Celular:</span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${interpretation.color}20`, color: interpretation.color, border: `1px solid ${interpretation.color}40` }}>
                    {interpretation.zone}
                  </span>
                </div>

                <div className="text-xs text-zinc-300">
                  <strong>Pulsaciones equivalentes:</strong> <span className="font-mono font-bold text-amber-400">{interpretation.bpmRangeLabel}</span>
                </div>

                <div className="text-xs text-zinc-300">
                  <strong>Metabolismo:</strong> {interpretation.metabolism}
                </div>

                <div className="text-xs text-zinc-400">
                  <strong>Lactato:</strong> {interpretation.lactateState}
                </div>

                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-xs text-amber-300 font-medium">
                  <strong>Veredicto Miguel:</strong> {decouplingNote}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2. FIT File Analyzer */}
      {activeSubTab === 'fit_analyzer' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="text-lg font-black text-zinc-100 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              <span>Analizador Real de Archivos .FIT de Suunto</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Sube tus actividades directamente exportadas de la app de Suunto o de tu reloj. Sin datos simulados: analiza tus registros exactos.
            </p>

            {/* Suunto Connection Fallback Banner */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
              <Watch className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="block text-amber-100 text-sm mb-0.5">
                  Protocolo de Conexión Suunto
                </strong>
                Si tu cuenta Suunto está conectada (pestaña "Conexión Suunto &amp; Claude MCP"), la sincronización trae los resúmenes de cada entreno
                (duración, desnivel, FC, TSS y tiempo en zonas ZoneSense). Sube aquí el archivo <strong>.FIT</strong> cuando quieras
                el análisis segundo a segundo de una sesión concreta.
              </div>
            </div>

            <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-2xl p-8 text-center transition-all bg-zinc-950/60">
              <Watch className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-zinc-200">
                Arrastra tu archivo .FIT aquí
              </h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Compatible con Suunto Race, Suunto Vertical, Suunto 9 Peak Pro y bandas de frecuencia cardíaca.
              </p>

              <label className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black text-xs cursor-pointer shadow-lg transition-all">
                {isParsingFit ? 'Procesando archivo binario...' : 'Examinar archivo .FIT'}
                <input
                  type="file"
                  accept=".fit"
                  onChange={handleFitUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Parsed Results */}
            {parsedFitData && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-6 mt-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-base font-black text-zinc-100">{parsedFitData.fileName}</h4>
                    <span className="text-xs text-zinc-500">{parsedFitData.startTime || 'Actividad completada'}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    Procesado con éxito
                  </span>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-500 font-semibold">Distancia</span>
                    <div className="text-lg font-black text-zinc-100">{parsedFitData.totalDistanceKm} km</div>
                  </div>

                  <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-500 font-semibold">Desnivel</span>
                    <div className="text-lg font-black text-amber-400">+{parsedFitData.totalAscentM}m / -{parsedFitData.totalDescentM}m</div>
                  </div>

                  <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-500 font-semibold">Duración Total</span>
                    <div className="text-lg font-black text-zinc-100">{parsedFitData.totalDurationMin} min</div>
                  </div>

                  <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-500 font-semibold">Pulso Medio / Máx</span>
                    <div className="text-lg font-black text-red-400">{parsedFitData.avgHeartRate} / {parsedFitData.maxHeartRate} bpm</div>
                  </div>
                </div>

                {/* ZoneSense / Uphill Athlete Metabolic Distribution */}
                <div className="space-y-3 bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-200">Distribución Metabólica (Calibrada con tu AeT de {profile.aetHr} bpm):</span>
                    <span className="font-bold text-emerald-400">
                      ZoneSense Est: DFA a1 ~ {parsedFitData.estimatedDfaAlpha1?.toFixed(2)}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${parsedFitData.timeInAerobicPct}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Aeróbico Z1-Z2: ${parsedFitData.timeInAerobicPct}%`}
                    />
                    <div
                      style={{ width: `${parsedFitData.timeInTransitionPct}%` }}
                      className="bg-amber-500 h-full"
                      title={`Transición Z3: ${parsedFitData.timeInTransitionPct}%`}
                    />
                    <div
                      style={{ width: `${parsedFitData.timeInAnaerobicPct}%` }}
                      className="bg-red-500 h-full"
                      title={`Anaeróbico Z4-Z5: ${parsedFitData.timeInAnaerobicPct}%`}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-zinc-400">
                    <span className="text-emerald-400">Aeróbico: {parsedFitData.timeInAerobicPct}%</span>
                    <span className="text-amber-400">Transición (Z3): {parsedFitData.timeInTransitionPct}%</span>
                    <span className="text-red-400">Anaeróbico: {parsedFitData.timeInAnaerobicPct}%</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Suunto API & Claude MCP Setup */}
      {activeSubTab === 'mcp_integration' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-100">
                  Conexión Suunto & Claude MCP
                </h3>
                <p className="text-xs text-zinc-400">
                  Sincronización real con tu cuenta Suunto a través del servidor MCP de Suunto
                </p>
              </div>
            </div>

            {/* Suunto account connection (OAuth vía el servidor MCP de Suunto) */}
            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Cuenta Suunto
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pulsa <strong>Conectar Suunto</strong>, inicia sesión con tu usuario y contraseña de Suunto y acepta. No hace falta
                ninguna clave de desarrollador: la conexión pasa por el servidor MCP de Suunto ya desplegado. Solo hay que hacerlo una vez
                en cada navegador/dispositivo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <span className="block text-zinc-500">Estado</span>
                  <span className={`font-bold ${suuntoConfig.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {suuntoConfig.connected ? 'Conectado' : 'No conectado'}
                  </span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <span className="block text-zinc-500">Última sincronización</span>
                  <span className="font-bold text-zinc-200">
                    {suuntoConfig.lastSync ? new Date(suuntoConfig.lastSync).toLocaleString() : 'Nunca'}
                  </span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <span className="block text-zinc-500">Entrenos en la última sync</span>
                  <span className="font-bold text-zinc-200">{suuntoConfig.totalActivitiesSynced ?? 0}</span>
                </div>
              </div>

              {suuntoConfig.lastSyncMessage && (
                <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  {suuntoConfig.lastSyncMessage}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {suuntoConfig.connected ? (
                  <>
                    <button
                      onClick={handleSync}
                      disabled={isSyncingSuunto}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      {isSyncingSuunto ? 'Sincronizando…' : 'Sincronizar ahora (últimos 28 días)'}
                    </button>
                    <button
                      onClick={onDisconnectSuunto}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700"
                    >
                      Desconectar
                    </button>
                  </>
                ) : (
                  <a
                    href="/api/suunto/connect"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs shadow-md transition-all"
                  >
                    Conectar Suunto
                  </a>
                )}
              </div>
            </div>

            {/* Claude MCP Snippet */}
            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Connector de Suunto para Claude (opcional)
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    En claude.ai → Settings → Connectors → <em>Add custom connector</em>, pega esta URL e inicia sesión con Suunto.
                  </p>
                </div>
                <button
                  onClick={handleCopyMcp}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700"
                >
                  {copiedMcp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMcp ? 'Copiado' : 'Copiar URL'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-zinc-900 text-xs text-emerald-300 font-mono overflow-x-auto border border-zinc-800">
                {mcpConfigSnippet}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
