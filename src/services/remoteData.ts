// Datos del atleta con el servidor como fuente de verdad (Fase B).
//
// - Este navegador guarda una CACHÉ de lectura (localStorage) con lo último que dio
//   el servidor: sin conexión se ve todo.
// - Cada cambio se sube al servidor. Sin conexión (o si el servidor falla) NO se
//   guarda: se avisa ("sin conexión: no se ha guardado") y, al volver la conexión,
//   la app recarga lo que hay en el servidor. Nada se pierde en silencio.
// - Subida única: los datos que ya tenías en el navegador se suben con un botón y
//   una confirmación (si un registro existe en los dos lados, gana el más reciente).
// - Sin Supabase configurado, la app sigue como antes (solo este navegador).
import type { DailyCheckIn, Workout } from '../types';
import { StorageService, type RemoteKind, type ServerSnapshot } from './storage';
import { authedFetch } from './session';

export type RemoteMode = 'unknown' | 'server' | 'local';

export interface RemoteState {
  mode: RemoteMode;
  /** Hay datos en este navegador sin subir y el servidor aún no los tiene. */
  needsImport: boolean;
  /** Último error de guardado (para el aviso). */
  lastError: string | null;
  /** Cambios pendientes de subir en este momento. */
  saving: boolean;
}

type Listener = (s: RemoteState) => void;

const RELOAD_EVENT = 'miguel:data-reloaded';
const DEBOUNCE_MS = 400;

let state: RemoteState = { mode: 'unknown', needsImport: false, lastError: null, saving: false };
const listeners = new Set<Listener>();
/** Estado del servidor la última vez que coincidió con este navegador (para calcular qué cambió). */
let baseline: { workouts: Map<string, string>; checkIns: Map<string, string> } = { workouts: new Map(), checkIns: new Map() };
const dirty = new Set<RemoteKind>();
let timer: ReturnType<typeof setTimeout> | null = null;
let reloadWhenOnline = false;
let onError: ((message: string) => void) | null = null;

function set(patch: Partial<RemoteState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

class HttpError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
}

async function call(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<any> {
  const res = await authedFetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.code, data.error || data.message || `Error ${res.status}`);
  return data;
}

/** Se ha cargado el estado del servidor en esta sesión (sin eso no se sube nada: la caché podría ser vieja). */
let loaded = false;

function setBaseline(workouts: Workout[], checkIns: DailyCheckIn[]) {
  loaded = true;
  baseline = {
    workouts: new Map(workouts.map((w) => [w.id, JSON.stringify(w)])),
    checkIns: new Map(checkIns.map((c) => [c.date, JSON.stringify(c)])),
  };
}

function applySnapshot(snap: ServerSnapshot) {
  StorageService.applyServerSnapshot(snap);
  setBaseline(snap.workouts, snap.checkIns);
  window.dispatchEvent(new Event(RELOAD_EVENT));
}

/** Cambios de una colección frente a lo último que se sabe del servidor. Solo se borra lo que el servidor tenía. */
function diff<T>(current: T[], idOf: (x: T) => string, base: Map<string, string>) {
  const now = new Map(current.map((x) => [idOf(x), x]));
  const upsert = current.filter((x) => base.get(idOf(x)) !== JSON.stringify(x));
  const del = [...base.keys()].filter((id) => !now.has(id));
  return { upsert, delete: del };
}

async function pushKind(kind: RemoteKind): Promise<void> {
  switch (kind) {
    case 'profile':
      return void (await call('/api/data/profile', 'PUT', { data: StorageService.getProfile() }));
    case 'targetRace':
      return void (await call('/api/data/target-race', 'PUT', { data: StorageService.getTargetRace() }));
    case 'coachMemory':
      return void (await call('/api/data/coach-memory', 'PUT', { data: StorageService.getCoachMemory() }));
    case 'historyMd':
      return void (await call('/api/data/history-md', 'PUT', { data: StorageService.getAthleteHistory() }));
    case 'workouts': {
      const current = StorageService.getWorkouts();
      const d = diff(current, (w) => w.id, baseline.workouts);
      if (d.upsert.length || d.delete.length) await call('/api/data/workouts', 'POST', d);
      baseline.workouts = new Map(current.map((w) => [w.id, JSON.stringify(w)]));
      return;
    }
    case 'checkIns': {
      const current = StorageService.getCheckIns().filter((c) => !c.isSample);
      const d = diff(current, (c) => c.date, baseline.checkIns);
      if (d.upsert.length || d.delete.length) await call('/api/data/checkins', 'POST', d);
      baseline.checkIns = new Map(current.map((c) => [c.date, JSON.stringify(c)]));
      return;
    }
  }
}

async function flush(): Promise<void> {
  timer = null;
  if (state.mode !== 'server' || state.needsImport || StorageService.isTestDataActive()) {
    dirty.clear();
    return;
  }
  const kinds = [...dirty];
  dirty.clear();
  if (!kinds.length) return;
  set({ saving: true });
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new HttpError(0, 'OFFLINE', 'Sin conexión');
    if (!loaded) throw new HttpError(0, 'OFFLINE', 'Aún no se han cargado tus datos del servidor');
    for (const k of kinds) await pushKind(k);
    set({ saving: false, lastError: null });
  } catch (err: any) {
    const offline = (err instanceof HttpError && err.code === 'OFFLINE') || !(err instanceof HttpError);
    const message = offline
      ? 'Sin conexión: no se ha guardado. Al volver la conexión se recargará lo último guardado en el servidor.'
      : `No se ha guardado en el servidor: ${err.message}. Se recargará lo último guardado.`;
    set({ saving: false, lastError: message });
    onError?.(message);
    // Lo que no llegó al servidor no queda como si estuviera guardado: se vuelve a lo del servidor
    if (offline) reloadWhenOnline = true;
    else void RemoteData.refresh();
  }
}

function onLocalWrite(kind: RemoteKind) {
  dirty.add(kind);
  if (!timer) timer = setTimeout(() => void flush(), DEBOUNCE_MS);
}

export const RemoteData = {
  RELOAD_EVENT,

  get state(): RemoteState {
    return state;
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Al abrir la app: decide el modo, carga del servidor o pide la subida única. */
  async init(opts: { onError: (message: string) => void }): Promise<RemoteState> {
    onError = opts.onError;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (reloadWhenOnline) {
          reloadWhenOnline = false;
          void RemoteData.refresh();
        }
      });
    }
    let snap: ServerSnapshot;
    try {
      snap = await call('/api/data', 'GET');
    } catch (err: any) {
      if (err instanceof HttpError && err.code === 'STORE_NOT_CONFIGURED') {
        set({ mode: 'local' });
        return state;
      }
      // Sin conexión o servidor caído: se trabaja con la caché y no se escribe
      set({ mode: 'server' });
      reloadWhenOnline = true;
      StorageService.setRemoteHook(onLocalWrite);
      return state;
    }
    StorageService.setRemoteHook(onLocalWrite);
    if (!snap.imported) {
      // Primera vez: si este navegador tiene datos, se ofrece subirlos (no se pisa nada hasta decidir)
      if (StorageService.hasLocalAthleteData()) {
        set({ mode: 'server', needsImport: true });
        return state;
      }
      const r = await call('/api/data/import', 'POST', {});
      applySnapshot(r.snapshot);
      set({ mode: 'server' });
      return state;
    }
    if (!StorageService.isTestDataActive()) applySnapshot(snap);
    set({ mode: 'server' });
    return state;
  },

  /** Vuelve a cargar todo del servidor (tras un fallo de guardado o al volver la conexión). */
  async refresh(): Promise<void> {
    if (state.mode !== 'server' || state.needsImport || StorageService.isTestDataActive()) return;
    try {
      applySnapshot(await call('/api/data', 'GET'));
      set({ lastError: null });
    } catch {
      reloadWhenOnline = true;
    }
  },

  /** Subida única de los datos de este navegador. uploadLocal=false: empezar con lo del servidor. */
  async runImport(uploadLocal: boolean): Promise<string> {
    const payload = uploadLocal ? StorageService.exportForServer() : {};
    const r = await call('/api/data/import', 'POST', payload);
    // Los datos de ejemplo no se suben: con el servidor, la app deja el modo prueba
    if (StorageService.isTestDataActive()) StorageService.setTestDataActive(false);
    applySnapshot(r.snapshot);
    set({ needsImport: false });
    const rep = r.report;
    if (!uploadLocal) return 'Datos cargados del servidor.';
    return `Subidos: ${rep.workouts.imported + rep.workouts.merged} entrenos y ${rep.checkIns.imported + rep.checkIns.merged} check-ins${
      rep.suuntoAuth === 'imported' ? '; la conexión con Suunto pasa al servidor' : ''
    }.`;
  },

  /** El servidor sincroniza con Suunto y devuelve el estado ya fusionado. */
  async syncSuunto(athleteToday: string): Promise<
    | { ok: true; message: string; profileChanges: any[]; freshZoneAdvice: any[] }
    | { ok: false; needsReconnect: boolean; message: string }
  > {
    // Antes de la subida única, lo del servidor pisaría los datos de este navegador
    if (state.needsImport) throw new Error('Primero sube tus datos al servidor (aviso de arriba) y después sincroniza.');
    try {
      const r = await call('/api/suunto/sync', 'POST', { athleteToday });
      applySnapshot(r.snapshot);
      return { ok: true, message: r.message, profileChanges: r.profileChanges || [], freshZoneAdvice: r.freshZoneAdvice || [] };
    } catch (err: any) {
      if (err instanceof HttpError && err.status === 401 && err.code === 'SUUNTO_AUTH') {
        await RemoteData.refresh();
        return { ok: false, needsReconnect: true, message: err.message };
      }
      await RemoteData.refresh();
      throw err;
    }
  },

  async disconnectSuunto(): Promise<void> {
    await call('/api/suunto/disconnect', 'POST', {});
    await RemoteData.refresh();
  },
};
