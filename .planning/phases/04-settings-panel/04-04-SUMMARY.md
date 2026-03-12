---
phase: 04-settings-panel
plan: "04"
subsystem: settings-ui
tags: [settings, interviews-tab, scoring-tab, ui-shell]
dependency_graph:
  requires: [04-01]
  provides: [InterviewsTab, ScoringTab]
  affects: [frontend/app/settings/page.tsx]
tech_stack:
  added: []
  patterns: [inline-style-hex-colors, local-useState-only, named-exports]
key_files:
  created:
    - frontend/components/settings/InterviewsTab.tsx
    - frontend/components/settings/ScoringTab.tsx
  modified:
    - frontend/app/settings/page.tsx
decisions:
  - InterviewsTab uses roundNumber field (not round) to match RoundConfig interface from create-job/page.tsx
  - getDefaultRound returns Wayne/Atlas/Nova themed defaults by index (identical pattern to StepInterviewConfig)
  - All hex colour values use inline style props — no dynamic Tailwind class interpolation (Tailwind v4 purge-safe)
  - ScoringTab thresholds array syncs length to roundCount via extend-with-70 or trim
  - Save buttons are UI-only stubs (onClick does nothing) — no Supabase writes
metrics:
  duration: "~8 minutes"
  completed: "2026-03-12"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 04: Interviews Tab and Scoring Tab Summary

**One-liner:** InterviewsTab with round count selector + per-round config rows, ScoringTab with four coloured preset cards + per-round threshold inputs — adapting Phase 3 wizard patterns into standalone settings tab containers.

## What Was Built

### InterviewsTab (`frontend/components/settings/InterviewsTab.tsx`)

- Round count selector: three buttons (1, 2, 3) with active state via `style={{ backgroundColor: '#6366F120', borderColor: '#6366F1' }}`
- Per-round config rows: each row in a dark `#0F172A` card with theme, duration, voice Select components and an Avatar Switch toggle
- `getDefaultRound(index)` helper provides Wayne/Atlas/Nova themed defaults
- `handleRoundCountChange(n)` extends or trims the rounds array, filling gaps with `getDefaultRound`
- No Supabase — all state is local `useState`

### ScoringTab (`frontend/components/settings/ScoringTab.tsx`)

- Four `HIRING_PRESETS` cards (Growth/Standard/High Bar/Elite) in a 2-col / 4-col responsive grid
- Selected card highlighted with `style={{ borderColor: preset.color }}` — unselected uses `#1E293B`
- Coloured dot, label, threshold percentage, and description in each card
- Round count selector (1/2/3 buttons) with identical active state pattern
- Per-round threshold `<input type="number">` inputs; array syncs to round count
- No Supabase — all state is local `useState`

### Settings page wiring (`frontend/app/settings/page.tsx`)

- Added `InterviewsTab` and `ScoringTab` named imports
- Replaced Interviews and Scoring `TabsContent` placeholder divs with `<InterviewsTab />` and `<ScoringTab />`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `roundNumber` field instead of `round`**
- **Found during:** Task 1
- **Issue:** Plan's `getDefaultRound` example used `round: index + 1`, but the actual `RoundConfig` interface exported from `@/app/create-job/page` uses `roundNumber: number`. Using `round` would cause a TypeScript error.
- **Fix:** Changed `round` to `roundNumber` to match the interface.
- **Files modified:** `frontend/components/settings/InterviewsTab.tsx`
- **Commit:** 5e63b8d

## Verification

- InterviewsTab.tsx exists: FOUND
- ScoringTab.tsx exists: FOUND
- No dynamic Tailwind hex interpolation in either file
- No Supabase imports or writes in either file
- `yarn tsc --noEmit` passes after each task
- `yarn build` passes after Task 3

## Self-Check: PASSED

- `frontend/components/settings/InterviewsTab.tsx` — exists
- `frontend/components/settings/ScoringTab.tsx` — exists
- Commits: 5e63b8d (InterviewsTab), d6c4f42 (ScoringTab), 22bad14 (page wiring)
