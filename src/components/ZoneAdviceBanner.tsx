import React from 'react';
import { HeartPulse } from 'lucide-react';
import type { WatchZoneRecommendation } from '../types';

interface ZoneAdviceBannerProps {
  recommendations: WatchZoneRecommendation[];
  onResolve: (rec: WatchZoneRecommendation, status: 'done' | 'ignored') => void;
}

const HOW_TO = 'En la app de Suunto: Perfil → Zonas de intensidad → Frecuencia cardiaca → Carrera. Después sincroniza y la app tomará las zonas nuevas.';

/** Texto corto de una recomendación ("Z3: 148 → 152 ppm"). */
export function describeZoneRecommendation(r: WatchZoneRecommendation): string {
  if (r.field === 'zones') return r.label;
  return `${r.label}: ${r.current ?? '?'} → ${r.suggested ?? '?'} ppm`;
}

/**
 * Aviso fijo en la pantalla principal: cambiar las zonas de FC de tu reloj Suunto.
 * Se queda hasta que marques "Ya lo cambié" o "Ignorar".
 */
export const ZoneAdviceBanner: React.FC<ZoneAdviceBannerProps> = ({ recommendations, onResolve }) => {
  if (!recommendations.length) return null;
  return (
    <div className="rounded-2xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400 uppercase tracking-wide">
        <HeartPulse className="w-4 h-4" /> Cambia las zonas de FC de tu reloj Suunto
      </div>
      <ul className="space-y-2">
        {recommendations.map((r) => (
          <li key={`${r.field}:${r.suggested}`} className="text-xs text-zinc-200 space-y-1">
            <strong>{describeZoneRecommendation(r)}</strong>
            <p className="text-zinc-400 leading-snug">{r.evidence}</p>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onResolve(r, 'done')}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-zinc-950"
              >
                Ya lo cambié
              </button>
              <button
                type="button"
                onClick={() => onResolve(r, 'ignored')}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-300"
              >
                Ignorar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-zinc-500">{HOW_TO}</p>
    </div>
  );
};

export const ZONE_CHANGE_HOW_TO = HOW_TO;
