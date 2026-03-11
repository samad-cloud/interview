'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface StageTabStripProps {
  value: string;
  onValueChange: (value: string) => void;
}

const STAGE_TABS = [
  { value: 'all',        label: 'All Candidates' },
  { value: 'r1_pending', label: 'R1 Pending' },
  { value: 'r1_done',    label: 'R1 Done' },
  { value: 'r2_pending', label: 'R2 Pending' },
  { value: 'successful', label: 'Final' },
] as const;

export function StageTabStrip({ value, onValueChange }: StageTabStripProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList className="h-auto bg-transparent p-0 gap-1.5 flex-wrap">
        {STAGE_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
              // Inactive state
              "data-[state=inactive]:border-[#1E293B] data-[state=inactive]:text-[#6B7280] data-[state=inactive]:bg-transparent",
              "data-[state=inactive]:hover:border-[#2D3F55] data-[state=inactive]:hover:text-[#D1D5DB]",
              // Active state
              "data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:border-[#6366F1] data-[state=active]:text-[#818CF8]",
              // Reset shadcn defaults that conflict
              "data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
