---
phase: 3
slug: create-job-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (no test framework installed) |
| **Config file** | `frontend/tsconfig.json` |
| **Quick run command** | `cd frontend && yarn build 2>&1 \| tail -20` |
| **Full suite command** | `cd frontend && yarn build 2>&1 \| tail -20` |
| **Estimated runtime** | ~30 seconds |

> No Jest, Vitest, Playwright, or Cypress is installed. The project deliberately has no automated test suite. TypeScript build is the authoritative validation gate.

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && yarn build 2>&1 | tail -20`
- **After every plan wave:** Run `cd frontend && yarn build 2>&1 | tail -20`
- **Before `/gsd:verify-work`:** Full build must be green (zero TypeScript errors)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 03-01-* | 01 | 1 | JOB-01, JOB-08 | build | `cd frontend && yarn build 2>&1 \| tail -20` | ⬜ pending |
| 03-02-* | 02 | 1 | JOB-02, JOB-03 | build | `cd frontend && yarn build 2>&1 \| tail -20` | ⬜ pending |
| 03-03-* | 03 | 2 | JOB-04 | build | `cd frontend && yarn build 2>&1 \| tail -20` | ⬜ pending |
| 03-04-* | 04 | 2 | JOB-05 | build | `cd frontend && yarn build 2>&1 \| tail -20` | ⬜ pending |
| 03-05-* | 05 | 2 | JOB-06 | build | `cd frontend && yarn build 2>&1 \| tail -20` | ⬜ pending |
| 03-06-* | 06 | 3 | JOB-07, JOB-09 | build | `cd frontend && yarn build 2>&1 \| tail -20` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

> No test stubs to create — project has no test framework. TypeScript build serves as the sole automated gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar progress shows emerald/indigo/gray correctly | JOB-08 | Visual rendering cannot be verified by build | Load /create-job, advance through steps, confirm color states visually |
| Draft persists across page reload | JOB-09 | localStorage behavior requires browser | Fill step 1, click Save as Draft, reload, verify fields restored |
| AI description generates and previews | JOB-04 | Requires live AI call + rendering | Complete steps 1-2, click Generate, verify preview renders |
| Screening questions editable list | JOB-06 | UI interaction | Verify add/remove/edit controls work on AI-generated questions |
| Publish creates job and redirects | JOB-07 | Requires Supabase live insert | Complete all steps, click Publish, verify redirect to /jobs and new job appears |
| Interview Config round count selector | JOB-05 | UI state interaction | Toggle 1/2/3 rounds, verify per-round config rows appear/disappear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
