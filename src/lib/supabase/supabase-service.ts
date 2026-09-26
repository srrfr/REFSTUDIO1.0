import { getSupabaseClient, isSupabaseConfigured } from './client';
import { Team, Player, Match, StandingRow, Note, VideoClip, UserAccount } from '@/types/refstudio';
import { isVeoUrl } from '@/lib/services/veo-service';

export class SupabaseService {
  /**
   * Converte una riga Supabase nel modello TypeScript Team
   */
  static mapTeamFromRow(row: any): Team {
    return {
      id: row.id,
      championshipId: row.championship_id || 'eccellenza-er',
      name: row.name,
      normalizedName: row.normalized_name,
      girone: row.girone,
      city: row.city,
      logoUrl: row.logo_url,
      stadium: row.stadium,
      stadiumAddress: row.stadium_address,
      pitchSurface: row.pitch_surface,
      tuttocampoUrl: row.tuttocampo_url,
      technicalLevel: row.technical_level ?? 3,
      aggressionLevel: row.aggression_level ?? 3,
      benchAttitude: row.bench_attitude,
      coachAttitude: row.coach_attitude,
      coachName: row.coach_name,
      coachPhotoUrl: row.coach_photo_url || row.stats?.coachPhotoUrl || '',
      managerName: row.manager_name,
      refereeNotes: row.referee_notes,
      stats: row.stats || undefined,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte una riga Supabase nel modello TypeScript Player
   */
  static mapPlayerFromRow(row: any): Player {
    let photoUrl = row.photo_url || '';
    let refNotes = row.referee_notes || '';
    if (!photoUrl && refNotes.includes('[PHOTO_URL:')) {
      const pMatch = refNotes.match(/\[PHOTO_URL:\s*([^\]]+)\]/);
      if (pMatch) {
        photoUrl = pMatch[1].trim();
        refNotes = refNotes.replace(/\[PHOTO_URL:\s*[^\]]+\]\s*/, '').trim();
      }
    }

    return {
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      championshipId: row.championship_id || 'eccellenza-er',
      girone: row.girone,
      firstName: row.first_name,
      lastName: row.last_name,
      photoUrl: photoUrl || undefined,
      birthDate: row.birth_date,
      age: row.age,
      role: row.role || 'CEN',
      kitNumber: row.kit_number,
      heightCm: row.height_cm,
      preferredFoot: row.preferred_foot,
      goals: row.goals ?? 0,
      appearances: row.appearances ?? 0,
      yellowCards: row.yellow_cards ?? 0,
      redCards: row.red_cards ?? 0,
      disciplinaryStatus: row.disciplinary_status || 'REGOLARE',
      customTags: row.custom_tags || [],
      refereeNotes: refNotes,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte una riga Supabase nel modello TypeScript Match
   */
  static mapMatchFromRow(row: any): Match {
    return {
      id: row.id,
      championshipId: row.championship_id || 'eccellenza-er',
      girone: row.girone,
      matchDay: row.match_day,
      dateText: row.date_text,
      matchDate: row.match_date,
      played: Boolean(row.played),
      homeTeamId: row.home_team_id,
      homeTeamName: row.home_team_name,
      awayTeamId: row.away_team_id,
      awayTeamName: row.away_team_name,
      homeScore: row.home_score,
      awayScore: row.away_score,
      refereeName: row.referee_name,
      matchField: row.match_field,
      observations: row.observations,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte una riga Supabase nel modello TypeScript StandingRow
   */
  static mapStandingFromRow(row: any): StandingRow {
    return {
      position: row.position,
      teamName: row.team_name,
      teamId: row.team_id,
      points: row.points ?? 0,
      played: row.played ?? 0,
      won: row.won ?? 0,
      drawn: row.drawn ?? 0,
      lost: row.lost ?? 0,
      goalsFor: row.goals_for ?? 0,
      goalsAgainst: row.goals_against ?? 0,
      goalDifference: row.goal_difference ?? 0,
    };
  }

  /**
   * Converte una riga Supabase nel modello TypeScript Note
   */
  static mapNoteFromRow(row: any): Note {
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorRole: row.author_role || 'AE',
      authorAvatar: row.author_avatar || '',
      authorSection: row.author_section || '',
      isPublic: row.is_public ?? true,
      targetType: row.target_type,
      targetId: row.target_id,
      targetName: row.target_name,
      content: row.content,
      priority: row.priority || 'NORMAL',
      attachments: row.attachments || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte una riga Supabase nel modello TypeScript UserAccount
   */
  static mapProfileFromRow(row: any): UserAccount {
    return {
      username: row.username,
      password: row.password,
      displayName: row.display_name,
      email: row.email,
      role: row.role || 'arbitro',
      refereeRole: row.referee_role || 'AE',
      sectionAia: row.section_aia || 'Bologna',
      categoryAia: row.category_aia || 'Eccellenza',
      avatarUrl: row.avatar_url,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte una riga Supabase nel modello TypeScript VideoClip
   */
  static mapVideoFromRow(row: any): VideoClip {
    const isVeo = row.video_source === 'VEO' || isVeoUrl(row.external_url);
    return {
      id: row.id,
      authorId: row.author_id,
      targetType: row.target_type,
      targetId: row.target_id,
      targetName: row.target_name,
      videoSource: isVeo ? 'VEO' : (row.video_source || 'YOUTUBE'),
      externalUrl: row.external_url,
      storagePath: row.storage_path,
      title: row.title,
      description: row.description,
      timestampMark: row.timestamp_mark,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at,
    };
  }

  // ==========================================================================
  // METODI DI RECUPERO DATI CLOUD (SELECT)
  // ==========================================================================

  static async fetchAllTeams(): Promise<Team[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('teams').select('*').order('name');
    if (error) {
      console.error('Supabase fetch teams error:', error);
      return [];
    }
    return (data || []).map(this.mapTeamFromRow);
  }

  static async fetchAllPlayers(): Promise<Player[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('players').select('*');
    if (error) {
      console.error('Supabase fetch players error:', error);
      return [];
    }
    return (data || []).map(this.mapPlayerFromRow);
  }

  static async fetchAllMatches(): Promise<Match[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('matches').select('*').order('match_day');
    if (error) {
      console.error('Supabase fetch matches error:', error);
      return [];
    }
    const rawMatches = (data || []).map(this.mapMatchFromRow);
    // Deduplicazione difensiva per giornata e squadre (rimuove doppioni da vecchi ID)
    const uniqueMap = new Map<string, Match>();
    rawMatches.forEach((m) => {
      const key = `${m.girone}-${m.matchDay}-${m.homeTeamName.toLowerCase().trim()}-vs-${m.awayTeamName.toLowerCase().trim()}`;
      if (!uniqueMap.has(key) || (m.played && !uniqueMap.get(key)!.played)) {
        uniqueMap.set(key, m);
      }
    });
    return Array.from(uniqueMap.values());
  }

  static async fetchStandings(): Promise<{ standingsA: StandingRow[]; standingsB: StandingRow[] }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { standingsA: [], standingsB: [] };
    const { data, error } = await supabase.from('standings').select('*').order('position');
    if (error) {
      console.error('Supabase fetch standings error:', error);
      return { standingsA: [], standingsB: [] };
    }
    const rows = data || [];

    // Deduplicazione difensiva: 1 sola riga per squadra (quella con più giocate o punti in caso di orfani storici)
    const dedupeStandings = (list: any[]) => {
      const map = new Map<string, any>();
      const sorted = [...list].sort((a, b) => (b.played || 0) - (a.played || 0) || (b.points || 0) - (a.points || 0));
      sorted.forEach((r) => {
        const key = (r.team_name || r.team_id || '').toLowerCase().trim();
        if (key && !map.has(key)) {
          map.set(key, r);
        }
      });
      return Array.from(map.values())
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map(this.mapStandingFromRow);
    };

    return {
      standingsA: dedupeStandings(rows.filter((r) => r.girone === 'A')),
      standingsB: dedupeStandings(rows.filter((r) => r.girone === 'B')),
    };
  }

  static async fetchNotes(): Promise<Note[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase fetch notes error:', error);
      return [];
    }
    return (data || []).map(this.mapNoteFromRow);
  }

  static async fetchVideos(): Promise<VideoClip[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase fetch videos error:', error);
      return [];
    }
    return (data || []).map(this.mapVideoFromRow);
  }

  // ==========================================================================
  // METODI DI SCRITTURA & AGGIORNAMENTO (UPSERT, INSERT, DELETE)
  // ==========================================================================

  static async upsertTeam(team: Team): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    await supabase.from('teams').upsert({
      id: team.id,
      championship_id: team.championshipId || 'eccellenza-er',
      name: team.name,
      normalized_name: team.normalizedName,
      girone: team.girone,
      city: team.city,
      logo_url: team.logoUrl || null,
      stadium: team.stadium,
      stadium_address: team.stadiumAddress,
      pitch_surface: team.pitchSurface,
      tuttocampo_url: team.tuttocampoUrl,
      technical_level: team.technicalLevel,
      aggression_level: team.aggressionLevel,
      bench_attitude: team.benchAttitude,
      coach_attitude: team.coachAttitude,
      coach_name: team.coachName,
      manager_name: team.managerName,
      referee_notes: team.refereeNotes,
      stats: {
        ...(team.stats || {}),
        coachPhotoUrl: team.coachPhotoUrl || undefined,
      },
      updated_at: new Date().toISOString(),
    });
  }

  static async upsertPlayer(player: Player): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let combinedNotes = player.refereeNotes || '';
    if (player.photoUrl) {
      combinedNotes = `[PHOTO_URL: ${player.photoUrl.trim()}]\n${combinedNotes}`.trim();
    }

    await supabase.from('players').upsert({
      id: player.id,
      team_id: player.teamId,
      team_name: player.teamName,
      championship_id: player.championshipId || 'eccellenza-er',
      girone: player.girone,
      first_name: player.firstName,
      last_name: player.lastName,
      birth_date: player.birthDate,
      age: player.age,
      role: player.role,
      kit_number: player.kitNumber,
      height_cm: player.heightCm,
      preferred_foot: player.preferredFoot,
      goals: player.goals,
      appearances: player.appearances,
      yellow_cards: player.yellowCards,
      red_cards: player.redCards,
      disciplinary_status: player.disciplinaryStatus,
      custom_tags: player.customTags,
      referee_notes: combinedNotes || null,
      updated_at: new Date().toISOString(),
    });
  }

  static async upsertMatch(match: Match): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    await supabase.from('matches').upsert({
      id: match.id,
      championship_id: match.championshipId || 'eccellenza-er',
      girone: match.girone,
      match_day: match.matchDay,
      date_text: match.dateText,
      match_date: match.matchDate,
      played: match.played,
      home_team_id: match.homeTeamId,
      home_team_name: match.homeTeamName,
      away_team_id: match.awayTeamId,
      away_team_name: match.awayTeamName,
      home_score: match.homeScore,
      away_score: match.awayScore,
      referee_name: match.refereeName,
      match_field: match.matchField,
      observations: match.observations,
      updated_at: new Date().toISOString(),
    });
  }

  static async insertNote(note: Note): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    await supabase.from('notes').insert({
      id: note.id,
      author_id: note.authorId || 'samueleromini',
      author_name: note.authorName || 'Arbitro',
      author_role: note.authorRole || 'AE',
      author_avatar: note.authorAvatar || '',
      author_section: note.authorSection || '',
      is_public: note.isPublic ?? true,
      target_type: note.targetType,
      target_id: note.targetId,
      target_name: note.targetName,
      content: note.content,
      priority: note.priority || 'NORMAL',
      attachments: note.attachments || [],
      created_at: note.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  static async updateNote(noteId: string, updates: Partial<Note>): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.targetName !== undefined) payload.target_name = updates.targetName;
    if (updates.targetType !== undefined) payload.target_type = updates.targetType;
    if (updates.attachments !== undefined) payload.attachments = updates.attachments;
    if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
    if (updates.authorRole !== undefined) payload.author_role = updates.authorRole;
    if (updates.authorAvatar !== undefined) payload.author_avatar = updates.authorAvatar;
    if (updates.authorSection !== undefined) payload.author_section = updates.authorSection;

    await supabase.from('notes').update(payload).eq('id', noteId);
  }

  static async deleteNote(noteId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from('notes').delete().eq('id', noteId);
  }

  static async upsertProfile(profile: UserAccount): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    await supabase.from('profiles').upsert({
      username: profile.username,
      password: profile.password || '',
      display_name: profile.displayName,
      email: profile.email || '',
      role: profile.role || 'arbitro',
      referee_role: profile.refereeRole || 'AE',
      section_aia: profile.sectionAia || '',
      category_aia: profile.categoryAia || '',
      avatar_url: profile.avatarUrl || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'username' });
  }

  static async fetchProfiles(): Promise<UserAccount[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase.from('profiles').select('*');
    if (error || !data) {
      console.warn('Supabase fetch profiles warning:', error?.message);
      return [];
    }
    return data.map((r: any) => this.mapProfileFromRow(r));
  }

  static async insertVideo(video: VideoClip): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const isVeo = video.videoSource === 'VEO' || isVeoUrl(video.externalUrl);
    const payload = {
      id: video.id,
      author_id: video.authorId || 'ref-1',
      target_type: video.targetType,
      target_id: video.targetId,
      target_name: video.targetName,
      video_source: isVeo ? 'LOCAL' : video.videoSource,
      external_url: video.externalUrl,
      storage_path: video.storagePath,
      title: video.title,
      description: video.description,
      timestamp_mark: video.timestampMark,
      created_at: video.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('videos').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Errore upsert Supabase video:', error);
    }
  }

  static async deleteVideo(videoId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from('videos').delete().eq('id', videoId);
  }

  // ==========================================================================
  // SYNC COMPLETO IN BATCH (SEED / MIGRAZIONE)
  // ==========================================================================

  static async migrateFullDataset(data: {
    teams: Team[];
    players: Player[];
    matches: Match[];
    standingsA: StandingRow[];
    standingsB: StandingRow[];
    notes: Note[];
    videos: VideoClip[];
  }): Promise<{ success: boolean; summary: any; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Credenziali Supabase non configurate', summary: null };
    }

    try {
      // 1. Teams (Deduplicazione garantita per ID)
      const uniqueTeamsMap = new Map<string, Team>();
      data.teams.forEach((t) => uniqueTeamsMap.set(t.id, t));
      const teamsPayload = Array.from(uniqueTeamsMap.values()).map((t) => ({
        id: t.id,
        championship_id: t.championshipId || 'eccellenza-er',
        name: t.name,
        normalized_name: t.normalizedName,
        girone: t.girone,
        city: t.city,
        logo_url: t.logoUrl,
        stadium: t.stadium,
        stadium_address: t.stadiumAddress,
        pitch_surface: t.pitchSurface,
        tuttocampo_url: t.tuttocampoUrl,
        technical_level: t.technicalLevel,
        aggression_level: t.aggressionLevel,
        bench_attitude: t.benchAttitude,
        coach_attitude: t.coachAttitude,
        coach_name: t.coachName,
        manager_name: t.managerName,
        referee_notes: t.refereeNotes,
        stats: t.stats || {},
      }));
      const { error: tErr } = await supabase.from('teams').upsert(teamsPayload, { onConflict: 'id' });
      if (tErr) throw new Error(`Errore Teams: ${tErr.message}`);

      // 2. Players (Deduplicazione rigorosa per ID per evitare errore PostgreSQL ON CONFLICT)
      const uniquePlayersMap = new Map<string, Player>();
      data.players.forEach((p) => uniquePlayersMap.set(p.id, p));
      const playerPayload = Array.from(uniquePlayersMap.values()).map((p) => {
        let combinedNotes = p.refereeNotes || '';
        if (p.photoUrl) {
          combinedNotes = `[PHOTO_URL: ${p.photoUrl.trim()}]\n${combinedNotes}`.trim();
        }
        return {
          id: p.id,
          team_id: p.teamId,
          team_name: p.teamName,
          championship_id: p.championshipId || 'eccellenza-er',
          girone: p.girone,
          first_name: p.firstName,
          last_name: p.lastName,
          birth_date: p.birthDate,
          age: p.age,
          role: p.role,
          kit_number: p.kitNumber,
          height_cm: p.heightCm,
          preferred_foot: p.preferredFoot,
          goals: p.goals || 0,
          appearances: p.appearances || 0,
          yellow_cards: p.yellowCards || 0,
          red_cards: p.redCards || 0,
          disciplinary_status: p.disciplinaryStatus || 'REGOLARE',
          custom_tags: p.customTags || [],
          referee_notes: combinedNotes || null,
        };
      });

      for (let i = 0; i < playerPayload.length; i += 200) {
        const chunk = playerPayload.slice(i, i + 200);
        const { error: pErr } = await supabase.from('players').upsert(chunk, { onConflict: 'id' });
        if (pErr) throw new Error(`Errore Players (chunk ${i}): ${pErr.message}`);
      }

      // 3. Matches (Deduplicazione per ID)
      const uniqueMatchesMap = new Map<string, Match>();
      data.matches.forEach((m) => uniqueMatchesMap.set(m.id, m));
      const matchesPayload = Array.from(uniqueMatchesMap.values()).map((m) => ({
        id: m.id,
        championship_id: m.championshipId || 'eccellenza-er',
        girone: m.girone,
        match_day: m.matchDay,
        date_text: m.dateText,
        match_date: m.matchDate,
        played: m.played,
        home_team_id: m.homeTeamId,
        home_team_name: m.homeTeamName,
        away_team_id: m.awayTeamId,
        away_team_name: m.awayTeamName,
        home_score: m.homeScore,
        away_score: m.awayScore,
        referee_name: m.refereeName,
        match_field: m.matchField,
        observations: m.observations,
      }));

      // Rimuovi eventuali partite obsolete rimaste su Supabase con ID non validi
      const validMatchIds = new Set(matchesPayload.map((m) => m.id));
      const { data: existingMatches } = await supabase.from('matches').select('id');
      if (existingMatches && existingMatches.length > 0) {
        const obsoleteIds = existingMatches.map((m) => m.id).filter((id) => !validMatchIds.has(id));
        if (obsoleteIds.length > 0) {
          for (let i = 0; i < obsoleteIds.length; i += 100) {
            await supabase.from('matches').delete().in('id', obsoleteIds.slice(i, i + 100));
          }
        }
      }

      for (let i = 0; i < matchesPayload.length; i += 200) {
        const chunk = matchesPayload.slice(i, i + 200);
        const { error: mErr } = await supabase.from('matches').upsert(chunk, { onConflict: 'id' });
        if (mErr) throw new Error(`Errore Matches (chunk ${i}): ${mErr.message}`);
      }

      // 4. Standings
      // Pulisci i record precedenti delle classifiche per evitare duplicati da posizioni storiche
      await supabase.from('standings').delete().in('girone', ['A', 'B']);

      const standingsPayload = [
        ...data.standingsA.map((s) => ({
          id: `standing-A-${s.teamId || this.slugify(s.teamName)}`,
          girone: 'A',
          position: s.position,
          team_name: s.teamName,
          team_id: s.teamId,
          points: s.points,
          played: s.played,
          won: s.won,
          drawn: s.drawn,
          lost: s.lost,
          goals_for: s.goalsFor,
          goals_against: s.goalsAgainst,
          goal_difference: s.goalDifference,
        })),
        ...data.standingsB.map((s) => ({
          id: `standing-B-${s.teamId || this.slugify(s.teamName)}`,
          girone: 'B',
          position: s.position,
          team_name: s.teamName,
          team_id: s.teamId,
          points: s.points,
          played: s.played,
          won: s.won,
          drawn: s.drawn,
          lost: s.lost,
          goals_for: s.goalsFor,
          goals_against: s.goalsAgainst,
          goal_difference: s.goalDifference,
        })),
      ];
      if (standingsPayload.length > 0) {
        const { error: sErr } = await supabase.from('standings').upsert(standingsPayload, { onConflict: 'id' });
        if (sErr) throw new Error(`Errore Standings: ${sErr.message}`);
      }

      // 5. Notes (Deduplicazione per ID)
      if (data.notes && data.notes.length > 0) {
        const uniqueNotesMap = new Map<string, Note>();
        data.notes.forEach((n) => uniqueNotesMap.set(n.id, n));
        const notesPayload = Array.from(uniqueNotesMap.values()).map((n) => ({
          id: n.id,
          author_id: n.authorId || 'samueleromini',
          author_name: n.authorName || 'Arbitro',
          author_role: n.authorRole || 'AE',
          author_avatar: n.authorAvatar || '',
          author_section: n.authorSection || '',
          is_public: n.isPublic ?? true,
          target_type: n.targetType,
          target_id: n.targetId,
          target_name: n.targetName,
          content: n.content,
          priority: n.priority || 'NORMAL',
          attachments: n.attachments || [],
        }));
        const { error: nErr } = await supabase.from('notes').upsert(notesPayload, { onConflict: 'id' });
        if (nErr) throw new Error(`Errore Notes: ${nErr.message}`);
      }

      // 6. Videos (Deduplicazione per ID)
      if (data.videos && data.videos.length > 0) {
        const uniqueVideosMap = new Map<string, VideoClip>();
        data.videos.forEach((v) => uniqueVideosMap.set(v.id, v));
        const videosPayload = Array.from(uniqueVideosMap.values()).map((v) => ({
          id: v.id,
          author_id: v.authorId || 'ref-1',
          target_type: v.targetType,
          target_id: v.targetId,
          target_name: v.targetName,
          video_source: (v.videoSource === 'VEO' || isVeoUrl(v.externalUrl)) ? 'LOCAL' : (v.videoSource || 'YOUTUBE'),
          external_url: v.externalUrl,
          storage_path: v.storagePath,
          title: v.title,
          description: v.description,
          timestamp_mark: v.timestampMark,
        }));
        const { error: vErr } = await supabase.from('videos').upsert(videosPayload, { onConflict: 'id' });
        if (vErr) throw new Error(`Errore Videos: ${vErr.message}`);
      }

      return {
        success: true,
        summary: {
          teams: data.teams.length,
          players: data.players.length,
          matches: data.matches.length,
          standings: standingsPayload.length,
          notes: data.notes.length,
          videos: data.videos.length,
        },
      };
    } catch (err: any) {
      console.error('Migrazione a Supabase fallita:', err);
      return { success: false, error: err.message, summary: null };
    }
  }

  // ==========================================================================
  // REALTIME SUBSCRIPTIONS
  // ==========================================================================

  static subscribeToChanges(onUpdate: (payload: { table: string; eventType: string; newRecord: any }) => void) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const channel = supabase
      .channel('refstudio-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        onUpdate({
          table: payload.table,
          eventType: payload.eventType,
          newRecord: payload.new,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  private static slugify(str: string): string {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
