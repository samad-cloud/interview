import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { generateInterviewNotes } from '@/app/actions/generateNotes';

interface GeminiAnalysis {
  score: number;
  decision: 'Strong Hire' | 'Hire' | 'Weak' | 'Reject';
  top_strength: string;
  top_weakness: string;
  red_flag: boolean;
  summary: string;
}

const analysisSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER, description: 'Candidate score from 0-100' },
    decision: { type: SchemaType.STRING, format: 'enum', enum: ['Strong Hire', 'Hire', 'Weak', 'Reject'], description: 'Hiring decision' },
    top_strength: { type: SchemaType.STRING, description: 'Top strength in max 10 words' },
    top_weakness: { type: SchemaType.STRING, description: 'Top weakness in max 10 words' },
    red_flag: { type: SchemaType.BOOLEAN, description: 'True if candidate lied, was evasive, or completely disengaged' },
    summary: { type: SchemaType.STRING, description: 'Max 2 sentence summary' },
  },
  required: ['score', 'decision', 'top_strength', 'top_weakness', 'red_flag', 'summary'],
};

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

    // Step 1: Fetch candidate data
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('job_id, resume_text, full_name')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error('Failed to fetch candidate:', candidateError);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Step 2: Fetch job details
    let jobTitle = 'Unknown Position';
    let jobDescription = '';

    if (candidate.job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('title, description')
        .eq('id', candidate.job_id)
        .single();

      if (!jobError && job) {
        jobTitle = job.title || 'Unknown Position';
        jobDescription = job.description || '';
      }
    }

    // Step 3: Initialize Gemini with structured output
    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!googleApiKey) {
      console.error('Missing Google API key');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
      },
    });

    // Prepare resume excerpt (first 500 chars)
    const resumeExcerpt = candidate.resume_text
      ? candidate.resume_text.substring(0, 500)
      : 'No resume provided';

    // Format transcript if it's an array
    const transcriptText = Array.isArray(transcript)
      ? transcript.join('\n')
      : transcript;

    // Guard: reject scoring if no candidate responses in transcript
    const hasCandidateResponses = transcriptText.includes('(Candidate):');
    if (!hasCandidateResponses) {
      const { error: updateError } = await supabase
        .from('candidates')
        .update({
          interview_transcript: transcriptText,
          rating: 0,
          ai_summary: 'Interview incomplete — no candidate responses recorded.',
          status: 'INTERVIEW_INCOMPLETE',
        })
        .eq('id', candidateId);

      if (updateError) {
        console.error('Failed to update candidate:', updateError);
        return NextResponse.json({ error: 'Failed to save interview data' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        analysis: {
          score: 0,
          decision: 'Reject',
          top_strength: 'N/A',
          top_weakness: 'Interview incomplete',
          red_flag: true,
          summary: 'Interview incomplete — no candidate responses were recorded.',
        },
      });
    }

    // Step 4: The Judge - Gemini Analysis
    const prompt = `You are a senior talent evaluator scoring a Round 1 personality and drive interview. This round does NOT test technical skills — it tests hunger, resilience, and ownership mindset.

JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription}
RESUME HIGHLIGHTS: ${resumeExcerpt}

TRANSCRIPT:
${transcriptText}

SCORING CRITERIA (what this round actually tested):
1. Internal Locus of Control — Do they own their failures or blame others?
2. Permissionless Action — Do they solve problems without being asked, or wait for instructions?
3. High Standards — Do they obsess over quality and hate mediocrity?
4. Drive & Resilience — Do they push through setbacks or give up easily?
5. Communication — Are they articulate, specific, and honest? Or vague and evasive?

SCORING GUIDE:
- 80-100: Clear A-player. Owns failures, acts without permission, gives specific examples, high standards.
- 60-79: Solid candidate. Shows some drive but may be vague in places or lack standout moments.
- 40-59: Mediocre. Generic answers, blames circumstances, waits for instructions, no fire.
- 0-39: Red flags. Evasive, entitled, excuse-maker, or disengaged.`;

    const result = await model.generateContent(prompt);
    const analysis: GeminiAnalysis = JSON.parse(result.response.text());

    // Step 5: Save to database
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        interview_transcript: transcriptText,
        rating: analysis.score,
        ai_summary: analysis.summary,
        status: 'INTERVIEWED',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate:', updateError);
      return NextResponse.json(
        { error: 'Failed to save interview data' },
        { status: 500 }
      );
    }

    console.log(`[End Interview] Candidate ${candidateId} scored ${analysis.score}/100 - ${analysis.decision}`);

    // Step 6: Auto-generate interview notes (fire-and-forget, don't block response)
    generateInterviewNotes({
      candidateId,
      candidateName: candidate.full_name || 'Unknown',
      jobTitle,
      round1Transcript: transcriptText,
      round2Transcript: null,
    }).then(() => {
      console.log(`[End Interview] Auto-generated notes for candidate ${candidateId}`);
    }).catch((err) => {
      console.error(`[End Interview] Failed to auto-generate notes for ${candidateId}:`, err);
    });

    // Step 7: Return success with analysis
    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('End interview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
