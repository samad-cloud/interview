'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AvatarInterview from '@/components/AvatarInterview';
import { Loader2, AlertCircle, CheckCircle, Monitor } from 'lucide-react';
import type { Round3Dossier } from '@/app/actions/generateRound3Dossier';

// Detect mobile
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = navigator.maxTouchPoints > 1;
  const isSmallScreen = screen.width < 768;
  const hasMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return (hasTouch && isSmallScreen) || hasMobileUA;
}

interface CandidateData {
  id: number;
  full_name: string;
  job_id: number | null;
  job_description: string | null;
  resume_text: string | null;
  round_3_status: string | null;
  round_3_dossier: Round3Dossier | null;
}

export default function Round3Page() {
  const params = useParams();
  const token = params.token as string;

  const [isMobile] = useState<boolean>(() => detectMobile());
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [jobTitle, setJobTitle] = useState('Open Position');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) { setError('No interview token provided'); setIsLoading(false); return; }

      const { data, error: dbErr } = await supabase
        .from('candidates')
        .select('id, full_name, job_id, job_description, resume_text, round_3_status, round_3_dossier')
        .eq('round_3_token', token)
        .single();

      if (dbErr || !data) {
        setError('Interview link is invalid or expired');
        setIsLoading(false);
        return;
      }

      setCandidate(data);

      if (data.job_id) {
        const { data: job } = await supabase.from('jobs').select('title').eq('id', data.job_id).single();
        if (job?.title) setJobTitle(job.title);
      }

      setIsLoading(false);
    };
    load();
  }, [token]);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm mx-auto">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Desktop Required</h1>
          <p className="text-muted-foreground">
            This interview requires screen sharing and must be completed on a laptop or desktop computer.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Link Invalid</h1>
          <p className="text-muted-foreground">{error || 'This interview link is no longer valid.'}</p>
        </div>
      </div>
    );
  }

  if (candidate.round_3_status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl p-10 max-w-md mx-auto text-center border border-border bg-card shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Interview Complete</h1>
          <p className="text-muted-foreground mb-2">Thank you, {candidate.full_name}.</p>
          <p className="text-muted-foreground/70 text-sm">
            Your responses have been submitted. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AvatarInterview
      candidateId={String(candidate.id)}
      candidateName={candidate.full_name}
      jobTitle={jobTitle}
      jobDescription={candidate.job_description || ''}
      resumeText={candidate.resume_text || ''}
      dossier={candidate.round_3_dossier}
    />
  );
}
