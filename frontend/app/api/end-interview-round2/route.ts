import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateInterviewNotes } from '@/app/actions/generateNotes';

export async function POST(request: Request) {
  try {
    const { candidateId, transcript } = await request.json();

    if (!candidateId || !transcript) {
      return NextResponse.json(
        { error: 'Missing candidateId or transcript' },
        { status: 400 }
      );
    }

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Format transcript if it's an array
    const transcriptText = Array.isArray(transcript)
      ? transcript.join('\n')
      : transcript;

    // Fetch candidate data for notes generation
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('full_name, job_id, interview_transcript')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error('Failed to fetch candidate:', candidateError);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Fetch job title
    let jobTitle = 'Unknown Position';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', candidate.job_id)
        .single();
      if (job) jobTitle = job.title || 'Unknown Position';
    }

    // Guard: check for missing or suspicious candidate responses
    const hasCandidateResponses = transcriptText.includes('(Candidate):');
    if (!hasCandidateResponses) {
      // Save transcript but don't advance — candidate can retake
      await supabase
        .from('candidates')
        .update({ round_2_transcript: transcriptText })
        .eq('id', candidateId);

      console.log(`[End Interview Round 2] Incomplete transcript for candidate ${candidateId}: no candidate responses`);
      return NextResponse.json({
        success: true,
        incomplete: true,
        message: 'Interview incomplete — no candidate responses recorded. Candidate can retake.',
      });
    }

    // Guard: check if candidate responses are too short (suspicious)
    const candidateResponses = transcriptText.split('(Candidate):').slice(1);
    const candidateWords = candidateResponses
      .map((r: string) => {
        const endIdx = r.search(/\(Wayne\):|\(Atlas\):|\(Interviewer\):/);
        return endIdx > -1 ? r.substring(0, endIdx) : r;
      })
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 0);

    if (candidateWords.length < 15) {
      // Save transcript but don't trigger notes or advance status
      await supabase
        .from('candidates')
        .update({ round_2_transcript: transcriptText })
        .eq('id', candidateId);

      console.log(`[End Interview Round 2] Suspicious transcript for candidate ${candidateId}: only ${candidateWords.length} candidate words`);
      return NextResponse.json({
        success: true,
        incomplete: true,
        message: `Interview suspicious — only ${candidateWords.length} words from candidate. Candidate can retake.`,
      });
    }

    // Save Round 2 transcript to database
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_2_transcript: transcriptText,
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate:', updateError);
      return NextResponse.json(
        { error: 'Failed to save Round 2 transcript' },
        { status: 500 }
      );
    }

    console.log(`[End Interview Round 2] Saved transcript for candidate ${candidateId}`);

    // Auto-generate interview notes with both transcripts (fire-and-forget)
    generateInterviewNotes({
      candidateId,
      candidateName: candidate.full_name || 'Unknown',
      jobTitle,
      round1Transcript: candidate.interview_transcript || null,
      round2Transcript: transcriptText,
    }).then(() => {
      console.log(`[End Interview Round 2] Auto-generated notes for candidate ${candidateId}`);
    }).catch((err) => {
      console.error(`[End Interview Round 2] Failed to auto-generate notes for ${candidateId}:`, err);
    });

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error('End interview round 2 error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



