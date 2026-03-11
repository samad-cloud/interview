# SynchroHire — GSD State

## Current Position

Phase: 01-dashboard-rebuild
Plan: 03 of 3 (all complete)
Status: Phase 1 complete — all 3 plans executed, ready for Phase 2
Last activity: 2026-03-11 — 01-03 StageTabStrip integrated, Phase 1 complete
Last session: 2026-03-11T00:00:00Z
Stopped at: Phase 1 complete, Phase 2 not started

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
