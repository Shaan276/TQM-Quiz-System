import React from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, BookOpen, Clock, Award, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LearnerDashboardView() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-[#1B2A44] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <GraduationCap className="text-[#34D399]" size={26} />
            Learner Arena &bull; Student Dashboard
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Welcome, <strong className="text-white">{user?.name}</strong> &bull; Registered Email: <strong className="text-white">{user?.email}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.isVerified ? (
            <span className="px-3 py-1 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Verified Student
            </span>
          ) : (
            <span className="px-3 py-1 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-bold flex items-center gap-1.5">
              <AlertCircle size={14} /> Email Verification Pending
            </span>
          )}
        </div>
      </div>

      {/* Honest Learner Notice */}
      <div className="dashboard-card p-8 text-center space-y-4 border-dashed border-[#2D436B]">
        <div className="w-14 h-14 rounded-2xl bg-[#121D32] border border-[#1F304E] flex items-center justify-center text-[#06B6D4] mx-auto">
          <BookOpen size={28} />
        </div>

        <h3 className="text-lg font-bold text-white">
          Active Assessments & Multiplayer Game Arena Coming in Phase P3
        </h3>
        
        <p className="text-xs text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
          Your learner account foundation is verified and your sessions are protected with JWT authentication and database foreign key cascades. When live sessions and self-paced assignments are published in upcoming phases, they will appear here.
        </p>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
          <div className="dashboard-card-inner p-3.5 space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#34D399]">Real-Time PIN</p>
            <p className="text-xs font-bold text-white">Live Multiplayer</p>
            <p className="text-[10px] text-[#64748B]">Join synchronous classroom trivia with zero latency.</p>
          </div>

          <div className="dashboard-card-inner p-3.5 space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#06B6D4]">Self-Paced</p>
            <p className="text-xs font-bold text-white">Homework Tests</p>
            <p className="text-[10px] text-[#64748B]">Complete scheduled assignments before strict deadlines.</p>
          </div>

          <div className="dashboard-card-inner p-3.5 space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#8B5CF6]">Smart Revision</p>
            <p className="text-xs font-bold text-white">Mistake Notebook</p>
            <p className="text-[10px] text-[#64748B]">Review incorrect questions with spaced repetition.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
