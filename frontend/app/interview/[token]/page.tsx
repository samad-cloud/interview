'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import VoiceAvatar from '@/components/VoiceAvatar';
import { Loader2, AlertCircle, CheckCircle, ArrowRight, Mic, MessageSquare, UserCheck, Clock } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

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
  const [hasStarted, setHasStarted] = useState(false);

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

  // Started - Render Voice Interview
  if (hasStarted) {
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

  // Landing Page
  const firstName = candidate.full_name?.split(' ')[0] || candidate.full_name;

  const steps = [
    {
      icon: Mic,
      title: 'Speak naturally',
      description: 'Our AI interviewer will ask you questions — just talk like you would in a normal conversation.',
    },
    {
      icon: Clock,
      title: '15–20 minutes',
      description: 'The session is brief and focused. Take your time with each answer.',
    },
    {
      icon: MessageSquare,
      title: 'Submit when ready',
      description: 'Click "Done Speaking" after each answer. Each response is final, so share all the details you\'d like.',
    },
    {
      icon: UserCheck,
      title: 'Human reviewed',
      description: 'Our HR team personally reviews every response to get to know the person behind the resume.',
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-background to-background" />

      <div className="max-w-2xl w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <Image
            src="/logo.jpg"
            alt="Printerpix"
            width={56}
            height={56}
            className="rounded-xl mx-auto mb-4 ring-2 ring-emerald-500/20 ring-offset-2 ring-offset-background"
          />
          <p className="text-emerald-400 text-sm font-medium tracking-wide uppercase mb-3">
            Printerpix Recruiting
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2">
            Welcome, <span className="text-emerald-400">{firstName}</span>!
          </h1>
          <p className="text-muted-foreground">
            Round 1: Personality & Drive Interview
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-xl shadow-black/20 p-8 sm:p-10">
          <p className="text-muted-foreground text-base leading-relaxed mb-8">
            We&apos;re excited to hear your story. This AI-powered conversation is your opportunity to share your experiences with the Printerpix team in a comfortable, pressure-free setting.
          </p>

          {/* Numbered Steps */}
          <h2 className="text-foreground font-semibold text-base mb-4">
            How it works
          </h2>
          <div className="space-y-4 mb-8">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <step.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="pt-0.5">
                  <p className="text-foreground font-medium text-sm">{step.title}</p>
                  <p className="text-muted-foreground text-sm mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Encouragement */}
          <p className="text-muted-foreground text-base leading-relaxed mb-8">
            Take a deep breath and be yourself &mdash; you&apos;ve got this. Good luck!
          </p>

          {/* CTA Button */}
          <Button
            onClick={() => setHasStarted(true)}
            size="lg"
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
          >
            Start Interview
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          {/* Support */}
          <p className="text-center text-muted-foreground/70 text-xs mt-5">
            Having trouble? Contact{' '}
            <a
              href="mailto:printerpix.recruitment@gmail.com"
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              printerpix.recruitment@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
