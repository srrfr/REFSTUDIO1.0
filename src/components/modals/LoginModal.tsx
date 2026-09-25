'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  User,
  Lock,
  Mail,
  Shield,
  Award,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Eye,
  EyeOff,
  UserPlus,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { RefereeRole } from '@/types/refstudio';

export const LoginModal: React.FC = () => {
  const { user, authLoaded, isLoginModalOpen, closeLoginModal, login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regSectionAia, setRegSectionAia] = useState('Sezione AIA Bologna');
  const [regRefereeRole, setRegRefereeRole] = useState<RefereeRole>('AE');
  const [regCategoryAia, setRegCategoryAia] = useState('Eccellenza');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Se l'autenticazione non è ancora caricata da localStorage, non renderizzare per evitare flicker
  if (!authLoaded) return null;

  // Modalità Gate: se non c'è alcun utente loggato, il portale si oscura obbligatoriamente
  const isGateMode = !user;
  const isOpen = isGateMode || isLoginModalOpen;

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Inserisci sia nome utente che password.');
      return;
    }

    setLoginError('');
    setLoginLoading(true);

    const res = await login(loginUsername, loginPassword);
    setLoginLoading(false);

    if (!res.success) {
      setLoginError(res.message || 'Credenziali non valide.');
    } else {
      setLoginUsername('');
      setLoginPassword('');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regDisplayName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setRegError('Nome e cognome, Username e Password sono obbligatori.');
      return;
    }

    setRegError('');
    setRegSuccess('');
    setRegLoading(true);

    const res = await register({
      displayName: regDisplayName.trim(),
      username: regUsername.trim(),
      password: regPassword.trim(),
      email: regEmail.trim() || undefined,
      sectionAia: regSectionAia.trim() || 'AIA Emilia-Romagna',
      refereeRole: regRefereeRole,
      categoryAia: regCategoryAia.trim() || 'Eccellenza',
    });

    setRegLoading(false);

    if (!res.success) {
      setRegError(res.message || 'Errore durante la registrazione.');
    } else {
      const registeredUsername = regUsername.trim();
      setRegSuccess(res.message || 'Richiesta registrata con successo.');
      // Precompila username per il login successivo
      setLoginUsername(registeredUsername);
      setRegDisplayName('');
      setRegUsername('');
      setRegPassword('');
      setRegEmail('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-300 select-none"
      onClick={(e) => {
        // Se l'utente è già autenticato e ha aperto il modal volontariamente, consentiamo la chiusura
        if (!isGateMode && user && e.target === e.currentTarget) {
          closeLoginModal();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-3xl bg-[#0C0E15] border border-[#212638] shadow-[0_0_60px_rgba(0,0,0,0.85)] p-5 sm:p-7 text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pulsante chiudi solo se l'utente è già loggato */}
        {!isGateMode && user && (
          <button
            type="button"
            onClick={closeLoginModal}
            className="absolute right-4 top-4 text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-[#151926] transition-colors cursor-pointer active:scale-95 z-20"
            title="Chiudi"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/90 border border-[#CCFF00]/40 flex items-center justify-center p-1.5 shadow-[0_0_20px_rgba(204,255,0,0.3)]">
              <img src="/logo_small.png" alt="RefStudio" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl tracking-tight text-white">REFSTUDIO</span>
                <span className="text-[10px] uppercase font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Gestionale Arbitri & Osservatori AIA</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#08090E] border border-[#1C2130]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setLoginError('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'LOGIN'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-[#131722]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Accedi</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setRegError('');
              setRegSuccess('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'REGISTER'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-[#131722]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrati</span>
          </button>
        </div>

        {/* TAB 1: ACCEDI */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Nome Utente
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Inserisci il tuo username..."
                  autoComplete="username"
                  required
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
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Inserisci la tua password..."
                  autoComplete="current-password"
                  required
                  className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium transition-all"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <span>{loginLoading ? 'Verifica credenziali...' : 'Accedi a RefStudio'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('REGISTER');
                  setRegError('');
                  setRegSuccess('');
                }}
                className="text-xs text-slate-400 hover:text-[#CCFF00] transition-colors cursor-pointer"
              >
                Non hai ancora un account?{' '}
                <span className="text-[#CCFF00] font-bold underline">Registrati qui &rarr;</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTRATI */}
        {activeTab === 'REGISTER' && (
          <div className="space-y-4">
            {regSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-emerald-300">Richiesta Inviata con Successo!</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  È stata recapitata la notifica a{' '}
                  <strong className="text-white">rominisamuele@gmail.com</strong> per la validazione del tuo profilo.
                  Non appena l&apos;amministratore confermerà l&apos;accesso, potrai entrare subito con le credenziali appena create.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('LOGIN');
                      setRegSuccess('');
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-all cursor-pointer"
                  >
                    Torna alla schermata di Login
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Info validation notice */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#141824] border border-[#242A3C] text-xs text-slate-300 leading-relaxed">
                  <Clock className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
                  <span>
                    La registrazione richiede la validazione da parte dell&apos;amministratore (
                    <span className="text-[#CCFF00] font-mono font-bold">rominisamuele@gmail.com</span>) prima di poter accedere.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Nome e Cognome *
                    </label>
                    <input
                      type="text"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder="es. Mario Rossi"
                      required
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Nome Utente (Username) *
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="es. mariorossi"
                      required
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Crea password..."
                        required
                        className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 pr-8 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="es. mario.rossi@email.it"
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Sezione AIA
                    </label>
                    <input
                      type="text"
                      value={regSectionAia}
                      onChange={(e) => setRegSectionAia(e.target.value)}
                      placeholder="es. Sezione AIA Bologna"
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Categoria AIA
                    </label>
                    <select
                      value={regCategoryAia}
                      onChange={(e) => setRegCategoryAia(e.target.value)}
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00] font-medium"
                    >
                      <option value="Eccellenza">Eccellenza</option>
                      <option value="Promozione">Promozione</option>
                      <option value="Prima Categoria">Prima Categoria</option>
                      <option value="CAN D">CAN D</option>
                      <option value="CRA / Sezionale">CRA / Sezionale</option>
                    </select>
                  </div>
                </div>

                {/* Ruolo Arbitrale Select Buttons */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Ruolo Principale
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'AE', label: 'AE • Arbitro' },
                      { id: 'AA', label: 'AA • Assistente' },
                      { id: 'OA', label: 'OA • Osservatore' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRegRefereeRole(r.id as RefereeRole)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          regRefereeRole === r.id
                            ? 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/50 shadow-[0_0_10px_rgba(204,255,0,0.2)]'
                            : 'bg-[#11141D] text-slate-400 border-[#212638] hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {regError && (
                  <div className="flex items-start gap-2.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl leading-relaxed">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{regLoading ? 'Invio richiesta in corso...' : 'Invia Richiesta di Registrazione'}</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('LOGIN');
                      setLoginError('');
                    }}
                    className="text-xs text-slate-400 hover:text-[#CCFF00] transition-colors cursor-pointer"
                  >
                    Hai già un profilo autorizzato?{' '}
                    <span className="text-[#CCFF00] font-bold underline">Accedi qui &rarr;</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
