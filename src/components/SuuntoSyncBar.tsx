import React from 'react';
import { RefreshCw, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SuuntoIntegrationConfig } from '../types';

interface SuuntoSyncBarProps {
  config: SuuntoIntegrationConfig;
  isSyncing: boolean;
  onSync: () => void;
}

/** "hace 5 min", "hace 3 h", "hace 2 días" (o la fecha si es más antigua). */
export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return 'nunca';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'nunca';
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} día${d === 1 ? '' : 's'}`;
  return new Date(t).toLocaleDateString('es-ES');
}

/**
 * Barra fija de la pantalla principal: sincronizar con Suunto (o conectarlo)
 * sin tener que ir a la pestaña Suunto & ZoneSense.
 */
export const SuuntoSyncBar: React.FC<SuuntoSyncBarProps> = ({ config, isSyncing, onSync }) => {
  const connected = config.connected && !!config.auth;
  const error = config.syncStatus === 'error';

  if (!connected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-zinc-300 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="leading-tight">Suunto sin conectar: Miguel no ve tus entrenos, sueño ni HRV.</span>
        </div>
        <a
          href="/api/suunto/connect"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-bold text-zinc-950"
        >
          <Link2 className="w-4 h-4" /> Conectar Suunto
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="flex items-center gap-2 text-sm min-w-0">
        {error ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        <span className="leading-tight text-zinc-300" title={config.lastSyncMessage}>
          {isSyncing
            ? 'Sincronizando con Suunto…'
            : error
              ? `Falló la sincronización · última buena ${timeAgo(config.lastSync)}`
              : `Suunto: ${timeAgo(config.lastSync)}`}
        </span>
      </div>
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-sm font-bold text-zinc-950"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Sincronizando' : 'Sincronizar'}
      </button>
    </div>
  );
};
