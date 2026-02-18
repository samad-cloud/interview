'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import VoiceAvatar from '@/components/VoiceAvatar';
import { Loader2, AlertCircle, CheckCircle, ArrowRight, MessageSquare, Clock, Users, ChevronRight } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading interview...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Interview Link Invalid
          </h1>
          <p className="text-slate-400 mb-6">
            {error || 'This interview link is no longer valid. Please contact the recruiter for a new link.'}
          </p>
          <a
            href="https://printerpix.com"
            className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl p-10 max-w-md mx-auto text-center border border-slate-800 shadow-2xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Interview Completed
          </h1>
          <p className="text-slate-400 mb-2">
            Thank you for your time, {candidate.full_name}.
          </p>
          <p className="text-slate-500 text-sm">
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
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">
            Printerpix Recruiting
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready for a different kind of interview?
          </h1>
        </div>

        {/* Content Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-8 sm:p-10">
          <p className="text-slate-300 text-base leading-relaxed mb-4">
            At Printerpix, we&apos;re pioneering a better hiring process. To make our first conversation faster, fairer, and more focused on you, we use an AI assistant. This approach helps remove unconscious bias and allows you to interview in a low-pressure environment, at a time that suits your energy and schedule.
          </p>
          <p className="text-slate-300 text-base leading-relaxed mb-6">
            As one of the first companies to use this technology, we&apos;re excited to have you be a part of this new way of hiring. It&apos;s still in early development, so think of it as a helpful tool rather than a formal interrogator. Your experience will provide valuable feedback as we continue to improve.
          </p>

          {/* Key Feature */}
          <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700/50">
            <h2 className="text-white font-semibold text-base mb-2">
              Your Interview, Your Pace
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              This conversation is designed for you to feel comfortable and focused. Once the interviewer finishes asking a question, feel free to take a second and collect your thoughts before you begin speaking. When you are satisfied with your response, simply click the &quot;Done Speaking&quot; button to submit it and move to the next question. Since each answer is final once submitted, please ensure you&apos;ve shared all the details you&apos;d like the team to hear.
            </p>
          </div>

          {/* What to Expect */}
          <h2 className="text-white font-semibold text-base mb-3">
            What to expect:
          </h2>
          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                The interview has a fixed number of questions and typically takes 15&ndash;20 minutes.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                We&apos;ll ask about your experience and how you&apos;ve handled specific situations.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                Every response is personally reviewed by our HR team. The AI helps us conduct the conversation, but real people evaluate your answers.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ChevronRight className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-slate-300 text-sm leading-relaxed">
                If you complete this stage successfully, a member of our team will be in touch for a follow-up conversation.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => setHasStarted(true)}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-lg py-4 rounded-xl transition-colors cursor-pointer"
          >
            Begin Interview
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Support */}
          <p className="text-center text-slate-500 text-xs mt-5">
            Having trouble? Contact{' '}
            <a
              href="mailto:printerpix-recruitment@gmail.com"
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              printerpix-recruitment@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
