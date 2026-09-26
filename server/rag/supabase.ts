// Cliente de Supabase del servidor (clave service_role: nunca llega al navegador).
//
//   SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) → URL del proyecto
//   SUPABASE_SERVICE_ROLE_KEY                 → clave service_role
//
// Perezoso: sin estas variables la app arranca y funciona; solo se desactivan
// la Biblioteca de Miguel y el guardado de conversaciones. Esquema: scripts/init.sql.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const GUIDE = 'CONFIGURACION-POR-USUARIO.md';

export type KnowledgeErrorCode = 'KB_CONFIG' | 'KB_AUTH' | 'KB_INPUT' | 'KB_DB' | 'KB_EMBED' | 'KB_NOT_FOUND' | 'KB_TITLE_EXISTS';

/** Error de Supabase/biblioteca con mensaje claro y qué hacer (mismo formato que AiError). */
export class KnowledgeError extends Error {
  constructor(
    public code: KnowledgeErrorCode,
    message: string,
    public hint: string,
    public httpStatus = 500,
    public detail?: string,
  ) {
    super(message);
  }
}

/**
 * URL del proyecto tal y como la necesita el cliente: https://<ref>.supabase.co.
 * Acepta las formas mal copiadas más comunes: con /rest/v1 u otra ruta, con barra
 * final o la URL del panel (supabase.com/dashboard/project/<ref>). Con ruta, el
 * gateway de Supabase responde "Invalid path specified in request URL".
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  try {
    const u = new URL(v);
    const dash = u.hostname.endsWith('supabase.com') ? u.pathname.match(/\/project\/([a-z0-9]+)/i) : null;
    if (dash) return `https://${dash[1]}.supabase.co`;
    if (u.hostname.endsWith('.supabase.co')) return u.origin;
    return v.replace(/\/+$/, '');
  } catch {
    return v;
  }
}

function supabaseUrl(): string | undefined {
  return normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Variables de Supabase que faltan (vacío = configurado). */
export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!supabaseUrl()) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const missing = missingSupabaseVars();
  if (missing.length) {
    throw new KnowledgeError(
      'KB_CONFIG',
      `Supabase no está configurado: falta ${missing.join(', ')}.`,
      `Cárgalas en Vercel (Settings → Environment Variables) y haz Redeploy (sección 10 de ${GUIDE}).`,
    );
  }
  client ??= createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Traduce un error de Supabase a KnowledgeError, detectando si falta el esquema. */
export function dbError(action: string, error: { message: string }): KnowledgeError {
  const missingSchema = /match_documents|chat_sessions|chat_messages|relation .*documents|does not exist|schema cache/i.test(error.message);
  return new KnowledgeError(
    'KB_DB',
    `Error de Supabase al ${action}.`,
    missingSchema
      ? `Parece que falta el esquema: ejecuta scripts/init.sql en Supabase → SQL Editor (sección 10 de ${GUIDE}).`
      : 'Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY y que el proyecto de Supabase esté activo.',
    500,
    error.message.slice(0, 400),
  );
}
