---
phase: 2
slug: candidate-panel-slide-over
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no jest/vitest/pytest detected |
| **Config file** | none — no test framework installed |
| **Quick run command** | `cd frontend && yarn build` |
| **Full suite command** | `cd frontend && yarn build && yarn lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && yarn build`
- **After every plan wave:** Run `cd frontend && yarn build && yarn lint`
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser smoke test
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | PANEL-01 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 1 | PANEL-01 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 2 | PANEL-02, PANEL-03, PANEL-04, PANEL-05 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 2 | PANEL-02, PANEL-03, PANEL-04, PANEL-05 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 3 | PANEL-06, PANEL-07 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 3 | PANEL-06, PANEL-07 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-04-01 | 02-04 | 4 | PANEL-08 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-04-02 | 02-04 | 4 | PANEL-08 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |
| 02-04-03 | 02-04 | 4 | PANEL-08 | manual | `cd frontend && yarn build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework installation required. All Phase 2 requirements are UI interaction behaviors verified via TypeScript compilation + manual browser testing.

- `cd frontend && yarn build` — TypeScript gate; must pass after every task
- Manual browser smoke test at phase gate (all 8 PANEL success criteria)

*Wave 0 complete: no stubs or fixtures needed — yarn build is the automated gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide-over opens on row click, closes on Escape/overlay click | PANEL-01 | UI interaction — no test framework | Open dashboard, click a row, verify 640px panel slides in from right. Press Escape — panel closes. Click overlay — panel closes. Scroll table — position preserved. |
| Header: avatar, name, role, date, stage badge | PANEL-02 | Visual rendering | Open panel for a candidate. Verify gradient avatar circle with initials, name, email, role, applied date, stage badge all present in header. |
| Score gauges side-by-side with pass/fail label | PANEL-03 | Visual rendering | Verify R1 and R2 SVG radial gauges render side-by-side. Scores ≥70 show green "PASS", below show red "FAIL". |
| Final Verdict banner with tier color + AI summary | PANEL-04 | Visual rendering | Verify banner shows one of: Strong Hire (green), Hire (indigo), Maybe (yellow), No Hire (red). AI summary text rendered beneath. |
| Strengths and Gaps two-column grid | PANEL-05 | Visual rendering | Verify strengths list (green bullets) and gaps list (red bullets) display in a 2-column grid below the verdict banner. |
| Recording cards with inline VideoPlayer toggle | PANEL-06 | UI interaction | Click "Show Recording" on a recording card — VideoPlayer expands inline. Click again — collapses. |
| Transcript accordions expand/collapse | PANEL-07 | UI interaction | Click Round 1 transcript header — accordion opens showing transcript text. Click again — closes. Same for Round 2. |
| Footer pinned with correct action buttons | PANEL-08 | Visual + interaction | Scroll panel content — footer stays fixed at bottom. Invite button label is stage-aware (R2 or R3). Reject wires to handler. Add Note expands inline textarea. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (`yarn build`) per task
- [x] Sampling continuity: `yarn build` runs after every task commit
- [x] Wave 0 covers all MISSING references (no stubs needed — TypeScript is the gate)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter ← set after phase gate passes

**Approval:** pending
