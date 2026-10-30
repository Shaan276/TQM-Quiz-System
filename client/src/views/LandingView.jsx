import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  ShieldCheck, 
  GraduationCap, 
  ArrowRight, 
  Sparkles, 
  Lock, 
  Cpu, 
  Clock 
} from 'lucide-react';

export default function LandingView({ setActiveRoute }) {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-6">
      
      {/* Hero Welcome Card (Matching Nutri-Track reference layout) */}
      <div className="dashboard-card p-8 sm:p-10 relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#132238] border border-[#34D399]/30 text-[#34D399] text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            Phase P1 Foundation Architecture Active
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Next-Generation Quiz & <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#06B6D4]">
              Assessment SaaS Platform
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
            Unifying synchronous live multiplayer game sessions and rigorous asynchronous self-paced examinations on a single, server-authoritative relational foundation.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {user ? (
              <button
                onClick={() => setActiveRoute(user.role === 'CREATOR' || user.role === 'ADMIN' ? 'creator-dashboard' : 'learner-dashboard')}
                className="btn-emerald-primary text-xs py-2.5 px-5 gap-2"
              >
                Go to {user.role === 'CREATOR' || user.role === 'ADMIN' ? 'Creator Studio' : 'Learner Dashboard'}
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveRoute('register')}
                  className="btn-emerald-primary text-xs py-2.5 px-5 gap-2"
                >
                  Create Learner Account
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => setActiveRoute('login')}
                  className="btn-secondary text-xs py-2.5 px-5"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* 4 Feature Cards (Nutri-Track Style) */}
      <div className="dashboard-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#34D399] uppercase tracking-wider">
            CORE PILLARS IMPLEMENTED IN PHASE P1
          </span>
          <span className="text-xs text-[#64748B] font-mono">Status: 100% Verified</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="dashboard-card-inner p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#34D399] uppercase flex items-center gap-1.5">
                <Lock size={14} /> PASSWORDS
              </span>
              <span className="text-[#10B981] font-mono text-[10px]">BCRYPT</span>
            </div>
            <p className="text-sm font-bold text-white">Salted Hashing</p>
            <p className="text-[11px] text-[#64748B]">Zero plain-text password persistence; minimum 8-char validation.</p>
          </div>

          <div className="dashboard-card-inner p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#06B6D4] uppercase flex items-center gap-1.5">
                <Clock size={14} /> SESSIONS
              </span>
              <span className="text-[#06B6D4] font-mono text-[10px]">15m / 7d</span>
            </div>
            <p className="text-sm font-bold text-white">JWT Rotation</p>
            <p className="text-[11px] text-[#64748B]">Short-lived access tokens with rotating single-use refresh tokens.</p>
          </div>

          <div className="dashboard-card-inner p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#8B5CF6] uppercase flex items-center gap-1.5">
                <ShieldCheck size={14} /> ROLES
              </span>
              <span className="text-[#8B5CF6] font-mono text-[10px]">RBAC</span>
            </div>
            <p className="text-sm font-bold text-white">Creator & Learner</p>
            <p className="text-[11px] text-[#64748B]">Strict backend route authorization; users cannot self-escalate.</p>
          </div>

          <div className="dashboard-card-inner p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#F59E0B] uppercase flex items-center gap-1.5">
                <Cpu size={14} /> VERIFY
              </span>
              <span className="text-[#F59E0B] font-mono text-[10px]">TOKENS</span>
            </div>
            <p className="text-sm font-bold text-white">Email Validation</p>
            <p className="text-[11px] text-[#64748B]">Cryptographic sha256 tokens expiring after 24h with reuse locks.</p>
          </div>

        </div>
      </div>

    </div>
  );
}
