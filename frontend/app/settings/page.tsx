'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Mail, Video, BarChart2, Briefcase } from 'lucide-react';
import CompanyTab from '@/components/settings/CompanyTab';
import EmailCommsTab from '@/components/settings/EmailCommsTab';
import { InterviewsTab } from '@/components/settings/InterviewsTab';
import { ScoringTab } from '@/components/settings/ScoringTab';
import { JobBoardsTab } from '@/components/settings/JobBoardsTab';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login?redirect=/settings');
      }
    });
  }, [router]);

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 min-h-0">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your workspace configuration</p>
      </div>

      {/* Five-tab layout */}
      <Tabs defaultValue="company" className="flex flex-col flex-1 min-h-0">
        <TabsList
          className="flex gap-1 border-b border-border bg-transparent rounded-none w-full justify-start h-auto p-0 mb-6"
        >
          <TabsTrigger
            value="company"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            Company
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            <Mail className="w-4 h-4 shrink-0" />
            Email &amp; Comms
          </TabsTrigger>
          <TabsTrigger
            value="interviews"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            <Video className="w-4 h-4 shrink-0" />
            Interviews
          </TabsTrigger>
          <TabsTrigger
            value="scoring"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            Scoring
          </TabsTrigger>
          <TabsTrigger
            value="job-boards"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            Job Boards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="email">
          <EmailCommsTab />
        </TabsContent>
        <TabsContent value="interviews">
          <InterviewsTab />
        </TabsContent>
        <TabsContent value="scoring">
          <ScoringTab />
        </TabsContent>
        <TabsContent value="job-boards">
          <JobBoardsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
