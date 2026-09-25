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
  

  // FIT file state
  const [isParsingFit, setIsParsingFit] = useState(false);
  const [parsedFitData, setParsedFitData] = useState<ParsedFitResult | null>(null);

  // Suunto Config state
  const [copiedMcp, setCopiedMcp] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);


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
              <strong>¿No tienes API de Suunto? ¡No importa!</strong> Exporta el archivo <code>.fit</code> desde la app de Suunto en tu móvil o web y súbelo en la pestaña <em>"Analizador de Archivos .FIT"</em>. Miguel lee las pulsaciones segundo a segundo, la cadencia y el desnivel. (El .FIT no incluye ZoneSense: el reparto de zonas se hace por FC con tus umbrales.)
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

      {/* 1. Qué es ZoneSense y cómo se usa (sin pulsaciones fijas) */}
      {activeSubTab === 'education' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-black text-zinc-100">Qué es Suunto ZoneSense</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              ZoneSense mide la intensidad a partir de la <strong>variabilidad entre latidos (intervalos R-R)</strong> durante el ejercicio,
              con el método <strong>DDFA</strong> (análisis de fluctuaciones sin tendencia dinámico), desarrollado en la Universidad de Tampere
              y comercializado por MoniCardi. No es el DFA a1 clásico (con sus cortes fijos 0,75 / 0,50): Suunto usa su propia calibración.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4">
                <div className="font-black text-emerald-400">Verde · Aeróbico</div>
                <p className="text-zinc-300 mt-1">Por debajo del umbral aeróbico de ESE día.</p>
              </div>
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-4">
                <div className="font-black text-amber-400">Amarillo · Anaeróbico</div>
                <p className="text-zinc-300 mt-1">Entre el umbral aeróbico y el anaeróbico de ESE día.</p>
              </div>
              <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-4">
                <div className="font-black text-red-400">Rojo · VO2máx</div>
                <p className="text-zinc-300 mt-1">Por encima del umbral anaeróbico de ESE día.</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 leading-relaxed space-y-2">
              <p><strong className="text-amber-300">Las zonas de ZoneSense no equivalen a ninguna FC concreta.</strong> Se calculan como un desplazamiento respecto a tu nivel aeróbico de referencia del día (la "línea base" que el reloj toma al empezar suave). La misma FC puede ser verde un día y amarilla otro (fatiga, calor, cafeína, altitud), o verde corriendo y amarilla en bici.</p>
              <p>Por eso la app nunca traduce los colores de ZoneSense a pulsaciones. Tus <strong>zonas de FC</strong> ({profile.aetHr ? `umbral aeróbico ${profile.aetHr} ppm` : 'sin umbral aeróbico'}{profile.antHr ? `, anaeróbico ${profile.antHr} ppm` : ''}) son otra referencia, útil cuando no llevas banda de pecho.</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
            <h3 className="text-base font-black text-zinc-100">Cómo usarlo bien</h3>
            <ul className="text-xs text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
              <li><strong>Banda de pecho obligatoria:</strong> necesita los intervalos R-R exactos; el sensor óptico de muñeca no sirve.</li>
              <li><strong>Calentamiento suave de ~10 min:</strong> en ese tiempo el reloj fija tu línea base del día; antes no da un valor fiable. Si arrancas fuerte, la referencia sale mal.</li>
              <li><strong>Retraso de 1-2 minutos:</strong> el cálculo necesita una ventana de latidos. Sirve para esfuerzos continuos (rodajes, tiradas largas, subidas largas), no para series cortas ni fuerza.</li>
              <li><strong>Para la base aeróbica:</strong> en rodajes y tiradas largas, mantente en verde. La distribución real de intensidad de la app sale del tiempo en verde / amarillo / rojo que registra Suunto.</li>
              <li><strong>En esfuerzos largos a ritmo constante es normal que tienda hacia el amarillo</strong> con las horas: los índices de este tipo son sensibles a la duración y a la fatiga. Es una señal para aflojar, no un fallo.</li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-2">
            <h3 className="text-base font-black text-zinc-100">Qué dicen los estudios</h3>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>Kanniainen y cols. (2023, Frontiers in Physiology): DDFA en 15 personas en cicloergómetro; buena concordancia con los umbrales de lactato.</li>
              <li>Kanniainen y cols. (2025, Physiological Reports): 58 personas en test incremental en cinta, comparado con umbrales de lactato.</li>
              <li>DFA a1 clásico (Rogers, Gronwald y cols.): 0,75 ≈ primer umbral ventilatorio y 0,50 ≈ segundo como media de grupo; a nivel individual esos cortes fijos no valen para todo el mundo, y el índice cambia con la duración del esfuerzo.</li>
            </ul>
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
                    <span className="font-bold text-zinc-200">Tiempo por FC (AeT {profile.aetHr} bpm / AnT {profile.antHr} bpm):</span>
                    <span className="font-bold text-zinc-400">
                      {parsedFitData.hasHeartRate ? 'Calculado por FC, no ZoneSense' : 'El archivo no trae FC'}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${parsedFitData.timeInAerobicPct}%` }}
                      className="bg-emerald-500 h-full"
                      title={`FC ≤ AeT: ${parsedFitData.timeInAerobicPct}%`}
                    />
                    <div
                      style={{ width: `${parsedFitData.timeInTransitionPct}%` }}
                      className="bg-amber-500 h-full"
                      title={`AeT < FC ≤ AnT: ${parsedFitData.timeInTransitionPct}%`}
                    />
                    <div
                      style={{ width: `${parsedFitData.timeInAnaerobicPct}%` }}
                      className="bg-red-500 h-full"
                      title={`FC > AnT: ${parsedFitData.timeInAnaerobicPct}%`}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-zinc-400">
                    <span className="text-emerald-400">≤ AeT: {parsedFitData.timeInAerobicPct}%</span>
                    <span className="text-amber-400">AeT–AnT: {parsedFitData.timeInTransitionPct}%</span>
                    <span className="text-red-400">&gt; AnT: {parsedFitData.timeInAnaerobicPct}%</span>
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
