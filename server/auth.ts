// Acceso a la app (un solo atleta).
//
//   Sin APP_SECRET → la app está ABIERTA: no pide ninguna clave (decisión del atleta;
//     cualquiera con la URL podría usarla, así que la URL debe quedar privada).
//   Con APP_SECRET (opcional) → la clave se escribe UNA vez por dispositivo y el
//     servidor devuelve una cookie de sesión firmada, HttpOnly, de 90 días.
//   SESSION_SECRET (opcional) → firma las sesiones; cambiarlo las cierra todas.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE = 'mc_session';
export const SESSION_DAYS = 90;

/** Clave para iniciar sesión (o para scripts con la cabecera x-app-secret). Vacío = app abierta. */
export function loginSecrets(): string[] {
  return [process.env.APP_SECRET].filter((s): s is string => !!s);
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
  return secretMatches(req.get('x-app-secret'));
}

/** Rutas /api que no piden sesión (el cron se protege con CRON_SECRET si existe). */
const PUBLIC_ROUTES = ['/api/health', '/api/auth/login', '/api/auth/logout', '/api/auth/status'];
export const isPublicRoute = (path: string) => PUBLIC_ROUTES.includes(path) || path.startsWith('/api/cron/');

/** Middleware: sin APP_SECRET, todo abierto; con APP_SECRET, toda /api/* exige sesión salvo las públicas. */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/') || isPublicRoute(req.path) || !loginSecrets().length) return next();
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Inicia sesión con la clave de la app.', code: 'AUTH_REQUIRED', hint: 'Escribe la clave de la app (APP_SECRET en Vercel).' });
}
