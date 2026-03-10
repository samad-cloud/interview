'use client';

import React from 'react';

interface Stats {
  applied: number;
  passedCvFilter: number;
  invitedR1: number;
  completedR1: number;
  invitedR2: number;
  completedR2: number;
  successful: number;
}

interface FunnelRowProps {
  stats: Stats;
  activeStage: string;
  onStageClick: (stageFilter: string) => void;
}

interface FunnelStage {
  key: string;
  label: string;
  color: string;
  getStat: (s: Stats) => number;
  getPrev?: (s: Stats) => number;
}

const FUNNEL_STAGES: FunnelStage[] = [
  { key: 'all',     label: 'Applied',       color: '#818CF8', getStat: (s) => s.applied },
  { key: 'passed',  label: 'Passed CV',     color: '#60A5FA', getStat: (s) => s.passedCvFilter,  getPrev: (s) => s.applied },
  { key: 'r1inv',   label: 'Invited R1',    color: '#2DD4BF', getStat: (s) => s.invitedR1,       getPrev: (s) => s.passedCvFilter },
  { key: 'r1done',  label: 'Completed R1',  color: '#34D399', getStat: (s) => s.completedR1,     getPrev: (s) => s.invitedR1 },
  { key: 'r2inv',   label: 'Invited R2',    color: '#FCD34D', getStat: (s) => s.invitedR2,       getPrev: (s) => s.completedR1 },
  { key: 'r2done',  label: 'Completed R2',  color: '#FB923C', getStat: (s) => s.completedR2,     getPrev: (s) => s.invitedR2 },
  { key: 'success', label: 'Successful',    color: '#10B981', getStat: (s) => s.successful,      getPrev: (s) => s.completedR2 },
];

const FUNNEL_TO_STAGE_FILTER: Record<string, string> = {
  all:     'all',
  passed:  'all',
  r1inv:   'r1_pending',
  r1done:  'r1_done',
  r2inv:   'r2_pending',
  r2done:  'r2_pending',
  success: 'successful',
};

interface FunnelCardProps {
  label: string;
  color: string;
  count: number;
  conversionPct: number | null;
  isSelected: boolean;
  onClick: () => void;
}

function FunnelCard({ label, color, count, conversionPct, isSelected, onClick }: FunnelCardProps) {
  return (
    <button
      onClick={onClick}
      className={
        'relative flex-1 rounded-lg border p-3 text-left transition-colors cursor-pointer ' +
        (isSelected
          ? 'border-[#6366F1] bg-[rgba(99,102,241,0.06)]'
          : 'border-[#1E293B] bg-[#0F172A] hover:border-[#2D3F55] hover:bg-[#1A2332]')
      }
    >
      {conversionPct !== null && (
        <span
          className="absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: `${color}26`, color }}
        >
          {conversionPct}%
        </span>
      )}
      <div
        className="text-[22px] font-bold tabular-nums leading-tight"
        style={{ color }}
      >
        {count.toLocaleString()}
      </div>
      <div className="text-[10px] text-[#6B7280] mt-0.5 whitespace-nowrap">{label}</div>
    </button>
  );
}

export function FunnelRow({ stats, activeStage, onStageClick }: FunnelRowProps) {
  return (
    <div className="flex items-stretch gap-0">
      {FUNNEL_STAGES.map((stage, i) => {
        const count = stage.getStat(stats);
        const prev = stage.getPrev ? stage.getPrev(stats) : null;
        const conversionPct =
          prev !== null && prev > 0 ? Math.round((count / prev) * 100) : null;
        const stageFilter = FUNNEL_TO_STAGE_FILTER[stage.key];

        return (
          <React.Fragment key={stage.key}>
            {i > 0 && (
              <div className="flex items-center px-1.5 text-[#4B5563] text-sm flex-shrink-0">
                &rarr;
              </div>
            )}
            <FunnelCard
              label={stage.label}
              color={stage.color}
              count={count}
              conversionPct={conversionPct}
              isSelected={activeStage === stageFilter}
              onClick={() => onStageClick(stageFilter)}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
