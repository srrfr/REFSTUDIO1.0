import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { AppLayout } from '@/components/layout/AppLayout';
import { PwaRegister } from '@/components/pwa/PwaRegister';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';

export const metadata: Metadata = {
  title: 'RefStudio - Gestionale Professionale per Arbitri di Calcio',
  description:
    'Piattaforma avanzata per arbitri di calcio: analisi squadre, calciatori, note disciplinari, video e preparazione della gara.',
  applicationName: 'RefStudio',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RefStudio',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo_big.png', sizes: '2000x2000', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/logo_big.png', sizes: '2000x2000', type: 'image/png' },
    ],
    shortcut: ['/icons/icon-192x192.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#08090C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RefStudio" />
        <meta name="theme-color" content="#08090C" />
      </head>


      <body className="bg-[#08090C] text-slate-100 min-h-screen antialiased">
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
          <PwaRegister />
          <PwaInstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}

