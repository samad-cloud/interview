'use client';

import { TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Send, X } from 'lucide-react';

// Minimal subset of Candidate used by this component
export interface CandidateRow {
  id: number;
  full_name: string;
  email: string;
  job_title?: string;
  jd_match_score: number | null;
  rating: number | null;
  round_2_rating: number | null;
  status: string;
  applied_at: string | null;
  created_at: string | null;
}

interface CandidateTableRowProps {
  candidate: CandidateRow;
  onView: (c: CandidateRow) => void;
  onInvite: (e: React.MouseEvent, c: CandidateRow) => void;
  onReject: (e: React.MouseEvent, c: CandidateRow) => void;
}

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

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[11px] text-[#4B5563]">—</span>;
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#FCD34D' : '#EF4444';
  return (
    <div className="flex items-center gap-1">
      <div className="w-12 h-1 bg-[#1E293B] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getStageBadge(status: string): { label: string; colorClass: string } {
  switch (status) {
    case 'CV_REJECTED':
      return { label: 'CV Rejected', colorClass: 'bg-red-900/40 text-red-400 border border-red-800' };
    case 'INVITE_SENT':
    case 'INTERVIEW_STARTED':
    case 'FORM_COMPLETED':
      return { label: 'R1 Pending', colorClass: 'bg-blue-900/40 text-blue-400 border border-blue-800' };
    case 'ROUND_2_APPROVED':
    case 'ROUND_2_INVITED':
      return { label: 'R2 Pending', colorClass: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800' };
    case 'COMPLETED':
      return { label: 'Completed', colorClass: 'bg-emerald-900/40 text-emerald-400 border border-emerald-800' };
    default:
      return { label: status.replace(/_/g, ' '), colorClass: 'bg-slate-800 text-slate-400 border border-slate-700' };
  }
}

export function CandidateTableRow({ candidate, onView, onInvite, onReject }: CandidateTableRowProps) {
  const initials = getInitials(candidate.full_name);
  const gradient = getAvatarGradient(candidate.full_name);
  const badge = getStageBadge(candidate.status);
  const displayDate = formatDate(candidate.applied_at ?? candidate.created_at);

  return (
    <TableRow
      className="group/row cursor-pointer hover:bg-[#1A2332] transition-colors duration-100 border-b border-[#1E293B]"
      onClick={() => onView(candidate)}
    >
      {/* Avatar + Name + Email */}
      <TableCell className="py-2.5 pl-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: gradient }}
          >
            {initials}
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#E2E8F0]">{candidate.full_name}</div>
            <div className="text-[11px] text-[#6B7280]">{candidate.email}</div>
          </div>
        </div>
      </TableCell>

      {/* Role */}
      <TableCell className="py-2.5 text-[12px] text-[#94A3B8]">
        {candidate.job_title ?? '—'}
      </TableCell>

      {/* Applied date */}
      <TableCell className="py-2.5 text-[12px] text-[#6B7280] whitespace-nowrap">
        {displayDate}
      </TableCell>

      {/* CV Score */}
      <TableCell className="py-2.5">
        <ScoreBar score={candidate.jd_match_score} />
      </TableCell>

      {/* R1 Score */}
      <TableCell className="py-2.5">
        <ScoreBar score={candidate.rating} />
      </TableCell>

      {/* R2 Score */}
      <TableCell className="py-2.5">
        <ScoreBar score={candidate.round_2_rating} />
      </TableCell>

      {/* Stage badge */}
      <TableCell className="py-2.5">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badge.colorClass}`}>
          {badge.label}
        </span>
      </TableCell>

      {/* Hover actions — fixed width, no layout shift */}
      <TableCell className="py-2.5 w-24 pr-3">
        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-100">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-[26px] h-[26px] rounded-md border border-[#1E293B] bg-[#1A2332] flex items-center justify-center text-[#818CF8] hover:border-[#6366F1] transition-colors"
                  onClick={(e) => { e.stopPropagation(); onView(candidate); }}
                  aria-label="View candidate"
                >
                  <Eye className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-[26px] h-[26px] rounded-md border border-[#1E293B] bg-[#1A2332] flex items-center justify-center text-[#2DD4BF] hover:border-[#2DD4BF] transition-colors"
                  onClick={(e) => { e.stopPropagation(); onInvite(e, candidate); }}
                  aria-label="Invite candidate"
                >
                  <Send className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Invite</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-[26px] h-[26px] rounded-md border border-[#1E293B] bg-[#1A2332] flex items-center justify-center text-[#EF4444] hover:border-[#EF4444] transition-colors"
                  onClick={(e) => { e.stopPropagation(); onReject(e, candidate); }}
                  aria-label="Reject candidate"
                >
                  <X className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reject</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}
