'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { sendInterviewInvite, inviteToRound2 } from '@/app/actions/sendInvite';
import { Trophy, AlertCircle, Clock, Eye, X, FileText, Brain, Briefcase, Send, ArrowRight, Filter, Zap, Search, Video, LogOut, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Candidate {
  id: number;
  full_name: string;
  email: string;
  rating: number | null;
  round_2_rating: number | null;
  jd_match_score: number | null;
  ai_summary: string | null;
  status: string;
  current_stage: string | null;
  interview_transcript: string | null;
  round_2_transcript: string | null;
  resume_text: string | null;
  job_id: string | null;
  job_title?: string;
  final_verdict: string | null;
  interview_token: string | null;
  created_at: string | null;
  video_url: string | null;
  round_2_video_url: string | null;
}

interface Job {
  id: string;
  title: string;
}

interface Stats {
  total: number;
  round1Done: number;
  round2Done: number;
  completed: number;
}

const PAGE_SIZE = 25;

export default function DashboardPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobMap, setJobMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, round1Done: 0, round2Done: 0, completed: 0 });

  // Filters
  const [searchInput, setSearchInput] = useState(''); // Immediate input value
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value for API
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Action states
  const [sendingInvite, setSendingInvite] = useState<number | null>(null);
  const router = useRouter();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Fetch stats (runs once on mount)
  const fetchStats = useCallback(async () => {
    try {
      // Get total count
      const { count: total } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true });

      // Get round 1 done count
      const { count: round1Done } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .not('rating', 'is', null)
        .or('current_stage.is.null,current_stage.eq.round_1');

      // Get round 2 count
      const { count: round2Done } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .or('current_stage.eq.round_2,current_stage.eq.completed');

      // Get completed count
      const { count: completed } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('current_stage', 'completed');

      setStats({
        total: total || 0,
        round1Done: round1Done || 0,
        round2Done: round2Done || 0,
        completed: completed || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Fetch jobs (runs once on mount)
  const fetchJobs = useCallback(async () => {
    try {
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select('id, title');

      if (error) {
        console.error('Error fetching jobs:', error);
        return;
      }

      setJobs(jobsData || []);

      const map = new Map<string, string>();
      jobsData?.forEach(job => {
        map.set(job.id, job.title);
      });
      setJobMap(map);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  // Fetch candidates with pagination and filters
  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Build the query
      let query = supabase
        .from('candidates')
        .select('id, full_name, email, rating, round_2_rating, jd_match_score, ai_summary, status, current_stage, interview_transcript, round_2_transcript, resume_text, job_id, final_verdict, interview_token, created_at, video_url, round_2_video_url', { count: 'exact' });

      // Apply filters
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      if (roleFilter !== 'all') {
        query = query.eq('job_id', roleFilter);
      }

      if (stageFilter !== 'all') {
        switch (stageFilter) {
          case 'not_interviewed':
            query = query.is('rating', null);
            break;
          case 'round_1':
            query = query.not('rating', 'is', null).or('current_stage.is.null,current_stage.eq.round_1');
            break;
          case 'round_2':
            query = query.eq('current_stage', 'round_2');
            break;
          case 'completed':
            query = query.eq('current_stage', 'completed');
            break;
        }
      }

      // Apply ordering and pagination
      const { data, error, count } = await query
        .order('rating', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching candidates:', error);
        return;
      }

      // Merge job titles
      const candidatesWithJobs = (data || []).map(candidate => ({
        ...candidate,
        job_title: candidate.job_id ? jobMap.get(candidate.job_id) || 'Unknown Role' : undefined,
      }));

      setCandidates(candidatesWithJobs);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, roleFilter, stageFilter, jobMap]);

  // Initial data fetch
  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, [fetchStats, fetchJobs]);

  // Fetch candidates when filters/pagination change
  useEffect(() => {
    if (jobMap.size > 0 || jobs.length === 0) {
      fetchCandidates();
    }
  }, [fetchCandidates, jobMap, jobs.length]);

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, stageFilter]);

  // Get stage display
  const getStageDisplay = (candidate: Candidate) => {
    const stage = candidate.current_stage || 'round_1';
    if (stage === 'completed') {
      return { label: 'Completed', bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
    }
    if (stage === 'round_2') {
      return { label: 'Round 2', bg: 'bg-blue-500/20', text: 'text-blue-400' };
    }
    if (candidate.rating !== null) {
      return { label: 'R1 Done', bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
    }
    return { label: 'Pending', bg: 'bg-slate-700', text: 'text-slate-400' };
  };

  // Score bar component
  const ScoreBar = ({ score, label, color }: { score: number | null, label: string, color: string }) => {
    if (score === null) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-12">{label}</span>
          <div className="w-16 h-2 bg-slate-700 rounded-full" />
          <span className="text-xs text-slate-500">—</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-12">{label}</span>
        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {score}
        </span>
      </div>
    );
  };

  // Handle send invite
  const handleSendInvite = async (candidateId: number) => {
    setSendingInvite(candidateId);
    const result = await sendInterviewInvite(candidateId);
    if (result.success) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, status: 'INVITE_SENT' } : c
      ));
    } else {
      alert(result.error || 'Failed to send invite');
    }
    setSendingInvite(null);
  };

  // Handle invite to round 2
  const handleInviteRound2 = async (candidateId: number) => {
    setSendingInvite(candidateId);
    const result = await inviteToRound2(candidateId);
    if (result.success) {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, current_stage: 'round_2', status: 'ROUND_2_INVITED' } : c
      ));
    } else {
      alert(result.error || 'Failed to invite to round 2');
    }
    setSendingInvite(null);
  };

  // Pagination controls
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Trophy className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Talent Pipeline</h1>
              <p className="text-slate-400">2-Round AI Interview Leaderboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/screener"
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
            >
              <Zap className="w-4 h-4" />
              Bulk Screener
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Candidates</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Round 1 Complete</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.round1Done}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">In Round 2</p>
            <p className="text-2xl font-bold text-blue-400">{stats.round2Done}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Fully Completed</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-72"
            />
          </div>

          <div className="w-px h-6 bg-slate-700" />

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm">Filters:</span>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Roles</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Stages</option>
            <option value="not_interviewed">Not Interviewed</option>
            <option value="round_1">Round 1 Done</option>
            <option value="round_2">In Round 2</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 font-medium p-4">#</th>
                    <th className="text-left text-slate-400 font-medium p-4">Name</th>
                    <th className="text-left text-slate-400 font-medium p-4">Role</th>
                    <th className="text-left text-slate-400 font-medium p-4">Date</th>
                    <th className="text-left text-slate-400 font-medium p-4">CV</th>
                    <th className="text-left text-slate-400 font-medium p-4">Stage</th>
                    <th className="text-left text-slate-400 font-medium p-4">Scores</th>
                    <th className="text-left text-slate-400 font-medium p-4">Verdict</th>
                    <th className="text-left text-slate-400 font-medium p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate, index) => {
                    const stageDisplay = getStageDisplay(candidate);
                    const canSendInvite = !candidate.rating && candidate.status !== 'INVITE_SENT';
                    const canInviteR2 = candidate.rating !== null && candidate.rating >= 70 && candidate.current_stage !== 'round_2' && candidate.current_stage !== 'completed';
                    const rowNumber = startIndex + index;

                    return (
                      <tr
                        key={candidate.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        {/* Rank */}
                        <td className="p-4">
                          <span className="text-slate-500 font-medium">
                            {rowNumber}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="p-4">
                          <div>
                            <p className="text-white font-medium">{candidate.full_name}</p>
                            <p className="text-slate-500 text-sm">{candidate.email}</p>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="p-4">
                          <span className="text-slate-300 text-sm">
                            {candidate.job_title || '—'}
                          </span>
                        </td>

                        {/* Date Added */}
                        <td className="p-4">
                          <span className="text-slate-400 text-sm">
                            {candidate.created_at
                              ? new Date(candidate.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                              : '—'}
                          </span>
                        </td>

                        {/* CV Score */}
                        <td className="p-4">
                          {candidate.jd_match_score !== null ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              candidate.jd_match_score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                              candidate.jd_match_score >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {candidate.jd_match_score}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </td>

                        {/* Stage */}
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${stageDisplay.bg} ${stageDisplay.text}`}>
                            {stageDisplay.label}
                          </span>
                        </td>

                        {/* Scores */}
                        <td className="p-4">
                          <div className="space-y-1">
                            <ScoreBar
                              score={candidate.rating}
                              label="Hunger"
                              color={candidate.rating && candidate.rating >= 70 ? 'bg-emerald-500' : candidate.rating && candidate.rating >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                            />
                            <ScoreBar
                              score={candidate.round_2_rating}
                              label="Skills"
                              color={candidate.round_2_rating && candidate.round_2_rating >= 70 ? 'bg-blue-500' : candidate.round_2_rating && candidate.round_2_rating >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                            />
                          </div>
                        </td>

                        {/* Verdict */}
                        <td className="p-4">
                          {candidate.final_verdict ? (
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              candidate.final_verdict.includes('Strong') ? 'bg-emerald-500/20 text-emerald-400' :
                              candidate.final_verdict === 'Hire' ? 'bg-blue-500/20 text-blue-400' :
                              candidate.final_verdict.includes('Weak') ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {candidate.final_verdict}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedCandidate(candidate)}
                              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {(candidate.video_url || candidate.round_2_video_url) && (
                              <button
                                onClick={() => setSelectedCandidate(candidate)}
                                className="p-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition-colors"
                                title="Has Video Recording"
                              >
                                <Video className="w-4 h-4" />
                              </button>
                            )}

                            {canSendInvite && (
                              <button
                                onClick={() => handleSendInvite(candidate.id)}
                                disabled={sendingInvite === candidate.id}
                                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                title="Send Interview Invite"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}

                            {canInviteR2 && (
                              <button
                                onClick={() => handleInviteRound2(candidate.id)}
                                disabled={sendingInvite === candidate.id}
                                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                title="Invite to Round 2"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {candidates.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No candidates found matching your filters.
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-700">
              <p className="text-slate-400 text-sm">
                Showing {startIndex} - {endIndex} of {totalCount} candidates
              </p>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>

                {getPageNumbers().map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => typeof page === 'number' && goToPage(page)}
                    disabled={page === '...'}
                    className={`min-w-[36px] h-9 px-2 rounded-lg transition-colors ${
                      page === currentPage
                        ? 'bg-emerald-600 text-white'
                        : page === '...'
                        ? 'text-slate-500 cursor-default'
                        : 'hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Last page"
                >
                  <ChevronsRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <span className="text-emerald-400 font-bold text-lg">
                    {selectedCandidate.full_name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedCandidate.full_name}</h2>
                  <p className="text-slate-400">{selectedCandidate.job_title || 'No role specified'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Scores */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900 rounded-xl p-4">
                  <p className="text-slate-400 text-sm mb-1">Round 1: Hunger</p>
                  <p className={`text-3xl font-bold ${
                    selectedCandidate.rating && selectedCandidate.rating >= 70 ? 'text-emerald-400' :
                    selectedCandidate.rating ? 'text-yellow-400' : 'text-slate-500'
                  }`}>
                    {selectedCandidate.rating !== null ? `${selectedCandidate.rating}/100` : 'Pending'}
                  </p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <p className="text-slate-400 text-sm mb-1">Round 2: Skills</p>
                  <p className={`text-3xl font-bold ${
                    selectedCandidate.round_2_rating && selectedCandidate.round_2_rating >= 70 ? 'text-blue-400' :
                    selectedCandidate.round_2_rating ? 'text-yellow-400' : 'text-slate-500'
                  }`}>
                    {selectedCandidate.round_2_rating !== null ? `${selectedCandidate.round_2_rating}/100` : 'Pending'}
                  </p>
                </div>
              </div>

              {/* Final Verdict */}
              {selectedCandidate.final_verdict && (
                <div className="mb-6 p-4 bg-slate-900 rounded-xl">
                  <p className="text-slate-400 text-sm mb-1">Final Verdict</p>
                  <p className={`text-2xl font-bold ${
                    selectedCandidate.final_verdict.includes('Strong') ? 'text-emerald-400' :
                    selectedCandidate.final_verdict === 'Hire' ? 'text-blue-400' :
                    'text-yellow-400'
                  }`}>
                    {selectedCandidate.final_verdict}
                  </p>
                </div>
              )}

              {/* AI Summary */}
              {selectedCandidate.ai_summary && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">AI Summary</h3>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4">
                    <p className="text-slate-300">{selectedCandidate.ai_summary}</p>
                  </div>
                </div>
              )}

              {/* Video Recordings */}
              {(selectedCandidate.video_url || selectedCandidate.round_2_video_url) && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Video className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Interview Recordings</h3>
                  </div>
                  <div className="space-y-4">
                    {selectedCandidate.video_url && (
                      <div className="bg-slate-900 rounded-xl p-4">
                        <p className="text-slate-400 text-sm mb-2">Round 1 Recording</p>
                        <video
                          src={selectedCandidate.video_url}
                          controls
                          className="w-full rounded-lg max-h-80"
                          preload="metadata"
                        >
                          Your browser does not support video playback.
                        </video>
                      </div>
                    )}
                    {selectedCandidate.round_2_video_url && (
                      <div className="bg-slate-900 rounded-xl p-4">
                        <p className="text-slate-400 text-sm mb-2">Round 2 Recording</p>
                        <video
                          src={selectedCandidate.round_2_video_url}
                          controls
                          className="w-full rounded-lg max-h-80"
                          preload="metadata"
                        >
                          Your browser does not support video playback.
                        </video>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Round 1 Transcript */}
              {selectedCandidate.interview_transcript && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white">Round 1 Transcript</h3>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                    <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
                      {selectedCandidate.interview_transcript}
                    </pre>
                  </div>
                </div>
              )}

              {/* Round 2 Transcript */}
              {selectedCandidate.round_2_transcript && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Round 2 Transcript</h3>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                    <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
                      {selectedCandidate.round_2_transcript}
                    </pre>
                  </div>
                </div>
              )}

              {/* Resume */}
              {selectedCandidate.resume_text && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-semibold text-white">Resume</h3>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">
                      {selectedCandidate.resume_text}
                    </p>
                  </div>
                </div>
              )}

              {/* No data state */}
              {!selectedCandidate.ai_summary && !selectedCandidate.interview_transcript && (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">Interview not completed yet</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
