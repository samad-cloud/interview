'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

// Inline re-declarations of the types needed (page.tsx does not export them)
interface FullVerdict {
  technicalScore: number;
  verdict: string;
  summary: string;
  technicalStrengths: string[];
  technicalGaps: string[];
  recommendation: string;
}

interface FullDossier {
  probeQuestions: { question: string; targetClaim: string; probeType: string }[];
  candidateStrengths: string[];
  areasToProbe: string[];
  overallAssessment: string;
}

interface Round3FullVerdict {
  round3Score: number;
  ultimateVerdict: string;
  executiveSummary: string;
  keyStrengths: string[];
  keyGaps: string[];
  redFlagsResolved: string[];
  remainingConcerns: string[];
  finalRecommendation: string;
}

interface PanelCandidate {
  id: number;
  full_name: string;
  email: string;
  rating: number | null;
  round_2_rating: number | null;
  status: string;
  job_title?: string;
  created_at: string | null;
  applied_at: string | null;
  video_url: string | null;
  round_2_video_url: string | null;
  round_3_recording_url: string | null;
  round_3_rating: number | null;
  round_3_transcript: string | null;
  round_3_full_verdict: Round3FullVerdict | null;
  full_verdict: FullVerdict | null;
  round_1_full_dossier: FullDossier | null;
  interview_transcript: string | null;
  round_2_transcript: string | null;
  hr_notes: string | null;
  final_verdict: string | null;
}

interface CandidatePanelProps {
  candidate: PanelCandidate | null;
  open: boolean;
  onClose: () => void;
  onInviteR2: (id: number) => void;
  onInviteR3: (id: number) => void;
  onReject: (candidate: PanelCandidate) => void;
  onSaveNote: (id: number, noteText: string) => void;
}

export function CandidatePanel({
  candidate,
  open,
  onClose,
  onInviteR2,
  onInviteR3,
  onReject,
  onSaveNote,
}: CandidatePanelProps) {
  // Escape key dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!candidate) return null;

  return (
    <>
      {/* Overlay — click-outside-to-close */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides from right */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-[640px] bg-[#0F172A] border-l border-[#1E293B] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label={candidate.full_name}
        aria-modal="true"
      >
        {/* Header — flex-shrink-0, populated in plan 02-02 */}
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#6366F1' }}
            >
              {candidate.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#F9FAFB]">{candidate.full_name}</p>
              <p className="text-[12px] text-[#94A3B8]">{candidate.job_title || 'No role specified'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#6B7280] hover:text-[#F9FAFB] hover:bg-[#1E293B] transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — flex-1 overflow-y-auto, sections added in 02-02 and 02-03 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <p className="text-[12px] text-[#6B7280]">Content sections — implemented in plans 02-02 and 02-03</p>
        </div>

        {/* Footer — flex-shrink-0, implemented in plan 02-04 */}
        <div className="px-5 py-3 border-t border-[#1E293B] flex gap-2 flex-shrink-0">
          <p className="text-[12px] text-[#6B7280]">Actions — implemented in plan 02-04</p>
        </div>
      </div>
    </>
  );
}
