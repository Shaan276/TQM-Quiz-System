import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, ShieldAlert, Layers, Sparkles, BookOpen, Clock } from 'lucide-react';

export default function CreatorDashboardView() {
  const { user } = useAuth();

  const isCreatorOrAdmin = user?.role === 'CREATOR' || user?.role === 'ADMIN';

  if (!isCreatorOrAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 flex items-center justify-center text-[#F43F5E] mx-auto">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Creator Access Restricted</h2>
        <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
          Your account is currently registered under the <strong className="text-white">LEARNER</strong> role. Creator Studio authoring capabilities are strictly reserved for verified instructors and administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-[#1B2A44] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Zap className="text-[#10B981] fill-current" size={24} />
            Creator Studio &bull; Assessment Authoring
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Welcome, <strong className="text-white">{user?.name}</strong> &bull; Authenticated Role: <strong className="text-[#34D399]">{user?.role}</strong>
          </p>
        </div>

        <span className="px-3.5 py-1.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] text-xs font-bold uppercase tracking-wider">
          Creator Verified
        </span>
      </div>

      {/* Honest Placeholder Card */}
      <div className="dashboard-card p-8 text-center space-y-4 border-dashed border-[#2D436B]">
        <div className="w-14 h-14 rounded-2xl bg-[#121D32] border border-[#1F304E] flex items-center justify-center text-[#34D399] mx-auto">
          <Layers size={28} />
        </div>

        <h3 className="text-lg font-bold text-white">
          Quiz Studio & Question Management Arriving in Phase P2
        </h3>
        
        <p className="text-xs text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
          The foundation, database models, session tokens, and RBAC permissions are fully active. As mandated by Phase P1 guidelines, no mock quizzes or fake statistics are shown.
        </p>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
          <div className="dashboard-card-inner p-3.5 space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#34D399]">Phase P2</p>
            <p className="text-xs font-bold text-white">Interactive Studio</p>
            <p className="text-[10px] text-[#64748B]">Block-based MCQ, True/False, and LaTeX KaTeX editors.</p>
          </div>

          <div className="dashboard-card-inner p-3.5 space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#06B6D4]">Phase P3</p>
            <p className="text-xs font-bold text-white">Live Engine</p>
            <p className="text-[10px] text-[#64748B]">Real-time room PIN generation and multiplayer game HUD.</p>
          </div>

          <div className="dashboard-card-inner p-3.5 space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#F59E0B]">Phase P4</p>
            <p className="text-xs font-bold text-white">Assignments</p>
            <p className="text-[10px] text-[#64748B]">Deadline scheduling, anti-cheat randomized options.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
