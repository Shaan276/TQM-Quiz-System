import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  ShieldCheck, 
  GraduationCap, 
  ArrowRight, 
  Sparkles, 
  Radio, 
  BarChart3, 
  BookOpen, 
  CheckCircle2, 
  Layers, 
  Users, 
  Clock, 
  Lock,
  Building2,
  X,
  Send,
  AlertCircle
} from 'lucide-react';

export default function LandingView({ setActiveRoute }) {
  const { user } = useAuth();

  // Request College to Register Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [collegeName, setCollegeName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterRole, setRequesterRole] = useState('STUDENT');
  const [notes, setNotes] = useState('');

  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState('');

  const handleSubmitCollegeRequest = async (e) => {
    e.preventDefault();
    setRequestError('');

    if (!collegeName.trim()) {
      setRequestError('College or University name is required.');
      return;
    }
    if (!requesterName.trim()) {
      setRequestError('Your name is required.');
      return;
    }
    if (!requesterEmail.trim()) {
      setRequestError('Your email address is required.');
      return;
    }

    setRequestSubmitting(true);

    try {
      const res = await fetch('/api/v1/institutions/request-college-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeName: collegeName.trim(),
          city: city.trim(),
          website: website.trim(),
          requesterName: requesterName.trim(),
          requesterEmail: requesterEmail.trim(),
          requesterRole,
          notes: notes.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setRequestSuccess(true);
      } else {
        setRequestError(data.error?.message || 'Failed to submit request');
      }
    } catch {
      setRequestError('Network error connecting to server');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowRequestModal(false);
    setRequestSuccess(false);
    setRequestError('');
    setCollegeName('');
    setCity('');
    setWebsite('');
    setRequesterName('');
    setRequesterEmail('');
    setNotes('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-6">
      
      {/* Hero Welcome Card (Clean Glassmorphism & High Contrast Neumorphic Highlights) */}
      <div className="p-8 sm:p-12 relative overflow-hidden bg-[#0D1524]/90 border border-white/[0.08] backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        
        <div className="max-w-3xl space-y-5 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111C30] border border-white/10 text-[#34D399] text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles size={14} className="text-[#34D399]" />
            Enterprise Institutional Assessment Platform
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            Next-Generation Examination &amp; <br />
            <span className="text-[#38BDF8]">
              Assessment OS: QUBIX
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed max-w-2xl font-medium">
            Empower colleges, universities, and training academies with server-authoritative live multiplayer battles, proctored self-paced tests, automated grading, and anti-cheat monitoring.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3.5">
            {user ? (
              <button
                onClick={() => {
                  const role = (user.role || '').toUpperCase();
                  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ORG_ADMIN') {
                    setActiveRoute('admin-dashboard');
                  } else if (role === 'TEACHER' || role === 'CREATOR') {
                    setActiveRoute('creator-dashboard');
                  } else {
                    setActiveRoute('learner-dashboard');
                  }
                }}
                className="btn-emerald-primary text-sm py-3 px-6 gap-2 font-bold shadow-lg shadow-[#10B981]/20 hover:scale-[1.02] transition-transform"
              >
                Launch {
                  ['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN'].includes((user.role || '').toUpperCase())
                    ? 'Admin Portal'
                    : ['TEACHER', 'CREATOR'].includes((user.role || '').toUpperCase())
                    ? 'Teacher Studio'
                    : 'Student Arena'
                }
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveRoute('register')}
                  className="btn-emerald-primary text-sm py-3 px-6 gap-2 font-bold shadow-lg shadow-[#10B981]/20 hover:scale-[1.02] transition-transform"
                >
                  Create Student / Teacher Account
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => setActiveRoute('login')}
                  className="btn-secondary text-sm py-3 px-6 font-bold hover:bg-[#1B2A44]"
                >
                  Sign In to Qubix
                </button>

                {/* Request College to Register CTA */}
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="text-xs py-3 px-5 rounded-xl bg-[#111A2E] border border-white/10 hover:border-[#38BDF8]/50 text-[#38BDF8] hover:text-white transition-all font-bold flex items-center gap-2 shadow-sm"
                >
                  <Building2 size={15} />
                  <span>Request College to Register</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Platform Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-6 border-t border-white/[0.08] text-xs">
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">Engine</span>
            <p className="font-extrabold text-white text-sm mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              100% Real-Time
            </p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">Anti-Cheat</span>
            <p className="font-extrabold text-white text-sm mt-0.5 text-[#38BDF8]">
              Tab &amp; Fullscreen Audit
            </p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">Hierarchy</span>
            <p className="font-extrabold text-white text-sm mt-0.5 text-[#A78BFA]">
              Department &amp; Section Scoped
            </p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">Security</span>
            <p className="font-extrabold text-white text-sm mt-0.5 text-[#FBBF24]">
              Multi-Role Gate Approval
            </p>
          </div>
        </div>

      </div>

      {/* 4 Professional Capability Pillars (Neumorphic Glass Panels) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Layers size={18} className="text-[#34D399]" />
            Core Platform Capabilities
          </h2>
          <span className="text-xs text-[#94A3B8] font-semibold">Institutional Grade Architecture</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-5 rounded-2xl bg-[#0D1524]/70 border border-white/[0.06] backdrop-blur-md shadow-sm space-y-3 hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 flex items-center justify-center font-bold">
              <Radio size={20} className="animate-pulse" />
            </div>
            <h3 className="text-sm font-extrabold text-white">Live Multiplayer Battles</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Synchronous classroom competitions with live PIN access, countdown timers, server-side streaks, and interactive podium leaderboards.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D1524]/70 border border-white/[0.06] backdrop-blur-md shadow-sm space-y-3 hover:border-[#38BDF8]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 flex items-center justify-center font-bold">
              <BookOpen size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-white">Self-Paced Assessments</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Flexible practice tests and official exams featuring question and option shuffling, Mistake Notebook review, and instant evaluation.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D1524]/70 border border-white/[0.06] backdrop-blur-md shadow-sm space-y-3 hover:border-[#8B5CF6]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30 flex items-center justify-center font-bold">
              <GraduationCap size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-white">Institutional Hierarchy</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Model departments, classes, academic cohorts, and sections. Assign tests with strict submission deadlines and attempt limits.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D1524]/70 border border-white/[0.06] backdrop-blur-md shadow-sm space-y-3 hover:border-[#F59E0B]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30 flex items-center justify-center font-bold">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-white">Advanced Insights</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Detailed distractor distribution, question-level accuracy metrics, difficulty ratings, and individual student mastery tracking.
            </p>
          </div>

        </div>
      </div>

      {/* Manual Testing Credentials Quick Reference Card */}
      <div className="p-6 rounded-2xl bg-[#0D1524]/90 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Users size={16} className="text-[#38BDF8]" />
            Quick Demo Accounts for Testing
          </h3>
          <span className="text-xs text-[#34D399] font-mono">Password: Password123! (for all demo accounts)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          
          <div className="p-3.5 rounded-xl bg-[#080E18] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold text-[#F59E0B] uppercase">Super Admin</span>
            <p className="font-mono text-white select-all">admin@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Full platform &amp; user control</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080E18] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold text-[#38BDF8] uppercase">Organization Admin</span>
            <p className="font-mono text-white select-all">orgadmin@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Hierarchy &amp; teacher approvals</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080E18] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold text-[#8B5CF6] uppercase">Instructors / Teachers</span>
            <p className="font-mono text-white select-all">teacher1@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Also teacher2@qubix.com</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080E18] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-bold text-[#10B981] uppercase">Students / Learners</span>
            <p className="font-mono text-white select-all">student1@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Also student2 &amp; student3@qubix.com</p>
          </div>

        </div>
      </div>

      {/* Modal: Request College to Register */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0D1524] border border-white/10 rounded-2xl w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-[#38BDF8]" />
                Request College / University Onboarding
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-[#64748B] hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {requestSuccess ? (
              <div className="p-6 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 text-center space-y-3 animate-in fade-in">
                <CheckCircle2 size={36} className="mx-auto text-[#10B981]" />
                <h4 className="text-base font-bold text-white">Onboarding Request Received!</h4>
                <p className="text-xs text-[#CBD5E1] leading-relaxed max-w-sm mx-auto">
                  Thank you for submitting <strong>{collegeName}</strong>. Our administrative team will review your institution and contact your campus administrators to enable access.
                </p>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-emerald-primary text-xs py-2 px-6 font-bold mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitCollegeRequest} className="space-y-4">
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Is your campus not yet listed on Qubix? Submit your college details below. We verify and onboard colleges rapidly so your department can launch quizzes.
                </p>

                {requestError && (
                  <div className="p-3 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/40 flex items-center gap-2 text-xs text-[#F43F5E]">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{requestError}</span>
                  </div>
                )}

                {/* College Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    College / University Official Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. National Institute of Technology"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    className="input-field text-xs py-2 w-full bg-[#080E18]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* City / State */}
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Campus City / State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. New Delhi"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input-field text-xs py-2 w-full bg-[#080E18]"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      College Website / Domain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://nit.edu"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="input-field text-xs py-2 w-full bg-[#080E18]"
                    />
                  </div>
                </div>

                {/* Requester Details */}
                <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      className="input-field text-xs py-2 w-full bg-[#080E18]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Your Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={requesterEmail}
                      onChange={(e) => setRequesterEmail(e.target.value)}
                      className="input-field text-xs py-2 w-full bg-[#080E18]"
                    />
                  </div>
                </div>

                {/* Requester Role */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Your Role in the Institution
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['STUDENT', 'FACULTY', 'ADMIN'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRequesterRole(r)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                          requesterRole === r
                            ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                            : 'bg-[#080E18] border-white/10 text-[#94A3B8]'
                        }`}
                      >
                        {r === 'STUDENT' ? 'Student' : r === 'FACULTY' ? 'Teacher/Faculty' : 'Campus Admin'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. We have 4 departments interested in using Qubix for mid-term exams."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input-field text-xs py-2 w-full bg-[#080E18] resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={requestSubmitting}
                    className="btn-emerald-primary text-xs py-2 px-5 font-bold flex items-center gap-2 shadow-lg shadow-[#10B981]/20"
                  >
                    <Send size={13} />
                    <span>{requestSubmitting ? 'Submitting Request...' : 'Submit College Request'}</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
