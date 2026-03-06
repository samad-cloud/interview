'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { geminiPro } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

const Round3DossierSchema = z.object({
  probeAreas: z.array(z.object({
    topic: z.string().describe('The specific topic or skill area to probe'),
    context: z.string().describe('What the candidate said in R1/R2 that warrants deeper investigation'),
    whyProbe: z.string().describe('Why this area needs deeper investigation — shallow answer, inconsistency, claim not verified, rubric gap'),
    suggestedAngles: z.array(z.string()).describe('2-3 specific questions or angles to pursue in R3'),
    priority: z.enum(['high', 'medium']).describe('High = critical gap or inconsistency; Medium = worth exploring but not blocking'),
  })).describe('Ordered list of areas to probe deeply in Round 3, prioritised by importance'),
  interviewerBrief: z.string().describe('A 2-3 sentence brief for the Round 3 interviewer summarising the candidate profile and what Round 3 should focus on'),
  redFlags: z.array(z.string()).describe('Any inconsistencies, contradictions, or concerns spotted across R1 and R2 that must be addressed'),
});

export type Round3Dossier = z.infer<typeof Round3DossierSchema>;

export async function generateRound3Dossier(candidateId: string): Promise<{ success: boolean; dossier?: Round3Dossier; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return { success: false, error: 'Supabase not configured' };

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('full_name, round_2_transcript, transcript, rating, round_2_rating, final_verdict, full_verdict, job_id')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    let jobTitle = 'the role';
    let jobDescription = '';
    let r2Rubric = '';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title, description, r2_rubric')
        .eq('id', candidate.job_id)
        .single();
      if (job) {
        jobTitle = job.title || jobTitle;
        jobDescription = job.description || '';
        r2Rubric = job.r2_rubric || '';
      }
    }

    const { object: dossier } = await generateObject({
      model: geminiPro,
      schema: Round3DossierSchema,
      prompt: `You are a senior hiring committee member preparing a Round 3 deep-dive interview for ${candidate.full_name} applying for ${jobTitle}.

You have their complete interview history from Round 1 (personality/drive) and Round 2 (technical). Your task is to identify the exact areas that need deeper investigation — where answers were shallow, inconsistent, time ran out, or technical depth was unverified.

JOB DESCRIPTION:
${jobDescription.substring(0, 1000)}

TECHNICAL ASSESSMENT RUBRIC (used in Round 2):
${r2Rubric || 'No specific rubric — use the job description to assess technical fit.'}

ROUND 1 TRANSCRIPT (personality/drive interview):
${(candidate.transcript || 'Not available').substring(0, 3000)}

ROUND 1 SCORE: ${candidate.rating ?? 'Not scored'}/100

ROUND 2 TRANSCRIPT (technical interview):
${(candidate.round_2_transcript || 'Not available').substring(0, 4000)}

ROUND 2 TECHNICAL SCORE: ${candidate.round_2_rating ?? 'Not scored'}/100

ROUND 2 FINAL VERDICT: ${candidate.final_verdict ?? 'Not assessed'}

ROUND 2 FULL ASSESSMENT:
${candidate.full_verdict ? JSON.stringify(candidate.full_verdict, null, 2).substring(0, 1500) : 'Not available'}

YOUR TASK:
Identify the 4-8 most important areas to probe in Round 3. Focus on:
1. Rubric dimensions where they scored poorly or gave surface-level answers
2. Technical claims made in R1 or R2 that were never properly verified
3. Inconsistencies between what they said in R1 vs R2 (story changes, contradictions)
4. Areas the Round 2 interviewer started but ran out of time to fully explore
5. Red flags — buzzword-heavy answers with no depth, vague examples, evasive responses
6. Any soft skill claims (leadership, ownership, entrepreneurship) that need real evidence

Round 3 is the FINAL vetting round. The avatar interviewer should leave no stone unturned.
Order probe areas from most to least critical.`,
    });

    // Store the dossier on the candidate record
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ round_3_dossier: dossier })
      .eq('id', candidateId);

    if (updateError) {
      console.error('[Round 3 Dossier] DB update failed:', updateError);
      // Non-fatal — return dossier anyway
    }

    console.log(`[Round 3 Dossier] Generated ${dossier.probeAreas.length} probe areas for candidate ${candidateId}`);
    return { success: true, dossier };

  } catch (error) {
    console.error('[Round 3 Dossier] Error:', error);
    return { success: false, error: 'Failed to generate Round 3 dossier' };
  }
}
