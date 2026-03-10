# Phase 1: Dashboard Rebuild - Research

**Researched:** 2026-03-10
**Domain:** React/Next.js UI rebuild — dark-mode data dashboard with funnel cards, decorated table rows, and tab-strip filtering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | HR manager sees pipeline funnel stats as connected cards with conversion percentages | Funnel card layout pattern extracted from playground HTML; existing Stats data-fetching logic already correct and can be reused |
| DASH-02 | HR manager can click a funnel stat card to filter the candidate table to that stage | `stageFilter` state already drives Supabase query; cards need `onClick` wired to set that state |
| DASH-03 | Candidate table rows display avatar circle with initials, name, email, role, applied date, R1/R2 score bars, stage badge, and action icons | Playground shows exact column order and avatar gradient pattern; existing ScoreBar component can be reused |
| DASH-04 | Candidate table rows show hover state (background highlight) and row-level action icons (View/Invite/Reject) | Playground uses `opacity: 0 → 1` on `.row-actions` via `tbody tr:hover`; in Tailwind this is `group/row` + `group-hover/row:opacity-100` |
| DASH-05 | HR manager can filter candidates by stage using tab strip (All / R1 Pending / R1 Done / R2 / Final) | `@radix-ui/react-tabs` already installed; `TabsList`/`TabsTrigger` components exist in `components/ui/tabs.tsx`; `stageFilter` state drives existing Supabase filter |
</phase_requirements>

---

## Summary

Phase 1 is a pure UI rebuild — no new API routes, no schema changes, no backend work. The current `frontend/app/dashboard/page.tsx` (~1,400+ lines) already contains all the data-fetching logic, filter state, action handlers, and Supabase queries needed. The rebuild scope is exclusively visual: replace the current Card-grid funnel stats with a connected funnel-card row, replace the plain table rows with avatar+score+badge decorated rows that expose action icons on hover, and replace the `<Select>` stage filter with a pill-tab strip above the table.

The Stitch playground (`synchrohire-playground.html`) is the pixel reference and contains complete CSS for every component needed: `.funnel-card`, `.funnel-arrow`, `.stage-tab`, `.avatar-circle`, `.score-bar-wrap`, `.row-actions`, `.action-icon`, `.stage-badge`. The design tokens are already defined in `globals.css` as oklch dark-mode variables and the project uses Tailwind CSS 4 (via `@import "tailwindcss"` — no `tailwind.config.ts` scan config). All shadcn components needed (`Badge`, `Progress`, `Tabs`, `Table`, `Tooltip`, `Button`) are already installed.

The critical implementation decisions are: (1) use Tailwind's `group` variant on `<TableRow>` to reveal action icons on hover without layout shift — action icons must be in an absolutely-positioned or `opacity-0 group-hover:opacity-100` container with a fixed-width cell; (2) funnel card click must call `setStageFilter` with the same string values already used by `fetchCandidates`; (3) the tab strip maps to a subset of the existing stage filter values — the mapping is documented below.

**Primary recommendation:** Keep all existing data-fetching and action handler logic intact. Extract the three new visual blocks (FunnelRow, CandidateTableRow, StageTabStrip) as focused sub-components within the page file or as separate files in `components/dashboard/`. Do not rewrite the page from scratch.

---

## Standard Stack

### Core (already installed — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.1 | App router, server actions | Project foundation |
| React | 19.2.3 | UI framework | Project foundation |
| TypeScript | 5.9.3 | Type safety | Project foundation |
| Tailwind CSS | ^4 | Utility styling | Project standard |
| @radix-ui/react-tabs | ^1.1.13 | Tab strip primitive | Already in package.json |
| shadcn/ui Badge | installed | Stage badges | Already in components/ui/ |
| shadcn/ui Progress | installed | Score bars | Already in components/ui/ |
| shadcn/ui Table | installed | Candidate table | Already in components/ui/ |
| shadcn/ui Tooltip | installed | Action icon tooltips | Already in components/ui/ |
| lucide-react | ^0.563.0 | Action icons (Eye, Send, X) | Already imported in page |
| @supabase/supabase-js | ^2.90.1 | Data fetching | Already wired |

### No New Packages Needed

The full phase is implementable with the existing dependency set. Do not add any new npm packages.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Structure

```
frontend/
├── app/dashboard/
│   └── page.tsx              # Main page — keep all state/fetching here
└── components/dashboard/     # Create this directory for extracted components
    ├── FunnelRow.tsx          # Connected funnel cards with click-to-filter
    ├── StageTabStrip.tsx      # Pill tab strip (All / R1 Pending / etc.)
    └── CandidateTableRow.tsx  # Decorated row with avatar, scores, hover actions
```

The page file retains all state (`stageFilter`, `stats`, `candidates`, etc.) and passes props down. Components are presentational with callbacks for filter changes. This avoids context overhead for a single-page dashboard.

### Pattern 1: Funnel Row with Connected Arrow Separators

**What:** A horizontal flex row of clickable stat cards separated by `→` arrows. Each card shows a large colored number, a label, and an absolute-positioned conversion-percentage pill in the top-right corner. The "selected" card gets an indigo border and a subtle indigo bg overlay.

**When to use:** Always rendered above the stage tab strip.

**Design spec from playground:**
```typescript
// Derived from synchrohire-playground.html .funnel-card / .funnel-arrow pattern
// Each card: flex:1, bg surface (#0F172A), border (#1E293B), rounded-lg, p-3, cursor-pointer
// Selected: border-[#6366F1], bg with rgba(99,102,241,0.06) overlay
// Conversion pct pill: absolute top-2 right-2, 9px font, colored bg matching number color
// Arrow separator: text-[#4B5563], font-size 14px, flex-shrink-0

const FUNNEL_STAGES = [
  { key: 'all',       label: 'Applied',      color: '#818CF8', stat: stats.applied,       prev: null },
  { key: 'passed',    label: 'Passed CV',    color: '#60A5FA', stat: stats.passedCvFilter, prev: stats.applied },
  { key: 'r1inv',     label: 'Invited R1',   color: '#2DD4BF', stat: stats.invitedR1,     prev: stats.passedCvFilter },
  { key: 'r1done',    label: 'Completed R1', color: '#34D399', stat: stats.completedR1,   prev: stats.invitedR1 },
  { key: 'r2inv',     label: 'Invited R2',   color: '#FCD34D', stat: stats.invitedR2,     prev: stats.completedR1 },
  { key: 'r2done',    label: 'Completed R2', color: '#FB923C', stat: stats.completedR2,   prev: stats.invitedR2 },
  { key: 'success',   label: 'Successful',   color: '#10B981', stat: stats.successful,    prev: stats.completedR2 },
];
```

**IMPORTANT — stage key mapping for DASH-02:** The funnel card `key` values do NOT directly match `stageFilter` string values. A translation layer is needed:

```typescript
const FUNNEL_TO_STAGE_FILTER: Record<string, string> = {
  'all':    'all',
  'passed': 'all',       // no direct filter for "passed CV" — show all or skip
  'r1inv':  'r1_pending',
  'r1done': 'r1_pending', // "completed R1" = those who did R1 (include passed+failed)
  'r2inv':  'r2_pending',
  'r2done': 'r2_pending',
  'success':'successful',
};
// NOTE: The planner should decide whether clicking "Passed CV" or "Completed R1"
// should set a specific filter or just scroll/highlight. See Open Questions.
```

### Pattern 2: Avatar Circle with Initials

**What:** A 32×32px circle with gradient background and 2-letter initials. Color is deterministically assigned from the candidate's name to ensure consistency across re-renders.

**Design spec from playground:**
```typescript
// From playground data: each candidate has a color gradient assigned
// Pattern: linear-gradient(135deg, colorA, colorB)
// Standard approach: hash the name to pick from a palette

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #14B8A6, #0891B2)',   // teal-cyan
  'linear-gradient(135deg, #8B5CF6, #6D28D9)',   // purple
  'linear-gradient(135deg, #F59E0B, #D97706)',   // amber
  'linear-gradient(135deg, #EF4444, #DC2626)',   // red
  'linear-gradient(135deg, #06B6D4, #0891B2)',   // cyan
  'linear-gradient(135deg, #10B981, #059669)',   // emerald
  'linear-gradient(135deg, #F472B6, #DB2777)',   // pink
  'linear-gradient(135deg, #FB923C, #EA580C)',   // orange
  'linear-gradient(135deg, #34D399, #10B981)',   // green-emerald
  'linear-gradient(135deg, #A78BFA, #7C3AED)',   // violet
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}
```

### Pattern 3: Row-Level Hover Actions (no layout shift)

**What:** Action icon buttons (View, Invite, Reject) that are invisible at rest and become visible when the row is hovered. Must not cause layout shift — the cell must always occupy the same width whether icons are visible or not.

**Tailwind implementation:**
```typescript
// Add group/row to TableRow, use opacity transition on action container
// The cell has a fixed min-width so icons don't reflow

<TableRow
  className="group/row cursor-pointer hover:bg-[#1A2332] transition-colors"
  onClick={() => setSelectedCandidate(candidate)}
>
  {/* ... other cells ... */}
  <TableCell className="w-24"> {/* fixed width prevents layout shift */}
    <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-100">
      <ActionIconButton icon={Eye} title="View" onClick={...} />
      <ActionIconButton icon={Send} title="Invite" onClick={...} />
      <ActionIconButton icon={X} title="Reject" onClick={...} />
    </div>
  </TableCell>
</TableRow>
```

**Action icon button spec from playground:**
```
.action-icon: 26×26px, rounded-6px, border 1px solid var(--border), bg var(--bg-elevated)
.action-icon.view:  color #818CF8 (indigo glow)
.action-icon.mail:  color #2DD4BF (teal)
.action-icon.reject: color #EF4444 (red)
```

### Pattern 4: Stage Tab Strip (pill style)

**What:** A horizontal row of pill-shaped buttons above the table. Active tab has indigo background (`rgba(99,102,241,0.2)`) and indigo border + text. Inactive tabs have transparent background, gray border, muted text.

**Tailwind implementation using shadcn Tabs:**
```typescript
// Use @radix-ui/react-tabs (already in components/ui/tabs.tsx)
// Override TabsList to be flex-row with gap instead of the default pill container
// Override TabsTrigger to use pill style

// Tab values map to stageFilter values:
const STAGE_TABS = [
  { value: 'all',       label: 'All Candidates' },
  { value: 'r1_pending', label: 'R1 Pending' },
  // "R1 Done" = candidates who completed R1 (passed OR failed)
  // This requires a custom stageFilter value OR composing r1_passed+r1_failed
  { value: 'r1_done',   label: 'R1 Done' },   // NEW filter value needed — see Open Questions
  { value: 'r2_pending', label: 'R2 Pending' },
  { value: 'successful', label: 'Final' },
];
```

**Note:** The tab strip replaces the existing `<Select>` stage dropdown for the five specified stages. The existing `<Select>` (with all its additional options like `cv_rejected`, `eligibility_pending`, etc.) should either be preserved alongside or absorbed. The planner should decide — see Open Questions.

### Pattern 5: Score Bar (compact, inline)

**What:** A thin horizontal bar (4px height) with a fill colored by score threshold, followed by a numeric value. Already implemented as `ScoreBar` component in the current page.

**Design spec from playground:**
```
.score-bar-wrap: display:flex; align-items:center; gap:4px
.score-bar: width:48px; height:4px; background:#1E293B; border-radius:2px; overflow:hidden
.score-bar-fill: height:100%; background:var(--success)  (emerald #10B981)
.score-num: font-size:11px; font-weight:600; color varies by threshold
```

The existing `ScoreBar` component in the page uses `w-16 h-2` which can be adjusted to `w-12 h-1` for a more compact in-table look matching the playground.

### Anti-Patterns to Avoid

- **Rewriting the whole page file:** The existing 1,400+ line page has battle-tested data fetching, error handling, pagination, bulk actions, and action handlers. Extract only the three visual blocks. Never discard working logic.
- **Using Tailwind `hidden`/`block` for hover reveal:** `hidden → block` causes layout reflow/shift. Use `opacity-0 → opacity-100` with a fixed-width container.
- **Hardcoding stat values in the funnel component:** Funnel cards receive stats as props; they do not fetch data themselves.
- **Creating new Supabase queries for tab filtering:** The existing `stageFilter` state and `fetchCandidates` logic already handles all filtering. Tab strip just calls `setStageFilter(value)`.
- **Using Tailwind `group` without a suffix:** In Tailwind v3+, when multiple groups nest, use named groups: `group/row` on the row and `group-hover/row:opacity-100` on the child. The project uses Tailwind 4 which supports this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching with accessible keyboard nav | Custom button array with onClick | `@radix-ui/react-tabs` (already installed) | Handles arrow key nav, ARIA roles, focus management automatically |
| Score progress bar | Custom `<div>` with inline style | Existing `ScoreBar` component or `<Progress>` from shadcn | Already handles null states, color thresholds |
| Tooltip on action icons | Custom hover state div | `<Tooltip>` / `<TooltipProvider>` from shadcn (already installed) | Accessible, handles portal positioning |
| Stage badge coloring | Complex conditional className | Existing `getStageDisplay()` function returning `className` string | Already handles all 10+ status cases correctly |

**Key insight:** The data layer is complete. Every primitive for the visual layer is already installed. This phase is purely assembling existing pieces in the correct layout.

---

## Common Pitfalls

### Pitfall 1: Tailwind Purge Missing Arbitrary Color Values

**What goes wrong:** Colors like `bg-[#1A2332]` or `border-[#6366F1]` used in new components are purged in production if the class strings are not complete in source.
**Why it happens:** Tailwind 4 with `@import "tailwindcss"` scans content — if color values are dynamically concatenated (e.g., `` `bg-[${color}]` ``), they will be purged.
**How to avoid:** Use only complete static class strings. For dynamic gradient backgrounds on avatar circles, use inline `style={{ background: gradient }}` rather than dynamic Tailwind classes.
**Warning signs:** Colors visible in dev, missing in production build.

### Pitfall 2: `group-hover` Not Working on `<TableRow>`

**What goes wrong:** The shadcn `<TableRow>` wraps a `<tr>` element. Tailwind's `group/row` class must be applied to the `<tr>`, not to a wrapping div.
**Why it happens:** `<TableRow>` forwards the `className` prop to `<tr>`, so `group/row` lands on the correct element. But if `<TableCell>` contains a nested clickable element that `stopPropagation`, the row's `onClick` never fires.
**How to avoid:** Apply `group/row` to `<TableRow className="group/row ...">`. Action icon `onClick` handlers must call `e.stopPropagation()` to prevent triggering the row's `setSelectedCandidate` call.
**Warning signs:** Hover reveal works but clicking View also opens the detail panel.

### Pitfall 3: `stageFilter` Mapping Gap for "R1 Done"

**What goes wrong:** The tab strip spec calls for an "R1 Done" tab. The existing `fetchCandidates` has no `r1_done` case — it has `r1_pending` and `r1_failed` separately, but not a combined "completed R1" case.
**Why it happens:** The existing filter was built for a dropdown with granular options. The tab strip requires a broader category.
**How to avoid:** Add a `case 'r1_done':` branch in `fetchCandidates` that matches candidates with a non-null `rating` (i.e., completed R1 — regardless of pass/fail). This is `query.not('rating', 'is', null)`.
**Warning signs:** R1 Done tab shows 0 results or throws Supabase filter errors.

### Pitfall 4: Funnel Card "Passed CV" Has No Direct stageFilter Equivalent

**What goes wrong:** DASH-02 requires clicking a funnel card to filter the table. The "Passed CV" and "Invited R1" funnel stages don't map cleanly to a single existing filter value.
**Why it happens:** The funnel counts measure distinct cohorts but the table filter uses different criteria. "Passed CV" = all non-CV_REJECTED, which is closest to `stageFilter = 'all'` minus rejected candidates.
**How to avoid:** Either accept that some funnel cards filter to the closest available stage (e.g., "Passed CV" → `all`, "Invited R1" → `r1_pending`), OR add new stageFilter cases. Recommended: accept closest-match mapping for MVP and document it.
**Warning signs:** Users click a funnel card and the table count doesn't match the funnel number.

### Pitfall 5: Tailwind CSS 4 Class Ordering with `@theme inline`

**What goes wrong:** The project uses Tailwind 4's `@theme inline` in `globals.css`, which maps CSS variables to color classes. Custom hex colors in `bg-[#020617]` work fine, but Tailwind semantic classes like `bg-background` map to `var(--background)`, which resolves correctly in dark mode because the `.dark` class sets it.
**Why it happens:** The project is in permanent dark mode (from `layout.tsx`). All `bg-background` etc. resolve to the `.dark` variants. New components should use these semantic classes where possible.
**How to avoid:** Prefer `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground` for general surfaces. Use literal hex (`bg-[#0F172A]`) only when the design token color differs from the shadcn semantic variable.
**Warning signs:** Components look wrong in dev vs. production or look different depending on whether `.dark` class is applied.

### Pitfall 6: Applied Date Field

**What goes wrong:** DASH-03 requires showing "applied date" in the table row. The `Candidate` interface has both `created_at` and `applied_at` fields.
**Why it happens:** `applied_at` is populated by the backend pipeline; `created_at` is the DB insert time. Some early candidates may have null `applied_at`.
**How to avoid:** Use `applied_at ?? created_at` for display. Format as compact date: `new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })` → "25 Feb".
**Warning signs:** Blank date cells for older candidates.

---

## Code Examples

Verified patterns derived from the playground HTML and existing codebase:

### Avatar Circle with Gradient

```typescript
// Inline style required — dynamic gradient cannot be a Tailwind class
function CandidateAvatar({ name }: { name: string }) {
  const initials = getInitials(name);
  const gradient = getAvatarGradient(name);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
      style={{ background: gradient }}
    >
      {initials}
    </div>
  );
}
```

### Funnel Card

```typescript
// Derived from playground .funnel-card CSS
interface FunnelCardProps {
  label: string;
  count: number;
  color: string;
  conversionPct?: number | null;  // null for first card (Applied)
  isSelected: boolean;
  onClick: () => void;
}

function FunnelCard({ label, count, color, conversionPct, isSelected, onClick }: FunnelCardProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative flex-1 rounded-lg border p-3 text-left transition-colors cursor-pointer',
        isSelected
          ? 'border-[#6366F1] bg-[rgba(99,102,241,0.06)]'
          : 'border-[#1E293B] bg-[#0F172A] hover:border-[#2D3F55] hover:bg-[#1A2332]'
      ].join(' ')}
    >
      {conversionPct !== null && conversionPct !== undefined && (
        <span
          className="absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: `${color}26`,  // 15% opacity
            color: color,
          }}
        >
          {conversionPct}%
        </span>
      )}
      <div className="text-[22px] font-bold tabular-nums leading-tight" style={{ color }}>
        {count.toLocaleString()}
      </div>
      <div className="text-[10px] text-[#6B7280] mt-0.5 whitespace-nowrap">{label}</div>
    </button>
  );
}
```

### Stage Tab Strip (pill style, overriding shadcn defaults)

```typescript
// Use Tabs primitive but override visual style to match playground .stage-tab
<Tabs value={stageFilter} onValueChange={setStageFilter}>
  <TabsList className="h-auto bg-transparent p-0 gap-1 flex-wrap">
    {STAGE_TABS.map(tab => (
      <TabsTrigger
        key={tab.value}
        value={tab.value}
        className={cn(
          "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
          "data-[state=inactive]:border-[#1E293B] data-[state=inactive]:text-[#6B7280]",
          "data-[state=inactive]:hover:border-[#2D3F55] data-[state=inactive]:hover:text-[#D1D5DB]",
          "data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:border-[#6366F1] data-[state=active]:text-[#818CF8]",
          "data-[state=active]:shadow-none"  // override shadcn default shadow
        )}
      >
        {tab.label}
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

### Row Hover with Action Icons (no layout shift)

```typescript
// group/row on TableRow, fixed-width action cell
<TableRow
  key={candidate.id}
  className="group/row cursor-pointer hover:bg-[#1A2332] transition-colors duration-100 border-b border-[#1E293B]"
  onClick={() => setSelectedCandidate(candidate)}
>
  {/* ... data cells ... */}
  <TableCell className="w-24 pr-3">
    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-100">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="w-[26px] h-[26px] rounded-md border border-[#1E293B] bg-[#1A2332] flex items-center justify-center text-[#818CF8] hover:border-[#6366F1] transition-colors"
              onClick={e => { e.stopPropagation(); setSelectedCandidate(candidate); }}
            >
              <Eye className="w-3 h-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>View</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Invite and Reject buttons follow same pattern */}
    </div>
  </TableCell>
</TableRow>
```

---

## State of the Art

| Old Approach (v1) | New Approach (v2 Stitch) | Impact |
|-------------------|--------------------------|--------|
| `grid grid-cols-7` Card components for funnel stats | Flex row of clickable `.funnel-card` divs with arrow separators and conversion % pills | Cards become interactive filters; conversion context visible at a glance |
| Plain `<TableRow>` with name/email/score columns | Decorated rows: avatar circle + full column set + hover-reveal action icons | Each row is self-contained — actions discoverable without selecting |
| `<Select>` dropdown for stage filter | Pill tab strip above table | Stage always visible; fewer clicks to switch; mirrors Stitch reference |
| `border-l-4` colored left border on stat Cards | Absolute-positioned % pill + colored number, connected arrow row | Tighter visual flow matching funnel metaphor |

**Deprecated/outdated in this phase:**
- The existing `grid grid-cols-7` funnel stats block (lines ~1159–1253): replaced by `FunnelRow` component.
- The `<Select value={stageFilter}>` stage dropdown (lines ~1288–1303): replaced by `StageTabStrip`. Keep the Role filter `<Select>` unchanged.

---

## Open Questions

1. **What should clicking "Passed CV" or "Completed R1" funnel cards filter to?**
   - What we know: These stages don't have 1:1 stageFilter mappings in `fetchCandidates`.
   - What's unclear: Should they show a subset (e.g., only CV-passed, non-rejected) or default to `all`?
   - Recommendation: "Passed CV" → `all` (shows everyone except rejected); "Completed R1" → new `r1_done` case (`.not('rating','is',null)`). This is low-risk to add.

2. **Should the old stage `<Select>` dropdown be removed or kept alongside the tab strip?**
   - What we know: The tab strip covers 5 tabs (All / R1 Pending / R1 Done / R2 / Final). The old select has 9 options including `cv_rejected`, `eligibility_pending`, `eligibility_failed`, `r1_failed`, `r2_failed`.
   - What's unclear: Do HR users need the granular dropdown options or is the 5-tab model sufficient?
   - Recommendation: Replace the stage Select with the tab strip for the 5 primary stages. Move the granular options to an "Advanced Filters" section if still needed. The advanced filters panel already exists.

3. **Should `CandidateTableRow` be extracted to a separate file or stay in `page.tsx`?**
   - What we know: The page is already 1,400+ lines. Adding avatar + action icon logic inline will make it longer.
   - What's unclear: Whether the team prefers monolithic page files or component decomposition.
   - Recommendation: Extract `FunnelRow`, `StageTabStrip`, `CandidateTableRow` to `components/dashboard/`. This keeps the page file focused on state management and data fetching.

---

## Sources

### Primary (HIGH confidence)
- `synchrohire-playground.html` (project file, verified 2026-03-10) — complete CSS spec for every visual component: `.funnel-card`, `.funnel-arrow`, `.stage-tab`, `.stage-tabs`, `.avatar-circle`, `.score-bar-wrap`, `.row-actions`, `.action-icon`, `.candidate-table tbody tr:hover`
- `frontend/app/dashboard/page.tsx` (project file, verified 2026-03-10) — existing state variables, Supabase queries, `getStageDisplay()`, `ScoreBar`, action handlers
- `frontend/app/globals.css` (project file, verified 2026-03-10) — Tailwind 4 `@theme inline` setup, `.dark` CSS variable overrides
- `frontend/components/ui/tabs.tsx` (project file, verified 2026-03-10) — existing `TabsList`/`TabsTrigger` with Radix primitives
- `frontend/package.json` (project file, verified 2026-03-10) — confirms all required packages installed, no additions needed

### Secondary (MEDIUM confidence)
- Tailwind CSS 4 docs pattern for named groups (`group/row`, `group-hover/row:`) — confirmed as valid Tailwind 4 syntax based on training knowledge; project uses Tailwind 4 (see `package.json` `"tailwindcss": "^4"`)
- `@radix-ui/react-tabs` `data-[state=active]` and `data-[state=inactive]` selector pattern — standard Radix UI attribute pattern, confirmed via existing `TabsTrigger` class in `components/ui/tabs.tsx`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by reading `package.json`; all libraries present
- Architecture patterns: HIGH — derived directly from playground HTML CSS specs and existing page code
- Pitfalls: HIGH for layout-shift and group-hover (standard Tailwind 4 patterns); MEDIUM for stageFilter mapping gaps (derived from reading existing filter logic)
- Design tokens: HIGH — extracted directly from playground `:root` CSS variables

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable libraries; design is frozen to Stitch reference)
