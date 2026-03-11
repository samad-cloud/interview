'use client';

import { CheckCircle, FileText } from 'lucide-react';
import Link from 'next/link';

export type WizardStep = {
  num: number;
  label: string;
  description: string;
};

export const STEPS: WizardStep[] = [
  { num: 1, label: 'Basics', description: 'Role essentials' },
  { num: 2, label: 'Requirements', description: 'Skills & compensation' },
  { num: 3, label: 'AI Generate', description: 'Job description' },
  { num: 4, label: 'Interview Config', description: 'Round setup' },
  { num: 5, label: 'Screening', description: 'Eligibility questions' },
  { num: 6, label: 'Scoring & Publish', description: 'Hiring bar' },
];

interface WizardSidebarProps {
  activeStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
  onSaveAsDraft: () => void;
  draftSaved?: boolean;
}

export function WizardSidebar({
  activeStep,
  completedSteps,
  onStepClick,
  onSaveAsDraft,
  draftSaved,
}: WizardSidebarProps) {
  return (
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        background: '#0F172A',
        borderRight: '1px solid #1E293B',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <FileText style={{ width: '18px', height: '18px', color: '#6366F1' }} />
          <span style={{ fontSize: '16px', fontWeight: '600', color: '#F9FAFB' }}>Create Job</span>
        </div>
        <span style={{ fontSize: '12px', color: '#64748B' }}>6-step wizard</span>
      </div>

      {/* Step list */}
      <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.num);
          const isActive = step.num === activeStep;
          const isPending = !isCompleted && !isActive;

          // Circle styles
          const circleStyle: React.CSSProperties = {
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: isCompleted ? '#10B981' : isActive ? '#6366F1' : '#1E293B',
          };

          // Row styles
          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
            transition: 'background 0.15s',
          };

          // Label color
          const labelColor = isCompleted ? '#10B981' : isActive ? '#F9FAFB' : '#6B7280';

          return (
            <div key={step.num}>
              <button
                onClick={() => onStepClick(step.num)}
                style={rowStyle}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = isActive
                    ? 'rgba(99,102,241,0.08)'
                    : 'transparent';
                }}
                type="button"
                aria-label={`Go to step ${step.num}: ${step.label}`}
              >
                <div style={circleStyle}>
                  {isCompleted ? (
                    <CheckCircle style={{ width: '14px', height: '14px', color: '#fff' }} />
                  ) : (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: isActive ? '#fff' : '#6B7280',
                      }}
                    >
                      {step.num}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: labelColor, lineHeight: 1.3 }}>
                    {step.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569', lineHeight: 1.3 }}>
                    {step.description}
                  </span>
                </div>
              </button>

              {/* Connector line (not after last step) */}
              {index < STEPS.length - 1 && (
                <div
                  style={{
                    height: '20px',
                    marginLeft: '23px',
                    borderLeft: '1px solid #1E293B',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid #1E293B' }}>
        <button
          onClick={onSaveAsDraft}
          type="button"
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            color: '#94A3B8',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: draftSaved ? '6px' : '12px',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366F1';
            (e.currentTarget as HTMLButtonElement).style.color = '#6366F1';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#1E293B';
            (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8';
          }}
        >
          Save as Draft
        </button>

        {draftSaved && (
          <div
            style={{
              fontSize: '12px',
              color: '#10B981',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            Draft saved
          </div>
        )}

        <Link
          href="/jobs"
          style={{
            display: 'block',
            textAlign: 'center',
            fontSize: '12px',
            color: '#475569',
            textDecoration: 'none',
          }}
        >
          Back to Jobs
        </Link>
      </div>
    </div>
  );
}
