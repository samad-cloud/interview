---
phase: 04-settings-panel
plan: 02
subsystem: frontend/settings
tags: [settings, company-profile, logo-upload, colour-picker, ui-shell]
dependency_graph:
  requires: [04-01]
  provides: [CompanyTab component, company tab populated]
  affects: [frontend/app/settings/page.tsx]
tech_stack:
  added: []
  patterns: [URL.createObjectURL, native color input, controlled inputs, useEffect cleanup]
key_files:
  created:
    - frontend/components/settings/CompanyTab.tsx
  modified:
    - frontend/app/settings/page.tsx
decisions:
  - "Brand colour swatch uses style={{ backgroundColor: brandColor }} — never dynamic Tailwind class interpolation"
  - "URL.revokeObjectURL called via ref in useEffect cleanup to avoid stale closure leak"
  - "No Supabase writes — all state is local useState (UI shell per SETT-09)"
metrics:
  duration: "5 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 4 Plan 02: Company Tab — Summary

**One-liner:** Company profile tab with logo upload preview via `URL.createObjectURL`, native colour picker with live swatch, and six controlled form fields — all local state, no persistence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create CompanyTab component | ec40654 | frontend/components/settings/CompanyTab.tsx |
| 2 | Wire CompanyTab into settings page | 4db9ccd | frontend/app/settings/page.tsx |

## What Was Built

`frontend/components/settings/CompanyTab.tsx` — a `'use client'` component providing:

- **Logo upload card**: dashed-border box that triggers a hidden `<input type="file" accept="image/*">` on click. When a file is selected, `URL.createObjectURL(file)` is stored in state and rendered as an `<img>` preview. The previous object URL is revoked before the new one is set, and a `useEffect` cleanup revokes the URL on unmount via a ref.
- **Brand colour picker row**: native `<input type="color">` with `value={brandColor}`, paired with a swatch `<div style={{ backgroundColor: brandColor }}>` that updates in real time.
- **Six controlled fields**: Company Name (Input), About (textarea matching Input style), Industry (Select), Website (Input type="url"), HQ Location (Input), Company Size (Select).
- **Save Changes button**: wired up as a UI shell — `onClick` does nothing (persistence is SETT-09, a future plan).
- **Layout**: two-column grid (`grid-cols-1 lg:grid-cols-3`) — logo/colour in left column, fields in right column.

`frontend/app/settings/page.tsx` — Company `TabsContent` placeholder replaced with `<CompanyTab />`.

## Verification

- `CompanyTab.tsx` exists: PASS
- No dynamic Tailwind hex class interpolation (`bg-[${brandColor}]`): PASS
- No Supabase imports or write calls: PASS
- `style={{ backgroundColor: brandColor }}` used for swatch: PASS (line 92)
- `yarn tsc --noEmit`: zero errors
- `yarn build`: passes clean

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `frontend/components/settings/CompanyTab.tsx` — FOUND
- `frontend/app/settings/page.tsx` — modified with CompanyTab import and usage
- Commit ec40654 — FOUND (feat(04-02): create CompanyTab component)
- Commit 4db9ccd — FOUND (feat(04-02): wire CompanyTab into settings page)
