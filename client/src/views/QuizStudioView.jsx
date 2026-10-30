import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Settings,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Layers,
  HelpCircle,
  CheckSquare,
  FileText,
  Binary,
  Hash,
  Database,
  Sparkles,
  X,
  Share2
} from 'lucide-react';

const QUESTION_TYPES = [
  { type: 'MCQ_SINGLE', label: 'Single Choice MCQ', icon: HelpCircle, desc: 'Multiple options, exactly one correct' },
  { type: 'MCQ_MULTI', label: 'Multiple Select MCQ', icon: CheckSquare, desc: 'Multiple options, one or more correct' },
  { type: 'TRUE_FALSE', label: 'True / False', icon: Binary, desc: 'Binary true or false choice' },
  { type: 'FILL_BLANK', label: 'Fill in the Blanks', icon: FileText, desc: 'Text answer with accepted variants' },
  { type: 'SHORT_ANSWER', label: 'Short Answer', icon: FileText, desc: 'Concise text response' },
  { type: 'NUMERICAL', label: 'Numerical Answer', icon: Hash, desc: 'Numeric value with tolerance range' }
];

export default function QuizStudioView({ quizId, onBack, onOpenPreview }) {
  const { accessToken } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQIndex, setActiveQIndex] = useState(0);
  
  // Autosave status: 'SAVED' | 'SAVING' | 'DIRTY' | 'ERROR'
  const [saveStatus, setSaveStatus] = useState('SAVED');
  const [saveError, setSaveError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);
  const [showAddTypeMenu, setShowAddTypeMenu] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);

  // Autosave debounce timer
  const autosaveTimerRef = useRef(null);
  const isInitialMount = useRef(true);

  // Load Quiz Data
  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await fetch(`/api/v1/quizzes/${quizId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.success) {
          setQuiz(data.data.quiz);
          setQuestions(data.data.quiz.questions || []);
          setSaveStatus('SAVED');
          setLastSavedAt(new Date());
        }
      } catch (err) {
        setSaveStatus('ERROR');
        setSaveError('Failed to load quiz');
      }
    }
    fetchQuiz();
  }, [quizId, accessToken]);

  // Autosave Trigger
  const triggerAutosave = (updatedQuiz, updatedQuestions) => {
    setSaveStatus('DIRTY');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('SAVING');
      try {
        const res = await fetch(`/api/v1/quizzes/${quizId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            title: updatedQuiz.title,
            description: updatedQuiz.description,
            category: updatedQuiz.category,
            difficulty: updatedQuiz.difficulty,
            tags: updatedQuiz.tags,
            visibility: updatedQuiz.visibility,
            timeLimitSec: updatedQuiz.time_limit_sec,
            passingPercentage: updatedQuiz.passing_percentage,
            shuffleQuestions: updatedQuiz.shuffle_questions,
            shuffleOptions: updatedQuiz.shuffle_options,
            negativeMarking: updatedQuiz.negative_marking,
            negativeMarksRatio: updatedQuiz.negative_marks_ratio,
            showExplanations: updatedQuiz.show_explanations,
            maxAttempts: updatedQuiz.max_attempts,
            questions: updatedQuestions
          })
        });
        const data = await res.json();
        if (data.success) {
          setSaveStatus('SAVED');
          setLastSavedAt(new Date());
          setSaveError('');
        } else {
          setSaveStatus('ERROR');
          setSaveError(data.error?.message || 'Save failed');
        }
      } catch (err) {
        setSaveStatus('ERROR');
        setSaveError('Network failure during autosave');
      }
    }, 1200); // 1.2s debounce
  };

  // Warn on unmount if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus === 'DIRTY' || saveStatus === 'SAVING') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Current active question
  const currentQ = questions[activeQIndex] || null;

  // Add Question with specified type
  const handleAddQuestion = (type = 'MCQ_SINGLE') => {
    let initialOptions = [];
    let initialAnswers = [];

    if (type === 'MCQ_SINGLE' || type === 'MCQ_MULTI') {
      initialOptions = [
        { option_key: 'A', option_text: 'Option 1', is_correct: true },
        { option_key: 'B', option_text: 'Option 2', is_correct: false },
        { option_key: 'C', option_text: 'Option 3', is_correct: false },
        { option_key: 'D', option_text: 'Option 4', is_correct: false }
      ];
    } else if (type === 'TRUE_FALSE') {
      initialOptions = [
        { option_key: 'TRUE', option_text: 'True', is_correct: true },
        { option_key: 'FALSE', option_text: 'False', is_correct: false }
      ];
    } else if (type === 'FILL_BLANK' || type === 'SHORT_ANSWER') {
      initialAnswers = [
        { expected_answer: '', is_case_sensitive: false }
      ];
    } else if (type === 'NUMERICAL') {
      initialAnswers = [
        { expected_answer: '0', numeric_tolerance: 0.0 }
      ];
    }

    const newQuestion = {
      id: 'temp_' + Date.now(),
      question_text: '',
      question_type: type,
      marks: 1.0,
      time_limit_sec: 30,
      explanation: '',
      options: initialOptions,
      answers: initialAnswers,
      settings: {}
    };

    const updated = [...questions, newQuestion];
    setQuestions(updated);
    setActiveQIndex(updated.length - 1);
    setShowAddTypeMenu(false);
    triggerAutosave(quiz, updated);
  };

  // Update current question fields
  const handleUpdateCurrentQ = (updates) => {
    if (!currentQ) return;
    const updatedQ = { ...currentQ, ...updates };
    const updatedList = [...questions];
    updatedList[activeQIndex] = updatedQ;
    setQuestions(updatedList);
    triggerAutosave(quiz, updatedList);
  };

  // Delete Question
  const handleDeleteQuestion = (index) => {
    if (questions.length <= 1) {
      alert('A quiz must contain at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    if (activeQIndex >= updated.length) {
      setActiveQIndex(Math.max(0, updated.length - 1));
    }
    triggerAutosave(quiz, updated);
  };

  // Duplicate Question
  const handleDuplicateQuestion = (index) => {
    const target = questions[index];
    const clone = {
      ...target,
      id: 'clone_' + Date.now(),
      question_text: `${target.question_text} (Copy)`,
      options: target.options ? target.options.map(o => ({ ...o, id: undefined })) : [],
      answers: target.answers ? target.answers.map(a => ({ ...a, id: undefined })) : []
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, clone);
    setQuestions(updated);
    setActiveQIndex(index + 1);
    triggerAutosave(quiz, updated);
  };

  // Reorder Questions (Move Up/Down)
  const handleMoveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
    setActiveQIndex(targetIndex);
    triggerAutosave(quiz, updated);
  };

  // Option Handlers for MCQ
  const handleAddOption = () => {
    if (!currentQ || !currentQ.options) return;
    const nextKey = String.fromCharCode(65 + currentQ.options.length);
    const newOptions = [
      ...currentQ.options,
      { option_key: nextKey, option_text: `Option ${currentQ.options.length + 1}`, is_correct: false }
    ];
    handleUpdateCurrentQ({ options: newOptions });
  };

  const handleUpdateOption = (optIndex, updates) => {
    if (!currentQ || !currentQ.options) return;
    const newOptions = [...currentQ.options];
    newOptions[optIndex] = { ...newOptions[optIndex], ...updates };
    handleUpdateCurrentQ({ options: newOptions });
  };

  const handleDeleteOption = (optIndex) => {
    if (!currentQ || currentQ.options.length <= 2) {
      alert('MCQ questions require at least 2 options.');
      return;
    }
    const newOptions = currentQ.options.filter((_, i) => i !== optIndex);
    handleUpdateCurrentQ({ options: newOptions });
  };

  const handleSelectCorrectOption = (optIndex) => {
    if (!currentQ || !currentQ.options) return;
    if (currentQ.question_type === 'MCQ_SINGLE' || currentQ.question_type === 'TRUE_FALSE') {
      const newOptions = currentQ.options.map((opt, i) => ({
        ...opt,
        is_correct: i === optIndex
      }));
      handleUpdateCurrentQ({ options: newOptions });
    } else if (currentQ.question_type === 'MCQ_MULTI') {
      const newOptions = [...currentQ.options];
      newOptions[optIndex].is_correct = !newOptions[optIndex].is_correct;
      handleUpdateCurrentQ({ options: newOptions });
    }
  };

  // Answer Handlers for Fill-in-Blank / Short Answer / Numerical
  const handleAddAnswer = () => {
    if (!currentQ) return;
    const newAnswers = [
      ...(currentQ.answers || []),
      { expected_answer: '', is_case_sensitive: false, numeric_tolerance: 0.0 }
    ];
    handleUpdateCurrentQ({ answers: newAnswers });
  };

  const handleUpdateAnswer = (ansIndex, updates) => {
    if (!currentQ || !currentQ.answers) return;
    const newAnswers = [...currentQ.answers];
    newAnswers[ansIndex] = { ...newAnswers[ansIndex], ...updates };
    handleUpdateCurrentQ({ answers: newAnswers });
  };

  const handleDeleteAnswer = (ansIndex) => {
    if (!currentQ || (currentQ.answers && currentQ.answers.length <= 1)) {
      alert('Question requires at least one accepted answer.');
      return;
    }
    const newAnswers = currentQ.answers.filter((_, i) => i !== ansIndex);
    handleUpdateCurrentQ({ answers: newAnswers });
  };

  // Publish / Unpublish Toggle
  const handleTogglePublish = async () => {
    const isPub = quiz.status === 'PUBLISHED';
    const endpoint = isPub ? `/api/v1/quizzes/${quizId}/unpublish` : `/api/v1/quizzes/${quizId}/publish`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuiz(prev => ({ ...prev, status: isPub ? 'DRAFT' : 'PUBLISHED' }));
        alert(isPub ? 'Quiz reverted to DRAFT status.' : 'Quiz published successfully!');
      } else {
        alert(data.error?.message || 'Publish failed');
      }
    } catch {
      alert('Network error during publish');
    }
  };

  // Save current question to Question Bank
  const handleSaveToQuestionBank = async () => {
    if (!currentQ || !currentQ.question_text.trim()) {
      alert('Question text cannot be blank');
      return;
    }
    try {
      const res = await fetch('/api/v1/question-bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: currentQ.question_text.slice(0, 40) + '...',
          question_text: currentQ.question_text,
          question_type: currentQ.question_type,
          category: quiz.category || 'General',
          difficulty: quiz.difficulty || 'MEDIUM',
          marks: currentQ.marks,
          explanation: currentQ.explanation,
          options_data: ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(currentQ.question_type) ? currentQ.options : currentQ.answers
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Question saved to Question Bank successfully!');
      } else {
        alert(data.error?.message || 'Failed to save question');
      }
    } catch {
      alert('Network error while saving to bank');
    }
  };

  // Load and Import from Bank
  const handleOpenBankModal = async () => {
    setShowBankImport(true);
    setBankLoading(true);
    try {
      const res = await fetch('/api/v1/question-bank', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setBankQuestions(data.data.questions || []);
      }
    } catch {
      alert('Failed to load bank questions');
    } finally {
      setBankLoading(false);
    }
  };

  const handleImportQuestionFromBank = (bankQ) => {
    const newQ = {
      id: 'imported_' + Date.now(),
      question_text: bankQ.question_text,
      question_type: bankQ.question_type,
      marks: bankQ.marks,
      time_limit_sec: 30,
      explanation: bankQ.explanation || '',
      options: ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(bankQ.question_type) ? (bankQ.options_data || []) : [],
      answers: ['FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL'].includes(bankQ.question_type) ? (bankQ.options_data || []) : [],
      settings: bankQ.settings || {}
    };

    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveQIndex(updated.length - 1);
    setShowBankImport(false);
    triggerAutosave(quiz, updated);
  };

  if (!quiz) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-[#94A3B8] font-mono">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
          Loading Quiz Studio Engine...
        </div>
      </div>
    );
  }

  const totalPoints = questions.reduce((acc, q) => acc + (parseFloat(q.marks) || 1), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-4 select-none pb-12">
      
      {/* Top Navbar */}
      <div className="dashboard-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 shadow-2xl backdrop-blur-md bg-[#0B111D]/95">
        
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (saveStatus === 'DIRTY' || saveStatus === 'SAVING') {
                if (!window.confirm('You have unsaved changes. Exit anyway?')) return;
              }
              onBack();
            }}
            className="p-2 rounded-xl bg-[#132238] hover:bg-[#1B2A44] text-[#94A3B8] hover:text-white transition-colors"
            title="Back to Quizzes"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="space-y-0.5">
            <input
              type="text"
              value={quiz.title}
              onChange={(e) => {
                const updated = { ...quiz, title: e.target.value };
                setQuiz(updated);
                triggerAutosave(updated, questions);
              }}
              placeholder="Enter Quiz Title..."
              className="bg-transparent text-lg font-bold text-white border-b border-transparent hover:border-[#1F304E] focus:border-[#34D399] px-1 py-0.5 outline-none transition-all w-64 md:w-80 truncate"
            />
            <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <span className="px-2 py-0.5 rounded bg-[#132238] text-[#94A3B8] font-mono font-bold">
                {quiz.category}
              </span>
              <span>&bull;</span>
              <span>{quiz.difficulty}</span>
              <span>&bull;</span>
              <span className="text-[#34D399] font-mono">v{quiz.version}</span>
            </div>
          </div>
        </div>

        {/* Center: Autosave Status Indicator */}
        <div className="flex items-center gap-2">
          {saveStatus === 'SAVED' && (
            <span className="px-3 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 size={13} />
              All changes saved
            </span>
          )}
          {saveStatus === 'SAVING' && (
            <span className="px-3 py-1 rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] text-xs font-semibold flex items-center gap-1.5 animate-pulse">
              <span className="w-2.5 h-2.5 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
              Autosaving...
            </span>
          )}
          {saveStatus === 'DIRTY' && (
            <span className="px-3 py-1 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-semibold flex items-center gap-1.5">
              <Clock size={13} />
              Unsaved changes
            </span>
          )}
          {saveStatus === 'ERROR' && (
            <span className="px-3 py-1 rounded-full bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-[#F43F5E] text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle size={13} />
              Save error
            </span>
          )}

          {/* Quick Metrics */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1 bg-[#121D32] rounded-xl text-xs text-[#94A3B8]">
            <span>{questions.length} Questions</span>
            <span>&bull;</span>
            <span className="text-white font-bold">{totalPoints} Points</span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          
          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary text-xs py-2 px-3 gap-1.5"
            title="Configure Quiz Settings"
          >
            <Settings size={14} />
            Settings
          </button>

          {/* Preview */}
          <button
            onClick={() => onOpenPreview(quizId)}
            className="btn-secondary text-xs py-2 px-3 gap-1.5 text-white hover:text-[#06B6D4]"
            title="Preview as Student"
          >
            <Eye size={14} />
            Preview
          </button>

          {/* Publish / Unpublish */}
          <button
            onClick={handleTogglePublish}
            className={`text-xs py-2 px-4 rounded-xl font-bold transition-all ${
              quiz.status === 'PUBLISHED'
                ? 'bg-[#1F293D] text-[#F43F5E] hover:bg-[#F43F5E]/15 border border-[#F43F5E]/30'
                : 'btn-emerald-primary shadow-lg shadow-[#10B981]/20'
            }`}
          >
            {quiz.status === 'PUBLISHED' ? 'Unpublish' : 'Publish Quiz'}
          </button>

        </div>

      </div>

      {/* Main Studio Body: Sidebar + Question Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Questions List (4 cols) */}
        <div className="lg:col-span-4 dashboard-card p-4 space-y-3">
          
          <div className="flex items-center justify-between pb-2 border-b border-[#1B2A44]">
            <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-[#34D399]" />
              Questions ({questions.length})
            </p>

            <button
              onClick={handleOpenBankModal}
              className="text-[11px] text-[#06B6D4] hover:underline flex items-center gap-1 font-semibold"
            >
              <Database size={13} />
              From Bank
            </button>
          </div>

          {/* Questions Thumbnails */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isActive = idx === activeQIndex;
              return (
                <div
                  key={q.id || idx}
                  onClick={() => setActiveQIndex(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isActive
                      ? 'bg-[#132238] border-[#34D399] shadow-lg shadow-[#10B981]/10'
                      : 'bg-[#0E1626] border-[#1B2A44] hover:border-[#2D436B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-[#34D399] text-[#042F2E]' : 'bg-[#1E293B] text-[#94A3B8]'
                    }`}>
                      {idx + 1}
                    </span>

                    <div className="overflow-hidden">
                      <p className="text-xs font-medium text-white truncate">
                        {q.question_text || 'Untitled Question'}
                      </p>
                      <span className="text-[10px] text-[#64748B] uppercase font-mono">
                        {q.question_type.replace('_', ' ')} &bull; {q.marks} pt
                      </span>
                    </div>
                  </div>

                  {/* Actions for this question item */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveQuestion(idx, -1); }}
                      disabled={idx === 0}
                      className="p-1 hover:text-white disabled:opacity-30"
                      title="Move Up"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveQuestion(idx, 1); }}
                      disabled={idx === questions.length - 1}
                      className="p-1 hover:text-white disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicateQuestion(idx); }}
                      className="p-1 hover:text-[#06B6D4]"
                      title="Duplicate Question"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(idx); }}
                      className="p-1 hover:text-[#F43F5E]"
                      title="Delete Question"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Question Button with Type Picker Menu */}
          <div className="relative pt-2 border-t border-[#1B2A44]">
            <button
              onClick={() => setShowAddTypeMenu(!showAddTypeMenu)}
              className="btn-emerald-primary w-full text-xs py-2.5 font-bold gap-2"
            >
              <Plus size={15} />
              Add Question
            </button>

            {showAddTypeMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-[#0E1626] border border-[#1F304E] rounded-2xl shadow-2xl z-40 space-y-1 animate-fadeIn">
                <p className="text-[10px] uppercase font-bold text-[#64748B] px-3 py-1">Choose Question Type</p>
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t.type}
                    onClick={() => handleAddQuestion(t.type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left hover:bg-[#132238] hover:text-[#34D399] transition-colors"
                  >
                    <t.icon size={15} className="text-[#34D399] shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{t.label}</p>
                      <p className="text-[10px] text-[#64748B]">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Question Editor (8 cols) */}
        <div className="lg:col-span-8 dashboard-card p-6 space-y-6">
          
          {currentQ ? (
            <>
              {/* Question Header & Type Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#10B981]/20 border border-[#10B981]/30 text-[#34D399] font-black text-sm flex items-center justify-center">
                    {activeQIndex + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Question #{activeQIndex + 1} Editor</h3>
                    <p className="text-[11px] text-[#64748B]">Configure prompt, answer choices, and scoring</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Question Type Selector */}
                  <select
                    value={currentQ.question_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let opts = currentQ.options;
                      let ans = currentQ.answers;
                      if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(newType) && (!opts || opts.length === 0)) {
                        opts = [
                          { option_key: 'A', option_text: 'Option 1', is_correct: true },
                          { option_key: 'B', option_text: 'Option 2', is_correct: false }
                        ];
                      }
                      if (['FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL'].includes(newType) && (!ans || ans.length === 0)) {
                        ans = [{ expected_answer: '', is_case_sensitive: false }];
                      }
                      handleUpdateCurrentQ({ question_type: newType, options: opts, answers: ans });
                    }}
                    className="input-field text-xs py-1.5 font-semibold text-[#34D399]"
                  >
                    {QUESTION_TYPES.map(t => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>

                  {/* Points Input */}
                  <div className="flex items-center gap-1 bg-[#132238] border border-[#1F304E] rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold text-[#64748B]">Pts:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.25"
                      value={currentQ.marks}
                      onChange={(e) => handleUpdateCurrentQ({ marks: parseFloat(e.target.value) || 1.0 })}
                      className="w-12 bg-transparent text-xs font-bold text-white text-center outline-none"
                    />
                  </div>

                  {/* Save to Bank Action */}
                  <button
                    onClick={handleSaveToQuestionBank}
                    className="p-2 rounded-xl bg-[#132238] hover:bg-[#1B2A44] text-[#06B6D4] hover:text-white transition-colors"
                    title="Save this question to Question Bank"
                  >
                    <Database size={15} />
                  </button>
                </div>
              </div>

              {/* Question Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#94A3B8]">
                  Question Prompt / Text
                </label>
                <textarea
                  rows={3}
                  value={currentQ.question_text}
                  onChange={(e) => handleUpdateCurrentQ({ question_text: e.target.value })}
                  placeholder="Enter the question text here... (e.g. What is the chemical symbol for Gold?)"
                  className="input-field text-sm leading-relaxed"
                />
              </div>

              {/* Dynamic Answer Editor by Type */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    {currentQ.question_type.includes('MCQ') ? 'Answer Choices & Correct Marking' : 'Accepted Answer Rules'}
                  </label>
                  {currentQ.question_type === 'MCQ_MULTI' && (
                    <span className="text-[11px] text-[#A78BFA] font-medium">
                      Multi-select: Check all options that apply
                    </span>
                  )}
                </div>

                {/* 1. Single Choice & Multi-Select MCQ */}
                {(currentQ.question_type === 'MCQ_SINGLE' || currentQ.question_type === 'MCQ_MULTI') && (
                  <div className="space-y-3">
                    {currentQ.options && currentQ.options.map((opt, optIdx) => (
                      <div
                        key={opt.id || optIdx}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                          opt.is_correct
                            ? 'bg-[#10B981]/10 border-[#10B981]/40 shadow-sm shadow-[#10B981]/5'
                            : 'bg-[#121D32] border-[#1F304E]'
                        }`}
                      >
                        {/* Radio / Checkbox Trigger */}
                        <button
                          type="button"
                          onClick={() => handleSelectCorrectOption(optIdx)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs transition-colors shrink-0 ${
                            opt.is_correct
                              ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/30'
                              : 'bg-[#1B2A44] text-[#94A3B8] hover:bg-[#2D436B]'
                          }`}
                          title={opt.is_correct ? 'Correct Answer' : 'Click to mark as correct'}
                        >
                          {opt.is_correct ? '✓' : opt.option_key || String.fromCharCode(65 + optIdx)}
                        </button>

                        {/* Option Text Input */}
                        <input
                          type="text"
                          value={opt.option_text}
                          onChange={(e) => handleUpdateOption(optIdx, { option_text: e.target.value })}
                          placeholder={`Option ${optIdx + 1} text...`}
                          className="bg-transparent text-xs text-white outline-none flex-1"
                        />

                        {/* Delete Option */}
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(optIdx)}
                          className="text-[#64748B] hover:text-[#F43F5E] p-1 transition-colors"
                          title="Delete option"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="btn-secondary text-xs py-2 px-3 gap-1.5 w-full justify-center"
                    >
                      <Plus size={14} />
                      Add Choice
                    </button>
                  </div>
                )}

                {/* 2. True / False */}
                {currentQ.question_type === 'TRUE_FALSE' && (
                  <div className="grid grid-cols-2 gap-4">
                    {currentQ.options && currentQ.options.map((opt, optIdx) => (
                      <div
                        key={opt.option_key}
                        onClick={() => handleSelectCorrectOption(optIdx)}
                        className={`p-5 rounded-2xl border text-center cursor-pointer transition-all ${
                          opt.is_correct
                            ? 'bg-[#10B981]/15 border-[#34D399] text-white shadow-lg shadow-[#10B981]/10'
                            : 'bg-[#121D32] border-[#1F304E] text-[#94A3B8] hover:border-[#2D436B]'
                        }`}
                      >
                        <p className="text-base font-extrabold">{opt.option_text}</p>
                        <span className={`text-[11px] font-semibold mt-1 inline-block ${opt.is_correct ? 'text-[#34D399]' : 'text-[#64748B]'}`}>
                          {opt.is_correct ? 'Designated Correct Answer' : 'Click to select'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Fill in the Blank / Short Answer */}
                {(currentQ.question_type === 'FILL_BLANK' || currentQ.question_type === 'SHORT_ANSWER') && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#94A3B8]">
                      Enter acceptable correct answers. Automatic grading matches student input against these variants:
                    </p>

                    {currentQ.answers && currentQ.answers.map((ans, ansIdx) => (
                      <div key={ansIdx} className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-[#34D399]">
                          #{ansIdx + 1}
                        </span>

                        <input
                          type="text"
                          value={ans.expected_answer}
                          onChange={(e) => handleUpdateAnswer(ansIdx, { expected_answer: e.target.value })}
                          placeholder="e.g. Photosynthesis"
                          className="bg-transparent text-xs text-white outline-none flex-1 font-mono"
                        />

                        <label className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ans.is_case_sensitive}
                            onChange={(e) => handleUpdateAnswer(ansIdx, { is_case_sensitive: e.target.checked })}
                            className="rounded bg-[#0B111D] border-[#1F304E]"
                          />
                          Case Sensitive
                        </label>

                        <button
                          type="button"
                          onClick={() => handleDeleteAnswer(ansIdx)}
                          className="text-[#64748B] hover:text-[#F43F5E] p-1"
                          title="Delete Answer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddAnswer}
                      className="btn-secondary text-xs py-2 px-3 gap-1.5"
                    >
                      <Plus size={14} />
                      Add Alternative Accepted Answer
                    </button>
                  </div>
                )}

                {/* 4. Numerical Answer */}
                {currentQ.question_type === 'NUMERICAL' && (
                  <div className="space-y-3 p-4 rounded-2xl bg-[#121D32] border border-[#1F304E]">
                    <p className="text-xs text-[#94A3B8]">
                      Define the target numerical value and acceptable tolerance margin:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                          Correct Numeric Value
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={currentQ.answers?.[0]?.expected_answer || ''}
                          onChange={(e) => handleUpdateAnswer(0, { expected_answer: e.target.value })}
                          placeholder="e.g. 9.8"
                          className="input-field text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                          Tolerance Range (&plusmn;)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={currentQ.answers?.[0]?.numeric_tolerance || 0}
                          onChange={(e) => handleUpdateAnswer(0, { numeric_tolerance: parseFloat(e.target.value) || 0.0 })}
                          placeholder="e.g. 0.05"
                          className="input-field text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Explanation Field */}
              <div className="space-y-1.5 pt-4 border-t border-[#1B2A44]">
                <label className="block text-xs font-semibold text-[#94A3B8]">
                  Pedagogical Solution / Explanation (Shown after completion)
                </label>
                <textarea
                  rows={2}
                  value={currentQ.explanation}
                  onChange={(e) => handleUpdateCurrentQ({ explanation: e.target.value })}
                  placeholder="Provide a step-by-step explanation or reference for learners..."
                  className="input-field text-xs leading-relaxed"
                />
              </div>

            </>
          ) : (
            <div className="text-center py-16 text-xs text-[#94A3B8]">
              No question selected. Click "Add Question" to begin.
            </div>
          )}

        </div>

      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-xl w-full p-6 space-y-5 animate-fadeIn max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings size={18} className="text-[#34D399]" />
                Quiz Settings & Policies
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-[#94A3B8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Category & Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Subject / Category</label>
                  <select
                    value={quiz.category}
                    onChange={(e) => {
                      const updated = { ...quiz, category: e.target.value };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="input-field text-xs"
                  >
                    <option value="General">General</option>
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="History">History</option>
                    <option value="Technology">Technology</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Difficulty</label>
                  <select
                    value={quiz.difficulty}
                    onChange={(e) => {
                      const updated = { ...quiz, difficulty: e.target.value };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="input-field text-xs"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              {/* Time Limit & Passing Percentage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Time Limit (Seconds, 0 = Untimed)</label>
                  <input
                    type="number"
                    min="0"
                    step="30"
                    value={quiz.time_limit_sec}
                    onChange={(e) => {
                      const updated = { ...quiz, time_limit_sec: parseInt(e.target.value) || 0 };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="input-field text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Passing Threshold (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={quiz.passing_percentage}
                    onChange={(e) => {
                      const updated = { ...quiz, passing_percentage: parseInt(e.target.value) || 60 };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>

              {/* Shuffle & Negative Marking Toggles */}
              <div className="p-4 rounded-xl bg-[#121D32] border border-[#1F304E] space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Shuffle Questions for Students</span>
                  <input
                    type="checkbox"
                    checked={Boolean(quiz.shuffle_questions)}
                    onChange={(e) => {
                      const updated = { ...quiz, shuffle_questions: e.target.checked ? 1 : 0 };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="rounded bg-[#0B111D]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span>Shuffle Answer Options</span>
                  <input
                    type="checkbox"
                    checked={Boolean(quiz.shuffle_options)}
                    onChange={(e) => {
                      const updated = { ...quiz, shuffle_options: e.target.checked ? 1 : 0 };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="rounded bg-[#0B111D]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span>Enable Negative Marking (-0.25 penalty)</span>
                  <input
                    type="checkbox"
                    checked={Boolean(quiz.negative_marking)}
                    onChange={(e) => {
                      const updated = { ...quiz, negative_marking: e.target.checked ? 1 : 0 };
                      setQuiz(updated);
                      triggerAutosave(updated, questions);
                    }}
                    className="rounded bg-[#0B111D]"
                  />
                </label>
              </div>

              {/* Explanation Visibility */}
              <div>
                <label className="block font-semibold text-[#94A3B8] mb-1">Show Explanations</label>
                <select
                  value={quiz.show_explanations}
                  onChange={(e) => {
                    const updated = { ...quiz, show_explanations: e.target.value };
                    setQuiz(updated);
                    triggerAutosave(updated, questions);
                  }}
                  className="input-field text-xs"
                >
                  <option value="ALWAYS">Always visible</option>
                  <option value="AFTER_SUBMIT">Only after submission</option>
                  <option value="NEVER">Never visible</option>
                </select>
              </div>

            </div>

            <div className="pt-3 border-t border-[#1B2A44] flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="btn-emerald-primary text-xs py-2 px-5 font-bold"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Import Modal */}
      {showBankImport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-2xl w-full p-6 space-y-4 animate-fadeIn max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database size={18} className="text-[#06B6D4]" />
                Import from Question Bank
              </h3>
              <button onClick={() => setShowBankImport(false)} className="text-[#94A3B8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            {bankLoading ? (
              <p className="text-xs text-[#94A3B8] py-8 text-center">Loading Question Bank items...</p>
            ) : bankQuestions.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#94A3B8]">
                Your Question Bank is currently empty. You can save any question to the bank from the editor!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {bankQuestions.map((bankQ) => (
                  <div
                    key={bankQ.id}
                    className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between gap-3 hover:border-[#34D399] transition-all"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{bankQ.question_text}</p>
                      <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-1 font-mono">
                        <span>{bankQ.question_type}</span>
                        <span>&bull;</span>
                        <span>{bankQ.category}</span>
                        <span>&bull;</span>
                        <span>{bankQ.marks} pt</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleImportQuestionFromBank(bankQ)}
                      className="btn-emerald-primary text-xs py-1.5 px-3 shrink-0"
                    >
                      Import
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
