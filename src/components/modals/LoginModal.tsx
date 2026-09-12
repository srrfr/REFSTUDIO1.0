'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { User, Lock, CheckCircle2, AlertCircle, X, Shield, ChevronRight, Eye, EyeOff } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { user, isLoginModalOpen, closeLoginModal, login, availableUsers } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isLoginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Inserisci sia nome utente che password.');
      return;
    }

    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);

    if (!res.success) {
      setError(res.message || 'Credenziali non valide.');
    } else {
      setUsername('');
      setPassword('');
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-4 sm:p-7 text-slate-100">
        {user && (
          <button
            onClick={closeLoginModal}
            className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-[#CCFF00]/15 border border-[#CCFF00]/30 rounded-2xl text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.25)]">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Accesso Arbitrale & Tecnico</h3>
            <p className="text-xs text-slate-400">
              Accedi con le tue credenziali per archiviare note, video e consultare le gare
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Nome Utente
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Es. samueleromini"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium transition-all"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci la tua password..."
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium transition-all"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Verifica credenziali...' : 'Accedi a RefStudio'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick select users */}
        <div className="mt-6 pt-5 border-t border-[#1C2130]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Utenti Autorizzati (Clicca per pre-compilare)</span>
            <span className="text-[#CCFF00] text-[10px] font-mono">5 Account</span>
          </p>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {availableUsers.map((u) => (
              <button
                key={u.username}
                type="button"
                onClick={() => handleQuickFill(u.username, u.password || '')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#11141D] hover:bg-[#181C28] border border-[#212638] hover:border-[#CCFF00]/40 transition-all text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#181C28] border border-[#2B3245] flex items-center justify-center text-[11px] font-black text-[#CCFF00]">
                    {u.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                        {u.displayName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 font-mono">
                        {u.refereeRole}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {u.sectionAia} • <code className="text-slate-400 font-mono">{u.username}</code>
                    </span>
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 font-mono group-hover:text-[#CCFF00]">
                  Seleziona
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
