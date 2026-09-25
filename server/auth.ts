// Sesión de la app (Fase B, un solo atleta). La clave (APP_SECRET o INGEST_SECRET)
// se escribe UNA vez por dispositivo; el servidor devuelve una cookie de sesión
// firmada, HttpOnly, de 90 días. La clave maestra no se guarda en el navegador.
//
//   SESSION_SECRET (opcional) → firma las sesiones. Cambiarlo cierra la sesión en
//     todos los dispositivos. Sin él se deriva de APP_SECRET/INGEST_SECRET (cambiar
//     esa clave también cierra todas las sesiones).
//
// La API está CERRADA POR DEFECTO: sin ninguna clave configurada responde 503.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE = 'mc_session';
export const SESSION_DAYS = 90;

/** Claves válidas para iniciar sesión (o para scripts con la cabecera x-app-secret). */
export function loginSecrets(): string[] {
  return [process.env.APP_SECRET, process.env.INGEST_SECRET].filter((s): s is string => !!s);
}

function signingKey(): Buffer | null {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
  const base = loginSecrets()[0];
  return base ? createHash('sha256').update(`miguel-session:${base}`).digest() : null;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function safeEqual(a: string | undefined, b: string): boolean {
  const x = Buffer.from(a ?? '');
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function secretMatches(provided: string | undefined): boolean {
  return loginSecrets().some((s) => safeEqual(provided, s));
}

export function createSessionToken(now = Date.now()): string {
  const key = signingKey();
  if (!key) throw new Error('Sin clave configurada');
  const payload = b64(JSON.stringify({ v: 1, iat: now, exp: now + SESSION_DAYS * 86400000 }));
  const sig = b64(createHmac('sha256', key).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  const key = signingKey();
  if (!key || !token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = b64(createHmac('sha256', key).update(payload).digest());
  if (!safeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function isHttps(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  return proto === 'https' || (!proto && !String(req.headers.host || '').startsWith('localhost'));
}

export function sessionCookie(req: Request, token: string | null): string {
  const maxAge = token ? SESSION_DAYS * 86400 : 0;
  return `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
}

/** ¿La petición viene de alguien autenticado? (cookie de sesión o cabecera con la clave) */
export function isAuthenticated(req: Request): boolean {
  if (verifySessionToken(readCookie(req, SESSION_COOKIE))) return true;
  return secretMatches(req.get('x-app-secret')) || secretMatches(req.get('x-ingest-secret'));
}

/** Rutas /api que no piden sesión (las del cron se protegen con CRON_SECRET). */
const PUBLIC_ROUTES = ['/api/health', '/api/auth/login', '/api/auth/logout', '/api/auth/status'];
export const isPublicRoute = (path: string) => PUBLIC_ROUTES.includes(path) || path.startsWith('/api/cron/');

/** Middleware: toda /api/* exige sesión, salvo las públicas. Cerrado por defecto. */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/') || isPublicRoute(req.path)) return next();
  if (!loginSecrets().length) {
    return res.status(503).json({
      error: 'La app no tiene clave configurada: la API está cerrada.',
      code: 'AUTH_NOT_CONFIGURED',
      hint: 'Pon APP_SECRET (o INGEST_SECRET) en Vercel y haz Redeploy.',
    });
  }
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Inicia sesión con la clave de la app.', code: 'AUTH_REQUIRED', hint: 'Escribe la clave de la app (APP_SECRET o INGEST_SECRET).' });
}
