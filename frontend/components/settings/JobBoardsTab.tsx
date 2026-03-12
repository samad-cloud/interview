'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_BOARDS = [
  { id: 'linkedin',  name: 'LinkedIn',  subtitle: 'Professional network',   color: '#0077B5' },
  { id: 'indeed',    name: 'Indeed',    subtitle: 'Job search engine',       color: '#2164F3' },
  { id: 'glassdoor', name: 'Glassdoor', subtitle: 'Company reviews & jobs',  color: '#0CAA41' },
  { id: 'bayt',      name: 'Bayt.com',  subtitle: 'MENA job platform',       color: '#E8453C' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function JobBoardsTab() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    linkedin: false,
    indeed: false,
    glassdoor: false,
    bayt: false,
  });

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Section header */}
      <div>
        <h2 className="text-base font-semibold text-foreground">Job Board Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your job boards to automatically sync listings. OAuth integration coming in v2.1.
        </p>
      </div>

      {/* Platform cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {JOB_BOARDS.map((board) => (
          <div
            key={board.id}
            className="flex items-center justify-between p-5 rounded-xl border border-border bg-[#0F172A]"
          >
            <div className="flex items-center gap-4">
              {/* Coloured initial/logo block */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: board.color }}
              >
                {board.name[0]}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{board.name}</div>
                <div className="text-xs text-muted-foreground">{board.subtitle}</div>
                {/* Status label */}
                <div
                  className={`text-xs mt-0.5 ${
                    enabled[board.id] ? 'text-emerald-400' : 'text-muted-foreground'
                  }`}
                >
                  {enabled[board.id] ? 'Enabled' : 'Not Connected'}
                </div>
              </div>
            </div>
            <Switch
              checked={enabled[board.id]}
              onCheckedChange={(val) =>
                setEnabled((prev) => ({ ...prev, [board.id]: val }))
              }
              aria-label={`Toggle ${board.name} integration`}
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Enabling a board will not automatically post jobs until OAuth is configured in v2.1.
      </p>
    </div>
  );
}
