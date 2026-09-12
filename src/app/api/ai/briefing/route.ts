import { NextResponse } from 'next/server';
import { DbService } from '@/lib/repository/db-service';
import { geminiReferee } from '@/lib/ai/gemini-referee';

export async function POST(request: Request) {
  try {
    const { matchId } = await request.json();
    if (!matchId) {
      return NextResponse.json({ success: false, message: 'matchId obbligatorio' }, { status: 400 });
    }

    const match = DbService.getMatchById(matchId);
    if (!match) {
      return NextResponse.json({ success: false, message: 'Partita non trovata' }, { status: 404 });
    }

    const homeTeam = DbService.getTeamById(match.homeTeamId);
    const awayTeam = DbService.getTeamById(match.awayTeamId);
    const homePlayers = DbService.getPlayers(match.homeTeamId);
    const awayPlayers = DbService.getPlayers(match.awayTeamId);

    const briefing = await geminiReferee.generateBriefing(
      match,
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers
    );

    return NextResponse.json({ success: true, data: briefing });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
