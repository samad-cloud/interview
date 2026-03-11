---
phase: 02-candidate-panel-slide-over
plan: 03
subsystem: ui
tags: [react, tailwind, typescript, video-player, accordion, dashboard]

# Dependency graph
requires:
  - phase: 02-candidate-panel-slide-over
    plan: 02
    provides: CandidatePanel shell with header, ScoreGauge, VerdictBanner, StrengthsGaps
provides:
  - RecordingCard sub-component: clickable card that toggles VideoPlayer inline below
  - TranscriptAccordion sub-component: expandable R1/R2/R3 transcript sections with ChevronRight rotate indicator
  - Recordings section: appears below strengths/gaps, conditionally rendered when video URLs exist
  - Transcript section: appears below recordings, conditionally rendered when transcript data exists
affects: [02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Toggle pattern: useState<'r1'|'r2'|'r3'|null> — clicking same key sets to null (collapse)"
    - "State reset on candidate change: useEffect([candidate?.id]) resets activeRecording + r1/r2/r3Open"
    - "ChevronRight rotate: static class `rotate-90` conditionally applied — never dynamic `rotate-${var}`"
    - "Null guard at component level: RecordingCard/TranscriptAccordion return null when data absent"
    - "Section-level null guard: outer wrapper hidden when no round has data"

key-files:
  created: []
  modified:
    - frontend/components/dashboard/CandidatePanel.tsx

key-decisions:
  - "Both tasks (recordings + transcripts) committed together — single file, no valid intermediate state between them"
  - "VideoPlayer import at file top level; RecordingCard and TranscriptAccordion defined as module-internal functions (not exported)"
  - "useState and ChevronRight added to existing imports rather than duplicate import statements"
  - "r3 transcript accordion included alongside r1/r2 for forward compatibility — consistent with round_3_transcript field already in PanelCandidate type"

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 02 Plan 03: CandidatePanel Recordings and Transcript Accordions Summary

**RecordingCard with inline VideoPlayer toggle and TranscriptAccordion for R1/R2/R3 — null-safe, state-reset on candidate change, scrollable transcript content capped at max-h-64**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T06:52:27Z
- **Completed:** 2026-03-11T06:55:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- RecordingCard: play icon, round label, "Click to play" / "Click to hide" toggle text, active border highlight via inline style
- VideoPlayer: renders inline below all cards when a recording is active; collapses when same card clicked again
- TranscriptAccordion: header button with ChevronRight that rotates 90deg when open; content div with max-h-64 + overflow-y-auto
- State additions: `activeRecording`, `r1Open`, `r2Open`, `r3Open` — all reset via useEffect on `candidate?.id`
- All sections hidden when no data (null guard at both section and sub-component levels)
- TypeScript build clean — 0 errors

## Task Commits

Both tasks modify the same file with no valid intermediate state. Combined into one semantic commit:

1. **Tasks 1+2: RecordingCard, VideoPlayer integration, TranscriptAccordion** - `a6831bc` (feat)

## Files Created/Modified

- `frontend/components/dashboard/CandidatePanel.tsx` — RecordingCard sub-component, TranscriptAccordion sub-component, recordings section, transcript section, state variables, state reset useEffect

## Decisions Made

- Committed tasks 1 and 2 together — both modify the same file and neither produces a meaningful intermediate state.
- r3 transcript accordion included for forward compatibility (round_3_transcript already defined in PanelCandidate interface).
- ChevronRight uses static `rotate-90` class conditionally — safe from Tailwind v4 purge.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- 02-04 can implement footer action buttons (Invite R2, Invite R3, Reject, Save Note)
- Body flex-col gap-4 container has recordings + transcripts sections ready
- All panel sections (header, scores, verdict, strengths/gaps, recordings, transcripts) complete

## Self-Check: PASSED

- `frontend/components/dashboard/CandidatePanel.tsx` — FOUND
- Commit `a6831bc` (Tasks 1+2) — FOUND
- Build: clean (0 errors, Done in 26.81s)

---
*Phase: 02-candidate-panel-slide-over*
*Completed: 2026-03-11*
