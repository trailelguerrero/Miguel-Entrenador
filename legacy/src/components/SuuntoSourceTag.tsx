import React, { useState } from 'react';
import { AthleteProfile, SuuntoProfileField } from '../types';

// Etiquetas "Suunto" / "Manual" para los campos del perfil que se calculan desde
// Suunto (ver src/utils/suuntoProfile.ts). Lo usan la ficha del atleta y la guía
// de setup. `fields` asocia cada campo con su valor en el formulario y su setter.
export function useSuuntoSources(
  profile: AthleteProfile,
  fields: Partial<Record<SuuntoProfileField, [unknown, (v: any) => void]>>,
) {
  // Cambios hechos en este formulario ("usar Suunto") sobre los orígenes guardados.
  // Se combinan con los del perfil en cada render para reflejar una sincronización
  // hecha con el formulario abierto.
  const [overrides, setOverrides] = useState<NonNullable<AthleteProfile['fieldSources']>>({});
  const sources = { ...profile.fieldSources, ...overrides };

  const sourceOf = (field: SuuntoProfileField): 'suunto' | 'manual' | undefined => {
    const current = fields[field]?.[0];
    const suuntoValue = profile.suuntoValues?.[field];
    if (current !== undefined && current !== profile[field]) {
      return current === suuntoValue ? 'suunto' : 'manual';
    }
    return sources[field];
  };

  const restoreFromSuunto = (field: SuuntoProfileField) => {
    const value = profile.suuntoValues?.[field];
    const setter = fields[field]?.[1];
    if (value === undefined || !setter) return;
    setter(value);
    setOverrides((prev) => ({ ...prev, [field]: 'suunto' }));
  };

  const formatValue = (v: unknown) => (v === 'saturday' ? 'sábado' : v === 'sunday' ? 'domingo' : String(v));

  const SourceTag: React.FC<{ field: SuuntoProfileField }> = ({ field }) => {
    const src = sourceOf(field);
    const suuntoValue = profile.suuntoValues?.[field];
    if (!src && suuntoValue === undefined) return null;
    if (src === 'suunto') {
      return (
        <span
          className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
          title={profile.suuntoEvidence?.[field] || 'Calculado desde tus datos de Suunto'}
        >
          Suunto
        </span>
      );
    }
    return (
      <span className="ml-1 inline-flex items-center gap-1">
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">Manual</span>
        {suuntoValue !== undefined && (
          <button
            type="button"
            onClick={() => restoreFromSuunto(field)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
            title={profile.suuntoEvidence?.[field]}
          >
            ↺ usar Suunto ({formatValue(suuntoValue)})
          </button>
        )}
      </span>
    );
  };

  return { sources, SourceTag };
}

/** Aviso con qué se rellena solo desde Suunto (y botón para conectar si no lo está). */
export const SuuntoAutoFillNotice: React.FC<{ profile: AthleteProfile; suuntoConnected?: boolean }> = ({
  profile,
  suuntoConnected,
}) => (
  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-[11px] text-cyan-100 leading-relaxed space-y-1.5">
    <p>
      <strong>Datos automáticos desde Suunto:</strong> FC en reposo, FC máxima, umbrales AeT/AnT, HRV de referencia, días de
      entreno, día de tirada larga y volumen semanal se calculan de tu reloj al sincronizar (etiqueta <em>Suunto</em>). Si
      cambias uno a mano pasa a <em>Manual</em> y Suunto ya no lo toca. Peso, altura, edad, experiencia y lesiones los pones tú.
    </p>
    {!suuntoConnected && (
      <a href="/api/suunto/connect" className="inline-block px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold">
        Conectar Suunto para rellenar automáticamente
      </a>
    )}
    {profile.suuntoProfileUpdatedAt && (
      <p className="text-cyan-300/70">Última actualización desde Suunto: {new Date(profile.suuntoProfileUpdatedAt).toLocaleString()}</p>
    )}
  </div>
);
