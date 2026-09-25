'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Shield,
  Users,
  FileText,
  UserCheck,
  Award,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Designazioni', href: '/designazioni', icon: Award },
    { label: 'Squadre', href: '/squadre', icon: Shield },
    { label: 'Calciatori', href: '/giocatori', icon: Users },
    { label: 'Profilo', href: '/profilo', icon: UserCheck },
  ];

  return (
    <nav
      aria-label="Navigazione Rapida Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0C10]/95 backdrop-blur-xl border-t border-[#1C2130] px-2 py-1.5 safe-area-pb shadow-[0_-8px_25px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative min-w-[56px] ${
                isActive
                  ? 'text-[#CCFF00]'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              {/* Active glow pill */}
              {isActive && (
                <span className="absolute -top-1.5 w-7 h-1 bg-[#CCFF00] rounded-full shadow-[0_0_10px_#CCFF00]" />
              )}

              {item.href === '/profilo' && user?.avatarUrl ? (
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden border mb-0.5 transition-all ${
                    isActive
                      ? 'border-[#CCFF00] shadow-[0_0_8px_rgba(204,255,0,0.6)]'
                      : 'border-[#262C3D]'
                  }`}
                >
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <Icon
                  className={`w-5 h-5 mb-0.5 transition-transform ${
                    isActive ? 'scale-110 text-[#CCFF00]' : 'text-slate-400'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              )}

              <span
                className={`text-[10px] font-bold tracking-tight leading-none ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
