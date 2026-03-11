---
phase: 03-create-job-wizard
plan: 06
subsystem: frontend/wizard
tags: [wizard, scoring, publish, supabase-insert, migration, step6]

requires:
  - phase: 03-01
    provides: [WizardState type, page.tsx scaffold, WizardSidebar]
  - phase: 03-02
    provides: [StepBasics, StepRequirements, headcount/targetStartDate/employmentType fields in WizardState]
  - phase: 03-03
    provides: [StepAIGenerate, generatedDescription in WizardState]
  - phase: 03-04
    provides: [StepInterviewConfig, rounds/roundCount in WizardState]
  - phase: 03-05
    provides: [StepScreening, screeningQuestions in WizardState]
provides:
  - StepScoring (four hiring bar preset cards, inline style border color, job summary review)
  - handlePublish (Supabase insert with all wizard fields, localStorage clear on success, router.push /jobs)
  - Wizard end-to-end: all 6 steps wired in page.tsx, no placeholder divs remaining
  - migrations/019_wizard_fields.sql (headcount, target_start_date, employment_type with IF NOT EXISTS)
affects: [supabase jobs table, frontend/app/jobs/page.tsx]

tech-stack:
  added: []
  patterns: [inline-style-border-for-preset-selection, supabase-insert-from-wizard-state, if-not-exists-migration-guards]

key-files:
  created:
    - frontend/components/wizard/StepScoring.tsx
    - migrations/019_wizard_fields.sql
  modified:
    - frontend/app/create-job/page.tsx

key-decisions:
  - "Migration numbered 019 (not 002) to follow sequential order — 018 migrations already exist"
  - "Preset card selected state uses inline style borderColor (never dynamic Tailwind class interpolation) — Tailwind v4 purge-safe"
  - "handlePublish validates title + location client-side before Supabase insert — prevents empty-title jobs"
  - "localStorage.removeItem called on successful publish only (not on error) — preserves draft on failure"

patterns-established:
  - "Hiring bar presets: module-level HIRING_PRESETS constant, isSelected checked via state.scoringPreset === preset.id"
  - "Supabase insert pattern: supabase.from('jobs').insert({...wizardFields}), error thrown, router.push('/jobs')"

requirements-completed: [JOB-07, JOB-08, JOB-09]

duration: ~74min
completed: 2026-03-11
---

# Phase 3 Plan 6: Step 6 Scoring & Publish Summary

**StepScoring with four hiring bar preset cards (Growth/Standard/High Bar/Elite), handlePublish inserting all wizard fields to Supabase jobs table with new headcount/target_start_date/employment_type columns, completing the 6-step Create Job wizard end-to-end.**

## Performance

- **Duration:** ~74 min
- **Started:** 2026-03-11T08:35:37Z
- **Completed:** 2026-03-11T09:49:00Z
- **Tasks:** 2 auto tasks completed (1 checkpoint pending human verification)
- **Files modified:** 3

## Accomplishments
- StepScoring component with four hiring bar preset cards using inline style for selected-border color (Tailwind v4 purge-safe)
- Job summary review section shows key wizard fields (title, location, rounds, description preview, question count) as read-only dl
- Publish button disabled with visible warning when title or location is empty; spinner during publishing
- handlePublish inserts all 20+ wizard fields to Supabase jobs table, clears localStorage draft on success, redirects to /jobs
- All 6 steps wired in page.tsx — no placeholder divs remaining
- migrations/019_wizard_fields.sql adds headcount, target_start_date, employment_type with IF NOT EXISTS guards

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration and implement StepScoring** - `128046c` (feat)
2. **Task 3: Wire Step 6 and publish handler into page.tsx** - `30c5fdf` (feat)

**Note:** Task 2 is a checkpoint:human-verify task (not a code task). It pauses for manual end-to-end verification.

## Files Created/Modified
- `frontend/components/wizard/StepScoring.tsx` — Step 6 panel: hiring bar preset cards, job summary review, publish/error UI
- `migrations/019_wizard_fields.sql` — Adds headcount (integer), target_start_date (date), employment_type (text) to jobs table
- `frontend/app/create-job/page.tsx` — Added StepScoring import, handlePublish async function, wired step 6 block

## Decisions Made
- Migration named `019_wizard_fields.sql` not `002_wizard_fields.sql` — 18 migrations already exist; numbering must follow sequence to avoid file conflicts
- Inline `style={{ borderColor: preset.color }}` for selected state, `style={{ borderColor: '#1E293B' }}` for unselected — consistent with Tailwind v4 purge-safe pattern established in 03-01 through 03-05
- `handlePublish` validates `title.trim() && location.trim()` before attempting insert — prevents partially-filled jobs being created; also sets publishError state for display below Publish button
- `localStorage.removeItem('synchrohire_job_draft')` only called on successful insert, not in catch — preserves draft if publish fails so user doesn't lose data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Sequence deviation] Migration file number changed from 002 to 019**
- **Found during:** Task 1 (Create migration)
- **Issue:** Plan specified `migrations/002_wizard_fields.sql` but `migrations/002_add_structured_ai_columns.sql` already exists. Using 002 would conflict or create an ambiguous sort order.
- **Fix:** Named the file `migrations/019_wizard_fields.sql` (next in sequence after 018). Content is identical to what the plan specified.
- **Files modified:** `migrations/019_wizard_fields.sql`
- **Verification:** Migration file created, yarn build passes
- **Committed in:** 128046c

---

**Total deviations:** 1 auto-fixed (1 naming deviation, no behavior change)
**Impact on plan:** Cosmetic only — migration filename different, content and behavior identical. All success criteria met.

## Issues Encountered
- Supabase MCP HTTP server configured in `.mcp.json` but migration could not be executed via bash. Migration file `019_wizard_fields.sql` is created with IF NOT EXISTS guards; it must be applied via Supabase MCP `execute_sql` tool or the Supabase dashboard SQL editor before the Publish button will work in production.
- Human verification (checkpoint) will confirm migration was applied and Publish succeeds end-to-end.

## User Setup Required
Before the Publish button can succeed: run `migrations/019_wizard_fields.sql` against the Supabase database. The SQL uses `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS` so it is safe to run multiple times.

```sql
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS headcount integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_start_date date,
  ADD COLUMN IF NOT EXISTS employment_type text;
```

Execute via: Supabase Dashboard → SQL Editor → paste and run.

## Next Phase Readiness
- Complete Create Job wizard is functional end-to-end after migration is applied
- /jobs page already exists and will show newly published jobs
- Phase 03 (Create Job Wizard) is complete pending checkpoint verification
- Phase 04 (Settings or next milestone phase) can begin after checkpoint passes

---
*Phase: 03-create-job-wizard*
*Completed: 2026-03-11*

## Self-Check: PASSED
- `frontend/components/wizard/StepScoring.tsx` — FOUND
- `migrations/019_wizard_fields.sql` — FOUND
- `frontend/app/create-job/page.tsx` — FOUND and modified
- Commit 128046c — FOUND (feat(03-06): implement StepScoring and add wizard fields migration)
- Commit 30c5fdf — FOUND (feat(03-06): wire StepScoring and handlePublish into create-job wizard)
- `yarn build` — PASSED (Done in ~36s, zero TypeScript errors)
