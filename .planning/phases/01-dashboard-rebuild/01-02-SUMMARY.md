---
phase: 01-dashboard-rebuild
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, dashboard, table]

# Dependency graph
requires:
  - 01-01 (FunnelRow + stageFilter state in page.tsx)
provides:
  - CandidateTableRow component with avatar, score bars, stage badge, hover-reveal action icons
  - Dashboard table uses CandidateTableRow instead of plain TableRow
affects:
  - 01-03 (stageFilter used to filter what CandidateTableRow rows render)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use style={{background: gradient}} for dynamic CSS gradients — Tailwind cannot purge dynamic gradient strings"
    - "group/row + group-hover/row:opacity-0 Tailwind group variant for hover-reveal without layout shift"
    - "Fixed w-24 action cell ensures no layout shift when opacity-0 icons become visible"

key-files:
  created:
    - frontend/components/dashboard/CandidateTableRow.tsx
  modified:
    - frontend/app/dashboard/page.tsx

key-decisions:
  - "CandidateRow interface (subset type) defined in CandidateTableRow.tsx; page passes full Candidate via structural typing + 'as Candidate' cast"
  - "handleInviteClick and handleRejectClick added to page.tsx as row-level handlers for CandidateTableRow onInvite/onReject props"
  - "Legacy checkbox, row number, CV score, R1/R2 date, verdict columns removed — replaced by simpler 7-column layout matching Stitch design"
  - "getStageBadge() defined inline in CandidateTableRow.tsx (cannot import getStageDisplay from page.tsx which is not exported)"

requirements-completed: [DASH-03, DASH-04]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 01 Plan 02: CandidateTableRow Integration Summary

**Avatar-circle candidate rows with gradient initials, mini score bars, status badges, and hover-reveal View/Invite/Reject icon buttons — replacing the old 12-column checkbox table.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T11:57:42Z
- **Completed:** 2026-03-10T12:02:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `CandidateTableRow.tsx` with deterministic gradient avatar, `ScoreBar` sub-component, `getStageBadge()`, and hover-reveal action icons with stopPropagation
- Integrated into `dashboard/page.tsx` — new 7-column header (Candidate, Role, Applied, R1 Score, R2 Score, Stage, actions), `CandidateTableRow` in `<TableBody>`
- Added `handleInviteClick` and `handleRejectClick` row-level handlers
- Removed old 12-column table (checkbox, row#, R1 date, R2 date, CV score, verdict, dropdown)
- TypeScript clean, production build passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CandidateTableRow component** - `fd231fc` (feat)
2. **Task 2: Integrate CandidateTableRow into dashboard page** - `948fd18` (feat)

## Files Created/Modified

- `frontend/components/dashboard/CandidateTableRow.tsx` — `CandidateRow` type, `AVATAR_GRADIENTS`, `getInitials`, `getAvatarGradient`, `ScoreBar`, `formatDate`, `getStageBadge`, `CandidateTableRow` export
- `frontend/app/dashboard/page.tsx` — Added `CandidateTableRow` import, `handleInviteClick`, `handleRejectClick`, new TableHeader, new TableBody using CandidateTableRow

## Decisions Made

- `CandidateRow` (subset interface) is the prop type for `CandidateTableRow`; page passes `candidate` (full `Candidate` type) with `as Candidate` cast on onView/onInvite/onReject — TypeScript structural typing allows this
- `getStageBadge()` defined in `CandidateTableRow.tsx` because `getStageDisplay()` lives inside `page.tsx` and is not exported; the inline version covers the most common statuses adequately
- Bulk-select checkbox column removed from table — bulk action toolbar still present above the table; checkboxes could be added back in a later plan if needed
- `handleRejectClick` updates `final_verdict = 'Rejected'` and `status = 'REJECTED'` inline, matching `handleBulkReject` logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard table now shows rich candidate rows with avatar, scores, badge, and hover actions
- `stageFilter` state is still in `page.tsx` (wired via FunnelRow from Plan 01-01)
- Plan 01-03 can add `r1_done` case to `fetchCandidates` and any additional filter/sort enhancements

---
*Phase: 01-dashboard-rebuild*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: frontend/components/dashboard/CandidateTableRow.tsx
- FOUND: .planning/phases/01-dashboard-rebuild/01-02-SUMMARY.md
- FOUND: commit fd231fc (feat(01-02): create CandidateTableRow component)
- FOUND: commit 948fd18 (feat(01-02): integrate CandidateTableRow into dashboard page)
