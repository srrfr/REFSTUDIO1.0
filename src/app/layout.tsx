import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'RefStudio - Gestionale Professionale per Arbitri di Calcio',
  description: 'Piattaforma avanzata per arbitri di calcio: analisi squadre, calciatori, note disciplinari, video e briefing AI.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#08090C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
