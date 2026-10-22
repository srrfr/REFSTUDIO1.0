import { Player, Match, PlayerDisciplinaryDetail, DisciplinaryStatus, TeamStaffSanction } from '@/types/refstudio';

/**
 * Mappatura Comunicato Ufficiale FIGC CRER -> Giornata di Campionato Eccellenza
 * in cui è stata disputata la gara oggetto delle delibere del Giudice Sportivo.
 */
export const CU_TO_MATCHDAY: Record<number, number> = {
  24: 0, // Coppa Italia pre-campionato (30/08/2026)
  26: 1, // Gare del 06/09/2026 (Giornata 1)
  27: 1, // Gare del 09/09/2026 (Recuperi/Infrasettimanale G1)
  28: 2, // Gare del 13/09/2026 (Giornata 2)
  30: 3, // Gare del 20/09/2026 (Giornata 3)
  34: 4, // Gare del 27/09/2026 (Giornata 4)
  37: 4, // Coppa Italia (30/09/2026)
  38: 5, // Gare del 04/10/2026 (Giornata 5)
  43: 7, // Gare del 11/10/2026 (Giornata 7)
  46: 7, // Coppa Italia (14/10/2026)
  47: 8, // Gare del 18/10/2026 (Giornata 8)
};

export function getCuNumber(cuStr: string | undefined): number {
  const m = String(cuStr || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function parseSqualificaGare(sanzStr: string | undefined): number {
  const s = String(sanzStr || '').toUpperCase();
  if (s.includes('TRE GARE')) return 3;
  if (s.includes('DUE GARE')) return 2;
  if (s.includes('UNA GARA')) return 1;
  const m = s.match(/(\d+)\s*GARE/);
  if (m) return parseInt(m[1], 10);
  return 1;
}

function normString(s: string | undefined): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function teamTokens(s: string | undefined): string[] {
  const cleaned = String(s || '')
    .toLowerCase()
    .replace(/\b(ssdarl|asd|srl|ssd|football|club|calcio|a\.s\.d\.|1909|1913|2009|2015)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  return cleaned.split(/\s+/).filter((t) => t.length >= 3);
}

export interface DisciplinaryEvaluation {
  status: DisciplinaryStatus;
  details?: PlayerDisciplinaryDetail;
  pastSanctions?: PlayerDisciplinaryDetail[];
  notes: string[];
}

export class DisciplinaryService {
  /**
   * Verifica se una diffida è stata superata da una successiva squalifica per recidività in ammonizione
   */
  static isDiffidaSuperata(cuDiffida: number, playerSanctions: any[]): boolean {
    return playerSanctions.some((sub) => {
      const cuSub = getCuNumber(sub.comunicato);
      if (cuSub <= cuDiffida) return false;
      const sanzUp = String(sub.sanzione || '').toUpperCase();
      const motUp = String(sub.motivo || '').toUpperCase();
      return (
        sanzUp.includes('RECIDIVITA') ||
        sanzUp.includes('V INFR') ||
        motUp.includes('RECIDIVITÀ') ||
        motUp.includes('RECIDIVITA')
      );
    });
  }

  /**
   * Calcola se una squalifica è stata scontata sulla base delle partite disputate
   */
  static checkSqualificaStatus(
    sanz: any,
    teamPlayedMaxDay: number
  ): {
    scontata: boolean;
    gareSqualifica: number;
    gareScontate: number;
    gareResidue: number;
  } {
    const cuNum = getCuNumber(sanz.comunicato);
    const matchDayComminata = CU_TO_MATCHDAY[cuNum] ?? (cuNum >= 47 ? 8 : cuNum >= 43 ? 7 : 0);
    const gareDisputateDopo = Math.max(0, teamPlayedMaxDay - matchDayComminata);
    const gareTotali = parseSqualificaGare(sanz.sanzione);
    const gareResidue = Math.max(0, gareTotali - gareDisputateDopo);

    return {
      scontata: gareResidue === 0,
      gareSqualifica: gareTotali,
      gareScontate: gareDisputateDopo,
      gareResidue,
    };
  }

  /**
   * Valuta lo stato disciplinare per un calciatore e la lista di sanzioni a lui associate
   */
  static evaluatePlayer(
    player: Player,
    teamPlayedMaxDay: number,
    sanctions: any[]
  ): DisciplinaryEvaluation {
    if (!sanctions || sanctions.length === 0) {
      return { status: 'REGOLARE', notes: [] };
    }

    const sortedSanctions = [...sanctions].sort(
      (a, b) => getCuNumber(a.comunicato) - getCuNumber(b.comunicato)
    );

    // 1. Analisi DIFFIDE: rimosse se subentrata successiva squalifica per recidività
    let activeDiffida: any = null;
    for (const s of sortedSanctions) {
      if (s.tipo === 'DIFFIDA' && !String(s.competizione || '').toUpperCase().includes('COPPA')) {
        const cuDiffida = getCuNumber(s.comunicato);
        if (!this.isDiffidaSuperata(cuDiffida, sortedSanctions)) {
          activeDiffida = s;
        }
      }
    }

    // 2. Analisi SQUALIFICHE: rimosse se scontate
    let activeSqualifica: {
      sanction: any;
      gareSqualifica: number;
      gareScontate: number;
      gareResidue: number;
    } | null = null;

    const formattedNotes: string[] = [];
    const pastSanctions: PlayerDisciplinaryDetail[] = [];

    for (const s of sortedSanctions) {
      if (s.tipo === 'SQUALIFICA') {
        const res = this.checkSqualificaStatus(s, teamPlayedMaxDay);
        if (!res.scontata) {
          activeSqualifica = {
            sanction: s,
            gareSqualifica: res.gareSqualifica,
            gareScontate: res.gareScontate,
            gareResidue: res.gareResidue,
          };
          let nota = `[Giudice Sportivo ${s.comunicato}]: ${s.sanzione}`;
          if (res.gareScontate > 0) {
            nota += ` (${res.gareResidue} gara residua da scontare)`;
          }
          if (s.motivo) {
            nota += ` - Motivo: ${s.motivo}`;
          }
          formattedNotes.push(nota);
        } else {
          pastSanctions.push({
            tipo: 'SQUALIFICA',
            sanzione: s.sanzione,
            motivo: s.motivo || '',
            comunicato: s.comunicato,
            competizione: s.competizione || 'Campionato Eccellenza',
            urlComunicato: s.url_comunicato || s.urlComunicato || '',
            scontata: true,
            giornateSqualifica: res.gareSqualifica,
            giornateScontate: res.gareScontate,
            giornateResidue: 0,
          });
          let nota = `[Giudice Sportivo ${s.comunicato} - Scontata]: ${s.sanzione}`;
          if (s.motivo) {
            nota += ` - Motivo: ${s.motivo}`;
          }
          formattedNotes.push(nota);
        }
      } else if (s.tipo === 'DIFFIDA') {
        const cuDiff = getCuNumber(s.comunicato);
        const isSuperata = this.isDiffidaSuperata(cuDiff, sortedSanctions);
        if (!isSuperata && activeDiffida === s) {
          let nota = `[Giudice Sportivo ${s.comunicato}]: ${s.sanzione} (Campionato Eccellenza)`;
          if (s.motivo) {
            nota += ` - Motivo: ${s.motivo}`;
          }
          formattedNotes.push(nota);
        } else {
          formattedNotes.push(`[Giudice Sportivo ${s.comunicato} - Superata]: ${s.sanzione}`);
        }
      }
    }

    if (activeSqualifica) {
      const s = activeSqualifica.sanction;
      return {
        status: 'SQUALIFICATO',
        details: {
          tipo: 'SQUALIFICA',
          sanzione: s.sanzione,
          motivo: s.motivo || 'Espulsione dal campo durante la gara',
          comunicato: s.comunicato,
          competizione: s.competizione || 'Campionato Eccellenza',
          urlComunicato: s.url_comunicato || s.urlComunicato || '',
          scontata: false,
          giornateSqualifica: activeSqualifica.gareSqualifica,
          giornateScontate: activeSqualifica.gareScontate,
          giornateResidue: activeSqualifica.gareResidue,
        },
        pastSanctions,
        notes: formattedNotes,
      };
    }

    if (activeDiffida) {
      return {
        status: 'DIFFIDATO',
        details: {
          tipo: 'DIFFIDA',
          sanzione: activeDiffida.sanzione,
          motivo:
            activeDiffida.motivo ||
            'Cumulo di ammonizioni nel Campionato di Eccellenza (squalifica al prossimo giallo)',
          comunicato: activeDiffida.comunicato,
          competizione: 'Campionato Eccellenza',
          urlComunicato: activeDiffida.url_comunicato || activeDiffida.urlComunicato || '',
        },
        pastSanctions,
        notes: formattedNotes,
      };
    }

    return {
      status: 'REGOLARE',
      pastSanctions,
      notes: formattedNotes,
    };
  }

  /**
   * Associa le sanzioni e inibizioni di dirigenti, allenatori e staff (Coppa e Campionato) alla squadra
   */
  static matchStaffSanctionsToTeam(teamName: string, allSanctions: any[]): TeamStaffSanction[] {
    const rawNorm = normString(teamName);
    const rawTokens = teamTokens(teamName);
    const matched: TeamStaffSanction[] = [];

    for (const s of allSanctions || []) {
      const isStaffOrCoach =
        s.tipo === 'STAFF_INIBIZIONE' ||
        /DIRIGENT|ALLENATOR|MASSAGGIATOR|MEDIC/i.test(s.ruolo || '') ||
        /INIBIZIONE/i.test(s.sanzione || '');

      if (!isStaffOrCoach) continue;

      const sSquadra = String(s.squadra || '');
      const sNorm = normString(sSquadra);
      const sTokens = teamTokens(sSquadra);

      let isMatch = false;
      if (rawNorm === sNorm) {
        isMatch = true;
      } else {
        const common = rawTokens.filter((tok) => sTokens.includes(tok));
        const score = common.reduce((acc, tok) => acc + tok.length, 0);
        if (score >= 4) {
          isMatch = true;
        } else if (
          (rawNorm.length >= 6 && sNorm.includes(rawNorm)) ||
          (sNorm.length >= 6 && rawNorm.includes(sNorm))
        ) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matched.push({
          nome: s.nome,
          ruolo: s.ruolo || 'Dirigente',
          sanzione: s.sanzione,
          motivo: s.motivo || '',
          comunicato: s.comunicato,
          competizione: s.competizione || 'Campionato Eccellenza',
          urlComunicato: s.url_comunicato || s.urlComunicato || '',
        });
      }
    }

    return matched;
  }

  /**
   * Calcola l'ultima giornata disputata per ogni squadra dai matches
   */
  static getTeamsMaxPlayedDay(matches: Match[]): {
    teamMap: Record<string, number>;
    defaultMax: number;
  } {
    const teamMap: Record<string, number> = {};
    let defaultMax = 8;

    for (const m of matches || []) {
      if (m.played) {
        const day = Number(m.matchDay || 0);
        const h = normString(m.homeTeamName);
        const a = normString(m.awayTeamName);
        teamMap[h] = Math.max(teamMap[h] || 0, day);
        teamMap[a] = Math.max(teamMap[a] || 0, day);
        if (day > defaultMax) defaultMax = day;
      }
    }

    return { teamMap, defaultMax };
  }
}
