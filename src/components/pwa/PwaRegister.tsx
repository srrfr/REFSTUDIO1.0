'use client';

import { useEffect } from 'react';

export const PwaRegister = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker attivo (Scope):', registration.scope);

          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nuova versione di RefStudio pronta!');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[PWA] Errore registrazione Service Worker:', error);
        });
    }
  }, []);


  return null;
};
