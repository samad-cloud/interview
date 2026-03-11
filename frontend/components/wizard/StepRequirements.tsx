'use client';

import { WizardState } from '@/app/create-job/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkillChipInput } from '@/components/wizard/SkillChipInput';

interface StepRequirementsProps {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepRequirements({ state, onChange, onNext, onPrev }: StepRequirementsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm" style={{ color: '#94A3B8' }}>Step 2 of 6 — Requirements</p>
        <h1 className="text-2xl font-semibold mt-1" style={{ color: '#F9FAFB' }}>
          Skills &amp; Compensation
        </h1>
      </div>

      {/* Salary section */}
      <div className="space-y-2">
        <Label className="text-sm" style={{ color: '#94A3B8' }}>Salary Range</Label>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs" style={{ color: '#6B7280' }}>Min</Label>
            <Input
              value={state.salaryMin}
              onChange={(e) => onChange({ salaryMin: e.target.value })}
              placeholder="50,000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" style={{ color: '#6B7280' }}>Max</Label>
            <Input
              value={state.salaryMax}
              onChange={(e) => onChange({ salaryMax: e.target.value })}
              placeholder="80,000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" style={{ color: '#6B7280' }}>Currency</Label>
            <Select
              value={state.salaryCurrency}
              onValueChange={(v) => onChange({ salaryCurrency: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AED">AED</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" style={{ color: '#6B7280' }}>Period</Label>
            <Select
              value={state.salaryPeriod}
              onValueChange={(v) => onChange({ salaryPeriod: v as WizardState['salaryPeriod'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Education Required */}
      <div className="space-y-1">
        <Label className="text-sm" style={{ color: '#94A3B8' }}>Education Required</Label>
        <Select
          value={state.education || 'any'}
          onValueChange={(v) => onChange({ education: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="high_school">High School</SelectItem>
            <SelectItem value="diploma">Diploma</SelectItem>
            <SelectItem value="bachelors">Bachelor&apos;s</SelectItem>
            <SelectItem value="masters">Master&apos;s</SelectItem>
            <SelectItem value="phd">PhD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Experience */}
      <div className="space-y-2">
        <Label className="text-sm" style={{ color: '#94A3B8' }}>Experience (Years)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs" style={{ color: '#6B7280' }}>Min Years</Label>
            <Input
              type="number"
              min={0}
              value={state.experienceMin}
              onChange={(e) => onChange({ experienceMin: e.target.value })}
              placeholder="2"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" style={{ color: '#6B7280' }}>Max Years</Label>
            <Input
              type="number"
              min={0}
              value={state.experienceMax}
              onChange={(e) => onChange({ experienceMax: e.target.value })}
              placeholder="5"
            />
          </div>
        </div>
      </div>

      {/* Must-Have Skills */}
      <div className="space-y-1">
        <Label className="text-sm" style={{ color: '#94A3B8' }}>Must-Have Skills</Label>
        <SkillChipInput
          skills={state.skillsMustHave}
          onChange={(s) => onChange({ skillsMustHave: s })}
          placeholder="Add skill, press Enter"
          chipColor="#10B981"
        />
      </div>

      {/* Nice-to-Have Skills */}
      <div className="space-y-1">
        <Label className="text-sm" style={{ color: '#94A3B8' }}>Nice-to-Have Skills</Label>
        <SkillChipInput
          skills={state.skillsNiceToHave}
          onChange={(s) => onChange({ skillsNiceToHave: s })}
          placeholder="Add skill, press Enter"
          chipColor="#6366F1"
        />
      </div>

      {/* Visa Sponsorship */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Label className="text-sm" style={{ color: '#94A3B8' }}>
            Visa Sponsorship Available
          </Label>
          <Switch
            checked={state.visaSponsorship}
            onCheckedChange={(v) => onChange({ visaSponsorship: v })}
          />
        </div>
        <p className="text-xs" style={{ color: '#6B7280' }}>
          Toggle on if you sponsor work visas for this role
        </p>
      </div>

      {/* Navigation footer */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onPrev}>
          ← Previous
        </Button>
        <Button onClick={onNext}>
          Next: AI Generate →
        </Button>
      </div>
    </div>
  );
}
