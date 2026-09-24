import React, { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { ApiService } from '../services/api';
import { apiStatus, useApiStatus } from '../services/apiStatus';

// Banner bajo la barra superior cuando una API falla:
// - rojo: la API de la app no responde, la IA da error o Suunto da error
// - ámbar: Experiential falló y está respondiendo Gemini de respaldo
// Se oculta solo con la siguiente llamada correcta (o con la X).

export const ApiErrorBanner: React.FC = () => {
  const status = useApiStatus();
  const [retrying, setRetrying] = useState(false);

  if (status.bannerDismissed) return null;

  let tone: 'error' | 'warning' | null = null;
  let title = '';
  let message = '';
  let hint: string | undefined;
  let retry: (() => Promise<unknown>) | null = null;

  if (status.backend.state === 'down') {
    tone = 'error';
    title = 'La API de la app no responde';
    message = status.backend.message || '';
    hint = status.backend.hint;
    retry = () => ApiService.getHealth();
  } else if (status.ai.state === 'error') {
    tone = 'error';
    title = 'Error de API de IA';
    message = status.ai.message || '';
    hint = status.ai.hint;
    retry = () => ApiService.testAi();
  } else if (status.suunto.state === 'error') {
    tone = 'error';
    title = 'Error de API de Suunto';
    message = status.suunto.message || '';
    hint = status.suunto.hint;
  } else if (status.ai.state === 'fallback') {
    tone = 'warning';
    title = 'IA en modo respaldo';
    message = status.ai.message || '';
    hint = status.ai.hint;
  }

  if (!tone) return null;

  const handleRetry = async () => {
    if (!retry) return;
    setRetrying(true);
    try {
      await retry();
    } catch {
      // el propio fallo actualiza el estado y el banner
    } finally {
      setRetrying(false);
    }
  };

  const styles =
    tone === 'error'
      ? 'bg-red-950/80 border-red-500/40 text-red-100'
      : 'bg-amber-950/60 border-amber-500/30 text-amber-100';

  return (
    <div role="alert" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3">
      <div className={`rounded-2xl border px-4 py-3 flex items-start gap-3 shadow-lg ${styles}`}>
        <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${tone === 'error' ? 'text-red-400' : 'text-amber-400'}`} />
        <div className="flex-1 min-w-0 text-xs leading-relaxed">
          <p className="font-black text-sm">{title}</p>
          {message && <p className="mt-0.5">{message}</p>}
          {hint && (
            <p className="mt-1 opacity-90">
              <strong>Qué hacer:</strong> {hint}
            </p>
          )}
          {retry && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-900 border border-current/20 font-bold disabled:opacity-50"
            >
              {retrying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {retrying ? 'Comprobando…' : 'Volver a probar'}
            </button>
          )}
        </div>
        <button onClick={() => apiStatus.dismissBanner()} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
