/**
 * La API tiene que arrancar en Node puro (ESM), como en Vercel: allí cada .ts se
 * compila por separado y Node NO añade extensiones. Un import relativo sin ".js"
 * (p. ej. './zonesense') funciona con tsx y en los demás tests, pero en Vercel
 * tira la función entera al arrancar (ERR_MODULE_NOT_FOUND) y deja sin API a la
 * app: Suunto, chat, planes…
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return tsFiles(p);
    return /\.ts$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

test('La API arranca en Node puro sin resolver imports sin extensión (como en Vercel)', async () => {
  // Dentro del repo para que encuentre node_modules
  const out = fs.mkdtempSync(path.join(ROOT, '.esm-check-'));
  try {
    const entries = ['api', 'server', 'src/brain', 'src/utils', 'src/types'].flatMap((d) => tsFiles(path.join(ROOT, d)));
    await build({ entryPoints: entries, outdir: out, outbase: ROOT, format: 'esm', platform: 'node', bundle: false, logLevel: 'silent' });
    fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ type: 'module' }));
    const script = `import(${JSON.stringify(path.join(out, 'api/index.js'))}).then(m => { if (typeof m.default !== 'function') throw new Error('sin app'); process.exit(0); })`;
    try {
      execFileSync(process.execPath, ['-e', script], { cwd: ROOT, stdio: 'pipe', timeout: 30_000 });
    } catch (err: any) {
      assert.fail(`La API no arranca en Node puro:\n${String(err.stderr || err.message).split('\n').slice(0, 6).join('\n')}`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
