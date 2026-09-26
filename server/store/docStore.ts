// Almacén de los datos del atleta en el servidor (Fase B): el servidor es la
// fuente de verdad. Un documento JSON por registro, agrupados por colección
// (tabla athlete_docs de scripts/init.sql). Hoy hay un solo atleta ('me').
//
// Backend: Supabase (service_role). En los tests se usa uno en memoria.
import { dbError, getSupabase, missingSupabaseVars } from '../rag/supabase.js';

export const ATHLETE_ID = 'me';

export type Collection =
  | 'profile'
  | 'target_race'
  | 'coach_memory'
  | 'history_md'
  | 'workouts'
  | 'checkins'
  | 'suunto_auth'
  | 'suunto_status'
  | 'meta';

export interface StoredDoc<T = any> {
  id: string;
  data: T;
  updatedAt: string;
}

export interface DocStore {
  get<T = any>(collection: Collection, id: string): Promise<StoredDoc<T> | null>;
  list<T = any>(collection: Collection): Promise<StoredDoc<T>[]>;
  put(collection: Collection, id: string, data: unknown): Promise<StoredDoc>;
  putMany(collection: Collection, docs: { id: string; data: unknown }[]): Promise<number>;
  delete(collection: Collection, id: string): Promise<void>;
}

/** Backend en memoria (tests y desarrollo sin Supabase). */
export class MemoryDocStore implements DocStore {
  private rows = new Map<string, StoredDoc>();
  private key = (c: Collection, id: string) => `${c}\u0000${id}`;
  async get(c: Collection, id: string) {
    return (this.rows.get(this.key(c, id)) as StoredDoc) ?? null;
  }
  async list(c: Collection) {
    return [...this.rows.entries()].filter(([k]) => k.startsWith(`${c}\u0000`)).map(([, v]) => v);
  }
  async put(c: Collection, id: string, data: unknown) {
    const doc = { id, data: structuredClone(data), updatedAt: new Date().toISOString() };
    this.rows.set(this.key(c, id), doc);
    return doc;
  }
  async putMany(c: Collection, docs: { id: string; data: unknown }[]) {
    for (const d of docs) await this.put(c, d.id, d.data);
    return docs.length;
  }
  async delete(c: Collection, id: string) {
    this.rows.delete(this.key(c, id));
  }
}

const BATCH = 500;

/** Backend Supabase (tabla athlete_docs). */
export class SupabaseDocStore implements DocStore {
  async get(collection: Collection, id: string) {
    const { data, error } = await getSupabase()
      .from('athlete_docs')
      .select('id, data, updated_at')
      .eq('athlete_id', ATHLETE_ID)
      .eq('collection', collection)
      .eq('id', id)
      .maybeSingle();
    if (error) throw dbError(`leer ${collection}`, error);
    return data ? { id: data.id as string, data: data.data, updatedAt: data.updated_at as string } : null;
  }
  async list(collection: Collection) {
    const out: StoredDoc[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await getSupabase()
        .from('athlete_docs')
        .select('id, data, updated_at')
        .eq('athlete_id', ATHLETE_ID)
        .eq('collection', collection)
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) throw dbError(`listar ${collection}`, error);
      out.push(...(data ?? []).map((r: any) => ({ id: r.id, data: r.data, updatedAt: r.updated_at })));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async put(collection: Collection, id: string, data: unknown) {
    const updatedAt = new Date().toISOString();
    const { error } = await getSupabase()
      .from('athlete_docs')
      .upsert({ athlete_id: ATHLETE_ID, collection, id, data, updated_at: updatedAt }, { onConflict: 'athlete_id,collection,id' });
    if (error) throw dbError(`guardar ${collection}`, error);
    return { id, data, updatedAt };
  }
  async putMany(collection: Collection, docs: { id: string; data: unknown }[]) {
    const updatedAt = new Date().toISOString();
    for (let i = 0; i < docs.length; i += BATCH) {
      const rows = docs.slice(i, i + BATCH).map((d) => ({ athlete_id: ATHLETE_ID, collection, id: d.id, data: d.data, updated_at: updatedAt }));
      const { error } = await getSupabase().from('athlete_docs').upsert(rows, { onConflict: 'athlete_id,collection,id' });
      if (error) throw dbError(`guardar ${collection}`, error);
    }
    return docs.length;
  }
  async delete(collection: Collection, id: string) {
    const { error } = await getSupabase().from('athlete_docs').delete().eq('athlete_id', ATHLETE_ID).eq('collection', collection).eq('id', id);
    if (error) throw dbError(`borrar ${collection}`, error);
  }
}

let override: DocStore | null = null;
let supabaseStore: SupabaseDocStore | null = null;

/** ¿Hay almacén en el servidor? (Supabase configurado, o uno de tests) */
export function storeEnabled(): boolean {
  return !!override || missingSupabaseVars().length === 0;
}

let readyCache: { ok: boolean; at: number } | null = null;
const READY_TTL_MS = 60_000;

/**
 * ¿Se pueden usar los datos en el servidor? Supabase configurado Y la tabla
 * athlete_docs creada (scripts/init.sql). Mientras falte la tabla, la app sigue en
 * modo local (como antes) en vez de fallar al guardar.
 */
export async function storeReady(): Promise<boolean> {
  if (override) return true;
  if (!storeEnabled()) return false;
  if (readyCache && Date.now() - readyCache.at < READY_TTL_MS) return readyCache.ok;
  const { error } = await getSupabase().from('athlete_docs').select('id').limit(1);
  // Solo "falta la tabla" desactiva el modo servidor; otros fallos se ven al usarlo
  const ok = !error || !/athlete_docs|does not exist|schema cache/i.test(error.message);
  if (!ok) console.warn('[store] falta la tabla athlete_docs: ejecuta scripts/init.sql en Supabase. La app sigue en modo local.');
  readyCache = { ok, at: Date.now() };
  return ok;
}

export function docStore(): DocStore {
  if (override) return override;
  supabaseStore ??= new SupabaseDocStore();
  return supabaseStore;
}

/** Solo para tests. */
export function setDocStoreForTests(store: DocStore | null): void {
  override = store;
}
