'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Shield, KeyRound, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({ isOpen, onClose }) => {
  const { isAdmin, elevateToAdmin, revokeAdmin } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const res = elevateToAdmin(pin);
    if (res.success) {
      setSuccessMsg('Autenticazione Amministratore riuscita! Permessi abilitati.');
      setPin('');
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
      }, 1200);
    } else {
      setError(res.message || 'Codice PIN non corretto. Riprova.');
    }
  };

  const handleRevoke = () => {
    revokeAdmin();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-4 sm:p-6 text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-[#CCFF00]/15 border border-[#CCFF00]/30 rounded-xl text-[#CCFF00] shadow-[0_0_12px_rgba(204,255,0,0.25)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Console Amministratore</h3>
            <p className="text-xs text-slate-400">Inserisci il PIN di sicurezza per abilitare modifiche</p>
          </div>
        </div>

        {isAdmin ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Modalità Amministratore ATTIVA.</span>
                <p className="text-xs text-slate-300">Hai pieni poteri di modifica anagrafica e sync dati.</p>
              </div>
            </div>

            <button
              onClick={handleRevoke}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-[#FF334B]/15 hover:bg-[#FF334B]/25 text-[#FF334B] border border-[#FF334B]/30 transition-colors"
            >
              Disattiva Privilegi Amministratore
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Codice PIN Riservato
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Digita il codice (es. 280899)"
                  maxLength={10}
                  autoFocus
                  className="w-full bg-[#12151E] border border-[#212638] rounded-xl px-4 py-3 pl-11 text-lg font-mono tracking-widest text-[#CCFF00] placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/40 focus:border-[#CCFF00] transition-all"
                />
                <KeyRound className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-[#FF334B] bg-[#FF334B]/10 border border-[#FF334B]/20 p-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 text-xs text-[#CCFF00] bg-[#CCFF00]/10 border border-[#CCFF00]/20 p-2.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl font-black text-sm bg-[#CCFF00] hover:bg-[#d8ff33] text-black transition-all shadow-[0_0_18px_rgba(204,255,0,0.35)]"
              >
                Conferma ed Entra come Admin
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
