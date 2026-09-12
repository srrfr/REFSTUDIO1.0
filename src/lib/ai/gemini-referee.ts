import { GoogleGenerativeAI } from '@google/generative-ai';
import { Match, Team, Player, PreMatchBriefing } from '@/types/refstudio';

export class GeminiRefereeService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Genera un briefing pre-gara tattico e comportamentale
   */
  async generateBriefing(
    match: Match,
    homeTeam?: Team,
    awayTeam?: Team,
    homePlayers: Player[] = [],
    awayPlayers: Player[] = []
  ): Promise<PreMatchBriefing> {
    // Identifica calciatori a rischio disciplinare
    const flaggedHome = homePlayers.filter(
      (p) => p.customTags.length > 0 || p.yellowCards >= 2 || p.redCards > 0
    );
    const flaggedAway = awayPlayers.filter(
      (p) => p.customTags.length > 0 || p.yellowCards >= 2 || p.redCards > 0
    );

    // Se la chiave API è configurata, invoca il modello Gemini
    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `
Sei un Senior Referee Coach e osservatore arbitrale della FIGC / AIA.
Devi redigere un "Briefing Pre-Gara Operativo" riservato all'arbitro e ai suoi assistenti per la seguente partita di campionato:

PARTITA: ${match.homeTeamName} vs ${match.awayTeamName} (${match.girone ? 'Girone ' + match.girone : ''}, ${match.dateText})
SQUADRA CASA (${match.homeTeamName}):
- Livello Tecnico: ${homeTeam?.technicalLevel || 3}/5, Aggressività: ${homeTeam?.aggressionLevel || 3}/5
- Atteggiamento Panchina: ${homeTeam?.benchAttitude || 'Standard'}
- Atteggiamento Allenatore: ${homeTeam?.coachAttitude || 'Standard'}
- Note Arbitro: ${homeTeam?.refereeNotes || 'Nessuna nota'}

SQUADRA OSPITE (${match.awayTeamName}):
- Livello Tecnico: ${awayTeam?.technicalLevel || 3}/5, Aggressività: ${awayTeam?.aggressionLevel || 3}/5
- Atteggiamento Panchina: ${awayTeam?.benchAttitude || 'Standard'}
- Atteggiamento Allenatore: ${awayTeam?.coachAttitude || 'Standard'}
- Note Arbitro: ${awayTeam?.refereeNotes || 'Nessuna nota'}

CALCIATORI SOTTO OSSERVAZIONE:
${[...flaggedHome, ...flaggedAway]
  .map(
    (p) =>
      `- ${p.firstName} ${p.lastName} (${p.teamName}, ${p.role}): ${p.yellowCards} ammonizioni, ${p.redCards} espulsioni. Tag: [${p.customTags.join(', ')}]. Note: ${p.refereeNotes || 'Nessuna'}`
  )
  .join('\n')}

Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura:
{
  "executiveSummary": "Sintesi strategica del match...",
  "tacticalTensionRating": 7,
  "keyWatchPlayers": [
    {
      "playerName": "Nome Cognome",
      "teamName": "Squadra",
      "role": "ATT",
      "reason": "Motivazione operativa...",
      "tags": ["simulatore", "proteste frequenti"]
    }
  ],
  "benchDisciplineGuidance": "Linee guida per la gestione delle panchine...",
  "refereeAdvice": [
    "Consiglio 1: ...",
    "Consiglio 2: ...",
    "Consiglio 3: ..."
  ]
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          matchId: match.id,
          homeTeam: match.homeTeamName,
          awayTeam: match.awayTeamName,
          executiveSummary: parsed.executiveSummary || 'Briefing generato con successo.',
          tacticalTensionRating: parsed.tacticalTensionRating || 6,
          keyWatchPlayers: parsed.keyWatchPlayers || [],
          benchDisciplineGuidance: parsed.benchDisciplineGuidance || '',
          refereeAdvice: parsed.refereeAdvice || [],
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn('Gemini API call fallback to heuristic engine:', err);
      }
    }

    // Heuristic Fallback Engine (funziona istantaneamente anche senza API Key)
    const combinedFlagged = [...flaggedHome, ...flaggedAway].slice(0, 5);
    const tensionBase = Math.min(
      10,
      Math.max(
        4,
        Math.round(
          ((homeTeam?.aggressionLevel || 3) + (awayTeam?.aggressionLevel || 3)) / 2 +
            (combinedFlagged.length > 2 ? 2 : 1)
        )
      )
    );

    return {
      matchId: match.id,
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      executiveSummary: `Scontro diretto ad elevata intensità tra ${match.homeTeamName} e ${match.awayTeamName}. Entrambe le squadre mantengono ritmi serrati. Si raccomanda vicinanza tempestiva dell'arbitro nell'azione fin dai primi 10 minuti per impostare la soglia del fallo.`,
      tacticalTensionRating: tensionBase,
      keyWatchPlayers: combinedFlagged.map((p) => ({
        playerName: `${p.firstName} ${p.lastName}`,
        teamName: p.teamName,
        role: p.role,
        reason:
          p.customTags.includes('simulatore')
            ? 'Cerca frequentemente il fallo tattico e il penalty; attendere il contatto effettivo prima del fischio.'
            : p.customTags.includes('proteste frequenti')
            ? 'Leader di protesta emotiva: isolarlo con fermezza e richiamo verbale chiaro.'
            : `Statistiche disciplinari rilevanti: ${p.yellowCards} ammonizioni accumulate in campionato.`,
        tags: p.customTags.length > 0 ? p.customTags : ['osservare'],
      })),
      benchDisciplineGuidance: `Mantenere costante cooperazione visiva con il primo assistente per contenere l'area tecnica di ${homeTeam?.name || 'casa'}. Richiamare il mister al primo superamento senza tollerare gesti plateali verso gli assistenti.`,
      refereeAdvice: [
        'Fissare fin dal primo contrasto la soglia tecnica del fallo evitando tolleranze eccessive nei primi 15 minuti.',
        'Sui calci d\'angolo, verificare preventivamente le trattenute a centro area prima di autorizzare la battuta col fischietto.',
        'Negli scontri aerei, vigilare sull\'uso scorretto di braccia e gomiti a protezione della palla.',
        'In caso di proteste corali, ammonire immediatamente il capannello applicando la direttiva "Solo il Capitano può parlare con l\'arbitro".',
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const geminiReferee = new GeminiRefereeService();
