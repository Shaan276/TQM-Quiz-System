import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  HelpCircle,
  Filter,
  Search,
  Award,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Flame,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FolderKanban,
  Target,
  Percent
} from 'lucide-react';

export default function TeacherInsightsView({ onNavigateToQuizStudio }) {
  const { accessToken } = useAuth();

  // Active view sub-tab: 'overview' | 'questions' | 'students' | 'sections'
  const [activeTab, setActiveTab] = useState('overview');

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Overview metrics state
  const [overviewData, setOverviewData] = useState(null);

  // Filters state
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Questions analysis state
  const [questionsData, setQuestionsData] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [qSortBy, setQSortBy] = useState('lowest_accuracy');
  const [qDifficulty, setQDifficulty] = useState('');
  const [qType, setQType] = useState('');
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // Students roster state
  const [studentsData, setStudentsData] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Section comparison state
  const [sectionsData, setSectionsData] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // 1. Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (selectedQuizId) params.append('quizId', selectedQuizId);
      if (selectedSectionId) params.append('sectionId', selectedSectionId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/v1/analytics/teacher/insights/overview?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const json = await res.json();
      if (json.success) {
        setOverviewData(json.data);
      } else {
        setErrorMsg(json.error?.message || 'Failed to load insights overview');
      }
    } catch (err) {
      setErrorMsg('Network error fetching assessment insights');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedQuizId, selectedSectionId, startDate, endDate]);

  // 2. Fetch Questions Data
  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const params = new URLSearchParams();
      if (selectedQuizId) params.append('quizId', selectedQuizId);
      if (qSortBy) params.append('sortBy', qSortBy);
      if (qDifficulty) params.append('difficulty', qDifficulty);
      if (qType) params.append('type', qType);

      const res = await fetch(`/api/v1/analytics/teacher/insights/questions?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const json = await res.json();
      if (json.success) {
        setQuestionsData(json.data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load question analytics', err);
    } finally {
      setLoadingQuestions(false);
    }
  }, [accessToken, selectedQuizId, qSortBy, qDifficulty, qType]);

  // 3. Fetch Students Data
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      if (selectedQuizId) params.append('quizId', selectedQuizId);
      if (selectedSectionId) params.append('sectionId', selectedSectionId);
      if (studentSearch) params.append('search', studentSearch);

      const res = await fetch(`/api/v1/analytics/teacher/insights/students?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const json = await res.json();
      if (json.success) {
        setStudentsData(json.data.students || []);
      }
    } catch (err) {
      console.error('Failed to load student insights', err);
    } finally {
      setLoadingStudents(false);
    }
  }, [accessToken, selectedQuizId, selectedSectionId, studentSearch]);

  // 4. Fetch Sections Data
  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    try {
      const res = await fetch(`/api/v1/analytics/teacher/insights/sections`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const json = await res.json();
      if (json.success) {
        setSectionsData(json.data.sections || []);
      }
    } catch (err) {
      console.error('Failed to load section comparison', err);
    } finally {
      setLoadingSections(false);
    }
  }, [accessToken]);

  // Initial load
  useEffect(() => {
    if (accessToken) {
      fetchOverview();
    }
  }, [fetchOverview, accessToken]);

  // Load tab-specific data on tab change
  useEffect(() => {
    if (!accessToken) return;
    if (activeTab === 'questions') {
      fetchQuestions();
    } else if (activeTab === 'students') {
      fetchStudents();
    } else if (activeTab === 'sections') {
      fetchSections();
    }
  }, [activeTab, accessToken, fetchQuestions, fetchStudents, fetchSections]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      
      {/* Top Header */}
      <div className="pb-4 border-b border-[#1B2A44] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[10px] text-[#34D399] font-bold tracking-widest uppercase">
              TQM Analytics &amp; Assessment Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5 mt-1">
            <BarChart3 className="text-[#38BDF8]" size={26} />
            Advanced Assessment Insights
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Authoritative question-level analytics, distractor analysis, student mastery tracking, and section comparisons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchOverview();
              if (activeTab === 'questions') fetchQuestions();
              if (activeTab === 'students') fetchStudents();
              if (activeTab === 'sections') fetchSections();
            }}
            className="btn-secondary text-xs py-2 px-3 font-semibold flex items-center gap-1.5"
            title="Refresh analytics data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="dashboard-card p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#CBD5E1]">
          <span className="flex items-center gap-2">
            <Filter size={15} className="text-[#38BDF8]" />
            Scoping &amp; Assessment Filters
          </span>
          {(selectedQuizId || selectedSectionId || startDate || endDate) && (
            <button
              onClick={() => {
                setSelectedQuizId('');
                setSelectedSectionId('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] text-[#F43F5E] hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Quiz Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">Assessment / Quiz</label>
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="w-full bg-[#0B111D] border border-[#1F304E] rounded-xl px-3 py-2 text-white font-medium focus:border-[#38BDF8] outline-none"
            >
              <option value="">All My Authored Assessments</option>
              {(overviewData?.filterOptions?.quizzes || []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.category})
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">Class / Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-[#0B111D] border border-[#1F304E] rounded-xl px-3 py-2 text-white font-medium focus:border-[#38BDF8] outline-none"
            >
              <option value="">All Assigned Sections</option>
              {(overviewData?.filterOptions?.sections || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#0B111D] border border-[#1F304E] rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-[#38BDF8] outline-none"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#0B111D] border border-[#1F304E] rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-[#38BDF8] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1B2A44] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-[#38BDF8] text-[#38BDF8]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <BarChart3 size={15} />
          Overview &amp; KPIs
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`pb-2 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'questions'
              ? 'border-[#10B981] text-[#34D399]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <HelpCircle size={15} />
          Question-Level Analysis &amp; Distractors
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-2 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'students'
              ? 'border-[#A78BFA] text-[#C4B5FD]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Users size={15} />
          Student Performance Roster
        </button>

        <button
          onClick={() => setActiveTab('sections')}
          className={`pb-2 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'sections'
              ? 'border-[#F59E0B] text-[#FBBF24]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Layers size={15} />
          Section &amp; Assignment Comparisons
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#FB7185] text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 1: OVERVIEW DASHBOARD */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Top Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="dashboard-card p-4 space-y-1 border border-[#1B2A44]">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Total Attempts</p>
              <p className="text-2xl font-black text-white">{overviewData?.totalAttempts ?? 0}</p>
              <span className="text-[10px] text-[#38BDF8] font-medium">{overviewData?.uniqueStudents ?? 0} Unique Students</span>
            </div>

            <div className="dashboard-card p-4 space-y-1 border border-[#1B2A44]">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Average Score</p>
              <p className="text-2xl font-black text-[#34D399]">
                {overviewData?.averageScore ?? 0}<span className="text-xs font-normal">%</span>
              </p>
              <span className="text-[10px] text-[#94A3B8]">Median: {overviewData?.medianScore ?? 0}%</span>
            </div>

            <div className="dashboard-card p-4 space-y-1 border border-[#1B2A44]">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Pass Rate</p>
              <p className="text-2xl font-black text-[#38BDF8]">
                {overviewData?.passRate ?? 0}<span className="text-xs font-normal">%</span>
              </p>
              <span className="text-[10px] text-[#94A3B8]">Completion: {overviewData?.completionRate ?? 100}%</span>
            </div>

            <div className="dashboard-card p-4 space-y-1 border border-[#1B2A44]">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Overall Accuracy</p>
              <p className="text-2xl font-black text-[#A78BFA]">
                {overviewData?.overallAccuracy ?? 0}<span className="text-xs font-normal">%</span>
              </p>
              <span className="text-[10px] text-[#94A3B8]">{overviewData?.totalQuestionsAnswered ?? 0} Ans Total</span>
            </div>

            <div className="dashboard-card p-4 space-y-1 border border-[#1B2A44]">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Score Range</p>
              <p className="text-2xl font-black text-white">
                {overviewData?.highestScore ?? 0}<span className="text-xs font-normal">%</span>
              </p>
              <span className="text-[10px] text-[#64748B]">Min: {overviewData?.lowestScore ?? 0}%</span>
            </div>

            <div className="dashboard-card p-4 space-y-1 border border-[#1B2A44]">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Average Time</p>
              <p className="text-2xl font-black text-[#FBBF24]">
                {Math.round((overviewData?.averageTimeSec || 0) / 60)}<span className="text-xs font-normal">m</span>
              </p>
              <span className="text-[10px] text-[#94A3B8]">{overviewData?.averageTimeSec ?? 0} Seconds</span>
            </div>
          </div>

          {/* Secondary Row: Score Distribution & Students Needing Practice */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Score Distribution Breakdown */}
            <div className="dashboard-card p-5 space-y-4 border border-[#1B2A44]">
              <div className="flex items-center justify-between pb-2 border-b border-[#1B2A44]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 size={15} className="text-[#38BDF8]" />
                  Score Distribution (Completed Attempts)
                </h3>
                <span className="text-[10px] font-mono text-[#64748B]">
                  N = {overviewData?.totalAttempts || 0}
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { range: '81-100%', label: 'Mastery / Distinction', color: 'bg-[#10B981]', count: overviewData?.scoreDistribution?.['81-100%'] || 0 },
                  { range: '61-80%', label: 'Proficient / Passing', color: 'bg-[#38BDF8]', count: overviewData?.scoreDistribution?.['61-80%'] || 0 },
                  { range: '41-60%', label: 'Needs Practice / Marginal', color: 'bg-[#F59E0B]', count: overviewData?.scoreDistribution?.['41-60%'] || 0 },
                  { range: '0-40%', label: 'Critical Intervention Needed', color: 'bg-[#F43F5E]', count: overviewData?.scoreDistribution?.['0-40%'] || 0 }
                ].map((bucket) => {
                  const total = overviewData?.totalAttempts || 1;
                  const pct = Math.round((bucket.count / total) * 100);

                  return (
                    <div key={bucket.range} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-white font-bold">{bucket.range} ({bucket.label})</span>
                        <span className="text-[#94A3B8]">{bucket.count} attempts ({pct}%)</span>
                      </div>
                      <div className="w-full h-3 bg-[#0B111D] rounded-full overflow-hidden border border-[#1F304E]">
                        <div
                          className={`h-full ${bucket.color} transition-all duration-500 rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Students Needing Additional Practice Alert */}
            <div className="dashboard-card p-5 space-y-4 border border-[#1B2A44]">
              <div className="flex items-center justify-between pb-2 border-b border-[#1B2A44]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={15} className="text-[#F43F5E]" />
                  Learners Requiring Additional Practice
                </h3>
                <span className="text-[10px] font-bold text-[#F43F5E] bg-[#F43F5E]/15 px-2 py-0.5 rounded-full border border-[#F43F5E]/30">
                  {overviewData?.studentsNeedingPractice?.length || 0} Flagged
                </span>
              </div>

              {(!overviewData?.studentsNeedingPractice || overviewData.studentsNeedingPractice.length === 0) ? (
                <div className="py-8 text-center text-xs text-[#64748B] space-y-2">
                  <CheckCircle2 size={28} className="text-[#10B981] mx-auto opacity-70" />
                  <p>All students are performing at or above the expected passing thresholds!</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {overviewData.studentsNeedingPractice.map((st) => (
                    <div
                      key={st.studentId}
                      className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{st.name}</p>
                        <p className="text-[10px] text-[#64748B]">{st.email}</p>
                      </div>

                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/40 text-xs font-mono font-bold">
                          Avg: {st.avgScore}%
                        </span>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
                          {st.attempts} attempt(s) &bull; {st.passRate}% pass
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: QUESTION-LEVEL ANALYSIS & DISTRACTORS (CORE MVP) */}
      {/* ============================================================ */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          
          {/* Question Controls & Sort Filter */}
          <div className="dashboard-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border border-[#1B2A44]">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="font-bold text-white flex items-center gap-1.5 shrink-0">
                <ArrowUpDown size={14} className="text-[#38BDF8]" />
                Sort Questions By:
              </span>
              <select
                value={qSortBy}
                onChange={(e) => setQSortBy(e.target.value)}
                className="bg-[#0B111D] border border-[#1F304E] rounded-lg px-2.5 py-1.5 text-white font-medium outline-none text-xs"
              >
                <option value="lowest_accuracy">Lowest Accuracy (Hardest First)</option>
                <option value="highest_accuracy">Highest Accuracy (Easiest First)</option>
                <option value="most_incorrect">Most Incorrect Responses</option>
                <option value="most_skipped">Most Skipped / Unanswered</option>
              </select>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={qDifficulty}
                onChange={(e) => setQDifficulty(e.target.value)}
                className="bg-[#0B111D] border border-[#1F304E] rounded-lg px-2.5 py-1.5 text-white font-medium outline-none text-xs"
              >
                <option value="">All Realized Difficulties</option>
                <option value="Hard">Hard (&lt; 40% accuracy)</option>
                <option value="Medium">Medium (40-74% accuracy)</option>
                <option value="Easy">Easy (&ge; 75% accuracy)</option>
              </select>

              <select
                value={qType}
                onChange={(e) => setQType(e.target.value)}
                className="bg-[#0B111D] border border-[#1F304E] rounded-lg px-2.5 py-1.5 text-white font-medium outline-none text-xs"
              >
                <option value="">All Types</option>
                <option value="MCQ_SINGLE">Single Choice MCQ</option>
                <option value="MCQ_MULTI">Multiple Choice MCQ</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="FILL_BLANK">Fill in Blanks</option>
                <option value="NUMERICAL">Numerical Answer</option>
              </select>
            </div>
          </div>

          {loadingQuestions ? (
            <div className="py-16 text-center text-xs text-[#94A3B8] font-mono">
              <RefreshCw size={24} className="animate-spin text-[#38BDF8] mx-auto mb-2" />
              Computing question performance &amp; option distribution across attempts...
            </div>
          ) : questionsData.length === 0 ? (
            <div className="dashboard-card p-12 text-center text-xs text-[#64748B] space-y-2">
              <HelpCircle size={32} className="mx-auto text-[#64748B] opacity-50" />
              <p className="font-bold text-white">No Question Analytics Found</p>
              <p>No student attempts have been submitted for the selected filter scope yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questionsData.map((q, idx) => {
                const isExpanded = expandedQuestionId === q.id;
                const difficultyColor = 
                  q.realizedDifficulty === 'Easy' 
                    ? 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/40' 
                    : q.realizedDifficulty === 'Hard'
                    ? 'bg-[#F43F5E]/20 text-[#FB7185] border-[#F43F5E]/40'
                    : 'bg-[#F59E0B]/20 text-[#FBBF24] border-[#F59E0B]/40';

                return (
                  <div
                    key={q.id}
                    className="dashboard-card p-5 space-y-4 border border-[#1B2A44] hover:border-[#2C3F63] transition-all"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1B2A44]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-[#64748B]">#{idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${difficultyColor}`}>
                          {q.realizedDifficulty} ({q.accuracy}%)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#132238] border border-[#1F304E] text-[10px] font-bold text-[#38BDF8]">
                          {q.questionType?.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-[#94A3B8] font-medium truncate max-w-xs">
                          {q.quizTitle}
                        </span>
                      </div>

                      {/* Stat Counters Pill */}
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-[#34D399] font-bold" title="Correct Responses">
                          ✓ {q.correctCount}
                        </span>
                        <span className="text-[#FB7185] font-bold" title="Incorrect Responses">
                          ✗ {q.incorrectCount}
                        </span>
                        <span className="text-[#94A3B8]" title="Skipped / Unanswered">
                          ⊘ {q.skippedCount} Skipped
                        </span>
                        <span className="text-[#64748B]" title="Total attempts on this question">
                          ({q.attemptedCount} attempted)
                        </span>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <div className="text-sm font-semibold text-white leading-relaxed">
                      {q.questionText}
                    </div>

                    {/* Accuracy Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#94A3B8]">Accuracy Rate</span>
                        <span className="font-bold text-white">{q.accuracy}% Correct</span>
                      </div>
                      <div className="w-full h-2 bg-[#0B111D] rounded-full overflow-hidden border border-[#1F304E]">
                        <div
                          className={`h-full ${q.accuracy >= 75 ? 'bg-[#10B981]' : q.accuracy >= 40 ? 'bg-[#F59E0B]' : 'bg-[#F43F5E]'} rounded-full transition-all`}
                          style={{ width: `${q.accuracy}%` }}
                        />
                      </div>
                    </div>

                    {/* Most Common Distractor Callout (Core Feature) */}
                    {q.mostCommonDistractor && (
                      <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[#FB7185]">
                          <Flame size={16} className="shrink-0" />
                          <span>
                            <strong>Most Common Distractor:</strong> Option {q.mostCommonDistractor.option_key} &mdash; &ldquo;{q.mostCommonDistractor.option_text}&rdquo;
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#FB7185] shrink-0">
                          {q.mostCommonDistractor.count} students ({q.mostCommonDistractor.percentage}%)
                        </span>
                      </div>
                    )}

                    {/* Option Choices Distribution Breakdown */}
                    {Array.isArray(q.optionDistribution) && q.optionDistribution.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">
                          Option Choice Selection Distribution:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {q.optionDistribution.map((opt) => (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                opt.is_correct
                                  ? 'bg-[#10B981]/15 border-[#10B981]/50 text-white'
                                  : 'bg-[#121D32] border-[#1F304E] text-[#94A3B8]'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  opt.is_correct ? 'bg-[#10B981] text-[#042F2E]' : 'bg-[#1F304E] text-[#CBD5E1]'
                                }`}>
                                  {opt.option_key}
                                </span>
                                <span className={`truncate text-xs ${opt.is_correct ? 'font-bold text-[#34D399]' : ''}`}>
                                  {opt.option_text}
                                </span>
                              </div>

                              <div className="text-right shrink-0 font-mono text-[11px]">
                                <span className={opt.is_correct ? 'text-[#34D399] font-bold' : 'text-white'}>
                                  {opt.count}
                                </span>
                                <span className="text-[#64748B] text-[10px] ml-1">({opt.percentage}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expandable Teacher Key & Explanation */}
                    <div className="pt-2 border-t border-[#1B2A44] flex items-center justify-between">
                      <button
                        onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                        className="text-xs text-[#38BDF8] hover:underline flex items-center gap-1 font-semibold"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide Answer & Explanation' : 'View Correct Answer & Explanation'}
                      </button>

                      <span className="text-[10px] text-[#64748B] font-mono">
                        Points: {q.marks}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="p-3.5 rounded-xl bg-[#0B111D] border border-[#1F304E] space-y-2 text-xs animate-fadeIn">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#10B981] tracking-wider block">
                            Authoritative Correct Answer:
                          </span>
                          <p className="text-white font-medium mt-0.5">{q.correctAnswerText || 'See options marked correct'}</p>
                        </div>

                        {q.explanation && (
                          <div className="pt-2 border-t border-[#1F304E]">
                            <span className="text-[10px] font-bold uppercase text-[#38BDF8] tracking-wider block">
                              Pedagogical Explanation:
                            </span>
                            <p className="text-[#CBD5E1] mt-0.5">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: STUDENT ROSTER INSIGHTS */}
      {/* ============================================================ */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          
          {/* Search bar */}
          <div className="dashboard-card p-3 flex items-center gap-3 border border-[#1B2A44]">
            <Search size={16} className="text-[#64748B]" />
            <input
              type="text"
              placeholder="Search student by name, email, or roll number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="bg-transparent border-none text-white text-xs w-full focus:outline-none"
            />
          </div>

          {loadingStudents ? (
            <div className="py-16 text-center text-xs text-[#94A3B8] font-mono">
              <RefreshCw size={24} className="animate-spin text-[#A78BFA] mx-auto mb-2" />
              Loading student mastery records...
            </div>
          ) : studentsData.length === 0 ? (
            <div className="dashboard-card p-12 text-center text-xs text-[#64748B]">
              No student attempt records matching the search criteria.
            </div>
          ) : (
            <div className="dashboard-card overflow-hidden border border-[#1B2A44]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0B111D] border-b border-[#1B2A44] text-[10px] uppercase font-bold text-[#64748B]">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Section / Class</th>
                      <th className="py-3 px-4 text-center">Attempts</th>
                      <th className="py-3 px-4 text-center">Avg Score</th>
                      <th className="py-3 px-4 text-center">Accuracy</th>
                      <th className="py-3 px-4 text-center">Pass Rate</th>
                      <th className="py-3 px-4 text-center">Unresolved Mistakes</th>
                      <th className="py-3 px-4 text-right">Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B2A44] font-medium">
                    {studentsData.map((st) => (
                      <tr key={st.id} className="hover:bg-[#121D32] transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white">{st.name}</p>
                          <p className="text-[10px] text-[#64748B]">{st.email}</p>
                        </td>

                        <td className="py-3 px-4">
                          <p className="text-[#CBD5E1]">{st.sectionName}</p>
                          <p className="text-[10px] text-[#64748B]">Roll: {st.rollNumber}</p>
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-white">
                          {st.completedAttempts} / {st.totalAttempts}
                        </td>

                        <td className="py-3 px-4 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                            st.averageScore >= 75 ? 'text-[#34D399] bg-[#10B981]/15' :
                            st.averageScore >= 50 ? 'text-[#FBBF24] bg-[#F59E0B]/15' :
                            'text-[#FB7185] bg-[#F43F5E]/15'
                          }`}>
                            {st.averageScore}%
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-[#A78BFA]">
                          {st.accuracy}%
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-white">
                          {st.passRate}%
                        </td>

                        <td className="py-3 px-4 text-center">
                          {st.unresolvedMistakes > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F43F5E]/15 text-[#FB7185] border border-[#F43F5E]/30">
                              {st.unresolvedMistakes} active
                            </span>
                          ) : (
                            <span className="text-[#64748B] text-[10px]">None</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-[11px] text-[#94A3B8]">
                          {st.lastAttemptDate ? new Date(st.lastAttemptDate).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 4: SECTION COMPARISONS */}
      {/* ============================================================ */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          {loadingSections ? (
            <div className="py-16 text-center text-xs text-[#94A3B8] font-mono">
              <RefreshCw size={24} className="animate-spin text-[#FBBF24] mx-auto mb-2" />
              Aggregating section cohort statistics...
            </div>
          ) : sectionsData.length === 0 ? (
            <div className="dashboard-card p-12 text-center text-xs text-[#64748B]">
              No section allocations or assignments found for this account.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectionsData.map((sec) => (
                <div
                  key={sec.sectionId}
                  className="dashboard-card p-5 space-y-4 border border-[#1B2A44] hover:border-[#F59E0B]/50 transition-all"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
                    <div>
                      <h4 className="text-sm font-bold text-white">{sec.sectionName}</h4>
                      <p className="text-[10px] text-[#94A3B8]">{sec.className} &bull; {sec.departmentName}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30">
                      {sec.enrolledStudents} Enrolled
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                    <div className="p-2.5 rounded-lg bg-[#0B111D] border border-[#1F304E]">
                      <span className="text-[10px] text-[#64748B] block">Average Score</span>
                      <span className="text-base font-bold text-[#34D399]">{sec.averageScore}%</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0B111D] border border-[#1F304E]">
                      <span className="text-[10px] text-[#64748B] block">Pass Rate</span>
                      <span className="text-base font-bold text-[#38BDF8]">{sec.passRate}%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>Assigned Tasks:</span>
                      <span className="text-white font-mono">{sec.totalAssigned}</span>
                    </div>
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>Submissions:</span>
                      <span className="text-[#10B981] font-mono">{sec.submittedCount}</span>
                    </div>
                    {sec.lateCount > 0 && (
                      <div className="flex justify-between text-[#F59E0B]">
                        <span>Late Submissions:</span>
                        <span className="font-mono">{sec.lateCount}</span>
                      </div>
                    )}
                    {sec.overdueCount > 0 && (
                      <div className="flex justify-between text-[#F43F5E]">
                        <span>Overdue / Missing:</span>
                        <span className="font-mono">{sec.overdueCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
