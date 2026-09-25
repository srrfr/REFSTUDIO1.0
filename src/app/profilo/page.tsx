'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  User,
  Shield,
  Award,
  MapPin,
  Tag,
  Camera,
  Check,
  AlertCircle,
  LogOut,
  Sparkles,
  FileText,
  Lock,
  Globe,
  Upload,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { RefereeRole, UserAccount } from '@/types/refstudio';
import { DbService } from '@/lib/repository/db-service';

export default function ProfilePage() {
  const { user, updateProfile, logout, openLoginModal, isAdmin, approveUser, rejectUser, availableUsers } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserAccount[]>([]);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [refereeRole, setRefereeRole] = useState<RefereeRole>(user?.refereeRole || 'AE');
  const [sectionAia, setSectionAia] = useState(user?.sectionAia || '');
  const [categoryAia, setCategoryAia] = useState(user?.categoryAia || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [email, setEmail] = useState(user?.email || '');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note statistics
  const [userNotes, setUserNotes] = useState({ total: 0, publicCount: 0, privateCount: 0 });

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setRefereeRole(user.refereeRole);
      setSectionAia(user.sectionAia || '');
      setCategoryAia(user.categoryAia || '');
      setAvatarUrl(user.avatarUrl || '');
      setEmail(user.email || '');

      // Calcola statistiche note dell'utente
      const allUserNotes = DbService.getNotes(undefined, undefined, user.username).filter(
        (n) => n.authorId?.toLowerCase() === user.username.toLowerCase()
      );
      const publicNotes = allUserNotes.filter((n) => n.isPublic !== false);
      const privateNotes = allUserNotes.filter((n) => n.isPublic === false);
      setUserNotes({
        total: allUserNotes.length,
        publicCount: publicNotes.length,
        privateCount: privateNotes.length,
      });

      if (isAdmin) {
        setPendingUsers(DbService.getPendingProfiles());
      }
    }
  }, [user, isAdmin, availableUsers]);

  // Gestione caricamento immagine profilo locale (converte in data URL)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("L'immagine selezionata supera il limite di 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!displayName.trim()) {
      setError('Inserisci il nome e cognome visualizzato.');
      return;
    }

    setSaving(true);
    setError(null);

    const success = await updateProfile({
      displayName: displayName.trim(),
      refereeRole,
      sectionAia: sectionAia.trim(),
      categoryAia: categoryAia.trim(),
      avatarUrl: avatarUrl.trim(),
      email: email.trim(),
    });

    setSaving(false);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setError('Errore durante il salvataggio del profilo.');
    }
  };

  if (!user) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-slate-400 text-sm">Nessuna sessione utente attiva.</p>
        <button
          onClick={openLoginModal}
          className="px-6 py-2.5 rounded-xl bg-[#CCFF00] text-black font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)]"
        >
          Accedi con le tue credenziali
        </button>
      </div>
    );
  }

  const roleOptions: { role: RefereeRole; label: string; desc: string; color: string }[] = [
    {
      role: 'AE',
      label: 'AE - Arbitro Effettivo',
      desc: 'Direttore di gara designato sul terreno di gioco',
      color: 'border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/10',
    },
    {
      role: 'AA',
      label: 'AA - Assistente Arbitrale',
      desc: 'Collaboratore di linea e gestione panchine',
      color: 'border-[#00F0FF] text-[#00F0FF] bg-[#00F0FF]/10',
    },
    {
      role: 'OA',
      label: 'OA - Osservatore Arbitrale',
      desc: 'Organo tecnico, visionatura e refertazione CRA',
      color: 'border-[#D946EF] text-[#D946EF] bg-[#D946EF]/10',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] text-xs font-black uppercase tracking-wider mb-3 shadow-[0_0_12px_rgba(204,255,0,0.2)]">
          <User className="w-3.5 h-3.5" />
          Scheda Personale Arbitro
        </div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          Profilo & Impostazioni Utente
        </h1>
        <p className="text-xs text-slate-400">
          Gestisci il tuo ruolo AIA (AE, AA, OA), sezione, categoria arbitrata e immagine profilo
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-3xl bg-[#0D0F16] border border-[#212638] shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[#CCFF00]/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Preview */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#141824] border-2 border-[#CCFF00] shadow-[0_0_20px_rgba(204,255,0,0.25)] flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-[#CCFF00]">
                  {displayName.charAt(0) || user.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black shadow-lg cursor-pointer transition-transform hover:scale-110">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* User Info & Summary */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-white">{displayName}</h2>
                <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40 font-mono shadow-[0_0_12px_rgba(204,255,0,0.2)]">
                  {refereeRole} • {refereeRole === 'AE' ? 'Arbitro' : refereeRole === 'AA' ? 'Assistente' : 'Osservatore'}
                </span>
                {user.role === 'admin' && (
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    Admin
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 bg-[#141824] px-2.5 py-1 rounded-lg border border-[#212638]">
                <MapPin className="w-3.5 h-3.5 text-[#CCFF00]" />
                {sectionAia || 'Sezione non impostata'}
              </span>
              <span className="flex items-center gap-1.5 bg-[#141824] px-2.5 py-1 rounded-lg border border-[#212638]">
                <Award className="w-3.5 h-3.5 text-[#CCFF00]" />
                {categoryAia || 'Eccellenza'}
              </span>
            </div>

            {/* Note Stats */}
            <div className="grid grid-cols-3 gap-2.5 pt-3 max-w-sm">
              <div className="p-2.5 rounded-xl bg-[#11141D] border border-[#212638] text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Mie Note</span>
                <span className="text-base font-black font-mono text-white">{userNotes.total}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#11141D] border border-[#212638] text-center">
                <span className="text-[10px] text-[#CCFF00] uppercase font-bold block">Pubbliche</span>
                <span className="text-base font-black font-mono text-[#CCFF00]">{userNotes.publicCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#11141D] border border-[#212638] text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Private</span>
                <span className="text-base font-black font-mono text-amber-300">{userNotes.privateCount}</span>
              </div>
            </div>
          </div>

          {/* Quick Switch / Logout */}
          <div className="sm:border-l sm:border-[#1E2333] sm:pl-6 flex flex-col justify-center gap-2">
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnetti</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sezione Riservata Amministratore: Validazione Richieste Profili */}
      {isAdmin && (
        <div className="rounded-3xl bg-[#0D0F16] border border-[#212638] p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/30 text-[#CCFF00]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Validazione Nuovi Profili Arbitrali</h3>
                <p className="text-xs text-slate-400">
                  Notifiche inviate a <span className="text-[#CCFF00] font-mono">rominisamuele@gmail.com</span> per l&apos;abilitazione
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 font-mono">
              {pendingUsers.length} In Sospeso
            </span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#11141D] border border-[#1C2130] text-center text-xs text-slate-400">
              Nessuna richiesta di registrazione in sospeso. Tutti i profili sono convalidati.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((p) => (
                <div
                  key={p.username}
                  className="p-4 rounded-2xl bg-[#11141D] border border-[#212638] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{p.displayName}</span>
                      <span className="text-xs font-mono text-[#CCFF00]">@{p.username}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
                        {p.refereeRole}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {p.sectionAia} • {p.email || 'Email non fornita'} • Categoria: {p.categoryAia}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await approveUser(p.username);
                        setPendingUsers(DbService.getPendingProfiles());
                      }}
                      className="px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(204,255,0,0.3)] cursor-pointer active:scale-95"
                    >
                      ✓ Valida ed Abilita
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await rejectUser(p.username);
                        setPendingUsers(DbService.getPendingProfiles());
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all cursor-pointer"
                    >
                      Rifiuta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Form Card */}
      <div className="rounded-3xl bg-[#0D0F16] border border-[#212638] p-6 sm:p-7 space-y-6">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#CCFF00]" />
            Modifica Dati Profilo
          </h3>
          <p className="text-xs text-slate-400">
            I dati aggiornati saranno immediatamente visibili nelle note arbitrali e propagati a tutti i dispositivi
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. Ruolo Arbitrale Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              1. Ruolo Arbitrale
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {roleOptions.map((opt) => {
                const isSelected = refereeRole === opt.role;
                return (
                  <button
                    key={opt.role}
                    type="button"
                    onClick={() => setRefereeRole(opt.role)}
                    className={`p-4 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? opt.color + ' shadow-[0_0_15px_rgba(204,255,0,0.15)] ring-2 ring-[#CCFF00]/40'
                        : 'bg-[#11141D] border-[#212638] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-white font-mono">{opt.role}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#CCFF00]" />}
                    </div>
                    <p className="text-xs font-bold text-white mb-0.5">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Text Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Nome e Cognome Visualizzato
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Es. Samuele Romini"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome.cognome@aia-figc.it"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Sezione AIA di Appartenenza (Testo)
              </label>
              <input
                type="text"
                value={sectionAia}
                onChange={(e) => setSectionAia(e.target.value)}
                placeholder="Es. Sezione AIA Bologna"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Categoria Arbitrata (Testo)
              </label>
              <input
                type="text"
                value={categoryAia}
                onChange={(e) => setCategoryAia(e.target.value)}
                placeholder="Es. Eccellenza, Promozione, CRA ER"
                className="w-full bg-[#11141D] border border-[#212638] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium"
              />
            </div>
          </div>

          {/* 3. Immagine Profilo URL o Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Immagine Profilo (Carica file o inserisci URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://... URL immagine oppure seleziona un file con il pulsante a destra"
                className="flex-1 bg-[#11141D] border border-[#212638] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/40 font-medium"
              />
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#161B28] hover:bg-[#1E2436] text-[#CCFF00] border border-[#CCFF00]/30 text-xs font-bold cursor-pointer transition-all shrink-0">
                <Upload className="w-4 h-4" />
                <span>Carica da Dispositivo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            {avatarUrl && (
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#CCFF00]" />
                Anteprima immagine caricata correttamente.
              </p>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-[#CCFF00]/15 border border-[#CCFF00]/40 text-[#CCFF00] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>Profilo aggiornato con successo e sincronizzato in rete!</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-[#CCFF00] hover:bg-[#D8FF33] disabled:bg-[#141824] disabled:text-slate-600 text-black font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Salvataggio in corso...' : 'Salva Modifiche Profilo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
