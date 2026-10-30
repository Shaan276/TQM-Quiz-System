import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SubjectSelector({ value, onChange, label = "Subject Name" }) {
  const { accessToken } = useAuth();
  const [subjects, setSubjects] = useState([
    'TQM (Total Quality Management)',
    'Computer Science',
    'Science',
    'Mathematics',
    'Engineering & Tech',
    'General Knowledge'
  ]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [customSubject, setCustomSubject] = useState('');

  useEffect(() => {
    async function loadSubjects() {
      if (!accessToken) return;
      try {
        const res = await fetch('/api/v1/quizzes/subjects', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data.subjects)) {
          setSubjects(data.data.subjects);
        }
      } catch (err) {
        // Fallback to defaults
      }
    }
    loadSubjects();
  }, [accessToken]);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__ADD_NEW__') {
      setIsAddingNew(true);
      setCustomSubject('');
    } else {
      setIsAddingNew(false);
      onChange(val);
    }
  };

  const handleConfirmCustom = () => {
    if (customSubject.trim()) {
      const trimmed = customSubject.trim();
      if (!subjects.includes(trimmed)) {
        setSubjects([...subjects, trimmed]);
      }
      onChange(trimmed);
      setIsAddingNew(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-[#94A3B8]">
          {label}
        </label>
        {!isAddingNew ? (
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="text-[11px] text-[#34D399] hover:underline flex items-center gap-1 font-semibold"
          >
            <Plus size={12} /> Add New Subject
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingNew(false)}
            className="text-[11px] text-[#64748B] hover:text-[#94A3B8]"
          >
            Choose from existing
          </button>
        )}
      </div>

      {!isAddingNew ? (
        <select
          value={value || subjects[0] || 'TQM (Total Quality Management)'}
          onChange={handleSelectChange}
          className="input-field text-xs py-2"
        >
          {subjects.map((subj) => (
            <option key={subj} value={subj}>
              {subj}
            </option>
          ))}
          <option value="__ADD_NEW__" className="text-[#34D399] font-bold">
            + Add New Subject...
          </option>
        </select>
      ) : (
        <div className="flex items-center gap-2 animate-fadeIn">
          <input
            type="text"
            autoFocus
            placeholder="Type new subject name (e.g. TQM Quiz)..."
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmCustom();
              }
            }}
            className="input-field text-xs py-2 flex-1 border-[#34D399] focus:ring-[#34D399]/20"
          />
          <button
            type="button"
            onClick={handleConfirmCustom}
            className="btn-emerald-primary text-xs py-2 px-3 font-bold"
            title="Save Subject"
          >
            <Check size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
