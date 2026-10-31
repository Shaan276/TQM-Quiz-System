import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Award, 
  ArrowRight, 
  Search,
  Filter,
  Play
} from 'lucide-react';

export default function AttemptHistoryView({ onViewResult, onResumeAttempt, setActiveRoute }) {
  const { accessToken } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/attempts/history/my?page=${page}&limit=10`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setAttempts(data.data.attempts || []);
        setPagination(data.data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load attempt history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchHistory();
    }
  }, [accessToken, statusFilter, page]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <History className="text-[#34D399]" size={26} />
            My Assessment History
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Complete record of your self-paced quiz attempts, scores, and performance milestones.
          </p>
        </div>

        <button
          onClick={() => setActiveRoute('learner-dashboard')}
          className="btn-secondary text-xs py-2 px-3 font-semibold"
        >
          Explore More Quizzes
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['', 'COMPLETED', 'IN_PROGRESS'].map(st => (
          <button
            key={st}
            onClick={() => { setStatusFilter(st); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === st
                ? 'bg-[#121D32] text-[#34D399] border border-[#34D399]/30'
                : 'text-[#64748B] hover:text-white hover:bg-[#0E1626]'
            }`}
          >
            {st === '' ? 'All Attempts' : st === 'COMPLETED' ? 'Completed' : 'In Progress'}
          </button>
        ))}
      </div>

      {/* History List */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center text-white text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
            Loading historical attempts...
          </div>
        </div>
      ) : attempts.length === 0 ? (
        <div className="dashboard-card p-12 text-center space-y-4 max-w-md mx-auto">
          <History size={40} className="text-[#64748B] mx-auto" />
          <h3 className="text-base font-bold text-white">No attempts recorded</h3>
          <p className="text-xs text-[#94A3B8]">
            You have not attempted any quizzes yet under this filter.
          </p>
          <button
            onClick={() => setActiveRoute('learner-dashboard')}
            className="btn-emerald-primary text-xs py-2 px-4 font-semibold"
          >
            Discover Quizzes
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map(a => {
            const isCompleted = a.status === 'COMPLETED';
            const isPassed = a.is_passed === 1;
            const dateStr = a.submitted_at || a.started_at;
            const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Unknown';

            const mins = Math.floor((a.time_taken_sec || 0) / 60);
            const secs = (a.time_taken_sec || 0) % 60;

            return (
              <div
                key={a.id}
                className="dashboard-card p-5 border border-[#1B2A44] hover:border-[#2C3F63] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
              >
                {/* Left Info */}
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#38BDF8] bg-[#0E2A47] px-2 py-0.5 rounded border border-[#1E3A5F]">
                      {a.quiz_category || 'General'}
                    </span>
                    <span className="text-xs text-[#64748B] font-mono">
                      {formattedDate}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white truncate">
                    {a.quiz_title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                    <span>Questions: <strong className="text-white">{a.total_questions}</strong></span>
                    {isCompleted && (
                      <>
                        <span>Correct: <strong className="text-[#34D399]">{a.correct_answers}</strong></span>
                        <span>Time: <strong className="text-white">{mins}m {secs}s</strong></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Status & Actions */}
                <div className="flex items-center gap-4 shrink-0">
                  
                  {isCompleted ? (
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.is_flagged ? (
                          <span className="text-[10px] font-extrabold text-[#FB7185] bg-[#F43F5E]/20 px-2 py-0.5 rounded-full border border-[#F43F5E]/40 animate-pulse" title={a.flag_reason || 'Flagged for multiple window exits or tab changes'}>
                            🚩 Flagged
                          </span>
                        ) : a.warning_count > 0 ? (
                          <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/20 px-2 py-0.5 rounded-full border border-[#F59E0B]/40" title="1 tab switch warning logged">
                            ⚠️ 1 Warning
                          </span>
                        ) : null}

                        <span className="text-xl font-black font-mono text-white">
                          {a.score_percentage}%
                        </span>
                        {isPassed ? (
                          <span className="text-xs font-bold text-[#34D399] bg-[#10B981]/15 px-2.5 py-0.5 rounded-full border border-[#10B981]/30">
                            Passed
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#FB7185] bg-[#F43F5E]/15 px-2.5 py-0.5 rounded-full border border-[#F43F5E]/30">
                            Failed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] font-mono mt-0.5">
                        {a.score} / {a.max_score} Marks
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-2.5 py-1 rounded-full border border-[#F59E0B]/30">
                        In Progress
                      </span>
                    </div>
                  )}

                  {isCompleted ? (
                    <button
                      onClick={() => onViewResult(a.id)}
                      className="btn-secondary text-xs py-2 px-3 gap-1.5 font-semibold text-[#34D399] border-[#34D399]/30"
                    >
                      View Report
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => onResumeAttempt(a.id)}
                      className="btn-emerald-primary text-xs py-2 px-3 gap-1.5 font-bold"
                    >
                      <Play size={13} />
                      Resume
                    </button>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-[#94A3B8] font-mono px-3">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            disabled={page === pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}