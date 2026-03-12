---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Stitch UI Implementation
status: in_progress
stopped_at: Completed 04-02-PLAN.md
last_updated: "2026-03-12T06:02:30.319Z"
last_activity: 2026-03-11 — 03-05 generateScreeningQuestions server action, StepScreening with edit/remove/add controls wired at step 5
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 18
  completed_plans: 16
  percent: 100
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Stitch UI Implementation
status: in_progress
stopped_at: Completed 03-05-PLAN.md
last_updated: "2026-03-11T08:06:00.000Z"
last_activity: 2026-03-11 — 03-05 generateScreeningQuestions server action, StepScreening component wired at step 5
progress:
  [██████████] 100%
  completed_phases: 2
  total_plans: 13
  completed_plans: 12
  percent: 85
  bar: "[█████████░] 85%"
---

# SynchroHire — GSD State

## Current Position

Phase: 03-create-job-wizard
Plan: 5 of 6 (complete)
Status: Phase 3 active — 03-05 StepScreening complete; step 6 pending (03-06)
Last activity: 2026-03-11 — 03-05 generateScreeningQuestions server action, StepScreening with edit/remove/add controls wired at step 5
Last session: 2026-03-12T06:02:11.325Z
Stopped at: Completed 04-02-PLAN.md

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** HR managers can screen, score, and progress candidates through a full AI interview pipeline without manual intervention.
**Current focus:** v2.0 Stitch UI Implementation

## Accumulated Context

### Architecture
- Frontend: Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 in `frontend/`
- UI: shadcn/ui (New York style), Lucide icons, dark mode global
- Pages: /dashboard, /jobs, /screener, /gen-job (→ replace with wizard), /login
- Sidebar: `frontend/components/AppSidebar.tsx` (collapsible, 220px/60px)
- Auth: Supabase SSR middleware, protects /dashboard /screener /gen-job
- Backend: Python Railway — do NOT touch this milestone

### Design References
- Stitch project ID: `2015362733645521083`
- Playground: `synchrohire-playground.html` (interactive mockups of all screens)
- Design system: bg `#020617`, surface `#0F172A`, border `#1E293B`, primary `#6366F1`, success `#10B981`

### Key Files
- `frontend/app/dashboard/page.tsx` — main dashboard (candidate table, funnel stats, modal)
- `frontend/app/jobs/page.tsx` — jobs list
- `frontend/app/gen-job/page.tsx` — AI job generator (replace with wizard)
- `frontend/components/AppSidebar.tsx` — sidebar (keep, extend with Settings link)
- `frontend/app/layout.tsx` — root layout with sidebar

### Pending Blockers
- None

### Decisions Made
- UI shell only for Settings (no backend) — agreed 2026-03-10
- Stitch designs are the pixel reference — confirmed
- /gen-job replaced by new Create Job wizard at same route or /create-job
- FunnelCard uses style={{color}} for hex colors to avoid Tailwind purge in production — 2026-03-10
- r2inv and r2done both map to r2_pending stageFilter (no distinct r2_done status yet) — 2026-03-10
- r1done maps to r1_done filter value; fetchCandidates handler deferred to Plan 01-03 — 2026-03-10
- CandidateRow subset interface defined in CandidateTableRow.tsx; page passes full Candidate via structural typing — 2026-03-10
- getStageBadge() defined inline in CandidateTableRow.tsx (getStageDisplay not exported from page.tsx) — 2026-03-10
- Legacy checkbox/row#/CV score/verdict columns removed; bulk toolbar kept above table — 2026-03-10
- StageTabStrip placed as full-width row between filter bar and Advanced Filters panel — 2026-03-11
- r1_done case: query.not('rating', 'is', null) — all candidates who completed R1 regardless of score — 2026-03-11
- CandidatePanel kept alongside Dialog during Phase 2 development; Dialog removed in 02-04 — 2026-03-11
- PanelCandidate types declared inline in CandidatePanel.tsx (page.tsx does not export its interfaces) — 2026-03-11
- onReject cast via Parameters<typeof handleRejectClick>[0] for structural type mismatch between PanelCandidate and Candidate — 2026-03-11
- AVATAR_GRADIENTS/getInitials/getAvatarGradient copied (not imported) into CandidatePanel to avoid inter-component coupling — 2026-03-11
- getStageBadge in CandidatePanel returns hex color/bg strings (not Tailwind classes) — consistent with panel's inline style approach — 2026-03-11
- SVG ring gauge: r=30, viewBox 72x72, strokeDashoffset animates on mount; null score shows gray ring with "Pending" label — 2026-03-11
- RecordingCard/TranscriptAccordion defined as module-internal functions in CandidatePanel.tsx (not exported) — 2026-03-11
- ChevronRight uses static `rotate-90` class conditionally — never dynamic rotate-${var} (Tailwind v4 purge-safe) — 2026-03-11
- State resets (activeRecording + accordion open states) via useEffect on candidate?.id — 2026-03-11
- Footer flex-shrink-0 pins without structural change — panel was already flex-col with flex-1 body from 02-01 — 2026-03-11
- Invite button: three-way conditional (no round_2_rating → R2, has round_2_rating but no round_3_rating → R3, both complete → hidden) — 2026-03-11
- Dialog block removed from page.tsx (~630 LOC); dead imports and interviewNotes/generateNotes state cleaned up — 2026-03-11
- noteText initialized from candidate?.hr_notes in candidate-change useEffect alongside other state resets — 2026-03-11
- [Phase 03-create-job-wizard]: Used named { supabase } import from supabaseClient (not default export)
- [Phase 03-create-job-wizard]: Inline style props for sidebar step colors — no dynamic Tailwind class strings (Tailwind v4 purge-safe)
- [Phase 03-create-job-wizard 03-02]: SkillChipInput chip colors use inline style (background+20, border+40 alpha) — never dynamic Tailwind class interpolation
- [Phase 03-create-job-wizard 03-02]: Native <input type="date"> for targetStartDate — no date picker library installed
- [Phase 03-create-job-wizard 03-02]: Step components import WizardState from @/app/create-job/page (exported interface); each step exports named function
- [Phase 03-create-job-wizard]: Pre-wrap monospace div for job description preview — no markdown parser dependency added
- [Phase 03-create-job-wizard]: Citations are local state in StepAIGenerate (not in WizardState) — cosmetic only, re-fetched on regenerate
- [Phase 03-create-job-wizard 03-05]: hasGenerated ref initialized from screeningQuestions.length > 0 — prevents re-generation on re-mount
- [Phase 03-create-job-wizard 03-05]: editingValues held in local state (not wizardState) — transient edit buffer is ephemeral
- [Phase 03-create-job-wizard 03-05]: Yes/No badge uses inline style background '#6366F180' — Tailwind v4 purge-safe
- [Phase 03-06]: Migration numbered 019 not 002 to follow sequential order — 18 migrations already exist
- [Phase 03-06]: StepScoring preset cards use inline style borderColor (not dynamic Tailwind) — Tailwind v4 purge-safe
- [Phase 04-settings-panel]: Settings nav item added after AI Prompts in navItems array
- [Phase 04-settings-panel]: Auth guard uses useEffect + getSession redirect (same pattern as dashboard)
- [Phase 04-settings-panel]: Brand colour swatch uses style={{ backgroundColor: brandColor }} — never dynamic Tailwind interpolation
