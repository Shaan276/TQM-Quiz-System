import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Database, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  HelpCircle, 
  CheckSquare, 
  Binary, 
  FileText, 
  Hash, 
  Sparkles, 
  X, 
  CheckCircle2, 
  Layers, 
  BookOpen, 
  Copy,
  ChevronDown,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import SubjectSelector from '../components/SubjectSelector';
import { formatQuestionCode } from '../utils/questionCode';

export default function QuestionBankView({ setActiveRoute }) {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'questions'
  const [questions, setQuestions] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // Expanded Quizzes in "By Quiz" view
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [expandedQuizQuestions, setExpandedQuizQuestions] = useState({});

  // Selection state (for whole quiz or individual questions)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Add Question Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQText, setNewQText] = useState('');
  const [newQCode, setNewQCode] = useState('');
  const [newQType, setNewQType] = useState('MCQ_SINGLE');
  const [newQSubject, setNewQSubject] = useState('TQM (Total Quality Management)');
  const [newQDifficulty, setNewQDifficulty] = useState('MEDIUM');
  const [newQMarks, setNewQMarks] = useState(1.0);
  const [newQExplanation, setNewQExplanation] = useState('');

  // Options for MCQ / True-False
  const [modalOptions, setModalOptions] = useState([
    { option_key: 'A', option_text: 'Option 1', is_correct: true },
    { option_key: 'B', option_text: 'Option 2', is_correct: false },
    { option_key: 'C', option_text: 'Option 3', is_correct: false },
    { option_key: 'D', option_text: 'Option 4', is_correct: false }
  ]);

  // Answers for Fill in Blank / Short Answer / Numerical
  const [modalAnswers, setModalAnswers] = useState([
    { expected_answer: '', is_case_sensitive: false, numeric_tolerance: 0.0 }
  ]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch bank questions
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (subject) params.append('category', subject);
      if (type) params.append('type', type);
      if (difficulty) params.append('difficulty', difficulty);

      const qRes = await fetch(`/api/v1/question-bank?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const qData = await qRes.json();
      if (qData.success) {
        setQuestions(qData.data.questions || []);
      }

      // 2. Fetch quizzes for "By Quiz" view
      const quizRes = await fetch(`/api/v1/quizzes?search=${encodeURIComponent(search.trim())}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const quizData = await quizRes.json();
      if (quizData.success) {
        setQuizzes(quizData.data.quizzes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [accessToken, search, subject, type, difficulty]);

  // Handle expanding a quiz to fetch its questions
  const handleToggleExpandQuiz = async (quizId) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
      return;
    }
    setExpandedQuizId(quizId);

    if (!expandedQuizQuestions[quizId]) {
      try {
        const res = await fetch(`/api/v1/quizzes/${quizId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.success) {
          setExpandedQuizQuestions(prev => ({
            ...prev,
            [quizId]: data.data.quiz.questions || []
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Option change in Modal
  const handleTypeChangeInModal = (newType) => {
    setNewQType(newType);
    if (newType === 'MCQ_SINGLE' || newType === 'MCQ_MULTI') {
      setModalOptions([
        { option_key: 'A', option_text: 'Option 1', is_correct: true },
        { option_key: 'B', option_text: 'Option 2', is_correct: false },
        { option_key: 'C', option_text: 'Option 3', is_correct: false },
        { option_key: 'D', option_text: 'Option 4', is_correct: false }
      ]);
    } else if (newType === 'TRUE_FALSE') {
      setModalOptions([
        { option_key: 'TRUE', option_text: 'True', is_correct: true },
        { option_key: 'FALSE', option_text: 'False', is_correct: false }
      ]);
    } else if (newType === 'FILL_BLANK' || newType === 'SHORT_ANSWER') {
      setModalAnswers([
        { expected_answer: '', is_case_sensitive: false }
      ]);
    } else if (newType === 'NUMERICAL') {
      setModalAnswers([
        { expected_answer: '0', numeric_tolerance: 0.0 }
      ]);
    }
  };

  const handleAddOptionToModal = () => {
    const nextKey = String.fromCharCode(65 + modalOptions.length);
    setModalOptions([
      ...modalOptions,
      { option_key: nextKey, option_text: `Option ${modalOptions.length + 1}`, is_correct: false }
    ]);
  };

  const handleUpdateModalOption = (index, updates) => {
    const updated = [...modalOptions];
    updated[index] = { ...updated[index], ...updates };
    setModalOptions(updated);
  };

  const handleDeleteModalOption = (index) => {
    if (modalOptions.length <= 2) {
      alert('Questions require at least 2 options.');
      return;
    }
    setModalOptions(modalOptions.filter((_, i) => i !== index));
  };

  const handleSelectModalCorrect = (index) => {
    if (newQType === 'MCQ_SINGLE' || newQType === 'TRUE_FALSE') {
      const updated = modalOptions.map((opt, i) => ({
        ...opt,
        is_correct: i === index
      }));
      setModalOptions(updated);
    } else if (newQType === 'MCQ_MULTI') {
      const updated = [...modalOptions];
      updated[index].is_correct = !updated[index].is_correct;
      setModalOptions(updated);
    }
  };

  // Delete question from bank
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question from your Question Bank?')) return;
    try {
      const res = await fetch(`/api/v1/question-bank/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setFeedbackMsg({ type: 'success', text: 'Question removed from Question Bank.' });
      }
    } catch {
      alert('Failed to delete question');
    }
  };

  // Submit Add Question Form
  const handleCreateBankQuestion = async (e) => {
    e.preventDefault();
    if (!newQText.trim()) {
      alert('Question prompt is required');
      return;
    }

    let payloadOptions = [];
    if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(newQType)) {
      if (modalOptions.length < 2) {
        alert('Please provide at least 2 answer options.');
        return;
      }
      if (!modalOptions.some(o => o.is_correct)) {
        alert('Please mark at least one correct option.');
        return;
      }
      payloadOptions = modalOptions;
    } else {
      if (!modalAnswers[0]?.expected_answer?.trim()) {
        alert('Please provide at least one accepted answer.');
        return;
      }
      payloadOptions = modalAnswers;
    }

    try {
      const res = await fetch('/api/v1/question-bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: newQText.slice(0, 40) + '...',
          question_text: newQText.trim(),
          question_type: newQType,
          category: newQSubject.trim() || 'General',
          difficulty: newQDifficulty,
          marks: parseFloat(newQMarks) || 1.0,
          explanation: newQExplanation.trim(),
          options_data: payloadOptions,
          question_code: newQCode.trim() || formatQuestionCode(newQSubject, newQType, newQDifficulty, questions.length + 1)
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewQText('');
        setNewQExplanation('');
        setFeedbackMsg({ type: 'success', text: 'Question saved to Question Bank successfully!' });
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to save question to bank');
      }
    } catch {
      alert('Network error while saving question');
    }
  };

  // Save whole quiz to bank
  const handleSaveWholeQuizToBank = async (quiz) => {
    try {
      const res = await fetch('/api/v1/question-bank/save-entire-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          quizId: quiz.id,
          category: quiz.category
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: data.data.message });
        fetchData();
      } else {
        alert(data.error?.message || 'Could not save quiz to bank');
      }
    } catch {
      alert('Network error while saving whole quiz');
    }
  };

  // Toggle selection
  const handleToggleSelectQuestion = (qId) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
      
      {/* Top Header */}
      <div className="pb-6 border-b border-[#1E2D4A] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Database className="text-[#06B6D4]" size={28} />
            Question Bank Repository
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1.5">
            Organized question collections by Quiz Title and Subject Name. Select whole quizzes or individual questions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-emerald-primary text-xs py-2.5 px-5 font-bold gap-2"
        >
          <Plus size={16} />
          Add Question to Bank
        </button>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className="dashboard-card p-3 border-l-4 border-l-[#10B981] flex items-center justify-between text-xs text-[#34D399] animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-[#94A3B8] hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1B2A44] pb-2">
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'quizzes'
              ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
          }`}
        >
          <Layers size={15} />
          By Quiz Title & Subjects ({quizzes.length})
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'questions'
              ? 'bg-[#132238] text-[#06B6D4] border border-[#06B6D4]/30'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
          }`}
        >
          <HelpCircle size={15} />
          All Saved Bank Questions ({questions.length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="dashboard-card p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder={activeTab === 'quizzes' ? "Search by Quiz Title, Subject, or Question ID..." : "Search by Question text, Subject, or Question ID (e.g. TQM-MCQ-M-001)..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 text-xs"
          />
        </div>

        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input-field text-xs md:w-44"
        >
          <option value="">All Subjects</option>
          <option value="TQM (Total Quality Management)">TQM</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Science">Science</option>
          <option value="Mathematics">Mathematics</option>
          <option value="General Knowledge">General Knowledge</option>
        </select>

        {activeTab === 'questions' && (
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input-field text-xs md:w-36"
          >
            <option value="">All Types</option>
            <option value="MCQ_SINGLE">Single MCQ</option>
            <option value="MCQ_MULTI">Multi Select</option>
            <option value="TRUE_FALSE">True / False</option>
            <option value="FILL_BLANK">Fill in Blank</option>
            <option value="SHORT_ANSWER">Short Answer</option>
            <option value="NUMERICAL">Numerical</option>
          </select>
        )}
      </div>

      {/* TAB 1: By Quiz Title & Subject Collections */}
      {activeTab === 'quizzes' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
              Loading quiz collections...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E]">
              <BookOpen size={28} className="text-[#64748B] mx-auto" />
              <h3 className="text-base font-bold text-white">No Quizzes Found</h3>
              <p className="text-xs text-[#94A3B8]">
                Create a quiz in Quiz Studio first, and its questions will be organized here by Quiz Title.
              </p>
            </div>
          ) : (
            quizzes.map((quiz) => {
              const isExpanded = expandedQuizId === quiz.id;
              const qList = expandedQuizQuestions[quiz.id] || [];

              return (
                <div key={quiz.id} className="dashboard-card overflow-hidden border-[#1B2A44] transition-all">
                  
                  {/* Quiz Header Bar */}
                  <div
                    onClick={() => handleToggleExpandQuiz(quiz.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#121D32] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-[#94A3B8] hover:text-white">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] font-mono text-[10px] font-bold">
                            Subject: {quiz.category || 'General'}
                          </span>
                          <span className="text-[10px] text-[#64748B] font-mono">v{quiz.version}</span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-0.5">{quiz.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-[#94A3B8]">
                        {quiz.question_count || 0} Questions &bull; {quiz.total_marks || 0} Pts
                      </span>

                      {/* Action: Save Whole Quiz to Bank */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveWholeQuizToBank(quiz);
                        }}
                        className="btn-secondary text-xs py-1.5 px-3 font-semibold gap-1.5 text-[#34D399] border-[#34D399]/30"
                        title="Save all questions of this quiz to the Question Bank"
                      >
                        <Database size={13} />
                        Save Whole Quiz to Bank
                      </button>
                    </div>
                  </div>

                  {/* Expanded Questions for this Quiz */}
                  {isExpanded && (
                    <div className="p-4 bg-[#0A101A] border-t border-[#1B2A44] space-y-3">
                      {qList.length === 0 ? (
                        <p className="text-xs text-[#94A3B8] py-2">Loading questions for this quiz...</p>
                      ) : (
                        qList.map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className="p-3.5 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <span className="w-5 h-5 rounded bg-[#1B2A44] text-[#34D399] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[10px] font-bold text-[#38BDF8] bg-[#0284C7]/15 border border-[#0284C7]/30 px-2 py-0.5 rounded tracking-wider">
                                    QID: {q.question_code || formatQuestionCode(quiz.category, q.question_type, quiz.difficulty || 'MEDIUM', idx + 1)}
                                  </span>
                                  <span className="text-[10px] text-[#64748B] font-mono uppercase">
                                    {q.question_type.replace('_', ' ')} &bull; {q.marks} pt
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-white leading-relaxed">
                                  {q.question_text}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: All Saved Bank Questions */}
      {activeTab === 'questions' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
              Loading Question Bank...
            </div>
          ) : questions.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E]">
              <Database size={28} className="text-[#64748B] mx-auto" />
              <h3 className="text-base font-bold text-white">Question Bank is Empty</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                Add reusable questions to your bank with full options, or save questions directly from any quiz!
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-emerald-primary text-xs py-2 px-4 mx-auto gap-2"
              >
                <Plus size={14} />
                Add Question
              </button>
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="dashboard-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#2D436B] transition-all"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-[#38BDF8] bg-[#0284C7]/15 border border-[#0284C7]/30 px-2 py-0.5 rounded tracking-wider">
                      QID: {q.question_code || formatQuestionCode(q.category, q.question_type, q.difficulty || 'MEDIUM', 1)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] font-mono text-[10px] font-bold">
                      {q.question_type.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#132238] text-[#94A3B8] font-mono text-[10px]">
                      Subject: {q.category}
                    </span>
                    <span className="text-[10px] text-[#64748B] uppercase font-bold">
                      {q.marks} pt
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-white leading-relaxed">
                    {q.question_text}
                  </p>

                  {/* Render Options Preview */}
                  {Array.isArray(q.options_data) && q.options_data.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {q.options_data.map((opt, i) => (
                        <div
                          key={i}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-2 ${
                            opt.is_correct
                              ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#34D399] font-semibold'
                              : 'bg-[#121D32] border-[#1F304E] text-[#94A3B8]'
                          }`}
                        >
                          <span className="font-bold text-[10px]">{opt.option_key || `#${i+1}`}:</span>
                          <span className="truncate">{opt.option_text || opt.expected_answer}</span>
                          {opt.is_correct && <span className="ml-auto text-[10px] text-[#34D399]">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.explanation && (
                    <p className="text-[11px] text-[#64748B] italic">
                      Note: {q.explanation}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 rounded-lg bg-[#132238] hover:bg-[#F43F5E]/20 text-[#64748B] hover:text-[#F43F5E] transition-colors"
                    title="Delete from Bank"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Question to Bank Modal (With Full Option Area & Subject Selector) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-2xl w-full p-6 space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-[#34D399]" />
                Add Question to Question Bank
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#94A3B8] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBankQuestion} className="space-y-4 text-xs">
              
              {/* Question Prompt */}
              <div>
                <label className="block font-semibold text-[#94A3B8] mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  required
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="Enter the question text here..."
                  className="input-field text-xs leading-relaxed"
                />
              </div>

              {/* Type, Subject Selector, Points, Question ID */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Question Type</label>
                  <select
                    value={newQType}
                    onChange={(e) => handleTypeChangeInModal(e.target.value)}
                    className="input-field text-xs py-2 text-[#34D399] font-bold"
                  >
                    <option value="MCQ_SINGLE">Single MCQ</option>
                    <option value="MCQ_MULTI">Multiple Select MCQ</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="FILL_BLANK">Fill in the Blanks</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                    <option value="NUMERICAL">Numerical Answer</option>
                  </select>
                </div>

                <div>
                  <SubjectSelector
                    value={newQSubject}
                    onChange={setNewQSubject}
                    label="Subject Name"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Question ID</label>
                  <input
                    type="text"
                    value={newQCode}
                    onChange={(e) => setNewQCode(e.target.value.toUpperCase())}
                    placeholder={formatQuestionCode(newQSubject, newQType, newQDifficulty, questions.length + 1)}
                    className="input-field text-xs py-2 font-mono text-[#38BDF8] font-bold uppercase"
                    title="Structured Question ID: [SUBJECT]-[TYPE]-[DIFFICULTY]-[NUM]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Points</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newQMarks}
                    onChange={(e) => setNewQMarks(e.target.value)}
                    className="input-field text-xs py-2 font-mono"
                  />
                </div>
              </div>

              {/* OPTIONS AREA (FIX: Previously missing!) */}
              <div className="space-y-3 pt-2 border-t border-[#1B2A44]">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Answer Options & Designation
                  </label>
                  <span className="text-[10px] text-[#94A3B8]">
                    {newQType === 'MCQ_MULTI' ? 'Check all correct answers' : 'Click letter to mark correct'}
                  </span>
                </div>

                {/* Single Choice & Multi Choice Options */}
                {(newQType === 'MCQ_SINGLE' || newQType === 'MCQ_MULTI') && (
                  <div className="space-y-2">
                    {modalOptions.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                          opt.is_correct ? 'bg-[#10B981]/15 border-[#34D399]' : 'bg-[#121D32] border-[#1F304E]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectModalCorrect(i)}
                          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                            opt.is_correct ? 'bg-[#34D399] text-[#042F2E]' : 'bg-[#1B2A44] text-[#94A3B8]'
                          }`}
                          title="Click to toggle correct answer"
                        >
                          {opt.is_correct ? '✓' : opt.option_key}
                        </button>

                        <input
                          type="text"
                          required
                          value={opt.option_text}
                          onChange={(e) => handleUpdateModalOption(i, { option_text: e.target.value })}
                          placeholder={`Option ${i + 1} text...`}
                          className="bg-transparent text-xs text-white outline-none flex-1"
                        />

                        <button
                          type="button"
                          onClick={() => handleDeleteModalOption(i)}
                          className="text-[#64748B] hover:text-[#F43F5E] p-1"
                          title="Remove option"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddOptionToModal}
                      className="btn-secondary text-xs py-1.5 px-3 gap-1 w-full justify-center"
                    >
                      <Plus size={13} /> Add Choice Option
                    </button>
                  </div>
                )}

                {/* True / False Options */}
                {newQType === 'TRUE_FALSE' && (
                  <div className="grid grid-cols-2 gap-3">
                    {modalOptions.map((opt, i) => (
                      <div
                        key={opt.option_key}
                        onClick={() => handleSelectModalCorrect(i)}
                        className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                          opt.is_correct ? 'bg-[#10B981]/15 border-[#34D399] text-white' : 'bg-[#121D32] border-[#1F304E] text-[#94A3B8]'
                        }`}
                      >
                        <p className="font-bold text-sm">{opt.option_text}</p>
                        <span className="text-[10px] text-[#34D399] mt-0.5 inline-block">
                          {opt.is_correct ? '✓ Correct Choice' : 'Click to select'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fill Blank / Short Answer */}
                {(newQType === 'FILL_BLANK' || newQType === 'SHORT_ANSWER') && (
                  <div className="space-y-2">
                    <label className="text-[11px] text-[#94A3B8]">Accepted Correct Answer Text:</label>
                    <input
                      type="text"
                      required
                      value={modalAnswers[0]?.expected_answer || ''}
                      onChange={(e) => setModalAnswers([{ ...modalAnswers[0], expected_answer: e.target.value }])}
                      placeholder="e.g. Total Quality Management"
                      className="input-field text-xs font-mono"
                    />
                  </div>
                )}

                {/* Numerical */}
                {newQType === 'NUMERICAL' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#94A3B8] block mb-1">Correct Numeric Value:</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={modalAnswers[0]?.expected_answer || ''}
                        onChange={(e) => setModalAnswers([{ ...modalAnswers[0], expected_answer: e.target.value }])}
                        placeholder="e.g. 100"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#94A3B8] block mb-1">Tolerance (&plusmn;):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={modalAnswers[0]?.numeric_tolerance || 0}
                        onChange={(e) => setModalAnswers([{ ...modalAnswers[0], numeric_tolerance: parseFloat(e.target.value) || 0 }])}
                        placeholder="e.g. 0.5"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Explanation */}
              <div>
                <label className="block font-semibold text-[#94A3B8] mb-1">Pedagogical Explanation (Optional)</label>
                <textarea
                  rows={2}
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  placeholder="Solution notes or textbook reference..."
                  className="input-field text-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#1B2A44] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-emerald-primary text-xs py-2 px-5 font-bold shadow-lg shadow-[#10B981]/20"
                >
                  Save to Bank
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
