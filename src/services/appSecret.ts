// Clave de Supabase de la app (el valor de INGEST_SECRET en Vercel). Protege la
// Biblioteca de Miguel y las conversaciones guardadas.
// Por defecto solo vive en esta pestaña (sessionStorage); con "recordar en este
// dispositivo" se guarda en localStorage para no escribirla cada vez.
const KEY = 'uphill_coach_knowledge_secret';

export const AppSecret = {
  get(): string {
    try {
      return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '';
    } catch {
      return '';
    }
  },

  isRemembered(): boolean {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  },

  set(value: string, remember: boolean): void {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
      if (!value) return;
      (remember ? localStorage : sessionStorage).setItem(KEY, value);
    } catch {
      // sin almacenamiento: habrá que escribir la clave en cada visita
    }
  },
};
