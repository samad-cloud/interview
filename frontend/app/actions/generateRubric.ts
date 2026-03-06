'use server';

import { generateText } from 'ai';
import { gemini } from '@/lib/ai';

export async function generateRubric(jobTitle: string, jobDescription: string): Promise<{ success: boolean; rubric?: string; error?: string }> {
  try {
    const { text } = await generateText({
      model: gemini,
      prompt: `You are an expert technical recruiter. Generate a structured technical interview rubric for the following role.

JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription.substring(0, 2000)}

Create a rubric with 4-6 technical competency dimensions relevant to this specific role. For each dimension, provide:
- A clear name and one-line description
- What a weak answer (1-2/5) looks like
- What a solid answer (3/5) looks like
- What an exceptional answer (4-5/5) looks like

Format it as plain text that can be embedded directly in an AI prompt. Use this structure for each dimension:

DIMENSION: [Name]
Description: [One sentence on what this assesses]
1-2/5 (Weak): [What a poor answer looks like — surface-level buzzwords, no depth, can't explain own work]
3/5 (Solid): [What a decent answer looks like — understands concepts, some practical experience, minor gaps]
4-5/5 (Exceptional): [What an outstanding answer looks like — deep practical knowledge, tradeoffs understood, real-world examples]

Only include dimensions directly relevant to the role. Do not add generic soft skills — those are assessed in Round 1.`,
    });

    return { success: true, rubric: text.trim() };
  } catch (error) {
    console.error('generateRubric error:', error);
    return { success: false, error: 'Failed to generate rubric' };
  }
}
