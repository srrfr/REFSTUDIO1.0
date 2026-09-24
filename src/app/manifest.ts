import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RefStudio - Gestionale Arbitri',
    short_name: 'RefStudio',
    description:
      'Piattaforma avanzata per arbitri di calcio: analisi squadre, calciatori, note disciplinari, video e preparazione della gara.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'fullscreen', 'window-controls-overlay'],
    orientation: 'any',
    background_color: '#08090C',
    theme_color: '#08090C',
    categories: ['sports', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard Arbitro',
        short_name: 'Dashboard',
        description: 'Riepilogo e statistiche arbitrali',
        url: '/',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Partite & Calendario',
        short_name: 'Partite',
        description: 'Calendario partite e designazioni',
        url: '/partite',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Calciatori & Ammoniti',
        short_name: 'Calciatori',
        description: 'Schede disciplinari calciatori',
        url: '/giocatori',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Squadre & Rose',
        short_name: 'Squadre',
        description: 'Analisi squadre del campionato',
        url: '/squadre',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
