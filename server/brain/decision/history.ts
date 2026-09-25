// Verificación DETERMINISTA de lo extraído del historial .md: cada cifra que
// devuelve la IA tiene que aparecer escrita en el documento. Si no, se anula.
import { numberAppears } from './race.js';

const SUMMARY_NUMBERS = ['aetHr', 'antHr', 'maxHr', 'restingHr', 'weeklyVolumeKm'] as const;
const PROFILE_NUMBERS = ['aetHr', 'antHr', 'maxHr', 'restingHr'] as const;

export function verifyHistoryNumbers(parsed: any, markdown: string): { parsed: any; removed: string[] } {
  const out = { ...(parsed || {}) };
  const removed: string[] = [];
  const check = (obj: any, keys: readonly string[], prefix: string) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    for (const k of keys) {
      const v = copy[k];
      if (v == null) continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || !numberAppears(n, markdown)) {
        removed.push(`${prefix}${k}=${v}`);
        copy[k] = null;
      }
    }
    return copy;
  };
  out.summary = check(out.summary, SUMMARY_NUMBERS, 'summary.');
  out.extractedProfileUpdates = check(out.extractedProfileUpdates, PROFILE_NUMBERS, 'profile.');
  return { parsed: out, removed };
}
