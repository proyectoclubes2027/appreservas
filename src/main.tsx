import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Limpieza preventiva de caché heredada
if ('caches' in window) {
  caches.delete('caec-tenis-v1').catch(() => {});
}

// Registrar Service Worker para PWA y forzar comprobación activa de versión
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] SW registrado correctamente');
        // 1. Chequeo inicial
        reg.update().catch(() => {});

        // 2. Chequeo periódico cada 15 minutos
        setInterval(() => {
          reg.update().catch(() => {});
        }, 15 * 60 * 1000);

        // 3. Vital para iOS / iPhone (PWA Standalone):
        // Al desbloquear el teléfono o volver a la app desde el fondo, se dispara visibilitychange
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });

        window.addEventListener('focus', () => {
          reg.update().catch(() => {});
        });
      })
      .catch((err) => console.log('[PWA] Error en SW:', err));
  });

  // 4. Auto-recarga cuando se activa una nueva versión (Workbox clientsClaim + skipWaiting)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

