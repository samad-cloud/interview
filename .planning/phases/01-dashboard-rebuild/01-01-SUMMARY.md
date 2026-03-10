---
phase: 01-dashboard-rebuild
plan: 01
subsystem: ui
tags: [react, typescript, tailwind, dashboard, funnel]

# Dependency graph
requires: []
provides:
  - FunnelRow component with 7 pipeline stage cards, conversion % pills, and click-to-filter behavior
  - FUNNEL_TO_STAGE_FILTER mapping from funnel keys to stageFilter values
  - Dashboard page renders FunnelRow wired to stageFilter state
affects:
  - 01-02 (candidate table stage filtering)
  - 01-03 (r1_done filter value handler in fetchCandidates)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use style={{}} for dynamic colors in Tailwind projects to avoid purge issues"
    - "FunnelCard sub-component (internal) + FunnelRow export pattern for compound components"

key-files:
  created:
    - frontend/components/dashboard/FunnelRow.tsx
  modified:
    - frontend/app/dashboard/page.tsx

key-decisions:
  - "FUNNEL_TO_STAGE_FILTER maps r1done→r1_done and r2inv/r2done both→r2_pending (r1_done filter handler to be added in Plan 01-03)"
  - "FunnelCard uses style={{color}} and style={{background}} for per-card colors to survive Tailwind purge in production"
  - "Arrow separator rendered as &rarr; HTML entity inside a flex-shrink-0 div between each FunnelCard"

patterns-established:
  - "FunnelRow pattern: compound component with internal sub-component, FUNNEL_TO_STAGE_FILTER mapping, and React.Fragment key for paired sibling elements in map"

requirements-completed: [DASH-01, DASH-02]

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 01 Plan 01: FunnelRow Component Summary

**Connected 7-stage pipeline funnel row with colored counts, conversion % pills, and click-to-filter wired to stageFilter state, replacing the old grid stat cards on the dashboard.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T11:51:03Z
- **Completed:** 2026-03-10T12:03:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `FunnelRow.tsx` with 7 `FunnelCard` buttons, each showing a colored count, label, and conversion % pill (relative to previous stage)
- Integrated FunnelRow into dashboard page, wired to `stageFilter` state and `setCurrentPage(1)` on click
- Removed the old `grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7` stat card block (7 Card components with border-l-4)
- Build and TypeScript both pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FunnelRow component** - `ec49be2` (feat)
2. **Task 2: Integrate FunnelRow into dashboard page** - `95cff04` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `frontend/components/dashboard/FunnelRow.tsx` - FunnelRow export + FunnelCard sub-component + FUNNEL_STAGES + FUNNEL_TO_STAGE_FILTER
- `frontend/app/dashboard/page.tsx` - Added FunnelRow import, replaced grid stat block with FunnelRow component

## Decisions Made
- Used `style={{color}}` and `style={{background: \`${color}26\`}}` instead of dynamic Tailwind class names — required to avoid Tailwind v4 purge removing hex-based dynamic classes in production builds
- Both `r2inv` and `r2done` map to `r2_pending` stageFilter (no distinct r2_done status yet)
- `r1done` maps to `r1_done` which requires a handler in `fetchCandidates` (tracked for Plan 01-03)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FunnelRow is ready; clicking any card calls `onStageClick` which sets `stageFilter`
- The `r1_done` stageFilter value will need a case added to `fetchCandidates` (Plan 01-03)
- Plan 01-02 (candidate table columns) can now use `stageFilter` as the active selection signal

---
*Phase: 01-dashboard-rebuild*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: frontend/components/dashboard/FunnelRow.tsx
- FOUND: .planning/phases/01-dashboard-rebuild/01-01-SUMMARY.md
- FOUND: commit ec49be2 (feat: create FunnelRow component)
- FOUND: commit 95cff04 (feat: integrate FunnelRow into dashboard)
