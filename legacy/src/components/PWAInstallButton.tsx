import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  // If already running as an installed standalone PWA, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        title="Instalar App en tu móvil o escritorio"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  // Android sin aviso automático de Chrome (p. ej. justo después de desinstalar):
  // se instala desde el menú de Chrome.
  if (isAndroid) {
    return (
      <>
        <button
          onClick={() => setShowAndroidGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition-all cursor-pointer"
          title="Instalar en Android"
          aria-label="Instalar la app en Android"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>

        {/* Portal: la cabecera usa backdrop-blur, que recortaría un modal 'fixed' dentro de ella */}
        {showAndroidGuide && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-2xl text-stone-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  Instalar en Android
                </h3>
                <button
                  onClick={() => setShowAndroidGuide(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed mb-4">
                <span>1. Abre esta página en <strong>Chrome</strong> (no desde otra app).</span><br />
                <span>2. Pulsa el menú <strong>⋮</strong> arriba a la derecha.</span><br />
                <span>3. Pulsa <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong> → <strong>Instalar</strong>.</span><br />
                <span className="text-stone-400">Si acabas de desinstalarla y no aparece la opción, cierra Chrome del todo, vuelve a abrir la página y espera unos segundos.</span>
              </p>
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-stone-950 font-bold text-xs hover:bg-emerald-400 transition"
              >
                Entendido
              </button>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition-all cursor-pointer"
          title="Instalar en iPhone"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Instalar en iOS</span>
        </button>

        {/* Portal: la cabecera usa backdrop-blur, que recortaría un modal 'fixed' dentro de ella */}
        {showIOSGuide && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-2xl text-stone-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  Instalar en iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed space-y-2 mb-4">
                <span>1. Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.</span><br />
                <span>2. Desliza hacia abajo y pulsa <strong>"Añadir a la pantalla de inicio"</strong>.</span><br />
                <span>3. Pulsa <strong>Añadir</strong> en la esquina superior derecha.</span>
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-stone-950 font-bold text-xs hover:bg-emerald-400 transition"
              >
                Entendido
              </button>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return null;
};
