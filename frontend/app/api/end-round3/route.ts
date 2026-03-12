import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateRound3Verdict } from '@/app/actions/generateRound3Verdict';

const INCOMPLETE_TRANSCRIPT = '[Interview conducted via avatar — see recording]';
const MIN_INTERVIEWER_TURNS = 2;

function isIncomplete(transcript: string): boolean {
  if (!transcript || transcript === INCOMPLETE_TRANSCRIPT) return true;
  // Count how many times the interviewer spoke — fewer than 2 means the interview barely started
  const veraCount = (transcript.match(/\nVera:/g) || []).length;
  return veraCount < MIN_INTERVIEWER_TURNS;
}

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

    const transcriptText = Array.isArray(transcript) ? transcript.join('\n') : (transcript || '');

    const { data: candidate } = await supabase
      .from('candidates')
      .select('full_name')
      .eq('id', candidateId)
      .single();

    // Detect incomplete interview — revert to INVITED so candidate can retake, store nothing
    if (isIncomplete(transcriptText)) {
      console.log(`[End Round 3] Incomplete interview for ${candidate?.full_name} (${candidateId}) — reverting to INVITED`);
      await supabase
        .from('candidates')
        .update({ round_3_status: 'INVITED' })
        .eq('id', candidateId);
      return NextResponse.json({ success: true, incomplete: true });
    }

    // Save transcript
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ round_3_transcript: transcriptText })
      .eq('id', candidateId);

    if (updateError) {
      console.error('[End Round 3] DB update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save interview' }, { status: 500 });
    }

    console.log(`[End Round 3] Saved transcript for ${candidate?.full_name} (${candidateId})`);

    // Generate Round 3 verdict — scores all 3 rounds, updates final_verdict, round_3_rating, round_3_full_verdict
    let verdictResult = null;
    try {
      verdictResult = await generateRound3Verdict(String(candidateId));
      if (verdictResult.success) {
        console.log(`[End Round 3] Verdict for ${candidate?.full_name} (${candidateId}): ${verdictResult.ultimateVerdict} (R3 score: ${verdictResult.round3Score}/100)`);
      } else {
        console.error(`[End Round 3] Verdict failed for ${candidate?.full_name} (${candidateId}): ${verdictResult.error}`);
        // Fall back to marking completed without a score
        await supabase
          .from('candidates')
          .update({ round_3_status: 'COMPLETED', current_stage: 'completed', status: 'COMPLETED' })
          .eq('id', candidateId);
      }
    } catch (err) {
      console.error(`[End Round 3] Verdict error for ${candidate?.full_name} (${candidateId}):`, err);
      await supabase
        .from('candidates')
        .update({ round_3_status: 'COMPLETED', current_stage: 'completed', status: 'COMPLETED' })
        .eq('id', candidateId);
    }

    return NextResponse.json({
      success: true,
      round3Score: verdictResult?.success ? verdictResult.round3Score : undefined,
      ultimateVerdict: verdictResult?.success ? verdictResult.ultimateVerdict : undefined,
    });

  } catch (error) {
    console.error('[End Round 3] Error:', error);
    return NextResponse.json({ error: 'Failed to end interview' }, { status: 500 });
  }
}
