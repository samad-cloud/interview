'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { WizardState } from '@/app/create-job/page';

// ─── Hiring bar presets ────────────────────────────────────────────────────────

const HIRING_PRESETS = [
  {
    id: 'growth' as const,
    label: 'Growth',
    threshold: 35,
    description: 'Cast a wide net — maximize candidate volume',
    color: '#10B981',
  },
  {
    id: 'standard' as const,
    label: 'Standard',
    threshold: 50,
    description: 'Balanced quality bar — recommended default',
    color: '#6366F1',
  },
  {
    id: 'high_bar' as const,
    label: 'High Bar',
    threshold: 75,
    description: 'Strong candidates only — senior or specialized roles',
    color: '#F59E0B',
  },
  {
    id: 'elite' as const,
    label: 'Elite',
    threshold: 90,
    description: 'Top 10% only — leadership or executive positions',
    color: '#EF4444',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepScoringProps {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onPrev: () => void;
  onPublish: () => Promise<void>;
  isPublishing: boolean;
  publishError: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepScoring(props: StepScoringProps) {
  const { state, onChange, onPrev, onPublish, isPublishing, publishError } = props;

  const canPublish = state.title.trim() !== '' && state.location.trim() !== '';

  const descriptionPreview = state.generatedDescription
    ? state.generatedDescription.trim().substring(0, 100) + (state.generatedDescription.length > 100 ? '…' : '')
    : '—';

  return (
    <div>
      {/* Step header */}
      <div className="mb-1" style={{ color: '#6366F1', fontSize: '13px', fontWeight: 500 }}>
        Step 6 of 6 — Scoring &amp; Publish
      </div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: '#F9FAFB' }}>
        Hiring Bar
      </h2>
      <p className="mb-6 text-sm" style={{ color: '#94A3B8' }}>
        Set the minimum score threshold for candidates to advance past AI screening.
      </p>

      {/* Preset cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {HIRING_PRESETS.map((preset) => {
          const isSelected = state.scoringPreset === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => onChange({ scoringPreset: preset.id })}
              className="rounded-xl border-2 cursor-pointer p-5 transition-colors bg-[#0F172A]"
              style={{ borderColor: isSelected ? preset.color : '#1E293B' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-base" style={{ color: '#F9FAFB' }}>
                  {preset.label}
                </span>
                <span className="text-lg font-bold" style={{ color: preset.color }}>
                  {preset.threshold}+
                </span>
              </div>
              <p className="text-sm" style={{ color: isSelected ? '#CBD5E1' : '#6B7280' }}>
                {preset.description}
              </p>
              {isSelected && (
                <div className="mt-3 text-xs font-medium" style={{ color: preset.color }}>
                  Selected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Job summary review */}
      <div className="rounded-lg p-4 mb-6" style={{ background: '#0F172A', border: '1px solid #1E293B' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#F9FAFB' }}>
          Job Summary
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt style={{ color: '#6B7280' }}>Title</dt>
          <dd style={{ color: '#F9FAFB' }}>{state.title || '—'}</dd>

          <dt style={{ color: '#6B7280' }}>Location</dt>
          <dd style={{ color: '#F9FAFB' }}>{state.location || '—'}</dd>

          <dt style={{ color: '#6B7280' }}>Rounds</dt>
          <dd style={{ color: '#F9FAFB' }}>{state.roundCount}</dd>

          <dt style={{ color: '#6B7280' }}>Description</dt>
          <dd style={{ color: '#F9FAFB' }}>{descriptionPreview}</dd>

          <dt style={{ color: '#6B7280' }}>Screening questions</dt>
          <dd style={{ color: '#F9FAFB' }}>{state.screeningQuestions.length}</dd>
        </dl>
      </div>

      {/* Publish error banner */}
      {publishError && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ border: '1px solid #EF4444', background: '#1A0A0A', color: '#FCA5A5' }}
        >
          {publishError}
        </div>
      )}

      {/* Validation warning */}
      {!canPublish && (
        <p className="text-xs mb-3" style={{ color: '#F59E0B' }}>
          Complete Step 1 (title and location required) before publishing.
        </p>
      )}

      {/* Navigation footer */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={onPrev}
          disabled={isPublishing}
          style={{ color: '#94A3B8' }}
        >
          ← Previous
        </Button>

        <Button
          onClick={onPublish}
          disabled={isPublishing || !canPublish}
          style={{ background: '#6366F1', color: '#FFFFFF' }}
          className="flex items-center gap-2"
        >
          {isPublishing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPublishing ? 'Publishing…' : 'Publish Job'}
        </Button>
      </div>
    </div>
  );
}
