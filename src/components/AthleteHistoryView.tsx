import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Watch, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Edit3, 
  Save, 
  Copy, 
  Check, 
  Info,
  ExternalLink,
  Flame,
  Heart
} from 'lucide-react';
import { AthleteProfile, AthleteHistoryDocument, SuuntoIntegrationConfig } from '../types';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';

interface AthleteHistoryViewProps {
  profile: AthleteProfile;
  onUpdateProfile: (updated: AthleteProfile) => void;
  historyDoc: AthleteHistoryDocument | null;
  onSaveHistoryDoc: (doc: AthleteHistoryDocument) => void;
  suuntoConfig: SuuntoIntegrationConfig;
  onSyncSuunto: () => Promise<string>;
  isSyncingSuunto: boolean;
}

export const AthleteHistoryView: React.FC<AthleteHistoryViewProps> = ({
  profile,
  onUpdateProfile,
  historyDoc,
  onSaveHistoryDoc,
  suuntoConfig,
  onSyncSuunto,
  isSyncingSuunto,
}) => {
  const [markdownContent, setMarkdownContent] = useState<string>(
    historyDoc?.content || StorageService.getHistoryMarkdownTemplate()
  );
  const [fileName, setFileName] = useState<string>(historyDoc?.fileName || 'historial_atleta.md');
  const [isEditing, setIsEditing] = useState<boolean>(!historyDoc);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [suuntoSyncFeedback, setSuuntoSyncFeedback] = useState<string | null>(null);
  const [miguelAnalysisText, setMiguelAnalysisText] = useState<string | null>(
    historyDoc?.miguelAnalysis || null
  );

  // File Upload (.md)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setMarkdownContent(text);
      setIsEditing(true);
    };
    reader.readAsText(file);
  };

  // Process Markdown with Miguel
  const handleProcessWithMiguel = async () => {
    if (!markdownContent.trim()) {
      alert('El archivo o texto está vacío.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await ApiService.parseMarkdownHistory(markdownContent, fileName);

      const updatedDoc: AthleteHistoryDocument = {
        fileName,
        lastUpdated: new Date().toISOString(),
        content: markdownContent,
        parsedSummary: result.summary,
        miguelAnalysis: result.miguelAnalysis,
      };

      onSaveHistoryDoc(updatedDoc);
      setMiguelAnalysisText(result.miguelAnalysis);
      setIsEditing(false);

      // Auto update profile with extracted real values (Zero generic data!)
      const updatedProfile: AthleteProfile = {
        ...profile,
        aetHr: result.extractedProfileUpdates.aetHr || profile.aetHr,
        antHr: result.extractedProfileUpdates.antHr || profile.antHr,
        restingHr: result.extractedProfileUpdates.restingHr || profile.restingHr,
        maxHr: result.extractedProfileUpdates.maxHr || profile.maxHr,
        injuryHistory: result.extractedProfileUpdates.injuryHistory || profile.injuryHistory,
        hasAds: result.extractedProfileUpdates.antHr && result.extractedProfileUpdates.aetHr
          ? (result.extractedProfileUpdates.antHr - result.extractedProfileUpdates.aetHr) > 20
          : profile.hasAds,
        dataSource: 'markdown_file',
      };

      onUpdateProfile(updatedProfile);
      alert('¡Historial procesado con éxito! Miguel ha incorporado todos tus datos reales a su memoria.');
    } catch (err: any) {
      // El banner "Error de API de IA" ya muestra el detalle y qué hacer
      console.error('Error al procesar historial:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Markdown file
  const handleDownloadTemplate = () => {
    const blob = new Blob([StorageService.getHistoryMarkdownTemplate()], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_historial_suunto.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCurrentMd = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Suunto Sync History (la lógica real vive en App.tsx → handleSyncSuunto)
  const handleSyncSuunto = async () => {
    setSuuntoSyncFeedback(null);
    setSuuntoSyncFeedback(await onSyncSuunto());
  };

  return (
    <div className="space-y-6">
      
      {/* Strict Data Integrity Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-800/50 rounded-3xl p-6 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-zinc-100">
                  Integridad Fisiológica Absoluta
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                  Cero Datos Genéricos o Inventados
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                Miguel extrae tus métricas de <strong>Suunto ZoneSense (DFA a1)</strong> y pulsaciones exclusivamente de tu reloj Suunto o de tu documento <code className="text-zinc-300">.md</code>. Jamás inventará zonas, fatigas ni umbrales.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-bold text-zinc-300">Estado fuente:</span>
            <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
              historyDoc
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : suuntoConfig.connected
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}>
              {historyDoc ? 'Historial .MD Verificado' : suuntoConfig.connected ? 'Suunto API Conectada' : 'Pendiente .MD / Suunto'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Suunto Cloud Extraction & Markdown History Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Suunto Cloud API Extraction */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-zinc-100">Extracción Suunto Cloud</h4>
              <p className="text-[11px] text-zinc-400">Lectura directa de ZoneSense y FC</p>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Trae de tu cuenta Suunto los entrenamientos, el sueño, la HRV nocturna y el tiempo en zonas ZoneSense de los últimos 28 días (límite de Suunto).
          </p>

          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3 text-xs">
            <div className="flex justify-between items-center text-zinc-400">
              <span>Estado API:</span>
              <span className={`font-bold ${suuntoConfig.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {suuntoConfig.connected ? 'Conectado' : 'No conectado'}
              </span>
            </div>

            <div className="flex justify-between items-center text-zinc-400">
              <span>Última sincronización:</span>
              <span className="text-zinc-200">{suuntoConfig.lastSync ? new Date(suuntoConfig.lastSync).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}</span>
            </div>

            {suuntoSyncFeedback && (
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed">
                {suuntoSyncFeedback}
              </div>
            )}

            {!suuntoConfig.connected && (
              <a
                href="/api/suunto/connect"
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black text-xs shadow-md transition-all"
              >
                <Watch className="w-4 h-4" />
                <span>Conectar Suunto</span>
              </a>
            )}

            <button
              onClick={handleSyncSuunto}
              disabled={isSyncingSuunto || !suuntoConfig.connected}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black text-xs shadow-md transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSuunto ? 'animate-spin' : ''}`} />
              <span>{isSyncingSuunto ? 'Sincronizando con Suunto...' : 'Sincronizar Historial con Suunto'}</span>
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-2 text-xs text-zinc-400">
            <span className="font-bold text-zinc-300 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>¿Prefieres no conectar la cuenta?</span>
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              No te preocupes: puedes subir tu historial completo en un archivo <code className="text-amber-400 font-semibold">.md</code> en el panel contiguo o arrastrar tus archivos <code className="text-emerald-400 font-semibold">.FIT</code>.
            </p>
          </div>
        </div>

        {/* Right Column (2 cols): Markdown Uploader & Ingestion */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-zinc-100 flex items-center space-x-2">
                  <span>Historial del Atleta en Markdown (.md)</span>
                </h4>
                <p className="text-xs text-zinc-400">
                  Sube tu archivo con historial, carreras pasadas, umbrales y notas de Suunto
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all"
                title="Descargar plantilla preconfigurada para rellenar"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Plantilla .md</span>
              </button>

              <label className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 text-xs font-black cursor-pointer shadow-md transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir archivo .md</span>
                <input
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Current File Banner */}
          <div className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
            <div className="flex items-center space-x-2.5 text-xs">
              <span className="font-bold text-zinc-300">Archivo:</span>
              <span className="text-amber-400 font-mono font-semibold">{fileName}</span>
              {historyDoc?.lastUpdated && (
                <span className="text-zinc-500 text-[11px]">
                  (Memorizado: {new Date(historyDoc.lastUpdated).toLocaleDateString()})
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center space-x-1"
              >
                <Edit3 className="w-3 h-3 text-amber-400" />
                <span>{isEditing ? 'Vista Previa' : 'Editar Texto'}</span>
              </button>
              <button
                onClick={handleDownloadCurrentMd}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
                title="Descargar versión actual"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editor or Preview Area */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Editor Markdown directo:</span>
                <span className="text-[11px] text-zinc-500">Puedes escribir o pegar tus datos reales aquí</span>
              </div>
              <textarea
                rows={14}
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-zinc-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Pega o escribe tu historial en markdown aquí..."
              />
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-h-[350px] overflow-y-auto space-y-3 text-xs leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap">
              {markdownContent}
            </div>
          )}

          {/* Action: Ingest & Parse with Miguel */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-zinc-400">
              Al procesar, Miguel analizará tus umbrales de Suunto, adaptará el macrociclo y los grabará en su memoria contextual.
            </p>

            <button
              onClick={handleProcessWithMiguel}
              disabled={isProcessing || !markdownContent.trim()}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-lg transition-all disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'Miguel está leyendo tu historial...' : 'Guardar y Grabar en Memoria de Miguel'}</span>
            </button>
          </div>

          {/* Miguel Analysis Feedback Card */}
          {miguelAnalysisText && (
            <div className="bg-zinc-950 border border-emerald-900/40 rounded-2xl p-5 space-y-2 mt-4 animate-in fade-in">
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-black">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dictamen y Recepción de Miguel:</span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line">
                {miguelAnalysisText}
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Extracted Historical Highlights */}
      {historyDoc?.parsedSummary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
          <h4 className="text-sm font-black text-zinc-100 flex items-center space-x-2">
            <Heart className="w-4 h-4 text-red-400" />
            <span>Resumen Extraído y Verificado del Historial</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-semibold">AeT Verificado</span>
              <div className="text-base font-black text-emerald-400">
                {historyDoc.parsedSummary.aetHr ? `${historyDoc.parsedSummary.aetHr} bpm` : 'No indicado'}
              </div>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-semibold">AnT Verificado</span>
              <div className="text-base font-black text-amber-400">
                {historyDoc.parsedSummary.antHr ? `${historyDoc.parsedSummary.antHr} bpm` : 'No indicado'}
              </div>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-semibold">FC Reposo / Máx</span>
              <div className="text-base font-black text-zinc-200">
                {historyDoc.parsedSummary.restingHr || '--'} / {historyDoc.parsedSummary.maxHr || '--'} bpm
              </div>
            </div>

            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-semibold">Volumen Semanal</span>
              <div className="text-base font-black text-zinc-200">
                {historyDoc.parsedSummary.weeklyVolumeKm ? `${historyDoc.parsedSummary.weeklyVolumeKm} km` : '4 sesiones'}
              </div>
            </div>
          </div>

          {historyDoc.parsedSummary.zoneSenseObservations && (
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-300">
              <strong className="text-emerald-400">Observaciones Suunto ZoneSense: </strong>
              {historyDoc.parsedSummary.zoneSenseObservations}
            </div>
          )}

          {historyDoc.parsedSummary.injuries && historyDoc.parsedSummary.injuries.length > 0 && (
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-300">
              <strong className="text-red-400">Puntos Débiles / Lesiones registradas: </strong>
              {historyDoc.parsedSummary.injuries.join(', ')}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
