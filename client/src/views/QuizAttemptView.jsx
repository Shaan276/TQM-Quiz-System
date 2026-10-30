import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertTriangle, 
  X, 
  RotateCcw,
  BookOpen,
  Award,
  HelpCircle,
  Hash,
  FileText
} from 'lucide-react';

export default function QuizAttemptView({ attemptId: initialAttemptId, quizId, onComplete, onExit }) {
  const { accessToken } = useAuth();
  const [attemptId, setAttemptId] = useState(initialAttemptId);
  const [attempt, setAttempt] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remainingSec, setRemainingSec] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error'
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Initialize or resume attempt
  useEffect(() => {
    async function initAttempt() {
      setLoading(true);
      setError(null);
      try {
        let endpoint = '';
        let options = {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        };

        if (attemptId) {
          endpoint = `/api/v1/attempts/${attemptId}`;
          const res = await fetch(endpoint, options);
          const data = await res.json();
          if (!data.success) throw new Error(data.error?.message || 'Failed to load attempt');
          
          setAttempt(data.data.attempt);
          setQuiz(data.data.quiz);
          setQuestions(data.data.questions || []);
          setAnswers(data.data.savedAnswers || {});
          if (data.data.attempt.remainingSeconds !== null) {
            setRemainingSec(data.data.attempt.remainingSeconds);
          }
        } else if (quizId) {
          endpoint = `/api/v1/attempts/start`;
          options.method = 'POST';
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify({ quizId });

          const res = await fetch(endpoint, options);
          const data = await res.json();
          if (!data.success) throw new Error(data.error?.message || 'Failed to start quiz attempt');

          setAttemptId(data.data.attemptId);
          setQuiz(data.data.quiz);
          setQuestions(data.data.questions || []);
          setAnswers(data.data.savedAnswers || {});
          if (data.data.remainingSeconds !== null) {
            setRemainingSec(data.data.remainingSeconds);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (accessToken) {
      initAttempt();
    }
  }, [attemptId, quizId, accessToken]);

  // Authoritative countdown timer
  useEffect(() => {
    if (remainingSec === null || remainingSec <= 0) return;

    const timer = setInterval(() => {
      setRemainingSec(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit on time expiration
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSec]);

  // Debounced autosave
  const persistAnswerToServer = async (qId, ansVal) => {
    if (!attemptId) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/v1/attempts/${attemptId}/answers`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: [{ questionId: qId, answer: ansVal }]
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      persistAnswerToServer(questionId, value);
    }, 400);
  };

  const handleClearAnswer = (questionId) => {
    setAnswers(prev => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
    persistAnswerToServer(questionId, '');
  };

  const handleAutoSubmit = async () => {
    await performSubmit();
  };

  const performSubmit = async () => {
    if (submitting || !attemptId) return;
    setSubmitting(true);
    try {
      // Format answers as array
      const answerPayload = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        answer: ans
      }));

      const res = await fetch(`/api/v1/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: answerPayload
        })
      });

      const data = await res.json();
      if (data.success) {
        onComplete(attemptId);
      } else {
        alert(data.error?.message || 'Submission error');
      }
    } catch (err) {
      alert('Network error submitting quiz. Please try again.');
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center text-white text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#10B981] animate-ping" />
          Preparing quiz environment...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto dashboard-card p-8 text-center space-y-4">
        <AlertTriangle size={36} className="text-[#F43F5E] mx-auto" />
        <h2 className="text-lg font-bold text-white">Cannot Start Quiz Attempt</h2>
        <p className="text-xs text-[#94A3B8]">{error}</p>
        <button onClick={onExit} className="btn-secondary text-xs py-2 px-4">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || {};
  const currentAnswer = answers[currentQ.id];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).filter(k => {
    const val = answers[k];
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && String(val).trim() !== '';
  }).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Format countdown string mm:ss
  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isLowTime = remainingSec !== null && remainingSec < 60;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      
      {/* Top Banner & Timing Header */}
      <div className="dashboard-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-2 z-20 backdrop-blur-md bg-[#0D1524]/95 border border-[#1B2A44]">
        
        {/* Left: Quiz Info & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to exit? Your answers are saved on the server.')) {
                onExit();
              }
            }}
            className="p-1.5 rounded-lg bg-[#121D32] hover:bg-[#1A2942] text-[#94A3B8] hover:text-white"
            title="Exit taking (answers saved)"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] text-[#34D399] font-bold tracking-widest uppercase">
              {quiz?.category || 'General'}
            </span>
            <h1 className="text-base font-bold text-white truncate max-w-md">{quiz?.title}</h1>
          </div>
        </div>

        {/* Center: Save status & Progress */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            {saveStatus === 'saving' && <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping" />}
            {saveStatus === 'saved' && <span className="w-2 h-2 rounded-full bg-[#10B981]" />}
            {saveStatus === 'error' && <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />}
            <span className="capitalize">{saveStatus === 'saved' ? 'Synced' : saveStatus}</span>
          </div>

          <div className="hidden sm:block text-xs text-[#94A3B8]">
            Answered: <strong className="text-white">{answeredCount}</strong> / {totalQuestions}
          </div>
        </div>

        {/* Right: Timer & Submit Action */}
        <div className="flex items-center gap-3">
          {remainingSec !== null && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-bold border transition-colors ${
              isLowTime
                ? 'bg-[#F43F5E]/20 text-[#F43F5E] border-[#F43F5E]/40 animate-pulse'
                : 'bg-[#121D32] text-[#38BDF8] border-[#1F304E]'
            }`}>
              <Clock size={16} />
              <span>{formatTime(remainingSec)}</span>
            </div>
          )}

          <button
            onClick={() => setShowSubmitModal(true)}
            className="btn-emerald-primary text-xs py-2 px-4 gap-2 font-bold shadow-lg shadow-[#10B981]/20"
          >
            <Send size={14} />
            Submit Quiz
          </button>
        </div>

      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#121D32] h-1.5 rounded-full overflow-hidden">
        <div 
          className="bg-gradient-to-r from-[#10B981] to-[#34D399] h-full transition-all duration-300" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Runner Grid (Question Area + Question Palette) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Question Runner Viewport (3 Columns) */}
        <div className="lg:col-span-3 space-y-4">
          
          <div className="dashboard-card p-6 md:p-8 space-y-6">
            
            {/* Question Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#1B2A44]">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#121D32] border border-[#1F304E] text-xs font-bold text-[#34D399]">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs text-[#64748B] font-mono">
                  Type: {currentQ.question_type?.replace('_', ' ')}
                </span>
              </div>

              <div className="text-xs font-bold text-[#38BDF8] bg-[#0E2A47] px-2.5 py-1 rounded-lg border border-[#1E3A5F]">
                {currentQ.marks || 1} {Number(currentQ.marks) === 1 ? 'Mark' : 'Marks'}
              </div>
            </div>

            {/* Question Text */}
            <div className="text-base md:text-lg font-medium text-white leading-relaxed">
              {currentQ.question_text}
            </div>

            {/* Question Media if exists */}
            {currentQ.media_url && (
              <div className="rounded-xl overflow-hidden max-h-80 border border-[#1B2A44] bg-[#080D14]">
                <img 
                  src={currentQ.media_url} 
                  alt="Question attachment" 
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Interactive Inputs for 6 Question Types */}
            <div className="pt-2">

              {/* 1. Single Choice MCQ */}
              {currentQ.question_type === 'MCQ_SINGLE' && (
                <div className="space-y-3">
                  {(currentQ.options || []).map((opt, i) => {
                    const isSelected = currentAnswer === opt.id || currentAnswer === opt.option_key;
                    const letter = opt.option_key || String.fromCharCode(65 + i);

                    return (
                      <div
                        key={opt.id || i}
                        onClick={() => handleAnswerChange(currentQ.id, opt.id || opt.option_key)}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#10B981]/15 border-[#10B981] text-white shadow-md shadow-[#10B981]/10'
                            : 'bg-[#0E1626] border-[#1B2A44] text-[#CBD5E1] hover:bg-[#142036] hover:border-[#2C3F63]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#10B981] text-[#042F2E]'
                            : 'bg-[#1B2A44] text-[#94A3B8]'
                        }`}>
                          {letter}
                        </div>
                        <span className="text-sm font-medium leading-normal">{opt.option_text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Multiple Choice MCQ (Checkboxes) */}
              {currentQ.question_type === 'MCQ_MULTI' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#94A3B8] italic">
                    Select all options that apply (multiple answers allowed):
                  </p>
                  {(currentQ.options || []).map((opt, i) => {
                    let selectedArr = [];
                    try {
                      selectedArr = Array.isArray(currentAnswer) 
                        ? currentAnswer 
                        : JSON.parse(currentAnswer || '[]');
                    } catch (e) {
                      selectedArr = currentAnswer ? [currentAnswer] : [];
                    }

                    const isChecked = selectedArr.includes(opt.id) || selectedArr.includes(opt.option_key);
                    const letter = opt.option_key || String.fromCharCode(65 + i);

                    const toggleMultiOption = () => {
                      const newArr = isChecked
                        ? selectedArr.filter(x => x !== opt.id && x !== opt.option_key)
                        : [...selectedArr, opt.id || opt.option_key];
                      handleAnswerChange(currentQ.id, newArr);
                    };

                    return (
                      <div
                        key={opt.id || i}
                        onClick={toggleMultiOption}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#10B981]/15 border-[#10B981] text-white shadow-md shadow-[#10B981]/10'
                            : 'bg-[#0E1626] border-[#1B2A44] text-[#CBD5E1] hover:bg-[#142036] hover:border-[#2C3F63]'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 border transition-colors ${
                          isChecked
                            ? 'bg-[#10B981] text-[#042F2E] border-[#10B981]'
                            : 'bg-[#121D32] border-[#2C3F63] text-transparent'
                        }`}>
                          <CheckCircle2 size={16} />
                        </div>
                        <span className="text-sm font-medium leading-normal">{opt.option_text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. True / False */}
              {currentQ.question_type === 'TRUE_FALSE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['True', 'False'].map(choice => {
                    const isSelected = String(currentAnswer).toLowerCase() === choice.toLowerCase();
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => handleAnswerChange(currentQ.id, choice)}
                        className={`p-6 rounded-2xl border text-center font-bold text-lg transition-all ${
                          isSelected
                            ? choice === 'True'
                              ? 'bg-[#10B981]/20 border-[#10B981] text-[#34D399] shadow-lg shadow-[#10B981]/15'
                              : 'bg-[#F43F5E]/20 border-[#F43F5E] text-[#FB7185] shadow-lg shadow-[#F43F5E]/15'
                            : 'bg-[#0E1626] border-[#1B2A44] text-[#94A3B8] hover:bg-[#142036] hover:text-white'
                        }`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 4. Fill in the Blank */}
              {currentQ.question_type === 'FILL_BLANK' && (
                <div className="space-y-2">
                  <label className="text-xs text-[#94A3B8]">Type your answer for the blank space:</label>
                  <input
                    type="text"
                    value={currentAnswer || ''}
                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                    placeholder="Enter answer here..."
                    className="input-field text-sm font-medium py-3"
                    autoFocus
                  />
                </div>
              )}

              {/* 5. Short Answer */}
              {currentQ.question_type === 'SHORT_ANSWER' && (
                <div className="space-y-2">
                  <label className="text-xs text-[#94A3B8]">Provide your concise explanation or answer:</label>
                  <textarea
                    rows={4}
                    value={currentAnswer || ''}
                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                    placeholder="Type your response here..."
                    className="input-field text-sm font-medium py-3 resize-none"
                    autoFocus
                  />
                </div>
              )}

              {/* 6. Numerical with Tolerance */}
              {currentQ.question_type === 'NUMERICAL' && (
                <div className="space-y-2 max-w-sm">
                  <label className="text-xs text-[#94A3B8]">Enter calculated numerical value:</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                    <input
                      type="number"
                      step="any"
                      value={currentAnswer || ''}
                      onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                      placeholder="e.g. 11.5"
                      className="input-field pl-10 text-sm font-mono font-medium py-3"
                      autoFocus
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Clear Answer Option */}
            {currentAnswer !== undefined && currentAnswer !== '' && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleClearAnswer(currentQ.id)}
                  className="text-xs text-[#64748B] hover:text-[#F43F5E] flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={12} />
                  Clear my response
                </button>
              </div>
            )}

            {/* Bottom Question Runner Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-[#1B2A44]">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="btn-secondary text-xs py-2.5 px-4 gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Previous Question
              </button>

              {currentIndex < totalQuestions - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="btn-emerald-primary text-xs py-2.5 px-5 gap-2 font-bold"
                >
                  Next Question
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="btn-emerald-primary text-xs py-2.5 px-5 gap-2 font-bold bg-[#10B981] hover:bg-[#059669]"
                >
                  <Send size={15} />
                  Review & Submit
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Question Palette Sidebar (1 Column) */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="dashboard-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} className="text-[#34D399]" />
              Question Palette
            </h3>

            {/* Visual Indicator Grid */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isAnswered = ans !== undefined && ans !== null && String(ans).trim() !== '' && (!Array.isArray(ans) || ans.length > 0);
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id || idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg font-mono text-xs font-bold transition-all relative ${
                      isCurrent
                        ? 'ring-2 ring-[#38BDF8] ring-offset-2 ring-offset-[#0B111D] text-white z-10'
                        : ''
                    } ${
                      isAnswered
                        ? 'bg-[#10B981] text-[#042F2E]'
                        : 'bg-[#121D32] text-[#94A3B8] hover:bg-[#1A2942] hover:text-white'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-2 pt-4 border-t border-[#1B2A44] text-[11px] text-[#94A3B8]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#10B981]" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#121D32] border border-[#1F304E]" />
                <span>Unanswered ({totalQuestions - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded ring-2 ring-[#38BDF8] bg-[#121D32]" />
                <span>Current Question</span>
              </div>
            </div>

            {/* Quick Submit button */}
            <div className="pt-2">
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full btn-secondary text-xs py-2 font-semibold text-[#34D399] border-[#34D399]/30 hover:bg-[#34D399]/10"
              >
                Submit Exam Now
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Submission Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="dashboard-card max-w-md w-full p-6 space-y-5 border border-[#1B2A44] shadow-2xl">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={20} className="text-[#F59E0B]" />
                <h3 className="text-base font-bold text-white">Confirm Submission</h3>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-[#64748B] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#CBD5E1]">
              <p>
                Are you ready to submit your assessment? Once submitted, scoring will be finalized immediately on the server.
              </p>

              <div className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Total Questions:</span>
                  <span className="font-bold text-white">{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Questions Answered:</span>
                  <span className="font-bold text-[#10B981]">{answeredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Unanswered Questions:</span>
                  <span className={`font-bold ${totalQuestions - answeredCount > 0 ? 'text-[#F43F5E]' : 'text-white'}`}>
                    {totalQuestions - answeredCount}
                  </span>
                </div>
              </div>

              {totalQuestions - answeredCount > 0 && (
                <div className="p-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-[11px] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Warning: You have {totalQuestions - answeredCount} unanswered questions remaining.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Back to Questions
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={performSubmit}
                className="btn-emerald-primary text-xs py-2 px-5 font-bold gap-2"
              >
                {submitting ? 'Scoring Answers...' : 'Confirm & Submit'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}