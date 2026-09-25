import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Actualizaciones de la app instalada (PWA): cuando se publica una versión
// nueva, el service worker la descarga y toma el control; sin esto el móvil
// seguía mostrando la versión anterior hasta cerrar la app del todo.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Solo en actualizaciones (no en la primera instalación) y una sola vez
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  // Al volver a la app (p. ej. desde otra pestaña o de segundo plano), buscar versión nueva
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
