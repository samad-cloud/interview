'use client';

import { useState } from 'react';
import { generateJobDescription, refineJobDescription } from '@/app/actions/generateJob';
import type { JobCitation } from '@/app/actions/generateJob';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import type { WizardState } from '@/app/create-job/page';

interface StepAIGenerateProps {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

function buildGenParams(state: WizardState) {
  const salaryStr =
    state.salaryMin || state.salaryMax
      ? `${state.salaryCurrency} ${state.salaryMin || '?'}–${state.salaryMax || '?'}/${state.salaryPeriod}`
      : 'Competitive';
  return {
    title: state.title,
    salary: salaryStr,
    location: state.location,
    employmentType: state.employmentType.replace(/_/g, ' '),
    experienceLevel: state.experienceMin
      ? `${state.experienceMin}–${state.experienceMax || '+'} years`
      : undefined,
    keySkills: state.skillsMustHave.join(', ') || undefined,
    mustHave: state.skillsMustHave.join(', ') || undefined,
    niceToHave: state.skillsNiceToHave.join(', ') || undefined,
  };
}

export function StepAIGenerate({ state, onChange, onNext, onPrev }: StepAIGenerateProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [citations, setCitations] = useState<JobCitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [citationsOpen, setCitationsOpen] = useState(false);

  const hasGenerated = state.generatedDescription.trim() !== '';
  const canGenerate = state.title.trim() !== '' && state.location.trim() !== '';

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateJobDescription(buildGenParams(state));
      onChange({ generatedDescription: result.description, refinePrompt: '' });
      setCitations(result.citations);
    } catch {
      setError('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefine() {
    if (!state.refinePrompt.trim()) return;
    setIsRefining(true);
    setError(null);
    try {
      const refined = await refineJobDescription(state.generatedDescription, state.refinePrompt);
      onChange({ generatedDescription: refined, refinePrompt: '' });
    } catch {
      setError('Refinement failed. Please try again.');
    } finally {
      setIsRefining(false);
    }
  }

  return (
    <div>
      {/* Step header */}
      <div style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '13px', color: '#6366F1', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Step 3 of 6 — AI Generate
        </p>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
          Job Description
        </h1>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#FCA5A5', fontSize: '14px' }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {!hasGenerated ? (
        /* ── Pre-generate state ── */
        <div
          style={{
            marginTop: '32px',
            padding: '40px 32px',
            background: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'rgba(99,102,241,0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Sparkles size={24} style={{ color: '#6366F1' }} />
          </div>

          <h2 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Generate your job description with AI
          </h2>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', maxWidth: '420px', margin: '0 auto 24px' }}>
            We'll research competitor postings and write a compelling JD that stands out — specific, honest, and tailored to your role.
          </p>

          {/* Source data summary */}
          <div
            style={{
              background: '#020617',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '24px',
              display: 'inline-block',
              textAlign: 'left',
              minWidth: '280px',
            }}
          >
            <div style={{ display: 'flex', gap: '24px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Title</p>
                <p style={{ fontSize: '14px', color: state.title ? '#CBD5E1' : '#475569' }}>
                  {state.title || '(not set)'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Location</p>
                <p style={{ fontSize: '14px', color: state.location ? '#CBD5E1' : '#475569' }}>
                  {state.location || '(not set)'}
                </p>
              </div>
            </div>
          </div>

          {!canGenerate && (
            <p style={{ color: '#F59E0B', fontSize: '13px', marginBottom: '16px' }}>
              Complete Step 1 first — title and location are required.
            </p>
          )}

          <div>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              style={{
                background: canGenerate ? '#6366F1' : '#1E293B',
                color: canGenerate ? '#fff' : '#475569',
                border: 'none',
                padding: '10px 28px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: canGenerate && !isGenerating ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Post-generate state: two-column layout ── */
        <div style={{ marginTop: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* Left — preview (60%) */}
          <div style={{ flex: '0 0 60%' }}>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#CBD5E1',
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '16px',
                maxHeight: '500px',
                overflowY: 'auto',
              }}
            >
              {state.generatedDescription}
            </div>

            {/* Citations */}
            {citations.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => setCitationsOpen((o) => !o)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                >
                  <ExternalLink size={12} />
                  Research sources ({citations.length}) {citationsOpen ? '▲' : '▼'}
                </button>
                {citationsOpen && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#6366F1] hover:underline"
                        style={{ fontSize: '12px', color: '#6366F1' }}
                      >
                        {c.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — refine controls (40%) */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                background: '#1E293B',
                color: '#CBD5E1',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                justifyContent: 'center',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Regenerating…
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Regenerate from scratch
                </>
              )}
            </Button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '1px', background: '#1E293B' }} />
              <span style={{ color: '#475569', fontSize: '12px' }}>or refine</span>
              <div style={{ flex: 1, height: '1px', background: '#1E293B' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Label style={{ color: '#94A3B8', fontSize: '12px' }}>Feedback</Label>
              <Textarea
                value={state.refinePrompt}
                onChange={(e) => onChange({ refinePrompt: e.target.value })}
                placeholder="e.g. Make it more technical, add a section about work-life balance, shorten the requirements list"
                rows={5}
                style={{
                  background: '#0F172A',
                  border: '1px solid #1E293B',
                  color: '#CBD5E1',
                  fontSize: '13px',
                  borderRadius: '8px',
                  resize: 'vertical',
                }}
              />
              <Button
                onClick={handleRefine}
                disabled={!state.refinePrompt.trim() || isRefining}
                style={{
                  background: state.refinePrompt.trim() && !isRefining ? '#6366F1' : '#1E293B',
                  color: state.refinePrompt.trim() && !isRefining ? '#fff' : '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: state.refinePrompt.trim() && !isRefining ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                {isRefining ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Refining…
                  </>
                ) : (
                  'Refine'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #1E293B',
        }}
      >
        <Button
          onClick={onPrev}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94A3B8',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          ← Previous
        </Button>
        <Button
          onClick={onNext}
          disabled={!hasGenerated}
          style={{
            background: hasGenerated ? '#6366F1' : '#1E293B',
            color: hasGenerated ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: hasGenerated ? 'pointer' : 'not-allowed',
          }}
        >
          Next: Interview Config →
        </Button>
      </div>
    </div>
  );
}
