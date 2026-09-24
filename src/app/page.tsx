'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Calendar,
  FileText,
  Video,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Play,
  Activity,
  Award,
  ChevronRight,
  Flame,
  Target,
  Zap,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  Lock,
} from 'lucide-react';
import { DbService } from '@/lib/repository/db-service';
import { Team, Player, Match, Note, VideoClip, PreMatchBriefing } from '@/types/refstudio';
import { TagBadge } from '@/components/common/TagBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { RatingStars } from '@/components/common/RatingStars';
import { AiBriefingModal } from '@/components/modals/AiBriefingModal';
import { MediaViewerModal, MediaViewerItem } from '@/components/media/MediaViewerModal';
import { useRealtimeSync } from '@/lib/supabase/realtime-context';
import { useAuth } from '@/lib/auth/auth-context';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalTeams: 0,
    totalPlayers: 0,
    totalMatches: 0,
    playedMatches: 0,
    upcomingMatches: 0,
    totalNotes: 0,
    totalVideos: 0,
    highRiskPlayers: 0,
  });

  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentTeams, setRecentTeams] = useState<Team[]>([]);
  const [flaggedPlayers, setFlaggedPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [recentVideos, setRecentVideos] = useState<VideoClip[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerMedia, setActiveViewerMedia] = useState<MediaViewerItem | null>(null);

  // AI Briefing State
  const [isAiBriefingOpen, setIsAiBriefingOpen] = useState(false);
  const [currentBriefing, setCurrentBriefing] = useState<PreMatchBriefing | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const { user } = useAuth();

  const loadDashboardData = React.useCallback(() => {
    // Load summary
    setStats(DbService.getStatsSummary());

    // Matches
    const matches = DbService.getMatches(undefined, 1);
    setUpcomingMatches(matches.slice(0, 4));

    // Teams
    const teams = DbService.getTeams();
    setRecentTeams(teams.slice(0, 4));

    // Flagged players
    const players = DbService.getPlayers();
    const flagged = players
      .filter((p) => p.customTags.length > 0 || p.yellowCards >= 2 || p.redCards > 0)
      .slice(0, 6);
    setFlaggedPlayers(flagged);
    if (flagged.length > 0) {
      setSelectedPlayerId((prev) => (prev ? prev : flagged[0].id));
    }

    // Notes & Videos (filter private notes of other users)
    setRecentNotes(DbService.getNotes(undefined, undefined, user?.username).slice(0, 3));
    setRecentVideos(DbService.getVideos().slice(0, 2));
  }, [user?.username]);

  // Sottoscrizione a Supabase Realtime per aggiornare istantaneamente la dashboard da qualsiasi dispositivo
  useRealtimeSync(loadDashboardData);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleGenerateBriefing = async (match: Match) => {
    setIsAiLoading(true);
    setIsAiBriefingOpen(true);
    setCurrentBriefing(null);

    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBriefing(data.data);
      }
    } catch (err) {
      console.error('Failed to generate briefing:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const featuredMatch = upcomingMatches[0] || null;
  const activeSpotlightPlayer =
    flaggedPlayers.find((p) => p.id === selectedPlayerId) || flaggedPlayers[0] || null;

  // Tactical Pitch coordinates according to role
  const getPitchMarkerStyle = (role?: string) => {
    switch (role) {
      case 'ATT':
        return { top: '22%', left: '50%' };
      case 'CEN':
        return { top: '48%', left: '50%' };
      case 'DIF':
        return { top: '72%', left: '50%' };
      case 'POR':
        return { top: '88%', left: '50%' };
      default:
        return { top: '50%', left: '50%' };
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. TOP HERO: MATCHDAY LIVE CENTER & AIA CONTROL HUB */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0C0E15] border border-[#1F2433] p-6 md:p-8">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#CCFF00]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          {/* Left Title & System Status */}
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141824] border border-[#262C3D] text-[11px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              <span className="text-white">Eccellenza ER</span>
              <span className="text-[#CCFF00]">• Centro Live Score & Statistiche</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Football Matchday & Player Radar
            </h1>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Piattaforma analitica per arbitri e osservatori: monitoraggio cartellini, profili disciplinari dei calciatori e briefing tattici generati da Gemini AI.
            </p>
          </div>

          {/* Right: Featured Match Live Score HUD Card */}
          {featuredMatch ? (
            <div className="w-full lg:w-[440px] shrink-0 bg-[#12151F] border border-[#23293A] rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  Girone {featuredMatch.girone} • Giornata {featuredMatch.matchDay}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 text-[10px] font-black uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping" />
                  MATCH IN EVIDENZA
                </span>
              </div>

              {/* Teams & Score display */}
              <div className="flex items-center justify-between gap-2 py-2">
                <div className="flex-1 text-center space-y-1">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-[#1B202D] border border-[#2B3245] flex items-center justify-center font-black text-xs text-[#CCFF00] shadow-sm">
                    {featuredMatch.homeTeamName.substring(0, 3).toUpperCase()}
                  </div>
                  <p className="font-extrabold text-xs text-white truncate max-w-[120px] mx-auto">
                    {featuredMatch.homeTeamName}
                  </p>
                </div>

                <div className="text-center px-4 py-1.5 rounded-xl bg-[#090A0E] border border-[#1E2333]">
                  <span className="font-black text-2xl tracking-widest text-[#CCFF00]">
                    {featuredMatch.played && featuredMatch.homeScore !== undefined
                      ? `${featuredMatch.homeScore} : ${featuredMatch.awayScore}`
                      : 'VS'}
                  </span>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">{featuredMatch.dateText}</p>
                </div>

                <div className="flex-1 text-center space-y-1">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-[#1B202D] border border-[#2B3245] flex items-center justify-center font-black text-xs text-[#CCFF00] shadow-sm">
                    {featuredMatch.awayTeamName.substring(0, 3).toUpperCase()}
                  </div>
                  <p className="font-extrabold text-xs text-white truncate max-w-[120px] mx-auto">
                    {featuredMatch.awayTeamName}
                  </p>
                </div>
              </div>

              {/* Action Button: AI Gemini Briefing */}
              <div className="pt-2 border-t border-[#1C2130] flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                  🏟️ {featuredMatch.matchField || 'Campo da designare'}
                </span>
                <button
                  onClick={() => handleGenerateBriefing(featuredMatch)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#d8ff33] text-black font-black text-xs transition-all shadow-[0_0_18px_rgba(204,255,0,0.35)] active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-black fill-black" />
                  Briefing AI Gemini
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. PLAYER STATISTICS SPOTLIGHT & TACTICAL HUD (DRIBBLE SHOT CENTERPIECE) */}
      {activeSpotlightPlayer && (
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-3xl p-6 md:p-7 space-y-5">
          {/* Header & Spotlight Switcher Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1F2C] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#CCFF00] flex items-center justify-center text-black font-black shadow-[0_0_12px_rgba(204,255,0,0.35)]">
                <Activity className="w-4 h-4 text-black" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wide">
                  Player Statistics & Radar Arbitrale
                </h2>
                <p className="text-[11px] text-slate-400">
                  Focus dettagliato sui calciatori sotto osservazione e profili disciplinari speciali
                </p>
              </div>
            </div>

            {/* Quick Player Switcher Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-[10px] font-bold uppercase text-slate-500 mr-1 hidden sm:inline">
                Seleziona:
              </span>
              {flaggedPlayers.map((p) => {
                const isSelected = p.id === activeSpotlightPlayer.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayerId(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      isSelected
                        ? 'bg-[#CCFF00] text-black shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                        : 'bg-[#141722] text-slate-400 hover:text-white hover:bg-[#1B202D]'
                    }`}
                  >
                    {p.lastName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main 3-Column Player Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Player Profile & Rating (4 cols) */}
            <div className="lg:col-span-4 bg-[#12151E] border border-[#212638] rounded-2xl p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#1A1E2C] border border-[#2B3245] flex items-center justify-center text-white font-black text-lg relative shadow-inner">
                    <span className="text-[#CCFF00]">
                      {activeSpotlightPlayer.kitNumber ? `#${activeSpotlightPlayer.kitNumber}` : '#10'}
                    </span>
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#CCFF00] border-2 border-[#12151E]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {activeSpotlightPlayer.firstName} {activeSpotlightPlayer.lastName}
                    </h3>
                    <p className="text-xs text-slate-400">{activeSpotlightPlayer.teamName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <RoleBadge role={activeSpotlightPlayer.role} />
                      <span className="text-[10px] text-slate-500 font-mono">
                        {activeSpotlightPlayer.age ? `${activeSpotlightPlayer.age} anni` : (activeSpotlightPlayer.birthDate || 'Eccellenza ER')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Big Fluo Yellow Performance Box */}
              <div className="bg-[#0C0E14] border border-[#222736] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Indice Rischio Disciplinare
                  </span>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {activeSpotlightPlayer.yellowCards >= 3
                      ? 'Diffidato / Rischio Elevato'
                      : activeSpotlightPlayer.yellowCards > 0
                      ? 'Attenzione nei contrasti'
                      : 'Regolare / Fair Play'}
                  </p>
                </div>
                <div className="bg-[#CCFF00] text-black font-black text-2xl px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.35)]">
                  {(8.5 - activeSpotlightPlayer.yellowCards * 0.4).toFixed(1)}
                </div>
              </div>

              {/* Disciplinary Counters */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-[#151924] border border-[#232838] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Cartellini Gialli</p>
                    <p className="text-lg font-black text-[#CCFF00]">{activeSpotlightPlayer.yellowCards}</p>
                  </div>
                  <div className="w-4 h-6 rounded-sm bg-[#CCFF00] shadow-[0_0_8px_rgba(204,255,0,0.4)]" />
                </div>
                <div className="p-3 rounded-xl bg-[#151924] border border-[#232838] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Espulsioni</p>
                    <p className="text-lg font-black text-[#FF334B]">{activeSpotlightPlayer.redCards}</p>
                  </div>
                  <div className="w-4 h-6 rounded-sm bg-[#FF334B] shadow-[0_0_8px_rgba(255,51,75,0.4)]" />
                </div>
              </div>
            </div>

            {/* Center: Mini Tactical Pitch Diagram (4 cols) */}
            <div className="lg:col-span-4 bg-[#12151E] border border-[#212638] rounded-2xl p-5 flex flex-col items-center justify-between h-full">
              <div className="w-full flex items-center justify-between mb-3 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#CCFF00]" />
                  Zona Tattica Principale
                </span>
                <span className="text-[10px] font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                  Ruolo: {activeSpotlightPlayer.role}
                </span>
              </div>

              {/* Styled Football Pitch Graphic */}
              <div className="relative w-full h-52 rounded-xl bg-[#090B10] border-2 border-[#1E2333] overflow-hidden">
                {/* Touchlines and penalty boxes */}
                <div className="absolute inset-2 border border-[#222838] rounded-lg pointer-events-none" />
                {/* Halfway line */}
                <div className="absolute top-1/2 left-2 right-2 h-px bg-[#222838] pointer-events-none" />
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-[#222838] pointer-events-none" />
                {/* Top penalty area */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-12 border-b border-x border-[#222838] rounded-b pointer-events-none" />
                {/* Bottom penalty area */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-12 border-t border-x border-[#222838] rounded-t pointer-events-none" />

                {/* Pulsing Fluo Yellow Player Marker */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
                  style={getPitchMarkerStyle(activeSpotlightPlayer.role)}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-[#CCFF00] opacity-40" />
                    <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-[#CCFF00] text-black font-black text-[10px] shadow-[0_0_15px_rgba(204,255,0,0.6)]">
                      {activeSpotlightPlayer.kitNumber || activeSpotlightPlayer.role.substring(0, 1)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center mt-3">
                Posizionamento dinamico stimato per arbitri & assistenti di linea
              </p>
            </div>

            {/* Right: Detailed Metric Meters & Assigned Tags (4 cols) */}
            <div className="lg:col-span-4 bg-[#12151E] border border-[#212638] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Metriche & Comportamento</span>
                <Link
                  href={`/giocatori?q=${encodeURIComponent(activeSpotlightPlayer.lastName)}`}
                  className="text-[#CCFF00] hover:underline font-bold text-xs flex items-center gap-1"
                >
                  Vedi scheda <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Meters */}
              <div className="space-y-3">
                {/* Contrasti & Duelli */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold mb-1">
                    <span className="text-slate-400">Intensità Contrasti</span>
                    <span className="text-[#CCFF00] font-mono">82%</span>
                  </div>
                  <div className="h-2 w-full bg-[#1A1F2C] rounded-full overflow-hidden">
                    <div className="h-full bg-[#CCFF00] rounded-full shadow-[0_0_8px_rgba(204,255,0,0.5)] w-[82%]" />
                  </div>
                </div>

                {/* Minuti Giocati */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold mb-1">
                    <span className="text-slate-400">Affidabilità & Presenze</span>
                    <span className="text-[#CCFF00] font-mono">91%</span>
                  </div>
                  <div className="h-2 w-full bg-[#1A1F2C] rounded-full overflow-hidden">
                    <div className="h-full bg-[#CCFF00] rounded-full shadow-[0_0_8px_rgba(204,255,0,0.5)] w-[91%]" />
                  </div>
                </div>

                {/* Disciplina Arbitrale */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold mb-1">
                    <span className="text-slate-400">Tolleranza & Fair Play</span>
                    <span className="text-slate-300 font-mono">
                      {activeSpotlightPlayer.yellowCards >= 3 ? '45%' : '78%'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#1A1F2C] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        activeSpotlightPlayer.yellowCards >= 3 ? 'bg-[#FF334B] w-[45%]' : 'bg-[#CCFF00] w-[78%]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Tags assegnati */}
              <div className="pt-2 border-t border-[#1C2130]">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Tag Arbitro Assegnati</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeSpotlightPlayer.customTags.length > 0 ? (
                    activeSpotlightPlayer.customTags.map((tag, i) => (
                      <TagBadge key={i} tag={tag} size="sm" />
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Nessun tag speciale assegnato</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. PRIMARY LEAGUE KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Squadre</span>
            <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] group-hover:scale-110 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{stats.totalTeams}</div>
          <p className="text-[11px] text-slate-400 mt-1">17 Girone A + 18 Girone B</p>
        </div>

        <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Calciatori</span>
            <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{stats.totalPlayers}</div>
          <p className="text-[11px] text-slate-400 mt-1">Rose complete sincronizzate</p>
        </div>

        <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Gare Campionato</span>
            <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{stats.totalMatches}</div>
          <p className="text-[11px] text-slate-400 mt-1">Calendario gare 2024/2025</p>
        </div>

        <div className="bg-[#0D0F16] border border-[#1F2433] hover:border-[#CCFF00]/40 rounded-2xl p-5 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Note & Video</span>
            <div className="w-8 h-8 rounded-lg bg-[#141824] border border-[#242A3C] flex items-center justify-center text-[#CCFF00] group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{stats.totalNotes + stats.totalVideos}</div>
          <p className="text-[11px] text-slate-400 mt-1">{stats.totalNotes} note + {stats.totalVideos} clip didattiche</p>
        </div>
      </div>

      {/* 4. UPCOMING MATCHES & AI BRIEFING LAUNCHER */}
      <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#CCFF00]" />
            <h2 className="text-base font-black text-white uppercase tracking-wide">
              Calendario Prossimi Incontri & Briefing
            </h2>
          </div>
          <Link
            href="/partite"
            className="text-xs font-bold text-[#CCFF00] hover:underline flex items-center gap-1"
          >
            Tutte le partite <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcomingMatches.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-xl bg-[#12151E] border border-[#212638] hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-[#CCFF00] text-[11px] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20">
                  Girone {m.girone}
                </span>
                <span className="text-[11px] font-mono">{m.dateText}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">{m.homeTeamName}</p>
                </div>
                <div className="px-3 py-1 bg-[#090A0E] border border-[#222838] rounded-lg text-xs font-mono font-black text-white">
                  {m.played && m.homeScore !== undefined ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
                </div>
                <div className="flex-1 text-right">
                  <p className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">{m.awayTeamName}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1C2130] flex items-center justify-between">
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  🏟️ {m.matchField || 'Campo da designare'}
                </span>
                <button
                  onClick={() => handleGenerateBriefing(m)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 text-[#CCFF00] border border-[#CCFF00]/30 text-xs font-bold transition-all shadow-sm"
                >
                  <Sparkles className="w-3 h-3 text-[#CCFF00]" />
                  Briefing AI
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. TWO-COLUMN: SQUADRE RECENTI & CALCIATORI MONITORATI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Squadre Recenti */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#CCFF00]" />
              <h3 className="font-black text-white text-base">Ultime Squadre Consultate</h3>
            </div>
            <Link href="/squadre" className="text-xs font-bold text-slate-400 hover:text-white">
              Vedi tutte ({stats.totalTeams})
            </Link>
          </div>

          <div className="space-y-3">
            {recentTeams.map((team) => (
              <div
                key={team.id}
                className="p-3.5 rounded-xl bg-[#12151E] border border-[#212638] hover:border-[#CCFF00]/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">
                      {team.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#181C28] text-slate-300 font-bold border border-[#282E40]">
                      Girone {team.girone}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-semibold">Tecnica:</span>
                      <RatingStars value={team.technicalLevel} type="technical" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-semibold">Aggressività:</span>
                      <RatingStars value={team.aggressionLevel} type="aggression" />
                    </div>
                  </div>
                </div>

                <Link
                  href="/squadre"
                  className="p-2 text-slate-400 hover:text-[#CCFF00] hover:bg-[#181C28] rounded-lg transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Calciatori Monitorati */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#CCFF00]" />
              <h3 className="font-black text-white text-base">Radar Calciatori Monitorati</h3>
            </div>
            <Link href="/giocatori" className="text-xs font-bold text-slate-400 hover:text-white">
              Archivio completo ({stats.totalPlayers})
            </Link>
          </div>

          <div className="space-y-3">
            {flaggedPlayers.slice(0, 4).map((player) => (
              <div
                key={player.id}
                className="p-3.5 rounded-xl bg-[#12151E] border border-[#212638] hover:border-[#CCFF00]/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-[#CCFF00] transition-colors">
                      {player.firstName} {player.lastName}
                    </span>
                    <RoleBadge role={player.role} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{player.teamName}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {player.customTags.map((tag, idx) => (
                      <TagBadge key={idx} tag={tag} size="sm" />
                    ))}
                    {player.yellowCards > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 rounded">
                        {player.yellowCards} Ammonizioni
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  href={`/giocatori?q=${encodeURIComponent(player.lastName)}`}
                  className="p-2 text-slate-400 hover:text-[#CCFF00] hover:bg-[#181C28] rounded-lg transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. NOTE & VIDEO CLIPS RECENTI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Note recenti */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#CCFF00]" />
              <h3 className="font-black text-white text-base">Note Recenti</h3>
            </div>
            <Link href="/note-video" className="text-xs font-bold text-slate-400 hover:text-white">
              Tutte le note
            </Link>
          </div>

          <div className="space-y-3">
            {recentNotes.map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl bg-[#12151E] border border-[#212638] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{n.targetName}</span>
                    <span className="text-[10px] text-[#CCFF00] uppercase font-mono font-bold bg-[#CCFF00]/10 px-1.5 py-0.5 rounded border border-[#CCFF00]/20">
                      {n.targetType}
                    </span>
                  </div>
                  {n.isPublic === false ? (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Lock className="w-2.5 h-2.5 text-amber-400" /> Privata
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
                      <Globe className="w-2.5 h-2.5 text-[#CCFF00]" /> Pubblica
                    </span>
                  )}
                </div>

                {/* Author Info */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-bold text-white">{n.authorName || n.authorId}</span>
                  {n.authorRole && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                      {n.authorRole}
                    </span>
                  )}
                  {n.authorSection && <span className="text-slate-500">• {n.authorSection}</span>}
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{n.content}</p>
                <div className="text-[10px] text-slate-500 pt-0.5 font-mono">
                  {new Date(n.createdAt).toLocaleDateString('it-IT')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Video recenti */}
        <div className="bg-[#0D0F16] border border-[#1F2433] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-[#CCFF00]" />
              <h3 className="font-black text-white text-base">Video Recenti</h3>
            </div>
            <Link href="/note-video" className="text-xs font-bold text-slate-400 hover:text-white">
              Tutti i video
            </Link>
          </div>

          <div className="space-y-3">
            {recentVideos.map((v) => (
              <div key={v.id} className="p-3.5 rounded-xl bg-[#12151E] border border-[#212638] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{v.title}</span>
                    {v.timestampMark && (
                      <span className="text-[10px] font-mono bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 px-1.5 py-0.5 rounded">
                        {v.timestampMark}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{v.targetName}</p>
                  {v.description && (
                    <p className="text-xs text-slate-300 line-clamp-1 mt-1">{v.description}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (v.externalUrl) {
                      setActiveViewerMedia({
                        url: v.externalUrl,
                        title: v.title,
                        subtitle: v.targetName,
                        description: v.description,
                        timestampMark: v.timestampMark,
                        mediaType: v.mediaType,
                      });
                      setIsViewerOpen(true);
                    }
                  }}
                  className="p-2.5 bg-[#CCFF00] hover:bg-[#d8ff33] text-black rounded-xl transition-all shadow-[0_0_12px_rgba(204,255,0,0.3)] flex-shrink-0"
                  title="Riproduci in App"
                >
                  <Play className="w-4 h-4 fill-black text-black" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* In-App Media Viewer Modal */}
      <MediaViewerModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setActiveViewerMedia(null);
        }}
        media={activeViewerMedia}
      />

      {/* Gemini AI Briefing Modal */}
      <AiBriefingModal
        isOpen={isAiBriefingOpen}
        onClose={() => setIsAiBriefingOpen(false)}
        briefing={currentBriefing}
        loading={isAiLoading}
      />
    </div>
  );
}
