'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { WizardState, RoundConfig } from '@/app/create-job/page';

// ─── Constants ────────────────────────────────────────────────────────────────

const THEMES = ['Personality & Culture', 'Technical Assessment', 'Leadership & Strategy'];
const DURATIONS = [15, 20, 30, 45, 60];
const VOICES = ['Wayne (Friendly)', 'Atlas (Technical)', 'Nova (Neutral)'];

function getDefaultRound(roundNumber: number): RoundConfig {
  const voices = ['Wayne (Friendly)', 'Atlas (Technical)', 'Nova (Neutral)'];
  const themes = ['Personality & Culture', 'Technical Assessment', 'Leadership & Strategy'];
  return {
    roundNumber,
    theme: themes[(roundNumber - 1) % themes.length],
    duration: 30,
    voice: voices[(roundNumber - 1) % voices.length],
    avatarEnabled: false,
  };
}

// ─── Internal Components ───────────────────────────────────────────────────────

function RoundConfigRow({
  round,
  index,
  onChange,
}: {
  round: RoundConfig;
  index: number;
  onChange: (u: Partial<RoundConfig>) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border border-[#1E293B] bg-[#0F172A]">
      <span className="text-sm font-medium shrink-0 w-16" style={{ color: '#94A3B8' }}>
        Round {round.roundNumber}
      </span>
      <div className="flex-1">
        <Select value={round.theme} onValueChange={(v) => onChange({ theme: v })}>
          <SelectTrigger className="bg-[#020617] border-[#1E293B] text-[#F9FAFB] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-28">
        <Select
          value={String(round.duration)}
          onValueChange={(v) => onChange({ duration: Number(v) })}
        >
          <SelectTrigger className="bg-[#020617] border-[#1E293B] text-[#F9FAFB] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <Select value={round.voice} onValueChange={(v) => onChange({ voice: v })}>
          <SelectTrigger className="bg-[#020617] border-[#1E293B] text-[#F9FAFB] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOICES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <span className="text-xs" style={{ color: '#6B7280' }}>
          Avatar
        </span>
        <Switch
          checked={round.avatarEnabled}
          onCheckedChange={(v) => onChange({ avatarEnabled: v })}
        />
      </div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface StepInterviewConfigProps {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function StepInterviewConfig({ state, onChange, onNext, onPrev }: StepInterviewConfigProps) {
  function handleRoundCountChange(newCount: 1 | 2 | 3) {
    const current = state.rounds;
    let updated: RoundConfig[];
    if (newCount > current.length) {
      updated = [
        ...current,
        ...Array.from({ length: newCount - current.length }, (_, i) =>
          getDefaultRound(current.length + i + 1)
        ),
      ];
    } else {
      updated = current.slice(0, newCount);
    }
    onChange({ roundCount: newCount, rounds: updated });
  }

  function handleRoundChange(index: number, updates: Partial<RoundConfig>) {
    const updated = state.rounds.map((r, i) => (i === index ? { ...r, ...updates } : r));
    onChange({ rounds: updated });
  }

  return (
    <div>
      {/* Step header */}
      <p className="text-xs font-medium mb-1" style={{ color: '#6366F1' }}>
        Step 4 of 6 — Interview Config
      </p>
      <h2 className="text-2xl font-semibold mb-6" style={{ color: '#F9FAFB' }}>
        Round Setup
      </h2>

      {/* Round count selector */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-3" style={{ color: '#94A3B8' }}>
          Number of Interview Rounds
        </p>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              onClick={() => handleRoundCountChange(n)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-0"
              style={
                state.roundCount === n
                  ? { background: '#6366F1', color: '#fff' }
                  : { background: '#1E293B', color: '#94A3B8' }
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Round config rows */}
      <div className="flex flex-col gap-3 mb-4">
        {state.rounds.slice(0, state.roundCount).map((round, i) => (
          <RoundConfigRow
            key={round.roundNumber}
            round={round}
            index={i}
            onChange={(u) => handleRoundChange(i, u)}
          />
        ))}
      </div>

      {/* Info note */}
      <p className="text-xs mb-8" style={{ color: '#6B7280' }}>
        Round config is saved with the job. Backend wiring (applying per-job config to interview
        pages) is coming in v2.1.
      </p>

      {/* Navigation footer */}
      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-0"
          style={{ background: '#1E293B', color: '#94A3B8' }}
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-0"
          style={{ background: '#6366F1', color: '#fff' }}
        >
          Next: Screening →
        </button>
      </div>
    </div>
  );
}
