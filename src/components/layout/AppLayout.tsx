'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { LoginModal } from '@/components/modals/LoginModal';
import { RealtimeSyncProvider } from '@/lib/supabase/realtime-context';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <RealtimeSyncProvider>
      <div className="flex min-h-screen bg-[#08090C] text-slate-100 antialiased selection:bg-[#CCFF00] selection:text-black">
        {/* Sidebar supports both desktop sticky and mobile/tablet drawer */}
        <Sidebar
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
          />
          <main className="flex-1 p-3.5 sm:p-5 md:p-8 pb-24 md:pb-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
            {children}
          </main>
        </div>

        {/* Thumb-zone navigation for mobile phones */}
        <BottomNav />

        <LoginModal />
      </div>
    </RealtimeSyncProvider>
  );
};
