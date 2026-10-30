import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Award, 
  RotateCcw, 
  BookMarked, 
  ArrowLeft, 
  AlertCircle,
  HelpCircle,
  Check,
  X
} from 'lucide-react';

export default function QuizResultView({ attemptId, onRetake, onReviewMistakes, onBackToQuizzes }) {
  const { accessToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/attempts/${attemptId}/summary`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || 'Failed to load result summary');
        setData(json.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (attemptId && accessToken) {
      fetchSummary();
    }
  }, [attemptId, accessToken]);

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center text-white text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#10B981] animate-ping" />
          Calculating score and generating report...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto dashboard-card p-6 text-center space-y-4">
        <AlertCircle size={32} className="text-[#F43F5E] mx-auto" />
        <h2 className="text-base font-bold text-white">Could not load quiz result</h2>
        <p className="text-xs text-[#94A3B8]">{error || 'Unknown error'}</p>
        <button onClick={onBackToQuizzes} className="btn-secondary text-xs py-2 px-4">
          Back to Quizzes
        </button>
      </div>
    );
  }

  const { attempt, quiz, reviewQuestions } = data;
  const isPassed = attempt.isPassed;
  const mins = Math.floor((attempt.timeTakenSec || 0) / 60);
  const secs = (attempt.timeTakenSec || 0) % 60;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToQuizzes}
          className="btn-secondary text-xs py-2 px-3 gap-1.5"
        >
          <ArrowLeft size={14} />
          Back to Quizzes
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRetake && onRetake(attempt.quizId)}
            className="btn-secondary text-xs py-2 px-3 gap-1.5 text-[#38BDF8] border-[#38BDF8]/30"
          >
            <RotateCcw size={14} />
            Retake Quiz
          </button>

          <button
            onClick={onReviewMistakes}
            className="btn-secondary text-xs py-2 px-3 gap-1.5 text-[#34D399] border-[#34D399]/30"
          >
            <BookMarked size={14} />
            Mistake Notebook
          </button>
        </div>
      </div>

      {/* Hero Result Banner */}
      <div className={`dashboard-card p-8 text-center space-y-5 border relative overflow-hidden ${
        isPassed
          ? 'border-[#10B981]/40 bg-gradient-to-b from-[#10B981]/15 to-[#0B111D]'
          : 'border-[#F43F5E]/40 bg-gradient-to-b from-[#F43F5E]/15 to-[#0B111D]'
      }`}>
        
        <div className="flex justify-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl ${
            isPassed ? 'bg-[#10B981] shadow-[#10B981]/30' : 'bg-[#F43F5E] shadow-[#F43F5E]/30'
          }`}>
            {isPassed ? <Trophy size={32} /> : <AlertCircle size={32} />}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#94A3B8]">
            {quiz.category} &bull; Assessment Result
          </span>
          <h1 className="text-2xl font-extrabold text-white mt-1">{quiz.title}</h1>
          <p className="text-sm font-semibold mt-1">
            {isPassed ? (
              <span className="text-[#34D399]">Congratulations! You successfully passed this quiz.</span>
            ) : (
              <span className="text-[#FB7185]">You did not reach the passing score threshold ({quiz.pass_percentage}%). Keep practicing!</span>
            )}
          </p>
        </div>

        {/* Score Ring / Metric */}
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="text-center">
            <span className="text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
              {attempt.scorePercentage}%
            </span>
            <p className="text-xs text-[#94A3B8] font-bold uppercase mt-1">Final Score</p>
          </div>
        </div>

        {/* 4 Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
          
          <div className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] text-center">
            <p className="text-[11px] text-[#94A3B8]">Earned Marks</p>
            <p className="text-base font-bold text-white font-mono mt-0.5">
              {attempt.score} / {attempt.maxScore}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] text-center">
            <p className="text-[11px] text-[#34D399]">Correct</p>
            <p className="text-base font-bold text-[#34D399] font-mono mt-0.5">
              {attempt.correctAnswers} / {attempt.totalQuestions}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] text-center">
            <p className="text-[11px] text-[#FB7185]">Incorrect</p>
            <p className="text-base font-bold text-[#FB7185] font-mono mt-0.5">
              {attempt.incorrectAnswers}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] text-center">
            <p className="text-[11px] text-[#38BDF8]">Time Spent</p>
            <p className="text-base font-bold text-[#38BDF8] font-mono mt-0.5">
              {mins}m {secs}s
            </p>
          </div>

        </div>

      </div>

      {/* Review Questions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1B2A44]">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-[#34D399]" />
            Question Breakdown & Review
          </h2>
          <span className="text-xs text-[#64748B] font-mono">
            {reviewQuestions.length} Questions Evaluated
          </span>
        </div>

        <div className="space-y-4">
          {reviewQuestions.map((q, idx) => {
            const isCorrect = q.is_correct;
            const isUnanswered = q.unanswered;

            return (
              <div
                key={q.id || idx}
                className={`dashboard-card p-6 border transition-all ${
                  isCorrect
                    ? 'border-[#10B981]/30 bg-[#0A1626]'
                    : isUnanswered
                    ? 'border-[#64748B]/30 bg-[#0E1626]'
                    : 'border-[#F43F5E]/30 bg-[#160E18]'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-white">
                      Q{idx + 1}.
                    </span>
                    <span className="text-xs text-[#94A3B8]">
                      {q.question_type?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#34D399] bg-[#10B981]/15 px-2.5 py-0.5 rounded-full border border-[#10B981]/30">
                        <Check size={12} /> Correct (+{q.earned_score} pts)
                      </span>
                    ) : isUnanswered ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#94A3B8] bg-[#64748B]/15 px-2.5 py-0.5 rounded-full border border-[#64748B]/30">
                        Unanswered (0 pts)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#FB7185] bg-[#F43F5E]/15 px-2.5 py-0.5 rounded-full border border-[#F43F5E]/30">
                        <X size={12} /> Incorrect ({q.earned_score} pts)
                      </span>
                    )}

                    {!isCorrect && !isUnanswered && (
                      <span className="text-[10px] bg-[#8B5CF6]/20 text-[#A78BFA] px-2 py-0.5 rounded border border-[#8B5CF6]/30 font-medium">
                        Added to Mistake Notebook
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-sm font-medium text-white mt-3">
                  {q.question_text}
                </p>

                {/* Options display if MCQ */}
                {q.options && q.options.length > 0 && (
                  <div className="space-y-2 mt-3 pt-2">
                    {q.options.map((opt, i) => {
                      const isUserChoice = String(q.user_answer).includes(opt.id) || String(q.user_answer).includes(opt.option_key);
                      const isOptionCorrect = opt.is_correct === 1;

                      return (
                        <div
                          key={opt.id || i}
                          className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium border ${
                            isOptionCorrect
                              ? 'bg-[#10B981]/15 border-[#10B981]/50 text-white'
                              : isUserChoice
                              ? 'bg-[#F43F5E]/15 border-[#F43F5E]/50 text-white'
                              : 'bg-[#0E1626] border-[#1B2A44] text-[#94A3B8]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded bg-[#1B2A44] flex items-center justify-center font-bold text-[10px]">
                              {opt.option_key || String.fromCharCode(65 + i)}
                            </span>
                            <span>{opt.option_text}</span>
                          </div>

                          <div className="flex items-center gap-1.5 font-bold text-[10px]">
                            {isOptionCorrect && (
                              <span className="text-[#34D399] flex items-center gap-1">
                                <Check size={12} /> Correct Answer
                              </span>
                            )}
                            {isUserChoice && !isOptionCorrect && (
                              <span className="text-[#FB7185] flex items-center gap-1">
                                <X size={12} /> Your Choice
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Text/Numeric User Answer vs Correct Answer */}
                {!q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-2 text-xs">
                    <div className="p-3 rounded-lg bg-[#121D32] border border-[#1F304E]">
                      <span className="text-[#94A3B8] font-bold block mb-1">Your Submission:</span>
                      <span className={isCorrect ? 'text-[#34D399] font-mono' : 'text-[#FB7185] font-mono'}>
                        {q.user_answer || '(No answer provided)'}
                      </span>
                    </div>

                    {q.correct_answer && (
                      <div className="p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
                        <span className="text-[#34D399] font-bold block mb-1">Correct Answer:</span>
                        <span className="text-white font-mono font-bold">
                          {q.correct_answer}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-[#0E1E34] border border-[#1E3A5F] text-xs text-[#94A3B8] space-y-1">
                    <span className="font-bold text-[#38BDF8] flex items-center gap-1.5">
                      <HelpCircle size={13} /> Explanation:
                    </span>
                    <p className="text-[#CBD5E1] leading-relaxed">{q.explanation}</p>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}