'use client';

import { useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const HIRING_PRESETS = [
  { id: 'growth',   label: 'Growth',   threshold: 35, color: '#10B981', description: 'Entry-level and growth roles' },
  { id: 'standard', label: 'Standard', threshold: 50, color: '#6366F1', description: 'Standard professional roles' },
  { id: 'high_bar', label: 'High Bar', threshold: 75, color: '#F59E0B', description: 'Senior and specialist roles' },
  { id: 'elite',    label: 'Elite',    threshold: 90, color: '#EF4444', description: 'Executive and critical hires' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ScoringTab() {
  const [selectedPreset, setSelectedPreset] = useState('standard');
  const [roundCount, setRoundCount] = useState(2);
  const [thresholds, setThresholds] = useState([70, 75]);

  function handleRoundCountChange(n: number) {
    setRoundCount(n);
    setThresholds(prev => {
      if (n > prev.length) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => 70)];
      }
      return prev.slice(0, n);
    });
  }

  function handleThresholdChange(idx: number, value: number) {
    setThresholds(prev => prev.map((t, i) => i === idx ? value : t));
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Preset cards section */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Hiring Preset</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Select a hiring bar preset for this workspace. Affects how candidate scores are interpreted.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {HIRING_PRESETS.map(preset => (
            <div
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              style={{ borderColor: selectedPreset === preset.id ? preset.color : '#1E293B' }}
              className="cursor-pointer rounded-xl border-2 p-4 bg-[#0F172A] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: preset.color }}
                />
                <span className="font-semibold text-foreground text-sm">{preset.label}</span>
              </div>
              <div
                className="text-2xl font-bold"
                style={{ color: preset.color }}
              >
                {preset.threshold}+
              </div>
              <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-round threshold inputs */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Custom Round Thresholds</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Set the minimum score required to advance from each round.
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

        {/* Threshold inputs per round */}
        <div className="flex flex-col gap-3">
          {thresholds.map((threshold, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-16">Round {i + 1}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={e => handleThresholdChange(i, Number(e.target.value))}
                className="w-24 border border-border rounded-md bg-transparent px-3 py-1.5 text-sm text-foreground"
              />
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          ))}
        </div>
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
