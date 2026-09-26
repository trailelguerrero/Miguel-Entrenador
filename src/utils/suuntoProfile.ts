import { AthleteProfile, SUUNTO_PROFILE_FIELDS, SuuntoProfileField, SuuntoProfileSuggestion } from '../types/index.js';

// Perfil automático desde Suunto: Suunto rellena sus campos salvo los que el
// atleta haya cambiado a mano (esos quedan como 'manual' y no se pisan).

export const SUUNTO_FIELD_LABELS: Record<SuuntoProfileField, string> = {
  maxHr: 'FC máxima',
  aetHr: 'Umbral aeróbico (AeT)',
  antHr: 'Umbral anaeróbico (AnT)',
  hasAds: 'Déficit aeróbico (ADS)',
  restingHr: 'FC en reposo',
  baselineHrv: 'HRV de referencia',
  vo2Max: 'VO2máx',
  currentWeeklyVolumeHours: 'Volumen semanal (h)',
  availableDaysPerWeek: 'Días de entreno por semana',
  preferredLongRunDay: 'Día de tirada larga',
};

export interface ProfileChange {
  field: SuuntoProfileField;
  from: unknown;
  to: unknown;
}

/** Aplica lo calculado desde Suunto respetando los campos manuales. */
export function applySuuntoProfile(
  profile: AthleteProfile,
  suggestion: SuuntoProfileSuggestion,
): { profile: AthleteProfile; changed: ProfileChange[] } {
  const next: AthleteProfile = { ...profile, fieldSources: { ...profile.fieldSources } };
  const changed: ProfileChange[] = [];

  for (const field of SUUNTO_PROFILE_FIELDS) {
    const value = suggestion.values[field];
    if (value === undefined) continue;
    if (next.fieldSources![field] === 'manual') continue;
    if (next[field] !== value) {
      changed.push({ field, from: next[field], to: value });
      (next as any)[field] = value;
    }
    next.fieldSources![field] = 'suunto';
  }

  // Lo que Suunto ya no puede deducir de forma fiable se vacía (solo si sigue siendo de Suunto)
  const suuntoValues = { ...profile.suuntoValues, ...suggestion.values };
  for (const field of suggestion.cleared || []) {
    delete (suuntoValues as any)[field];
    if (next.fieldSources![field] !== 'suunto') continue;
    const empty = field === 'hasAds' ? false : field === 'preferredLongRunDay' ? next[field] : 0;
    if (next[field] !== empty) changed.push({ field, from: next[field], to: empty });
    (next as any)[field] = empty;
    delete next.fieldSources![field];
  }

  next.suuntoValues = suuntoValues;
  next.suuntoEvidence = { ...profile.suuntoEvidence, ...suggestion.evidence };
  next.suuntoProfileUpdatedAt = new Date().toISOString();
  next.hasConnectedSuunto = true;
  if (Object.keys(suggestion.values).length) next.dataSource = 'suunto_sync';
  return { profile: next, changed };
}

/** Marca como 'manual' los campos de Suunto que el atleta ha cambiado a mano. */
export function markManualChanges(previous: AthleteProfile, updated: AthleteProfile): AthleteProfile {
  const fieldSources = { ...previous.fieldSources, ...updated.fieldSources };
  for (const field of SUUNTO_PROFILE_FIELDS) {
    if (updated[field] === previous[field]) continue;
    // Solo sigue siendo 'suunto' si el nuevo valor es justo el de Suunto
    // (botón "usar Suunto"); cualquier otro cambio (ficha, test de deriva…) es manual.
    if (updated[field] !== previous.suuntoValues?.[field]) fieldSources[field] = 'manual';
  }
  return { ...updated, fieldSources };
}

/** Vuelve a usar el valor de Suunto en un campo que estaba en manual. */
export function restoreSuuntoField(profile: AthleteProfile, field: SuuntoProfileField): AthleteProfile {
  const value = profile.suuntoValues?.[field];
  if (value === undefined) return profile;
  return { ...profile, [field]: value, fieldSources: { ...profile.fieldSources, [field]: 'suunto' } };
}
