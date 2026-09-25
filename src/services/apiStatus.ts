// Estado global de las APIs (IA, Suunto y el propio servidor de la app), para
// el indicador de la barra superior y el banner "Error de API".
// Store mínimo sin librerías: api.ts informa de cada resultado y los
// componentes se suscriben con useApiStatus().
import { useSyncExternalStore } from 'react';
import type { HealthStatus } from './api';

/** Error de API con un código y un consejo de qué hacer. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}

export type AiState = 'unknown' | 'ok' | 'fallback' | 'error';
export type SuuntoState = 'unknown' | 'ok' | 'disconnected' | 'error';

export interface ApiStatusSnapshot {
  backend: { state: 'unknown' | 'ok' | 'down'; message?: string; hint?: string };
  ai: { state: AiState; code?: string; message?: string; hint?: string; at?: string };
  suunto: { state: SuuntoState; message?: string; hint?: string; at?: string };
  health?: HealthStatus;
  /** El usuario cerró el banner del problema actual. */
  bannerDismissed: boolean;
}

let snapshot: ApiStatusSnapshot = {
  backend: { state: 'unknown' },
  ai: { state: 'unknown' },
  suunto: { state: 'unknown' },
  bannerDismissed: false,
};

const listeners = new Set<() => void>();

function update(patch: Partial<ApiStatusSnapshot>, reopenBanner = false) {
  snapshot = { ...snapshot, ...patch, bannerDismissed: reopenBanner ? false : snapshot.bannerDismissed };
  listeners.forEach((l) => l());
}

const now = () => new Date().toISOString();

export const apiStatus = {
  get: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setHealth(health: HealthStatus) {
    update({ health });
  },

  reportBackendUp() {
    if (snapshot.backend.state !== 'ok') update({ backend: { state: 'ok' } });
  },
  reportBackendDown(err: ApiError) {
    update({ backend: { state: 'down', message: err.message, hint: err.hint } }, true);
  },

  /** Llamada de IA correcta. `fallbackReason` si respondió el respaldo (Gemini). */
  reportAiOk(fallbackReason?: string) {
    if (fallbackReason) {
      update(
        {
          ai: {
            state: 'fallback',
            message: `Experiential Labs falló (${fallbackReason}). Miguel está respondiendo con Gemini de respaldo.`,
            hint: 'Revisa la sección 5 de CONFIGURACION-POR-USUARIO.md (nombres de modelo, key o créditos de Experiential).',
            at: now(),
          },
        },
        snapshot.ai.state !== 'fallback',
      );
    } else if (snapshot.ai.state !== 'ok') {
      update({ ai: { state: 'ok', at: now() } });
    }
  },
  reportAiError(err: ApiError) {
    update({ ai: { state: 'error', code: err.code, message: err.message, hint: err.hint, at: now() } }, true);
  },

  reportSuuntoOk() {
    update({ suunto: { state: 'ok', at: now() } });
  },
  reportSuuntoDisconnected(message?: string) {
    update({ suunto: { state: 'disconnected', message, at: now() } });
  },
  reportSuuntoError(err: ApiError) {
    update({ suunto: { state: 'error', message: err.message, hint: err.hint, at: now() } }, true);
  },

  dismissBanner() {
    update({ bannerDismissed: true });
  },
};

export function useApiStatus(): ApiStatusSnapshot {
  return useSyncExternalStore(apiStatus.subscribe, apiStatus.get, apiStatus.get);
}
