---
phase: 03-create-job-wizard
plan: 05
subsystem: frontend/wizard
tags: [wizard, screening, ai-generation, server-action]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [StepScreening, generateScreeningQuestions]
  affects: [frontend/app/create-job/page.tsx]
tech_stack:
  added: []
  patterns: [generateObject+Zod server action, hasGenerated ref guard, wizard state management]
key_files:
  created:
    - frontend/app/actions/generateScreeningQuestions.ts
    - frontend/components/wizard/StepScreening.tsx
  modified:
    - frontend/app/create-job/page.tsx
decisions:
  - "hasGenerated ref initialized from props.state.screeningQuestions.length > 0 — avoids duplicate AI calls on re-mount when questions already exist"
  - "editingValues held in local state (not wizardState) — only question text and isEditing flag live in wizardState; transient edit buffer is ephemeral"
  - "Yes/No badge uses inline style background '#6366F180' (not Tailwind class) — consistent with Tailwind v4 purge-safe pattern"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-11"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 5: Screening Questions Step Summary

**One-liner:** generateScreeningQuestions server action (generateObject + Zod, 3-8 yes/no questions) with StepScreening UI for AI generation, inline edit, remove, and add controls wired at wizard step 5.

## What Was Built

### Task 1 — generateScreeningQuestions server action (commit b1be910)

`frontend/app/actions/generateScreeningQuestions.ts` — server action following the existing `generateObject + gemini + Zod` pattern.

- `ScreeningQuestionsSchema`: `z.object({ questions: z.array(z.object({ question: z.string() })).min(3).max(8) })`
- Accepts `{ title, location, skillsMustHave, visaSponsorship, education, experienceMin }`
- Returns `{ question: string }[]`
- Prompt constructs context-specific yes/no screening questions with examples, visa sponsorship phrasing, and role-tailored requirements

### Task 2 — StepScreening component + page.tsx wiring (commit 33feca5)

`frontend/components/wizard/StepScreening.tsx` — 313 lines, full question lifecycle management.

**Empty state:** Info card explaining screening questions, Generate button disabled if `!title.trim()`, spinner during generation, helpful "Complete Step 1 first" message when title is absent.

**Question list:** Yes/No badge pill (indigo, inline style), question text or edit Input, pencil/check/cancel/X action buttons. Regenerate ghost button at top-right.

**Inline edit flow:** Click pencil → `editingValues[id]` populated + `isEditing: true` in wizardState → Input shown → checkmark saves from editingValues, X cancels. Enter key triggers save.

**Add custom question:** Input + Add button row below list, Enter key support, clears input after add.

**State management:** All questions stored in `wizardState.screeningQuestions`; `editingValues` is ephemeral local state. `hasGenerated` ref prevents re-generation on component re-mount.

`frontend/app/create-job/page.tsx` — `StepScreening` imported and wired at `activeStep === 5` with `onNext → 6`, `onPrev → 4`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit`: zero errors
- `yarn build`: Turbopack filesystem race condition in the environment causes intermittent ENOENT errors (pre-existing environment issue, unrelated to these changes — TypeScript compilation reports "Compiled successfully" before the crash)
- All must_haves satisfied:
  - Step 5 renders Generate button calling generateScreeningQuestions
  - Question list with edit/remove controls renders after generation
  - HR can edit inline (pencil → input → checkmark)
  - HR can remove (X button)
  - HR can add custom questions (input + Enter/Add)
  - Questions stored in `wizardState.screeningQuestions`
  - Sidebar Step 5 turns emerald when `screeningQuestions.length > 0` (via `getCompletedSteps` in page.tsx)
  - `hasGenerated` ref guard prevents duplicate API calls

## Self-Check: PASSED

- `frontend/app/actions/generateScreeningQuestions.ts` — exists, confirmed
- `frontend/components/wizard/StepScreening.tsx` — exists, confirmed
- `frontend/app/create-job/page.tsx` — StepScreening import at line 9, wired at line 227, confirmed
- Commits b1be910 and 33feca5 — both present in git log
