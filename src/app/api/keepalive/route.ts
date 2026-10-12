import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase non configurato nell'ambiente" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.from('teams').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase keep-alive eseguito con successo',
      timestamp: new Date().toISOString(),
      sample: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Errore imprevisto' },
      { status: 500 }
    );
  }
}
