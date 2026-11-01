import React from 'react';
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
  Lock 
} from 'lucide-react';

export default function LandingView({ setActiveRoute }) {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-6">
      
      {/* Hero Welcome Card */}
      <div className="dashboard-card p-8 sm:p-12 relative overflow-hidden bg-gradient-to-br from-[#0F1A2E] via-[#0B1220] to-[#070D18] border border-[#1E2E48]">
        
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#10B981]/15 to-[#06B6D4]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-5 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#132238] border border-[#34D399]/40 text-[#34D399] text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles size={14} className="text-[#34D399]" />
            Enterprise Institutional Assessment Platform
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            Next-Generation Examination &amp; <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] via-[#38BDF8] to-[#818CF8]">
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
                className="btn-emerald-primary text-sm py-3 px-6 gap-2 font-bold shadow-lg shadow-[#10B981]/25 hover:scale-[1.02] transition-transform"
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
                  className="btn-emerald-primary text-sm py-3 px-6 gap-2 font-bold shadow-lg shadow-[#10B981]/25 hover:scale-[1.02] transition-transform"
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
              </>
            )}
          </div>
        </div>

        {/* Quick Platform Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-6 border-t border-[#1E2E48]/80 text-xs">
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

      {/* 4 Professional Capability Pillars */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Layers size={18} className="text-[#34D399]" />
            Core Platform Capabilities
          </h2>
          <span className="text-xs text-[#94A3B8] font-semibold">Institutional Grade Architecture</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="dashboard-card p-5 space-y-3 hover:border-[#10B981]/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 flex items-center justify-center font-bold">
              <Radio size={20} className="animate-pulse" />
            </div>
            <h3 className="text-sm font-extrabold text-white">Live Multiplayer Battles</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Synchronous classroom competitions with live PIN access, countdown timers, server-side streaks, and interactive podium leaderboards.
            </p>
          </div>

          <div className="dashboard-card p-5 space-y-3 hover:border-[#38BDF8]/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 flex items-center justify-center font-bold">
              <BookOpen size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-white">Self-Paced Assessments</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Flexible practice tests and official exams featuring question and option shuffling, Mistake Notebook review, and instant evaluation.
            </p>
          </div>

          <div className="dashboard-card p-5 space-y-3 hover:border-[#8B5CF6]/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30 flex items-center justify-center font-bold">
              <GraduationCap size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-white">Institutional Hierarchy</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Model departments, classes, academic cohorts, and sections. Assign tests with strict submission deadlines and attempt limits.
            </p>
          </div>

          <div className="dashboard-card p-5 space-y-3 hover:border-[#F59E0B]/50 transition-colors">
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
      <div className="dashboard-card p-6 border border-[#243754] bg-[#0E1726]/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1B2A44]">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Users size={16} className="text-[#38BDF8]" />
            Quick Demo Accounts for Testing
          </h3>
          <span className="text-xs text-[#34D399] font-mono">Password: Password123! (for all demo accounts)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          
          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1B2A44] space-y-1">
            <span className="text-[10px] font-bold text-[#F59E0B] uppercase">Super Admin</span>
            <p className="font-mono text-white select-all">admin@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Full platform &amp; user control</p>
          </div>

          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1B2A44] space-y-1">
            <span className="text-[10px] font-bold text-[#38BDF8] uppercase">Organization Admin</span>
            <p className="font-mono text-white select-all">orgadmin@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Hierarchy &amp; teacher approvals</p>
          </div>

          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1B2A44] space-y-1">
            <span className="text-[10px] font-bold text-[#8B5CF6] uppercase">Instructors / Teachers</span>
            <p className="font-mono text-white select-all">teacher1@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Also teacher2@qubix.com</p>
          </div>

          <div className="p-3 rounded-xl bg-[#0B111D] border border-[#1B2A44] space-y-1">
            <span className="text-[10px] font-bold text-[#10B981] uppercase">Students / Learners</span>
            <p className="font-mono text-white select-all">student1@qubix.com</p>
            <p className="text-[11px] text-[#64748B]">Also student2 &amp; student3@qubix.com</p>
          </div>

        </div>
      </div>

    </div>
  );
}
