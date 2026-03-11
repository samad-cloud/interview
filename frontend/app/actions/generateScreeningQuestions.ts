'use server';

import { generateObject } from 'ai';
import { gemini } from '@/lib/ai';
import { z } from 'zod';

const ScreeningQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('A Yes/No eligibility question for the role. Must be answerable with Yes or No.'),
    })
  ).min(3).max(8),
});

export async function generateScreeningQuestions(params: {
  title: string;
  location: string;
  skillsMustHave: string[];
  visaSponsorship: boolean;
  education: string;
  experienceMin: string;
}): Promise<{ question: string }[]> {
  const skillsText = params.skillsMustHave.length > 0
    ? params.skillsMustHave.join(', ')
    : 'none specified';
  const educationText = params.education && params.education !== 'any'
    ? params.education.replace(/_/g, ' ')
    : 'no specific requirement';

  const { object } = await generateObject({
    model: gemini,
    schema: ScreeningQuestionsSchema,
    prompt: `Generate 3-8 Yes/No eligibility screening questions for a "${params.title}" role based in ${params.location || 'any location'}.

Role requirements:
- Required skills: ${skillsText}
- Minimum education: ${educationText}
- Minimum experience: ${params.experienceMin || '0'} years
- Visa sponsorship: ${params.visaSponsorship ? 'available' : 'not available — candidate must already have right to work'}

These screening questions will be shown to candidates before their interview invite. Each question must:
1. Have a clear Yes/No answer
2. Filter out candidates who don't meet a specific requirement
3. Be direct and professional in tone

Examples of good screening questions:
- "Do you have at least 3 years of experience with React?"
- "Are you currently legally authorized to work in Dubai without sponsorship?"
- "Do you hold a Bachelor's degree or higher in a relevant field?"

Generate questions specific to THIS role's requirements. Avoid generic questions that apply to any role.`,
  });

  return object.questions;
}
