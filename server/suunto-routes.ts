// Integración real con Suunto a través del servidor MCP de Suunto ya desplegado
// (repo trailelguerrero/MCP, https://mcp-ten-kappa.vercel.app).
//
// Por qué así: ese MCP ya tiene registrado su callback en Suunto y hace de
// servidor OAuth. Esta app se comporta igual que claude.ai cuando agrega el
// connector: se registra como cliente OAuth del MCP, manda al usuario al login
// de Suunto, recibe tokens y llama a las tools del MCP. Resultado: el usuario
// no tiene que configurar nada en Suunto ni copiar tokens a mano, y esta app no
// necesita ninguna credencial de Suunto.
//
// Los tokens se guardan en el navegador del usuario (localStorage) y viajan en
// cada petición de sync; el servidor no guarda estado (serverless).
import type { Express, Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import type { SuuntoAuth } from '../src/types/index.js';
import { deriveProfileFromSuunto } from './suunto-profile.js';
import { mapSuuntoCheckIns, mapSuuntoWorkouts, SuuntoRecoveryDay, SuuntoSleepSession, SuuntoWorkoutRow } from './suunto-map.js';

const MCP_URL = (process.env.SUUNTO_MCP_URL || 'https://mcp-ten-kappa.vercel.app').replace(/\/+$/, '');
const OAUTH_COOKIE = 'suunto_oauth';
const MAX_SYNC_DAYS = 28; // límite de la 247 Data API de Suunto
// Historial de workouts: el CTL (media exponencial de 42 días) necesita
// meses de historial para coincidir con el de Suunto. El MCP admite hasta 365.
const WORKOUT_HISTORY_DAYS = 365;
const PROFILE_WORKOUT_DAYS = 90; // ventana de workouts para calcular el perfil

class ReconnectNeededError extends Error {}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function publicBaseUrl(req: Request): string {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000');
  const proto = String(req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0];
  return `${proto}://${host}`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function oauthCookie(value: string, maxAgeSec: number, secure: boolean): string {
  return `${OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/api/suunto; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function errorPage(res: Response, status: number, message: string) {
  res
    .status(status)
    .type('html')
    .send(
      `<!doctype html><meta charset="utf-8"><title>Suunto</title><body style="font-family:system-ui;background:#0c0a09;color:#e7e5e4;padding:24px">` +
        `<h2>No se pudo conectar Suunto</h2><p>${escapeHtml(message)}</p><p><a style="color:#34d399" href="/">Volver a la app</a></p></body>`,
    );
}

async function postToken(params: Record<string, string>): Promise<SuuntoAuth> {
  const resp = await fetch(`${MCP_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`El servidor MCP de Suunto rechazó el token (${resp.status}): ${text.slice(0, 300)}`);
  const data = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    clientId: params.client_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || params.refresh_token || '',
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
}

async function refreshAuth(auth: SuuntoAuth): Promise<SuuntoAuth> {
  if (!auth.refreshToken) throw new ReconnectNeededError('No hay refresh token guardado.');
  try {
    return await postToken({ grant_type: 'refresh_token', refresh_token: auth.refreshToken, client_id: auth.clientId });
  } catch (err) {
    throw new ReconnectNeededError((err as Error).message);
  }
}

/** Parsea la respuesta del transporte Streamable HTTP del MCP: puede venir
 * como JSON plano o como stream SSE (`data: {...}`). */
function parseJsonRpc(body: string, contentType: string): any {
  if (contentType.includes('text/event-stream')) {
    const messages = body
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => JSON.parse(l.slice(5).trim()));
    return messages.find((m) => 'result' in m || 'error' in m) ?? {};
  }
  return JSON.parse(body);
}

async function callMcpTool(accessToken: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  const resp = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  if (resp.status === 401) throw new ReconnectNeededError('Token de Suunto inválido o vencido.');
  const body = await resp.text();
  if (!resp.ok) throw new Error(`El servidor MCP de Suunto devolvió ${resp.status}: ${body.slice(0, 300)}`);

  const msg = parseJsonRpc(body, resp.headers.get('content-type') || '');
  if (msg.error) throw new Error(`Error MCP en ${name}: ${msg.error.message || JSON.stringify(msg.error)}`);
  const text: string = msg.result?.content?.[0]?.text ?? '';
  if (msg.result?.isError) {
    if (/\b401\b/.test(text)) throw new ReconnectNeededError(text);
    throw new Error(`Suunto (${name}): ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inesperada de ${name} (no es JSON). ¿Está desplegada la última versión del MCP?`);
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function registerSuuntoRoutes(app: Express) {
  // 1. Arranca el login: registra esta app como cliente OAuth del MCP y
  //    redirige al usuario a Suunto (vía el /authorize del MCP).
  app.get('/api/suunto/connect', async (req: Request, res: Response) => {
    try {
      const base = publicBaseUrl(req);
      const redirectUri = `${base}/api/suunto/callback`;

      const regResp = await fetch(`${MCP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Uphill Coach AI',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        }),
      });
      const regText = await regResp.text();
      if (!regResp.ok) {
        return errorPage(res, 502, `El servidor MCP de Suunto rechazó el registro (${regResp.status}): ${regText.slice(0, 300)}`);
      }
      const { client_id: clientId } = JSON.parse(regText) as { client_id: string };

      const verifier = base64Url(randomBytes(32));
      const challenge = base64Url(createHash('sha256').update(verifier).digest());
      const state = base64Url(randomBytes(16));

      const target = new URL(`${MCP_URL}/authorize`);
      target.searchParams.set('response_type', 'code');
      target.searchParams.set('client_id', clientId);
      target.searchParams.set('redirect_uri', redirectUri);
      target.searchParams.set('code_challenge', challenge);
      target.searchParams.set('code_challenge_method', 'S256');
      target.searchParams.set('state', state);

      res.setHeader('Set-Cookie', oauthCookie(JSON.stringify({ clientId, verifier, state, redirectUri }), 900, base.startsWith('https')));
      res.redirect(302, target.toString());
    } catch (err: any) {
      console.error('Error in /api/suunto/connect:', err);
      errorPage(res, 500, err.message || 'Error iniciando la conexión con Suunto');
    }
  });

  // 2. Vuelta del login: canjea el code por tokens y los guarda en el
  //    navegador (misma clave de localStorage que usa StorageService).
  app.get('/api/suunto/callback', async (req: Request, res: Response) => {
    const secure = publicBaseUrl(req).startsWith('https');
    try {
      const { code, state, error, error_description } = req.query as Record<string, string | undefined>;
      if (error) return errorPage(res, 400, `Suunto devolvió un error: ${error} ${error_description || ''}`);

      const raw = readCookie(req, OAUTH_COOKIE);
      if (!raw) return errorPage(res, 400, 'La sesión de conexión caducó (más de 15 minutos). Vuelve a pulsar "Conectar Suunto".');
      const pending = JSON.parse(raw) as { clientId: string; verifier: string; state: string; redirectUri: string };
      if (!code || state !== pending.state) return errorPage(res, 400, 'Respuesta de login inválida. Vuelve a pulsar "Conectar Suunto".');

      const auth = await postToken({
        grant_type: 'authorization_code',
        code,
        code_verifier: pending.verifier,
        redirect_uri: pending.redirectUri,
        client_id: pending.clientId,
      });

      const authJson = JSON.stringify(auth).replace(/</g, '\\u003c');
      res.setHeader('Set-Cookie', oauthCookie('', 0, secure));
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Suunto conectado</title>
<body style="font-family:system-ui;background:#0c0a09;color:#e7e5e4;padding:24px">Suunto conectado. Volviendo a la app…
<script>
  try {
    var key = 'uphill_coach_suunto_config';
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) {}
    cfg.auth = ${authJson};
    cfg.connected = true;
    cfg.syncStatus = 'pending';
    cfg.lastSyncMessage = 'Cuenta Suunto conectada. Pulsa "Sincronizar" para traer tus datos.';
    localStorage.setItem(key, JSON.stringify(cfg));
  } catch (e) { document.body.textContent = 'No se pudo guardar la conexión en el navegador: ' + e; }
  location.replace('/?suunto=connected');
</script></body>`);
    } catch (err: any) {
      console.error('Error in /api/suunto/callback:', err);
      res.setHeader('Set-Cookie', oauthCookie('', 0, secure));
      errorPage(res, 502, err.message || 'Error al completar la conexión con Suunto');
    }
  });

  // 3. Sincronización: workouts + sueño/HRV/recovery de los últimos N días.
  app.post('/api/suunto/sync-history', async (req: Request, res: Response) => {
    const { auth: inputAuth, days } = req.body as { auth?: SuuntoAuth; days?: number };
    if (!inputAuth?.clientId || !inputAuth?.accessToken) {
      return res.status(401).json({
        success: false,
        needsReconnect: true,
        code: 'SUUNTO_AUTH',
        message: 'Suunto no está conectado. Pulsa "Conectar Suunto" e inicia sesión con tu cuenta Suunto.',
      });
    }

    try {
      let auth = inputAuth;
      let refreshed = false;
      if (auth.expiresAt - 60 < Math.floor(Date.now() / 1000)) {
        auth = await refreshAuth(auth);
        refreshed = true;
      }

      const rangeDays = Math.min(Math.max(Number(days) || MAX_SYNC_DAYS, 1), MAX_SYNC_DAYS);
      // 'to' = mañana: incluye todo lo de hoy (Suunto filtra por timestamp < to).
      const to = isoDate(new Date(Date.now() + 24 * 3600 * 1000));
      const from = isoDate(new Date(Date.now() - (rangeDays - 1) * 24 * 3600 * 1000));

      // Workouts: 365 días (historial completo para CTL/ATL/TSB). El perfil
      // (día de tirada larga, FC máx…) usa los últimos 90. Sueño/recovery: máx. 28 días.
      const historyFrom = isoDate(new Date(Date.now() - (WORKOUT_HISTORY_DAYS - 1) * 24 * 3600 * 1000));
      const profileFromMs = Date.now() - PROFILE_WORKOUT_DAYS * 24 * 3600 * 1000;
      const fetchWorkouts = async (token: string) => {
        try {
          return await callMcpTool(token, 'suunto_list_workouts_summary', { from: historyFrom, to });
        } catch (err) {
          // MCP antiguo (máx. 28 días en este tool): se usa el rango corto
          if (err instanceof ReconnectNeededError || !/rango máximo/i.test((err as Error).message)) throw err;
          return callMcpTool(token, 'suunto_list_workouts_summary', { from, to });
        }
      };
      const fetchAll = (token: string) =>
        Promise.all([
          fetchWorkouts(token),
          callMcpTool(token, 'suunto_get_sleep', { from, to }),
          callMcpTool(token, 'suunto_get_recovery', { from, to }),
        ]);

      let results: unknown[];
      try {
        results = await fetchAll(auth.accessToken);
      } catch (err) {
        if (!(err instanceof ReconnectNeededError) || refreshed) throw err;
        auth = await refreshAuth(auth);
        refreshed = true;
        results = await fetchAll(auth.accessToken);
      }

      const [workoutRows, sleepRows, recoveryRows] = results as [SuuntoWorkoutRow[], SuuntoSleepSession[], SuuntoRecoveryDay[]];
      const allWorkoutRows = Array.isArray(workoutRows) ? workoutRows : [];
      const sleepList = Array.isArray(sleepRows) ? sleepRows : [];
      const workouts = mapSuuntoWorkouts(allWorkoutRows);
      const profileFromSuunto = deriveProfileFromSuunto(
        allWorkoutRows.filter((w) => w.startTime >= profileFromMs),
        sleepList,
      );
      const checkIns = mapSuuntoCheckIns(
        sleepList,
        Array.isArray(recoveryRows) ? recoveryRows : [],
        profileFromSuunto.values.baselineHrv,
      );
      const oldest = workouts.reduce<string | null>((min, w) => (!min || w.date < min ? w.date : min), null);

      res.json({
        success: true,
        message: `Sincronizado con Suunto: ${workouts.length} entrenamientos (${oldest ?? historyFrom} → hoy) y ${checkIns.length} días de sueño/HRV (${from} → hoy).`,
        workouts,
        checkIns,
        lastSync: new Date().toISOString(),
        newAuth: refreshed ? auth : undefined,
        profileFromSuunto,
      });
    } catch (err: any) {
      if (err instanceof ReconnectNeededError) {
        return res.status(401).json({
          success: false,
          needsReconnect: true,
          code: 'SUUNTO_AUTH',
          message: `La conexión con Suunto caducó. Pulsa "Conectar Suunto" de nuevo. (${err.message})`,
        });
      }
      console.error('Error in /api/suunto/sync-history:', err);
      res.status(502).json({
        success: false,
        code: 'SUUNTO_UNAVAILABLE',
        error: err.message || 'Error al sincronizar con Suunto',
        hint: 'Comprueba que https://mcp-ten-kappa.vercel.app responde y vuelve a sincronizar. Si persiste, revisa los logs del proyecto mcp en Vercel.',
      });
    }
  });
}
