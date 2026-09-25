'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Shield,
  Users,
  Calendar,
  FileText,
  Video,
  RefreshCw,
  Award,
  Sparkles,
  Lock,
  UserCheck,
  User,
  X,
  Download,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);
    }
  }, []);

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Le mie Designazioni', href: '/designazioni', icon: Award },
    { label: 'Calciatori & Stats', href: '/giocatori', icon: Users },
    { label: 'Squadre & Rose', href: '/squadre', icon: Shield },
    { label: 'Partite & Classifiche', href: '/partite', icon: Calendar },
    { label: 'Note & Video', href: '/note-video', icon: FileText },
    { label: 'Profilo Arbitro', href: '/profilo', icon: UserCheck },
    { label: 'Accedi / Login', href: '/login', icon: Lock },
    ...(isAdmin ? [{ label: 'Data Provider Sync', href: '/admin/sync', icon: RefreshCw }] : []),
  ];

  const renderContent = (isMobileView: boolean = false) => (
    <>
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-[#1B1F2C] flex items-center justify-between">
          <Link
            href="/"
            onClick={() => isMobileView && onClose?.()}
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-black/90 border border-[#CCFF00]/40 flex items-center justify-center p-1 shadow-[0_0_18px_rgba(204,255,0,0.35)] group-hover:scale-105 transition-transform overflow-hidden shrink-0">
              <img
                src="/logo_small.png"
                alt="RefStudio Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight text-white group-hover:text-[#CCFF00] transition-colors">
                  REFSTUDIO
                </span>
                <span className="text-[10px] uppercase font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Live Stats & Arbitri ER</p>
            </div>
          </Link>

          {isMobileView && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#141722] transition-colors cursor-pointer active:scale-95"
              title="Chiudi Menu"
              aria-label="Chiudi Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3.5 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobileView && onClose?.()}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all ${
                  isActive
                    ? 'bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.35)]'
                    : 'text-slate-400 hover:text-white hover:bg-[#141722]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin Status & Footer */}
      <div className="p-4 border-t border-[#1B1F2C] space-y-3">
        <div className="p-3.5 rounded-xl bg-[#11141D] border border-[#212638]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-400 font-semibold">Ruolo Attuale</span>
            {isAdmin ? (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40">
                ADMIN
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#1C202C] text-slate-300 border border-[#2B3142]">
                ARBITRO
              </span>
            )}
          </div>

          {!isInstalled ? (
            <button
              onClick={() => {
                if (isMobileView) onClose?.();
                window.dispatchEvent(new CustomEvent('pwa-install-trigger'));
              }}
              className="w-full mt-2 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 bg-[#141824] hover:bg-[#1D2335] text-slate-300 hover:text-[#CCFF00] border border-[#212638] hover:border-[#CCFF00]/40 transition-all cursor-pointer"
              title="Installa RefStudio a schermo intero sul tuo smartphone o tablet"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#CCFF00]" />
              <span>Installa App (PWA)</span>
            </button>
          ) : (
            <div className="mt-2 py-1 px-2 rounded-lg bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#CCFF00]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
              <span>App Installata (Schermo Intero)</span>
            </div>
          )}
        </div>


        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span className="text-slate-400">Gemini AI Hub</span>
          </div>
          <span className="text-[10px] text-slate-600 font-mono">v1.0-dark</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed sticky) */}
      <aside className="hidden lg:flex w-64 bg-[#0A0C10] border-r border-[#1B1F2C] flex-col justify-between shrink-0 h-screen sticky top-0 select-none">
        {renderContent(false)}
      </aside>

      {/* Mobile & Tablet Drawer (Off-canvas slide-out) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Dark Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />
          {/* Drawer Panel */}
          <aside className="relative w-72 max-w-[85vw] bg-[#0A0C10] border-r border-[#1B1F2C] flex flex-col justify-between h-full z-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-left duration-300 select-none">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
