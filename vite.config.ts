import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// Versión visible en la app (panel "Estado de las APIs") para saber qué versión carga el móvil
const APP_VERSION = `${(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Uphill Coach AI - Trail Running & Suunto',
          short_name: 'UphillCoach',
          description: 'Entrenador inteligente de Trail Running y Ultra Trail basado en Uphill Athlete, Suunto ZoneSense y recuperación por HRV.',
          theme_color: '#0c0a09',
          background_color: '#0c0a09',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          // PNG 192/512 (+ maskable): Chrome en Android los necesita para instalar la app
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // /api/* lo atiende el servidor (p. ej. /api/suunto/connect es una navegación
          // real hacia el login de Suunto): el service worker no debe responder con index.html.
          navigateFallbackDenylist: [/^\/api\//],
          // La versión nueva toma el control en cuanto se descarga (main.tsx recarga la página)
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
