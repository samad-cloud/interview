'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { gemini } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

// Schema for probe questions dossier
const DossierSchema = z.object({
  probeQuestions: z.array(z.object({
    question: z.string().describe('A deep technical probe question'),
    targetClaim: z.string().describe('The specific claim or project from Round 1 this question probes'),
    probeType: z.enum(['implementation_details', 'tradeoffs', 'scale_metrics', 'debugging', 'architecture']),
  })).min(3).max(5),
  candidateStrengths: z.array(z.string()).describe('Key strengths identified from Round 1'),
  areasToProbe: z.array(z.string()).describe('Areas that need deeper verification in Round 2'),
  overallAssessment: z.string().describe('Brief assessment of Round 1 performance'),
});

export type Dossier = z.infer<typeof DossierSchema>;

interface DossierResult {
  success: boolean;
  dossier?: string[];
  fullDossier?: Dossier;
  error?: string;
}

export async function generateDossier(candidateId: string): Promise<DossierResult> {
  try {
    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate data
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('interview_transcript, job_description, job_id')
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

    const transcript = candidate.interview_transcript;

    if (!transcript) {
      console.error('No transcript found for candidate');
      return { success: false, error: 'No interview transcript found' };
    }

    // Generate the dossier using AI SDK with structured output
    const prompt = `You are a Senior Technical Architect preparing for a Round 2 technical interview.

CANDIDATE'S ROUND 1 INTERVIEW TRANSCRIPT:
${transcript.substring(0, 6000)}

JOB DESCRIPTION:
${jobDesc.substring(0, 1500) || 'Software Engineering Role'}

YOUR TASK:
Analyze the Round 1 transcript thoroughly and prepare a dossier for Round 2.

1. Identify 3-5 specific technical claims, projects, or accomplishments the candidate mentioned
2. For EACH claim, create a "Probe Question" that tests their DEEP technical understanding

RULES FOR PROBE QUESTIONS:
- Ask for specific implementation details (e.g., "How exactly did you handle race conditions?")
- Ask about tradeoffs and decisions (e.g., "Why did you choose that approach over X?")
- Ask about scale and metrics (e.g., "How many requests per second? What was the latency?")
- Do NOT accept buzzwords - these questions should expose if they actually built it vs. just talked about it

Also identify:
- Key strengths demonstrated in Round 1
- Areas that need deeper verification
- Overall assessment of their Round 1 performance`;

    const { object: fullDossier } = await generateObject({
      model: gemini,
      schema: DossierSchema,
      prompt,
    });

    // Extract just the question strings for backward compatibility
    const dossier = fullDossier.probeQuestions.map(q => q.question);

    // Update the candidate record with both formats
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        round_1_dossier: dossier,
        round_1_full_dossier: fullDossier,
        current_stage: 'round_2',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Failed to update candidate with dossier:', updateError);
      return { success: false, error: 'Failed to save dossier' };
    }

    console.log(`[Dossier] Generated ${dossier.length} probe questions for candidate ${candidateId}`);

    return { success: true, dossier, fullDossier };

  } catch (error) {
    console.error('Generate dossier error:', error);
    return { success: false, error: 'Failed to generate dossier' };
  }
}
