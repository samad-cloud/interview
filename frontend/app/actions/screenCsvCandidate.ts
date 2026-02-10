'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

interface CsvScreenResult {
  success: boolean;
  name?: string;
  email?: string;
  score?: number;
  reasoning?: string;
  status?: 'RECOMMENDED' | 'REJECT';
  error?: string;
  skipped?: boolean;
}

export async function screenCsvCandidate(
  jobId: string,
  candidate: {
    name: string;
    email: string;
    resumeUrl: string;
    phone?: string;
    source?: string;
    campaign?: string;
    applicationDate?: string;
  }
): Promise<CsvScreenResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch job description
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title, description')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return { success: false, error: 'Job not found' };
    }

    // Check for duplicate email
    if (candidate.email) {
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', candidate.email.toLowerCase())
        .single();

      if (existing) {
        return {
          success: true,
          skipped: true,
          name: candidate.name,
          email: candidate.email,
          reasoning: 'Duplicate — candidate already exists in the system',
          status: 'REJECT',
        };
      }
    }

    // Fetch the resume from the URL
    let resumeBase64: string;
    let mimeType = 'application/pdf';
    try {
      const response = await fetch(candidate.resumeUrl);
      if (!response.ok) {
        return { success: false, name: candidate.name, email: candidate.email, error: `Resume download failed (${response.status})` };
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('pdf')) mimeType = 'application/pdf';
      else if (contentType.includes('word') || contentType.includes('docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      const arrayBuffer = await response.arrayBuffer();
      resumeBase64 = Buffer.from(arrayBuffer).toString('base64');
    } catch {
      return { success: false, name: candidate.name, email: candidate.email, error: 'Failed to download resume' };
    }

    // Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'AI service not configured' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an Expert Technical Recruiter. Analyze this resume against the job description.

JOB TITLE: ${job.title}
JOB DESCRIPTION:
${job.description?.substring(0, 2000) || 'Software Engineering Role'}

CANDIDATE NAME: ${candidate.name}
CANDIDATE EMAIL: ${candidate.email}

TASKS:
1. Extract the full text content of the resume.
2. Calculate a Match Score (0-100) based strictly on how well they match the job requirements.
   - 80-100: Exceptional match (has all required skills + experience level)
   - 60-79: Good match (has most requirements)
   - 40-59: Partial match (missing key requirements)
   - 0-39: Poor match (significantly underqualified)
3. Write a 1-sentence reasoning explaining the score.
4. Set status: "RECOMMENDED" if score >= 70, otherwise "REJECT".

CONTEXT: We are looking for 'Go-Getters' and high achievers. Be strict.

OUTPUT: Return ONLY valid JSON (no markdown, no explanation):
{
  "resume_text": "Full extracted resume text",
  "score": 75,
  "reasoning": "Strong Python skills but lacks required AWS experience",
  "status": "RECOMMENDED"
}`;

    const result = await model.generateContent([
      { inlineData: { mimeType, data: resumeBase64 } },
      prompt,
    ]);

    const responseText = result.response.text().trim();
    let cleanedResponse = responseText;
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    let parsed: { resume_text: string; score: number; reasoning: string; status: 'RECOMMENDED' | 'REJECT' };
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch {
      console.error('Failed to parse Gemini response:', cleanedResponse);
      return { success: false, name: candidate.name, email: candidate.email, error: 'Failed to parse resume' };
    }

    const status = parsed.score >= 70 ? 'RECOMMENDED' : 'REJECT';
    const dbStatus = parsed.score >= 70 ? 'GRADED' : 'CV_REJECTED';

    // Save to database
    const { error: insertError } = await supabase.from('candidates').insert({
      full_name: candidate.name || 'Unknown',
      email: candidate.email?.toLowerCase() || `unknown-${Date.now()}@csv-upload.local`,
      resume_text: parsed.resume_text || '',
      jd_match_score: parsed.score,
      job_id: jobId,
      job_description: job.description,
      status: dbStatus,
      metadata: {
        source: 'csv_upload',
        original_source: candidate.source || null,
        campaign: candidate.campaign || null,
        phone: candidate.phone || null,
        application_date: candidate.applicationDate || null,
        resume_url: candidate.resumeUrl,
        grading_reasoning: parsed.reasoning,
      },
    });

    if (insertError) {
      console.error('Failed to insert candidate:', insertError);
      return { success: false, name: candidate.name, email: candidate.email, error: 'Failed to save candidate' };
    }

    return {
      success: true,
      name: candidate.name,
      email: candidate.email,
      score: parsed.score,
      reasoning: parsed.reasoning,
      status,
    };
  } catch (error) {
    console.error('Screen CSV candidate error:', error);
    return { success: false, name: candidate.name, email: candidate.email, error: 'Failed to process' };
  }
}
