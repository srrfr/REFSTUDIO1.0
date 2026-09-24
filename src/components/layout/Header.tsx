'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, User, Lock, CheckCircle2, Cloud, RefreshCw, Zap, Menu, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/supabase/realtime-context';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const router = useRouter();
  const { user, isAdmin, openLoginModal } = useAuth();
  const { isConfigured, isConnected, onlineRefereesCount, lastEvent, syncNow } = useRealtime();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showLiveNotification, setShowLiveNotification] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    }
  }, []);


  // Mostra notifica toast quando arriva un aggiornamento in tempo reale da un altro dispositivo
  useEffect(() => {
    if (lastEvent) {
      setShowLiveNotification(true);
      const timer = setTimeout(() => setShowLiveNotification(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/squadre?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncNow();
    setTimeout(() => setIsSyncing(false), 600);
  };

  return (
    <header className="h-16 bg-[#0A0C10]/90 backdrop-blur-md border-b border-[#1B1F2C] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Search & Live Realtime Indicator */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 mr-2">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-[#11141D] border border-[#212638] text-slate-300 hover:text-[#CCFF00] hover:border-[#CCFF00]/40 transition-colors shrink-0"
          title="Apri Menu Navigazione"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo piccolo visibile su mobile in alto a sinistra */}
        <Link href="/" className="lg:hidden flex items-center shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-black/90 border border-[#CCFF00]/40 flex items-center justify-center p-0.5 shadow-[0_0_10px_rgba(204,255,0,0.25)] group-hover:scale-105 transition-transform overflow-hidden">
            <img src="/logo_small.png" alt="RefStudio Logo" className="w-full h-full object-contain" />
          </div>
        </Link>

        <form onSubmit={handleSearch} className="relative flex-1 min-w-[120px] max-w-[200px] sm:max-w-xs md:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca squadra o calciatore..."
            className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00] transition-all"
          />
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 absolute left-2.5 sm:left-3 top-2 sm:top-2.5" />
        </form>

        {/* Live Network Sync Pill (Multi-Dispositivo) */}
        {isConfigured ? (
          <button
            onClick={handleManualSync}
            title="Clicca per sincronizzare subito tutti i dati con il cloud Supabase"
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#11141D] border border-[#212638] hover:border-[#CCFF00]/40 transition-all cursor-pointer group"
          >
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CCFF00] opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isConnected ? 'bg-[#CCFF00]' : 'bg-amber-400'
                }`}
              ></span>
            </span>
            <span className="text-[10px] font-black tracking-wider text-slate-300 uppercase group-hover:text-white">
              {isConnected ? `RETE LIVE (${onlineRefereesCount} DISP)` : 'RICONNESSIONE...'}
            </span>
            <RefreshCw
              className={`w-3 h-3 text-[#CCFF00] ml-1 opacity-70 group-hover:opacity-100 ${
                isSyncing ? 'animate-spin' : ''
              }`}
            />
          </button>
        ) : (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#11141D] border border-[#212638]">
            <span className="w-2 h-2 rounded-full bg-[#CCFF00]"></span>
            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">
              LOCALE • PRONTO SUPABASE
            </span>
          </div>
        )}

        {/* Banner animato quando arriva un evento in tempo reale */}
        {showLiveNotification && lastEvent && (
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CCFF00]/15 border border-[#CCFF00]/40 text-[#CCFF00] text-[11px] font-bold animate-in fade-in slide-in-from-left duration-300">
            <Zap className="w-3.5 h-3.5" />
            <span className="truncate max-w-[280px]">{lastEvent.summary}</span>
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Pulsante Installa App (visibile se non ancora installata a schermo intero) */}
        {!isStandalone && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('pwa-install-trigger'))}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all shrink-0 active:scale-95 cursor-pointer animate-pulse hover:animate-none"
            title="Installa RefStudio a schermo intero sul tuo smartphone o tablet"
          >
            <Download className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            <span className="hidden sm:inline">Installa App</span>
            <span className="sm:hidden">Installa</span>
          </button>
        )}

        {/* Admin Indicator (solo se admin @samueleromini) */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[#CCFF00] text-xs font-black">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span className="hidden sm:inline">Admin</span>
          </div>
        )}

        {/* Referee Profile Card / Persistent Button to Profile */}
        {user ? (
          <button
            onClick={() => router.push('/profilo')}
            title="Apri la tua Scheda Profilo Arbitro (Gestisci ruolo, sezione, categoria e avatar)"
            className="flex items-center gap-2.5 pl-3 border-l border-[#1B1F2C] hover:opacity-95 transition-all group text-left cursor-pointer"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[#11141D] border border-[#CCFF00]/50 group-hover:border-[#CCFF00] flex items-center justify-center text-[#CCFF00] overflow-hidden shadow-[0_0_10px_rgba(204,255,0,0.2)] group-hover:shadow-[0_0_15px_rgba(204,255,0,0.4)] transition-all">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black text-[#CCFF00]">
                    {user.displayName?.charAt(0) || user.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-[#0D0F16] border border-[#CCFF00]/40 rounded text-[8px] font-mono font-black text-[#CCFF00]">
                {user.refereeRole || 'AE'}
              </span>
            </div>

            <div className="hidden md:block">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white group-hover:text-[#CCFF00] transition-colors leading-tight">
                  {user.displayName}
                </p>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                {user.sectionAia || user.categoryAia || 'Sezione AIA'}
              </p>
            </div>

            <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#11141D] border border-[#212638] text-[10px] font-extrabold text-[#CCFF00] group-hover:bg-[#CCFF00]/15 group-hover:border-[#CCFF00]/40 transition-all">
              Scheda Profilo
            </span>
          </button>
        ) : (
          <button
            onClick={openLoginModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#CCFF00] text-black font-black text-xs shadow-[0_0_12px_rgba(204,255,0,0.3)] hover:bg-[#D8FF33] transition-all"
          >
            <User className="w-4 h-4" />
            <span>Accedi</span>
          </button>
        )}
      </div>
    </header>
  );
};
