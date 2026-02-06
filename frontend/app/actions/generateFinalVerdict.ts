'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { gemini } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

// Schema for final verdict
const VerdictSchema = z.object({
  technicalScore: z.number().min(0).max(100).describe('Technical skills score from Round 2'),
  verdict: z.enum(['Strong Hire', 'Hire', 'Weak Hire', 'Reject']).describe('Final hiring decision'),
  summary: z.string().describe('2-sentence executive summary for the Hiring Manager'),
  technicalStrengths: z.array(z.string()).describe('Key technical strengths demonstrated'),
  technicalGaps: z.array(z.string()).describe('Areas of concern or knowledge gaps'),
  recommendation: z.string().describe('Specific recommendation for next steps'),
});

export type FinalVerdict = z.infer<typeof VerdictSchema>;

interface VerdictResult {
  success: boolean;
  verdict?: {
    score: number;
    verdict: string;
    summary: string;
  };
  fullVerdict?: FinalVerdict;
  error?: string;
}

export async function generateFinalVerdict(candidateId: string): Promise<VerdictResult> {
  try {
    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate data including both rounds
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('round_2_transcript, rating, job_description, job_id, full_name')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      console.error('Failed to fetch candidate:', fetchError);
      return { success: false, error: 'Candidate not found' };
    }

    // Get job description from jobs table if not on candidate
    let jobDesc = candidate.job_description || '';
    if (!jobDesc && candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('description, title')
        .eq('id', candidate.job_id)
        .single();

      if (job) {
        jobDesc = `${job.title}: ${job.description || ''}`;
      }
    }

    const round2Transcript = candidate.round_2_transcript;
    const round1Score = candidate.rating || 0;

    if (!round2Transcript) {
      console.error('No Round 2 transcript found for candidate');
      return { success: false, error: 'No Round 2 transcript found' };
    }

    // Generate the final verdict using AI SDK with structured output
    const prompt = `You are the Hiring Committee making a final decision on ${candidate.full_name || 'this candidate'}.

JOB: ${jobDesc.substring(0, 1500) || 'Software Engineering Role'}

ROUND 1 SCORE (Personality/Drive): ${round1Score}/100

ROUND 2 TRANSCRIPT (Technical Interview):
${round2Transcript.substring(0, 6000)}

YOUR TASK:
1. Grade the Technical Skills demonstrated in Round 2 (0-100)
2. Provide a Final Verdict based on BOTH rounds
3. Write a 2-sentence executive summary for the Hiring Manager
4. Identify key technical strengths and gaps
5. Provide a specific recommendation for next steps

SCORING GUIDE:
- 80-100: Strong technical depth, can explain implementation details, understands tradeoffs
- 60-79: Solid fundamentals, some gaps in depth, capable of learning
- 40-59: Surface-level knowledge, relies on buzzwords, needs significant mentorship
- 0-39: Does not meet technical bar, unable to explain their own work

VERDICT OPTIONS:
- "Strong Hire" - Both rounds excellent (avg 80+), clear A-player
- "Hire" - Good performance in both (avg 65+), solid candidate
- "Weak Hire" - Mixed signals, might work with mentorship
- "Reject" - Failed one or both rounds, not a fit`;

    const { object: fullVerdict } = await generateObject({
      model: gemini,
      schema: VerdictSchema,
      prompt,
    });

    // Extract backward-compatible format
    const verdict = {
      score: fullVerdict.technicalScore,
      verdict: fullVerdict.verdict,
      summary: fullVerdict.summary,
    };

    // Update the candidate record
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_2_rating: verdict.score,
        final_verdict: verdict.verdict,
        full_verdict: fullVerdict,
        current_stage: 'completed',
        status: 'COMPLETED',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate with verdict:', updateError);
      return { success: false, error: 'Failed to save verdict' };
    }

    console.log(`[Final Verdict] Candidate ${candidateId}: ${verdict.verdict} (Technical: ${verdict.score}/100)`);

    return { success: true, verdict, fullVerdict };

  } catch (error) {
    console.error('Generate final verdict error:', error);
    return { success: false, error: 'Failed to generate verdict' };
  }
}
