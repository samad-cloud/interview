'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import VoiceAvatar from '@/components/VoiceAvatar';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface CandidateData {
  id: number;
  full_name: string;
  job_id: number | null;
  job_description: string | null;
  resume_text: string | null;
  status: string | null;
  rating: number | null;
}

export default function VoiceInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [jobTitle, setJobTitle] = useState<string>('Open Position');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCandidate = async () => {
      if (!token) {
        setError('No interview token provided');
        setIsLoading(false);
        return;
      }

      try {
        // Query by interview_token (secure, unguessable UUID)
        const { data, error: supabaseError } = await supabase
          .from('candidates')
          .select('id, full_name, job_id, job_description, resume_text, status, rating')
          .eq('interview_token', token)
          .single();

        if (supabaseError) {
          console.error('Supabase error:', supabaseError);
          setError('Interview link is invalid or expired');
          return;
        }

        if (!data) {
          setError('Candidate not found');
          return;
        }

        setCandidate(data);

        // Fetch job title from jobs table
        if (data.job_id) {
          const { data: job } = await supabase
            .from('jobs')
            .select('title')
            .eq('id', data.job_id)
            .single();
          if (job?.title) {
            setJobTitle(job.title);
          }
        }
      } catch (err) {
        console.error('Error fetching candidate:', err);
        setError('Failed to load interview data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandidate();
  }, [token]);

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Loading interview...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Interview Link Invalid
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This interview link is no longer valid. Please contact the recruiter for a new link.'}
          </p>
          <a
            href="https://printerpix.com"
            className="inline-block px-6 py-3 bg-card hover:bg-muted text-foreground rounded-lg transition-colors border border-border"
          >
            Return to Printerpix
          </a>
        </div>
      </div>
    );
  }

  // Already Completed State - Prevent re-taking
  const isAlreadyCompleted =
    candidate.status?.toLowerCase() === 'interviewed' ||
    candidate.rating !== null;

  if (isAlreadyCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl p-10 max-w-md mx-auto text-center border border-border bg-card shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Interview Completed
          </h1>
          <p className="text-muted-foreground mb-2">
            Thank you for your time, {candidate.full_name}.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Your response has been submitted to the recruiting team. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  // Go directly to VoiceAvatar (camera/mic check is handled inside)
  return (
    <VoiceAvatar
      candidateId={String(candidate.id)}
      candidateName={candidate.full_name}
      jobTitle={jobTitle}
      jobDescription={candidate.job_description || 'Software Engineer at Printerpix'}
      resumeText={candidate.resume_text || 'No resume provided'}
    />
  );
}
