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
  Share2,
  BookOpen,
  FolderInput,
  Check
} from 'lucide-react';
import SubjectSelector from '../components/SubjectSelector';

const QUESTION_TYPES = [
  { type: 'MCQ_SINGLE', label: 'Single MCQ', icon: HelpCircle, desc: 'Multiple options, 1 correct' },
  { type: 'MCQ_MULTI', label: 'Multiple MCQ', icon: CheckSquare, desc: 'Multiple options, $\\ge 1$ correct' },
  { type: 'TRUE_FALSE', label: 'True / False', icon: Binary, desc: 'True or False choice' },
  { type: 'FILL_BLANK', label: 'Fill in Blanks', icon: FileText, desc: 'Text with accepted variants' },
  { type: 'SHORT_ANSWER', label: 'Short Answer', icon: FileText, desc: 'Concise text response' },
  { type: 'NUMERICAL', label: 'Numerical Answer', icon: Hash, desc: 'Numeric value with tolerance' }
];

export default function QuizStudioView({ quizId, onBack, onOpenPreview }) {
  const { accessToken } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  // Autosave status: 'SAVED' | 'SAVING' | 'DIRTY' | 'ERROR'
  const [saveStatus, setSaveStatus] = useState('SAVED');
  const [saveError, setSaveError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTab, setBankTab] = useState('quizzes'); // 'quizzes' | 'individual'
  
  // Bank import data
  const [bankQuizzes, setBankQuizzes] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [selectedBankQIds, setSelectedBankQIds] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);

  // Bank Auto-save and sync states for new/written questions
  const [autoSaveNewToBank, setAutoSaveNewToBank] = useState(true);
  const [bankSavedMap, setBankSavedMap] = useState({});
  const [savingBankQIdx, setSavingBankQIdx] = useState(null);

  // Autosave timer ref
  const autosaveTimerRef = useRef(null);

  // Load Quiz
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

  // Debounced Autosave
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
            autoSaveQuestionsToBank: autoSaveNewToBank,
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
    }, 1200);
  };

  // Warn on unmount if dirty
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

  // Show toast notification
  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Google Forms: Add Question Below a specific index
  const handleAddQuestionBelow = (index, type = 'MCQ_SINGLE') => {
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
      id: 'q_' + Date.now(),
      question_text: '',
      question_type: type,
      marks: 1.0,
      time_limit_sec: 30,
      explanation: '',
      options: initialOptions,
      answers: initialAnswers,
      settings: {},
      saveToBank: autoSaveNewToBank,
      bankSaved: false
    };

    const updated = [...questions];
    updated.splice(index + 1, 0, newQuestion);
    setQuestions(updated);
    triggerAutosave(quiz, updated);
  };

  // Update specific question
  const handleUpdateQuestion = (index, updates) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
    triggerAutosave(quiz, updated);
  };

  // Delete question
  const handleDeleteQuestion = (index) => {
    if (questions.length <= 1) {
      alert('A quiz must contain at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    triggerAutosave(quiz, updated);
  };

  // Duplicate question
  const handleDuplicateQuestion = (index) => {
    const target = questions[index];
    const clone = {
      ...target,
      id: 'clone_' + Date.now(),
      question_text: `${target.question_text} (Copy)`,
      options: target.options ? target.options.map(o => ({ ...o, id: undefined })) : [],
      answers: target.answers ? target.answers.map(a => ({ ...a, id: undefined })) : [],
      saveToBank: autoSaveNewToBank,
      bankSaved: false
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, clone);
    setQuestions(updated);
    triggerAutosave(quiz, updated);
  };

  // Move Question
  const handleMoveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
    triggerAutosave(quiz, updated);
  };

  // Options Handlers for MCQ inside a question
  const handleAddOption = (qIdx) => {
    const q = questions[qIdx];
    const nextKey = String.fromCharCode(65 + (q.options?.length || 0));
    const newOptions = [
      ...(q.options || []),
      { option_key: nextKey, option_text: `Option ${(q.options?.length || 0) + 1}`, is_correct: false }
    ];
    handleUpdateQuestion(qIdx, { options: newOptions });
  };

  const handleUpdateOption = (qIdx, optIdx, updates) => {
    const q = questions[qIdx];
    const newOptions = [...(q.options || [])];
    newOptions[optIdx] = { ...newOptions[optIdx], ...updates };
    handleUpdateQuestion(qIdx, { options: newOptions });
  };

  const handleDeleteOption = (qIdx, optIdx) => {
    const q = questions[qIdx];
    if (q.options && q.options.length <= 2) {
      alert('MCQ questions require at least 2 options.');
      return;
    }
    const newOptions = q.options.filter((_, i) => i !== optIdx);
    handleUpdateQuestion(qIdx, { options: newOptions });
  };

  const handleSelectCorrectOption = (qIdx, optIdx) => {
    const q = questions[qIdx];
    if (!q || !q.options) return;
    if (q.question_type === 'MCQ_SINGLE' || q.question_type === 'TRUE_FALSE') {
      const newOptions = q.options.map((opt, i) => ({
        ...opt,
        is_correct: i === optIdx
      }));
      handleUpdateQuestion(qIdx, { options: newOptions });
    } else if (q.question_type === 'MCQ_MULTI') {
      const newOptions = [...q.options];
      newOptions[optIdx].is_correct = !newOptions[optIdx].is_correct;
      handleUpdateQuestion(qIdx, { options: newOptions });
    }
  };

  // Publish / Unpublish
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
        showToast(isPub ? 'Quiz reverted to DRAFT status.' : 'Quiz published successfully!');
      } else {
        alert(data.error?.message || 'Publish failed');
      }
    } catch {
      alert('Network error during publish');
    }
  };

  // Save SINGLE Question to Bank
  const handleSaveQuestionToBank = async (q, qIdx) => {
    if (!q.question_text || !q.question_text.trim()) {
      showToast('Question prompt cannot be empty when saving to Bank', 'error');
      return;
    }

    setSavingBankQIdx(qIdx);
    const payloadOptions = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type) ? (q.options || []) : (q.answers || []);

    try {
      const res = await fetch('/api/v1/question-bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: q.question_text.slice(0, 45) + (q.question_text.length > 45 ? '...' : ''),
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          category: quiz.category || 'General',
          difficulty: quiz.difficulty || 'MEDIUM',
          marks: q.marks || 1.0,
          explanation: q.explanation || '',
          options_data: payloadOptions
        })
      });
      const data = await res.json();
      if (data.success) {
        setBankSavedMap(prev => ({ ...prev, [q.id || qIdx]: true }));
        handleUpdateQuestion(qIdx, { saveToBank: true, bankSaved: true });
        showToast(`Question #${qIdx + 1} saved to Question Bank under Subject: "${quiz.category || 'General'}"!`);
      } else {
        alert(data.error?.message || 'Failed to save question to bank');
      }
    } catch (err) {
      alert('Network communication error while saving to bank');
    } finally {
      setSavingBankQIdx(null);
    }
  };

  // Save WHOLE Quiz to Bank
  const handleSaveWholeQuizToBank = async () => {
    try {
      const res = await fetch('/api/v1/question-bank/save-entire-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          quizId,
          category: quiz.category
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.data.message);
      } else {
        alert(data.error?.message || 'Failed to save whole quiz to bank');
      }
    } catch {
      alert('Network error while saving whole quiz');
    }
  };

  // Open Question Bank Import Modal
  const handleOpenBankModal = async () => {
    setShowBankModal(true);
    setBankLoading(true);
    try {
      // 1. Fetch quizzes (for whole quiz or quiz-based questions)
      const qRes = await fetch('/api/v1/quizzes', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const qData = await qRes.json();
      if (qData.success) {
        setBankQuizzes(qData.data.quizzes.filter(q => q.id !== quizId));
      }

      // 2. Fetch individual bank questions
      const bRes = await fetch('/api/v1/question-bank', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const bData = await bRes.json();
      if (bData.success) {
        setBankQuestions(bData.data.questions || []);
      }
    } catch (err) {
      alert('Failed to load bank data');
    } finally {
      setBankLoading(false);
    }
  };

  // Import Whole Quiz into this Studio
  const handleImportWholeQuiz = async (sourceQuizId) => {
    try {
      const res = await fetch(`/api/v1/quizzes/${quizId}/import-from-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ sourceQuizId })
      });
      const data = await res.json();
      if (data.success) {
        setShowBankModal(false);
        showToast(data.data.message);
        // Reload quiz
        const fresh = await fetch(`/api/v1/quizzes/${quizId}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const freshData = await fresh.json();
        if (freshData.success) {
          setQuestions(freshData.data.quiz.questions || []);
        }
      }
    } catch (err) {
      alert('Failed to import quiz');
    }
  };

  // Import Selected Bank Questions
  const handleImportSelectedBankQuestions = async () => {
    if (selectedBankQIds.length === 0) {
      alert('Please select at least one question to import');
      return;
    }
    try {
      const res = await fetch('/api/v1/question-bank/bulk-import-to-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          targetQuizId: quizId,
          questionIds: selectedBankQIds
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowBankModal(false);
        showToast(data.data.message);
        setSelectedBankQIds([]);
        // Reload quiz
        const fresh = await fetch(`/api/v1/quizzes/${quizId}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const freshData = await fresh.json();
        if (freshData.success) {
          setQuestions(freshData.data.quiz.questions || []);
        }
      }
    } catch (err) {
      alert('Failed to import selected questions');
    }
  };

  if (!quiz) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-[#94A3B8] font-mono">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
          Loading Google Forms Studio Engine...
        </div>
      </div>
    );
  }

  const totalPoints = questions.reduce((acc, q) => acc + (parseFloat(q.marks) || 1), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 dashboard-card p-3.5 border-l-4 border-l-[#10B981] text-xs text-[#34D399] font-bold shadow-2xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Floating Command Bar */}
      <div className="dashboard-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-4 z-30 shadow-2xl backdrop-blur-md bg-[#0B111D]/95">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (saveStatus === 'DIRTY' || saveStatus === 'SAVING') {
                if (!window.confirm('You have unsaved changes. Exit anyway?')) return;
              }
              onBack();
            }}
            className="p-2 rounded-xl bg-[#132238] hover:bg-[#1B2A44] text-[#94A3B8] hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <h2 className="text-sm font-extrabold text-white truncate max-w-xs sm:max-w-md">
              {quiz.title || 'Untitled Quiz'}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <span className="text-[#34D399] font-semibold">Subject: {quiz.category || 'General'}</span>
              <span>&bull;</span>
              <span>{questions.length} Questions</span>
              <span>&bull;</span>
              <span>{totalPoints} Pts</span>
            </div>
          </div>
        </div>

        {/* Center: Autosave Status */}
        <div className="flex items-center gap-2">
          {saveStatus === 'SAVED' && (
            <span className="px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#34D399] text-[11px] font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          {saveStatus === 'SAVING' && (
            <span className="px-2.5 py-1 rounded-full bg-[#06B6D4]/15 text-[#06B6D4] text-[11px] font-semibold flex items-center gap-1.5 animate-pulse">
              <span className="w-2.5 h-2.5 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
              Autosaving...
            </span>
          )}
          {saveStatus === 'DIRTY' && (
            <span className="px-2.5 py-1 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[11px] font-semibold flex items-center gap-1.5">
              <Clock size={13} /> Unsaved changes
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenBankModal}
            className="btn-secondary text-xs py-2 px-3 gap-1.5 text-[#06B6D4]"
            title="Import whole quiz or questions from Bank"
          >
            <FolderInput size={14} />
            Import from Bank
          </button>

          <button
            onClick={() => onOpenPreview(quizId)}
            className="btn-secondary text-xs py-2 px-3 gap-1.5"
            title="Preview as Student"
          >
            <Eye size={14} />
            Preview
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary text-xs py-2 px-3 gap-1.5"
            title="Quiz Settings"
          >
            <Settings size={14} />
          </button>

          <button
            onClick={handleTogglePublish}
            className={`text-xs py-2 px-3.5 rounded-xl font-bold transition-all ${
              quiz.status === 'PUBLISHED'
                ? 'bg-[#1F293D] text-[#F43F5E] hover:bg-[#F43F5E]/15'
                : 'btn-emerald-primary'
            }`}
          >
            {quiz.status === 'PUBLISHED' ? 'Unpublish' : 'Publish Quiz'}
          </button>
        </div>
      </div>

      {/* QUIZ HEADER CARD (Google Forms Inspired Top Section) */}
      <div className="dashboard-card p-6 space-y-4 border-t-4 border-t-[#10B981]">
        
        {/* Quiz Title & Subject Name Input */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
              Quiz Title (e.g. TQM Quiz)
            </label>
            <input
              type="text"
              value={quiz.title}
              onChange={(e) => {
                const updated = { ...quiz, title: e.target.value };
                setQuiz(updated);
                triggerAutosave(updated, questions);
              }}
              placeholder="e.g. TQM Quiz - Quality Assurance Assessment"
              className="w-full bg-transparent text-2xl font-black text-white border-b border-[#1F304E] hover:border-[#34D399] focus:border-[#34D399] pb-1 outline-none transition-all placeholder:text-[#64748B]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Subject Name Selector with "+ Add New Subject" */}
            <SubjectSelector
              value={quiz.category}
              onChange={(newSubj) => {
                const updated = { ...quiz, category: newSubj };
                setQuiz(updated);
                triggerAutosave(updated, questions);
              }}
              label="Subject Name (e.g. TQM, Computer Science)"
            />

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Quiz Description / Instructions
              </label>
              <input
                type="text"
                value={quiz.description}
                onChange={(e) => {
                  const updated = { ...quiz, description: e.target.value };
                  setQuiz(updated);
                  triggerAutosave(updated, questions);
                }}
                placeholder="Brief instructions for learners..."
                className="input-field text-xs py-2"
              />
            </div>
          </div>
        </div>

        {/* Header Action: Auto-sync to Bank & Save Whole Quiz to Bank */}
        <div className="pt-2 border-t border-[#1B2A44] flex flex-wrap items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden sm:inline">All edits autosaved to cloud</span>
            <span className="hidden sm:inline">&bull;</span>
            <label className="flex items-center gap-2 cursor-pointer select-none bg-[#132238] hover:bg-[#1B2A44] px-2.5 py-1 rounded-lg border border-[#1F304E] text-xs transition-colors">
              <input
                type="checkbox"
                checked={autoSaveNewToBank}
                onChange={(e) => {
                  setAutoSaveNewToBank(e.target.checked);
                  showToast(e.target.checked 
                    ? '⚡ Auto-sync enabled: Questions written in this quiz will automatically be added to Question Bank!' 
                    : 'Auto-sync disabled: You can still save individual questions using "Save to Bank".'
                  );
                }}
                className="rounded bg-[#1B2A44] border-[#2D436B] text-[#34D399] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="font-semibold flex items-center gap-1.5 text-white">
                <Database size={13} className="text-[#34D399]" />
                Auto-add new questions to Question Bank
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSaveWholeQuizToBank}
            className="text-xs text-[#34D399] hover:underline flex items-center gap-1.5 font-bold"
          >
            <Database size={13} />
            Save Whole Quiz to Question Bank
          </button>
        </div>
      </div>

      {/* GOOGLE FORMS QUESTION CARDS (Vertical Cascade) */}
      <div className="space-y-6">
        {questions.map((q, qIdx) => (
          <div key={q.id || qIdx} className="space-y-3">
            
            {/* Question Card */}
            <div className="dashboard-card p-6 space-y-4 hover:border-[#2D436B] transition-all relative group">
              
              {/* Question Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1B2A44]">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#10B981]/20 border border-[#10B981]/30 text-[#34D399] font-black text-xs flex items-center justify-center">
                    {qIdx + 1}
                  </span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Question #{qIdx + 1}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  
                  {/* Type Selector Dropdown */}
                  <select
                    value={q.question_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let opts = q.options;
                      let ans = q.answers;
                      if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(newType) && (!opts || opts.length === 0)) {
                        opts = [
                          { option_key: 'A', option_text: 'Option 1', is_correct: true },
                          { option_key: 'B', option_text: 'Option 2', is_correct: false },
                          { option_key: 'C', option_text: 'Option 3', is_correct: false },
                          { option_key: 'D', option_text: 'Option 4', is_correct: false }
                        ];
                      }
                      if (['FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL'].includes(newType) && (!ans || ans.length === 0)) {
                        ans = [{ expected_answer: '', is_case_sensitive: false }];
                      }
                      handleUpdateQuestion(qIdx, { question_type: newType, options: opts, answers: ans });
                    }}
                    className="input-field text-xs py-1.5 font-bold text-[#34D399] w-40"
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
                      value={q.marks}
                      onChange={(e) => handleUpdateQuestion(qIdx, { marks: parseFloat(e.target.value) || 1.0 })}
                      className="w-10 bg-transparent text-xs font-bold text-white text-center outline-none"
                    />
                  </div>

                </div>
              </div>

              {/* Question Prompt Textarea */}
              <div>
                <textarea
                  rows={2}
                  value={q.question_text}
                  onChange={(e) => handleUpdateQuestion(qIdx, { question_text: e.target.value })}
                  placeholder={`Question ${qIdx + 1} Prompt (e.g. What does TQM stand for?)`}
                  className="input-field text-sm font-semibold leading-relaxed"
                />
              </div>

              {/* OPTIONS / ANSWER CHOICES AREA (Google Forms Style) */}
              <div className="space-y-3 pt-1">
                
                {/* 1. Single Choice & Multiple Select MCQ */}
                {(q.question_type === 'MCQ_SINGLE' || q.question_type === 'MCQ_MULTI') && (
                  <div className="space-y-2.5">
                    {q.options && q.options.map((opt, optIdx) => (
                      <div
                        key={opt.id || optIdx}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                          opt.is_correct
                            ? 'bg-[#10B981]/15 border-[#34D399]'
                            : 'bg-[#121D32] border-[#1F304E] hover:border-[#2D436B]'
                        }`}
                      >
                        {/* Radio or Checkbox marker */}
                        <button
                          type="button"
                          onClick={() => handleSelectCorrectOption(qIdx, optIdx)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            opt.is_correct
                              ? 'bg-[#34D399] text-[#042F2E]'
                              : 'bg-[#1B2A44] text-[#94A3B8] hover:bg-[#2D436B]'
                          }`}
                          title="Click to mark correct answer"
                        >
                          {opt.is_correct ? '✓' : opt.option_key || String.fromCharCode(65 + optIdx)}
                        </button>

                        <input
                          type="text"
                          value={opt.option_text}
                          onChange={(e) => handleUpdateOption(qIdx, optIdx, { option_text: e.target.value })}
                          placeholder={`Option ${optIdx + 1}`}
                          className="bg-transparent text-xs text-white outline-none flex-1 font-medium"
                        />

                        <button
                          type="button"
                          onClick={() => handleDeleteOption(qIdx, optIdx)}
                          className="text-[#64748B] hover:text-[#F43F5E] p-1 transition-colors"
                          title="Remove option"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddOption(qIdx)}
                      className="btn-secondary text-xs py-2 px-3 gap-1.5 w-full justify-center"
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  </div>
                )}

                {/* 2. True / False */}
                {q.question_type === 'TRUE_FALSE' && (
                  <div className="grid grid-cols-2 gap-3">
                    {q.options && q.options.map((opt, optIdx) => (
                      <div
                        key={opt.option_key}
                        onClick={() => handleSelectCorrectOption(qIdx, optIdx)}
                        className={`p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                          opt.is_correct
                            ? 'bg-[#10B981]/15 border-[#34D399] text-white shadow-md shadow-[#10B981]/10'
                            : 'bg-[#121D32] border-[#1F304E] text-[#94A3B8] hover:border-[#2D436B]'
                        }`}
                      >
                        <p className="font-extrabold text-sm">{opt.option_text}</p>
                        <span className="text-[10px] text-[#34D399] mt-0.5 inline-block font-semibold">
                          {opt.is_correct ? '✓ Correct Answer' : 'Click to select'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Fill in Blank / Short Answer */}
                {(q.question_type === 'FILL_BLANK' || q.question_type === 'SHORT_ANSWER') && (
                  <div className="space-y-2 p-3 rounded-xl bg-[#121D32] border border-[#1F304E]">
                    <label className="text-[11px] text-[#94A3B8] block">Accepted Correct Answer:</label>
                    <input
                      type="text"
                      value={q.answers?.[0]?.expected_answer || ''}
                      onChange={(e) => {
                        const newAns = [{ ...(q.answers?.[0] || {}), expected_answer: e.target.value }];
                        handleUpdateQuestion(qIdx, { answers: newAns });
                      }}
                      placeholder="e.g. Total Quality Management"
                      className="input-field text-xs font-mono"
                    />
                  </div>
                )}

                {/* 4. Numerical Answer */}
                {q.question_type === 'NUMERICAL' && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#121D32] border border-[#1F304E]">
                    <div>
                      <label className="text-[11px] text-[#94A3B8] block mb-1">Target Numeric Value:</label>
                      <input
                        type="number"
                        step="any"
                        value={q.answers?.[0]?.expected_answer || ''}
                        onChange={(e) => {
                          const newAns = [{ ...(q.answers?.[0] || {}), expected_answer: e.target.value }];
                          handleUpdateQuestion(qIdx, { answers: newAns });
                        }}
                        placeholder="e.g. 100"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#94A3B8] block mb-1">Tolerance Margin (&plusmn;):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={q.answers?.[0]?.numeric_tolerance || 0}
                        onChange={(e) => {
                          const newAns = [{ ...(q.answers?.[0] || {}), numeric_tolerance: parseFloat(e.target.value) || 0 }];
                          handleUpdateQuestion(qIdx, { answers: newAns });
                        }}
                        placeholder="e.g. 0.5"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Explanation Field */}
              <div className="pt-2">
                <input
                  type="text"
                  value={q.explanation || ''}
                  onChange={(e) => handleUpdateQuestion(qIdx, { explanation: e.target.value })}
                  placeholder="Add an optional explanation or textbook reference for learners..."
                  className="w-full bg-transparent text-xs text-[#94A3B8] border-b border-[#1F304E] hover:border-[#34D399] pb-1 outline-none transition-all placeholder:text-[#64748B]"
                />
              </div>

              {/* Card Footer Actions (Duplicate, Delete, Move, Save to Bank) */}
              <div className="pt-3 border-t border-[#1B2A44] flex items-center justify-between text-xs text-[#94A3B8]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, -1)}
                    disabled={qIdx === 0}
                    className="p-1.5 hover:text-white disabled:opacity-30"
                    title="Move Question Up"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, 1)}
                    disabled={qIdx === questions.length - 1}
                    className="p-1.5 hover:text-white disabled:opacity-30"
                    title="Move Question Down"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateQuestion(qIdx)}
                    className="p-1.5 hover:text-[#06B6D4]"
                    title="Duplicate Question"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(qIdx)}
                    className="p-1.5 hover:text-[#F43F5E]"
                    title="Delete Question"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Save this Question to Bank Actions */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#34D399] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={q.saveToBank !== false}
                      onChange={(e) => {
                        handleUpdateQuestion(qIdx, { saveToBank: e.target.checked });
                      }}
                      className="rounded bg-[#132238] border-[#1F304E] text-[#34D399] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Save to Bank</span>
                  </label>

                  {bankSavedMap[q.id || qIdx] || q.bankSaved ? (
                    <div className="flex items-center gap-1 text-xs text-[#34D399] font-bold bg-[#10B981]/15 px-2.5 py-1 rounded-lg border border-[#10B981]/30">
                      <CheckCircle2 size={13} />
                      Saved in Bank
                      <button
                        type="button"
                        onClick={() => handleSaveQuestionToBank(q, qIdx)}
                        className="text-[10px] text-[#06B6D4] hover:underline ml-1 font-semibold"
                        title="Update Question Bank with latest edits"
                      >
                        (Update)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSaveQuestionToBank(q, qIdx)}
                      disabled={savingBankQIdx === qIdx}
                      className="text-xs text-[#06B6D4] hover:bg-[#06B6D4]/15 px-2.5 py-1 rounded-lg border border-[#06B6D4]/30 hover:underline flex items-center gap-1.5 font-semibold transition-all disabled:opacity-50"
                      title="Save this question directly into Question Bank"
                    >
                      {savingBankQIdx === qIdx ? (
                        <>
                          <span className="w-3 h-3 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
                          Saving to Bank...
                        </>
                      ) : (
                        <>
                          <Database size={13} />
                          Add to Bank
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Google Forms INLINE "+" ADD QUESTION BAR (Inserts right below this card) */}
            <div className="flex items-center justify-center py-1">
              <button
                type="button"
                onClick={() => handleAddQuestionBelow(qIdx, 'MCQ_SINGLE')}
                className="group flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#132238] border border-[#1F304E] hover:border-[#34D399] hover:bg-[#10B981]/15 text-xs font-bold text-[#94A3B8] hover:text-[#34D399] transition-all shadow-md"
                title="Add a new question directly below"
              >
                <Plus size={15} className="group-hover:rotate-90 transition-transform" />
                Add Question Below
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-xl w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings size={18} className="text-[#34D399]" />
                Quiz Configuration
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-[#94A3B8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Time Limit (Sec, 0 = untimed)</label>
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

              <div className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] space-y-2.5">
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
                  <span>Shuffle Answer Choices</span>
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
                  <span>Enable Negative Marking (-0.25 pt penalty)</span>
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
            </div>

            <div className="pt-3 border-t border-[#1B2A44] flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="btn-emerald-primary text-xs py-2 px-5 font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT FROM BANK MODAL (Whole Quiz or Particular Questions) */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-2xl w-full p-6 space-y-4 animate-fadeIn max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderInput size={18} className="text-[#06B6D4]" />
                Import Questions from Bank or Existing Quizzes
              </h3>
              <button onClick={() => setShowBankModal(false)} className="text-[#94A3B8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-[#1B2A44] pb-2">
              <button
                type="button"
                onClick={() => setBankTab('quizzes')}
                className={`text-xs py-1.5 px-3 rounded-lg font-bold transition-all ${
                  bankTab === 'quizzes' ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30' : 'text-[#94A3B8]'
                }`}
              >
                1. Select Whole Quiz
              </button>

              <button
                type="button"
                onClick={() => setBankTab('individual')}
                className={`text-xs py-1.5 px-3 rounded-lg font-bold transition-all ${
                  bankTab === 'individual' ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30' : 'text-[#94A3B8]'
                }`}
              >
                2. Select Specific Questions ({selectedBankQIds.length})
              </button>
            </div>

            {/* Tab 1: Whole Quiz Import */}
            {bankTab === 'quizzes' && (
              <div className="space-y-3">
                <p className="text-xs text-[#94A3B8]">
                  Select an entire existing quiz to clone all of its questions into this quiz:
                </p>

                {bankQuizzes.length === 0 ? (
                  <p className="text-xs text-[#64748B] py-6 text-center">No other quizzes found in your account.</p>
                ) : (
                  bankQuizzes.map((bQuiz) => (
                    <div
                      key={bQuiz.id}
                      className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between gap-3 hover:border-[#34D399] transition-all"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{bQuiz.title}</h4>
                        <span className="text-[10px] text-[#34D399]">
                          Subject: {bQuiz.category} &bull; {bQuiz.question_count || 0} Questions
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleImportWholeQuiz(bQuiz.id)}
                        className="btn-emerald-primary text-xs py-1.5 px-3 font-bold"
                      >
                        Import Whole Quiz
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Individual Questions Import */}
            {bankTab === 'individual' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Check specific questions to import:</span>
                  <button
                    type="button"
                    onClick={handleImportSelectedBankQuestions}
                    disabled={selectedBankQIds.length === 0}
                    className="btn-emerald-primary text-xs py-1.5 px-3 font-bold disabled:opacity-40"
                  >
                    Import Selected ({selectedBankQIds.length})
                  </button>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {bankQuestions.map((bQ) => {
                    const isSelected = selectedBankQIds.includes(bQ.id);
                    return (
                      <div
                        key={bQ.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedBankQIds(selectedBankQIds.filter(id => id !== bQ.id));
                          } else {
                            setSelectedBankQIds([...selectedBankQIds, bQ.id]);
                          }
                        }}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected ? 'bg-[#06B6D4]/15 border-[#06B6D4]' : 'bg-[#121D32] border-[#1F304E]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded bg-[#0B111D]"
                        />

                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-semibold text-white truncate">{bQ.question_text}</p>
                          <span className="text-[10px] text-[#64748B]">
                            {bQ.question_type} &bull; Subject: {bQ.category}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
