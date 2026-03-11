'use client';

import { useEffect, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VideoPlayer from '@/components/VideoPlayer';

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

// ── RecordingCard — clickable card that toggles VideoPlayer inline ──
function RecordingCard({
  roundLabel,
  roundKey,
  videoUrl,
  activeRecording,
  onToggle,
}: {
  roundLabel: string;
  roundKey: 'r1' | 'r2' | 'r3';
  videoUrl: string | null;
  activeRecording: 'r1' | 'r2' | 'r3' | null;
  onToggle: (key: 'r1' | 'r2' | 'r3') => void;
}) {
  const isActive = activeRecording === roundKey;
  if (!videoUrl) return null;
  return (
    <button
      onClick={() => onToggle(roundKey)}
      className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-3 flex items-center gap-2.5 text-left w-full transition-colors hover:border-[#6366F1]/50"
      style={{ borderColor: isActive ? 'rgba(99,102,241,0.5)' : undefined }}
    >
      <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" style={{ color: '#6366F1' }} fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#F9FAFB]">{roundLabel}</p>
        <p className="text-[11px] text-[#6B7280]">{isActive ? 'Click to hide' : 'Click to play'}</p>
      </div>
    </button>
  );
}

// ── TranscriptAccordion — expandable transcript section ──
function TranscriptAccordion({
  label,
  transcript,
  isOpen,
  onToggle,
}: {
  label: string;
  transcript: string | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (!transcript) return null;
  return (
    <div className="bg-[#1A2332] border border-[#1E293B] rounded-lg overflow-hidden">
      <button
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-[12px] hover:bg-[#1E293B] transition-colors"
        onClick={onToggle}
      >
        <span className="text-[#F9FAFB] font-medium">{label}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-[#1E293B] text-[12px] text-[#94A3B8] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {transcript}
        </div>
      )}
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
  const [activeRecording, setActiveRecording] = useState<'r1' | 'r2' | 'r3' | null>(null);
  const [r1Open, setR1Open] = useState(false);
  const [r2Open, setR2Open] = useState(false);
  const [r3Open, setR3Open] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Escape key dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset recording, accordion, and note state when candidate changes
  useEffect(() => {
    setActiveRecording(null);
    setR1Open(false);
    setR2Open(false);
    setR3Open(false);
    setShowNote(false);
    setNoteText(candidate?.hr_notes || '');
  }, [candidate?.id]);

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

          {/* Recordings section */}
          {(candidate.video_url || candidate.round_2_video_url || candidate.round_3_recording_url) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Recordings</p>
              <div className="flex flex-col gap-2">
                <RecordingCard
                  roundLabel="Round 1 — Personality"
                  roundKey="r1"
                  videoUrl={candidate.video_url}
                  activeRecording={activeRecording}
                  onToggle={(key) => setActiveRecording(prev => prev === key ? null : key)}
                />
                <RecordingCard
                  roundLabel="Round 2 — Technical"
                  roundKey="r2"
                  videoUrl={candidate.round_2_video_url}
                  activeRecording={activeRecording}
                  onToggle={(key) => setActiveRecording(prev => prev === key ? null : key)}
                />
                {candidate.round_3_recording_url && (
                  <RecordingCard
                    roundLabel="Round 3 — Deep Dive"
                    roundKey="r3"
                    videoUrl={candidate.round_3_recording_url}
                    activeRecording={activeRecording}
                    onToggle={(key) => setActiveRecording(prev => prev === key ? null : key)}
                  />
                )}
                {/* Inline player — renders below cards when a recording is active */}
                {activeRecording && (
                  <VideoPlayer
                    src={
                      activeRecording === 'r1' ? candidate.video_url! :
                      activeRecording === 'r2' ? candidate.round_2_video_url! :
                      candidate.round_3_recording_url!
                    }
                    title={
                      activeRecording === 'r1' ? 'Round 1 — Personality' :
                      activeRecording === 'r2' ? 'Round 2 — Technical' :
                      'Round 3 — Deep Dive'
                    }
                    className="mt-2 rounded-[10px] overflow-hidden"
                  />
                )}
              </div>
            </div>
          )}

          {/* Transcript accordions */}
          {(candidate.interview_transcript || candidate.round_2_transcript || candidate.round_3_transcript) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">Transcripts</p>
              <div className="flex flex-col gap-2">
                <TranscriptAccordion
                  label="Round 1 — Personality Interview"
                  transcript={candidate.interview_transcript}
                  isOpen={r1Open}
                  onToggle={() => setR1Open(p => !p)}
                />
                <TranscriptAccordion
                  label="Round 2 — Technical Interview"
                  transcript={candidate.round_2_transcript}
                  isOpen={r2Open}
                  onToggle={() => setR2Open(p => !p)}
                />
                <TranscriptAccordion
                  label="Round 3 — Deep Dive Interview"
                  transcript={candidate.round_3_transcript}
                  isOpen={r3Open}
                  onToggle={() => setR3Open(p => !p)}
                />
              </div>
            </div>
          )}

          {/* Add Note inline textarea — shown when showNote is true */}
          {showNote && (
            <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">HR Notes</p>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add notes about this candidate..."
                rows={4}
                className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-[12px] text-[#F9FAFB] placeholder:text-[#6B7280] resize-none focus:outline-none focus:border-[#6366F1] transition-colors"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  disabled={savingNote || noteText === (candidate?.hr_notes || '')}
                  onClick={async () => {
                    setSavingNote(true);
                    await onSaveNote(candidate!.id, noteText);
                    setSavingNote(false);
                  }}
                  className="h-[28px] text-[11px] bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                >
                  {savingNote ? 'Saving…' : 'Save Note'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNote(false)}
                  className="h-[28px] text-[11px] text-[#6B7280]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

        </div>

        {/* Footer — pinned action bar with Invite/Reject/Add Note */}
        <div className="px-5 py-3 border-t border-[#1E293B] flex gap-2 flex-shrink-0 flex-wrap">
          {/* Primary action: Invite to R2 or R3 depending on candidate stage */}
          {!candidate.round_2_rating ? (
            <Button
              size="sm"
              title="Invite to Round 2"
              onClick={() => { onInviteR2(candidate.id); onClose(); }}
              className="h-[34px] text-[12px] bg-[#6366F1] hover:bg-[#4F46E5] text-white"
            >
              Invite to R2
            </Button>
          ) : !candidate.round_3_rating ? (
            <Button
              size="sm"
              title="Invite to Round 3"
              onClick={() => { onInviteR3(candidate.id); onClose(); }}
              className="h-[34px] text-[12px] bg-[#6366F1] hover:bg-[#4F46E5] text-white"
            >
              Invite to R3
            </Button>
          ) : null}

          {/* Reject button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { onReject(candidate); onClose(); }}
            className="h-[34px] text-[12px] border-[#EF4444] text-[#EF4444] hover:bg-red-500/10"
          >
            Reject
          </Button>

          {/* Add Note toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNote(p => !p)}
            className="h-[34px] text-[12px] border-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B]"
          >
            {showNote ? 'Hide Note' : 'Add Note'}
          </Button>
        </div>
      </div>
    </>
  );
}
