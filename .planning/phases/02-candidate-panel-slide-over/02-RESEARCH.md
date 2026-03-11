# Phase 2: Candidate Panel Slide-Over — Research

**Researched:** 2026-03-11
**Domain:** React slide-over panel, Tailwind CSS 4, shadcn/ui, SVG score gauges, accordion expand/collapse, inline video
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PANEL-01 | Clicking a candidate row opens a right-side slide-over panel (640px, full height) instead of the current modal | Custom slide-over shell using fixed positioning + CSS translate transition; no Sheet component needed |
| PANEL-02 | Slide-over shows candidate header (avatar, name, role, applied date, location, stage badge) | Re-use AVATAR_GRADIENTS + getInitials patterns from CandidateTableRow.tsx |
| PANEL-03 | Slide-over shows R1 and R2 score gauges side-by-side with pass/fail label | SVG radial gauge pattern already proven in existing modal (page.tsx lines 1603–1654) |
| PANEL-04 | Slide-over shows Final Verdict banner (Strong Hire / Hire / Borderline / No Hire) with AI summary text | Playground shows gradient border-left banner with tier color; data from `full_verdict` JSONB column |
| PANEL-05 | Slide-over shows Strengths and Gaps two-column grid from AI analysis | Data from `full_verdict.technicalStrengths` + `full_verdict.technicalGaps` and `round_1_full_dossier.candidateStrengths` |
| PANEL-06 | Slide-over shows interview recordings section with R1 and R2 video cards and inline player | Existing `VideoPlayer` component at `frontend/components/VideoPlayer.tsx` handles full playback |
| PANEL-07 | Slide-over shows Round 1 and Round 2 transcript accordions (expandable) | Custom accordion using React `useState` open/close toggle; no Radix Accordion installed |
| PANEL-08 | Slide-over footer has pinned action buttons (Invite to R2 / Reject / Add Note) wired to existing handlers | `handleInviteRound2`, `handleRejectClick`, `handleSaveNote` already exist in page.tsx |
</phase_requirements>

---

## Summary

Phase 2 replaces the existing `<Dialog>`-based candidate modal in `frontend/app/dashboard/page.tsx` with a 640px right-side slide-over panel. The slide-over must be a custom component — there is no shadcn `Sheet` or Radix Drawer installed in the project. The correct approach is a fixed-positioned overlay div + a panel div that slides in via CSS `translateX` transition, matching the pattern already demonstrated in the playground HTML (`synchrohire-playground.html`, lines 683–704).

All the data the panel needs already exists in the `Candidate` interface: `rating`, `round_2_rating`, `full_verdict` (JSONB with `technicalStrengths`, `technicalGaps`, `summary`, `verdict`), `round_1_full_dossier` (JSONB with `candidateStrengths`, `areasToProbe`), `interview_transcript`, `round_2_transcript`, `video_url`, `round_2_video_url`. No database changes are required. The existing `VideoPlayer` component handles inline video playback. The SVG radial gauge pattern is already proven in the current modal.

The phase decomposes cleanly into four plans: (1) slide-over shell with open/close mechanics and overlay, (2) header + score gauges + verdict banner + strengths/gaps grid, (3) recordings section with inline player and transcript accordions, (4) pinned footer action bar wired to existing handlers. The current modal can be removed once the slide-over is wired to `setSelectedCandidate`.

**Primary recommendation:** Build a `CandidatePanel` component in `frontend/components/dashboard/CandidatePanel.tsx`. The component receives `candidate: Candidate | null` and `onClose: () => void` as props. Use a fixed overlay + translateX animation. Wire it in `page.tsx` in place of the existing `<Dialog>`.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component state, open/close, accordion toggle | Already installed |
| Tailwind CSS | ^4 | All layout, spacing, color tokens | Already installed |
| shadcn/ui Button | current | Footer action buttons | Already installed |
| shadcn/ui Badge | current | Stage badge in header | Already installed |
| shadcn/ui Separator | current | Section dividers inside panel | Already installed |
| Lucide React | ^0.563.0 | X close icon, chevron for accordion, video icon | Already installed |
| VideoPlayer | project | Inline interview recording playback | Already in `components/VideoPlayer.tsx` |

### Not Needed / Not Installed

| Component | Status | Why Not Used |
|-----------|--------|-------------|
| shadcn Sheet | NOT installed | No `@radix-ui/react-dialog` variant for Sheet; build custom slide-over |
| shadcn Accordion | NOT installed | No `@radix-ui/react-accordion` in package.json; build simple toggle |
| shadcn ScrollArea | NOT installed | Native `overflow-y-auto` on panel body is sufficient |
| framer-motion | NOT installed | CSS `transition: transform 300ms cubic-bezier(0.16,1,0.3,1)` matches playground spec |

**Installation:** No new packages required. Zero install step.

---

## Architecture Patterns

### Recommended File Structure

```
frontend/components/dashboard/
├── FunnelRow.tsx              # Phase 1 — existing
├── CandidateTableRow.tsx      # Phase 1 — existing
├── StageTabStrip.tsx          # Phase 1 — existing
└── CandidatePanel.tsx         # Phase 2 — NEW (entire slide-over)
```

The `CandidatePanel` is a single file because all sub-sections (header, gauges, verdict, strengths/gaps, recordings, transcripts, footer) are tightly coupled to the same `Candidate` prop. Internal sub-components (`ScoreGauge`, `StrengthsGaps`, `TranscriptAccordion`, `RecordingSection`) are defined in the same file for locality, not exported.

### Pattern 1: Fixed Overlay + CSS Translate Slide-Over

**What:** Full-screen semi-transparent overlay with a panel that translates in from the right.
**When to use:** Any right-side drawer/slide-over in this project.

```typescript
// Source: synchrohire-playground.html lines 683-704 (adapted to React/Tailwind)

// Overlay — closes on click outside
<div
  className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
    open ? 'opacity-100' : 'opacity-0 pointer-events-none'
  }`}
  onClick={onClose}
/>

// Panel — slides from right
<div
  className={`fixed right-0 top-0 bottom-0 z-50 w-[640px] bg-[#0F172A] border-l border-[#1E293B]
    flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[-20px_0_60px_rgba(0,0,0,0.5)]
    ${open ? 'translate-x-0' : 'translate-x-full'}`}
>
  {/* so-header: flex-shrink-0 */}
  {/* so-body: flex-1 overflow-y-auto */}
  {/* so-footer: flex-shrink-0, border-top */}
</div>
```

**Key points:**
- Panel is `position: fixed`, not relative to any parent — renders above the table without scroll-jacking.
- Body section uses `flex-1 overflow-y-auto` so footer stays pinned (PANEL-08).
- `pointer-events-none` on closed overlay prevents click-through blocking.

### Pattern 2: SVG Radial Score Gauge

**What:** SVG circle with stroke-dashoffset to render a percentage arc.
**When to use:** R1 and R2 score display in panel (PANEL-03).

```typescript
// Source: page.tsx lines 1603-1654 (existing modal — extract directly)
// r = 30, circumference = 2π × 30 = 188.5 (matches playground viewBox 72x72)

function ScoreGauge({ label, score, passing }: { label: string; score: number | null; passing: boolean }) {
  const r = 30;
  const circ = 2 * Math.PI * r; // 188.5
  const offset = score !== null ? circ - (score / 100) * circ : circ;
  const stroke = score === null ? '#1E293B' : score >= 70 ? '#10B981' : score >= 50 ? '#FCD34D' : '#EF4444';
  return (
    <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-4 flex flex-col items-center gap-2.5">
      <div className="text-[12px] font-semibold text-[#F9FAFB]">{label}</div>
      <div className="relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1E293B" strokeWidth="6" />
          {score !== null && (
            <circle cx="36" cy="36" r={r} fill="none" stroke={stroke} strokeWidth="6"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-[#F9FAFB]">
          {score ?? '—'}
        </div>
      </div>
      <div className="text-[11px]" style={{ color: passing ? '#10B981' : '#EF4444' }}>
        {score === null ? 'Pending' : passing ? '✓ Passed' : '✗ Below threshold'}
      </div>
    </div>
  );
}
```

### Pattern 3: Verdict Banner

**What:** Gradient-border-left card showing hire tier and AI summary text.
**When to use:** Final Verdict display (PANEL-04).

```typescript
// Source: synchrohire-playground.html lines 766-784
// Four tiers: Strong Hire (#818CF8), Hire (#60A5FA), Borderline (#FCD34D), No Hire (#EF4444)

const VERDICT_COLORS: Record<string, string> = {
  'Strong Hire': '#818CF8',
  'Hire': '#60A5FA',
  'Borderline': '#FCD34D',
  'No Hire': '#EF4444',
};

// Banner style: gradient bg + left border colored per tier
<div className="rounded-[10px] p-[14px_16px]"
  style={{
    background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.08))',
    border: `1px solid rgba(99,102,241,0.3)`,
    borderLeft: `3px solid ${VERDICT_COLORS[verdict] ?? '#6366F1'}`,
  }}>
  <div className="text-[14px] font-bold flex items-center gap-1.5 mb-1.5"
    style={{ color: VERDICT_COLORS[verdict] ?? '#818CF8' }}>
    {verdict}
  </div>
  <p className="text-[12px] text-[#D1D5DB] leading-relaxed">{summary}</p>
</div>
```

### Pattern 4: Strengths/Gaps Two-Column Grid

**What:** Two cards side-by-side — emerald for strengths, red for gaps.
**When to use:** PANEL-05.

```typescript
// Source: synchrohire-playground.html lines 786-810
// Data source: full_verdict.technicalStrengths / full_verdict.technicalGaps
// Fallback to round_1_full_dossier.candidateStrengths / round_1_full_dossier.areasToProbe

<div className="grid grid-cols-2 gap-3">
  <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-3">
    <p className="text-[11px] font-bold uppercase tracking-wide text-[#10B981] mb-2">Strengths</p>
    {strengths.map((s, i) => (
      <div key={i} className="text-[12px] text-[#D1D5DB] py-1 flex items-start gap-1.5">
        <span className="text-[#10B981]">✓</span>{s}
      </div>
    ))}
  </div>
  <div className="bg-[#1A2332] border border-[#1E293B] rounded-[10px] p-3">
    <p className="text-[11px] font-bold uppercase tracking-wide text-[#EF4444] mb-2">Gaps</p>
    {gaps.map((g, i) => (
      <div key={i} className="text-[12px] text-[#D1D5DB] py-1 flex items-start gap-1.5">
        <span className="text-[#EF4444]">✗</span>{g}
      </div>
    ))}
  </div>
</div>
```

### Pattern 5: Video Card + Inline Player Toggle

**What:** Thumbnail cards for R1/R2 that reveal the `VideoPlayer` component when clicked.
**When to use:** PANEL-06.

```typescript
// VideoPlayer is already in components/VideoPlayer.tsx — accepts: src, title, className
// Pattern: useState for which round is "active"; show/hide VideoPlayer below the cards

const [activeRecording, setActiveRecording] = useState<'r1' | 'r2' | null>(null);

// Card click: setActiveRecording('r1') or toggle off if already active
// VideoPlayer renders below card row when activeRecording !== null
{activeRecording && (
  <VideoPlayer
    src={activeRecording === 'r1' ? candidate.video_url! : candidate.round_2_video_url!}
    title={activeRecording === 'r1' ? 'Round 1 — Personality' : 'Round 2 — Technical'}
    className="mt-2"
  />
)}
```

### Pattern 6: Simple Expand/Collapse Transcript Accordion

**What:** Click-to-toggle transcript row (no Radix Accordion — not installed).
**When to use:** PANEL-07.

```typescript
// No @radix-ui/react-accordion in package.json — implement with useState

const [r1Open, setR1Open] = useState(false);
const [r2Open, setR2Open] = useState(false);

function TranscriptAccordion({ label, transcript, isOpen, onToggle }) {
  return (
    <div className="bg-[#1A2332] border border-[#1E293B] rounded-lg overflow-hidden">
      <button
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-[12px] hover:bg-[#1E293B] transition-colors"
        onClick={onToggle}
      >
        <span className="text-[#F9FAFB]">{label}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-[#1E293B] text-[12px] text-[#94A3B8] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {transcript || 'No transcript available.'}
        </div>
      )}
    </div>
  );
}
```

### Pattern 7: Pinned Footer

**What:** Footer that stays at the bottom of the panel while the body scrolls (PANEL-08).

```typescript
// Key: outer panel is flex-col; body is flex-1 overflow-y-auto; footer is flex-shrink-0
// Footer is OUTSIDE the scrollable body div

<div className="px-5 py-3 border-t border-[#1E293B] flex gap-2 flex-shrink-0">
  <Button size="sm" className="bg-[#6366F1] hover:bg-[#4F46E5] text-white h-[34px] text-[12px]">
    Invite to R2
  </Button>
  <Button size="sm" variant="outline" className="border-[#EF4444] text-[#EF4444] hover:bg-red-500/10 h-[34px] text-[12px]">
    Reject
  </Button>
  <Button size="sm" variant="outline" className="border-[#1E293B] h-[34px] text-[12px]">
    Add Note
  </Button>
</div>
```

### Pattern 8: Keyboard Dismiss (Escape key)

**What:** Close slide-over on Escape key press (required by PANEL-01).

```typescript
// Add in CandidatePanel or in page.tsx when panel is open
useEffect(() => {
  if (!open) return;
  const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}, [open, onClose]);
```

### Pattern 9: Preserving Table Scroll Position

**What:** The fixed overlay must NOT affect table scroll position (required by PANEL-01).
**Why it works:** Using `position: fixed` for both overlay and panel means they are removed from normal document flow. The table scroll position is on the `.overflow-y-auto` container inside the dashboard content area — not on `<body>`. Fixed positioning does not interact with this scroll container, so scroll position is preserved automatically.

**Anti-pattern to avoid:** Using `overflow: hidden` on `<body>` when panel opens — this would cause a layout shift and reset scroll. Do not add body overflow manipulation.

### Pattern 10: Integration into page.tsx

**What:** Replace the existing `<Dialog>` modal with `<CandidatePanel>`.

```typescript
// In page.tsx — replace the <Dialog open={!!selectedCandidate}...> block with:
<CandidatePanel
  candidate={selectedCandidate}
  open={!!selectedCandidate}
  onClose={() => { setSelectedCandidate(null); setInterviewNotes(null); }}
  onInviteR2={(id) => handleInviteRound2(id)}
  onReject={(id) => handleRejectClick({ id } as Candidate)}
  onSaveNote={(id, text) => handleSaveNote(id)}
/>
```

### Anti-Patterns to Avoid

- **Using `<Dialog>` as the slide-over:** Dialog centers content; it does not slide from the right. The existing Dialog must be replaced.
- **Adding `overflow: hidden` to `<body>`:** Causes layout shift and resets table scroll position.
- **Installing shadcn Sheet just for this:** Sheet is thin wrapper over Dialog — same positioning limitation applies. Build custom.
- **Dynamic Tailwind class names for colors:** Already established in Phase 1 — use `style={{}}` for hex color values, not template literals in className (Tailwind v4 purge will remove them in production).
- **Importing `getStageDisplay` from page.tsx:** It is not exported. Define `getStageBadge()` inline in `CandidatePanel.tsx` (same approach as `CandidateTableRow.tsx`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video playback | Custom `<video>` element with controls | `VideoPlayer` component at `components/VideoPlayer.tsx` | Already has play/pause, scrub, volume, speed, fullscreen |
| Score ring animation | Custom canvas or CSS animation | SVG stroke-dashoffset pattern | Already proven in existing modal, smooth transition built-in |
| Stage badge colors | New color lookup table | `getStageBadge()` pattern from `CandidateTableRow.tsx` | Consistent status-to-color mapping already exists |
| Avatar gradient | New avatar system | `getInitials()` + `getAvatarGradient()` + `AVATAR_GRADIENTS` from `CandidateTableRow.tsx` | Deterministic per-name gradient, already tested |

**Key insight:** Substantial reuse is available. The ScoreGauge logic can be extracted verbatim from the existing modal. The avatar, badge, and action handler patterns are identical to CandidateTableRow. The VideoPlayer is already production-ready.

---

## Common Pitfalls

### Pitfall 1: Dynamic Color Strings in Tailwind v4

**What goes wrong:** Writing `className={`border-[${color}]`}` or `className={`text-${status}-400`}` — Tailwind v4 purges these in production because the full class name is not known at build time.
**Why it happens:** Tailwind scans source files as strings to build the CSS bundle. Dynamic class names assembled at runtime are not present as static strings.
**How to avoid:** Use `style={{ color: hex, borderColor: hex }}` for any per-candidate hex color. See Phase 1 decision: "FunnelCard uses style={{color}} for hex colors to avoid Tailwind purge in production."
**Warning signs:** Colors render in dev but disappear in production builds.

### Pitfall 2: Panel Flicker on Mount

**What goes wrong:** Panel renders visible for one frame before the CSS transition runs, causing a flash.
**Why it happens:** If `translate-x-full` is applied via a class that depends on a boolean that starts as `false`, but the element is already mounted, the initial render may flash before the transition class kicks in.
**How to avoid:** Always mount the panel with the closed state (`translate-x-full`) applied. Only change to `translate-x-0` after mount, driven by the `open` prop. Use `pointer-events-none` + `opacity-0` on the overlay for the closed state so the hidden panel cannot receive clicks even if the transition hasn't completed.

### Pitfall 3: Missing Null Guards on JSONB Fields

**What goes wrong:** `candidate.full_verdict.technicalStrengths.map(...)` throws when `full_verdict` is null (candidate has not completed R2 yet).
**Why it happens:** `full_verdict`, `round_1_full_dossier`, `round_3_full_verdict` are nullable JSONB columns that only populate after the respective round completes.
**How to avoid:** Use optional chaining throughout: `candidate.full_verdict?.technicalStrengths ?? []`. Show an empty state ("Analysis pending") when null. The existing modal handles this with conditional rendering patterns that can be followed directly.
**Warning signs:** TypeScript errors on `full_verdict.property` (if `full_verdict: FullVerdict | null` is typed correctly, TypeScript will enforce this).

### Pitfall 4: Footer Not Pinned (Scrolls Away)

**What goes wrong:** Action buttons scroll off-screen when panel content is long.
**Why it happens:** Wrapping both the scrollable body AND footer inside the `overflow-y-auto` div.
**How to avoid:** The outer panel is `flex flex-col`. The scrollable body is `flex-1 overflow-y-auto`. The footer is a sibling of the body (NOT inside it) and is `flex-shrink-0`. This is the same pinned-footer pattern used in mobile UIs and confirmed by the playground HTML structure.

### Pitfall 5: Score Ring Wrong Dimensions

**What goes wrong:** Ring renders distorted or the arc doesn't match the percentage.
**Why it happens:** The circumference formula `2 × π × r` must match the SVG viewBox and `r` attribute. The playground uses `r=30` in a `viewBox="0 0 72 72"` SVG (72×72 element size), giving `circumference = 188.5`. The existing modal uses `r=40` in a `viewBox="0 0 96 96"` (80×80 element). These are two different valid configurations — do not mix them.
**How to avoid:** Use the playground specification: `r=30, viewBox="0 0 72 72", element 72×72, circumference=188.5`. This matches the design reference exactly.

### Pitfall 6: Escape Key Handler Memory Leak

**What goes wrong:** Multiple Escape key listeners accumulate if the panel reopens multiple times.
**Why it happens:** `addEventListener` in a `useEffect` without returning a cleanup function.
**How to avoid:** Always return `() => document.removeEventListener('keydown', handleKey)` from the effect. Depend only on `[open, onClose]` in the dependency array.

### Pitfall 7: `getStageDisplay` Import Attempt

**What goes wrong:** Trying to import `getStageDisplay` from `page.tsx` for the stage badge in the panel header.
**Why it happens:** `getStageDisplay` is a function defined inside the component scope of `page.tsx`, not exported at the module level.
**How to avoid:** Define `getStageBadge()` inline inside `CandidatePanel.tsx`, following the exact same pattern as `CandidateTableRow.tsx`. This is an established project convention documented in Phase 1 decisions.

---

## Code Examples

### Full Panel Shell Structure

```typescript
// Source: synchrohire-playground.html lines 683-704 + so-body/so-footer patterns
// File: frontend/components/dashboard/CandidatePanel.tsx

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface CandidatePanelProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
  onInviteR2: (id: number) => void;
  onReject: (id: number) => void;
  onSaveNote: (id: number, note: string) => void;
}

export function CandidatePanel({ candidate, open, onClose, onInviteR2, onReject, onSaveNote }: CandidatePanelProps) {
  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-[640px] bg-[#0F172A] border-l border-[#1E293B]
          flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.5)]
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label={candidate?.full_name ?? 'Candidate details'}
        aria-modal="true"
      >
        {/* Header — flex-shrink-0 */}
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3.5 flex-shrink-0">
          {/* Avatar, name, role, meta, badge, close button */}
        </div>

        {/* Body — flex-1 overflow-y-auto */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Score gauges, verdict banner, strengths/gaps, recordings, transcripts */}
        </div>

        {/* Footer — flex-shrink-0 */}
        <div className="px-5 py-3 border-t border-[#1E293B] flex gap-2 flex-shrink-0">
          {/* Action buttons */}
        </div>
      </div>
    </>
  );
}
```

### Candidate Interface Fields Used by Panel

```typescript
// These fields exist on the Candidate interface in page.tsx (lines 138-172):
candidate.full_name          // string
candidate.email              // string
candidate.job_title          // string | undefined
candidate.applied_at         // string | null — for "Applied {date}"
candidate.created_at         // string | null — fallback date
candidate.status             // string — for stage badge
candidate.rating             // number | null — R1 score
candidate.round_2_rating     // number | null — R2 score
candidate.full_verdict       // FullVerdict | null — { verdict, summary, technicalStrengths, technicalGaps }
candidate.round_1_full_dossier // FullDossier | null — { candidateStrengths, areasToProbe }
candidate.interview_transcript  // string | null — R1 transcript text
candidate.round_2_transcript    // string | null — R2 transcript text
candidate.video_url          // string | null — R1 recording URL
candidate.round_2_video_url  // string | null — R2 recording URL
candidate.hr_notes           // string | null — existing note text
// Round 3 fields also exist but panel shows R1+R2 per spec
```

### Verdict Tier Mapping

```typescript
// Four tiers from PANEL-04 spec + existing modal behavior
// Source: page.tsx lines 1666-1673 + playground verdict-title pattern

const VERDICT_DISPLAY: Record<string, { label: string; color: string }> = {
  'Strong Hire': { label: 'Strong Hire', color: '#818CF8' },
  'Hire': { label: 'Hire', color: '#60A5FA' },
  'Borderline': { label: 'Borderline', color: '#FCD34D' },
  'No Hire': { label: 'No Hire', color: '#EF4444' },
  'Hired': { label: 'Hired', color: '#10B981' },
  'Rejected': { label: 'Rejected', color: '#EF4444' },
};
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `<Dialog>` modal (max-w-3xl, centered) | Fixed right-side slide-over (640px, full height) | Panel shows much more content; no overflow truncation |
| SVG gauge in Dialog (r=40, 96×96 viewBox) | SVG gauge in panel (r=30, 72×72 viewBox, per design spec) | Matches Stitch reference exactly |
| Inline transcript text blocks always visible | Accordion collapse/expand | Reduces visual density, less overwhelming |
| No inline video in modal | Video cards + inline player in panel | HR can watch recordings without leaving the panel |

**No deprecated approaches** — this is a net-new component. The existing Dialog modal stays in the codebase until the new panel is wired and confirmed working, then removed.

---

## Open Questions

1. **"Add Note" interaction in footer**
   - What we know: `handleSaveNote(candidateId)` and `noteText` state exist in `page.tsx`. The current modal has an inline textarea for notes.
   - What's unclear: Should "Add Note" in the panel footer open a small inline textarea within the panel, or trigger a separate modal?
   - Recommendation: Match the playground's outline button pattern — clicking "Add Note" expands a small textarea inline at the bottom of the panel body (above the footer). This avoids modal-within-panel nesting. The `noteText` state can be owned by `CandidatePanel` as local state, lifted to page on save.

2. **Location field on candidate header**
   - What we know: PANEL-02 spec requires "location" in the header. The playground shows "Dubai, UAE".
   - What's unclear: The `Candidate` interface in `page.tsx` does not have a `location` field. The `resume_text` might contain location data parsed during ingestion but it is not a structured column.
   - Recommendation: Omit location if no column exists. Show "Applied {date}" in the subline (role · date) without location. If a `location` column exists in the DB but was not added to the TypeScript interface, a migration check is needed before building — but do NOT add it speculatively.

3. **Invite to R2 vs Invite to R3 button label**
   - What we know: Playground shows "Invite to R3" because the demo candidate is post-R2. The spec says "Invite to R2" in PANEL-08. The real action depends on the candidate's current stage.
   - What's unclear: Should the button label and action be stage-aware?
   - Recommendation: Make the primary action button label dynamic: show "Invite to R2" if candidate has no `round_2_rating`, show "Invite to R3" if they do. Wire `onInviteR2` and `onInviteR3` as separate props, show the appropriate one. This matches the existing `handleInviteRound2` / `handleInviteRound3` handlers already in `page.tsx`.

---

## Validation Architecture

No `.planning/config.json` found — treating `nyquist_validation` as enabled (absent = true).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test scripts in package.json |
| Config file | none — see Wave 0 |
| Quick run command | `cd frontend && yarn build` (type-checks + build validation) |
| Full suite command | `cd frontend && yarn build && yarn lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANEL-01 | Slide-over opens/closes on row click and Escape | manual-only | `cd frontend && yarn build` (TypeScript gate) | ❌ Wave 0 |
| PANEL-02 | Header shows name, role, date, badge | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |
| PANEL-03 | Score gauges side-by-side with pass/fail | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |
| PANEL-04 | Verdict banner with tier color + summary | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |
| PANEL-05 | Strengths/Gaps two-column grid | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |
| PANEL-06 | Recording cards + inline VideoPlayer | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |
| PANEL-07 | Transcript accordions expand/collapse | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |
| PANEL-08 | Footer pinned with correct action buttons | manual-only | `cd frontend && yarn build` | ❌ Wave 0 |

**Note:** All PANEL requirements are UI interaction requirements. There is no test framework in this project — validation is via TypeScript compilation (`yarn build`) catching type errors, plus manual browser verification. Visual regression testing was not set up in Phase 1.

### Sampling Rate

- **Per task commit:** `cd frontend && yarn build` — TypeScript must pass
- **Per wave merge:** `cd frontend && yarn build && yarn lint`
- **Phase gate:** Build clean + manual browser smoke test of all 8 success criteria before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated UI test infrastructure exists — all PANEL requirements are manual-verified
- [ ] `cd frontend && yarn build` is the minimum gate per task

---

## Sources

### Primary (HIGH confidence)
- `synchrohire-playground.html` — Complete HTML/CSS reference implementation of slide-over (lines 680–835 CSS, lines 1688–1850 HTML). All layout decisions sourced from this file.
- `frontend/app/dashboard/page.tsx` — Existing Candidate interface, action handlers, SVG gauge pattern, and Dialog modal (to be replaced). Read directly.
- `frontend/components/dashboard/CandidateTableRow.tsx` — Avatar, badge, and formatting patterns to reuse. Read directly.
- `frontend/components/VideoPlayer.tsx` — Confirmed component exists and accepts `src`, `title`, `className` props.
- `frontend/package.json` — Confirmed installed packages. No Sheet, Accordion, or ScrollArea Radix packages present.

### Secondary (MEDIUM confidence)
- `.planning/phases/01-dashboard-rebuild/01-01-SUMMARY.md` and `01-02-SUMMARY.md` — Phase 1 established conventions (dynamic colors via `style={}`, group/hover Tailwind patterns, `getStageBadge` inline definition).
- `synchrohire-playground.html` JavaScript (lines 2299–2304) — Confirms click-outside-to-close pattern for overlay.

### Tertiary (LOW confidence)
- None required. All critical decisions are grounded in the existing codebase and playground reference.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed via package.json; no new installs needed
- Architecture: HIGH — slide-over pattern fully specified in playground HTML; SVG gauge proven in existing modal
- Pitfalls: HIGH — Tailwind v4 dynamic class purge is an established project-level decision from Phase 1; null guards confirmed by TypeScript interface inspection; footer pinning verified by playground structure
- Action wiring: HIGH — all handlers (`handleInviteRound2`, `handleRejectClick`, `handleSaveNote`) confirmed in page.tsx with exact signatures

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable — no fast-moving dependencies, zero new packages)
