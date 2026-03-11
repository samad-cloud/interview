'use client';

import { WizardState } from '@/app/create-job/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StepBasicsProps {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onNext: () => void;
}

export function StepBasics({ state, onChange, onNext }: StepBasicsProps) {
  const canAdvance = state.title.trim() !== '' && state.location.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm" style={{ color: '#94A3B8' }}>Step 1 of 6 — Basics</p>
        <h1 className="text-2xl font-semibold mt-1" style={{ color: '#F9FAFB' }}>
          Role Essentials
        </h1>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Job Title — full width */}
        <div className="col-span-2 space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>
            Job Title <span style={{ color: '#EF4444' }}>*</span>
          </Label>
          <Input
            value={state.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Senior Frontend Engineer"
          />
        </div>

        {/* Department */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>Department</Label>
          <Input
            value={state.department}
            onChange={(e) => onChange({ department: e.target.value })}
            placeholder="e.g. Engineering"
          />
        </div>

        {/* Location */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>
            Location <span style={{ color: '#EF4444' }}>*</span>
          </Label>
          <Input
            value={state.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="e.g. Dubai, UAE"
          />
        </div>

        {/* Work Arrangement */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>Work Arrangement</Label>
          <Select
            value={state.workArrangement}
            onValueChange={(v) => onChange({ workArrangement: v as WizardState['workArrangement'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onsite">Onsite</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employment Type */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>Employment Type</Label>
          <Select
            value={state.employmentType}
            onValueChange={(v) => onChange({ employmentType: v as WizardState['employmentType'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Urgency */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>Urgency</Label>
          <Select
            value={state.urgency}
            onValueChange={(v) => onChange({ urgency: v as WizardState['urgency'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asap">ASAP</SelectItem>
              <SelectItem value="30_days">Within 30 days</SelectItem>
              <SelectItem value="60_days">Within 60 days</SelectItem>
              <SelectItem value="90_days">Within 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Headcount */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>Headcount</Label>
          <Input
            type="number"
            min={1}
            value={state.headcount}
            onChange={(e) => onChange({ headcount: Number(e.target.value) })}
          />
        </div>

        {/* Target Start Date */}
        <div className="space-y-1">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>Target Start Date</Label>
          <input
            type="date"
            value={state.targetStartDate}
            onChange={(e) => onChange({ targetStartDate: e.target.value })}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] text-[#F9FAFB] px-3 py-2 text-sm"
          />
        </div>

      </div>

      {/* Navigation footer */}
      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!canAdvance}>
          Next: Requirements →
        </Button>
      </div>
    </div>
  );
}
