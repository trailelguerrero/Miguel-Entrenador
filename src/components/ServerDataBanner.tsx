import React, { useState } from 'react';
import { CloudUpload, Server } from 'lucide-react';

interface ServerDataBannerProps {
  /** true = subir los datos de este navegador; false = empezar con lo que hay en el servidor. */
  onImport: (uploadLocal: boolean) => Promise<void>;
}

/**
 * Subida única (Fase B): los datos que tenías en este navegador pasan al servidor,
 * que desde entonces es la fuente de verdad (y Miguel razona con ellos).
 */
export const ServerDataBanner: React.FC<ServerDataBannerProps> = ({ onImport }) => {
  const [busy, setBusy] = useState(false);
  const run = async (uploadLocal: boolean) => {
    const ok = uploadLocal
      ? confirm(
          'Se suben al servidor tu perfil, tus entrenos, tus check-ins, la memoria de Miguel, la carrera objetivo, tu historial .md y la conexión con Suunto de este navegador.\n\nSi un registro ya existe en el servidor, gana el más reciente. ¿Subir ahora?',
        )
      : confirm('Se usarán solo los datos que ya hay en el servidor y se sustituirán los de este navegador. ¿Continuar?');
    if (!ok) return;
    setBusy(true);
    try {
      await onImport(uploadLocal);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 space-y-2">
      <div className="flex items-start gap-2 text-sm text-zinc-200">
        <Server className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
        <span className="leading-snug">
          Tus datos ahora se guardan en el servidor: así los ves igual en todos tus dispositivos y Suunto se sincroniza solo cada mañana.
          Sube una vez los datos de este navegador.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-sm font-bold text-zinc-950"
        >
          <CloudUpload className="w-4 h-4" /> {busy ? 'Subiendo…' : 'Subir mis datos'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(false)}
          className="rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 px-3 py-2 text-sm font-bold text-zinc-200"
        >
          Usar solo lo del servidor
        </button>
      </div>
    </div>
  );
};
