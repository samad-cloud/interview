'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Zap,
  FileText,
  SlidersHorizontal,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Pipeline',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
  },
  {
    label: 'Jobs',
    href: '/jobs',
    icon: <Briefcase className="w-4 h-4 shrink-0" />,
  },
  {
    label: 'Bulk Screener',
    href: '/screener',
    icon: <Zap className="w-4 h-4 shrink-0" />,
  },
  {
    label: 'Create Job',
    href: '/create-job',
    icon: <FileText className="w-4 h-4 shrink-0" />,
  },
  {
    label: 'AI Prompts',
    href: '/prompts',
    icon: <SlidersHorizontal className="w-4 h-4 shrink-0" />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-4 h-4 shrink-0" />,
  },
];

interface AppSidebarProps {
  onLogout: () => void;
  userEmail?: string;
}

export default function AppSidebar({ onLogout, userEmail }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative flex flex-col shrink-0 border-r border-border bg-card transition-all duration-200 ease-in-out',
          collapsed ? 'w-[60px]' : 'w-[220px]',
        )}
        style={{ minHeight: '100vh' }}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-4 h-14 border-b border-border', collapsed && 'justify-center px-0')}>
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight text-foreground truncate">
              SynchroHire
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const linkEl = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-400'
                    : 'text-muted-foreground',
                  collapsed && 'justify-center px-0 py-2.5',
                )}
              >
                <span className={cn(isActive && 'text-indigo-400')}>{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return linkEl;
          })}
        </nav>

        {/* Bottom: user + logout */}
        <div className={cn('px-2 py-3 border-t border-border flex flex-col gap-1')}>
          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer w-full"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <>
              {userEmail && (
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              )}
              <button
                onClick={onLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer w-full"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-[52px] w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors cursor-pointer z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}
