'use client';

import { useState, useRef } from 'react';
import { generateScreeningQuestions } from '@/app/actions/generateScreeningQuestions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Pencil, X, Plus, Check } from 'lucide-react';
import type { WizardState, ScreeningQuestion } from '@/app/create-job/page';

interface StepScreeningProps {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepScreening(props: StepScreeningProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  // Guard: only auto-generate once per component mount
  const hasGenerated = useRef(props.state.screeningQuestions.length > 0);

  const questions = props.state.screeningQuestions;

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const results = await generateScreeningQuestions({
        title: props.state.title,
        location: props.state.location,
        skillsMustHave: props.state.skillsMustHave,
        visaSponsorship: props.state.visaSponsorship,
        education: props.state.education,
        experienceMin: props.state.experienceMin,
      });
      const generated: ScreeningQuestion[] = results.map((r) => ({
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        question: r.question,
        isEditing: false,
      }));
      props.onChange({ screeningQuestions: generated });
      hasGenerated.current = true;
    } catch {
      setError('Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleRemove(id: string) {
    props.onChange({
      screeningQuestions: questions.filter((q) => q.id !== id),
    });
  }

  function handleStartEdit(id: string, currentText: string) {
    setEditingValues((prev) => ({ ...prev, [id]: currentText }));
    props.onChange({
      screeningQuestions: questions.map((q) =>
        q.id === id ? { ...q, isEditing: true } : q
      ),
    });
  }

  function handleSaveEdit(id: string) {
    const newText = editingValues[id]?.trim();
    if (!newText) return;
    props.onChange({
      screeningQuestions: questions.map((q) =>
        q.id === id ? { ...q, question: newText, isEditing: false } : q
      ),
    });
    setEditingValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleCancelEdit(id: string) {
    props.onChange({
      screeningQuestions: questions.map((q) =>
        q.id === id ? { ...q, isEditing: false } : q
      ),
    });
    setEditingValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleAddQuestion() {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    props.onChange({
      screeningQuestions: [
        ...questions,
        { id: `q-${Date.now()}`, question: trimmed, isEditing: false },
      ],
    });
    setNewQuestion('');
  }

  const hasTitle = props.state.title.trim() !== '';

  return (
    <div>
      {/* Step header */}
      <div className="mb-1" style={{ color: '#6366F1', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Step 5 of 6
      </div>
      <h2 className="mb-1" style={{ color: '#F9FAFB', fontSize: '1.5rem', fontWeight: 700 }}>
        Eligibility Questions
      </h2>
      <p className="mb-6" style={{ color: '#94A3B8', fontSize: '0.875rem' }}>
        Yes/No screening questions shown to candidates before their interview invite.
      </p>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-lg mb-4"
          style={{ background: '#1F0707', border: '1px solid #7F1D1D', color: '#FCA5A5' }}
        >
          <span style={{ fontSize: '0.875rem' }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ color: '#FCA5A5', flexShrink: 0 }}
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty state — no questions yet */}
      {questions.length === 0 && (
        <div
          className="p-6 rounded-xl mb-4 text-center"
          style={{ background: '#0F172A', border: '1px solid #1E293B' }}
        >
          <div className="mb-3" style={{ color: '#64748B', fontSize: '0.875rem' }}>
            AI will generate Yes/No eligibility questions based on your role requirements.
            You can edit, remove, or add custom questions after generation.
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !hasTitle}
            style={{ background: '#6366F1', color: '#fff' }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating questions…
              </>
            ) : (
              'Generate Questions'
            )}
          </Button>
          {!hasTitle && (
            <p className="mt-2" style={{ color: '#64748B', fontSize: '0.75rem' }}>
              Complete Step 1 (job title) first
            </p>
          )}
        </div>
      )}

      {/* Question list */}
      {questions.length > 0 && (
        <div>
          {/* Regenerate button */}
          <div className="flex justify-end mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !hasTitle}
              style={{ color: '#94A3B8', fontSize: '0.75rem' }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Regenerating…
                </>
              ) : (
                'Regenerate'
              )}
            </Button>
          </div>

          {/* Questions */}
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-3 p-3 rounded-lg mb-2"
              style={{ border: '1px solid #1E293B', background: '#0F172A' }}
            >
              {/* Yes/No badge */}
              <span
                className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: '#6366F180', color: '#818CF8' }}
              >
                Yes/No
              </span>

              {/* Question text or edit input */}
              <div className="flex-1 min-w-0">
                {q.isEditing ? (
                  <Input
                    value={editingValues[q.id] ?? q.question}
                    onChange={(e) =>
                      setEditingValues((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(q.id);
                      if (e.key === 'Escape') handleCancelEdit(q.id);
                    }}
                    autoFocus
                    className="bg-[#0F172A] border-[#1E293B] text-[#F9FAFB]"
                    style={{ fontSize: '0.875rem' }}
                  />
                ) : (
                  <p style={{ color: '#E2E8F0', fontSize: '0.875rem', lineHeight: '1.5' }}>
                    {q.question}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-1 shrink-0 mt-0.5">
                {q.isEditing ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(q.id)}
                      className="p-1 rounded hover:bg-white/10"
                      style={{ color: '#10B981' }}
                      aria-label="Save edit"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancelEdit(q.id)}
                      className="p-1 rounded hover:bg-white/10"
                      style={{ color: '#94A3B8' }}
                      aria-label="Cancel edit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(q.id, q.question)}
                      className="p-1 rounded hover:bg-white/10"
                      style={{ color: '#94A3B8' }}
                      aria-label="Edit question"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(q.id)}
                      className="p-1 rounded hover:bg-white/10"
                      style={{ color: '#94A3B8' }}
                      aria-label="Remove question"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Add custom question */}
          <div className="flex gap-2 mt-3">
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Add a custom screening question…"
              onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
              className="bg-[#0F172A] border-[#1E293B] text-[#F9FAFB]"
            />
            <Button
              onClick={handleAddQuestion}
              disabled={!newQuestion.trim()}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Navigation footer */}
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={props.onPrev} style={{ borderColor: '#1E293B', color: '#94A3B8' }}>
          ← Previous
        </Button>
        <Button
          onClick={props.onNext}
          style={{ background: '#6366F1', color: '#fff' }}
        >
          Next: Scoring →
        </Button>
      </div>
    </div>
  );
}
