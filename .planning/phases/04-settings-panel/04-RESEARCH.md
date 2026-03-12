# Phase 4: Settings Panel - Research

**Researched:** 2026-03-12
**Domain:** Next.js / React UI shell — tabbed settings page, no backend persistence
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETT-01 | New /settings page accessible from sidebar with 5 tabs: Company, Email & Comms, Interviews, Scoring, Job Boards | Route creation + sidebar navItem addition + tab state pattern |
| SETT-02 | Company tab: logo upload, brand colour picker, company name, about, industry, website, HQ, company size fields | `<input type="file">` + `<input type="color">` + standard text/select inputs, all controlled with useState |
| SETT-03 | Email & Comms tab: Gmail connection status, sender display name, 4 email template editors | Accordion or select pattern to switch templates; each editor = 4 text/textarea fields |
| SETT-04 | Email template editor: subject/heading/body/footer fields with {{variable}} placeholder pills below each field | Pill rendering from a static array of placeholder strings per field |
| SETT-05 | Email & Comms tab: 3 automated send rule toggles | shadcn/ui Switch component (already in project) |
| SETT-06 | Interviews tab: default round count selector and per-round defaults (theme, duration, voice, avatar) | Direct reuse of StepInterviewConfig pattern from Phase 3 |
| SETT-07 | Scoring tab: hiring bar preset cards + per-round threshold number inputs | Direct reuse of StepScoring preset card pattern from Phase 3 |
| SETT-08 | Job Boards tab: LinkedIn, Indeed, Glassdoor, Bayt.com connection cards with enable toggles | Card grid with Switch per card; no OAuth triggered |
| SETT-09 | All settings are UI-only in v2.0 — no backend persistence | Satisfied by design: all state lives in local useState, no Supabase calls |
</phase_requirements>

---

## Summary

Phase 4 is a pure UI-shell build. Every control is an interactive React form element backed by local `useState` — nothing is written to Supabase. The page must be auth-protected (HR-only), reachable from the sidebar, and organised into five tabs that swap content without a page reload.

The critical insight is that Phases 3 already built the two most complex sub-components: `StepInterviewConfig` (round count selector + per-round rows) and `StepScoring` (preset cards). The Interviews tab (SETT-06) and Scoring tab (SETT-07) are straightforward adaptations of those components — swap the wizard-step container for the settings tab container and drop the "Next / Back" navigation.

The most novel work in this phase is the Email & Comms tab: template editor with placeholder pills, Gmail connection status banner, and three send-rule toggle rows. These are all presentational — no API calls.

**Primary recommendation:** Build the five-tab shell first (04-01), then tackle each tab in plan order. Reuse existing wizard components for Interviews and Scoring tabs verbatim or with minimal prop changes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` | React 19 (project) | All local form state | No persistence needed; simplest correct tool |
| Next.js App Router | 16 (project) | `app/settings/page.tsx` route | Existing pattern for all pages |
| shadcn/ui | New York style (project) | Tabs, Switch, Input, Select, Card, Badge | Already installed, used throughout |
| Tailwind CSS 4 | 4 (project) | Layout and styling | Project standard |
| Lucide icons | (project) | Tab icons, status indicators | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn()` from `lib/utils` | (project) | Conditional class merging | All conditional styling |
| Native `<input type="color">` | browser | Brand colour picker (SETT-02) | No library needed for a simple colour input |
| Native `<input type="file">` | browser | Logo upload UI (SETT-02) | UI only — no actual upload in v2.0 |
| shadcn/ui `Switch` | (project) | Send rule toggles, job board toggles | Already used in wizard |
| shadcn/ui `Tabs` | (project) | Five-tab navigation | Purpose-built for this requirement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui Tabs | Manual tab state + conditional render | shadcn/ui Tabs is already installed and handles ARIA/keyboard correctly |
| Native `<input type="color">` | react-colorful or similar | No library needed for a UI shell; native input sufficient |
| shadcn/ui Switch | Custom toggle | Switch already used in Phase 3 |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### Recommended File Structure
```
frontend/app/settings/
├── page.tsx                     # Route entry — auth check, tab shell
frontend/components/settings/
├── CompanyTab.tsx               # SETT-02
├── EmailCommsTab.tsx            # SETT-03, SETT-04, SETT-05
├── InterviewsTab.tsx            # SETT-06 (wraps/adapts StepInterviewConfig)
├── ScoringTab.tsx               # SETT-07 (wraps/adapts StepScoring)
└── JobBoardsTab.tsx             # SETT-08
```

### Pattern 1: Tab Shell with shadcn/ui Tabs
**What:** `<Tabs defaultValue="company">` at page level; each tab content component receives its own local `useState` slice.
**When to use:** Always — this is the standard shadcn approach.

```tsx
// app/settings/page.tsx (simplified)
'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CompanyTab } from '@/components/settings/CompanyTab';
// ... other tab imports

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      <Tabs defaultValue="company" className="flex-1">
        <TabsList className="border-b border-border bg-transparent rounded-none w-full justify-start gap-1">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="email">Email & Comms</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="job-boards">Job Boards</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="email"><EmailCommsTab /></TabsContent>
        <TabsContent value="interviews"><InterviewsTab /></TabsContent>
        <TabsContent value="scoring"><ScoringTab /></TabsContent>
        <TabsContent value="job-boards"><JobBoardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### Pattern 2: Local State Per Tab (UI Shell)
**What:** Each tab component holds its own `useState` for all its fields. No lifting to page level needed since there is no persistence.
**When to use:** All tabs in this phase.

```tsx
// components/settings/CompanyTab.tsx (sketch)
'use client';
export function CompanyTab() {
  const [companyName, setCompanyName] = useState('');
  const [brandColor, setBrandColor] = useState('#6366F1');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  // ... other fields
}
```

### Pattern 3: Placeholder Pills (SETT-04)
**What:** A static array of `{{placeholder}}` strings displayed as pill badges below each template field. Clicking a pill copies it to clipboard or appends to the active field.
**When to use:** Email template editor fields.

```tsx
// Simplest correct implementation — pills are display-only (UI shell)
const PLACEHOLDERS = {
  subject: ['{{candidate_name}}', '{{job_title}}', '{{company_name}}'],
  body: ['{{candidate_name}}', '{{job_title}}', '{{interview_link}}', '{{date}}'],
};

function PlaceholderPills({ pills }: { pills: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pills.map((p) => (
        <span
          key={p}
          className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono cursor-pointer hover:border-indigo-500 hover:text-indigo-400 transition-colors"
        >
          {p}
        </span>
      ))}
    </div>
  );
}
```

### Pattern 4: Reuse StepInterviewConfig / StepScoring (SETT-06, SETT-07)
**What:** The wizard step components already implement the exact UI required by the Interviews and Scoring tabs. Create thin wrapper components that supply their own local state and render the same UI without the wizard navigation chrome.
**When to use:** InterviewsTab and ScoringTab only.

```tsx
// components/settings/InterviewsTab.tsx
'use client';
import { useState } from 'react';
import type { RoundConfig } from '@/app/create-job/page';

// Copy the UI rendering logic from StepInterviewConfig,
// but backed by local state only — no wizardState prop
```

Note: The wizard step components import `WizardState` from `@/app/create-job/page`. For settings, do NOT import WizardState. Instead, declare minimal local types (`RoundConfig` can be re-imported or redeclared locally). Keep components decoupled.

### Pattern 5: Job Board Connection Card (SETT-08)
**What:** A card grid (2-column or 4-column) where each card shows the platform logo/name, a connection status label ("Not Connected"), and a `Switch` enable toggle. No click handler beyond toggling local state.

```tsx
const JOB_BOARDS = [
  { id: 'linkedin', name: 'LinkedIn', logo: '...' },
  { id: 'indeed', name: 'Indeed', logo: '...' },
  { id: 'glassdoor', name: 'Glassdoor', logo: '...' },
  { id: 'bayt', name: 'Bayt.com', logo: '...' },
];
```

### Pattern 6: Sidebar Settings Link (SETT-01)
**What:** Add `/settings` to the `navItems` array in `AppSidebar.tsx` with the `Settings` icon from Lucide.

```tsx
// In AppSidebar.tsx navItems array — add:
{
  label: 'Settings',
  href: '/settings',
  icon: <Settings className="w-4 h-4 shrink-0" />,
}
// Import: import { Settings } from 'lucide-react';
```

### Pattern 7: Gmail Connection Status (SETT-03)
**What:** A status banner/card showing a coloured dot + text ("Connected as user@gmail.com" or "Not connected"). Static in UI shell — no real OAuth check.

```tsx
// Static display only in v2.0
<div className="flex items-center gap-2 p-3 rounded-lg border border-border">
  <div className="w-2 h-2 rounded-full bg-emerald-500" />
  <span className="text-sm text-muted-foreground">Connected as hr@company.com</span>
</div>
```

### Anti-Patterns to Avoid
- **Dynamic Tailwind class interpolation:** Never `bg-${color}` or `border-${preset}`. Use `style={{ borderColor: color }}` for hex values. This is a confirmed project-wide rule (Tailwind v4 purge).
- **Lifting state to page level:** Each tab owns its state. No shared settings state object needed in v2.0.
- **Importing WizardState into settings components:** Keep settings components self-contained. Redeclare or re-import only the minimal types needed (e.g., `RoundConfig`).
- **Triggering any Supabase write:** SETT-09 explicitly forbids persistence. No `supabase.from(...).upsert()` calls anywhere in this phase.
- **Adding OAuth redirect logic for Job Boards:** SETT-08 requires only UI toggles. No OAuth flow.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching | Custom state + conditional render | shadcn/ui `Tabs` | Handles ARIA roles, keyboard nav, accessible |
| Toggle switches | Custom checkbox | shadcn/ui `Switch` | Already in project, consistent style |
| Colour picker | Third-party lib | Native `<input type="color">` | UI shell only; native is sufficient and zero-dep |
| Tab content | Page-level conditional blocks | `<TabsContent>` components | Cleaner separation, less re-render risk |

---

## Common Pitfalls

### Pitfall 1: Dynamic Tailwind class strings for hex colors
**What goes wrong:** Brand colour picker produces a hex string; developer writes `bg-[${brandColor}]` expecting Tailwind to handle it at runtime.
**Why it happens:** Tailwind v4 purges unused class strings at build time; runtime-interpolated strings are not scanned.
**How to avoid:** Always use `style={{ backgroundColor: brandColor }}` for user-supplied hex values.
**Warning signs:** Color appears in dev but disappears in production build.

### Pitfall 2: Importing WizardState creates tight coupling
**What goes wrong:** `InterviewsTab` imports `WizardState` from `@/app/create-job/page` and receives a partial slice via props, creating a dependency on the wizard page internals.
**Why it happens:** `RoundConfig` is defined inside `WizardState` in the wizard page.
**How to avoid:** Either re-import only `RoundConfig` (it is exported separately) or redeclare the minimal type locally. Do not prop-thread wizard state.

### Pitfall 3: Email template switching with lost state
**What goes wrong:** Switching between the four email templates (Interview Invite / Follow-up / Rejection / Shortlist) unmounts the previous template's state.
**Why it happens:** If templates are rendered conditionally, React destroys state on unmount.
**How to avoid:** Store all four template states in a single `useState` object keyed by template ID. Render only the active template's form fields but keep all values in the parent object.

```tsx
const [templates, setTemplates] = useState({
  invite: { subject: '', heading: '', body: '', footer: '' },
  followup: { subject: '', heading: '', body: '', footer: '' },
  rejection: { subject: '', heading: '', body: '', footer: '' },
  shortlist: { subject: '', heading: '', body: '', footer: '' },
});
const [activeTemplate, setActiveTemplate] = useState<keyof typeof templates>('invite');
```

### Pitfall 4: /settings not protected by auth
**What goes wrong:** HR-only settings are accessible without login.
**Why it happens:** No middleware.ts exists in this project; auth protection is done per-page.
**How to avoid:** Follow the same pattern as `/dashboard` — check Supabase session at the top of the page component and redirect to `/login` if unauthenticated.

```tsx
// In app/settings/page.tsx
const supabase = createBrowserClient(...);
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) router.push('/login?redirect=/settings');
  });
}, []);
```

---

## Code Examples

### Full tab shell skeleton
```tsx
// app/settings/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, Mail, Video, BarChart2, Briefcase, Building2 } from 'lucide-react';
import { CompanyTab } from '@/components/settings/CompanyTab';
import { EmailCommsTab } from '@/components/settings/EmailCommsTab';
import { InterviewsTab } from '@/components/settings/InterviewsTab';
import { ScoringTab } from '@/components/settings/ScoringTab';
import { JobBoardsTab } from '@/components/settings/JobBoardsTab';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login?redirect=/settings');
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 min-h-0">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your workspace configuration</p>
      </div>
      <Tabs defaultValue="company" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex gap-1 border-b border-border bg-transparent rounded-none w-full justify-start h-auto p-0 mb-6">
          <TabsTrigger value="company" className="...">Company</TabsTrigger>
          <TabsTrigger value="email" className="...">Email & Comms</TabsTrigger>
          <TabsTrigger value="interviews" className="...">Interviews</TabsTrigger>
          <TabsTrigger value="scoring" className="...">Scoring</TabsTrigger>
          <TabsTrigger value="job-boards" className="...">Job Boards</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="flex-1 overflow-y-auto"><CompanyTab /></TabsContent>
        <TabsContent value="email" className="flex-1 overflow-y-auto"><EmailCommsTab /></TabsContent>
        <TabsContent value="interviews" className="flex-1 overflow-y-auto"><InterviewsTab /></TabsContent>
        <TabsContent value="scoring" className="flex-1 overflow-y-auto"><ScoringTab /></TabsContent>
        <TabsContent value="job-boards" className="flex-1 overflow-y-auto"><JobBoardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### Scoring preset card (inline style, Tailwind-safe)
```tsx
// Reuse pattern from StepScoring in Phase 3
// Use style={{ borderColor }} never border-[${color}]
const PRESETS = [
  { id: 'growth', label: 'Growth', threshold: 35, color: '#10B981' },
  { id: 'standard', label: 'Standard', threshold: 50, color: '#6366F1' },
  { id: 'high_bar', label: 'High Bar', threshold: 75, color: '#F59E0B' },
  { id: 'elite', label: 'Elite', threshold: 90, color: '#EF4444' },
];

<div
  key={preset.id}
  onClick={() => setSelected(preset.id)}
  style={{ borderColor: selected === preset.id ? preset.color : '#1E293B' }}
  className="cursor-pointer rounded-xl border-2 p-4 transition-colors"
>
  {/* card content */}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Manual tab state + conditional render | shadcn/ui `Tabs` component | Tabs already used across project |
| Custom toggle UI | shadcn/ui `Switch` | Consistent with Phase 3 patterns |

---

## Open Questions

1. **Logo upload preview (SETT-02)**
   - What we know: UI shell only — no actual upload to storage
   - What's unclear: Whether to show an `<img>` preview using `URL.createObjectURL()` after file selection, or just show the file name
   - Recommendation: Show an image preview using `URL.createObjectURL()` — it's a pure client-side operation, no Supabase needed, and makes the UI feel more complete. Revoke the object URL on component unmount.

2. **RoundConfig import in InterviewsTab (SETT-06)**
   - What we know: `RoundConfig` is exported from `@/app/create-job/page`
   - What's unclear: Whether the planner prefers re-import or local redeclaration
   - Recommendation: Re-import `RoundConfig` from `@/app/create-job/page` — it is already exported and the type is stable. Avoid duplication.

3. **Per-round threshold inputs in Scoring tab (SETT-07)**
   - What we know: SETT-07 specifies "per-round custom threshold inputs" in addition to preset cards
   - What's unclear: How many rounds (1/2/3) to show thresholds for — the settings default should mirror the Interviews tab default round count
   - Recommendation: Default to 2 rounds. Derive the visible threshold rows from the same `roundCount` state used in the Interviews tab. Since tabs are independent components, this state should be duplicated locally in the Scoring tab (no cross-tab state sharing needed for a UI shell).

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from config.json — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project |
| Config file | None — no jest.config, vitest.config, or pytest.ini found |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETT-01 | /settings renders 5 tabs | manual smoke | N/A | ❌ |
| SETT-02 | Company tab fields render | manual smoke | N/A | ❌ |
| SETT-03 | Email & Comms tab renders | manual smoke | N/A | ❌ |
| SETT-04 | Placeholder pills appear | manual smoke | N/A | ❌ |
| SETT-05 | Send rule toggles work | manual smoke | N/A | ❌ |
| SETT-06 | Interviews tab round config | manual smoke | N/A | ❌ |
| SETT-07 | Scoring preset cards selectable | manual smoke | N/A | ❌ |
| SETT-08 | Job boards toggles work | manual smoke | N/A | ❌ |
| SETT-09 | No value persists on refresh | manual smoke | N/A | ❌ |

All tests are manual-only because no automated test framework is installed in this project. Verification is via browser: navigate to /settings, interact with each tab, and confirm SETT-09 by refreshing the page.

### Wave 0 Gaps
None — no test framework to install. Validation is manual browser testing per plan.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `frontend/components/AppSidebar.tsx` — sidebar navItems array pattern
- Direct code inspection of `frontend/app/create-job/page.tsx` — `RoundConfig`, `WizardState`, wizard step import pattern, `StepScoring`/`StepInterviewConfig` component structure
- Project CLAUDE.md — shadcn/ui New York style, Tailwind CSS 4, Lucide icons, design tokens
- Project STATE.md decisions — inline style for hex colors (Tailwind v4 purge-safe rule confirmed)

### Secondary (MEDIUM confidence)
- shadcn/ui Tabs documentation — component API aligns with standard shadcn patterns known from training

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in codebase
- Architecture: HIGH — direct pattern reuse from Phases 1–3 confirmed by code inspection
- Pitfalls: HIGH — inline style rule explicitly documented in STATE.md decisions; auth pattern observed in dashboard page

**Research date:** 2026-03-12
**Valid until:** 2026-05-12 (stable stack, no external API changes)
