# Phase 3: Create Job Wizard — Research

**Researched:** 2026-03-11
**Domain:** Multi-step form wizard in Next.js 16 / React 19 / shadcn/ui — replacing /gen-job with a structured 6-step UI
**Confidence:** HIGH (all findings grounded in the existing codebase)

---

## Summary

Phase 3 replaces the existing `/gen-job` page with a 6-step Create Job wizard. The existing gen-job page is a single-page form with client-side step state (`activeStep: 1-6`); the wizard is a redesign of that UX into a Stitch-compliant layout with a left sidebar progress indicator, distinct step panels, and Save as Draft at every step. The underlying server actions (`generateJobDescription`, `refineJobDescription`) are already wired and working — Phase 3 is a UI restructuring and field addition exercise, not an AI integration exercise.

The Supabase `jobs` table already has all the columns Phase 3 needs (title, department, location, work_arrangement, urgency, salary_min/max/currency/period, visa_sponsorship, education_required, experience_min/max, skills_must_have, skills_nice_to_have, description, project_context). The new wizard adds fields from JOB-02/03 (headcount, target_start_date, employment_type) that may need a migration — this must be verified against the live schema before Plan 03-02. The interview config (JOB-05) and screening questions (JOB-06) and scoring preset (JOB-07) are v2.0 UI-only — the v2.1 backend wiring is explicitly deferred (see REQUIREMENTS.md v2 deferred items).

The key architectural decision: the wizard lives at `/create-job` (or replaces `/gen-job`), uses a two-column layout (left sidebar progress + right content area) within the existing app shell, and manages all state in a single parent page component with a `useWizardState` hook or equivalent. Draft persistence uses `localStorage` (no backend — drafts are v2.0 UI only and the requirements say "persists current wizard state without publishing", which can be browser-local given that backend persistence is not in v2.0 scope).

**Primary recommendation:** Build the wizard as a single `'use client'` page with local state (`useState` for step data, `localStorage` for draft saves), a sidebar progress component, and six step panel components rendered conditionally. Reuse the existing `generateJobDescription` and `refineJobDescription` server actions without modification.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOB-01 | 6-step wizard: Basics → Requirements → AI Generate → Interview Config → Screening → Scoring & Publish | Wizard layout pattern: two-column with sidebar. State managed in page-level useState. |
| JOB-02 | Step 1 (Basics): title, department, location, work arrangement, employment type, urgency, headcount, target start date | Fields are a superset of existing gen-job step 1. headcount + target_start_date may need DB migration. employment_type field already used in generateJobDescription params but not stored on jobs table. |
| JOB-03 | Step 2 (Requirements): salary range, education, experience, must-have skills (chips), nice-to-have skills (chips), visa sponsorship toggle | SkillInput component pattern exists in both gen-job/page.tsx and jobs/page.tsx — extract as shared component. All DB columns exist. |
| JOB-04 | Step 3 (AI Generate): generates JD from details, refine text field, live preview | `generateJobDescription` and `refineJobDescription` actions exist and are working. Live preview = Markdown rendering via white-space: pre-wrap or a lightweight renderer. |
| JOB-05 | Step 4 (Interview Config): 1–3 rounds, per-round theme/duration/voice/avatar toggle | UI-only config. No DB columns. Store in wizard state only. The backend wiring is JOB-BE-01 (deferred to v2.1). |
| JOB-06 | Step 5 (Screening): AI-generated Yes/No questions editable by HR | Needs a new `generateScreeningQuestions` server action, or adapt `generateQuestions`. Questions stored in wizard state only (no DB column in v2.0). |
| JOB-07 | Step 6 (Scoring): four hiring bar preset cards (Growth 35+, Standard 50+, High Bar 75+, Elite 90+), Publish action | Selectable card UI. On Publish: supabase.from('jobs').insert(). Redirect to /jobs. Scoring preset stored in wizard state; no dedicated DB column needed beyond what already exists. |
| JOB-08 | Sidebar progress: completed (emerald ✓), active (indigo), pending (gray) | Sidebar component tracks step completion. Step is "complete" when required fields are non-empty. |
| JOB-09 | Save as Draft at any step | localStorage draft. Key: `synchrohire_job_draft`. On re-open, restore from localStorage. Clear on Publish. |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.3 | State management, component composition | Already in project |
| Next.js 16 | 16.1.1 | App Router, server actions | Already in project |
| TypeScript | 5.9.3 | Type safety | Already in project |
| Tailwind CSS 4 | ^4 | Styling | Already in project |
| shadcn/ui | New York style | Form controls, cards, badges, switches | Already in project |
| Zod | ^4.3.6 | Server action schemas | Already in project |
| Supabase JS | ^2.90.1 | DB insert on Publish | Already in project |

### shadcn/ui Components Available (already installed)

| Component | File | Used For |
|-----------|------|---------|
| Input | `components/ui/input.tsx` | Text fields |
| Textarea | `components/ui/textarea.tsx` | Description refinement |
| Select | `components/ui/select.tsx` | Dropdowns (location, education, urgency) |
| Switch | `components/ui/switch.tsx` | Visa sponsorship toggle, avatar toggle |
| Badge | `components/ui/badge.tsx` | Skill chips |
| Button | `components/ui/button.tsx` | Navigation, actions |
| Card | `components/ui/card.tsx` | Scoring preset cards |
| Label | `components/ui/label.tsx` | Form labels |
| Tabs | `components/ui/tabs.tsx` | Available but NOT used for step navigation |

### Components NOT Installed

| Component | Status | Decision |
|-----------|--------|---------|
| Date picker | Not in `components/ui/` | Use `<input type="date">` styled with Tailwind — shadcn Calendar/DatePicker not installed and not worth adding for one field |
| Markdown renderer | Not installed | Use `white-space: pre-wrap` in a `<pre>` or `<div>` for JD preview — no external dependency needed |
| react-hook-form | Installed (@hookform/resolvers ^5.2.2) | Available but NOT recommended — existing codebase pattern uses plain `useState` for all forms |

### No New Dependencies Required

The entire wizard can be built from existing installed packages. Do not add new npm packages.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/app/create-job/
├── page.tsx                  # Main wizard page ('use client', all step state)
└── actions/                  # (no new actions needed — use existing)

frontend/components/wizard/
├── WizardSidebar.tsx         # Left sidebar with step progress
├── StepBasics.tsx            # Step 1 form panel
├── StepRequirements.tsx      # Step 2 form panel
├── StepAIGenerate.tsx        # Step 3 AI + preview panel
├── StepInterviewConfig.tsx   # Step 4 rounds config panel
├── StepScreening.tsx         # Step 5 eligibility questions panel
└── StepScoring.tsx           # Step 6 hiring bar + publish panel

frontend/components/wizard/SkillChipInput.tsx  # Extracted from gen-job, shared
```

**Route decision:** Create `/create-job` as a new route. Update the Jobs page "Create Job" button to link to `/create-job`. Update AppSidebar to add a "Create Job" link OR the wizard launches from the Jobs page button only. The old `/gen-job` route stays intact until the sidebar nav item is updated (AUTH protected, no interview pages touched).

**Middleware:** `/create-job` must be added to the Supabase auth middleware protection list. Currently middleware.ts is not present in the repo root but auth is handled by Supabase SSR cookies in the dashboard layout — verify before implementation.

### Pattern 1: Wizard State in Single Parent Page

All six steps share one state object in `page.tsx`. Steps are pure presentational components receiving state as props.

```typescript
// Source: inferred from existing gen-job/page.tsx pattern
'use client';

interface WizardState {
  // Step 1 — Basics
  title: string;
  department: string;
  location: string;
  workArrangement: 'onsite' | 'hybrid' | 'remote';
  employmentType: 'full_time' | 'part_time' | 'contract';
  urgency: 'asap' | '30_days' | '60_days' | '90_days';
  headcount: number;
  targetStartDate: string; // ISO date string from <input type="date">

  // Step 2 — Requirements
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: 'monthly' | 'yearly';
  education: string;
  experienceMin: string;
  experienceMax: string;
  skillsMustHave: string[];
  skillsNiceToHave: string[];
  visaSponsorship: boolean;

  // Step 3 — AI Generate
  generatedDescription: string;
  refinePrompt: string;

  // Step 4 — Interview Config
  roundCount: 1 | 2 | 3;
  rounds: RoundConfig[];

  // Step 5 — Screening
  screeningQuestions: ScreeningQuestion[];

  // Step 6 — Scoring
  scoringPreset: 'growth' | 'standard' | 'high_bar' | 'elite';
}

interface RoundConfig {
  roundNumber: number;
  theme: string;
  duration: number; // minutes
  voice: string;
  avatarEnabled: boolean;
}

interface ScreeningQuestion {
  id: string;
  question: string;
  isEditing: boolean;
}
```

### Pattern 2: Wizard Two-Column Layout

```typescript
// Source: Stitch design reference (playground.html) + existing dashboard layout pattern
return (
  <div className="flex h-screen bg-[#020617]">
    {/* Left sidebar — fixed width, step progress */}
    <WizardSidebar
      steps={STEPS}
      activeStep={activeStep}
      completedSteps={completedSteps}
      onStepClick={handleStepClick}
      onSaveAsDraft={handleSaveAsDraft}
    />

    {/* Right content area — scrollable */}
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {activeStep === 1 && <StepBasics state={wizardState} onChange={updateWizardState} />}
        {activeStep === 2 && <StepRequirements state={wizardState} onChange={updateWizardState} />}
        {activeStep === 3 && <StepAIGenerate state={wizardState} onChange={updateWizardState} onGenerate={handleGenerate} />}
        {activeStep === 4 && <StepInterviewConfig state={wizardState} onChange={updateWizardState} />}
        {activeStep === 5 && <StepScreening state={wizardState} onChange={updateWizardState} />}
        {activeStep === 6 && <StepScoring state={wizardState} onChange={updateWizardState} onPublish={handlePublish} />}
      </div>
    </div>
  </div>
);
```

### Pattern 3: WizardSidebar Step States

```typescript
// Source: JOB-08 requirement + Stitch design reference
// Colors: emerald #10B981 = completed, indigo #6366F1 = active, gray = pending
// Use style={{ color, borderColor, background }} NOT dynamic Tailwind class names
// Established pattern from Phase 1 FunnelCard and Phase 2 CandidatePanel

const stepColor = (step: number) => {
  if (completedSteps.includes(step)) return { bg: '#10B981', text: '#fff' }; // emerald
  if (step === activeStep) return { bg: '#6366F1', text: '#fff' };           // indigo
  return { bg: '#1E293B', text: '#6B7280' };                                 // gray
};
```

### Pattern 4: Save as Draft (localStorage)

```typescript
// Source: inferred from JOB-09 + no backend persistence in v2.0
const DRAFT_KEY = 'synchrohire_job_draft';

const handleSaveAsDraft = () => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ wizardState, activeStep }));
  // Show success toast
};

// On mount: restore draft
useEffect(() => {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    try {
      const { wizardState: saved State, activeStep: savedStep } = JSON.parse(saved);
      setWizardState(savedState);
      setActiveStep(savedStep);
    } catch { /* corrupt draft — ignore */ }
  }
}, []);

// On Publish: clear draft
localStorage.removeItem(DRAFT_KEY);
```

### Pattern 5: Skill Chip Input (extracted from gen-job)

The SkillInput component exists in both `gen-job/page.tsx` and `jobs/page.tsx` as a local function component. For the wizard, extract it to `components/wizard/SkillChipInput.tsx` so all wizard steps share one copy. The existing pattern uses emerald styling for must-have chips and neutral for nice-to-have.

```typescript
// Source: frontend/app/gen-job/page.tsx lines 72-142 (existing working pattern)
// Extract verbatim, add a `color` prop: 'emerald' | 'blue' | default
export function SkillChipInput({ skills, onChange, placeholder, disabled }: SkillChipInputProps) {
  // Enter key adds chip, X button removes — existing logic is correct
}
```

### Pattern 6: Publish to Supabase

```typescript
// Source: frontend/app/gen-job/page.tsx lines 427-476 (existing working pattern)
// Adapt to insert all wizard state fields
const { error } = await supabase.from('jobs').insert({
  title: wizardState.title,
  description: wizardState.generatedDescription,
  is_active: true,
  department: wizardState.department || null,
  location: wizardState.location,
  work_arrangement: wizardState.workArrangement,
  urgency: wizardState.urgency,
  salary_min: wizardState.salaryMin ? parseInt(wizardState.salaryMin) : null,
  salary_max: wizardState.salaryMax ? parseInt(wizardState.salaryMax) : null,
  salary_currency: wizardState.salaryCurrency,
  salary_period: wizardState.salaryPeriod,
  visa_sponsorship: wizardState.visaSponsorship,
  education_required: wizardState.education,
  experience_min: parseInt(wizardState.experienceMin) || 0,
  experience_max: wizardState.experienceMax ? parseInt(wizardState.experienceMax) : null,
  skills_must_have: wizardState.skillsMustHave.length > 0 ? wizardState.skillsMustHave : null,
  skills_nice_to_have: wizardState.skillsNiceToHave.length > 0 ? wizardState.skillsNiceToHave : null,
  // headcount and target_start_date: only if columns exist (check migration)
});
// On success: router.push('/jobs')
```

### Pattern 7: Generating Screening Questions (Step 5)

No existing `generateScreeningQuestions` action exists. Must create a new server action. Base it on the existing `generateJob.ts` pattern using `generateObject` + Zod schema.

```typescript
// New file: frontend/app/actions/generateScreeningQuestions.ts
'use server';
import { generateObject } from 'ai';
import { gemini } from '@/lib/ai';
import { z } from 'zod';

const ScreeningQuestionsSchema = z.object({
  questions: z.array(z.object({
    question: z.string().describe('A Yes/No eligibility question for the role'),
    rationale: z.string().describe('Why this question filters unqualified candidates'),
  })).min(3).max(8),
});

export async function generateScreeningQuestions(params: {
  title: string;
  location: string;
  skillsMustHave: string[];
  visaSponsorship: boolean;
  education: string;
  experienceMin: string;
}): Promise<{ question: string; rationale: string }[]> {
  const { object } = await generateObject({
    model: gemini,
    schema: ScreeningQuestionsSchema,
    prompt: `Generate 3-8 Yes/No eligibility screening questions for a "${params.title}" role in ${params.location}.
Required skills: ${params.skillsMustHave.join(', ') || 'none specified'}.
Education required: ${params.education}. Min experience: ${params.experienceMin} years.
Visa sponsorship: ${params.visaSponsorship ? 'available' : 'not available'}.
Questions should filter out unqualified candidates quickly. Each must have a clear Yes/No answer.
Examples: "Do you have X years of Y experience?", "Are you legally authorized to work in Z?"`,
  });
  return object.questions;
}
```

### Anti-Patterns to Avoid

- **Dynamic Tailwind class names with runtime values:** Never `bg-${color}-500` or `text-${hex}`. Use `style={{ color: hex }}` or predefined static class names. This is the established pattern from Phases 1 and 2 (FunnelCard, CandidatePanel). Tailwind v4 purges dynamic class names in production.
- **react-hook-form in wizard:** The existing codebase universally uses `useState` for form state. Introducing react-hook-form (even though it's installed) would be inconsistent.
- **Importing types from page.tsx across components:** Established pattern (from Phase 2) is to redeclare needed interfaces inline in each component. page.tsx does not export its interfaces.
- **Using the shadcn Tabs component for step navigation:** Tabs are designed for in-page content switching, not for a multi-step wizard with a sidebar progress indicator. Use conditional rendering (`activeStep === N`) instead.
- **Assuming headcount/target_start_date columns exist:** These are new fields not in the existing gen-job flow. Always verify column existence via `supabase.from('jobs').select('headcount').limit(1)` or check the migration, and create a migration if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill tag input | Custom chip input | Extract existing SkillInput from gen-job/page.tsx | Already battle-tested in two places in the codebase |
| AI job description generation | Custom LLM call | Existing `generateJobDescription` + `refineJobDescription` actions | Already work, include Google Search grounding, no changes needed |
| Date picker UI | Custom calendar component | `<input type="date">` with className styling | shadcn Calendar not installed; native input is sufficient for a single date field |
| Markdown preview | Custom markdown parser | `white-space: pre-wrap` div or `<pre>` element | The JD is LLM-generated clean Markdown; a full parser is overkill |
| Toast notifications | Custom toast system | Inline message state (`useState<{type, text} | null>`) | Established pattern across gen-job, jobs, dashboard pages |
| Step completion detection | Complex validation library | Simple required-field check per step in `completedSteps` computation | Wizard does not need Zod on the client; validation is light |

**Key insight:** The existing gen-job page contains ~70% of the data collection logic already. Phase 3 is a layout and UX restructuring exercise, not an engineering greenfield.

---

## Common Pitfalls

### Pitfall 1: Dynamic Tailwind Class Names at Runtime
**What goes wrong:** Step sidebar renders wrong colors in production (classes get purged). Example: `className={\`text-${isActive ? 'indigo' : 'gray'}-400\`}`.
**Why it happens:** Tailwind v4 scans files at build time. Dynamic strings aren't found.
**How to avoid:** Use `style={{ color: '#6366F1' }}` for hex values. Use predefined full class names in ternary: `isActive ? 'text-indigo-400' : 'text-gray-400'` (static strings are fine; interpolation is not).
**Warning signs:** Colors work in `npm run dev` but break after `npm run build`.

### Pitfall 2: Missing Database Columns for New Fields
**What goes wrong:** `supabase.from('jobs').insert({ headcount: 2, target_start_date: '...' })` silently drops unknown columns or throws a schema error.
**Why it happens:** `headcount` and `target_start_date` are new fields not in the current `jobs` table schema (they don't appear in gen-job's existing `insert` call).
**How to avoid:** Before Plan 03-02, check the live schema with `supabase.from('jobs').select('headcount').limit(1)`. If it errors, create `migrations/002_wizard_fields.sql` and execute via Supabase MCP. **Employment type** may also be missing — the existing gen-job uses it only as an AI prompt parameter, not as a stored column.
**Warning signs:** Publish silently succeeds but job record lacks headcount/start_date fields when read back.

### Pitfall 3: Server Action Called in Client Render Loop
**What goes wrong:** `generateScreeningQuestions` is called on every render of Step 5 panel, hammering the AI API.
**Why it happens:** Calling an async action inside the component body without a guard.
**How to avoid:** Use a `useState<boolean>` flag `hasGenerated` + `useEffect` with `[activeStep]` dependency. Only call when `activeStep === 5 && !hasGenerated`. Pattern established in gen-job: `skillsGeneratedForTitle.current === title` prevents duplicate calls.

### Pitfall 4: localStorage Draft State Shape Mismatch After Code Changes
**What goes wrong:** Developer changes WizardState interface, old draft JSON from localStorage causes crash on restore.
**Why it happens:** `JSON.parse` returns old shape, missing new required fields.
**How to avoid:** Wrap draft restore in try/catch and always merge with defaults:
```typescript
const defaults = getDefaultWizardState();
const restored = { ...defaults, ...parsedDraft.wizardState };
```

### Pitfall 5: /create-job Route Not Auth-Protected
**What goes wrong:** Interview candidates navigate to `/create-job` URL directly.
**Why it happens:** Next.js App Router requires explicit middleware config for each protected route. If `middleware.ts` (or equivalent) doesn't list `/create-job`, it's public.
**How to avoid:** Add `/create-job` to the protected routes in middleware. Inspect `frontend/app` layout to see how other protected routes handle auth (dashboard uses Supabase SSR check on mount — follow that pattern).

### Pitfall 6: Wizard State Loss on Navigation
**What goes wrong:** HR clicks browser back/forward, wizard resets to step 1 with empty fields.
**Why it happens:** No URL-based step state; state lives only in React memory.
**How to avoid:** Save to localStorage on every state change (`useEffect` on wizardState), not just on "Save as Draft" button click. This gives implicit draft behavior even without the explicit button.

---

## Code Examples

### WizardSidebar Component Pattern

```typescript
// Source: Stitch design reference + Phase 2 CandidatePanel inline style pattern
const STEPS = [
  { num: 1, label: 'Basics', description: 'Role essentials' },
  { num: 2, label: 'Requirements', description: 'Skills & compensation' },
  { num: 3, label: 'AI Generate', description: 'Job description' },
  { num: 4, label: 'Interview Config', description: 'Round setup' },
  { num: 5, label: 'Screening', description: 'Eligibility questions' },
  { num: 6, label: 'Scoring & Publish', description: 'Hiring bar' },
];

// Step state coloring — inline styles, NOT dynamic Tailwind
function getStepStyle(step: number, activeStep: number, completedSteps: number[]) {
  if (completedSteps.includes(step)) {
    return {
      numberBg: '#10B981',    // emerald
      numberColor: '#fff',
      labelColor: '#10B981',
      icon: 'check',
    };
  }
  if (step === activeStep) {
    return {
      numberBg: '#6366F1',    // indigo
      numberColor: '#fff',
      labelColor: '#F9FAFB',
      icon: 'number',
    };
  }
  return {
    numberBg: '#1E293B',      // gray surface
    numberColor: '#6B7280',
    labelColor: '#6B7280',
    icon: 'number',
  };
}
```

### Step Completion Detection

```typescript
// Source: derived from requirements JOB-08
// A step is "complete" when its required fields are filled
function getCompletedSteps(state: WizardState): number[] {
  const completed: number[] = [];
  if (state.title.trim() && state.location.trim()) completed.push(1);
  if (state.salaryMin || state.salaryMax || state.skillsMustHave.length > 0) completed.push(2);
  if (state.generatedDescription.trim()) completed.push(3);
  if (state.roundCount >= 1) completed.push(4);
  if (state.screeningQuestions.length > 0) completed.push(5);
  // Step 6 never pre-complete — requires explicit Publish action
  return completed;
}
```

### Interview Config Round Row (Step 4)

```typescript
// Source: SETT-06 settings pattern (same UI, same fields)
// Renders one row per round: Theme select, Duration select, Voice select, Avatar toggle
const THEMES = ['Personality & Culture', 'Technical Assessment', 'Leadership & Strategy'];
const DURATIONS = [15, 20, 30, 45, 60]; // minutes
const VOICES = ['Wayne (Friendly)', 'Atlas (Technical)', 'Nova (Neutral)'];

function RoundConfigRow({ round, onChange }: { round: RoundConfig; onChange: (r: RoundConfig) => void }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border border-[#1E293B] bg-[#0F172A]">
      <span className="text-sm font-medium text-[#94A3B8] w-16 shrink-0">Round {round.roundNumber}</span>
      <Select value={round.theme} onValueChange={(v) => onChange({ ...round, theme: v })}>
        {/* Theme options */}
      </Select>
      <Select value={String(round.duration)} onValueChange={(v) => onChange({ ...round, duration: Number(v) })}>
        {/* Duration options */}
      </Select>
      <Select value={round.voice} onValueChange={(v) => onChange({ ...round, voice: v })}>
        {/* Voice options */}
      </Select>
      <div className="flex items-center gap-2 ml-auto">
        <Label className="text-xs text-[#6B7280]">Avatar</Label>
        <Switch checked={round.avatarEnabled} onCheckedChange={(v) => onChange({ ...round, avatarEnabled: v })} />
      </div>
    </div>
  );
}
```

### Hiring Bar Preset Cards (Step 6)

```typescript
// Source: JOB-07 + SETT-07 requirements — same 4 presets used in both wizard and settings
const HIRING_PRESETS = [
  { id: 'growth', label: 'Growth', threshold: 35, description: 'Cast a wide net', color: '#10B981' },
  { id: 'standard', label: 'Standard', threshold: 50, description: 'Balanced quality bar', color: '#6366F1' },
  { id: 'high_bar', label: 'High Bar', threshold: 75, description: 'Strong candidates only', color: '#F59E0B' },
  { id: 'elite', label: 'Elite', threshold: 90, description: 'Top 10% only', color: '#EF4444' },
];

// Card selected state: border color changes. Use style prop for the dynamic color.
// className stays static: 'rounded-xl border-2 cursor-pointer transition-colors p-4'
// style={{ borderColor: isSelected ? preset.color : '#1E293B' }}
```

---

## State of the Art

| Old Approach (gen-job) | New Approach (Wizard) | Impact |
|------------------------|----------------------|--------|
| Single page, horizontal step tabs at top | Two-column layout with left sidebar progress | Matches Stitch design; sidebar persists while scrolling step content |
| Step tabs clickable freely (no completion gate) | Sidebar shows completion state; free navigation maintained | HR can jump back to fix earlier steps |
| All state in flat `useState` per field | Consolidated `WizardState` object updated via single `updateWizardState(partial)` | Easier to serialize for localStorage draft |
| No draft save | `localStorage` draft on every state change | JOB-09 satisfied without backend changes |
| Redirect to `/dashboard` after publish | Redirect to `/jobs` after publish | More logical UX (job management, not candidate pipeline) |
| 6-step flow including Rubric step | 6-step flow: Basics, Requirements, AI Generate, Interview Config, Screening, Scoring | New step structure; Rubric generation is no longer a wizard step (can be added later in edit) |

**Deprecated in Phase 3:**
- `/gen-job` page content: replaced by `/create-job`. The route `/gen-job` can remain but AppSidebar link should update to `/create-job`. The AUTH middleware needs updating too.

---

## Open Questions

1. **Do `headcount` and `target_start_date` columns exist on the `jobs` table?**
   - What we know: The current gen-job `insert` call does not include these fields. The `jobs` table interface in `jobs/page.tsx` does not show them either.
   - What's unclear: Whether `migrations/001_enhance_jobs_table.sql` (mentioned as pending in MEMORY.md) added them.
   - Recommendation: Plan 03-01 executor should check `select headcount from jobs limit 1` via Supabase MCP. If missing, create `migrations/002_wizard_fields.sql` with `ALTER TABLE jobs ADD COLUMN headcount integer, ADD COLUMN target_start_date date, ADD COLUMN employment_type text`.

2. **Does `employment_type` need to be stored in the DB?**
   - What we know: gen-job uses `employmentType` only as a string passed to the AI generation prompt, not stored.
   - What's unclear: JOB-02 lists it as a field — should it persist?
   - Recommendation: Store it. Add to migration (see above). The column type is `text`.

3. **Is middleware auth protection needed for `/create-job`?**
   - What we know: There is no `middleware.ts` in `frontend/` (only in `frontend/app/middleware.ts` which doesn't exist either based on the file search). Auth protection is currently achieved via Supabase SSR checks in individual page components.
   - Recommendation: Follow the same pattern as dashboard — check Supabase session on mount and redirect to `/login` if unauthenticated.

4. **Should the wizard replace `/gen-job` in AppSidebar?**
   - What we know: `AppSidebar.tsx` links to `/gen-job` with label "AI Job Generator". STATE.md says "/gen-job replaced by new Create Job wizard at same route or /create-job".
   - Recommendation: Create `/create-job` as new route. In Plan 03-01, update AppSidebar nav item label from "AI Job Generator" to "Create Job" and href to `/create-job`. Keep `/gen-job` page in place (don't delete it — just stop linking to it from the nav).

5. **Where do screening questions get stored?**
   - What we know: JOB-06 says questions are editable by HR. There is no `screening_questions` column on jobs table in the current schema. v2.0 defers backend wiring.
   - Recommendation: Store in wizard state only (not persisted to DB on Publish). If you want to store them, add a `screening_questions jsonb` column to the migration. Decision should be made in planning — research says: add the column so the data isn't lost when HR goes back to edit, even if the backend doesn't act on it yet.

---

## Validation Architecture

No test framework is installed or configured in this project (`frontend/package.json` has no Jest, Vitest, Playwright, or Cypress dependencies; no test directory exists). This is a frontend-only UI project.

**Per-task validation:** TypeScript build check.
```bash
cd C:/Users/Admin3k/Documents/interview/frontend && yarn build 2>&1 | tail -20
```

**Phase gate:** Full build passes with zero TypeScript errors before marking Phase 3 complete.

Wave 0 gaps: None — no test infrastructure to create. The project deliberately has no automated test suite.

---

## Sources

### Primary (HIGH confidence)
- `frontend/app/gen-job/page.tsx` — existing wizard state patterns, publish flow, AI action wiring, SkillInput component, step state management
- `frontend/app/actions/generateJob.ts` — generateJobDescription and refineJobDescription action signatures
- `frontend/app/jobs/page.tsx` — Job interface, existing fields on jobs table, Supabase insert patterns
- `frontend/components/AppSidebar.tsx` — sidebar nav item structure, Tailwind class patterns
- `frontend/package.json` — installed dependencies (confirmed no date picker, no markdown renderer)
- `frontend/components/ui/` directory listing — available shadcn components

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — Phase 3 requirement specs (JOB-01 through JOB-09)
- `.planning/STATE.md` — architectural decisions, design tokens, Tailwind dynamic class avoidance rule
- `.planning/ROADMAP.md` — Phase 3 plan structure (6 plans), dependency on Phase 1

### Tertiary (LOW confidence — requires verification)
- Assumption that `headcount`, `target_start_date`, `employment_type` columns do not yet exist on `jobs` table — verify via Supabase MCP before Plan 03-02

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json
- Architecture patterns: HIGH — grounded in existing gen-job and CandidatePanel patterns
- Missing DB columns: LOW — assumption based on absence in existing insert call; must verify
- Pitfalls: HIGH — all identified from existing codebase evidence (Tailwind purge issue established in Phase 1 decisions, localStorage draft is new but low-risk)

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable stack — Next.js, shadcn, Supabase versions unlikely to change)
