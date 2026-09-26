// Sesión de la app (Fase B). La clave (APP_SECRET o INGEST_SECRET de Vercel) se
// escribe UNA vez por dispositivo: el servidor responde con una cookie de sesión
// HttpOnly de 90 días y la clave no se guarda en el navegador.
const LEGACY_KEY = 'uphill_coach_knowledge_secret';

let loginInFlight: Promise<boolean> | null = null;

/** Clave de versiones anteriores (guardada en el navegador): se usa una vez para abrir sesión y se borra. */
function takeLegacyKey(): string {
  try {
    const k = sessionStorage.getItem(LEGACY_KEY) || localStorage.getItem(LEGACY_KEY) || '';
    sessionStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_KEY);
    return k;
  } catch {
    return '';
  }
}

async function postLogin(key: string): Promise<boolean> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  return res.ok;
}

async function doLogin(): Promise<boolean> {
  const legacy = takeLegacyKey();
  if (legacy && (await postLogin(legacy).catch(() => false))) return true;
  if (typeof window === 'undefined') return false;
  let message = 'Escribe la clave de la app (APP_SECRET o INGEST_SECRET en Vercel).\nSolo hace falta una vez en este dispositivo: no se guarda la clave, sino una sesión de 90 días.';
  for (let i = 0; i < 3; i++) {
    const typed = window.prompt(message);
    if (!typed || !typed.trim()) return false;
    if (await postLogin(typed.trim()).catch(() => false)) return true;
    message = 'La clave no es correcta. Vuelve a escribirla (APP_SECRET o INGEST_SECRET en Vercel).';
  }
  return false;
}

export const Session = {
  /** Pide la clave y abre sesión (una sola ventana aunque fallen varias peticiones a la vez). */
  login(): Promise<boolean> {
    loginInFlight ??= doLogin().finally(() => {
      loginInFlight = null;
    });
    return loginInFlight;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
  },
};

/**
 * fetch con sesión: si el servidor responde 401 AUTH_REQUIRED, pide la clave una vez,
 * abre sesión y repite la petición.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  if (res.status !== 401) return res;
  const code = await res
    .clone()
    .json()
    .then((d) => d?.code)
    .catch(() => undefined);
  if (code !== 'AUTH_REQUIRED') return res;
  if (!(await Session.login())) return res;
  return fetch(path, { credentials: 'same-origin', ...init });
}
