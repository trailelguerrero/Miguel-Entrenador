// Datos del atleta en el servidor (Fase B): lectura del estado completo, escrituras,
// importación única desde el navegador y los datos con los que razona el cerebro.
import type { AthleteHistoryDocument, AthleteProfile, CoachLearnedMemory, DailyCheckIn, MacrocyclePlan, SuuntoAuth, TargetRace, Workout } from '../../src/types/index.js';
import { docStore, type Collection, type StoredDoc } from './docStore.js';
import { open, seal } from './secretBox.js';

/** Documentos únicos (un registro cada uno). */
export const SINGLETONS = {
  profile: 'profile',
  targetRace: 'target_race',
  coachMemory: 'coach_memory',
  historyMd: 'history_md',
  // Plan hasta la carrera: lo crea y lo actualiza SOLO el servidor (el navegador lo lee)
  macrocycle: 'macrocycle',
} as const satisfies Record<string, Collection>;
export type SingletonName = keyof typeof SINGLETONS;
const ONE = 'current';

export interface SuuntoStatus {
  connected: boolean;
  lastSync?: string;
  syncStatus?: 'synced' | 'error' | 'syncing' | 'pending';
  lastSyncMessage?: string;
  totalActivitiesSynced?: number;
}

export interface AthleteSnapshot {
  profile: AthleteProfile | null;
  targetRace: TargetRace | null;
  coachMemory: CoachLearnedMemory | null;
  historyMd: AthleteHistoryDocument | null;
  macrocycle: MacrocyclePlan | null;
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  suunto: SuuntoStatus;
  /** Ya se hizo la subida única desde un navegador (o se eligió empezar con lo del servidor). */
  imported: boolean;
  serverTime: string;
}

export async function isImported(): Promise<boolean> {
  return !!(await docStore().get('meta', 'import'));
}

export async function getSingleton<T>(name: SingletonName): Promise<T | null> {
  return ((await docStore().get<T>(SINGLETONS[name], ONE))?.data as T) ?? null;
}

export async function putSingleton(name: SingletonName, data: unknown): Promise<void> {
  if (data == null) await docStore().delete(SINGLETONS[name], ONE);
  else await docStore().put(SINGLETONS[name], ONE, data);
}

export async function listWorkouts(): Promise<Workout[]> {
  return (await docStore().list<Workout>('workouts')).map((d) => d.data).sort((a, b) => a.date.localeCompare(b.date));
}

export async function listCheckIns(): Promise<DailyCheckIn[]> {
  return (await docStore().list<DailyCheckIn>('checkins')).map((d) => d.data).sort((a, b) => b.date.localeCompare(a.date));
}

/** Escribe solo lo que cambia (y borra lo que ya no está, si se pide). */
export async function saveChanged<T>(
  collection: Collection,
  next: T[],
  idOf: (x: T) => string,
  previous: T[],
): Promise<number> {
  const before = new Map(previous.map((x) => [idOf(x), JSON.stringify(x)]));
  const changed = next.filter((x) => before.get(idOf(x)) !== JSON.stringify(x));
  if (changed.length) await docStore().putMany(collection, changed.map((x) => ({ id: idOf(x), data: x })));
  return changed.length;
}

// --- Suunto: tokens cifrados y estado ---

export async function getSuuntoAuth(): Promise<SuuntoAuth | null> {
  const doc = await docStore().get('suunto_auth', ONE);
  return doc ? open<SuuntoAuth>(doc.data) : null;
}

export async function saveSuuntoAuth(auth: SuuntoAuth | null): Promise<void> {
  if (!auth) await docStore().delete('suunto_auth', ONE);
  else await docStore().put('suunto_auth', ONE, seal(auth));
}

export async function getSuuntoStatus(): Promise<SuuntoStatus> {
  const [status, auth] = await Promise.all([docStore().get<SuuntoStatus>('suunto_status', ONE), getSuuntoAuth()]);
  return { ...(status?.data ?? {}), connected: !!auth?.accessToken };
}

export async function saveSuuntoStatus(status: Omit<SuuntoStatus, 'connected'>): Promise<void> {
  const prev = (await docStore().get<SuuntoStatus>('suunto_status', ONE))?.data ?? {};
  await docStore().put('suunto_status', ONE, { ...prev, ...status });
}

export async function loadSnapshot(): Promise<AthleteSnapshot> {
  const [profile, targetRace, coachMemory, historyMd, macrocycle, workouts, checkIns, suunto, imported] = await Promise.all([
    getSingleton<AthleteProfile>('profile'),
    getSingleton<TargetRace>('targetRace'),
    getSingleton<CoachLearnedMemory>('coachMemory'),
    getSingleton<AthleteHistoryDocument>('historyMd'),
    getSingleton<MacrocyclePlan>('macrocycle'),
    listWorkouts(),
    listCheckIns(),
    getSuuntoStatus(),
    isImported(),
  ]);
  return { profile, targetRace, coachMemory, historyMd, macrocycle, workouts, checkIns, suunto, imported, serverTime: new Date().toISOString() };
}

// --- Importación única desde el navegador ---

export interface ImportPayload {
  profile?: AthleteProfile | null;
  targetRace?: TargetRace | null;
  coachMemory?: CoachLearnedMemory | null;
  historyMd?: AthleteHistoryDocument | null;
  workouts?: Workout[];
  checkIns?: DailyCheckIn[];
  suuntoAuth?: SuuntoAuth | null;
}

export interface ImportReport {
  singletons: Record<SingletonName, 'imported' | 'kept_server' | 'empty'>;
  workouts: { imported: number; merged: number; keptServer: number };
  checkIns: { imported: number; merged: number; keptServer: number };
  suuntoAuth: 'imported' | 'kept_server' | 'empty';
}

const time = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) || 0 : 0);

/** Marca de tiempo propia de un registro, si la trae. */
function recordTime(x: any): number {
  return Math.max(time(x?.updatedAt), time(x?.lastUpdated), time(x?.uploadedAt), time(x?.suuntoProfileUpdatedAt));
}

/**
 * Regla "gana el más reciente": si el registro existe en los dos lados, gana el que
 * tenga la marca de tiempo más nueva (la del servidor es la de su última escritura).
 * Registros sin marca propia:
 * - Documentos únicos (perfil, carrera, memoria, historial): gana el navegador, que es
 *   donde el atleta los ha editado hasta hoy; el servidor solo pudo escribirlos una
 *   sincronización de Suunto, que los vuelve a completar en la siguiente.
 * - Workouts del mismo id: lo planificado viene del navegador y lo MEDIDO (Suunto) del
 *   servidor. Check-ins del mismo día: lo medido del servidor, dolor y estrés del navegador.
 */
export async function importFromBrowser(p: ImportPayload): Promise<ImportReport> {
  const store = docStore();
  const report: ImportReport = {
    singletons: { profile: 'empty', targetRace: 'empty', coachMemory: 'empty', historyMd: 'empty', macrocycle: 'empty' },
    workouts: { imported: 0, merged: 0, keptServer: 0 },
    checkIns: { imported: 0, merged: 0, keptServer: 0 },
    suuntoAuth: 'empty',
  };

  // El macrociclo no se importa: lo crea el servidor
  for (const name of (Object.keys(SINGLETONS) as SingletonName[]).filter((n): n is Exclude<SingletonName, 'macrocycle'> => n !== 'macrocycle')) {
    const incoming = p[name];
    if (incoming == null) continue;
    const server = await store.get(SINGLETONS[name], ONE);
    const clientT = recordTime(incoming);
    if (server && clientT && time(server.updatedAt) > clientT) {
      report.singletons[name] = 'kept_server';
      continue;
    }
    await store.put(SINGLETONS[name], ONE, incoming);
    report.singletons[name] = 'imported';
  }

  const serverWorkouts = new Map((await store.list<Workout>('workouts')).map((d) => [d.id, d]));
  const bySuuntoKey = new Map([...serverWorkouts.values()].filter((d) => d.data.suuntoWorkoutKey).map((d) => [d.data.suuntoWorkoutKey as string, d]));
  const workoutsOut: { id: string; data: Workout }[] = [];
  const dropServerIds: string[] = [];
  for (const w of Array.isArray(p.workouts) ? p.workouts : []) {
    if (!w?.id || !w.date) continue;
    const server = serverWorkouts.get(w.id) ?? (w.suuntoWorkoutKey ? bySuuntoKey.get(w.suuntoWorkoutKey) : undefined);
    if (!server) {
      workoutsOut.push({ id: w.id, data: w });
      report.workouts.imported++;
      continue;
    }
    if (recordTime(w) && time(server.updatedAt) > recordTime(w)) {
      report.workouts.keptServer++;
      continue;
    }
    // Lo medido por Suunto (servidor) sobre la sesión del navegador (plan, notas, RPE…)
    const measured = server.data.suuntoWorkoutKey ? pickMeasured(server.data) : {};
    workoutsOut.push({ id: w.id, data: { ...w, ...measured } });
    // La misma actividad con otro id en el servidor (importada de Suunto): queda una sola
    if (server.id !== w.id) dropServerIds.push(server.id);
    report.workouts.merged++;
  }
  if (workoutsOut.length) await store.putMany('workouts', workoutsOut);
  for (const id of dropServerIds) await store.delete('workouts', id);

  const serverCheckIns = new Map((await store.list<DailyCheckIn>('checkins')).map((d) => [d.id, d]));
  const checkInsOut: { id: string; data: DailyCheckIn }[] = [];
  for (const c of Array.isArray(p.checkIns) ? p.checkIns : []) {
    if (!c?.date) continue;
    const server = serverCheckIns.get(c.date);
    if (!server) {
      checkInsOut.push({ id: c.date, data: c });
      report.checkIns.imported++;
    } else if (server.data.source === 'suunto') {
      checkInsOut.push({ id: c.date, data: { ...c, ...server.data, muscleSoreness: c.muscleSoreness, stressLevel: c.stressLevel } });
      report.checkIns.merged++;
    } else {
      report.checkIns.keptServer++;
    }
  }
  if (checkInsOut.length) await store.putMany('checkins', checkInsOut);

  if (p.suuntoAuth?.accessToken) {
    if (await getSuuntoAuth()) report.suuntoAuth = 'kept_server';
    else {
      await saveSuuntoAuth(p.suuntoAuth);
      report.suuntoAuth = 'imported';
    }
  }
  await store.put('meta', 'import', { importedAt: new Date().toISOString(), report });
  return report;
}

const MEASURED_FIELDS = [
  'completed',
  'suuntoWorkoutKey',
  'actualDurationMin',
  'actualDistanceKm',
  'actualElevationGainM',
  'actualElevationLossM',
  'actualAvgHr',
  'actualMaxHr',
  'actualTss',
  'tss',
  'suuntoManualEntry',
  'zoneSenseBreakdown',
] as const;

function pickMeasured(w: Workout): Partial<Workout> {
  const out: Record<string, unknown> = {};
  for (const f of MEASURED_FIELDS) if ((w as any)[f] !== undefined) out[f] = (w as any)[f];
  return out as Partial<Workout>;
}

export type { StoredDoc };
