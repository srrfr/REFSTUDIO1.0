'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  ClipboardCheck,
  Star,
  DollarSign,
  Navigation,
  AlertCircle,
  ArrowRight,
  Shield,
  Check,
  Flame,
  Activity,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { DbService } from '@/lib/repository/db-service';
import {
  Match,
  MatchDesignation,
  RefereePersonalStats,
  Team,
  DesignationRole,
} from '@/types/refstudio';
import { useAuth } from '@/lib/auth/auth-context';
import { PreparaGaraModal } from '@/components/modals/PreparaGaraModal';
import { DesignationModal } from '@/components/modals/DesignationModal';
import { TeamBadge } from '@/components/common/AvatarBadge';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';

export default function DesignazioniPage() {
  const { user } = useAuth();
  const currentUserId = user?.username || 'samueleromini';

  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PLAYED' | 'ALL_MATCHES'>('UPCOMING');
  const [designatedList, setDesignatedList] = useState<
    { match: Match; designation: MatchDesignation }[]
  >([]);
  const [personalStats, setPersonalStats] = useState<RefereePersonalStats | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Search & Filter in "Tutto il Calendario"
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGirone, setSelectedGirone] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [selectedMatchDay, setSelectedMatchDay] = useState<string>('ALL');

  // Modals state
  const [isDesignationModalOpen, setIsDesignationModalOpen] = useState(false);
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [modalDesignation, setModalDesignation] = useState<MatchDesignation | null>(null);

  const [isPreparaGaraOpen, setIsPreparaGaraOpen] = useState(false);
  const [preparaGaraMatch, setPreparaGaraMatch] = useState<Match | null>(null);

  const loadData = useCallback(() => {
    const list = DbService.getDesignatedMatches(currentUserId);
    setDesignatedList(list);

    const stats = DbService.getRefereePersonalStats(currentUserId);
    setPersonalStats(stats);

    const matches = DbService.getMatches();
    setAllMatches(matches);

    const t = DbService.getTeams();
    setTeams(t);
  }, [currentUserId]);

  useRealtimeSync(loadData);

  useEffect(() => {
    loadData();

    const handleDesignationsUpdated = () => {
      loadData();
    };

    window.addEventListener('refstudio-designations-update', handleDesignationsUpdated);
    return () => {
      window.removeEventListener('refstudio-designations-update', handleDesignationsUpdated);
    };
  }, [loadData]);

  // Teams logo map
  const teamLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((t) => {
      if (t.logoUrl) {
        map.set(t.name.toLowerCase().trim(), t.logoUrl);
        map.set(t.id, t.logoUrl);
        if (t.normalizedName) {
          map.set(t.normalizedName.toLowerCase().trim(), t.logoUrl);
        }
      }
    });
    return map;
  }, [teams]);

  // Upcoming designated matches
  const upcomingDesignated = useMemo(() => {
    return designatedList
      .filter((d) => !d.match.played)
      .sort((a, b) => (a.match.matchDay || 0) - (b.match.matchDay || 0));
  }, [designatedList]);

  // Past / played designated matches
  const playedDesignated = useMemo(() => {
    return designatedList
      .filter((d) => d.match.played)
      .sort((a, b) => (b.match.matchDay || 0) - (a.match.matchDay || 0));
  }, [designatedList]);

  // Set of designated match IDs for quick lookup
  const designatedMatchIds = useMemo(() => {
    const set = new Set<string>();
    designatedList.forEach((d) => set.add(d.match.id));
    return set;
  }, [designatedList]);

  // Filtered all matches list for Tab 3
  const filteredAllMatches = useMemo(() => {
    let result = allMatches;

    if (selectedGirone !== 'ALL') {
      result = result.filter((m) => m.girone === selectedGirone);
    }

    if (selectedMatchDay !== 'ALL') {
      const dayNum = parseInt(selectedMatchDay, 10);
      result = result.filter((m) => m.matchDay === dayNum);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.homeTeamName.toLowerCase().includes(q) ||
          m.awayTeamName.toLowerCase().includes(q) ||
          (m.matchField && m.matchField.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => {
      if (a.matchDay !== b.matchDay) return (a.matchDay || 0) - (b.matchDay || 0);
      return a.homeTeamName.localeCompare(b.homeTeamName);
    });
  }, [allMatches, selectedGirone, selectedMatchDay, searchQuery]);

  // Open Designation Modal
  const handleOpenDesignationModal = (match: Match, designation?: MatchDesignation | null) => {
    setModalMatch(match);
    setModalDesignation(designation || null);
    setIsDesignationModalOpen(true);
  };

  // Quick toggle designation
  const handleToggleDesignation = (match: Match) => {
    const isDes = designatedMatchIds.has(match.id);
    if (isDes) {
      const existing = designatedList.find((d) => d.match.id === match.id);
      handleOpenDesignationModal(match, existing?.designation);
    } else {
      // Set default designation and open modal for adjustments
      const newDes = DbService.setMatchDesignation(match.id, currentUserId, {
        role: (user?.refereeRole as DesignationRole) || 'AE',
        customDateText: match.dateText,
        customField: match.matchField,
      });
      loadData();
      handleOpenDesignationModal(match, newDes);
    }
  };

  // Save from Modal
  const handleSaveDesignation = (data: Partial<MatchDesignation>) => {
    if (!modalMatch) return;
    DbService.setMatchDesignation(modalMatch.id, currentUserId, data);
    loadData();
  };

  // Remove from Modal
  const handleRemoveDesignation = (matchId?: string) => {
    const idToRemove = matchId || modalMatch?.id;
    if (!idToRemove) return;
    DbService.removeMatchDesignation(idToRemove, currentUserId);
    loadData();
  };

  // Prepara la gara
  const handleOpenPreparaGara = (match: Match) => {
    setPreparaGaraMatch(match);
    setIsPreparaGaraOpen(true);
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'AE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#CCFF00] text-black shadow-[0_0_10px_rgba(204,255,0,0.4)]">
            AE • Arbitro
          </span>
        );
      case 'AA1':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.4)]">
            AA1 • 1° Ass.
          </span>
        );
      case 'AA2':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-400 text-black shadow-[0_0_10px_rgba(56,189,248,0.4)]">
            AA2 • 2° Ass.
          </span>
        );
      case 'OA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]">
            OA • Osservatore
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#CCFF00] text-black">
            AE • Arbitro
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. HEADER HERO: REFEREE PROFILE & DESIGNATIONS CONTROL */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0C0E15] border border-[#1F2433] p-6 md:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#CCFF00]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141824] border border-[#262C3D] text-[11px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              <span className="text-white">Designazioni AIA Ufficiali</span>
              <span className="text-[#CCFF00]">• Scheda Personale</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-black/90 border border-[#CCFF00]/40 flex items-center justify-center p-1.5 shadow-[0_0_20px_rgba(204,255,0,0.3)] shrink-0 overflow-hidden">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-[#141824] flex items-center justify-center text-[#CCFF00] font-black text-xl">
                    {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'SR'}
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                  {user?.displayName || 'Samuele Romini'}
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 font-black">
                    {user?.refereeRole || 'AE'}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {user?.sectionAia || 'Sezione AIA Bologna'} • Categoria {user?.categoryAia || 'Eccellenza'}
                </p>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Indica le gare del campionato per le quali sei stato designato. Le statistiche, i radar e i briefing tattici verranno calcolati specificamente per il tuo storico arbitrale.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('ALL_MATCHES')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs transition-all shadow-[0_0_20px_rgba(204,255,0,0.35)] active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-black" strokeWidth={3} />
              + Aggiungi Designazione
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#141824] hover:bg-[#1D2335] text-slate-200 hover:text-white font-bold text-xs border border-[#212638] transition-all cursor-pointer"
            >
              Vai alla Dashboard <ArrowRight className="w-3.5 h-3.5 text-[#CCFF00]" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. REFEREE PERSONAL KPI GRID */}
      {personalStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Designazioni Totali */}
          <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider">
                Designazioni Totali
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] group-hover:scale-110 transition-transform">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{personalStats.totalDesignations}</div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[#CCFF00]">{personalStats.roleCounts.ae} AE</span> •{' '}
              <span>{personalStats.roleCounts.aa} AA</span> •{' '}
              <span>{personalStats.roleCounts.oa} OA</span>
            </p>
          </div>

          {/* Card 2: Gare Dirette (Disputate) */}
          <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider">Gare Disputate</span>
              <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{personalStats.playedMatches}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              {personalStats.teamsOfficiatedCount} squadre diverse arbitrate
            </p>
          </div>

          {/* Card 3: In Programma */}
          <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider">In Programma</span>
              <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-white">{personalStats.upcomingMatches}</div>
            <p className="text-[11px] text-slate-400 mt-1">Prossime designazioni assegnate</p>
          </div>

          {/* Card 4: Disciplina & Voto OA */}
          <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider">
                Voto OA & Cartellini
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                <Star className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-white flex items-center gap-2">
              <span>{personalStats.avgRefereeScore ? personalStats.avgRefereeScore.toFixed(2) : '8.40'}</span>
              <span className="text-xs font-bold text-yellow-400 flex items-center">⭐ OA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Media {personalStats.avgCardsPerMatch} 🟨 a gara • {personalStats.totalRedCards} 🟥
            </p>
          </div>
        </div>
      )}

      {/* 3. TABS SELECTOR */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#1A1F2C] pb-3">
        <div className="flex items-center gap-2 p-1 bg-[#0A0C10] border border-[#1E2333] rounded-2xl">
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'UPCOMING'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>In Programma</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === 'UPCOMING' ? 'bg-black text-[#CCFF00]' : 'bg-[#181D2A] text-slate-300'
              }`}
            >
              {upcomingDesignated.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PLAYED')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'PLAYED'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Gare Disputate / Storico</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === 'PLAYED' ? 'bg-black text-[#CCFF00]' : 'bg-[#181D2A] text-slate-300'
              }`}
            >
              {playedDesignated.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ALL_MATCHES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'ALL_MATCHES'
                ? 'bg-[#CCFF00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-[#141824]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Tutto il Calendario</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === 'ALL_MATCHES' ? 'bg-black text-[#CCFF00]' : 'bg-[#181D2A] text-slate-300'
              }`}
            >
              {allMatches.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {activeTab === 'ALL_MATCHES' ? (
            <span>Seleziona una gara per designarti con 1 click</span>
          ) : (
            <span>Gare assegnate a te ({designatedList.length})</span>
          )}
        </div>
      </div>

      {/* 4. TAB 1: UPCOMING DESIGNATIONS */}
      {activeTab === 'UPCOMING' && (
        <div className="space-y-4">
          {upcomingDesignated.length === 0 ? (
            <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-white">Nessuna gara futura in programma</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Non hai ancora gare future contrassegnate come tue designazioni. Sfoglia il calendario completo e clicca &quot;Designami&quot; sulla tua prossima partita!
              </p>
              <button
                onClick={() => setActiveTab('ALL_MATCHES')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(204,255,0,0.35)] cursor-pointer"
              >
                <Calendar className="w-4 h-4" /> Sfoglia Calendario Gare
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingDesignated.map(({ match, designation }) => (
                <div
                  key={match.id}
                  className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/50 transition-all p-5 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Girone, Day, Role Badge */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#CCFF00] text-[11px] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                          Girone {match.girone} • Giornata {match.matchDay}
                        </span>
                        {getRoleBadge(designation.role)}
                      </div>

                      <button
                        onClick={() => handleOpenDesignationModal(match, designation)}
                        className="text-slate-400 hover:text-[#CCFF00] text-xs flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        title="Modifica Designazione"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Modifica
                      </button>
                    </div>

                    {/* Teams Row */}
                    <div className="flex items-center justify-between gap-3 py-2 bg-[#12151F] border border-[#212638] rounded-xl px-4">
                      <div className="flex-1 text-center space-y-1">
                        <TeamBadge
                          name={match.homeTeamName}
                          logoUrl={
                            teamLogoMap.get(match.homeTeamId) ||
                            teamLogoMap.get(match.homeTeamName.toLowerCase().trim())
                          }
                          size="md"
                          className="mx-auto"
                        />
                        <p className="font-extrabold text-xs text-white truncate max-w-[120px] mx-auto">
                          {match.homeTeamName}
                        </p>
                      </div>

                      <div className="text-center px-3 py-1 bg-[#090A0E] border border-[#1E2333] rounded-lg">
                        <span className="font-black text-lg tracking-widest text-[#CCFF00]">VS</span>
                      </div>

                      <div className="flex-1 text-center space-y-1">
                        <TeamBadge
                          name={match.awayTeamName}
                          logoUrl={
                            teamLogoMap.get(match.awayTeamId) ||
                            teamLogoMap.get(match.awayTeamName.toLowerCase().trim())
                          }
                          size="md"
                          className="mx-auto"
                        />
                        <p className="font-extrabold text-xs text-white truncate max-w-[120px] mx-auto">
                          {match.awayTeamName}
                        </p>
                      </div>
                    </div>

                    {/* Schedule & Stadium Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#11141D] border border-[#1C2130]">
                        <Clock className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                        <span className="truncate">{designation.customDateText || match.dateText}</span>
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#11141D] border border-[#1C2130]">
                        <MapPin className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                        <span className="truncate">
                          {designation.customField || match.matchField || 'Impianto da comunicare'}
                        </span>
                      </div>
                    </div>

                    {/* Terna Details if present */}
                    {(designation.assistant1 || designation.assistant2 || designation.observer) && (
                      <div className="p-3 rounded-xl bg-[#11141D] border border-[#1C2130] text-[11px] space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                          Ufficiali di Gara Designati:
                        </span>
                        {designation.assistant1 && (
                          <div className="text-slate-300">
                            <span className="font-bold text-cyan-400">AA1:</span> {designation.assistant1}
                          </div>
                        )}
                        {designation.assistant2 && (
                          <div className="text-slate-300">
                            <span className="font-bold text-sky-400">AA2:</span> {designation.assistant2}
                          </div>
                        )}
                        {designation.observer && (
                          <div className="text-slate-300">
                            <span className="font-bold text-amber-400">OA:</span> {designation.observer}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Personal pre-match notes */}
                    {designation.notes && (
                      <div className="p-3 rounded-xl bg-[#161B28] border border-[#242D42] text-xs text-slate-200">
                        <span className="text-[10px] font-bold text-[#CCFF00] block mb-0.5 uppercase tracking-wide">
                          Note Personali Pre-Gara:
                        </span>
                        <p className="italic text-slate-300 text-[11px]">{designation.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#1C2130] flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleRemoveDesignation(match.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Rimuovi
                    </button>

                    <button
                      onClick={() => handleOpenPreparaGara(match)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(204,255,0,0.35)] active:scale-95 cursor-pointer ml-auto"
                    >
                      <ClipboardCheck className="w-4 h-4 text-black" />
                      Prepara la Gara
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 2: PLAYED / HISTORICAL DESIGNATIONS */}
      {activeTab === 'PLAYED' && (
        <div className="space-y-4">
          {playedDesignated.length === 0 ? (
            <div className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] p-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#141824] border border-[#242A3C] flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-white">Nessuna gara disputata registrata</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Le gare disputate per cui sei stato designato appariranno qui insieme a cartellini, voti dell&apos;osservatore e consuntivi rimborsi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playedDesignated.map(({ match, designation }) => (
                <div
                  key={match.id}
                  className="rounded-2xl bg-[#0D0F16] border border-[#1F2433] hover:border-emerald-500/40 transition-all p-5 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Girone {match.girone} • Giornata {match.matchDay}
                        </span>
                        {getRoleBadge(designation.role)}
                      </div>

                      <button
                        onClick={() => handleOpenDesignationModal(match, designation)}
                        className="text-slate-400 hover:text-[#CCFF00] text-xs flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        title="Modifica Consuntivo"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Modifica Dati
                      </button>
                    </div>

                    {/* Teams & Final Score */}
                    <div className="flex items-center justify-between gap-3 py-2 bg-[#12151F] border border-[#212638] rounded-xl px-4">
                      <div className="flex-1 text-center space-y-1">
                        <TeamBadge
                          name={match.homeTeamName}
                          logoUrl={
                            teamLogoMap.get(match.homeTeamId) ||
                            teamLogoMap.get(match.homeTeamName.toLowerCase().trim())
                          }
                          size="md"
                          className="mx-auto"
                        />
                        <p className="font-extrabold text-xs text-white truncate max-w-[120px] mx-auto">
                          {match.homeTeamName}
                        </p>
                      </div>

                      <div className="text-center px-4 py-1.5 bg-[#090A0E] border border-[#1E2333] rounded-xl">
                        <span className="font-black text-xl tracking-widest text-[#CCFF00]">
                          {match.homeScore ?? 0} : {match.awayScore ?? 0}
                        </span>
                        <span className="text-[9px] block text-emerald-400 font-bold uppercase mt-0.5">
                          FINALE
                        </span>
                      </div>

                      <div className="flex-1 text-center space-y-1">
                        <TeamBadge
                          name={match.awayTeamName}
                          logoUrl={
                            teamLogoMap.get(match.awayTeamId) ||
                            teamLogoMap.get(match.awayTeamName.toLowerCase().trim())
                          }
                          size="md"
                          className="mx-auto"
                        />
                        <p className="font-extrabold text-xs text-white truncate max-w-[120px] mx-auto">
                          {match.awayTeamName}
                        </p>
                      </div>
                    </div>

                    {/* Match Performance Metrics */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-[#11141D] border border-[#1C2130]">
                        <span className="text-[10px] text-slate-400 block font-semibold">Gialli</span>
                        <span className="text-xs font-black text-yellow-400 font-mono">
                          {designation.yellowCardsGiven ?? 4} 🟨
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-[#11141D] border border-[#1C2130]">
                        <span className="text-[10px] text-slate-400 block font-semibold">Rossi</span>
                        <span className="text-xs font-black text-rose-400 font-mono">
                          {designation.redCardsGiven ?? 0} 🟥
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-[#11141D] border border-[#1C2130]">
                        <span className="text-[10px] text-slate-400 block font-semibold">Rigori</span>
                        <span className="text-xs font-black text-white font-mono">
                          {designation.penaltiesAwarded ?? 0} ⚽
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-[#11141D] border border-[#1C2130]">
                        <span className="text-[10px] text-slate-400 block font-semibold">Voto OA</span>
                        <span className="text-xs font-black text-[#CCFF00] font-mono">
                          {designation.refereeScore ? `${designation.refereeScore} ⭐` : '8.40 ⭐'}
                        </span>
                      </div>
                    </div>

                    {/* Travel & Diaria if available */}
                    {(designation.diariaEuro || designation.travelKm) && (
                      <div className="p-2.5 rounded-xl bg-[#11141D] border border-[#1C2130] flex items-center justify-between text-xs text-slate-300">
                        {designation.diariaEuro ? (
                          <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                            <DollarSign className="w-3.5 h-3.5" /> Diaria: €{designation.diariaEuro}
                          </span>
                        ) : null}

                        {designation.travelKm ? (
                          <span className="flex items-center gap-1.5 font-mono text-sky-400 font-bold">
                            <Navigation className="w-3.5 h-3.5" /> Percorsi: {designation.travelKm} Km
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Post-match remarks */}
                    {designation.notes && (
                      <div className="p-3 rounded-xl bg-[#161B28] border border-[#242D42] text-xs text-slate-300">
                        <span className="text-[10px] font-bold text-[#CCFF00] block mb-0.5 uppercase tracking-wide">
                          Riepilogo e Note Gara:
                        </span>
                        <p className="italic text-[11px] text-slate-300">{designation.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#1C2130] flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleRemoveDesignation(match.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Rimuovi
                    </button>

                    <button
                      onClick={() => handleOpenPreparaGara(match)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#181D2B] hover:bg-[#232A3E] text-slate-200 hover:text-white font-bold text-xs transition-all border border-[#262D40] active:scale-95 cursor-pointer ml-auto"
                    >
                      <ClipboardCheck className="w-4 h-4 text-[#CCFF00]" />
                      Dossier Squadre
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 3: ALL MATCHES BROWSER & 1-CLICK DESIGNATION */}
      {activeTab === 'ALL_MATCHES' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#0D0F16] border border-[#1F2433] flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca squadra o campo..."
                className="w-full bg-[#12151E] border border-[#212638] focus:border-[#CCFF00] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Girone & MatchDay Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-1 bg-[#12151E] border border-[#212638] rounded-xl p-1 text-xs">
                {(['ALL', 'A', 'B'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGirone(g)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedGirone === g
                        ? 'bg-[#CCFF00] text-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {g === 'ALL' ? 'Tutti i Gironi' : `Girone ${g}`}
                  </button>
                ))}
              </div>

              {/* Matchday Selector */}
              <select
                value={selectedMatchDay}
                onChange={(e) => setSelectedMatchDay(e.target.value)}
                className="bg-[#12151E] border border-[#212638] text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#CCFF00]"
              >
                <option value="ALL">Tutte le Giornate (1-34)</option>
                {Array.from({ length: 34 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Giornata {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Matches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredAllMatches.map((m) => {
              const isDesignated = designatedMatchIds.has(m.id);
              const desItem = designatedList.find((d) => d.match.id === m.id);

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 group ${
                    isDesignated
                      ? 'bg-[#121722] border-[#CCFF00]/60 shadow-[0_0_15px_rgba(204,255,0,0.12)]'
                      : 'bg-[#0D0F16] border-[#1F2433] hover:border-[#2C3347]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-[#CCFF00] text-[10px] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                        Girone {m.girone} • G.{m.matchDay}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {m.played ? 'Disputata' : m.dateText}
                      </span>
                    </div>

                    {/* Teams row */}
                    <div className="flex items-center justify-between py-1 gap-2">
                      <div className="flex-1 text-left flex items-center gap-2">
                        <TeamBadge
                          name={m.homeTeamName}
                          logoUrl={
                            teamLogoMap.get(m.homeTeamId) ||
                            teamLogoMap.get(m.homeTeamName.toLowerCase().trim())
                          }
                          size="sm"
                        />
                        <p className="font-bold text-xs text-white truncate max-w-[100px]">
                          {m.homeTeamName}
                        </p>
                      </div>

                      <div className="px-2.5 py-1 bg-[#090A0E] border border-[#222838] rounded-lg text-xs font-mono font-black text-white shrink-0">
                        {m.played && m.homeScore !== undefined
                          ? `${m.homeScore} - ${m.awayScore}`
                          : 'VS'}
                      </div>

                      <div className="flex-1 text-right flex items-center justify-end gap-2">
                        <p className="font-bold text-xs text-white truncate max-w-[100px]">
                          {m.awayTeamName}
                        </p>
                        <TeamBadge
                          name={m.awayTeamName}
                          logoUrl={
                            teamLogoMap.get(m.awayTeamId) ||
                            teamLogoMap.get(m.awayTeamName.toLowerCase().trim())
                          }
                          size="sm"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 truncate">
                      🏟️ {m.matchField || 'Campo federale'}
                    </div>
                  </div>

                  {/* Designation CTA button */}
                  <div className="pt-2 border-t border-[#1C2130] flex items-center justify-between gap-2">
                    {isDesignated ? (
                      <>
                        <button
                          onClick={() => handleOpenDesignationModal(m, desItem?.designation)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 text-[#CCFF00] border border-[#CCFF00]/40 font-black text-xs transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-[#CCFF00]" strokeWidth={3} />
                          Designato ({desItem?.designation.role || 'AE'})
                        </button>

                        <button
                          onClick={() => handleOpenPreparaGara(m)}
                          className="p-1.5 rounded-lg bg-[#141824] hover:bg-[#1D2335] text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Prepara la Gara"
                        >
                          <ClipboardCheck className="w-4 h-4 text-[#CCFF00]" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleToggleDesignation(m)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#141824] hover:bg-[#1E2436] hover:border-[#CCFF00]/40 text-slate-300 hover:text-white border border-[#212638] font-bold text-xs transition-all cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#CCFF00]" />
                        Designami per questa gara
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Designation Modal */}
      <DesignationModal
        isOpen={isDesignationModalOpen}
        onClose={() => setIsDesignationModalOpen(false)}
        match={modalMatch}
        existingDesignation={modalDesignation}
        onSave={handleSaveDesignation}
        onRemove={() => handleRemoveDesignation(modalMatch?.id)}
      />

      {/* Prepara la Gara Modal */}
      {preparaGaraMatch && (
        <PreparaGaraModal
          isOpen={isPreparaGaraOpen}
          onClose={() => setIsPreparaGaraOpen(false)}
          match={preparaGaraMatch}
        />
      )}
    </div>
  );
}
