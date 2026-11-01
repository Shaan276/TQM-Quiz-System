import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BookMarked, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Trash2, 
  RotateCcw, 
  Sparkles, 
  HelpCircle,
  Check,
  X,
  Filter
} from 'lucide-react';

export default function MistakeNotebookView({ setActiveRoute }) {
  const { accessToken } = useAuth();
  const [mistakes, setMistakes] = useState([]);
  const [stats, setStats] = useState({ totalMistakes: 0, unresolvedCount: 0, resolvedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState(''); // '' (all) | '0' (unresolved) | '1' (resolved)
  const [subjects, setSubjects] = useState([]);

  // Challenge modal state
  const [challengeModalItem, setChallengeModalItem] = useState(null);
  const [challengeReason, setChallengeReason] = useState('Teacher answer key is incorrect');
  const [challengeNote, setChallengeNote] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeSuccess, setChallengeSuccess] = useState('');
  const [challengeError, setChallengeError] = useState('');

  const fetchMistakesAndStats = async () => {
    setLoading(true);
    try {
      // 1. Fetch stats
      const statsRes = await fetch(`/api/v1/mistakes/stats`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data);
        if (statsData.data.subjectBreakdown) {
          setSubjects(statsData.data.subjectBreakdown.map(s => s.subject));
        }
      }

      // 2. Fetch mistakes
      let url = `/api/v1/mistakes?search=${encodeURIComponent(search)}`;
      if (selectedSubject) url += `&subject=${encodeURIComponent(selectedSubject)}`;
      if (resolvedFilter !== '') url += `&isResolved=${resolvedFilter}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setMistakes(data.data.mistakes || []);
      }
    } catch (err) {
      console.error('Failed to load mistake notebook:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchMistakesAndStats();
    }
  }, [accessToken, search, selectedSubject, resolvedFilter]);

  const handleToggleResolve = async (id, currentResolved) => {
    try {
      const res = await fetch(`/api/v1/mistakes/${id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isResolved: !currentResolved })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic update
        setMistakes(prev => prev.map(m => m.id === id ? { ...m, is_resolved: data.data.isResolved ? 1 : 0 } : m));
        // Refresh stats
        const statsRes = await fetch(`/api/v1/mistakes/stats`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMistake = async (id) => {
    if (!window.confirm('Remove this question from your Mistake Notebook?')) return;
    try {
      const res = await fetch(`/api/v1/mistakes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setMistakes(prev => prev.filter(m => m.id !== id));
        // Refresh stats
        const statsRes = await fetch(`/api/v1/mistakes/stats`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openChallengeModal = (m) => {
    setChallengeModalItem(m);
    setChallengeReason('Teacher answer key is incorrect');
    setChallengeNote('');
    setChallengeError('');
    setChallengeSuccess('');
  };

  const handleSubmitChallenge = async (e) => {
    e.preventDefault();
    if (!challengeModalItem) return;
    const finalNote = (challengeNote || '').trim() || (e.target?.querySelector?.('textarea')?.value || '').trim();
    if (!finalNote) {
      setChallengeError('Please provide a brief explanation for your challenge.');
      return;
    }
    setSubmittingChallenge(true);
    setChallengeError('');
    try {
      const res = await fetch('/api/v1/challenges', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId: challengeModalItem.quiz_id,
          questionId: challengeModalItem.question_id,
          attemptId: challengeModalItem.attempt_id || null,
          studentAnswer: challengeModalItem.user_answer || '',
          officialAnswer: challengeModalItem.correct_answer || '',
          challengeReason,
          studentNote: finalNote
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to submit challenge');
      }
      setChallengeSuccess('Challenge submitted! Your instructor has been notified to review and update marks.');
      setTimeout(() => {
        setChallengeModalItem(null);
        setChallengeSuccess('');
        setChallengeNote('');
      }, 2000);
    } catch (err) {
      setChallengeError(err.message);
    } finally {
      setSubmittingChallenge(false);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-[#1E2D4A]">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <BookMarked className="text-[#34D399]" size={28} />
            Mistake Notebook &bull; Smart Revision
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1.5">
            Questions you answered incorrectly during quizzes are automatically captured here for targeted study and challenges.
          </p>
        </div>

        <button
          onClick={() => setActiveRoute('learner-dashboard')}
          className="btn-secondary text-xs py-2.5 px-4 font-semibold shrink-0"
        >
          Explore More Quizzes
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        <div className="dashboard-card p-6 flex items-center justify-between border border-[#1E2D4A]">
          <div>
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Total Recorded</p>
            <p className="text-3xl font-black text-white font-mono mt-1">{stats.totalMistakes}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#121D32] flex items-center justify-center text-[#94A3B8]">
            <BookMarked size={22} />
          </div>
        </div>

        <div className="dashboard-card p-6 flex items-center justify-between border border-[#F43F5E]/30 bg-[#160E18]">
          <div>
            <p className="text-xs text-[#FB7185] font-bold uppercase tracking-wider">Pending Review</p>
            <p className="text-3xl font-black text-[#FB7185] font-mono mt-1">{stats.unresolvedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F43F5E]/20 flex items-center justify-center text-[#FB7185]">
            <AlertCircle size={22} />
          </div>
        </div>

        <div className="dashboard-card p-5 flex items-center justify-between border border-[#10B981]/30 bg-[#0A1626]">
          <div>
            <p className="text-xs text-[#34D399] font-bold uppercase tracking-wider">Mastered & Resolved</p>
            <p className="text-2xl font-black text-[#34D399] font-mono mt-1">{stats.resolvedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center text-[#34D399]">
            <CheckCircle2 size={20} />
          </div>
        </div>

      </div>

      {/* Filter Toolbar */}
      <div className="dashboard-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search mistakes by question text, quiz title or explanation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 text-xs w-full"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0A101A] rounded-xl border border-[#1B2A44] shrink-0">
            <button
              onClick={() => setResolvedFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                resolvedFilter === '' ? 'bg-[#121D32] text-white shadow' : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setResolvedFilter('0')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                resolvedFilter === '0' ? 'bg-[#F43F5E]/20 text-[#FB7185] shadow' : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              Needs Review
            </button>
            <button
              onClick={() => setResolvedFilter('1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                resolvedFilter === '1' ? 'bg-[#10B981]/20 text-[#34D399] shadow' : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              Resolved
            </button>
          </div>

          {/* Subject Filter */}
          {subjects.length > 0 && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-field text-xs py-2 px-3 shrink-0 max-w-xs"
            >
              <option value="">All Subjects</option>
              {subjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}

        </div>
      </div>

      {/* Mistake Items List */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center text-white text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
            Loading mistake notebook records...
          </div>
        </div>
      ) : mistakes.length === 0 ? (
        <div className="dashboard-card p-12 text-center space-y-4 max-w-md mx-auto">
          <Sparkles size={40} className="text-[#34D399] mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-white">Notebook Clean!</h3>
          <p className="text-xs text-[#94A3B8]">
            {resolvedFilter === '0' 
              ? 'You have zero pending mistakes in this view. Excellent work!' 
              : 'No mistakes recorded yet. Take self-paced quizzes to track areas for improvement.'}
          </p>
          <button
            onClick={() => setActiveRoute('learner-dashboard')}
            className="btn-emerald-primary text-xs py-2 px-4 font-semibold"
          >
            Start a Quiz
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {mistakes.map((m) => {
            const isResolved = m.is_resolved === 1;

            return (
              <div
                key={m.id}
                className={`dashboard-card p-6 border transition-all ${
                  isResolved
                    ? 'border-[#1B2A44] bg-[#0A101A]/80 opacity-75 hover:opacity-100'
                    : 'border-[#F43F5E]/30 bg-[#140E18]'
                }`}
              >
                {/* Item Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1B2A44]/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#121D32] border border-[#1F304E] text-[10px] font-bold text-[#38BDF8]">
                      {m.subject}
                    </span>
                    <span className="text-xs text-[#64748B] font-medium truncate max-w-xs">
                      Quiz: <strong className="text-[#CBD5E1]">{m.quiz_title}</strong>
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8] bg-[#0E1626] px-2 py-0.5 rounded">
                      {m.question_type?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {m.mistake_count > 1 && (
                      <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/30">
                        Missed {m.mistake_count}x
                      </span>
                    )}

                    <button
                      onClick={() => openChallengeModal(m)}
                      className="text-xs font-bold px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30 hover:bg-[#F59E0B]/25"
                      title="Challenge question or answer key"
                    >
                      <HelpCircle size={12} />
                      Challenge
                    </button>

                    <button
                      onClick={() => handleToggleResolve(m.id, isResolved)}
                      className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                        isResolved
                          ? 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/40 hover:bg-[#10B981]/30'
                          : 'bg-[#121D32] text-[#94A3B8] border-[#1F304E] hover:text-white hover:bg-[#1A2942]'
                      }`}
                    >
                      <Check size={12} />
                      {isResolved ? 'Resolved' : 'Mark Resolved'}
                    </button>

                    <button
                      onClick={() => handleDeleteMistake(m.id)}
                      className="p-1.5 rounded-lg bg-[#121D32] hover:bg-[#F43F5E]/20 text-[#64748B] hover:text-[#F43F5E] transition-colors"
                      title="Remove from notebook"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-sm font-semibold text-white mt-3">
                  {m.question_text}
                </p>

                {/* Submissions Comparison Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#180E18] border border-[#F43F5E]/30 space-y-1">
                    <span className="text-[#FB7185] font-bold block flex items-center gap-1">
                      <X size={12} /> Your Incorrect Answer:
                    </span>
                    <p className="font-mono text-white text-xs">{m.user_answer || '(Unanswered)'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0A1E1E] border border-[#10B981]/30 space-y-1">
                    <span className="text-[#34D399] font-bold block flex items-center gap-1">
                      <Check size={12} /> Correct Solution:
                    </span>
                    <p className="font-mono text-white text-xs font-semibold">{m.correct_answer}</p>
                  </div>
                </div>

                {/* Explanation */}
                {m.explanation && (
                  <div className="mt-3 p-3 rounded-xl bg-[#0E1E34] border border-[#1E3A5F] text-xs text-[#CBD5E1] space-y-1">
                    <span className="font-bold text-[#38BDF8] flex items-center gap-1">
                      <HelpCircle size={13} /> Explanation & Learning Tip:
                    </span>
                    <p className="leading-relaxed">{m.explanation}</p>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Challenge Question Modal */}
      {challengeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0D1524] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
              <div className="flex items-center gap-2 text-[#FBBF24] font-bold text-sm">
                <HelpCircle size={18} />
                <span>Challenge Question / Answer Key</span>
              </div>
              <button onClick={() => setChallengeModalItem(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
              <p className="font-semibold text-white line-clamp-3">{challengeModalItem.question_text}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>Your Answer: <strong className="text-rose-400 font-mono">{challengeModalItem.user_answer || '(Unanswered)'}</strong></span>
                <span>Official: <strong className="text-emerald-400 font-mono">{challengeModalItem.correct_answer}</strong></span>
              </div>
            </div>

            {challengeSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{challengeSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitChallenge} className="space-y-4">
                {challengeError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-400 text-xs">
                    {challengeError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Challenge</label>
                  <select
                    value={challengeReason}
                    onChange={(e) => setChallengeReason(e.target.value)}
                    className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    <option value="Teacher answer key is incorrect">Teacher answer key is incorrect</option>
                    <option value="My answer/sentence was correct">My answer / sentence was correct</option>
                    <option value="Typo or formatting mismatch in evaluation">Typo or formatting mismatch in evaluation</option>
                    <option value="Ambiguous or confusing question phrasing">Ambiguous or confusing question phrasing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Detailed Explanation</label>
                  <textarea
                    rows={3}
                    value={challengeNote}
                    onChange={(e) => setChallengeNote(e.target.value)}
                    placeholder="Explain why your answer is valid or why the official answer key needs correction..."
                    className="w-full bg-[#111A2E] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">If accepted by instructor, marks will be updated for all affected students.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setChallengeModalItem(null)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingChallenge}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submittingChallenge ? 'Submitting...' : 'Submit Challenge'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}