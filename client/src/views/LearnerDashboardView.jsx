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
  Calendar,
  RotateCw,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

export default function LearnerDashboardView({ onStartAttempt, onJoinLive, setActiveRoute }) {
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

  // Wayground / Kahoot Study Mode: Interactive Flashcards
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcardQuizTitle, setFlashcardQuizTitle] = useState('');
  const [flashcardList, setFlashcardList] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [flashcardLoading, setFlashcardLoading] = useState(false);

  const handleOpenFlashcards = async (quiz) => {
    const targetQuiz = quiz || quizzes[0];
    if (!targetQuiz) {
      alert('Please select or wait for a quiz to load flashcards.');
      return;
    }
    setFlashcardQuizTitle(targetQuiz.title || 'Assessment Practice');
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setShowFlashcards(true);
    setFlashcardLoading(true);

    try {
      const res = await fetch(`/api/v1/quizzes/${targetQuiz.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success && data.data?.quiz?.questions && data.data.quiz.questions.length > 0) {
        setFlashcardList(data.data.quiz.questions);
      } else {
        setFlashcardList([
          {
            question_text: targetQuiz.title,
            category: targetQuiz.category,
            difficulty: targetQuiz.difficulty,
            marks: targetQuiz.total_marks,
            explanation: targetQuiz.description || 'Review the core topics of this assessment in your course materials.',
            options: []
          }
        ]);
      }
    } catch (e) {
      console.error('Failed to load flashcards', e);
    } finally {
      setFlashcardLoading(false);
    }
  };

    const handleShuffleDeck = () => {
    if (flashcardList.length <= 1) return;
    const shuffled = [...flashcardList].sort(() => Math.random() - 0.5);
    setFlashcardList(shuffled);
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
  };

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

  const isStudent = user?.role === 'STUDENT' || user?.role === 'LEARNER';

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
      
      {/* Top Header & Quick Actions */}
      <div className="pb-6 border-b border-[#1E2D4A] flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-xs text-[#34D399] font-bold tracking-wider uppercase">
              Learner Arena &bull; Assessment Portal
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <GraduationCap className="text-[#34D399]" size={30} />
            Assessment Hub
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1.5">
            Welcome back, <strong className="text-white font-semibold">{user?.name}</strong> &bull; Practice self-paced quizzes, review mistake corrections, and join live competitions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveRoute('attempt-history')}
            className="btn-secondary text-xs py-2.5 px-4 font-semibold gap-2"
          >
            <History size={15} className="text-[#38BDF8]" />
            Past Attempts
          </button>

          <button
            onClick={() => setActiveRoute('mistake-notebook')}
            className="btn-secondary text-xs py-2.5 px-4 font-semibold gap-2 text-[#34D399] border-[#34D399]/30 hover:border-[#34D399]/60"
          >
            <BookMarked size={15} />
            Mistake Notebook
            {analytics?.mistakes?.unresolved > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#F43F5E] text-white text-[10px] font-bold shadow-sm">
                {analytics.mistakes.unresolved}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Institutional Enrollment Status Banner (Full-Width - Fix for img1) */}
      {enrollment && enrollment.status === 'ACTIVE' ? (
        <div className="w-full dashboard-card p-4 px-6 bg-[#0E172A] border border-[#38BDF8]/40 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md rounded-2xl">
          <div className="flex items-center gap-3.5">
            <span className="w-3 h-3 rounded-full bg-[#10B981] animate-pulse shrink-0" />
            <div>
              <span className="font-extrabold text-white text-sm tracking-wide">{enrollment.organization_name}</span>
              <p className="text-[11px] text-[#94A3B8] font-medium mt-0.5">Enrolled Academic Institution</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-[#14233D] border border-[#233B66] text-[#38BDF8] font-bold text-xs flex items-center gap-2">
              <GraduationCap size={15} />
              <span>{enrollment.class_name} &bull; Section {enrollment.section_name}</span>
            </div>
            {enrollment.roll_number && (
              <div className="px-3.5 py-1.5 rounded-xl bg-[#09111E] border border-[#1E2E4A] font-mono text-xs text-[#A7F3D0] font-bold">
                Roll: <strong>{enrollment.roll_number}</strong>
              </div>
            )}
          </div>
        </div>
      ) : enrollment && enrollment.status === 'PENDING' ? (
        <div className="w-full dashboard-card p-4 px-6 bg-[#F59E0B]/10 border border-[#F59E0B]/40 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#F59E0B] animate-ping shrink-0" />
            <div>
              <span className="font-bold text-[#FBBF24] text-sm">Enrollment Pending Instructor / Admin Approval</span>
              <p className="text-[11px] text-[#CBD5E1] mt-0.5">
                Your request to join section <strong className="text-white">{enrollment.section_name}</strong> ({enrollment.class_name}) is awaiting teacher verification.
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1 text-xs font-bold rounded-full bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/30">
            Awaiting Verification
          </span>
        </div>
      ) : (
        <div className="w-full dashboard-card p-4 px-6 bg-[#0E172A] border border-[#1E2E4A] flex flex-wrap items-center justify-between gap-4 text-xs rounded-2xl">
          <div className="flex items-center gap-3 text-[#94A3B8]">
            <GraduationCap size={18} className="text-[#38BDF8] shrink-0" />
            <span>Not currently enrolled in an academic section? Join your college section to access official assessments.</span>
          </div>
          <button
            onClick={handleOpenEnrollModal}
            className="btn-emerald-primary text-xs py-2 px-4 font-bold flex items-center gap-2"
          >
            Request Section Enrollment
          </button>
        </div>
      )}

      {/* Balanced 2-Column Hero Section: Reward Points + Live Multiplayer PIN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column (7 cols): Calm Reward Points & Progress */}
        <div className="lg:col-span-7 dashboard-card p-6 border border-[#1E2D4A] bg-gradient-to-r from-[#0E172A] to-[#0A1220] flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center text-white shadow-lg shadow-[#F59E0B]/20 shrink-0">
                <Trophy size={26} className="fill-current" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#F59E0B] tracking-wider uppercase">
                  Total Reward Points
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h2 className="text-3xl font-black text-white font-mono">
                    {(analytics?.totalPoints || 0).toLocaleString()}
                  </h2>
                  <span className="text-sm font-bold text-[#34D399]">PTS</span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Accumulated from completed quizzes and live session participation.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#1E2D4A]/70">
            <div className="p-3 rounded-xl bg-[#111A2E] border border-[#1C2C4A] text-center">
              <span className="text-[11px] text-[#94A3B8] block">Self-Paced</span>
              <span className="text-sm font-bold text-[#38BDF8] font-mono mt-0.5 block">
                {(analytics?.selfPacedPoints || 0).toLocaleString()} pts
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#111A2E] border border-[#1C2C4A] text-center">
              <span className="text-[11px] text-[#94A3B8] block">Live Battles</span>
              <span className="text-sm font-bold text-[#F59E0B] font-mono mt-0.5 block">
                {(analytics?.liveBattlePoints || 0).toLocaleString()} pts
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#111A2E] border border-[#1C2C4A] text-center">
              <span className="text-[11px] text-[#94A3B8] block">Sessions Played</span>
              <span className="text-sm font-bold text-[#10B981] font-mono mt-0.5 block">
                {(analytics?.liveSessionsPlayed || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Multiplayer PIN Quick Access */}
        <div className="lg:col-span-5 dashboard-card p-6 border border-[#10B981]/30 bg-gradient-to-br from-[#0F1E2E] to-[#0A1220] flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#34D399] shrink-0">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Join Live Quiz
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#34D399]/20 text-[#34D399] font-bold border border-[#34D399]/30">
                  Real-Time
                </span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Have a session PIN from your teacher? Join now.
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
            className="flex items-center gap-2.5 pt-2"
          >
            <input
              type="text"
              maxLength={12}
              value={joinPinInput}
              onChange={(e) => setJoinPinInput(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
              placeholder="ENTER PIN (e.g. AJM63B17)"
              className="flex-1 bg-[#090F1A] border border-[#243656] focus:border-[#34D399] rounded-xl px-4 py-2.5 text-xs font-mono font-bold tracking-wider text-center text-white outline-none placeholder:text-[#64748B]"
            />
            <button
              type="submit"
              disabled={!joinPinInput.trim()}
              className="btn-emerald-primary text-xs py-2.5 px-5 font-bold shadow-md shadow-[#10B981]/20 shrink-0"
            >
              Join
            </button>
          </form>
        </div>

      </div>

      {/* Real Performance Analytics Metric Bar (Clean, Spacious 4-Card Grid) */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          
          <div className="dashboard-card p-5 border border-[#1E2D4A] space-y-1">
            <p className="text-xs text-[#94A3B8] font-semibold tracking-wide">Quizzes Completed</p>
            <p className="text-2xl font-black text-white font-mono">{analytics.completedAttempts}</p>
            <p className="text-xs text-[#64748B]">
              {analytics.passedAttempts} passed
            </p>
          </div>

          <div className="dashboard-card p-5 border border-[#1E2D4A] space-y-1">
            <p className="text-xs text-[#94A3B8] font-semibold tracking-wide">Overall Pass Rate</p>
            <p className="text-2xl font-black text-[#10B981] font-mono">{analytics.passRate}%</p>
            <p className="text-xs text-[#64748B]">
              Across all completed attempts
            </p>
          </div>

          <div className="dashboard-card p-5 border border-[#1E2D4A] space-y-1">
            <p className="text-xs text-[#94A3B8] font-semibold tracking-wide">Average Score</p>
            <p className="text-2xl font-black text-[#38BDF8] font-mono">{analytics.averageScore}%</p>
            <p className="text-xs text-[#64748B]">
              Cumulative score average
            </p>
          </div>

          <div 
            onClick={() => setActiveRoute('mistake-notebook')}
            className="dashboard-card p-5 border border-[#F43F5E]/30 bg-[#140E18] cursor-pointer hover:border-[#F43F5E]/60 transition-colors space-y-1"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#FB7185] font-semibold tracking-wide">Mistakes Logged</p>
              <BookMarked size={15} className="text-[#FB7185]" />
            </div>
            <p className="text-2xl font-black text-[#FB7185] font-mono">{analytics.mistakes?.unresolved || 0}</p>
            <p className="text-xs text-[#94A3B8]">
              Review &amp; practice mistakes &rarr;
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

      {/* Discovery Filters Toolbar (Modern, Full-Width - Fix for img2) */}
      {['all', 'self-paced', 'assessments'].includes(learnerTab) && (
        <div className="dashboard-card p-4 sm:p-5 border border-[#1E2D4A] bg-[#0E172A] shadow-md rounded-2xl animate-fadeIn space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3.5">
            {/* Search Input Box */}
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#38BDF8]" />
              <input
                type="text"
                placeholder="Search assessments by quiz title, subject or instructor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0A111E] border border-[#233554] focus:border-[#38BDF8] rounded-xl pl-11 pr-10 py-2.5 text-xs text-white placeholder:text-[#64748B] outline-none transition-colors shadow-inner"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white text-xs p-1"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns & Quick Flashcards Mode Button */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
              {/* Subject Filter */}
              <div className="relative w-full sm:w-48">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-[#0A111E] border border-[#233554] focus:border-[#38BDF8] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer transition-colors"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Difficulty Filter */}
              <div className="relative w-full sm:w-36">
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full bg-[#0A111E] border border-[#233554] focus:border-[#38BDF8] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer transition-colors"
                >
                  <option value="">All Levels</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              {/* Wayground / Quizlet Style Interactive Flashcard Mode CTA */}
              <button
                onClick={() => handleOpenFlashcards(quizzes[0])}
                disabled={quizzes.length === 0}
                className="btn-secondary text-xs py-2.5 px-4 font-bold flex items-center gap-2 text-[#38BDF8] border-[#38BDF8]/40 hover:border-[#38BDF8] shrink-0"
                title="Practice terms and questions with interactive flip cards"
              >
                <span>🗂️ Flashcards</span>
              </button>

              {(search || selectedSubject || selectedDifficulty) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedSubject('');
                    setSelectedDifficulty('');
                  }}
                  className="text-xs text-[#FB7185] hover:text-white px-2 py-2 font-semibold transition-colors shrink-0"
                  title="Reset all filters"
                >
                  Reset
                </button>
              )}
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => {
                const timeLimitMins = quiz.time_limit_sec > 0 ? Math.round(quiz.time_limit_sec / 60) : 0;
                return (
                  <div
                    key={quiz.id}
                    className="dashboard-card p-6 space-y-5 flex flex-col justify-between hover:border-[#34D399] transition-all relative group shadow-sm hover:shadow-lg hover:shadow-[#10B981]/5"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="inline-block px-3 py-1 rounded-lg bg-[#10B981]/15 text-[#34D399] font-mono text-xs font-bold truncate max-w-[55%]"
                          title={quiz.category}
                        >
                          {quiz.category}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                            Self-Paced
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase border ${
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
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1.5 leading-relaxed">
                          {quiz.description || 'Comprehensive evaluation assessment.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[#1E2D4A]/70 text-center font-mono">
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Questions</span>
                          <span className="text-xs font-bold text-white">{quiz.question_count || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Points</span>
                          <span className="text-xs font-bold text-white">{quiz.total_marks || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Time</span>
                          <span className="text-xs font-bold text-[#38BDF8]">
                            {timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                        <span>By <strong className="text-[#94A3B8]">{quiz.creator_name}</strong></span>
                        <span>Pass: {quiz.pass_percentage}%</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      {quiz.max_attempts > 0 && (quiz.user_attempt_count || 0) >= quiz.max_attempts ? (
                        <button
                          disabled
                          className="w-full btn-secondary opacity-60 text-xs py-2.5 font-bold justify-center cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700"
                        >
                          Attempted ({quiz.user_attempt_count}/{quiz.max_attempts})
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenFlashcards(quiz)}
                            className="btn-secondary text-xs py-2.5 px-3 font-semibold text-[#38BDF8] border-[#38BDF8]/40 hover:border-[#38BDF8] hover:bg-[#38BDF8]/10 shrink-0 transition-colors"
                            title="Study as Flashcards"
                          >
                            🗂️ Cards
                          </button>
                          <button
                            onClick={() => onStartAttempt(quiz.id)}
                            className="flex-1 btn-emerald-primary text-xs py-2.5 font-bold gap-2 justify-center shadow-lg shadow-[#10B981]/20"
                          >
                            <Play size={14} className="fill-current" />
                            Start Quiz
                          </button>
                        </div>
                      )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => {
                const timeLimitMins = quiz.time_limit_sec > 0 ? Math.round(quiz.time_limit_sec / 60) : 0;
                return (
                  <div
                    key={quiz.id}
                    className="dashboard-card p-6 space-y-5 flex flex-col justify-between hover:border-[#38BDF8] transition-all relative group shadow-sm hover:shadow-lg hover:shadow-[#38BDF8]/5"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="inline-block px-3 py-1 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] font-mono text-xs font-bold truncate max-w-[65%]"
                          title={quiz.category}
                        >
                          {quiz.category}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase shrink-0 border ${
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
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1.5 leading-relaxed">
                          {quiz.description || 'Flexible self-paced evaluation.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[#1E2D4A]/70 text-center font-mono">
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Questions</span>
                          <span className="text-xs font-bold text-white">{quiz.question_count || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Points</span>
                          <span className="text-xs font-bold text-white">{quiz.total_marks || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Duration</span>
                          <span className="text-xs font-bold text-[#38BDF8]">
                            {timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                        <span>Instructor: <strong className="text-[#94A3B8]">{quiz.creator_name}</strong></span>
                        <span>Pass: {quiz.pass_percentage}%</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      {quiz.max_attempts > 0 && (quiz.user_attempt_count || 0) >= quiz.max_attempts ? (
                        <button
                          disabled
                          className="w-full btn-secondary opacity-60 text-xs py-2.5 font-bold justify-center cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700"
                        >
                          Attempted ({quiz.user_attempt_count}/{quiz.max_attempts})
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenFlashcards(quiz)}
                            className="btn-secondary text-xs py-2.5 px-3 font-semibold text-[#38BDF8] border-[#38BDF8]/40 hover:border-[#38BDF8] hover:bg-[#38BDF8]/10 shrink-0 transition-colors"
                            title="Study as Flashcards"
                          >
                            🗂️ Cards
                          </button>
                          <button
                            onClick={() => onStartAttempt(quiz.id)}
                            className="flex-1 btn-emerald-primary text-xs py-2.5 font-bold gap-2 justify-center shadow-lg shadow-[#10B981]/20"
                          >
                            <Play size={14} className="fill-current" />
                            Take Self-Paced
                          </button>
                        </div>
                      )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedTests.map((item) => {
                const timeLimitMins = item.time_limit_sec > 0 ? Math.round(item.time_limit_sec / 60) : 0;
                const isSubmitted = item.recipient_status === 'SUBMITTED' || item.recipient_status === 'LATE';
                const isOverdue = item.isOverdue && !isSubmitted;

                return (
                  <div
                    key={item.recipient_id}
                    className={`dashboard-card p-6 space-y-5 flex flex-col justify-between transition-all relative group shadow-sm hover:shadow-lg ${
                      isOverdue ? 'border-[#F43F5E]/60 hover:border-[#F43F5E] hover:shadow-[#F43F5E]/5' :
                      isSubmitted ? 'border-[#10B981]/60 hover:border-[#34D399] hover:shadow-[#10B981]/5' :
                      'border-[#F59E0B]/50 hover:border-[#F59E0B] hover:shadow-[#F59E0B]/5'
                    }`}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span 
                          className="inline-block px-3 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] font-mono text-xs font-bold truncate max-w-[55%]"
                          title={item.quiz_category}
                        >
                          {item.quiz_category}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.is_flagged ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/40">
                              🚩 Flagged
                            </span>
                          ) : null}

                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase border ${
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
                        <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1.5 leading-relaxed">
                          {item.instructions || item.quiz_description || 'Mandatory scheduled course assessment.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#1E2D4A]/70 text-center font-mono">
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Due Date</span>
                          <span className={`text-xs font-bold ${isOverdue ? 'text-[#FB7185]' : 'text-white'}`}>
                            {item.due_date ? new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No Deadline'}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#111A2E] border border-[#1C2C4A]">
                          <span className="text-[11px] text-[#64748B] block">Time Limit</span>
                          <span className="text-xs font-bold text-[#F59E0B]">
                            {timeLimitMins > 0 ? `${timeLimitMins}m` : 'Untimed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                        <span>Instructor: <strong className="text-[#94A3B8]">{item.teacher_name}</strong></span>
                        <span className="text-[#38BDF8]">{item.quiz_difficulty}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      {isSubmitted ? (
                        <button
                          onClick={() => setActiveRoute('attempt-history')}
                          className="w-full btn-secondary text-xs py-2.5 font-bold gap-2 justify-center border-[#10B981]/50 text-[#34D399]"
                        >
                          <History size={14} />
                          Scorecard
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartAttempt(item.quiz_id)}
                          className="w-full btn-emerald-primary text-xs py-2.5 font-bold gap-2 justify-center bg-[#F59E0B] hover:bg-[#D97706] text-black border-none shadow-lg shadow-[#F59E0B]/20"
                        >
                          <Play size={14} className="fill-current text-black" />
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

            {/* Wayground / Quizlet Style Interactive Study Flashcards Modal */}
      {showFlashcards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B132B] border border-[#1E293B] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#0F172A]/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-lg">
                  🗂️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">
                    Interactive Study Flashcards
                  </h3>
                  <p className="text-[11px] text-[#38BDF8] font-mono line-clamp-1">
                    {flashcardQuizTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFlashcards(false)}
                className="w-8 h-8 rounded-lg bg-[#1E293B]/60 hover:bg-[#1E293B] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Deck Progress Bar */}
            {flashcardList.length > 0 && (
              <div className="w-full bg-[#1E293B] h-1.5">
                <div 
                  className="bg-gradient-to-r from-[#38BDF8] to-[#10B981] h-1.5 transition-all duration-300"
                  style={{ width: `${((currentCardIdx + 1) / flashcardList.length) * 100}%` }}
                />
              </div>
            )}

            {/* Content Area */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[380px]">
              {flashcardLoading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-[#94A3B8]">
                  <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Loading flashcards deck...</p>
                </div>
              ) : flashcardList.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <p className="text-sm font-semibold text-white">No flashcard questions available for this quiz yet.</p>
                  <p className="text-xs text-[#94A3B8]">Questions will appear as soon as the instructor adds them.</p>
                </div>
              ) : (
                <div className="w-full max-w-lg space-y-4">
                  {/* Card Flip Container */}
                  <div 
                    onClick={() => setIsCardFlipped(!isCardFlipped)}
                    className="cursor-pointer transition-all duration-300 transform active:scale-[0.99] group"
                  >
                    <div className={`p-7 rounded-2xl border min-h-[260px] flex flex-col justify-between transition-all duration-300 shadow-xl ${
                      isCardFlipped 
                        ? 'bg-gradient-to-br from-[#064E3B]/40 via-[#0B1E2E] to-[#0A1628] border-[#10B981]/50 shadow-[#10B981]/10' 
                        : 'bg-gradient-to-br from-[#1E293B]/70 via-[#0F172A] to-[#0A111E] border-[#38BDF8]/40 hover:border-[#38BDF8] shadow-[#38BDF8]/10'
                    }`}>
                      
                      {/* Card Top Tag */}
                      <div className="flex items-center justify-between text-[11px] pb-3 border-b border-white/10">
                        <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCardFlipped ? 'bg-[#10B981]/20 text-[#34D399]' : 'bg-[#38BDF8]/20 text-[#38BDF8]'
                        }`}>
                          {isCardFlipped ? '✓ Answer & Solution' : `Card ${currentCardIdx + 1} of ${flashcardList.length}`}
                        </span>
                        <span className="text-[11px] text-[#94A3B8] flex items-center gap-1 font-mono">
                          <RotateCw size={12} className="text-[#38BDF8] group-hover:rotate-180 transition-transform duration-500" />
                          Click to {isCardFlipped ? 'view question' : 'flip answer'}
                        </span>
                      </div>

                      {/* Card Center Content */}
                      <div className="py-4 flex-1 flex flex-col justify-center">
                        {!isCardFlipped ? (
                          <div className="space-y-4">
                            <h4 className="text-base font-bold text-white leading-relaxed">
                              {flashcardList[currentCardIdx]?.question_text}
                            </h4>
                            {flashcardList[currentCardIdx]?.options && flashcardList[currentCardIdx].options.length > 0 && (
                              <div className="space-y-1.5 pt-2">
                                {flashcardList[currentCardIdx].options.map((opt, oIdx) => (
                                  <div key={oIdx} className="text-xs py-1.5 px-3 rounded-lg bg-[#0F172A]/70 border border-[#1E293B] text-[#94A3B8]">
                                    <span className="font-bold text-white mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                                    {opt.option_text || opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30">
                              <p className="text-xs font-bold text-[#34D399] uppercase tracking-wide">Correct Answer</p>
                              <p className="text-sm font-semibold text-white mt-1">
                                {(() => {
                                  const card = flashcardList[currentCardIdx];
                                  if (card?.options && card.options.length > 0) {
                                    const correct = card.options.find(o => o.is_correct || o.isCorrect);
                                    if (correct) return correct.option_text || correct;
                                  }
                                  return card?.correct_answer || 'Refer to explanation below';
                                })()}
                              </p>
                            </div>
                            {flashcardList[currentCardIdx]?.explanation && (
                              <div className="pt-2">
                                <p className="text-[11px] font-bold text-[#94A3B8] uppercase">Pedagogical Explanation:</p>
                                <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed bg-[#0A111E]/60 p-3 rounded-xl border border-white/5">
                                  {flashcardList[currentCardIdx].explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Bottom Meta */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>Category: <strong className="text-[#94A3B8]">{flashcardList[currentCardIdx]?.category || 'General'}</strong></span>
                        <span>Marks: <strong className="text-[#10B981]">{flashcardList[currentCardIdx]?.marks || 1} pt</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Card Navigation Controls */}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      onClick={() => {
                        if (currentCardIdx > 0) {
                          setCurrentCardIdx(currentCardIdx - 1);
                          setIsCardFlipped(false);
                        }
                      }}
                      disabled={currentCardIdx === 0}
                      className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                        className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-[#38BDF8] border-[#38BDF8]/40 hover:border-[#38BDF8]"
                      >
                        <RotateCw size={13} />
                        <span>Flip Card</span>
                      </button>

                      <button
                        onClick={handleShuffleDeck}
                        className="btn-secondary text-xs py-2 px-3 flex items-center gap-1 text-[#F59E0B] border-[#F59E0B]/30 hover:border-[#F59E0B]"
                        title="Randomize card order"
                      >
                        <Shuffle size={13} />
                        <span className="hidden sm:inline">Shuffle</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if (currentCardIdx < flashcardList.length - 1) {
                          setCurrentCardIdx(currentCardIdx + 1);
                          setIsCardFlipped(false);
                        }
                      }}
                      disabled={currentCardIdx >= flashcardList.length - 1}
                      className="btn-emerald-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#1E293B] bg-[#0A111E] flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Wayground / Quizlet Style Practice</span>
              <button
                onClick={() => setShowFlashcards(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Done Practicing
              </button>
            </div>

          </div>
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