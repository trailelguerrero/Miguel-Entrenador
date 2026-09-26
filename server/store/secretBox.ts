// Cifrado de secretos guardados en Supabase (tokens de Suunto): AES-256-GCM.
//
//   Clave de cifrado: TOKEN_ENCRYPTION_KEY si existe; si no, APP_SECRET; si no,
//   SUPABASE_SERVICE_ROLE_KEY (secreto que solo tiene el servidor, nunca la base).
//   Cambiar la clave que se use obliga a reconectar Suunto una vez.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { loginSecrets } from '../auth.js';

export interface SealedBox {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

function key(): Buffer {
  const base = process.env.TOKEN_ENCRYPTION_KEY || loginSecrets()[0] || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('Sin clave para cifrar (TOKEN_ENCRYPTION_KEY, APP_SECRET o SUPABASE_SERVICE_ROLE_KEY).');
  return createHash('sha256').update(`miguel-tokens:${base}`).digest();
}

export function seal(value: unknown): SealedBox {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

/** null si no se puede descifrar (clave cambiada o datos corruptos). */
export function open<T = unknown>(box: unknown): T | null {
  try {
    const b = box as SealedBox;
    if (!b || b.v !== 1) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(b.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(b.tag, 'base64'));
    const out = Buffer.concat([decipher.update(Buffer.from(b.data, 'base64')), decipher.final()]);
    return JSON.parse(out.toString('utf8')) as T;
  } catch {
    return null;
  }
}
