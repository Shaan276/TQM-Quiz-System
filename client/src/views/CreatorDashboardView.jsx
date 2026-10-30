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
  Sparkles
} from 'lucide-react';

export default function CreatorDashboardView({ setActiveRoute, onOpenStudio, onOpenPreview }) {
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

  const isCreatorOrAdmin = user?.role === 'CREATOR' || user?.role === 'ADMIN';

  // Role upgrade handler for testing/learners
  const handleUpgradeToCreator = async () => {
    try {
      const res = await fetch('/api/v1/users/upgrade-to-creator', {
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

      // 2. Fetch quizzes with query params
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
          title: 'Untitled Quiz',
          category: 'General',
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

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field text-xs md:w-36"
          >
            <option value="">All Categories</option>
            <option value="General">General</option>
            <option value="Science">Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="History">History</option>
            <option value="Technology">Technology</option>
            <option value="Languages">Languages</option>
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

                  <span className="text-[10px] font-mono text-[#64748B]">
                    {quiz.category}
                  </span>
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

                {/* Publish Toggle Button */}
                <button
                  onClick={() => handleTogglePublish(quiz)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                    quiz.status === 'PUBLISHED'
                      ? 'bg-[#1F293D] text-[#94A3B8] hover:bg-[#F43F5E]/15 hover:text-[#F43F5E]'
                      : 'bg-[#10B981]/20 text-[#34D399] hover:bg-[#10B981]/30 border border-[#10B981]/40'
                  }`}
                >
                  {quiz.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </button>

              </div>

            </div>
          ))}
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

    </div>
  );
}
