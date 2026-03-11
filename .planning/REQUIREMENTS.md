# Requirements: SynchroHire v2.0 — Stitch UI Implementation

**Defined:** 2026-03-10
**Core Value:** HR managers can screen, score, and progress candidates through a full AI interview pipeline without manual intervention.

## v1 Requirements

### Dashboard

- [x] **DASH-01**: HR manager sees pipeline funnel stats as connected cards with conversion percentages
- [x] **DASH-02**: HR manager can click a funnel stat card to filter the candidate table to that stage
- [x] **DASH-03**: Candidate table rows display avatar circle with initials, name, email, role, applied date, R1/R2 score bars, stage badge, and action icons
- [x] **DASH-04**: Candidate table rows show hover state (background highlight) and row-level action icons (View / Invite / Reject)
- [ ] **DASH-05**: HR manager can filter candidates by stage using tab strip (All / R1 Pending / R1 Done / R2 / Final)

### Candidate Panel

- [ ] **PANEL-01**: Clicking a candidate row opens a right-side slide-over panel (640px, full height) instead of the current modal
- [ ] **PANEL-02**: Slide-over shows candidate header (avatar, name, role, applied date, location, stage badge)
- [ ] **PANEL-03**: Slide-over shows R1 and R2 score gauges side-by-side with pass/fail label
- [ ] **PANEL-04**: Slide-over shows Final Verdict banner (Strong Hire / Hire / Borderline / No Hire) with AI summary text
- [ ] **PANEL-05**: Slide-over shows Strengths and Gaps two-column grid from AI analysis
- [ ] **PANEL-06**: Slide-over shows interview recordings section with R1 and R2 video cards and inline player
- [ ] **PANEL-07**: Slide-over shows Round 1 and Round 2 transcript accordions (expandable)
- [ ] **PANEL-08**: Slide-over footer has pinned action buttons (Invite to R2 / Reject / Add Note)

### Create Job Wizard

- [x] **JOB-01**: HR manager can create a job via a 6-step wizard: Basics → Requirements → AI Generate → Interview Config → Screening → Scoring & Publish
- [ ] **JOB-02**: Step 1 (Basics) captures job title, department, location, work arrangement, employment type, urgency, headcount, target start date
- [ ] **JOB-03**: Step 2 (Requirements) captures salary range, education, experience, must-have skills (chips), nice-to-have skills (chips), visa sponsorship toggle
- [ ] **JOB-04**: Step 3 (AI Generate) generates a job description from entered details with a refine text field and live preview
- [ ] **JOB-05**: Step 4 (Interview Config) lets HR configure number of rounds (1/2/3) and per-round theme, duration, voice, and avatar toggle
- [ ] **JOB-06**: Step 5 (Screening) shows AI-generated eligibility questions (Yes/No) that HR can edit, remove, or add to
- [ ] **JOB-07**: Step 6 (Scoring) lets HR select a hiring bar preset (Growth 35+ / Standard 50+ / High Bar 75+ / Elite 90+) and publish the job
- [x] **JOB-08**: Wizard sidebar shows step progress with completed (emerald ✓), active (indigo), and pending (gray) states
- [ ] **JOB-09**: HR manager can save a job as draft at any wizard step

### Settings Panel

- [ ] **SETT-01**: New /settings page accessible from sidebar with 5 tabs: Company, Email & Comms, Interviews, Scoring, Job Boards
- [ ] **SETT-02**: Company tab shows logo upload, brand colour picker, company name, about, industry, website, HQ, company size fields
- [ ] **SETT-03**: Email & Comms tab shows Gmail connection status, sender display name, and 4 email template editors (Interview Invite / Follow-up / Rejection / Shortlist)
- [ ] **SETT-04**: Email template editor shows subject, heading, body, footer fields with {{variable}} placeholder pills displayed below each field
- [ ] **SETT-05**: Email & Comms tab shows automated send rules with toggles (auto-send on pass, follow-up reminder, auto-reject)
- [ ] **SETT-06**: Interviews tab shows default round count selector and per-round defaults (theme, duration, voice, avatar)
- [ ] **SETT-07**: Scoring tab shows hiring bar preset cards (Growth / Standard / High Bar / Elite) and per-round custom threshold inputs
- [ ] **SETT-08**: Job Boards tab shows LinkedIn, Indeed, Glassdoor, Bayt.com connection cards with enable toggles
- [ ] **SETT-09**: All settings tabs are UI-only in v2.0 (no backend persistence — values do not save to database)

### Jobs Page

- [ ] **JOBS-01**: Jobs page has tab strip: Active / Inactive / All with counts
- [ ] **JOBS-02**: Each job card has a left border: green for active, gray for inactive
- [ ] **JOBS-03**: Each job card shows candidate count as a progress pill
- [ ] **JOBS-04**: Each job card shows skills as compact chips (max 8, +N more overflow)
- [ ] **JOBS-05**: Each job card footer row shows created date, active toggle, edit button, and "View Candidates →" link

## v2 Requirements (deferred to v2.1)

### Settings Backend

- **SETT-BE-01**: Company profile settings persist to database and load on page mount
- **SETT-BE-02**: Email template changes persist and are used when sending candidate emails
- **SETT-BE-03**: Interview defaults persist and pre-populate Create Job wizard

### Interview Config Wiring

- **JOB-BE-01**: Per-job round config (theme, duration, voice, avatar) saves to jobs table
- **JOB-BE-02**: Interview pages (/interview/[token], /round2/[token]) read and apply per-job config
- **JOB-BE-03**: Scoring threshold from wizard saves to jobs table and affects pipeline filtering

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant isolation | v3.0 — requires DB schema changes and auth overhaul |
| Mobile responsive design | HR tool used on desktop only |
| Job board API auto-posting | Requires LinkedIn/Indeed API keys and OAuth — future |
| OAuth social login | Email/password sufficient |
| Candidate-facing settings changes | Interview pages are public, settings are HR-only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 1 | Complete |
| DASH-02 | Phase 1 | Complete |
| DASH-03 | Phase 1 | Complete |
| DASH-04 | Phase 1 | Complete |
| DASH-05 | Phase 1 | Pending |
| PANEL-01 | Phase 2 | Pending |
| PANEL-02 | Phase 2 | Pending |
| PANEL-03 | Phase 2 | Pending |
| PANEL-04 | Phase 2 | Pending |
| PANEL-05 | Phase 2 | Pending |
| PANEL-06 | Phase 2 | Pending |
| PANEL-07 | Phase 2 | Pending |
| PANEL-08 | Phase 2 | Pending |
| JOB-01 | Phase 3 | Complete |
| JOB-02 | Phase 3 | Pending |
| JOB-03 | Phase 3 | Pending |
| JOB-04 | Phase 3 | Pending |
| JOB-05 | Phase 3 | Pending |
| JOB-06 | Phase 3 | Pending |
| JOB-07 | Phase 3 | Pending |
| JOB-08 | Phase 3 | Complete |
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

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
