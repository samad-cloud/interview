# Roadmap: SynchroHire v2.0 — Stitch UI Implementation

## Overview

Five phases of frontend-only UI work that migrate the SynchroHire HR dashboard from its v1.0 state to the Stitch pixel-reference designs. Phase 1 rebuilds the dashboard's visual foundation (funnel cards, table rows, filter tabs). Phase 2 replaces the candidate detail modal with a full-height slide-over panel. Phase 3 delivers the 6-step Create Job wizard that supersedes /gen-job. Phase 4 builds the /settings admin shell across five tabs (UI-only, no backend). Phase 5 refreshes the Jobs page with tabs, card polish, and candidate counts. No backend changes. Interview pages remain untouched throughout.

**Design reference:** Google Stitch project 2015362733645521083
**Playground reference:** `synchrohire-playground.html` (interactive mockups of all target screens)
**Design tokens:** bg `#020617`, surface `#0F172A`, border `#1E293B`, indigo `#6366F1`, emerald `#10B981`

## Milestones

- 🚧 **v2.0 Stitch UI Implementation** — Phases 1–5 (in progress)

## Phases

### 🚧 v2.0 Stitch UI Implementation

**Milestone Goal:** Replace every v1.0 HR dashboard screen with the Stitch-designed UI — delivering a polished, cohesive recruiter experience while leaving interview pages, the backend pipeline, and the database untouched.

---

### Phase 1: Dashboard Rebuild

**Goal**: HR manager sees a Stitch-compliant dashboard with funnel stat cards, a fully-decorated candidate table, and a stage filter tab strip.
**Depends on**: Nothing (first phase)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a row of connected funnel cards displaying each pipeline stage count and conversion percentage; clicking a card filters the table to that stage.
  2. Each candidate table row displays an avatar circle with initials, name, email, role, applied date, R1/R2 score progress bars, a stage badge, and View/Invite/Reject action icons that appear on hover.
  3. The tab strip (All / R1 Pending / R1 Done / R2 / Final) filters the candidate table and reflects the active tab visually.
  4. Hover state on a table row produces a visible background highlight and surfaces the action icons without layout shift.
**Plans:** 2/3 plans executed

Plans:
- [x] 01-01-PLAN.md — FunnelRow component (connected funnel cards, conversion %, clickable stage filter)
- [x] 01-02-PLAN.md — CandidateTableRow component (avatar, score bars, stage badge, hover + action icons)
- [ ] 01-03-PLAN.md — StageTabStrip component and r1_done filter case wired to table

---

### Phase 2: Candidate Panel Slide-Over

**Goal**: HR manager can click any candidate row to open a comprehensive right-side slide-over panel that displays all scores, AI analysis, recordings, transcripts, and action buttons — replacing the cramped v1.0 modal.
**Depends on**: Phase 1
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-05, PANEL-06, PANEL-07, PANEL-08
**Success Criteria** (what must be TRUE):
  1. Clicking a candidate row opens a 640px right-side slide-over at full viewport height; clicking outside or pressing Escape closes it without losing table scroll position.
  2. Slide-over header shows avatar, name, role, applied date, location, and stage badge.
  3. R1 and R2 score gauges appear side-by-side with a pass/fail label; the Final Verdict banner shows one of four hire tiers with the AI summary text beneath it.
  4. Strengths and Gaps appear in a two-column grid; interview recordings show as video cards with an inline player.
  5. Round 1 and Round 2 transcript accordions are expandable inline within the panel.
  6. Footer action buttons (Invite to R2 / Reject / Add Note) are pinned to the bottom of the panel and remain visible while scrolling content above.
**Plans**: TBD

Plans:
- [ ] 02-01: Build slide-over shell (640px, full-height, open/close, overlay, keyboard dismiss)
- [ ] 02-02: Implement header, score gauges, Final Verdict banner, Strengths/Gaps grid
- [ ] 02-03: Implement recordings section (video cards, inline player) and transcript accordions
- [ ] 02-04: Implement pinned footer action bar (Invite to R2 / Reject / Add Note) wired to existing actions

---

### Phase 3: Create Job Wizard

**Goal**: HR manager can create a job end-to-end via a 6-step wizard — replacing /gen-job — with AI description generation, interview config, screening questions, and scoring threshold in a single cohesive flow.
**Depends on**: Phase 1
**Requirements**: JOB-01, JOB-02, JOB-03, JOB-04, JOB-05, JOB-06, JOB-07, JOB-08, JOB-09
**Success Criteria** (what must be TRUE):
  1. Wizard launches from the Jobs page or sidebar and presents 6 named steps; the sidebar progress indicator shows completed steps in emerald, the active step in indigo, and pending steps in gray.
  2. Steps 1 and 2 (Basics and Requirements) accept all specified fields including skill chips, toggles, and date pickers with no validation errors on valid input.
  3. Step 3 (AI Generate) calls the existing AI generation action and renders a live preview of the job description; HR can refine via text field and regenerate.
  4. Step 4 (Interview Config) lets HR choose 1–3 rounds and configure theme, duration, voice, and avatar toggle per round.
  5. Step 5 (Screening) shows AI-generated Yes/No eligibility questions that HR can edit, remove, and add to.
  6. Step 6 (Scoring) presents the four hiring bar presets as selectable cards; clicking Publish creates the job record and redirects to the Jobs page.
  7. "Save as Draft" is available at every step and persists the current wizard state without publishing.
**Plans**: TBD

Plans:
- [ ] 03-01: Scaffold wizard layout, sidebar progress component, step routing/state management
- [ ] 03-02: Implement Step 1 (Basics) and Step 2 (Requirements) with all fields and skill chip inputs
- [ ] 03-03: Implement Step 3 (AI Generate) — wire to existing generateJob action, live preview, refine loop
- [ ] 03-04: Implement Step 4 (Interview Config) — round count selector, per-round config rows
- [ ] 03-05: Implement Step 5 (Screening) — AI-generated question list, edit/remove/add controls
- [ ] 03-06: Implement Step 6 (Scoring) — hiring bar preset cards, Publish action, Save as Draft at all steps

---

### Phase 4: Settings Panel

**Goal**: HR manager can navigate to /settings and explore five configuration tabs (Company, Email & Comms, Interviews, Scoring, Job Boards) as a fully-rendered UI shell — no values persist to the database in v2.0.
**Depends on**: Phase 1
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, SETT-06, SETT-07, SETT-08, SETT-09
**Success Criteria** (what must be TRUE):
  1. /settings is reachable from the sidebar and renders a five-tab layout; switching tabs updates the visible content without a page reload.
  2. Company tab renders all specified fields (logo upload, colour picker, name, about, industry, website, HQ, company size) as interactive form controls.
  3. Email & Comms tab shows Gmail connection status, sender name field, four email template editors (each with subject/heading/body/footer fields and placeholder pills), and three automated send rule toggles.
  4. Interviews tab shows a default round count selector and per-round default rows (theme, duration, voice, avatar toggle).
  5. Scoring tab shows four hiring bar preset cards (Growth / Standard / High Bar / Elite) as selectable cards and per-round threshold number inputs.
  6. Job Boards tab shows connection cards for LinkedIn, Indeed, Glassdoor, and Bayt.com with enable toggles; no OAuth flow is triggered.
  7. No field value persists after a page refresh (UI shell only — SETT-09 is satisfied by design).
**Plans**: TBD

Plans:
- [ ] 04-01: Create /settings route, page shell, and five-tab navigation component
- [ ] 04-02: Implement Company tab (logo upload UI, colour picker, all profile fields)
- [ ] 04-03: Implement Email & Comms tab (Gmail status, sender field, template editors with placeholder pills, send rule toggles)
- [ ] 04-04: Implement Interviews tab (round count selector, per-round defaults) and Scoring tab (preset cards, threshold inputs)
- [ ] 04-05: Implement Job Boards tab (platform connection cards with enable toggles)

---

### Phase 5: Jobs Page Refresh

**Goal**: HR manager sees the Jobs page with status tabs, visually distinct job cards (color-coded border, candidate count pill, skill chips, action row) that match the Stitch reference.
**Depends on**: Phase 1
**Requirements**: JOBS-01, JOBS-02, JOBS-03, JOBS-04, JOBS-05
**Success Criteria** (what must be TRUE):
  1. Jobs page shows an Active / Inactive / All tab strip with live counts; the active tab filters the displayed cards.
  2. Each job card has a left border that is green for active jobs and gray for inactive jobs, visible without hovering.
  3. Each job card shows a candidate count progress pill and displays skills as compact chips with a "+N more" overflow label when there are more than 8 skills.
  4. Each job card footer row shows the created date, an active/inactive toggle, an edit button, and a "View Candidates →" link that navigates to the dashboard filtered to that job.
**Plans**: TBD

Plans:
- [ ] 05-01: Add status tab strip (Active / Inactive / All with counts) and filter logic to jobs page
- [ ] 05-02: Rebuild job card component (left border, candidate count pill, skill chips with overflow, footer action row)

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5
(Phases 2, 3, and 4 all depend on Phase 1 only — they may be executed in any order after Phase 1 completes.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dashboard Rebuild | 2/3 | In Progress|  |
| 2. Candidate Panel Slide-Over | 0/4 | Not started | - |
| 3. Create Job Wizard | 0/6 | Not started | - |
| 4. Settings Panel | 0/5 | Not started | - |
| 5. Jobs Page Refresh | 0/2 | Not started | - |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 1 | Planned |
| DASH-02 | Phase 1 | Planned |
| DASH-03 | Phase 1 | Planned |
| DASH-04 | Phase 1 | Planned |
| DASH-05 | Phase 1 | Planned |
| PANEL-01 | Phase 2 | Pending |
| PANEL-02 | Phase 2 | Pending |
| PANEL-03 | Phase 2 | Pending |
| PANEL-04 | Phase 2 | Pending |
| PANEL-05 | Phase 2 | Pending |
| PANEL-06 | Phase 2 | Pending |
| PANEL-07 | Phase 2 | Pending |
| PANEL-08 | Phase 2 | Pending |
| JOB-01 | Phase 3 | Pending |
| JOB-02 | Phase 3 | Pending |
| JOB-03 | Phase 3 | Pending |
| JOB-04 | Phase 3 | Pending |
| JOB-05 | Phase 3 | Pending |
| JOB-06 | Phase 3 | Pending |
| JOB-07 | Phase 3 | Pending |
| JOB-08 | Phase 3 | Pending |
| JOB-09 | Phase 3 | Pending |
| SETT-01 | Phase 4 | Pending |
| SETT-02 | Phase 4 | Pending |
| SETT-03 | Phase 4 | Pending |
| SETT-04 | Phase 4 | Pending |
| SETT-05 | Phase 4 | Pending |
| SETT-06 | Phase 4 | Pending |
| SETT-07 | Phase 4 | Pending |
| SETT-08 | Phase 4 | Pending |
| SETT-09 | Phase 4 | Pending |
| JOBS-01 | Phase 5 | Pending |
| JOBS-02 | Phase 5 | Pending |
| JOBS-03 | Phase 5 | Pending |
| JOBS-04 | Phase 5 | Pending |
| JOBS-05 | Phase 5 | Pending |

**v1 requirements: 34 total | Mapped: 34 | Unmapped: 0**

---
*Roadmap created: 2026-03-10*
*Milestone: v2.0 — Stitch UI Implementation*
