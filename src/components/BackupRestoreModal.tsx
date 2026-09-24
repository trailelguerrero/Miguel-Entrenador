import React, { useState, useRef } from 'react';
import { X, Download, Upload, ShieldCheck, AlertCircle, FileJson, CheckCircle2, RefreshCw } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AppBackupData } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: (summary: Record<string, number>) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<AppBackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    StorageService.downloadBackupFile();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setParsedBackup(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setParseError('Por favor selecciona un archivo con extensión .json');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: AppBackupData = JSON.parse(text);

        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('Estructura de respaldo no válida (falta bloque data).');
        }

        setParsedBackup(parsed);
      } catch (err: any) {
        setParseError(`Error al leer el archivo JSON: ${err.message || 'Formato corrupto'}`);
        setParsedBackup(null);
      }
    };
    reader.onerror = () => {
      setParseError('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!parsedBackup) return;

    setIsRestoring(true);
    setTimeout(() => {
      const result = StorageService.importFullBackup(parsedBackup);
      setIsRestoring(false);

      if (result.success) {
        onRestoreSuccess(result.countSummary);
        onClose();
      } else {
        setParseError(result.error || 'Error al restaurar los datos.');
      }
    }, 400);
  };

  const resetImportState = () => {
    setSelectedFile(null);
    setParsedBackup(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Copia de Seguridad & Portabilidad</h2>
              <p className="text-xs text-zinc-400">Exporta o restaura todo tu historial fisiológico y entrenamientos en formato JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Section 1: Exportar */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Exportar Respaldo Completo
                </h3>
                <p className="text-zinc-400 mt-1 text-[11px] leading-relaxed">
                  Descarga un archivo JSON cifrable con todas tus sesiones, curvas PMC (90d), registros HRV diarios, reglas aprendidas por Miguel y planes de Transvulcania.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 text-[10px] text-zinc-400 font-mono">
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">✓ Perfil & Umbrales</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">✓ Calendario Sesiones</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">✓ Serie PMC (CTL/ATL)</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">✓ Check-ins HRV</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">✓ Memoria Coach</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">✓ Nutrición & Hidratación</span>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs transition shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Descargar Archivo de Copia (.JSON)</span>
            </button>
          </div>

          {/* Section 2: Importar / Restaurar */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              Restaurar Copia de Seguridad
            </h3>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Carga un archivo de respaldo previo para sincronizar tus datos en otro navegador o restaurar un estado guardado.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              id="backup-file-input"
            />

            {!parsedBackup ? (
              <label
                htmlFor="backup-file-input"
                className="border-2 border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition hover:bg-zinc-900/50 group"
              >
                <FileJson className="w-8 h-8 text-zinc-500 group-hover:text-amber-400 transition mb-2" />
                <span className="font-semibold text-zinc-200">
                  {selectedFile ? selectedFile.name : 'Haz clic para seleccionar tu archivo .JSON'}
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">Formato admitido: JSON generado por Uphill Coach</span>
              </label>
            ) : (
              <div className="border border-emerald-500/40 bg-emerald-950/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Archivo Válido Detectado</span>
                  </div>
                  <button
                    onClick={resetImportState}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                  >
                    Cambiar archivo
                  </button>
                </div>

                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 text-[11px] space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Atleta:</span>
                    <span className="text-zinc-200 font-bold">{parsedBackup.athleteName || parsedBackup.data.profile?.name || 'Miguel'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Fecha de exportación:</span>
                    <span className="text-zinc-300">
                      {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString() : 'Reciente'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800/60 pt-1 text-zinc-400">
                    <span>Entrenamientos:</span>
                    <span className="text-emerald-400 font-bold">{parsedBackup.data.workouts?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Check-ins HRV:</span>
                    <span className="text-emerald-400 font-bold">{parsedBackup.data.dailyCheckIns?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Reglas de Coach:</span>
                    <span className="text-emerald-400 font-bold">{parsedBackup.data.coachMemory?.insights?.length || 0}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Al confirmar, se actualizarán los datos locales con el contenido de este archivo.
                  </span>
                </div>

                <button
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition shadow-lg shadow-amber-950/40 cursor-pointer disabled:opacity-50"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Restaurando datos...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Confirmar Restauración de Datos</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {parseError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
