'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateKey = 'invite' | 'followup' | 'rejection' | 'shortlist';
type TemplateFields = { subject: string; heading: string; body: string; footer: string };
type TemplatesState = Record<TemplateKey, TemplateFields>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATE_TABS: { key: TemplateKey; label: string }[] = [
  { key: 'invite', label: 'Interview Invite' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'rejection', label: 'Rejection' },
  { key: 'shortlist', label: 'Shortlist' },
];

const PLACEHOLDERS: Record<keyof TemplateFields, string[]> = {
  subject: ['{{candidate_name}}', '{{job_title}}', '{{company_name}}'],
  heading: ['{{candidate_name}}', '{{job_title}}'],
  body: ['{{candidate_name}}', '{{job_title}}', '{{interview_link}}', '{{date}}', '{{company_name}}'],
  footer: ['{{company_name}}', '{{unsubscribe_link}}'],
};

const INITIAL_TEMPLATES: TemplatesState = {
  invite:    { subject: '', heading: '', body: '', footer: '' },
  followup:  { subject: '', heading: '', body: '', footer: '' },
  rejection: { subject: '', heading: '', body: '', footer: '' },
  shortlist: { subject: '', heading: '', body: '', footer: '' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlaceholderPills({ pills }: { pills: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {pills.map((pill) => (
        <span
          key={pill}
          className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono cursor-pointer hover:border-indigo-500 hover:text-indigo-400 transition-colors"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EmailCommsTab() {
  const [senderName, setSenderName] = useState('');
  const [templates, setTemplates] = useState<TemplatesState>(INITIAL_TEMPLATES);
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('invite');

  // Send rule toggles
  const [autoSendPass, setAutoSendPass] = useState(false);
  const [followupReminder, setFollowupReminder] = useState(false);
  const [autoReject, setAutoReject] = useState(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateTemplate(field: keyof TemplateFields, value: string) {
    setTemplates((prev) => ({
      ...prev,
      [activeTemplate]: { ...prev[activeTemplate], [field]: value },
    }));
  }

  const current = templates[activeTemplate];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* 1. Gmail status banner */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-[#0F172A]">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-sm text-muted-foreground">Connected as hr@company.com</span>
      </div>

      {/* 2. Sender display name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sender-name" className="text-sm font-medium text-foreground">
          Sender Display Name
        </label>
        <input
          id="sender-name"
          type="text"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="e.g. SynchroHire Recruiting"
          className="h-9 w-full rounded-md border border-border bg-[#0F172A] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
        />
      </div>

      {/* 3. Template editors section header */}
      <h2 className="text-base font-semibold text-foreground -mb-2">Email Templates</h2>

      {/* 4. Template selector buttons */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_TABS.map(({ key, label }) => {
          const isActive = activeTemplate === key;
          return isActive ? (
            <button
              key={key}
              onClick={() => setActiveTemplate(key)}
              className="border rounded-lg px-4 py-2 text-sm font-medium text-indigo-400 transition-colors"
              style={{ backgroundColor: '#6366F120', borderColor: '#6366F1' }}
            >
              {label}
            </button>
          ) : (
            <button
              key={key}
              onClick={() => setActiveTemplate(key)}
              className="border border-border rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 5. Active template fields */}
      <div className="flex flex-col gap-5 p-4 rounded-lg border border-border bg-[#0F172A]">
        {/* Subject */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Subject</label>
          <input
            type="text"
            value={current.subject}
            onChange={(e) => updateTemplate('subject', e.target.value)}
            placeholder="Email subject line"
            className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <PlaceholderPills pills={PLACEHOLDERS.subject} />
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Heading</label>
          <input
            type="text"
            value={current.heading}
            onChange={(e) => updateTemplate('heading', e.target.value)}
            placeholder="Email heading / greeting"
            className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <PlaceholderPills pills={PLACEHOLDERS.heading} />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Body</label>
          <textarea
            rows={6}
            value={current.body}
            onChange={(e) => updateTemplate('body', e.target.value)}
            placeholder="Main email body content"
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <PlaceholderPills pills={PLACEHOLDERS.body} />
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Footer</label>
          <input
            type="text"
            value={current.footer}
            onChange={(e) => updateTemplate('footer', e.target.value)}
            placeholder="Footer text"
            className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <PlaceholderPills pills={PLACEHOLDERS.footer} />
        </div>
      </div>

      {/* 6. Automated Send Rules */}
      <h2 className="text-base font-semibold text-foreground -mb-2">Automated Send Rules</h2>

      <div className="flex flex-col gap-3">
        {/* Row 1: Auto-send on pass */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-send on pass</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically send interview invite when candidate passes screening
            </p>
          </div>
          <Switch
            checked={autoSendPass}
            onCheckedChange={setAutoSendPass}
            aria-label="Auto-send on pass"
          />
        </div>

        {/* Row 2: Follow-up reminder */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Follow-up reminder</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send reminder 48 hours before interview if candidate hasn&apos;t joined
            </p>
          </div>
          <Switch
            checked={followupReminder}
            onCheckedChange={setFollowupReminder}
            aria-label="Follow-up reminder"
          />
        </div>

        {/* Row 3: Auto-reject */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-reject</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically send rejection email when candidate scores below threshold
            </p>
          </div>
          <Switch
            checked={autoReject}
            onCheckedChange={setAutoReject}
            aria-label="Auto-reject"
          />
        </div>
      </div>

      {/* 7. Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => {/* no-op: UI shell */}}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#6366F1' }}
        >
          Save Changes
        </button>
      </div>

    </div>
  );
}
