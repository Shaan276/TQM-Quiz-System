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
  Radio
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
              Enter the 6-digit session PIN from your teacher to join the real-time live assessment.
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
            maxLength={8}
            value={joinPinInput}
            onChange={(e) => setJoinPinInput(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
            placeholder="6-Digit PIN"
            className="w-32 bg-[#0B111D] border border-[#2D436B] focus:border-[#34D399] rounded-xl px-3 py-2 text-xs font-mono font-bold text-center text-white outline-none placeholder:text-[#64748B]"
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

      {/* Discovery Filters Toolbar */}
      <div className="dashboard-card p-4 space-y-3">
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

      {/* Published Quizzes Discovery Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BookOpen size={16} className="text-[#34D399]" />
            Available Assessments ({quizzes.length})
          </h2>
          <span className="text-xs text-[#64748B] font-mono">Real-time taking enabled</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
            Discovering published assessments...
          </div>
        ) : quizzes.length === 0 ? (
          <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E] max-w-md mx-auto">
            <BookOpen size={28} className="text-[#64748B] mx-auto" />
            <h3 className="text-base font-bold text-white">No Published Quizzes Found</h3>
            <p className="text-xs text-[#94A3B8]">
              No active quizzes match your search or filter criteria. Check back shortly as instructors publish new content.
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
                    
                    {/* Top Badges */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] font-mono font-bold">
                        {quiz.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        quiz.difficulty === 'HARD' ? 'bg-[#F43F5E]/20 text-[#FB7185]' :
                        quiz.difficulty === 'EASY' ? 'bg-[#10B981]/20 text-[#34D399]' :
                        'bg-[#F59E0B]/20 text-[#FBBF24]'
                      }`}>
                        {quiz.difficulty}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-[#34D399] transition-colors">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1 leading-relaxed">
                        {quiz.description || 'Self-paced evaluation.'}
                      </p>
                    </div>

                    {/* Stats pills */}
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

                  {/* Actions */}
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
                      Take Quiz
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}