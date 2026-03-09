'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { geminiPro } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

const Round3VerdictSchema = z.object({
  round3Score: z.number().min(0).max(100).describe('Overall deep-dive score from Round 3 (0–100)'),
  ultimateVerdict: z.enum(['Strong Hire', 'Hire', 'Weak Hire', 'Reject']).describe('Final hiring decision synthesising all 3 rounds'),
  executiveSummary: z.string().describe('2–3 sentence summary for the Hiring Manager covering the full 3-round picture'),
  keyStrengths: z.array(z.string()).describe('Top strengths confirmed consistently across all 3 rounds'),
  keyGaps: z.array(z.string()).describe('Remaining concerns or gaps that persist after all 3 rounds'),
  redFlagsResolved: z.array(z.string()).describe('Concerns or red flags raised in R1/R2 that were successfully clarified in R3'),
  remainingConcerns: z.array(z.string()).describe('Issues that remained unresolved or were confirmed as genuine concerns after R3'),
  finalRecommendation: z.string().describe('Specific, actionable recommendation for the Hiring Manager'),
});

export type Round3Verdict = z.infer<typeof Round3VerdictSchema>;

interface Round3VerdictResult {
  success: boolean;
  round3Score?: number;
  ultimateVerdict?: string;
  fullVerdict?: Round3Verdict;
  error?: string;
}

export async function generateRound3Verdict(candidateId: string): Promise<Round3VerdictResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return { success: false, error: 'Supabase not configured' };

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('full_name, transcript, round_2_transcript, round_3_transcript, rating, round_2_rating, final_verdict, full_verdict, round_3_dossier, job_id')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    if (!candidate.round_3_transcript) {
      return { success: false, error: 'No Round 3 transcript found' };
    }

    let jobTitle = 'the role';
    let jobDescription = '';
    let r3Rubric = '';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title, description, r2_rubric')
        .eq('id', candidate.job_id)
        .single();
      if (job) {
        jobTitle = job.title || jobTitle;
        jobDescription = job.description || '';
        r3Rubric = job.r2_rubric || '';
      }
    }

    const prompt = `You are the Hiring Committee making the FINAL hiring decision on ${candidate.full_name || 'this candidate'} for ${jobTitle}.

This candidate has now completed all 3 interview rounds. Synthesise the evidence from all rounds to make a definitive decision.

JOB DESCRIPTION:
${jobDescription.substring(0, 1000)}

TECHNICAL/SKILLS RUBRIC:
${r3Rubric || 'No specific rubric — assess based on the job description.'}

═══ ROUND 1 — Personality & Drive ═══
Score: ${candidate.rating ?? 'Not scored'}/100
Transcript:
${(candidate.transcript || 'Not available').substring(0, 2500)}

═══ ROUND 2 — Technical Interview ═══
Score: ${candidate.round_2_rating ?? 'Not scored'}/100
Verdict: ${candidate.final_verdict ?? 'Not assessed'}
R2 Assessment: ${candidate.full_verdict ? JSON.stringify(candidate.full_verdict, null, 2).substring(0, 800) : 'Not available'}
Transcript:
${(candidate.round_2_transcript || 'Not available').substring(0, 2500)}

═══ ROUND 3 — Deep-Dive / Avatar Interview ═══
Probe areas targeted: ${candidate.round_3_dossier ? JSON.stringify((candidate.round_3_dossier as { probeAreas?: { topic: string; priority: string }[] }).probeAreas?.map((p: { topic: string; priority: string }) => `${p.topic} (${p.priority})`)) : 'Not specified'}
Transcript:
${candidate.round_3_transcript.substring(0, 3000)}

STT NOTICE — SPEECH-TO-TEXT TRANSCRIPTION ERRORS:
Phonetic errors are expected and are NOT the candidate's fault. Do NOT penalise mispronunciation of names or technical terms — evaluate intent, substance, and ideas.

YOUR TASK:
1. Score Round 3 performance (0–100): How well did they address the probe areas? Did they provide depth, evidence, and concrete examples?
2. Evaluate whether R1/R2 concerns were resolved in R3 (red flags addressed vs. confirmed)
3. Synthesise all 3 rounds into a final verdict
4. Write a concise executive summary for the Hiring Manager
5. List confirmed strengths and remaining gaps
6. Provide a specific, actionable recommendation

SCORING GUIDE (Round 3):
- 80–100: Addressed all probes with depth and evidence; no unresolved red flags
- 60–79: Resolved most concerns; minor gaps remain; capable candidate
- 40–59: Addressed some probes superficially; key concerns remain
- 0–39: Failed to address probes; red flags confirmed; not suitable

VERDICT OPTIONS:
- "Strong Hire" — All 3 rounds excellent; A-player; no blocking concerns
- "Hire" — Good overall; minor gaps acceptable; worth onboarding
- "Weak Hire" — Mixed signals across rounds; may work with strong mentorship
- "Reject" — Fundamental concerns confirmed across rounds; not a fit`;

    const { object: fullVerdict } = await generateObject({
      model: geminiPro,
      schema: Round3VerdictSchema,
      prompt,
    });

    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_3_rating: fullVerdict.round3Score,
        round_3_full_verdict: fullVerdict,
        final_verdict: fullVerdict.ultimateVerdict,
        round_3_status: 'COMPLETED',
        current_stage: 'completed',
        status: 'COMPLETED',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('[Round 3 Verdict] DB update failed:', updateError);
      return { success: false, error: 'Failed to save Round 3 verdict' };
    }

    console.log(`[Round 3 Verdict] ${candidateId}: ${fullVerdict.ultimateVerdict} (R3 score: ${fullVerdict.round3Score}/100)`);

    return {
      success: true,
      round3Score: fullVerdict.round3Score,
      ultimateVerdict: fullVerdict.ultimateVerdict,
      fullVerdict,
    };

  } catch (error) {
    console.error('[Round 3 Verdict] Error:', error);
    return { success: false, error: 'Failed to generate Round 3 verdict' };
  }
}
