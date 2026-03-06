import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { candidateId, transcript } = await request.json();

    if (!candidateId) {
      return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Store transcript and mark as completed
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_3_transcript: transcript || '',
        round_3_status: 'COMPLETED',
        current_stage: 'completed',
        status: 'COMPLETED',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('[End Round 3] DB update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save interview' }, { status: 500 });
    }

    console.log(`[End Round 3] Candidate ${candidateId} completed Round 3`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[End Round 3] Error:', error);
    return NextResponse.json({ error: 'Failed to end interview' }, { status: 500 });
  }
}
