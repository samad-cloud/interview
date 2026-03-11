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

// ── Avatar helpers (copied from CandidateTableRow.tsx — not imported to avoid coupling) ──
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #14B8A6, #0891B2)',
  'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  'linear-gradient(135deg, #F59E0B, #D97706)',
  'linear-gradient(135deg, #EF4444, #DC2626)',
  'linear-gradient(135deg, #06B6D4, #0891B2)',
  'linear-gradient(135deg, #10B981, #059669)',
  'linear-gradient(135deg, #F472B6, #DB2777)',
  'linear-gradient(135deg, #FB923C, #EA580C)',
  'linear-gradient(135deg, #34D399, #10B981)',
  'linear-gradient(135deg, #A78BFA, #7C3AED)',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ── Stage badge — inline (getStageDisplay not exported from page.tsx) ──
function getStageBadge(status: string): { label: string; color: string; bg: string } {
  const s = status?.toUpperCase() || '';
  if (s === 'COMPLETED') return { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.1)' };
  if (s === 'HIRED') return { label: 'Hired', color: '#10B981', bg: 'rgba(16,185,129,0.1)' };
  if (s === 'REJECTED' || s === 'CV_REJECTED' || s === 'REJECTED_VISA') return { label: 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' };
  if (s === 'INTERVIEW_STARTED') return { label: 'Interviewing', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' };
  if (s === 'INVITE_SENT') return { label: 'Invite Sent', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' };
  if (s === 'GRADED') return { label: 'Graded', color: '#FCD34D', bg: 'rgba(252,211,77,0.1)' };
  if (s === 'FORM_COMPLETED') return { label: 'Form Done', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' };
  if (s === 'QUESTIONNAIRE_SENT') return { label: 'Questionnaire', color: '#FCD34D', bg: 'rgba(252,211,77,0.1)' };
  return { label: status || 'New', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };
}

// ── ScoreGauge — SVG ring chart, r=30, circumference=188.5 ──
function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  const r = 30;
  const circ = 2 * Math.PI * r; // 188.5
  const offset = score !== null ? circ - (score / 100) * circ : circ;
  const stroke = score === null ? '#1E293B' : score >= 70 ? '#10B981' : score >= 50 ? '#FCD34D' : '#EF4444';
  const passing = score !== null && score >= 70;
  return (
    <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-4 flex flex-col items-center gap-2.5 flex-1">
      <div className="text-[12px] font-semibold text-[#F9FAFB] text-center">{label}</div>
      <div className="relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1E293B" strokeWidth="6" />
          {score !== null && (
            <circle
              cx="36" cy="36" r={r} fill="none" stroke={stroke} strokeWidth="6"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-[#F9FAFB]">
          {score ?? '—'}
        </div>
      </div>
      <div
        className="text-[11px]"
        style={{ color: score === null ? '#6B7280' : passing ? '#10B981' : '#EF4444' }}
      >
        {score === null ? 'Pending' : passing ? '✓ Passed' : '✗ Below threshold'}
      </div>
    </div>
  );
}

// ── VerdictBanner — tier-colored left border + AI summary ──
const VERDICT_COLORS: Record<string, string> = {
  'Strong Hire': '#818CF8',
  'Hire': '#60A5FA',
  'Borderline': '#FCD34D',
  'No Hire': '#EF4444',
  'Hired': '#10B981',
  'Rejected': '#EF4444',
};

function VerdictBanner({ verdict, summary }: { verdict: string; summary: string }) {
  const color = VERDICT_COLORS[verdict] ?? '#818CF8';
  return (
    <div
      className="rounded-[10px] p-[14px_16px]"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.08))',
        border: '1px solid rgba(99,102,241,0.3)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="text-[14px] font-bold mb-1.5" style={{ color }}>
        {verdict}
      </div>
      <p className="text-[12px] text-[#D1D5DB] leading-relaxed">{summary}</p>
    </div>
  );
}

// ── Strengths/Gaps helper — reads from full_verdict with fallback to round_1_full_dossier ──
function getStrengthsAndGaps(candidate: PanelCandidate): { strengths: string[]; gaps: string[] } {
  const strengths = candidate.full_verdict?.technicalStrengths
    ?? candidate.round_1_full_dossier?.candidateStrengths
    ?? [];
  const gaps = candidate.full_verdict?.technicalGaps
    ?? candidate.round_1_full_dossier?.areasToProbe
    ?? [];
  return { strengths, gaps };
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

  const badge = getStageBadge(candidate.status);

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
        {/* Header — gradient avatar + name + role + applied date + stage badge */}
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between flex-shrink-0">
          {/* Left: avatar + meta */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
              style={{ background: getAvatarGradient(candidate.full_name) }}
            >
              {getInitials(candidate.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#F9FAFB] truncate">{candidate.full_name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[12px] text-[#94A3B8]">{candidate.job_title || 'No role'}</span>
                {(candidate.applied_at || candidate.created_at) && (
                  <>
                    <span style={{ color: '#1E293B' }}>·</span>
                    <span className="text-[12px] text-[#6B7280]">
                      Applied {new Date(candidate.applied_at || candidate.created_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </>
                )}
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: badge.color, backgroundColor: badge.bg }}
                >
                  {badge.label}
                </span>
              </div>
            </div>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#6B7280] hover:text-[#F9FAFB] hover:bg-[#1E293B] transition-colors flex-shrink-0"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — flex-1 overflow-y-auto */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Interview Scores — R1 and R2 SVG ring charts side by side */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Interview Scores</p>
            <div className="flex gap-3">
              <ScoreGauge label="Round 1 — Personality" score={candidate.rating} />
              <ScoreGauge label="Round 2 — Technical" score={candidate.round_2_rating} />
              {candidate.round_3_rating !== null && candidate.round_3_rating !== undefined && (
                <ScoreGauge label="Round 3 — Deep Dive" score={candidate.round_3_rating} />
              )}
            </div>
          </div>

          {/* Final Verdict banner — only when verdict data exists */}
          {(candidate.full_verdict?.verdict || candidate.final_verdict) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Final Verdict</p>
              <VerdictBanner
                verdict={candidate.full_verdict?.verdict ?? candidate.final_verdict ?? ''}
                summary={candidate.full_verdict?.summary ?? ''}
              />
            </div>
          )}

          {/* Strengths and Gaps — two-column grid, hidden when both arrays empty */}
          {(() => {
            const { strengths, gaps } = getStrengthsAndGaps(candidate);
            if (strengths.length === 0 && gaps.length === 0) return null;
            return (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Analysis</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#10B981' }}>Strengths</p>
                    {strengths.length > 0 ? strengths.map((s, i) => (
                      <div key={i} className="text-[12px] text-[#D1D5DB] py-1 flex items-start gap-1.5">
                        <span style={{ color: '#10B981' }}>✓</span><span>{s}</span>
                      </div>
                    )) : <p className="text-[12px] text-[#6B7280]">No strengths data yet.</p>}
                  </div>
                  <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#EF4444' }}>Gaps</p>
                    {gaps.length > 0 ? gaps.map((g, i) => (
                      <div key={i} className="text-[12px] text-[#D1D5DB] py-1 flex items-start gap-1.5">
                        <span style={{ color: '#EF4444' }}>✗</span><span>{g}</span>
                      </div>
                    )) : <p className="text-[12px] text-[#6B7280]">No gaps data yet.</p>}
                  </div>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Footer — flex-shrink-0, implemented in plan 02-04 */}
        <div className="px-5 py-3 border-t border-[#1E293B] flex gap-2 flex-shrink-0">
          <p className="text-[12px] text-[#6B7280]">Actions — implemented in plan 02-04</p>
        </div>
      </div>
    </>
  );
}
