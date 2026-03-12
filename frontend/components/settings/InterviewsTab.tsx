'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { RoundConfig } from '@/app/create-job/page';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultRound(index: number): RoundConfig {
  const defaults = [
    { interviewer: 'Wayne', theme: 'General',   voice: 'Wayne' },
    { interviewer: 'Atlas', theme: 'Technical', voice: 'Atlas' },
    { interviewer: 'Nova',  theme: 'Cultural',  voice: 'Nova'  },
  ];
  const d = defaults[index] ?? defaults[0];
  return { roundNumber: index + 1, theme: d.theme, duration: 30, voice: d.voice, avatarEnabled: true };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InterviewsTab() {
  const [roundCount, setRoundCount] = useState(2);
  const [rounds, setRounds] = useState<RoundConfig[]>([
    getDefaultRound(0),
    getDefaultRound(1),
  ]);

  function handleRoundCountChange(n: number) {
    setRoundCount(n);
    setRounds(prev => {
      if (n > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: n - prev.length }, (_, i) => getDefaultRound(prev.length + i)),
        ];
      }
      return prev.slice(0, n);
    });
  }

  function handleRoundChange(idx: number, field: keyof RoundConfig, value: string | number | boolean) {
    setRounds(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Section header */}
      <div>
        <h2 className="text-base font-semibold text-foreground">Default Interview Configuration</h2>
        <p className="text-xs text-muted-foreground mt-1">
          These defaults pre-populate new jobs. Override per-job in the Create Job wizard.
        </p>
      </div>

      {/* Round count selector */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Number of Rounds</span>
        <div className="flex gap-2">
          {[1, 2, 3].map(n => (
            n === roundCount ? (
              <button
                key={n}
                onClick={() => handleRoundCountChange(n)}
                style={{ backgroundColor: '#6366F120', borderColor: '#6366F1' }}
                className="border rounded-lg px-5 py-2 text-sm font-medium text-indigo-400 transition-colors"
              >
                {n}
              </button>
            ) : (
              <button
                key={n}
                onClick={() => handleRoundCountChange(n)}
                className="border border-border rounded-lg px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {n}
              </button>
            )
          ))}
        </div>
      </div>

      {/* Per-round config rows */}
      <div className="flex flex-col gap-4">
        {rounds.map((round, idx) => (
          <div
            key={round.roundNumber}
            className="rounded-lg border border-border bg-[#0F172A] p-4"
          >
            <p className="text-sm font-semibold text-foreground mb-4">Round {round.roundNumber}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
              {/* Theme */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Theme</label>
                <Select
                  value={round.theme}
                  onValueChange={val => handleRoundChange(idx, 'theme', val)}
                >
                  <SelectTrigger className="h-8 text-xs border-border bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Cultural">Cultural</SelectItem>
                    <SelectItem value="Behavioural">Behavioural</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Duration</label>
                <Select
                  value={String(round.duration)}
                  onValueChange={val => handleRoundChange(idx, 'duration', Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs border-border bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60].map(d => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Voice</label>
                <Select
                  value={round.voice}
                  onValueChange={val => handleRoundChange(idx, 'voice', val)}
                >
                  <SelectTrigger className="h-8 text-xs border-border bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Wayne">Wayne</SelectItem>
                    <SelectItem value="Atlas">Atlas</SelectItem>
                    <SelectItem value="Nova">Nova</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Avatar toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Avatar</label>
                <div className="flex items-center h-8">
                  <Switch
                    checked={round.avatarEnabled}
                    onCheckedChange={val => handleRoundChange(idx, 'avatarEnabled', val)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div>
        <button
          onClick={() => {}}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
