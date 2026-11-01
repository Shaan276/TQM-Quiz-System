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
  Rocket,
  BarChart3,
  GraduationCap
} from 'lucide-react';
import TeacherInsightsView from './TeacherInsightsView';

export default function CreatorDashboardView({ setActiveRoute, onOpenStudio, onOpenPreview, onHostLive, initialTab }) {
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

  // Live sessions history state (Phase P4, P6 & P8)
  const [dashboardTab, setDashboardTab] = useState(initialTab || 'quizzes'); // 'quizzes' | 'insights' | 'all-tests' | 'live-history' | 'student-approvals'
  const [liveSessionsHistory, setLiveSessionsHistory] = useState([]);
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Pending student enrollments for sections taught by this teacher
  const [pendingEnrollments, setPendingEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  const fetchPendingEnrollments = async () => {
    if (!accessToken) return;
    try {
      setEnrollmentsLoading(true);
      const res = await fetch('/api/v1/institutions/enrollments/pending', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingEnrollments(data.data.pendingEnrollments || []);
      }
    } catch (err) {
      console.error('Failed to load pending student enrollments:', err);
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  const handleApproveEnrollment = async (enrollmentId, studentName) => {
    try {
      const res = await fetch(`/api/v1/institutions/enrollments/${enrollmentId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchPendingEnrollments();
      } else {
        alert(data.error?.message || 'Error approving student enrollment');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectEnrollment = async (enrollmentId, studentName) => {
    if (!confirm(`Decline enrollment request for ${studentName}?`)) return;
    try {
      const res = await fetch(`/api/v1/institutions/enrollments/${enrollmentId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchPendingEnrollments();
      } else {
        alert(data.error?.message || 'Error declining student enrollment');
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setDashboardTab(initialTab);
    }
    if (accessToken) {
      fetchPendingEnrollments();
    }
  }, [initialTab, accessToken]);

  // Phase P6 Unified Assessment Analytics State
  const [allTestsData, setAllTestsData] = useState({ liveBattles: [], selfPacedAttempts: [], scheduledAssignments: [] });
  const [testsSubTab, setTestsSubTab] = useState('live'); // 'live' | 'self-paced' | 'assignments'
  const [selectedAssignmentDrilldown, setSelectedAssignmentDrilldown] = useState(null);

  // Phase P6 Scoped Assignment Modal State
  const [assignmentModalQuiz, setAssignmentModalQuiz] = useState(null);
  const [teacherAllocations, setTeacherAllocations] = useState([]);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    instructions: '',
    selectedSections: [],
    selectedStudents: [],
    dueDate: '',
    timeLimitMins: 10,
    maxAttempts: 1,
    allowLate: false
  });

  // Start Test / Launch Mode Modal state
  const [launchModalQuiz, setLaunchModalQuiz] = useState(null);

  const isCreatorOrAdmin = ['CREATOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes((user?.role || '').toUpperCase());

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

      // 5. Fetch Unified Assessment Data (Live, Self-Paced, Assignments)
      try {
        const atRes = await fetch('/api/v1/analytics/teacher/all-tests', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const atData = await atRes.json();
        if (atData.success && atData.data) {
          setAllTestsData(atData.data);
        }
      } catch (e) {
        console.error('Failed to load all tests data', e);
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

  // Phase P6: Open Scoped Assignment Modal
  const handleOpenAssignModal = async (quiz) => {
    setLaunchModalQuiz(null);
    setAssignmentModalQuiz(quiz);
    setAssignmentForm({
      title: `${quiz.title} - Cohort Assessment`,
      instructions: '',
      selectedSections: [],
      selectedStudents: [],
      dueDate: '',
      timeLimitMins: quiz.time_limit_sec > 0 ? Math.round(quiz.time_limit_sec / 60) : 10,
      maxAttempts: 1,
      allowLate: false
    });

    try {
      const res = await fetch('/api/v1/institutions/my-assignments', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setTeacherAllocations(data.data.allocations || []);
        setEligibleStudents(data.data.eligibleStudents || []);
      }
    } catch (e) {
      console.error('Failed to load teaching allocations', e);
    }
  };

  // Phase P6: Publish Assignment
  const handlePublishAssignment = async (e) => {
    e.preventDefault();
    if (!assignmentForm.title.trim()) {
      alert('Please enter an assignment title');
      return;
    }
    if (assignmentForm.selectedSections.length === 0 && assignmentForm.selectedStudents.length === 0) {
      alert('Please select at least one section or student recipient.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/v1/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          quizId: assignmentModalQuiz.id,
          title: assignmentForm.title,
          instructions: assignmentForm.instructions,
          scopeType: assignmentForm.selectedSections.length > 0 && assignmentForm.selectedStudents.length > 0
            ? 'COMBINED'
            : assignmentForm.selectedSections.length > 1
            ? 'MULTI_SECTION'
            : assignmentForm.selectedSections.length === 1
            ? 'SECTION'
            : 'INDIVIDUAL',
          targetSections: assignmentForm.selectedSections,
          targetStudents: assignmentForm.selectedStudents,
          dueDate: assignmentForm.dueDate ? new Date(assignmentForm.dueDate).toISOString() : null,
          timeLimitSec: (parseInt(assignmentForm.timeLimitMins) || 0) * 60,
          maxAttempts: parseInt(assignmentForm.maxAttempts) || 1,
          allowLate: assignmentForm.allowLate
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.data.message || 'Assignment published successfully!');
        setAssignmentModalQuiz(null);
        fetchMetricsAndQuizzes();
      } else {
        alert(data.error?.message || 'Failed to publish assignment');
      }
    } catch (err) {
      console.error(err);
      alert('Network error publishing assignment');
    } finally {
      setActionLoading(false);
    }
  };

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
        <div className="w-16 h-16 rounded-2xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 flex items-center justify-center text-[#FB7185] mx-auto">
          <ShieldCheck size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Teacher Privileges Required</h2>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
            This workspace is reserved for authorized Instructors and Administrators. Roles are separated to ensure institutional security and assessment integrity.
          </p>
        </div>
        <button
          onClick={() => setActiveRoute('learner-dashboard')}
          className="btn-secondary text-xs py-2.5 px-6 font-bold gap-2 inline-flex"
        >
          Return to Learner Portal
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

      {/* Account Pending Approval Banner (Security Gate) */}
      {user?.approvalStatus === 'PENDING' && (
        <div className="p-4 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 flex items-start gap-3.5 animate-in fade-in">
          <div className="p-2 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] shrink-0 mt-0.5">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#FBBF24]">Teacher Account Pending Administrator Approval</h4>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
              Your instructor registration has been logged and is awaiting approval by the Organization Administrator.
              During this pending stage, you can explore the question bank and draft quizzes. Cohort assignment publishing and live multiplayer test hosting will be unlocked upon admin confirmation.
            </p>
          </div>
        </div>
      )}

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
      <div className="flex items-center gap-4 border-b border-[#1B2A44] pb-2 overflow-x-auto">
        <button
          onClick={() => setDashboardTab('quizzes')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            dashboardTab === 'quizzes'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <FolderKanban size={16} />
          My Authored Quizzes ({quizzes.length})
        </button>

        <button
          onClick={() => setDashboardTab('insights')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            dashboardTab === 'insights'
              ? 'border-[#38BDF8] text-[#38BDF8]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <BarChart3 size={16} />
          Assessment Insights &amp; Analytics
        </button>

        <button
          onClick={() => {
            setDashboardTab('all-tests');
            fetchMetricsAndQuizzes();
          }}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            dashboardTab === 'all-tests'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Award size={16} className="text-[#38BDF8]" />
          All Tests &amp; Student Data ({ (allTestsData?.liveBattles?.length || 0) + (allTestsData?.selfPacedAttempts?.length || 0) + (allTestsData?.scheduledAssignments?.length || 0) })
        </button>

        <button
          onClick={() => setDashboardTab('live-history')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            dashboardTab === 'live-history'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Radio size={16} className={liveSessionsHistory.some(s => s.status !== 'COMPLETED') ? 'animate-pulse text-[#34D399]' : ''} />
          Hosted Live History ({liveSessionsHistory.length})
        </button>

        <button
          onClick={() => {
            setDashboardTab('student-approvals');
            fetchPendingEnrollments();
          }}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            dashboardTab === 'student-approvals'
              ? 'border-[#8B5CF6] text-[#A78BFA]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <GraduationCap size={16} />
          Student Enrollments
          {pendingEnrollments.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-[#8B5CF6] text-white animate-pulse">
              {pendingEnrollments.length}
            </span>
          )}
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

      {/* TAB: STUDENT ENROLLMENT APPROVALS (Phase P8 / Security Workflows) */}
      {dashboardTab === 'student-approvals' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="dashboard-card p-6 border border-[#8B5CF6]/30 bg-gradient-to-r from-[#12142B] via-[#0E1626] to-[#0A1220]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap size={20} className="text-[#A78BFA]" />
                  Section Student Enrollments &amp; Approvals
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-2xl leading-relaxed">
                  As an instructor, you can accept student enrollment requests for sections assigned to you. When approved, students immediately gain access to your scheduled assignments and tests.
                </p>
              </div>

              <button
                onClick={fetchPendingEnrollments}
                disabled={enrollmentsLoading}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-2 self-start sm:self-auto"
              >
                <RefreshCw size={13} className={enrollmentsLoading ? 'animate-spin' : ''} />
                Refresh List
              </button>
            </div>
          </div>

          <div className="dashboard-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-[#38BDF8]" />
                Pending Applicants ({pendingEnrollments.length})
              </h4>
              <span className="text-xs text-[#94A3B8]">
                Scoped to sections you teach
              </span>
            </div>

            {pendingEnrollments.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#10B981]/10 text-[#34D399] flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-bold text-white">No Pending Student Requests</p>
                <p className="text-xs text-[#64748B]">All student applicants for your sections have been reviewed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1B2A44] text-[#64748B] uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Target Section &amp; Class</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Requested At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B2A44]">
                    {pendingEnrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-[#121E36]/40 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white">{e.student_name}</p>
                          <p className="text-[11px] text-[#64748B] font-mono">{e.student_email}</p>
                          {e.roll_number && (
                            <span className="text-[10px] text-[#38BDF8]">Roll: {e.roll_number}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#34D399]">{e.section_name}</p>
                          <p className="text-[11px] text-[#94A3B8]">{e.class_name} ({e.academic_year_name})</p>
                        </td>
                        <td className="py-3 px-4 text-[#94A3B8]">{e.department_name}</td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {new Date(e.enrolled_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleRejectEnrollment(e.id, e.student_name)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border border-[#F43F5E]/30 transition-all"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleApproveEnrollment(e.id, e.student_name)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#10B981] bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/40 transition-all shadow-sm shadow-[#10B981]/10"
                          >
                            Approve Enrollment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ALL TESTS & STUDENT DATA (LIVE, SELF-PACED, ASSIGNMENTS) */}
      {dashboardTab === 'all-tests' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header */}
          <div className="dashboard-card p-6 border border-[#1F304E] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award size={20} className="text-[#38BDF8]" />
                  Unified Assessment Analytics &amp; Student Data
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Authoritative student scores, anti-cheat audit flags, and completion rates across all 3 assessment modes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTestsSubTab('live')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    testsSubTab === 'live' ? 'bg-[#10B981] text-black shadow-md shadow-[#10B981]/30' : 'bg-[#121D32] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Live Battles ({allTestsData?.liveBattles?.length || 0})
                </button>
                <button
                  onClick={() => setTestsSubTab('self-paced')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    testsSubTab === 'self-paced' ? 'bg-[#38BDF8] text-black shadow-md shadow-[#38BDF8]/30' : 'bg-[#121D32] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Self-Paced ({allTestsData?.selfPacedAttempts?.length || 0})
                </button>
                <button
                  onClick={() => setTestsSubTab('assignments')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    testsSubTab === 'assignments' ? 'bg-[#F59E0B] text-black shadow-md shadow-[#F59E0B]/30' : 'bg-[#121D32] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Assignments ({allTestsData?.scheduledAssignments?.length || 0})
                </button>
              </div>
            </div>

            {/* SUBTAB 1: LIVE BATTLES DATA */}
            {testsSubTab === 'live' && (
              <div className="space-y-4">
                {(!allTestsData?.liveBattles || allTestsData.liveBattles.length === 0) ? (
                  <div className="text-center py-12 text-xs text-[#94A3B8]">
                    No live quiz battles recorded yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allTestsData.liveBattles.map(battle => (
                      <div key={battle.id} className="p-4 rounded-xl bg-[#0E1626] border border-[#1B2A44] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1B2A44]/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#10B981]/20 text-[#34D399]">
                              PIN: {battle.join_code}
                            </span>
                            <h4 className="text-sm font-bold text-white">{battle.quiz_title}</h4>
                            <span className="text-[11px] text-[#64748B]">({battle.quiz_category})</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-[#94A3B8]">Players: <strong className="text-white">{battle.participant_count}</strong></span>
                            <span className="text-[#94A3B8]">Avg Score: <strong className="text-[#34D399]">{Math.round(battle.average_score || 0)} pts</strong></span>
                            {battle.flagged_count > 0 && (
                              <span className="px-2 py-0.5 rounded bg-[#F43F5E]/20 text-[#FB7185] font-bold text-[10px] border border-[#F43F5E]/40">
                                🚩 {battle.flagged_count} Flagged
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Player Roster & Violations */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {battle.participants.map(p => (
                            <div key={p.id} className="p-2.5 rounded-lg bg-[#121D32] border border-[#1F304E] flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-white flex items-center gap-1.5">
                                  <span>#{p.rank || '-'}</span>
                                  <span>{p.display_name}</span>
                                </p>
                                <p className="text-[10px] text-[#64748B]">{p.correct_count} correct</p>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-black text-white">{p.score} <span className="text-[10px] text-[#34D399]">pts</span></span>
                                <div>
                                  {p.is_flagged ? (
                                    <span className="text-[9px] font-bold text-[#FB7185] block">🚩 Flagged</span>
                                  ) : p.warning_count > 0 ? (
                                    <span className="text-[9px] font-bold text-[#FBBF24] block">⚠️ 1 Warning</span>
                                  ) : (
                                    <span className="text-[9px] text-[#34D399] block">✓ Clean</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2: SELF-PACED ATTEMPTS DATA */}
            {testsSubTab === 'self-paced' && (
              <div>
                {(!allTestsData?.selfPacedAttempts || allTestsData.selfPacedAttempts.length === 0) ? (
                  <div className="text-center py-12 text-xs text-[#94A3B8]">
                    No self-paced student attempts recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#121D32] text-[#64748B] uppercase font-mono text-[10px]">
                        <tr>
                          <th className="p-3">Student</th>
                          <th className="p-3">Cohort / Section</th>
                          <th className="p-3">Quiz</th>
                          <th className="p-3">Score &amp; %</th>
                          <th className="p-3">Integrity &amp; Anti-Cheat</th>
                          <th className="p-3">Time</th>
                          <th className="p-3">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F304E]">
                        {allTestsData.selfPacedAttempts.map(att => (
                          <tr key={att.id} className="hover:bg-[#121D32]/50 transition-colors">
                            <td className="p-3">
                              <p className="font-bold text-white">{att.student_name}</p>
                              <p className="text-[11px] text-[#64748B]">{att.student_email}</p>
                            </td>
                            <td className="p-3 text-[#94A3B8]">
                              {att.section_name ? (
                                <span>{att.section_name} {att.roll_number ? `(${att.roll_number})` : ''}</span>
                              ) : (
                                <span className="text-[#64748B]">Independent</span>
                              )}
                            </td>
                            <td className="p-3">
                              <p className="font-semibold text-white">{att.quiz_title}</p>
                              <span className="text-[10px] text-[#64748B]">{att.quiz_category}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-mono font-bold text-white">{att.score} / {att.max_score}</span>
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                att.is_passed ? 'bg-[#10B981]/20 text-[#34D399]' : 'bg-[#F43F5E]/20 text-[#FB7185]'
                              }`}>
                                {Math.round(att.score_percentage)}%
                              </span>
                            </td>
                            <td className="p-3">
                              {att.is_flagged ? (
                                <span className="px-2 py-0.5 rounded bg-[#F43F5E]/20 text-[#FB7185] font-bold text-[10px] border border-[#F43F5E]/40" title={att.flag_reason}>
                                  🚩 FLAGGED ({att.warning_count} warnings)
                                </span>
                              ) : att.warning_count > 0 ? (
                                <span className="px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#FBBF24] font-bold text-[10px] border border-[#F59E0B]/40">
                                  ⚠️ 1 Warning
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] text-[10px] font-semibold border border-[#10B981]/30">
                                  ✓ Fullscreen Clean
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-[#94A3B8]">
                              {att.time_taken_sec > 0 ? `${Math.round(att.time_taken_sec / 60)}m ${att.time_taken_sec % 60}s` : 'Untimed'}
                            </td>
                            <td className="p-3 text-[#64748B]">
                              {new Date(att.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 3: SCHEDULED ASSIGNMENTS DATA */}
            {testsSubTab === 'assignments' && (
              <div className="space-y-4">
                {(!allTestsData?.scheduledAssignments || allTestsData.scheduledAssignments.length === 0) ? (
                  <div className="text-center py-12 text-xs text-[#94A3B8]">
                    No scheduled assignments published yet. Click "Start Test" on any published quiz to create an assignment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allTestsData.scheduledAssignments.map(assign => (
                      <div key={assign.id} className="p-4 rounded-xl bg-[#0E1626] border border-[#1B2A44] hover:border-[#F59E0B]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">{assign.title}</span>
                            <span className="text-[10px] font-extrabold uppercase bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded border border-[#F59E0B]/30">
                              {assign.scope_type}
                            </span>
                            <span className="text-xs text-[#64748B]">
                              Due: {assign.due_date ? new Date(assign.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Deadline'}
                            </span>
                          </div>

                          <p className="text-xs text-[#94A3B8]">
                            Quiz: <strong className="text-white">{assign.quiz_title}</strong> &bull; {assign.instructions || 'Mandatory scheduled cohort assessment.'}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                            <span>Recipients: <strong className="text-white">{assign.total_recipients}</strong></span>
                            <span>&bull;</span>
                            <span className="text-[#34D399]">Submitted: <strong>{assign.submitted_count || 0}</strong></span>
                            <span>&bull;</span>
                            <span className="text-[#FBBF24]">In Progress: <strong>{assign.in_progress_count || 0}</strong></span>
                            <span>&bull;</span>
                            <span className="text-[#64748B]">Pending: <strong>{assign.pending_count || 0}</strong></span>
                            <span>&bull;</span>
                            <span>Avg Score: <strong className="text-[#38BDF8]">{Math.round(assign.average_score || 0)} pts</strong></span>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedAssignmentDrilldown(assign)}
                          className="btn-secondary text-xs py-2 px-3 font-bold text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/15 shrink-0"
                        >
                          View Student Progress ({assign.total_recipients})
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* TAB 4: ADVANCED ASSESSMENT INSIGHTS (PHASE P8) */}
      {dashboardTab === 'insights' && (
        <TeacherInsightsView onNavigateToQuizStudio={(qId) => onOpenStudio(qId)} />
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
                  onClick={() => handleOpenAssignModal(launchModalQuiz)}
                  className="btn-secondary text-xs py-2 px-3 font-bold w-full justify-center gap-1.5 text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/15"
                >
                  <Calendar size={14} />
                  <span>Configure &amp; Assign Cohort</span>
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

      {/* SCOPED ASSIGNMENT CREATION MODAL (PHASE P6) */}
      {assignmentModalQuiz && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-2xl w-full p-6 space-y-5 border border-[#1B2A44] shadow-2xl animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar size={18} className="text-[#F59E0B]" />
                  Schedule Cohort Assessment &bull; {assignmentModalQuiz.title}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Scoped recipient targeting by teaching section or individual learners with de-duplication.
                </p>
              </div>
              <button onClick={() => setAssignmentModalQuiz(null)} className="text-[#64748B] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePublishAssignment} className="space-y-4 text-xs">
              <div>
                <label className="text-[#94A3B8] font-bold block mb-1">Assignment Title *</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  className="input-field w-full text-xs"
                  placeholder="e.g. Midterm Evaluation - Operations Batch A"
                />
              </div>

              <div>
                <label className="text-[#94A3B8] font-bold block mb-1">Instructions / Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={assignmentForm.instructions}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, instructions: e.target.value })}
                  className="input-field w-full text-xs"
                  placeholder="Instructions for students regarding timing, rules, and topics covered..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#94A3B8] font-bold block mb-1">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    value={assignmentForm.dueDate}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                    className="input-field w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] font-bold block mb-1">Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={assignmentForm.timeLimitMins}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, timeLimitMins: e.target.value })}
                    className="input-field w-full text-xs"
                    placeholder="0 for untimed"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] font-bold block mb-1">Max Attempts Allowed</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={assignmentForm.maxAttempts}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, maxAttempts: e.target.value })}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowLateCheckbox"
                  checked={assignmentForm.allowLate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, allowLate: e.target.checked })}
                  className="rounded border-[#1B2A44] bg-[#0E1626]"
                />
                <label htmlFor="allowLateCheckbox" className="text-white text-xs cursor-pointer">
                  Accept Late Submissions after deadline (tagged as LATE)
                </label>
              </div>

              {/* Recipient Selection Section */}
              <div className="pt-3 border-t border-[#1B2A44] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Target Recipients (Sections &amp; Students)</span>
                  <span className="text-[#10B981] font-mono lowercase">
                    {/* Computed live recipient count */}
                    {(() => {
                      const secStudentIds = eligibleStudents
                        .filter(s => assignmentForm.selectedSections.includes(s.section_id))
                        .map(s => s.id);
                      const combined = new Set([...secStudentIds, ...assignmentForm.selectedStudents]);
                      return `${combined.size} unique recipient(s) selected`;
                    })()}
                  </span>
                </h4>

                {/* Section selection */}
                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#94A3B8]">Assign to whole Teaching Section(s):</p>
                  {teacherAllocations.length === 0 ? (
                    <div className="p-3 rounded-lg bg-[#0E1626] border border-[#1F304E] text-[#64748B] text-xs">
                      No teaching sections allocated to your account yet. You can still select individual students below.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {teacherAllocations.map(alloc => {
                        const isChecked = assignmentForm.selectedSections.includes(alloc.section_id);
                        return (
                          <label
                            key={alloc.id}
                            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                              isChecked ? 'bg-[#10B981]/15 border-[#10B981] text-white' : 'bg-[#0E1626] border-[#1B2A44] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignmentForm({
                                    ...assignmentForm,
                                    selectedSections: [...assignmentForm.selectedSections, alloc.section_id]
                                  });
                                } else {
                                  setAssignmentForm({
                                    ...assignmentForm,
                                    selectedSections: assignmentForm.selectedSections.filter(sid => sid !== alloc.section_id)
                                  });
                                }
                              }}
                              className="rounded border-[#1B2A44] bg-[#0E1626]"
                            />
                            <div>
                              <p className="font-bold text-white">{alloc.class_name} &bull; {alloc.section_name}</p>
                              <p className="text-[10px] text-[#64748B]">{alloc.subject_name} ({alloc.academic_year_name})</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Individual students selection */}
                {eligibleStudents.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] text-[#94A3B8]">Or Select Specific Individual Students:</p>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-[#0E1626] border border-[#1B2A44]">
                      {eligibleStudents.map(st => {
                        const isChecked = assignmentForm.selectedStudents.includes(st.id);
                        const isCoveredBySection = assignmentForm.selectedSections.includes(st.section_id);
                        return (
                          <label
                            key={st.id}
                            className={`p-2 rounded flex items-center justify-between text-xs cursor-pointer ${
                              isCoveredBySection ? 'opacity-70 bg-[#121D32]' : isChecked ? 'bg-[#38BDF8]/15 text-white' : 'hover:bg-[#121D32]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={isCoveredBySection}
                                checked={isChecked || isCoveredBySection}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAssignmentForm({
                                      ...assignmentForm,
                                      selectedStudents: [...assignmentForm.selectedStudents, st.id]
                                    });
                                  } else {
                                    setAssignmentForm({
                                      ...assignmentForm,
                                      selectedStudents: assignmentForm.selectedStudents.filter(uid => uid !== st.id)
                                    });
                                  }
                                }}
                              />
                              <span className="font-semibold text-white">{st.name}</span>
                              <span className="text-[#64748B] text-[10px]">{st.email}</span>
                            </div>
                            <span className="text-[10px] text-[#38BDF8] font-mono">
                              {isCoveredBySection ? '(Included via Section)' : `${st.section_name} ${st.roll_number ? `(${st.roll_number})` : ''}`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Anti-cheat enforcement notice */}
              <div className="p-3 rounded-lg bg-[#0E1626] border border-[#1B2A44] flex items-center gap-2 text-xs text-[#94A3B8]">
                <span>🛡️</span>
                <span>Enforces automatic full-screen monitoring, 1st warning, and 2nd anti-cheat flag alerts for students during this assignment.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1B2A44]">
                <button
                  type="button"
                  onClick={() => setAssignmentModalQuiz(null)}
                  className="btn-secondary text-xs py-2 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-emerald-primary text-xs py-2 px-4 font-bold shadow-md shadow-[#10B981]/20"
                >
                  {actionLoading ? 'Publishing...' : 'Publish & Assign Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGNMENT RECIPIENTS DRILLDOWN MODAL */}
      {selectedAssignmentDrilldown && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-3xl w-full p-6 space-y-4 border border-[#1B2A44] shadow-2xl animate-in fade-in max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-[#F59E0B]" />
                  Recipient Progress &bull; {selectedAssignmentDrilldown.title}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Quiz: <strong className="text-white">{selectedAssignmentDrilldown.quiz_title}</strong> &bull; Total Assigned: <strong className="text-white">{selectedAssignmentDrilldown.total_recipients}</strong>
                </p>
              </div>
              <button onClick={() => setSelectedAssignmentDrilldown(null)} className="text-[#64748B] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {(!selectedAssignmentDrilldown.recipients || selectedAssignmentDrilldown.recipients.length === 0) ? (
                <div className="text-center py-10 text-[#64748B]">No recipient records found.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121D32] text-[#64748B] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-2.5">Student</th>
                      <th className="p-2.5">Section</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Score</th>
                      <th className="p-2.5">Anti-Cheat Flags</th>
                      <th className="p-2.5">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F304E]">
                    {selectedAssignmentDrilldown.recipients.map(r => (
                      <tr key={r.id} className="hover:bg-[#121D32]/50">
                        <td className="p-2.5">
                          <p className="font-bold text-white">{r.student_name}</p>
                          <p className="text-[10px] text-[#64748B]">{r.student_email}</p>
                        </td>
                        <td className="p-2.5 text-[#94A3B8]">
                          {r.section_name || 'Individual'} {r.roll_number ? `(${r.roll_number})` : ''}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            r.status === 'SUBMITTED' ? 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/30' :
                            r.status === 'LATE' ? 'bg-[#F59E0B]/20 text-[#FBBF24] border-[#F59E0B]/30' :
                            r.status === 'OVERDUE' ? 'bg-[#F43F5E]/20 text-[#FB7185] border-[#F43F5E]/30' :
                            r.status === 'STARTED' ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/30' :
                            'bg-[#64748B]/20 text-[#94A3B8] border-[#64748B]/30'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">
                          {r.score !== null ? (
                            <span className="font-bold text-white">{r.score} pts ({r.is_passed ? 'PASS' : 'FAIL'})</span>
                          ) : (
                            <span className="text-[#64748B]">-</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {r.is_flagged ? (
                            <span className="px-2 py-0.5 rounded bg-[#F43F5E]/20 text-[#FB7185] font-bold text-[10px] border border-[#F43F5E]/40" title={r.flag_reason}>
                              🚩 FLAGGED
                            </span>
                          ) : r.warning_count > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#FBBF24] font-bold text-[10px]">
                              ⚠️ 1 Warning
                            </span>
                          ) : (
                            <span className="text-[#34D399] text-[10px]">✓ Clean</span>
                          )}
                        </td>
                        <td className="p-2.5 text-[#64748B] text-[11px]">
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-[#1B2A44] flex justify-end">
              <button
                onClick={() => setSelectedAssignmentDrilldown(null)}
                className="btn-secondary text-xs py-1.5 px-3"
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
