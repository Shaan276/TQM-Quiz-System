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
  Sparkles,
  Zap
} from 'lucide-react';

export default function LearnerDashboardView({ onOpenPreview, setActiveRoute }) {
  const { user, accessToken, setSession } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPublishedQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/quizzes?status=PUBLISHED&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuizzes(data.data.quizzes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishedQuizzes();
  }, [accessToken, search]);

  const handleUpgradeToCreator = async () => {
    try {
      const res = await fetch('/api/v1/users/upgrade-to-creator', {
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-[#1B2A44] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <GraduationCap className="text-[#34D399]" size={26} />
            Learner Arena &bull; Student Dashboard
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Welcome, <strong className="text-white">{user?.name}</strong> &bull; Explore available published assessments.
          </p>
        </div>

        {user?.role === 'LEARNER' && (
          <button
            onClick={handleUpgradeToCreator}
            className="btn-secondary text-xs py-2 px-3 font-semibold gap-1.5 text-[#34D399] border-[#34D399]/30"
            title="Upgrade your account to create quizzes"
          >
            <Zap size={14} />
            Switch to Creator Role
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="dashboard-card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search published quizzes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 text-xs"
          />
        </div>
      </div>

      {/* Available Published Quizzes Grid */}
      {loading ? (
        <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
          Loading published assessments...
        </div>
      ) : quizzes.length === 0 ? (
        <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E]">
          <BookOpen size={28} className="text-[#64748B] mx-auto" />
          <h3 className="text-base font-bold text-white">No Published Quizzes Available</h3>
          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
            Instructors have not published quizzes yet, or your search query did not match any active assessments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="dashboard-card p-5 space-y-4 flex flex-col justify-between hover:border-[#34D399] transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] font-mono font-bold">
                    {quiz.category}
                  </span>
                  <span>{quiz.difficulty}</span>
                </div>

                <h3 className="text-base font-bold text-white line-clamp-1">
                  {quiz.title}
                </h3>
                <p className="text-xs text-[#94A3B8] line-clamp-2">
                  {quiz.description || 'Interactive assessment.'}
                </p>

                <div className="flex items-center gap-3 pt-2 text-[11px] text-[#94A3B8] border-t border-[#1B2A44]/60">
                  <span>{quiz.question_count || 0} Questions</span>
                  <span>&bull;</span>
                  <span>{quiz.total_marks || 0} Points</span>
                </div>
              </div>

              <button
                onClick={() => onOpenPreview(quiz.id)}
                className="btn-emerald-primary text-xs py-2 w-full font-bold gap-2 justify-center"
              >
                <Eye size={15} />
                Preview Assessment
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
