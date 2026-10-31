import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  Plus, 
  Search, 
  Filter, 
  Layers, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Trash2, 
  Eye, 
  Edit3, 
  FolderPlus, 
  ArrowUpDown,
  BookOpen,
  Database,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Award,
  Radio,
  FolderKanban,
  Users,
  Play,
  Calendar,
  X,
  Rocket
} from 'lucide-react';

export default function CreatorDashboardView({ setActiveRoute, onOpenStudio, onOpenPreview, onHostLive }) {
  const { user, accessToken, setSession } = useAuth();
  const [metrics, setMetrics] = useState({
    totalQuizzes: 0,
    publishedQuizzes: 0,
    draftQuizzes: 0,
    totalQuestions: 0,
    bankQuestionsCount: 0,
    recentQuizzes: []
  });
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filtering & Pagination
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [sort, setSort] = useState('updated_desc');

  // Deletion modal state
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Student attempts modal state
  const [viewingAttemptsQuiz, setViewingAttemptsQuiz] = useState(null);
  const [quizAttemptsList, setQuizAttemptsList] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [teacherAnalytics, setTeacherAnalytics] = useState(null);

  // Live sessions history state (Phase P4)
  const [dashboardTab, setDashboardTab] = useState('quizzes'); // 'quizzes' | 'live-history'
  const [liveSessionsHistory, setLiveSessionsHistory] = useState([]);
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Start Test / Launch Mode Modal state
  const [launchModalQuiz, setLaunchModalQuiz] = useState(null);

  const isCreatorOrAdmin = ['CREATOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes((user?.role || '').toUpperCase());

  // Role upgrade handler for testing/learners
  const handleUpgradeToCreator = async () => {
    try {
      const res = await fetch('/api/v1/users/upgrade-to-teacher', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.accessToken, data.data.refreshToken, data.data.profile);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAttempts = async (quiz) => {
    setViewingAttemptsQuiz(quiz);
    setLoadingAttempts(true);
    try {
      const res = await fetch(`/api/v1/attempts/quiz/${quiz.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuizAttemptsList(data.data.attempts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const fetchMetricsAndQuizzes = async () => {
    if (!accessToken || !isCreatorOrAdmin) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Fetch metrics
      const mRes = await fetch('/api/v1/quizzes/metrics/summary', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const mData = await mRes.json();
      if (mData.success) {
        setMetrics(mData.data);
      }

      // 2. Fetch teacher analytics
      const tRes = await fetch('/api/v1/analytics/teacher', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const tData = await tRes.json();
      if (tData.success) {
        setTeacherAnalytics(tData.data);
      }

      // 3. Fetch quizzes with query params
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (category) params.append('category', category);
      if (status) params.append('status', status);
      if (difficulty) params.append('difficulty', difficulty);
      if (sort) params.append('sort', sort);

      const qRes = await fetch(`/api/v1/quizzes?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const qData = await qRes.json();
      if (qData.success) {
        setQuizzes(qData.data.quizzes || []);
      }

      // 4. Fetch Hosted Live Sessions History
      try {
        const sRes = await fetch('/api/v1/live-sessions/my', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const sData = await sRes.json();
        if (sData.success && sData.data?.sessions) {
          setLiveSessionsHistory(sData.data.sessions);
        }
      } catch (e) {
        console.error('Failed to load live sessions history', e);
      }
    } catch (err) {
      setErrorMsg('Failed to load quizzes. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndQuizzes();
  }, [accessToken, isCreatorOrAdmin, search, category, status, difficulty, sort]);

  // Create new quiz action
  const handleCreateNewQuiz = async () => {
    try {
      const res = await fetch('/api/v1/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: 'TQM Quiz',
          category: 'TQM (Total Quality Management)',
          difficulty: 'MEDIUM'
        })
      });
      const data = await res.json();
      if (data.success) {
        onOpenStudio(data.data.quiz.id);
      }
    } catch (err) {
      alert('Failed to initialize new quiz');
    }
  };

  // Duplicate quiz action
  const handleDuplicate = async (quizId) => {
    try {
      const res = await fetch(`/api/v1/quizzes/${quizId}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchMetricsAndQuizzes();
      }
    } catch (err) {
      alert('Failed to duplicate quiz');
    }
  };

  // Host live multiplayer session
  const handleHostLiveSession = async (quizId) => {
    try {
      const res = await fetch('/api/v1/live-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ quizId })
      });
      const data = await res.json();
      if (data.success && data.data?.sessionId) {
        if (onHostLive) {
          onHostLive(data.data.sessionId);
        }
      } else {
        alert(data.error?.message || 'Failed to start live session');
      }
    } catch (err) {
      alert('Network error starting live session');
    }
  };

  // Delete live session from history
  const handleDeleteLiveSession = async (sessId) => {
    if (!window.confirm('Are you sure you want to delete this live session record from history?')) return;
    try {
      const res = await fetch(`/api/v1/live-sessions/${sessId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setLiveSessionsHistory(prev => prev.filter(s => s.id !== sessId));
      } else {
        alert(data.error?.message || 'Failed to delete live session');
      }
    } catch (err) {
      alert('Network error deleting live session');
    }
  };

  // Toggle publish/unpublish action
  const handleTogglePublish = async (quiz) => {
    const isPub = quiz.status === 'PUBLISHED';
    const endpoint = isPub ? `/api/v1/quizzes/${quiz.id}/unpublish` : `/api/v1/quizzes/${quiz.id}/publish`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchMetricsAndQuizzes();
      } else {
        alert(data.error?.message || 'Action failed');
      }
    } catch (err) {
      alert('Network error while toggling publish status');
    }
  };

  // Confirm delete action
  const handleDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/quizzes/${quizToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuizToDelete(null);
        fetchMetricsAndQuizzes();
      }
    } catch {
      alert('Failed to delete quiz');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isCreatorOrAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] mx-auto">
          <ShieldCheck size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Creator Studio Requires Creator Privileges</h2>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
            Your current account role is <span className="text-white font-bold">LEARNER</span>. You can upgrade to a <span className="text-[#34D399] font-bold">CREATOR</span> account with a single click to begin authoring quizzes and managing question banks.
          </p>
        </div>
        <button
          onClick={handleUpgradeToCreator}
          className="btn-emerald-primary text-xs py-2.5 px-6 font-bold shadow-lg shadow-[#10B981]/20 gap-2 inline-flex"
        >
          <Sparkles size={16} />
          Upgrade to Creator Role (Instant)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Header & CTAs */}
      <div className="pb-4 border-b border-[#1B2A44] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Zap className="text-[#10B981] fill-current" size={24} />
            Quiz Studio & Assessment Center
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Author interactive assessments, configure scoring policies, and publish quizzes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveRoute('question-bank')}
            className="btn-secondary text-xs py-2.5 px-4 font-semibold gap-2"
          >
            <Database size={15} />
            Question Bank ({metrics.bankQuestionsCount})
          </button>
          
          <button
            onClick={handleCreateNewQuiz}
            className="btn-emerald-primary text-xs py-2.5 px-4 font-bold shadow-lg shadow-[#10B981]/20 gap-2"
          >
            <Plus size={16} />
            Create New Quiz
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B] flex items-center justify-between">
            Total Quizzes
            <Layers size={14} className="text-[#06B6D4]" />
          </p>
          <p className="text-2xl font-black text-white">{metrics.totalQuizzes}</p>
          <span className="text-[10px] text-[#94A3B8]">Authored by you</span>
        </div>

        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B] flex items-center justify-between">
            Published Quizzes
            <CheckCircle2 size={14} className="text-[#10B981]" />
          </p>
          <p className="text-2xl font-black text-[#34D399]">{metrics.publishedQuizzes}</p>
          <span className="text-[10px] text-[#94A3B8]">Live for students</span>
        </div>

        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B] flex items-center justify-between">
            Draft Quizzes
            <Clock size={14} className="text-[#F59E0B]" />
          </p>
          <p className="text-2xl font-black text-[#F59E0B]">{metrics.draftQuizzes}</p>
          <span className="text-[10px] text-[#94A3B8]">Work in progress</span>
        </div>

        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B] flex items-center justify-between">
            Total Questions
            <HelpCircle size={14} className="text-[#8B5CF6]" />
          </p>
          <p className="text-2xl font-black text-[#A78BFA]">{metrics.totalQuestions}</p>
          <span className="text-[10px] text-[#94A3B8]">Across all quizzes</span>
        </div>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex items-center gap-4 border-b border-[#1B2A44] pb-2">
        <button
          onClick={() => setDashboardTab('quizzes')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            dashboardTab === 'quizzes'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <FolderKanban size={16} />
          My Authored Quizzes ({quizzes.length})
        </button>

        <button
          onClick={() => setDashboardTab('live-history')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            dashboardTab === 'live-history'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Radio size={16} className={liveSessionsHistory.some(s => s.status !== 'COMPLETED') ? 'animate-pulse text-[#34D399]' : ''} />
          Hosted Live Quiz History ({liveSessionsHistory.length})
        </button>
      </div>

      {/* TAB 1: AUTHORED QUIZZES */}
      {dashboardTab === 'quizzes' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filter and Search Bar */}
          <div className="dashboard-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search quizzes by title or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 text-xs"
            />
          </div>

          {/* Subject Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field text-xs md:w-44"
          >
            <option value="">All Subjects</option>
            <option value="TQM (Total Quality Management)">TQM</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Science">Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Engineering & Tech">Engineering & Tech</option>
            <option value="General Knowledge">General Knowledge</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field text-xs md:w-32"
          >
            <option value="">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="input-field text-xs md:w-32"
          >
            <option value="">All Levels</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input-field text-xs md:w-40"
          >
            <option value="updated_desc">Recently Modified</option>
            <option value="created_desc">Recently Created</option>
            <option value="title_asc">Title (A-Z)</option>
            <option value="title_desc">Title (Z-A)</option>
          </select>

        </div>
      </div>

      {/* Quizzes Grid / List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
          <div className="inline-block w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin mb-2" />
          <p>Loading your quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="dashboard-card p-12 text-center space-y-4 border-dashed border-[#1F304E]">
          <div className="w-14 h-14 rounded-2xl bg-[#121D32] border border-[#1F304E] flex items-center justify-center text-[#64748B] mx-auto">
            <BookOpen size={26} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No quizzes found</h3>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
              {search || category || status ? 'No quizzes match your filter criteria.' : 'You have not created any quizzes yet. Click below to author your first assessment.'}
            </p>
          </div>
          <button
            onClick={handleCreateNewQuiz}
            className="btn-emerald-primary text-xs py-2 px-5 font-bold mx-auto gap-2"
          >
            <Plus size={15} />
            Create First Quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="dashboard-card p-5 space-y-4 flex flex-col justify-between hover:border-[#2D436B] transition-all group"
            >
              
              {/* Header Info */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    quiz.status === 'PUBLISHED'
                      ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30'
                      : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                  }`}>
                    {quiz.status} &bull; v{quiz.version}
                  </span>

                  <div className="flex items-center gap-2">
                    {quiz.status === 'PUBLISHED' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                        Self-Paced Ready
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#34D399]">
                      Subject: {quiz.category || 'General'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#34D399] transition-colors line-clamp-1">
                    {quiz.title}
                  </h3>
                  <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1 min-h-[32px]">
                    {quiz.description || 'No description provided.'}
                  </p>
                </div>

                {/* Badges / Stats */}
                <div className="flex items-center gap-3 pt-2 text-[11px] text-[#94A3B8] border-t border-[#1B2A44]/60">
                  <span className="flex items-center gap-1 font-semibold text-white">
                    <HelpCircle size={13} className="text-[#34D399]" />
                    {quiz.question_count || 0} Questions
                  </span>
                  <span>&bull;</span>
                  <span className="font-semibold text-white">
                    {quiz.total_marks || 0} Pts
                  </span>
                  <span>&bull;</span>
                  <span className="text-[10px] text-[#64748B]">
                    {quiz.difficulty}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1B2A44] flex items-center justify-between gap-2">
                
                <div className="flex items-center gap-1">
                  {/* Edit Studio */}
                  <button
                    onClick={() => onOpenStudio(quiz.id)}
                    className="p-2 rounded-lg bg-[#132238] hover:bg-[#1A2D4A] text-white hover:text-[#34D399] transition-colors"
                    title="Edit in Quiz Studio"
                  >
                    <Edit3 size={15} />
                  </button>

                  {/* Preview */}
                  <button
                    onClick={() => onOpenPreview(quiz.id)}
                    className="p-2 rounded-lg bg-[#132238] hover:bg-[#1A2D4A] text-white hover:text-[#06B6D4] transition-colors"
                    title="Preview Quiz"
                  >
                    <Eye size={15} />
                  </button>

                  {/* Student Attempts (Phase P3) */}
                  {quiz.status === 'PUBLISHED' && (
                    <button
                      onClick={() => handleOpenAttempts(quiz)}
                      className="p-2 rounded-lg bg-[#132238] hover:bg-[#1A2D4A] text-white hover:text-[#38BDF8] transition-colors"
                      title="View Student Assessment Attempts"
                    >
                      <Award size={15} />
                    </button>
                  )}

                  {/* Duplicate */}
                  <button
                    onClick={() => handleDuplicate(quiz.id)}
                    className="p-2 rounded-lg bg-[#132238] hover:bg-[#1A2D4A] text-white hover:text-[#F59E0B] transition-colors"
                    title="Duplicate Quiz"
                  >
                    <Copy size={15} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setQuizToDelete(quiz)}
                    className="p-2 rounded-lg bg-[#132238] hover:bg-[#F43F5E]/20 text-[#64748B] hover:text-[#F43F5E] transition-colors"
                    title="Delete Quiz"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Start / Launch Test (Single Primary Action with Modal Options) */}
                  {quiz.status === 'PUBLISHED' ? (
                    <>
                      <button
                        onClick={() => setLaunchModalQuiz(quiz)}
                        className="btn-emerald-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 shadow-md shadow-[#10B981]/25 hover:scale-105 transition-all"
                        title="Launch test in Live Multiplayer, Self-Paced, Assignment, or Proctored Mode"
                      >
                        <Play size={12} className="fill-current" />
                        <span>Start Test</span>
                      </button>

                      <button
                        onClick={() => handleTogglePublish(quiz)}
                        className="text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-[#1F293D] text-[#94A3B8] hover:bg-[#F43F5E]/15 hover:text-[#F43F5E] transition-all"
                        title="Revert to draft"
                      >
                        Unpublish
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleTogglePublish(quiz)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#10B981]/20 text-[#34D399] hover:bg-[#10B981]/30 border border-[#10B981]/40 flex items-center gap-1.5 transition-all"
                    >
                      <Rocket size={12} />
                      <span>Publish to Launch</span>
                    </button>
                  )}
                </div>

              </div>

            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {dashboardTab === 'quizzes' && !loading && quizzes.length === 0 && (
        <div className="dashboard-card p-12 text-center space-y-4 border-2 border-dashed border-[#1F304E]">
          <div className="w-12 h-12 rounded-2xl bg-[#132238] flex items-center justify-center text-[#64748B] mx-auto">
            <FolderKanban size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Quizzes Found</h3>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto mt-1">
              {search || category || status || difficulty
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by creating your first quiz in the studio.'}
            </p>
          </div>
          <button
            onClick={handleCreateNewQuiz}
            className="btn-emerald-primary text-xs py-2 px-4 font-bold mx-auto"
          >
            Create New Quiz
          </button>
        </div>
      )}
      </div>
      )}

      {/* TAB 2: HOSTED LIVE SESSIONS HISTORY */}
      {dashboardTab === 'live-history' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="dashboard-card p-6 border border-[#1F304E]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio size={18} className="text-[#34D399] animate-pulse" />
                  Hosted Live Multiplayer Quiz Sessions
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Complete audit history of synchronized multiplayer live quiz battles hosted by you.
                </p>
              </div>
            </div>

            {liveSessionsHistory.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#94A3B8] space-y-3">
                <Radio size={32} className="mx-auto text-[#64748B] opacity-50" />
                <p className="font-semibold text-white">No live multiplayer sessions hosted yet.</p>
                <p className="text-[11px] text-[#64748B]">
                  Publish any quiz and click "Host Live" on its card to launch a real-time multiplayer assessment!
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-3">
                {liveSessionsHistory.map(sess => (
                  <div
                    key={sess.id}
                    className="p-4 rounded-xl bg-[#0E1626] border border-[#1B2A44] hover:border-[#2D436B] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          sess.status === 'COMPLETED'
                            ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30'
                            : sess.status === 'LOBBY'
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 animate-pulse'
                            : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                        }`}>
                          {sess.status}
                        </span>
                        <span className="text-xs font-mono font-bold text-white bg-[#0B111D] px-2.5 py-0.5 rounded-lg border border-[#2D436B]">
                          PIN: {sess.join_code}
                        </span>
                        <span className="text-[11px] text-[#38BDF8] font-semibold">
                          {sess.quiz_category}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white truncate max-w-md">
                        {sess.quiz_title}
                      </h4>

                      <p className="text-[11px] text-[#64748B]">
                        Hosted on {new Date(sess.created_at).toLocaleDateString()} at {new Date(sess.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {sess.total_questions || 0} Questions
                      </p>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end text-xs font-bold text-white">
                          <Users size={14} className="text-[#38BDF8]" />
                          <span>{sess.participant_count || 0} Learners</span>
                        </div>
                        {sess.winner_name ? (
                          <p className="text-[10px] text-[#F59E0B] font-semibold mt-0.5">
                            🏆 Top: {sess.winner_name} ({sess.highest_score || 0} pts)
                          </p>
                        ) : (
                          <p className="text-[10px] text-[#64748B] mt-0.5">No responses recorded</p>
                        )}
                      </div>

                      {/* Re-host or Resume */}
                      {sess.status === 'LOBBY' || sess.status === 'QUESTION_ACTIVE' ? (
                        <button
                          onClick={() => onHostLive && onHostLive(sess.id)}
                          className="btn-emerald-primary text-xs py-2 px-3 font-bold"
                        >
                          Resume Lobby
                        </button>
                      ) : (
                        <button
                          onClick={() => handleHostLiveSession(sess.quiz_id)}
                          className="btn-secondary text-xs py-2 px-3 font-bold text-[#34D399] border-[#34D399]/30 hover:bg-[#10B981]/15"
                        >
                          Host Again
                        </button>
                      )}

                      {/* Delete Session From History */}
                      <button
                        onClick={() => handleDeleteLiveSession(sess.id)}
                        className="p-2 rounded-lg bg-[#132238] hover:bg-[#F43F5E]/20 text-[#64748B] hover:text-[#F43F5E] transition-colors border border-transparent hover:border-[#F43F5E]/30"
                        title="Delete Session Record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Attempts Breakdown Modal (Phase P3) */}
      {viewingAttemptsQuiz && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-2xl w-full p-6 space-y-4 border border-[#1B2A44] shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award size={18} className="text-[#38BDF8]" />
                  Learner Performance &bull; {viewingAttemptsQuiz.title}
                </h3>
                <p className="text-xs text-[#94A3B8]">Review student scores and pass rates for this assessment.</p>
              </div>
              <button onClick={() => setViewingAttemptsQuiz(null)} className="text-[#64748B] hover:text-white">
                ✕
              </button>
            </div>

            {loadingAttempts ? (
              <div className="text-center py-12 text-xs text-[#94A3B8] font-mono">
                Loading attempt records...
              </div>
            ) : quizAttemptsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#94A3B8]">
                No completed student attempts yet for this quiz.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {quizAttemptsList.map(att => (
                  <div key={att.id} className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{att.student_name}</p>
                      <p className="text-[11px] text-[#64748B] font-mono">{att.student_email}</p>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      {/* Integrity / Anti-Cheat Status */}
                      {att.is_flagged ? (
                        <span className="text-[10px] font-extrabold text-[#FB7185] bg-[#F43F5E]/20 px-2.5 py-0.5 rounded-full border border-[#F43F5E]/40 flex items-center gap-1 animate-pulse" title={att.flag_reason || 'Flagged: Multiple window exits or tab changes'}>
                          <span>🚩</span> FLAGGED
                        </span>
                      ) : att.warning_count > 0 ? (
                        <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/20 px-2.5 py-0.5 rounded-full border border-[#F59E0B]/40 flex items-center gap-1" title="1 tab switch / fullscreen exit warning">
                          <span>⚠️</span> 1 Warning
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                          ✓ Fullscreen Clean
                        </span>
                      )}

                      <div>
                        <span className="font-mono font-bold text-white text-sm">
                          {att.score_percentage}%
                        </span>
                        <p className="text-[10px] text-[#64748B] font-mono">{att.score} / {att.max_score} pts</p>
                      </div>

                      {att.is_passed ? (
                        <span className="text-[10px] font-bold text-[#34D399] bg-[#10B981]/20 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                          Passed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#FB7185] bg-[#F43F5E]/20 px-2 py-0.5 rounded-full border border-[#F43F5E]/30">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setViewingAttemptsQuiz(null)} className="btn-secondary text-xs py-2 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {quizToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-md w-full p-6 space-y-4 border-l-4 border-l-[#F43F5E] animate-fadeIn">
            <div className="flex items-center gap-3 text-[#F43F5E]">
              <AlertCircle size={22} />
              <h3 className="text-base font-bold text-white">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">"{quizToDelete.title}"</strong>? All associated questions and configurations will be removed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setQuizToDelete(null)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleDeleteQuiz}
                className="btn-emerald-primary text-xs py-2 px-4 bg-[#F43F5E] hover:bg-[#E11D48] border-none font-bold text-white"
              >
                {actionLoading ? 'Deleting...' : 'Delete Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start / Launch Test Mode Modal */}
      {launchModalQuiz && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="dashboard-card max-w-2xl w-full p-6 sm:p-7 space-y-5 border-2 border-[#10B981]/40 bg-[#0B111D] shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1B2A44]">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#34D399] bg-[#10B981]/15 px-2.5 py-0.5 rounded-full border border-[#10B981]/30">
                  Launch Assessment
                </span>
                <h3 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
                  <Play size={18} className="text-[#34D399] fill-current" />
                  {launchModalQuiz.title}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Select how you want your students to experience this assessment.
                </p>
              </div>
              <button
                onClick={() => setLaunchModalQuiz(null)}
                className="w-8 h-8 rounded-lg bg-[#132238] border border-[#1F304E] flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Launch Modes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Option 1: Live Multiplayer (Host Live) */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#10B981]/10 via-[#0E1626] to-[#0A1220] border-2 border-[#10B981]/40 hover:border-[#10B981] transition-all flex flex-col justify-between space-y-3 shadow-lg shadow-[#10B981]/10">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-[#10B981]/20 flex items-center justify-center text-[#34D399]">
                      <Radio size={18} className="animate-pulse" />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase bg-[#10B981]/25 text-[#34D399] px-2 py-0.5 rounded-full">
                      Real-Time Sync
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">Live Multiplayer Battle</h4>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Host a real-time synchronized battle with PIN joining, teacher countdown, synchronized questions, and live podium celebration.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const qId = launchModalQuiz.id;
                    setLaunchModalQuiz(null);
                    handleHostLiveSession(qId);
                  }}
                  className="btn-emerald-primary text-xs py-2 px-3 font-bold w-full justify-center gap-1.5 shadow-md shadow-[#10B981]/25"
                >
                  <Radio size={14} className="animate-pulse" />
                  <span>Host Live Session</span>
                </button>
              </div>

              {/* Option 2: Self-Paced Practice & Exam */}
              <div className="p-4 rounded-xl bg-[#0E1626] border border-[#1B2A44] hover:border-[#38BDF8]/60 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 flex items-center justify-center text-[#38BDF8]">
                      <Clock size={18} />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase bg-[#38BDF8]/20 text-[#38BDF8] px-2 py-0.5 rounded-full">
                      On-Demand
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">Self-Paced Practice &amp; Exam</h4>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Students take the quiz on their own schedule with per-question timers, server-authoritative scoring, and instant scorecard.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const qId = launchModalQuiz.id;
                    setLaunchModalQuiz(null);
                    onOpenPreview(qId);
                  }}
                  className="btn-secondary text-xs py-2 px-3 font-bold w-full justify-center gap-1.5 text-[#38BDF8] border-[#38BDF8]/30 hover:bg-[#38BDF8]/15"
                >
                  <BookOpen size={14} />
                  <span>Preview / Run Exam</span>
                </button>
              </div>

              {/* Option 3: Scheduled Homework / Assignment */}
              <div className="p-4 rounded-xl bg-[#0E1626] border border-[#1B2A44] hover:border-[#F59E0B]/60 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center text-[#F59E0B]">
                      <Calendar size={18} />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded-full">
                      Homework / Deadline
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">Scheduled Assignment</h4>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Set a submission deadline, cohort eligibility, and attempt limits for homework assignments.
                  </p>
                </div>
                <button
                  onClick={() => {
                    alert(`Assignment scheduled for "${launchModalQuiz.title}"! Students can access it in their Assessments & Assignments tab.`);
                    setLaunchModalQuiz(null);
                  }}
                  className="btn-secondary text-xs py-2 px-3 font-bold w-full justify-center gap-1.5 text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/15"
                >
                  <Calendar size={14} />
                  <span>Schedule Assignment</span>
                </button>
              </div>

            </div>

            {/* Anti-cheat banner notice */}
            <div className="p-3 rounded-xl bg-[#0E1626] border border-[#1F304E] flex items-center gap-2.5 text-xs text-[#94A3B8]">
              <span className="text-base">🛡️</span>
              <p>
                <strong className="text-white">Built-in Fullscreen &amp; Tab-Switch Protection:</strong> All assessments automatically enforce full screen. The 1st tab switch or exit prompts a warning; subsequent exits permanently flag the test for teacher review.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1B2A44] text-xs text-[#64748B]">
              <span>Questions: <strong className="text-white">{launchModalQuiz.question_count || 0}</strong> &bull; Total Marks: <strong className="text-white">{launchModalQuiz.total_marks || 0} pts</strong></span>
              <button
                onClick={() => setLaunchModalQuiz(null)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
