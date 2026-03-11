'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { WizardSidebar } from '@/components/wizard/WizardSidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoundConfig {
  roundNumber: number;
  theme: string;
  duration: number;
  voice: string;
  avatarEnabled: boolean;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
  isEditing: boolean;
}

export interface WizardState {
  // Step 1 — Basics
  title: string;
  department: string;
  location: string;
  workArrangement: 'onsite' | 'hybrid' | 'remote';
  employmentType: 'full_time' | 'part_time' | 'contract';
  urgency: 'asap' | '30_days' | '60_days' | '90_days';
  headcount: number;
  targetStartDate: string;
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
  // Step 6 — Scoring & Publish
  scoringPreset: 'growth' | 'standard' | 'high_bar' | 'elite';
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function getDefaultWizardState(): WizardState {
  return {
    // Step 1
    title: '',
    department: '',
    location: '',
    workArrangement: 'onsite',
    employmentType: 'full_time',
    urgency: '30_days',
    headcount: 1,
    targetStartDate: '',
    // Step 2
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: 'GBP',
    salaryPeriod: 'yearly',
    education: '',
    experienceMin: '',
    experienceMax: '',
    skillsMustHave: [],
    skillsNiceToHave: [],
    visaSponsorship: false,
    // Step 3
    generatedDescription: '',
    refinePrompt: '',
    // Step 4
    roundCount: 2,
    rounds: [
      {
        roundNumber: 1,
        theme: 'Personality & Culture',
        duration: 30,
        voice: 'Wayne (Friendly)',
        avatarEnabled: false,
      },
      {
        roundNumber: 2,
        theme: 'Personality & Culture',
        duration: 30,
        voice: 'Wayne (Friendly)',
        avatarEnabled: false,
      },
    ],
    // Step 5
    screeningQuestions: [],
    // Step 6
    scoringPreset: 'standard',
  };
}

// ─── Completion logic ─────────────────────────────────────────────────────────

function getCompletedSteps(state: WizardState): number[] {
  const completed: number[] = [];
  if (state.title.trim() !== '' && state.location.trim() !== '') completed.push(1);
  if (state.salaryMin !== '' || state.salaryMax !== '' || state.skillsMustHave.length > 0) completed.push(2);
  if (state.generatedDescription.trim() !== '') completed.push(3);
  if (state.roundCount >= 1) completed.push(4);
  if (state.screeningQuestions.length > 0) completed.push(5);
  // Step 6 never pre-complete
  return completed;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateJobPage() {
  const router = useRouter();
  const isFirstRender = useRef(true);

  const [activeStep, setActiveStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>(getDefaultWizardState());
  const [draftSaved, setDraftSaved] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login?redirect=/create-job');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft restore on mount
  useEffect(() => {
    const saved = localStorage.getItem('synchrohire_job_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaults = getDefaultWizardState();
        setWizardState({ ...defaults, ...parsed.wizardState });
        if (parsed.activeStep) setActiveStep(parsed.activeStep);
      } catch {
        // ignore corrupt draft
      }
    }
  }, []);

  // Auto-save draft on every wizardState / activeStep change (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(
      'synchrohire_job_draft',
      JSON.stringify({ wizardState, activeStep }),
    );
  }, [wizardState, activeStep]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function updateWizardState(partial: Partial<WizardState>) {
    setWizardState((prev) => ({ ...prev, ...partial }));
  }

  function handleSaveAsDraft() {
    localStorage.setItem(
      'synchrohire_job_draft',
      JSON.stringify({ wizardState, activeStep }),
    );
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  function handleStepClick(step: number) {
    setActiveStep(step);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#020617' }}
    >
      <WizardSidebar
        activeStep={activeStep}
        completedSteps={getCompletedSteps(wizardState)}
        onStepClick={handleStepClick}
        onSaveAsDraft={handleSaveAsDraft}
        draftSaved={draftSaved}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* Step placeholder — replaced in subsequent plans */}
          <div style={{ color: '#94A3B8' }}>
            Step {activeStep} content — coming in next plans
          </div>
        </div>
      </div>
    </div>
  );
}
