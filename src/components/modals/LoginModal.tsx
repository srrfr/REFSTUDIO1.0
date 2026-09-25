'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { User, Lock, CheckCircle2, AlertCircle, X, Shield, ChevronRight, Eye, EyeOff } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { user, isLoginModalOpen, closeLoginModal, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Chiudi con tasto Escape se l'utente è autenticato
  useEffect(() => {
    if (!isLoginModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && user) {
        closeLoginModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoginModalOpen, user, closeLoginModal]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (user && e.target === e.currentTarget) closeLoginModal();
      }}
    >
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-5 sm:p-7 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {user && (
          <button
            type="button"
            onClick={closeLoginModal}
            className="absolute right-4 top-4 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-[#141824] transition-colors cursor-pointer active:scale-95 z-20"
            title="Chiudi (Esc)"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#CCFF00]/15 border border-[#CCFF00]/30 rounded-2xl text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.25)]">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Accesso Arbitrale</h3>
            <p className="text-xs text-slate-400">
              Inserisci il tuo username e la password per accedere
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
                placeholder="Inserisci il tuo username..."
                autoComplete="username"
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
                autoComplete="current-password"
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
            <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span>{loading ? 'Verifica credenziali...' : 'Accedi a RefStudio'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#1C2130] text-center space-y-2">
          <p className="text-xs text-slate-400">
            Non hai ancora un account autorizzato?
          </p>
          <a
            href="/login?tab=register"
            onClick={closeLoginModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#CCFF00] hover:underline"
          >
            Richiedi registrazione nuovo profilo &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};
