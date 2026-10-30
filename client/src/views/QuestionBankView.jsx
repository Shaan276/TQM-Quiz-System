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
  AlertCircle 
} from 'lucide-react';

export default function QuestionBankView({ setActiveRoute }) {
  const { accessToken } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // Add Question Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState('MCQ_SINGLE');
  const [newQCategory, setNewQCategory] = useState('General');
  const [newQDifficulty, setNewQDifficulty] = useState('MEDIUM');
  const [newQMarks, setNewQMarks] = useState(1.0);
  const [newQExplanation, setNewQExplanation] = useState('');
  const [modalOptions, setModalOptions] = useState([
    { option_key: 'A', option_text: 'Option 1', is_correct: true },
    { option_key: 'B', option_text: 'Option 2', is_correct: false }
  ]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (category) params.append('category', category);
      if (type) params.append('type', type);
      if (difficulty) params.append('difficulty', difficulty);

      const res = await fetch(`/api/v1/question-bank?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [accessToken, search, category, type, difficulty]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question from your Question Bank?')) return;
    try {
      const res = await fetch(`/api/v1/question-bank/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchQuestions();
      }
    } catch {
      alert('Failed to delete question');
    }
  };

  const handleCreateBankQuestion = async (e) => {
    e.preventDefault();
    if (!newQText.trim()) {
      alert('Question text is required');
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
          title: newQText.slice(0, 40) + '...',
          question_text: newQText.trim(),
          question_type: newQType,
          category: newQCategory,
          difficulty: newQDifficulty,
          marks: parseFloat(newQMarks) || 1.0,
          explanation: newQExplanation.trim(),
          options_data: modalOptions
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewQText('');
        fetchQuestions();
      }
    } catch {
      alert('Failed to add question to bank');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-[#1B2A44] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Database className="text-[#06B6D4]" size={24} />
            Question Bank Repository
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Store, categorize, and reuse assessment questions across your quizzes.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-emerald-primary text-xs py-2.5 px-4 font-bold gap-2"
        >
          <Plus size={16} />
          Add Question to Bank
        </button>
      </div>

      {/* Filter and Search */}
      <div className="dashboard-card p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search questions in bank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 text-xs"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-field text-xs md:w-36"
        >
          <option value="">All Categories</option>
          <option value="General">General</option>
          <option value="Science">Science</option>
          <option value="Mathematics">Mathematics</option>
          <option value="History">History</option>
          <option value="Technology">Technology</option>
        </select>

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

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="input-field text-xs md:w-32"
        >
          <option value="">All Levels</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-[#94A3B8] font-mono">
          Loading Question Bank...
        </div>
      ) : questions.length === 0 ? (
        <div className="dashboard-card p-12 text-center space-y-3 border-dashed border-[#1F304E]">
          <Database size={28} className="text-[#64748B] mx-auto" />
          <h3 className="text-base font-bold text-white">Question Bank is Empty</h3>
          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
            Add reusable questions to your bank or save questions directly from the Quiz Studio!
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-emerald-primary text-xs py-2 px-4 mx-auto gap-2"
          >
            <Plus size={14} />
            Add First Question
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="dashboard-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#2D436B] transition-all"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#34D399] font-mono text-[10px] font-bold">
                    {q.question_type.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#132238] text-[#94A3B8] font-mono text-[10px]">
                    {q.category}
                  </span>
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">
                    {q.difficulty} &bull; {q.marks} pt
                  </span>
                </div>

                <p className="text-sm font-semibold text-white leading-relaxed">
                  {q.question_text}
                </p>

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
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dashboard-card max-w-xl w-full p-6 space-y-4 animate-fadeIn">
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
              <div>
                <label className="block font-semibold text-[#94A3B8] mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  required
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="Enter the question text..."
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Type</label>
                  <select
                    value={newQType}
                    onChange={(e) => setNewQType(e.target.value)}
                    className="input-field text-xs"
                  >
                    <option value="MCQ_SINGLE">Single MCQ</option>
                    <option value="MCQ_MULTI">Multi Select</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="FILL_BLANK">Fill in Blank</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                    <option value="NUMERICAL">Numerical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#94A3B8] mb-1">Category</label>
                  <select
                    value={newQCategory}
                    onChange={(e) => setNewQCategory(e.target.value)}
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
                  <label className="block font-semibold text-[#94A3B8] mb-1">Points</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newQMarks}
                    onChange={(e) => setNewQMarks(e.target.value)}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#94A3B8] mb-1">Explanation (Optional)</label>
                <textarea
                  rows={2}
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  placeholder="Explanation for learners..."
                  className="input-field text-xs"
                />
              </div>

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
                  className="btn-emerald-primary text-xs py-2 px-5 font-bold"
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
