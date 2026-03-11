---
phase: 03-create-job-wizard
plan: 01
subsystem: frontend
tags: [wizard, routing, scaffold, state-management]
dependency_graph:
  requires: []
  provides: [create-job-route, WizardSidebar, WizardState]
  affects: [frontend/components/AppSidebar.tsx]
tech_stack:
  added: []
  patterns: [localStorage-draft-persist, inline-style-colors, supabase-auth-guard]
key_files:
  created:
    - frontend/app/create-job/page.tsx
    - frontend/components/wizard/WizardSidebar.tsx
  modified:
    - frontend/components/AppSidebar.tsx
decisions:
  - "Used named import { supabase } from supabaseClient (not default export) — auto-fixed during build"
  - "Removed unused STEPS import from page.tsx to keep build clean"
  - "Step 4 always counted as complete since roundCount defaults to 2 — matches plan spec"
metrics:
  duration_seconds: 250
  completed_date: "2026-03-11"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 1: Create Job Wizard Scaffold Summary

Two-column wizard scaffold at /create-job with WizardSidebar progress component, full WizardState type system, localStorage draft persistence, and auth guard — the structural foundation all step plans (03-02 through 03-06) build on.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WizardSidebar component | e26e97b | frontend/components/wizard/WizardSidebar.tsx |
| 2 | Scaffold wizard page and update AppSidebar | 45655bd | frontend/app/create-job/page.tsx, frontend/components/AppSidebar.tsx |

## What Was Built

### WizardSidebar (`frontend/components/wizard/WizardSidebar.tsx`)
- Exports `STEPS` constant (6 wizard steps) and `WizardStep` type for downstream use
- Fixed 280px sidebar with `#0F172A` background and `#1E293B` border
- Three visual states via inline `style` props (never dynamic Tailwind): completed (emerald `#10B981`), active (indigo `#6366F1`), pending (gray `#1E293B`)
- Connector lines between steps (20px, `#1E293B` border-left)
- Save as Draft ghost button with 2-second "Draft saved" confirmation
- Back to Jobs link at the bottom

### Create Job Page (`frontend/app/create-job/page.tsx`)
- Full `WizardState` interface covering all 6 steps (Basics, Requirements, AI Generate, Interview Config, Screening, Scoring & Publish)
- `RoundConfig` and `ScreeningQuestion` supporting interfaces
- `getDefaultWizardState()` with sensible defaults (roundCount: 2, scoringPreset: 'standard')
- `getCompletedSteps()` computing progress from state values
- Auth guard: Supabase session check on mount, redirects to `/login?redirect=/create-job`
- Draft restore: reads `synchrohire_job_draft` from localStorage on mount
- Auto-save: writes draft on every `wizardState`/`activeStep` change (skips initial mount via `useRef` guard)
- Two-column layout (`flex h-screen overflow-hidden`, `#020617` background)
- Step content area shows placeholder text — wired up in plans 03-02 through 03-06

### AppSidebar (`frontend/components/AppSidebar.tsx`)
- Nav item changed from `'AI Job Generator'` / `'/gen-job'` to `'Create Job'` / `'/create-job'`
- `/gen-job` route preserved (not deleted)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed supabase default vs named import**
- **Found during:** Task 2 build verification
- **Issue:** `supabaseClient.ts` exports `const supabase` (named export), but page.tsx used `import supabase from` (default import), causing a Next.js build error
- **Fix:** Changed to `import { supabase } from '@/lib/supabaseClient'`
- **Files modified:** frontend/app/create-job/page.tsx
- **Commit:** 45655bd

**2. [Rule 1 - Bug] Removed unused STEPS import**
- **Found during:** Task 2 initial draft
- **Issue:** `STEPS` was imported but not used in page.tsx, risking a lint/TS warning
- **Fix:** Removed `STEPS` from the import statement
- **Files modified:** frontend/app/create-job/page.tsx
- **Commit:** 45655bd

## Self-Check: PASSED

| Item | Status |
|------|--------|
| frontend/components/wizard/WizardSidebar.tsx | FOUND |
| frontend/app/create-job/page.tsx | FOUND |
| Commit e26e97b | FOUND |
| Commit 45655bd | FOUND |
