'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Lock,
  Mail,
  Shield,
  Award,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowRight,
  Send,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { RefereeRole } from '@/types/refstudio';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSectionAia, setRegSectionAia] = useState('');
  const [regRefereeRole, setRegRefereeRole] = useState<RefereeRole>('AE');
  const [regCategoryAia, setRegCategoryAia] = useState('Eccellenza');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'register') {
      setActiveTab('REGISTER');
    }
  }, [searchParams]);

  // Se l'utente è già autenticato e valido, reindirizza alla dashboard
  useEffect(() => {
    if (user && user.isApproved !== false && user.status !== 'PENDING') {
      router.push('/');
    }
  }, [user, router]);

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
      router.push('/');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword.trim() || !regDisplayName.trim()) {
      setRegError('Username, Password e Nome completo sono obbligatori.');
      return;
    }

    setRegError('');
    setRegSuccess('');
    setRegLoading(true);

    const res = await register({
      username: regUsername.trim(),
      password: regPassword.trim(),
      displayName: regDisplayName.trim(),
      email: regEmail.trim() || undefined,
      sectionAia: regSectionAia.trim() || 'AIA Emilia-Romagna',
      refereeRole: regRefereeRole,
      categoryAia: regCategoryAia.trim() || 'Eccellenza',
    });

    setRegLoading(false);

    if (!res.success) {
      setRegError(res.message || 'Errore durante la registrazione.');
    } else {
      setRegSuccess(res.message || 'Richiesta inviata con successo.');
      setRegUsername('');
      setRegPassword('');
      setRegDisplayName('');
      setRegEmail('');
      setRegSectionAia('');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-3 sm:px-6 select-none">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-black/90 border border-[#CCFF00]/40 flex items-center justify-center p-1 shadow-[0_0_20px_rgba(204,255,0,0.35)] group-hover:scale-105 transition-transform overflow-hidden">
              <img src="/logo_small.png" alt="RefStudio Logo" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl tracking-tight text-white group-hover:text-[#CCFF00] transition-colors">
                  REFSTUDIO
                </span>
                <span className="text-[10px] uppercase font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Gestionale Arbitri & Osservatori AIA</p>
            </div>
          </Link>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Tabs Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#090A0E] border border-[#1A1F2C]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('LOGIN');
                setLoginError('');
                setRegError('');
                setRegSuccess('');
              }}
              className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'LOGIN'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-[#141824]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Accedi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('REGISTER');
                setLoginError('');
                setRegError('');
                setRegSuccess('');
              }}
              className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'REGISTER'
                  ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-[#141824]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Nuovo Profilo</span>
            </button>
          </div>

          {/* TAB 1: SOLO USERNAME E PASSWORD */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-black text-white">Accesso Riservato</h2>
                <p className="text-xs text-slate-400">
                  Inserisci le tue credenziali personali per accedere al tuo fascicolo arbitrale.
                </p>
              </div>

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
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span>{loginLoading ? 'Verifica credenziali...' : 'Accedi a RefStudio'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="pt-3 border-t border-[#1C2130] text-center">
                <p className="text-xs text-slate-400">
                  Non hai ancora un profilo validato?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('REGISTER')}
                    className="text-[#CCFF00] font-bold hover:underline cursor-pointer ml-1"
                  >
                    Richiedi registrazione &rarr;
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTRAZIONE NUOVO PROFILO (NOTIFICA A rominisamuele@gmail.com) */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-black text-white">Richiesta Nuovo Profilo Arbitro</h2>
                <p className="text-xs text-slate-400">
                  Compila i tuoi dati AIA. La richiesta verrà inviata a <span className="text-[#CCFF00] font-mono">rominisamuele@gmail.com</span> per la validazione.
                </p>
              </div>

              {/* Security info banner */}
              <div className="p-3.5 rounded-2xl bg-[#141824] border border-[#262C3D] flex items-start gap-2.5 text-xs text-slate-300">
                <Shield className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Controllo Accessi AIA:</strong> L&apos;amministratore convaliderà il profilo dopo aver verificato la tua appartenenza alla sezione e al comitato regionale.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nome e Cognome *
                  </label>
                  <input
                    type="text"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="Es. Mario Rossi"
                    required
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Username Desiderato *
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Es. mariorossi"
                    required
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Scegli password..."
                      required
                      className="w-full bg-[#11141D] border border-[#212638] rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
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
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tua Email
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Per ricevere conferma..."
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Sezione AIA
                  </label>
                  <input
                    type="text"
                    value={regSectionAia}
                    onChange={(e) => setRegSectionAia(e.target.value)}
                    placeholder="Es. Sezione AIA Bologna"
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={regCategoryAia}
                    onChange={(e) => setRegCategoryAia(e.target.value)}
                    placeholder="Es. Eccellenza, Promozione"
                    className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>
              </div>

              {/* Ruolo AIA Radio Buttons */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Ruolo Principale AIA
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'AE' as RefereeRole, label: 'AE • Arbitro', desc: 'Effettivo' },
                    { id: 'AA' as RefereeRole, label: 'AA • Assistente', desc: 'Guardalinee' },
                    { id: 'OA' as RefereeRole, label: 'OA • Osservatore', desc: 'Tutor' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRegRefereeRole(r.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        regRefereeRole === r.id
                          ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-white shadow-sm'
                          : 'bg-[#11141D] border-[#212638] text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className={`text-xs font-black block ${regRefereeRole === r.id ? 'text-[#CCFF00]' : ''}`}>
                        {r.label}
                      </span>
                      <span className="text-[10px] text-slate-500">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {regError && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Richiesta inoltrata con successo!</span>
                  </div>
                  <p className="leading-relaxed">
                    È stata inviata un&apos;email a <strong className="text-white">rominisamuele@gmail.com</strong> che provvederà a convalidare l&apos;accesso. Potrai accedere dalla scheda di login non appena il profilo sarà abilitato.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('LOGIN')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-black text-xs mt-1"
                  >
                    Torna al Login &rarr;
                  </button>
                </div>
              )}

              {!regSuccess && (
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3.5 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {regLoading
                      ? 'Invio notifica a rominisamuele@gmail.com...'
                      : 'Invia Richiesta di Validazione'}
                  </span>
                </button>
              )}

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGIN')}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Hai già un account? <span className="text-[#CCFF00] font-bold">Accedi qui</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* AIA Disclaimer Footer */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>RefStudio • Piattaforma riservata per la classe arbitrale AIA FIGC</p>
          <p>Per supporto tecnico e autorizzazioni: <a href="mailto:rominisamuele@gmail.com" className="text-slate-400 hover:text-[#CCFF00]">rominisamuele@gmail.com</a></p>
        </div>
      </div>
    </div>
  );
}
