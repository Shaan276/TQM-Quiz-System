import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, 
  BookOpen, 
  Clock, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Eye, 
  Play,
  Zap,
  BookMarked,
  History,
  TrendingUp,
  Filter,
  Radio,
  Trophy,
  Sparkles,
  Star,
  Users,
  Layers,
  Calendar
} from 'lucide-react';

export default function LearnerDashboardView({ onOpenPreview, onStartAttempt, onJoinLive, setActiveRoute }) {
  const [joinPinInput, setJoinPinInput] = useState('');
  const { user, accessToken, setSession } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [learnerTab, setLearnerTab] = useState('all'); // 'all' | 'self-paced' | 'live-battles' | 'assessments'
  const [liveHistory, setLiveHistory] = useState([]);
  const [assignedTests, setAssignedTests] = useState([]);
  const [enrollment, setEnrollment] = useState(null);

  // Enrollment Request Modal State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [instSections, setInstSections] = useState([]);
  const [enrollForm, setEnrollForm] = useState({ section_id: '', roll_number: '' });
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollSuccessMsg, setEnrollSuccessMsg] = useState('');

  const handleOpenEnrollModal = async () => {
    setShowEnrollModal(true);
    try {
      const res = await fetch('/api/v1/institutions/structure', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success && data.data?.sections) {
        setInstSections(data.data.sections);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestEnrollment = async (e) => {
    e.preventDefault();
    if (!enrollForm.section_id) return;
    try {
      setEnrollSubmitting(true);
      const res = await fetch('/api/v1/institutions/students/request-enrollment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(enrollForm)
      });
      const data = await res.json();
      if (data.success) {
        setEnrollSuccessMsg(data.data.message || 'Enrollment request submitted! Awaiting approval.');
        setTimeout(() => {
          setShowEnrollModal(false);
          setEnrollSuccessMsg('');
          fetchData();
        }, 1500);
      } else {
        alert(data.error?.message || 'Error submitting enrollment request');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnrollSubmitting(false);
    }
  };

  // Fetch subjects for filter
  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/v1/quizzes/subjects', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.success && data.data?.subjects) {
          setSubjects(data.data.subjects);
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (accessToken) loadSubjects();
  }, [accessToken]);

  // Fetch learner analytics & discovered quizzes
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Student Analytics
      const aRes = await fetch('/api/v1/analytics/student', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const aData = await aRes.json();
      if (aData.success) {
        setAnalytics(aData.data);
      }

      // 2. Fetch Published Quizzes for Discovery
      let url = `/api/v1/quizzes/discover?search=${encodeURIComponent(search)}`;
      if (selectedSubject) url += `&category=${encodeURIComponent(selectedSubject)}`;
      if (selectedDifficulty) url += `&difficulty=${selectedDifficulty}`;

      const qRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const qData = await qRes.json();
      if (qData.success) {
        setQuizzes(qData.data.quizzes || []);
      }

      // 3. Fetch Live Multiplayer Battles History
      try {
        const lRes = await fetch('/api/v1/live-sessions/history/my', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const lData = await lRes.json();
        if (lData.success && lData.data?.participations) {
          setLiveHistory(lData.data.participations);
        }
      } catch (e) {
        console.error('Failed to load live sessions history', e);
      }

      // 4. Fetch Assigned Assessments
      try {
        const asRes = await fetch('/api/v1/assignments/my-assigned', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const asData = await asRes.json();
        if (asData.success && asData.data?.assignments) {
          setAssignedTests(asData.data.assignments);
        }
      } catch (e) {
        console.error('Failed to load assigned tests', e);
      }

      // 5. Fetch Institutional Enrollment Details
      try {
        const enRes = await fetch('/api/v1/institutions/my-enrollment', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const enData = await enRes.json();
        if (enData.success && enData.data?.enrollment) {
          setEnrollment(enData.data.enrollment);
        }
      } catch (e) {
        console.error('Failed to load student enrollment', e);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchDashboardData();
    }
  }, [accessToken, search, selectedSubject, selectedDifficulty]);

  const handleUpgradeToTeacher = async () => {
    try {
      const res = await fetch('/api/v1/users/upgrade-to-teacher', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.accessToken, data.data.refreshToken, data.data.profile);
        setActiveRoute('creator-dashboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isStudent = user?.role === 'STUDENT' || user?.role === 'LEARNER';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="pb-4 border-b border-[#1B2A44] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <GraduationCap className="text-[#34D399]" size={26} />
            Learner Arena &bull; Assessment Hub
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Welcome back, <strong className="text-white">{user?.name}</strong> &bull; Self-paced quizzes, instant grading, and personalized analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveRoute('attempt-history')}
            className="btn-secondary text-xs py-2 px-3 font-semibold gap-1.5"
          >
            <History size={14} className="text-[#38BDF8]" />
            Past Attempts
          </button>

          <button
            onClick={() => setActiveRoute('mistake-notebook')}
            className="btn-secondary text-xs py-2 px-3 font-semibold gap-1.5 text-[#34D399] border-[#34D399]/30"
          >
            <BookMarked size={14} />
            Mistake Notebook
            {analytics?.mistakes?.unresolved > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#F43F5E] text-white text-[10px] font-bold">
                {analytics.mistakes.unresolved}
              </span>
            )}
          </button>

          {isStudent && (
            <button
              onClick={handleUpgradeToTeacher}
              className="btn-secondary text-xs py-2 px-3 font-semibold gap-1.5 text-[#8B5CF6] border-[#8B5CF6]/30"
              title="Upgrade role to author quizzes"
            >
              <Zap size={14} />
              Switch to Teacher
            </button>
          )}
        </div>
      </div>

      {/* Institutional Enrollment Banner (Phase P6 & P8) */}
      {enrollment && enrollment.status === 'ACTIVE' ? (
        <div className="dashboard-card p-3.5 bg-[#121E36]/90 border border-[#38BDF8]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="font-bold text-white tracking-wide">{enrollment.organization_name}</span>
            <span className="text-[#64748B]">&bull;</span>
            <span className="text-[#94A3B8]">{enrollment.department_name}</span>
            <span className="text-[#64748B]">&bull;</span>
            <span className="text-[#38BDF8] font-bold">{enrollment.class_name} ({enrollment.section_name})</span>
          </div>
          {enrollment.roll_number && (
            <div className="font-mono text-[11px] px-2.5 py-1 rounded bg-[#0A1220] border border-[#1B2A44] text-[#A7F3D0]">
              Roll: <strong>{enrollment.roll_number}</strong>
            </div>
          )}
        </div>
      ) : enrollment && enrollment.status === 'PENDING' ? (
        <div className="dashboard-card p-3.5 bg-[#F59E0B]/10 border border-[#F59E0B]/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            <span className="font-bold text-[#FBBF24]">Enrollment Pending Approval:</span>
            <span className="text-[#CBD5E1]">
              Your request for section <strong className="text-white">{enrollment.section_name}</strong> ({enrollment.class_name}) is currently awaiting teacher or admin review.
            </span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/30">
            Awaiting Verification
          </span>
        </div>
      ) : (
        <div className="dashboard-card p-3.5 bg-[#0D1524] border border-[#1E2E48] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <GraduationCap size={16} className="text-[#38BDF8]" />
            <span>Not currently enrolled in an academic section? Join your class to access teacher-assigned tests.</span>
          </div>
          <button
            onClick={handleOpenEnrollModal}
            className="btn-emerald-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
          >
            Request Section Enrollment
          </button>
        </div>
      )}

      {/* Join Live Game Quick Bar (Phase P4) */}
      <div className="dashboard-card p-4 sm:p-5 border border-[#10B981]/40 bg-gradient-to-r from-[#10B981]/15 via-[#0E1626] to-[#0A1220] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center text-[#34D399] shrink-0">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              Have a Live Quiz PIN?
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#34D399]/20 text-[#34D399] font-bold border border-[#34D399]/30">Live Multiplayer</span>
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Enter the session PIN from your teacher to join the real-time live assessment.
            </p>
          </div>
        </div>

        <form 
          onSubmit={(e) => { 
            e.preventDefault(); 
            if (joinPinInput.trim() && onJoinLive) {
              onJoinLive(joinPinInput.trim());
            } 
          }} 
          className="flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            maxLength={12}
            value={joinPinInput}
            onChange={(e) => setJoinPinInput(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
            placeholder="e.g. AJM63B17"
            className="w-36 bg-[#0B111D] border border-[#2D436B] focus:border-[#34D399] rounded-xl px-3 py-2 text-xs font-mono font-bold text-center text-white outline-none placeholder:text-[#64748B]"
          />
          <button
            type="submit"
            disabled={!joinPinInput.trim()}
            className="btn-emerald-primary text-xs py-2 px-4 font-bold shadow-md shadow-[#10B981]/20"
          >
            Join Live
          </button>
        </form>
      </div>

      {/* Student Total Reward Points Hero Banner */}
      <div className="dashboard-card p-5 border-2 border-[#10B981]/40 bg-gradient-to-r from-[#10B981]/15 via-[#0E1626] to-[#0A1220] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl shadow-[#10B981]/5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center text-black font-black text-2xl shadow-lg shadow-[#F59E0B]/25 shrink-0">
            <Trophy size={28} className="fill-current text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-[#F59E0B] uppercase tracking-wider">
                Total Reward Points
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#34D399]/20 text-[#34D399] text-[10px] font-bold border border-[#34D399]/30">
                Active Student Score
              </span>
            </div>
            <h2 className="text-3xl font-black text-white font-mono mt-0.5">
              {(analytics?.totalPoints || 0).toLocaleString()} <span className="text-lg font-bold text-[#34D399]">PTS</span>
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Points accumulated from self-paced quizzes &amp; live multiplayer battles.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 md:border-l border-[#1B2A44] pt-3 md:pt-0 md:pl-5">
          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1F304E] text-center min-w-[110px]">
            <p className="text-[10px] text-[#94A3B8] font-semibold">Self-Paced Pts</p>
            <p className="text-base font-black text-[#38BDF8] font-mono">{(analytics?.selfPacedPoints || 0).toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1F304E] text-center min-w-[110px]">
            <p className="text-[10px] text-[#94A3B8] font-semibold">Live Battle Pts</p>
            <p className="text-base font-black text-[#F59E0B] font-mono">{(analytics?.liveBattlePoints || 0).toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1F304E] text-center min-w-[110px]">
            <p className="text-[10px] text-[#94A3B8] font-semibold">Live Battles</p>
            <p className="text-base font-black text-[#10B981] font-mono">{(analytics?.liveSessionsPlayed || 0)}</p>
          </div>
        </div>
      </div>

      {/* Real Performance Analytics Metric Bar */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Quizzes Completed</p>
            <p className="text-2xl font-black text-white font-mono mt-1">{analytics.completedAttempts}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {analytics.passedAttempts} passed
            </p>
          </div>

          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Overall Pass Rate</p>
            <p className="text-2xl font-black text-[#10B981] font-mono mt-1">{analytics.passRate}%</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Across all finished attempts
            </p>
          </div>

          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Average Score</p>
            <p className="text-2xl font-black text-[#38BDF8] font-mono mt-1">{analytics.averageScore}%</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Accurate grading breakdown
            </p>
          </div>

          <div 
            onClick={() => setActiveRoute('mistake-notebook')}
            className="dashboard-card p-4 border border-[#F43F5E]/30 bg-[#140E18] cursor-pointer hover:border-[#F43F5E]/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#FB7185] font-bold uppercase tracking-wider">Mistakes Logged</p>
              <BookMarked size={14} className="text-[#FB7185]" />
            </div>
            <p className="text-2xl font-black text-[#FB7185] font-mono mt-1">{analytics.mistakes?.unresolved || 0}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Click to review & practice &rarr;
            </p>
          </div>

        </div>
      )}

      {/* Primary Learner Navigation Tabs */}
      <div className="flex items-center gap-2 sm:gap-4 border-b border-[#1B2A44] pb-2 overflow-x-auto">
        <button
          onClick={() => setLearnerTab('all')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            learnerTab === 'all'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Layers size={16} />
          All Quizzes ({quizzes.length})
        </button>

        <button
          onClick={() => setLearnerTab('self-paced')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            learnerTab === 'self-paced'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <BookOpen size={16} />
          Self-Paced ({quizzes.length})
        </button>

        <button
          onClick={() => setLearnerTab('live-battles')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            learnerTab === 'live-battles'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Radio size={16} className={liveHistory.length > 0 ? 'text-[#34D399]' : ''} />
          Live Battles (Hosted) ({liveHistory.length})
        </button>

        <button
          onClick={() => setLearnerTab('assessments')}
          className={`pb-2 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            learnerTab === 'assessments'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Calendar size={16} />
          Assessments &amp; Assignments ({assignedTests.length})
        </button>
      </div>

      {/* Discovery Filters Toolbar (Shown for All, Self-Paced, and Assessments) */}
      {['all', 'self-paced', 'assessments'].includes(learnerTab) && (
        <div className="dashboard-card p-4 space-y-3 animate-fadeIn">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search published quizzes by title, subject or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10 text-xs w-full"
              />
            </div>

            {/* Subject Filter */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-field text-xs py-2 px-3 shrink-0 max-w-xs"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Difficulty Filter */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="input-field text-xs py-2 px-3 shrink-0"
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>
      )}

      {/* SECTION 1: ALL QUIZZES */}
      {learnerTab === 'all' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-[#34D399]" />
              All Available Assessments &amp; Quizzes ({quizzes.length})
            </h2>
            <span className="text-xs text-[#64748B] font-mono">Complete catalog</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
              Discovering published assessments...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E] max-w-md mx-auto">
              <BookOpen size={28} className="text-[#64748B] mx-auto" />
              <h3 className="text-base font-bold text-white">No Quizzes Found</h3>
              <p className="text-xs text-[#94A3B8]">
                No quizzes match your search or filter criteria. Check back shortly as instructors publish new content.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quizzes.map((quiz) => {
                const timeLimitMins = quiz.time_limit_sec > 0 ? Math.round(quiz.time_limit_sec / 60) : 0;
                return (
                  <div
                    key={quiz.id}
                    className="dashboard-card p-5 space-y-4 flex flex-col justify-between hover:border-[#34D399] transition-all relative group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="inline-block px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#34D399] font-mono text-[11px] font-bold truncate max-w-[55%]"
                          title={quiz.category}
                        >
                          {quiz.category}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                            Self-Paced
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            quiz.difficulty === 'HARD' ? 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/30' :
                            quiz.difficulty === 'EASY' ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30' :
                            'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30'
                          }`}>
                            {quiz.difficulty}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-[#34D399] transition-colors">
                          {quiz.title}
                        </h3>
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1 leading-relaxed">
                          {quiz.description || 'Comprehensive evaluation assessment.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1B2A44]/60 text-center font-mono">
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Questions</span>
                          <span className="text-xs font-bold text-white">{quiz.question_count || 0}</span>
                        </div>
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Points</span>
                          <span className="text-xs font-bold text-white">{quiz.total_marks || 0}</span>
                        </div>
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Time</span>
                          <span className="text-xs font-bold text-[#38BDF8]">
                            {timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                        <span>By <strong className="text-[#94A3B8]">{quiz.creator_name}</strong></span>
                        <span>Pass: {quiz.pass_percentage}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => onOpenPreview(quiz.id)}
                        className="btn-secondary text-xs py-2 font-semibold gap-1 justify-center"
                      >
                        <Eye size={13} />
                        Preview
                      </button>
                      <button
                        onClick={() => onStartAttempt(quiz.id)}
                        className="btn-emerald-primary text-xs py-2 font-bold gap-1.5 justify-center shadow-lg shadow-[#10B981]/20"
                      >
                        <Play size={13} className="fill-current" />
                        Start Quiz
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SELF-PACED QUIZZES */}
      {learnerTab === 'self-paced' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BookOpen size={16} className="text-[#34D399]" />
                Self-Paced Practice &amp; Exams ({quizzes.length})
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Take tests on your own schedule with individual per-question timers and instant scoring.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
              Loading self-paced quizzes...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E] max-w-md mx-auto">
              <BookOpen size={28} className="text-[#64748B] mx-auto" />
              <h3 className="text-base font-bold text-white">No Self-Paced Quizzes Available</h3>
              <p className="text-xs text-[#94A3B8]">
                Check back shortly as teachers publish new self-paced quizzes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quizzes.map((quiz) => {
                const timeLimitMins = quiz.time_limit_sec > 0 ? Math.round(quiz.time_limit_sec / 60) : 0;
                return (
                  <div
                    key={quiz.id}
                    className="dashboard-card p-5 space-y-4 flex flex-col justify-between hover:border-[#38BDF8] transition-all relative group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="inline-block px-2.5 py-1 rounded-md bg-[#38BDF8]/15 text-[#38BDF8] font-mono text-[11px] font-bold truncate max-w-[65%]"
                          title={quiz.category}
                        >
                          {quiz.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 border ${
                          quiz.difficulty === 'HARD' ? 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/30' :
                          quiz.difficulty === 'EASY' ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30' :
                          'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30'
                        }`}>
                          {quiz.difficulty}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-[#38BDF8] transition-colors">
                          {quiz.title}
                        </h3>
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1 leading-relaxed">
                          {quiz.description || 'Flexible self-paced evaluation.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1B2A44]/60 text-center font-mono">
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Questions</span>
                          <span className="text-xs font-bold text-white">{quiz.question_count || 0}</span>
                        </div>
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Points</span>
                          <span className="text-xs font-bold text-white">{quiz.total_marks || 0}</span>
                        </div>
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Duration</span>
                          <span className="text-xs font-bold text-[#38BDF8]">
                            {timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                        <span>Instructor: <strong className="text-[#94A3B8]">{quiz.creator_name}</strong></span>
                        <span>Pass: {quiz.pass_percentage}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => onOpenPreview(quiz.id)}
                        className="btn-secondary text-xs py-2 font-semibold gap-1 justify-center"
                      >
                        <Eye size={13} />
                        Preview
                      </button>
                      <button
                        onClick={() => onStartAttempt(quiz.id)}
                        className="btn-emerald-primary text-xs py-2 font-bold gap-1.5 justify-center shadow-lg shadow-[#10B981]/20"
                      >
                        <Play size={13} className="fill-current" />
                        Take Self-Paced
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: LIVE BATTLES (HOSTED LIVE MULTIPLAYER) */}
      {learnerTab === 'live-battles' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick PIN Join Card */}
          <div className="dashboard-card p-6 border-2 border-[#10B981]/40 bg-gradient-to-r from-[#10B981]/15 via-[#0E1626] to-[#0A1220] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-[#10B981]/10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center text-[#34D399] shrink-0">
                <Radio size={28} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30">
                    Real-Time Arena
                  </span>
                  <span className="text-xs text-[#94A3B8]">Synchronized Gameplay</span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  Ready for a Live Multiplayer Battle?
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Enter the 8-character Session Join Code from your teacher's screen to enter the arena.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinPinInput.trim() && onJoinLive) {
                  onJoinLive(joinPinInput.trim());
                }
              }}
              className="flex items-center gap-2.5 shrink-0"
            >
              <input
                type="text"
                maxLength={12}
                value={joinPinInput}
                onChange={(e) => setJoinPinInput(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                placeholder="e.g. AJM63B17"
                className="w-40 bg-[#0B111D] border-2 border-[#2D436B] focus:border-[#34D399] rounded-xl px-4 py-2.5 text-sm font-mono font-black text-center text-white outline-none tracking-widest placeholder:text-[#64748B] placeholder:tracking-normal"
              />
              <button
                type="submit"
                disabled={!joinPinInput.trim()}
                className="btn-emerald-primary text-xs py-2.5 px-5 font-bold shadow-lg shadow-[#10B981]/25 flex items-center gap-1.5"
              >
                <Radio size={14} className="animate-pulse" />
                <span>Join Battle</span>
              </button>
            </form>
          </div>

          {/* Participated Live Battles Audit History */}
          <div className="dashboard-card p-6 border border-[#1F304E]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio size={18} className="text-[#34D399]" />
                  My Live Multiplayer Battles History
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Audit log of all synchronized live quiz sessions you joined and competed in.
                </p>
              </div>
              <span className="text-xs font-mono text-[#94A3B8]">
                {liveHistory.length} Battle{liveHistory.length === 1 ? '' : 's'} Logged
              </span>
            </div>

            {liveHistory.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#94A3B8] space-y-3">
                <Radio size={32} className="mx-auto text-[#64748B] opacity-50" />
                <p className="font-semibold text-white">No live multiplayer battles joined yet.</p>
                <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
                  When your instructor hosts a live battle, enter the Session PIN above to compete in real-time!
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-3">
                {liveHistory.map(item => (
                  <div
                    key={item.participation_id}
                    className="p-4 rounded-xl bg-[#0E1626] border border-[#1B2A44] hover:border-[#2D436B] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-white bg-[#0B111D] px-2.5 py-0.5 rounded-lg border border-[#2D436B]">
                          PIN: {item.join_code}
                        </span>
                        <span className="text-[11px] text-[#38BDF8] font-semibold">
                          {item.quiz_category}
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">
                          Host: <strong className="text-white">{item.host_name}</strong>
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white truncate max-w-md">
                        {item.quiz_title}
                      </h4>

                      <p className="text-[11px] text-[#64748B]">
                        Played on {new Date(item.joined_at).toLocaleDateString()} at {new Date(item.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {item.is_flagged ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/40 animate-pulse shrink-0" title={item.flag_reason || 'Flagged for multiple tab switches or window exits'}>
                          🚩 Flagged
                        </span>
                      ) : item.warning_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 shrink-0" title="1 tab switch warning logged">
                          ⚠️ 1 Warning
                        </span>
                      ) : null}

                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            item.rank === 1 ? 'bg-[#F59E0B] text-black shadow-md shadow-[#F59E0B]/30' :
                            item.rank === 2 ? 'bg-[#94A3B8] text-black' :
                            item.rank === 3 ? 'bg-[#D97706] text-white' :
                            'bg-[#1F304E] text-[#94A3B8]'
                          }`}>
                            #{item.rank || '-'}
                          </span>
                          <span className="font-mono font-black text-white text-base">
                            {item.score} <span className="text-xs font-bold text-[#34D399]">pts</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          {item.correct_count} of {item.total_questions || 0} Correct
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: ASSESSMENTS & ASSIGNMENTS */}
      {learnerTab === 'assessments' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} className="text-[#F59E0B]" />
                Scheduled Assessments &amp; Assignments ({assignedTests.length})
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Official course evaluations and assigned cohort assessments from your instructors.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
              Loading your assigned assessments...
            </div>
          ) : assignedTests.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E] max-w-md mx-auto">
              <Calendar size={28} className="text-[#64748B] mx-auto" />
              <h3 className="text-base font-bold text-white">No Scheduled Assessments</h3>
              <p className="text-xs text-[#94A3B8]">
                You currently have no pending homework or cohort assessments. Your teachers will assign assessments to your section or class.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {assignedTests.map((item) => {
                const timeLimitMins = item.time_limit_sec > 0 ? Math.round(item.time_limit_sec / 60) : 0;
                const isSubmitted = item.recipient_status === 'SUBMITTED' || item.recipient_status === 'LATE';
                const isOverdue = item.isOverdue && !isSubmitted;

                return (
                  <div
                    key={item.recipient_id}
                    className={`dashboard-card p-5 space-y-4 flex flex-col justify-between transition-all relative group ${
                      isOverdue ? 'border-[#F43F5E]/60 hover:border-[#F43F5E]' :
                      isSubmitted ? 'border-[#10B981]/60 hover:border-[#34D399]' :
                      'border-[#F59E0B]/50 hover:border-[#F59E0B]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="inline-block px-2.5 py-1 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] font-mono text-[11px] font-bold truncate max-w-[55%]"
                          title={item.quiz_category}
                        >
                          {item.quiz_category}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.is_flagged ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/40">
                              🚩 Flagged
                            </span>
                          ) : null}

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isSubmitted ? 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/40' :
                            isOverdue ? 'bg-[#F43F5E]/20 text-[#FB7185] border-[#F43F5E]/40' :
                            item.recipient_status === 'STARTED' ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/40' :
                            'bg-[#F59E0B]/20 text-[#FBBF24] border-[#F59E0B]/40'
                          }`}>
                            {isSubmitted ? `✓ Done (${Math.round(item.score_percentage || 0)}%)` :
                             isOverdue ? '⚠️ Overdue' :
                             item.recipient_status === 'STARTED' ? '⏳ In Progress' :
                             '📅 Assigned'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-[#F59E0B] transition-colors">
                          {item.assignment_title}
                        </h3>
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1 leading-relaxed">
                          {item.instructions || item.quiz_description || 'Mandatory scheduled course assessment.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1B2A44]/60 text-center font-mono">
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Due Date</span>
                          <span className={`text-xs font-bold ${isOverdue ? 'text-[#FB7185]' : 'text-white'}`}>
                            {item.due_date ? new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No Deadline'}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-[#121D32]">
                          <span className="text-[10px] text-[#64748B] block">Time Limit</span>
                          <span className="text-xs font-bold text-[#F59E0B]">
                            {timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                        <span>Instructor: <strong className="text-[#94A3B8]">{item.teacher_name}</strong></span>
                        <span className="text-[#38BDF8]">{item.quiz_difficulty}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => onOpenPreview(item.quiz_id)}
                        className="btn-secondary text-xs py-2 font-semibold gap-1 justify-center"
                      >
                        <Eye size={13} />
                        Preview
                      </button>

                      {isSubmitted ? (
                        <button
                          onClick={() => setActiveRoute('attempt-history')}
                          className="btn-secondary text-xs py-2 font-bold gap-1.5 justify-center border-[#10B981]/50 text-[#34D399]"
                        >
                          <History size={13} />
                          Scorecard
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartAttempt(item.quiz_id)}
                          className="btn-emerald-primary text-xs py-2 font-bold gap-1.5 justify-center bg-[#F59E0B] hover:bg-[#D97706] text-black border-none shadow-lg shadow-[#F59E0B]/20"
                        >
                          <Play size={13} className="fill-current text-black" />
                          Start Test
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Student Request Section Enrollment Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0E1626] border border-[#1B2A44] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap size={18} className="text-[#38BDF8]" />
                Request Section Enrollment
              </h3>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-[#64748B] hover:text-white"
              >
                &times;
              </button>
            </div>

            {enrollSuccessMsg ? (
              <div className="p-4 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-center space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-[#10B981]" />
                <p className="text-xs font-bold text-white">{enrollSuccessMsg}</p>
                <p className="text-[11px] text-[#94A3B8]">Your section teacher and organization admins have been notified.</p>
              </div>
            ) : (
              <form onSubmit={handleRequestEnrollment} className="space-y-4">
                <p className="text-xs text-[#94A3B8]">
                  Select the class and section you are attending. Once submitted, your teacher or organization admin will verify and activate your enrollment.
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5 uppercase font-mono">
                    Select Section / Cohort *
                  </label>
                  <select
                    required
                    value={enrollForm.section_id}
                    onChange={(e) => setEnrollForm({ ...enrollForm, section_id: e.target.value })}
                    className="input-field text-xs py-2 w-full"
                  >
                    <option value="">-- Choose Section --</option>
                    {instSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} ({sec.class_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5 uppercase font-mono">
                    Student Roll / ID Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={enrollForm.roll_number}
                    onChange={(e) => setEnrollForm({ ...enrollForm, roll_number: e.target.value })}
                    placeholder="e.g. ROLL-2026-042"
                    className="input-field text-xs py-2 w-full"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEnrollModal(false)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={enrollSubmitting}
                    className="btn-emerald-primary text-xs py-2 px-5 font-bold"
                  >
                    {enrollSubmitting ? 'Submitting...' : 'Submit Request'}
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