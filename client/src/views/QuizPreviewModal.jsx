import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export default function QuizPreviewModal({ quizId, onClose }) {
  const { accessToken } = useAuth();
  const [quizData, setQuizData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreview() {
      try {
        const res = await fetch(`/api/v1/quizzes/${quizId}/preview`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.success) {
          setQuizData(data.data.quiz);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPreview();
  }, [quizId, accessToken]);

  if (loading || !quizData) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="text-white text-xs font-mono flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
          Loading Quiz Preview...
        </div>
      </div>
    );
  }

  const questions = quizData.questions || [];
  const currentQ = questions[currentIdx] || null;

  const handleSelectOption = (qId, optionKey, isMulti = false) => {
    if (isSubmitted) return;
    if (isMulti) {
      const existing = Array.isArray(answers[qId]) ? answers[qId] : [];
      if (existing.includes(optionKey)) {
        setAnswers({ ...answers, [qId]: existing.filter(k => k !== optionKey) });
      } else {
        setAnswers({ ...answers, [qId]: [...existing, optionKey] });
      }
    } else {
      setAnswers({ ...answers, [qId]: optionKey });
    }
  };

  const handleTextAnswer = (qId, text) => {
    if (isSubmitted) return;
    setAnswers({ ...answers, [qId]: text });
  };

  // Evaluate preview score
  let totalScore = 0;
  let maxPossible = 0;
  if (isSubmitted) {
    questions.forEach(q => {
      const pts = parseFloat(q.marks) || 1.0;
      maxPossible += pts;
      const userAns = answers[q.id];

      if (q.question_type === 'MCQ_SINGLE' || q.question_type === 'TRUE_FALSE') {
        const correctOpt = q.options?.find(o => o.is_correct === 1);
        if (correctOpt && userAns === correctOpt.option_key) {
          totalScore += pts;
        }
      } else if (q.question_type === 'MCQ_MULTI') {
        const correctKeys = (q.options || []).filter(o => o.is_correct === 1).map(o => o.option_key);
        const selectedKeys = Array.isArray(userAns) ? userAns : [];
        const isMatch = correctKeys.length === selectedKeys.length && correctKeys.every(k => selectedKeys.includes(k));
        if (isMatch) totalScore += pts;
      } else if (q.question_type === 'FILL_BLANK' || q.question_type === 'SHORT_ANSWER') {
        const cleanUser = String(userAns || '').trim().toLowerCase();
        const matches = (q.answers || []).some(a => {
          const expected = String(a.expected_answer || '').trim();
          return a.is_case_sensitive ? String(userAns || '').trim() === expected : cleanUser === expected.toLowerCase();
        });
        if (matches) totalScore += pts;
      } else if (q.question_type === 'NUMERICAL') {
        const numUser = parseFloat(userAns);
        const target = parseFloat(q.answers?.[0]?.expected_answer);
        const tol = parseFloat(q.answers?.[0]?.numeric_tolerance) || 0;
        if (!isNaN(numUser) && !isNaN(target)) {
          if (Math.abs(numUser - target) <= tol) {
            totalScore += pts;
          }
        }
      }
    });
  }

  const scorePercentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
  const isPassed = scorePercentage >= (quizData.passingPercentage || 60);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="dashboard-card max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden border-[#34D399]/30 shadow-2xl animate-fadeIn">
        
        {/* Preview Banner Header */}
        <div className="p-4 bg-[#10B981]/15 border-b border-[#10B981]/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[#34D399]">
            <Sparkles size={16} />
            <span>Learner Preview Mode &bull; Real Interaction Simulation</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-white bg-[#0B111D]/60"
            title="Exit Preview"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Quiz Header Information */}
          <div className="space-y-1 pb-3 border-b border-[#1B2A44]">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Category: <strong className="text-white">{quizData.category}</strong></span>
              <span>Pass Threshold: <strong className="text-[#34D399]">{quizData.passingPercentage}%</strong></span>
            </div>
            <h2 className="text-xl font-bold text-white">{quizData.title}</h2>
            {quizData.description && (
              <p className="text-xs text-[#94A3B8]">{quizData.description}</p>
            )}
          </div>

          {/* Submission Results Banner */}
          {isSubmitted && (
            <div className={`p-4 rounded-2xl border text-center space-y-2 ${
              isPassed ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#34D399]' : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
            }`}>
              <h3 className="text-lg font-black">
                {isPassed ? '✓ Passed Assessment Preview!' : '✗ Failed Assessment Preview'}
              </h3>
              <p className="text-xs font-semibold">
                Score: <strong className="text-white text-sm">{totalScore} / {maxPossible} Points</strong> ({scorePercentage}%)
              </p>
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setAnswers({});
                  setCurrentIdx(0);
                }}
                className="btn-secondary text-xs py-1.5 px-4 font-bold inline-flex items-center gap-1.5 mt-2"
              >
                <RotateCcw size={13} />
                Reset & Try Again
              </button>
            </div>
          )}

          {/* Question Display */}
          {currentQ ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#94A3B8]">
                <span>Question {currentIdx + 1} of {questions.length}</span>
                <span className="px-2 py-0.5 rounded bg-[#132238] text-[#34D399] font-mono">{currentQ.marks} Pt</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E1626] border border-[#1F304E]">
                <p className="text-base font-semibold text-white leading-relaxed">
                  {currentQ.question_text}
                </p>
              </div>

              {/* Input according to Question Type */}
              <div className="space-y-2.5 pt-2">
                
                {/* Single Choice / True False */}
                {(currentQ.question_type === 'MCQ_SINGLE' || currentQ.question_type === 'TRUE_FALSE') && (
                  <div className="space-y-2">
                    {currentQ.options?.map((opt) => {
                      const isSelected = answers[currentQ.id] === opt.option_key;
                      let borderColor = 'border-[#1F304E]';
                      let bgColor = 'bg-[#121D32]';
                      if (isSelected) {
                        borderColor = 'border-[#34D399]';
                        bgColor = 'bg-[#10B981]/15 text-white';
                      }
                      if (isSubmitted && opt.is_correct === 1) {
                        borderColor = 'border-[#10B981]';
                        bgColor = 'bg-[#10B981]/25 text-[#34D399]';
                      }

                      return (
                        <div
                          key={opt.option_key}
                          onClick={() => handleSelectOption(currentQ.id, opt.option_key)}
                          className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${borderColor} ${bgColor}`}
                        >
                          <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                            isSelected ? 'bg-[#34D399] text-[#042F2E]' : 'bg-[#1B2A44] text-[#94A3B8]'
                          }`}>
                            {opt.option_key}
                          </span>
                          <span className="text-xs font-medium flex-1">{opt.option_text}</span>
                          {isSubmitted && opt.is_correct === 1 && (
                            <span className="text-[10px] font-bold text-[#34D399]">Correct Choice</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multiple Select */}
                {currentQ.question_type === 'MCQ_MULTI' && (
                  <div className="space-y-2">
                    {currentQ.options?.map((opt) => {
                      const selectedList = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : [];
                      const isSelected = selectedList.includes(opt.option_key);
                      return (
                        <div
                          key={opt.option_key}
                          onClick={() => handleSelectOption(currentQ.id, opt.option_key, true)}
                          className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                            isSelected ? 'bg-[#10B981]/15 border-[#34D399] text-white' : 'bg-[#121D32] border-[#1F304E]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded bg-[#0B111D] border-[#1F304E]"
                          />
                          <span className="text-xs font-medium flex-1">{opt.option_text}</span>
                          {isSubmitted && opt.is_correct === 1 && (
                            <span className="text-[10px] font-bold text-[#34D399]">Correct Choice</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fill Blank / Short Answer */}
                {(currentQ.question_type === 'FILL_BLANK' || currentQ.question_type === 'SHORT_ANSWER') && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      disabled={isSubmitted}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="input-field text-xs font-mono"
                    />
                    {isSubmitted && (
                      <p className="text-[11px] text-[#34D399]">
                        Accepted answers: {currentQ.answers?.map(a => a.expected_answer).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Numerical */}
                {currentQ.question_type === 'NUMERICAL' && (
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="any"
                      disabled={isSubmitted}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                      placeholder="Enter numerical answer..."
                      className="input-field text-xs font-mono"
                    />
                    {isSubmitted && (
                      <p className="text-[11px] text-[#34D399]">
                        Target value: {currentQ.answers?.[0]?.expected_answer} (&plusmn;{currentQ.answers?.[0]?.numeric_tolerance})
                      </p>
                    )}
                  </div>
                )}

              </div>

              {/* Explanation display if submitted */}
              {isSubmitted && currentQ.explanation && (
                <div className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] text-xs space-y-1">
                  <p className="font-bold text-[#06B6D4]">Solution Explanation:</p>
                  <p className="text-[#94A3B8] leading-relaxed">{currentQ.explanation}</p>
                </div>
              )}

            </div>
          ) : (
            <p className="text-xs text-[#94A3B8]">Quiz has no questions to display.</p>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-[#1B2A44] bg-[#0A101A] flex items-center justify-between">
          <button
            onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="btn-secondary text-xs py-2 px-3 gap-1.5 disabled:opacity-30"
          >
            <ArrowLeft size={14} />
            Previous
          </button>

          {!isSubmitted ? (
            <button
              onClick={() => setIsSubmitted(true)}
              className="btn-emerald-primary text-xs py-2 px-5 font-bold"
            >
              Submit Preview
            </button>
          ) : (
            <span className="text-xs font-mono text-[#34D399]">
              Preview Evaluation Complete
            </span>
          )}

          <button
            onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
            disabled={currentIdx === questions.length - 1}
            className="btn-secondary text-xs py-2 px-3 gap-1.5 disabled:opacity-30"
          >
            Next
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
