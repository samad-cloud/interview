---
phase: 03-create-job-wizard
plan: 03
subsystem: frontend
tags: [wizard, ai-generate, job-description, server-actions, refine-loop]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [StepAIGenerate, step-3-ai-generate]
  affects: [frontend/app/create-job/page.tsx]
tech_stack:
  added: []
  patterns: [pre-wrap-preview, loading-guard-pattern, inline-style-colors, citations-disclosure]
key_files:
  created:
    - frontend/components/wizard/StepAIGenerate.tsx
  modified:
    - frontend/app/create-job/page.tsx
decisions:
  - "Pre-wrap monospace div for preview — no markdown parser dependency added"
  - "Citations state is local to StepAIGenerate (not persisted to WizardState) — citations are cosmetic, re-fetched on regenerate"
  - "isGenerating/isRefining are separate flags — allows distinguishing spinner context in the two-column layout"
  - "buildGenParams is module-internal (not exported) — only StepAIGenerate needs it"
metrics:
  duration_seconds: 420
  completed_date: "2026-03-11"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 3 Plan 3: Step 3 AI Generate Summary

StepAIGenerate component wiring generateJobDescription and refineJobDescription server actions into the wizard with a pre-generate centered card, two-column post-generate layout (monospace preview + refine controls), loading guards, citations disclosure, and error banner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement StepAIGenerate component | 21210e5 | frontend/components/wizard/StepAIGenerate.tsx |
| 2 | Wire Step 3 into page.tsx | b3a1b24 | frontend/app/create-job/page.tsx |

## What Was Built

### StepAIGenerate (`frontend/components/wizard/StepAIGenerate.tsx`)

- Exports `StepAIGenerate` with props `{ state, onChange, onNext, onPrev }`
- `buildGenParams()` helper maps WizardState fields to `JobGenerationParams` — formats salary string, joins skills arrays, converts employmentType underscores to spaces
- **Pre-generate state**: Centered card with Sparkles icon, source data summary (title + location), disabled state with warning when title/location empty, Generate button calls `handleGenerate`
- **Post-generate state**: Two-column layout
  - Left (60%): scrollable monospace pre-wrap div — `#0F172A` bg, `#CBD5E1` text, `13px` font, `maxHeight: 500px` with `overflowY: auto`
  - Right (40%): "Regenerate from scratch" button (calls `handleGenerate`), or/refine divider, Textarea bound to `state.refinePrompt`, "Refine" button (calls `handleRefine`, disabled when prompt empty or refining)
- **Citations**: Collapsible disclosure row, links open `target="_blank"`, deduplicated by URL, renders only when `citations.length > 0`
- **Loading guards**: `isGenerating` and `isRefining` boolean flags — buttons disabled during requests, `Loader2 animate-spin` spinners shown
- **Error banner**: red-bordered div with dismiss × button
- **Navigation footer**: Previous / "Next: Interview Config →" (disabled until `generatedDescription` has content)
- Sidebar Step 3 turns emerald automatically when `generatedDescription` is non-empty (driven by `getCompletedSteps` in page.tsx, no extra logic needed)

### page.tsx (`frontend/app/create-job/page.tsx`)

- Added `import { StepAIGenerate }` from wizard components
- Replaced `activeStep > 2` coming-soon block with discrete conditionals: `activeStep === 3` renders `<StepAIGenerate>`, steps 4 and 6 remain as coming-soon placeholders

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| frontend/components/wizard/StepAIGenerate.tsx | FOUND |
| frontend/app/create-job/page.tsx (modified) | FOUND |
| Commit 21210e5 | FOUND |
| Commit b3a1b24 | FOUND |
| tsc --noEmit: zero errors | PASSED |
| Build compiled successfully (15.3s) | PASSED |
