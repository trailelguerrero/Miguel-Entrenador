import React, { useEffect, useRef, useState } from 'react';
import { Activity, Loader2, X } from 'lucide-react';
import { ApiService } from '../services/api';
import { useApiStatus } from '../services/apiStatus';

// Indicador compacto de la barra superior: estado de la IA y de Suunto.
// Al pulsarlo abre un panel con detalle y el botón "Probar IA".

const DOT: Record<string, string> = {
  ok: 'bg-emerald-400',
  fallback: 'bg-amber-400',
  disconnected: 'bg-zinc-500',
  error: 'bg-red-500',
  unknown: 'bg-zinc-600',
};

const AI_LABEL: Record<string, string> = {
  ok: 'Funcionando',
  fallback: 'Respaldo (Gemini)',
  error: 'Error de API',
  unknown: 'Sin comprobar',
};

const SUUNTO_LABEL: Record<string, string> = {
  ok: 'Conectado',
  disconnected: 'No conectado',
  error: 'Error de API',
  unknown: 'Sin comprobar',
};

const PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  experiential: 'Experiential Labs',
};

interface Props {
  onGoToSuunto: () => void;
  /** Presente solo si hay una cuenta Suunto conectada. */
  onDisconnectSuunto?: () => void;
}

export const ApiStatusIndicator: React.FC<Props> = ({ onGoToSuunto, onDisconnectSuunto }) => {
  const status = useApiStatus();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const aiState = status.backend.state === 'down' ? 'error' : status.ai.state;
  const suuntoState = status.suunto.state;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await ApiService.testAi();
      setTestResult(
        `✅ ${PROVIDER_LABEL[r.provider] ?? r.provider} (${r.model}) respondió en ${(r.latencyMs / 1000).toFixed(1)} s` +
          (r.fallback ? ' — usando el respaldo de Gemini.' : '.'),
      );
    } catch (err: any) {
      setTestResult(`❌ ${err.message}${err.hint ? ` — ${err.hint}` : ''}`);
    } finally {
      setTesting(false);
    }
  };

  const health = status.health?.ai;
  const aiMessage = status.backend.state === 'down' ? status.backend.message : status.ai.message;
  const aiHint = status.backend.state === 'down' ? status.backend.hint : status.ai.hint;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
          aiState === 'error' || suuntoState === 'error'
            ? 'bg-red-500/10 border-red-500/40 text-red-300'
            : aiState === 'fallback'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
        }`}
        title="Estado de las APIs (IA y Suunto)"
        aria-label={`Estado de las APIs: IA ${AI_LABEL[aiState]}, Suunto ${SUUNTO_LABEL[suuntoState]}`}
      >
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${DOT[aiState]}`} />
          <span>IA</span>
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${DOT[suuntoState]}`} />
          <span className="hidden sm:inline">Suunto</span>
          <span className="sm:hidden">S</span>
        </span>
      </button>

      {open && (
        <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-80 z-50 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl p-4 space-y-4 text-xs text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-black text-zinc-100 text-sm">
              <Activity className="w-4 h-4 text-cyan-400" /> Estado de las APIs
            </span>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* IA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200">IA (Coach Miguel)</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${DOT[aiState]}`} />
                {status.backend.state === 'down' ? 'API de la app caída' : AI_LABEL[aiState]}
              </span>
            </div>
            {health && (
              <p className="text-[11px] text-zinc-500">
                Proveedor: <span className="text-zinc-300">{PROVIDER_LABEL[health.provider] ?? health.provider}</span>
                {' · '}Modelo:{' '}
                <span className="text-zinc-300">
                  {health.provider === 'experiential'
                    ? `${health.models.experientialChat} / ${health.models.experientialFast}`
                    : health.models.gemini}
                </span>
                {health.provider === 'experiential' && (health.fallbackAvailable ? ' · Respaldo Gemini activo' : ' · Sin respaldo')}
              </p>
            )}
            {status.health?.apiProtected === false && (
              <p className="rounded-xl p-2.5 border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[11px]">
                La IA de la app está abierta: cualquiera con la URL puede usarla. Pon <strong>APP_SECRET</strong> (o INGEST_SECRET) en Vercel y haz Redeploy.
              </p>
            )}
            {aiMessage && aiState !== 'ok' && (
              <div className={`rounded-xl p-2.5 border ${aiState === 'fallback' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
                <p>{aiMessage}</p>
                {aiHint && <p className="mt-1 text-[11px] opacity-90"><strong>Qué hacer:</strong> {aiHint}</p>}
              </div>
            )}
            <button
              onClick={handleTest}
              disabled={testing}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold disabled:opacity-50"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {testing ? 'Probando…' : 'Probar IA'}
            </button>
            {testResult && <p className="text-[11px] leading-relaxed">{testResult}</p>}
          </div>

          {/* Suunto */}
          <div className="space-y-1.5 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200">Suunto</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${DOT[suuntoState]}`} />
                {SUUNTO_LABEL[suuntoState]}
              </span>
            </div>
            {status.suunto.message && suuntoState !== 'ok' && (
              <p className={`text-[11px] ${suuntoState === 'error' ? 'text-red-300' : 'text-zinc-400'}`}>
                {status.suunto.message}
                {status.suunto.hint && <span className="block mt-1"><strong>Qué hacer:</strong> {status.suunto.hint}</span>}
              </p>
            )}
            {suuntoState !== 'ok' && (
              <button
                onClick={() => {
                  setOpen(false);
                  onGoToSuunto();
                }}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold border border-zinc-700"
              >
                Ir a Conexión Suunto
              </button>
            )}
            {onDisconnectSuunto && (
              <button
                onClick={() => {
                  setOpen(false);
                  onDisconnectSuunto();
                }}
                className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-red-950/60 text-red-300 font-bold border border-red-500/30"
              >
                Desconectar Suunto
              </button>
            )}
          </div>

          <p className="border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">Versión de la app: {__APP_VERSION__}</p>
        </div>
      )}
    </div>
  );
};
