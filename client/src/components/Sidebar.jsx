import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  LayoutDashboard, 
  User, 
  LogOut, 
  ShieldCheck, 
  GraduationCap, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Database,
  PlusCircle,
  FolderKanban,
  BookMarked,
  History,
  Shield
} from 'lucide-react';

export default function Sidebar({ activeRoute, setActiveRoute }) {
  const { user, logout } = useAuth();

  const role = (user?.role || '').toUpperCase();
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isTeacher = role === 'TEACHER' || role === 'CREATOR' || isSuperAdmin;
  const isStudent = role === 'STUDENT' || role === 'LEARNER';

  const handleLogout = async () => {
    await logout();
    setActiveRoute('landing');
  };

  return (
    <aside className="w-64 bg-[#0B111D] border-r border-[#1B2A44] flex flex-col justify-between shrink-0 select-none min-h-screen">
      
      {/* Top Header & Brand */}
      <div className="p-5 space-y-6">
        
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveRoute('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#132238] border border-[#34D399]/30 flex items-center justify-center text-[#34D399] shadow-lg shadow-[#10B981]/10 group-hover:scale-105 transition-transform">
            <Zap size={22} className="fill-current text-[#10B981]" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-wider text-white">
              QUIZ-SYSTEM
            </span>
            <p className="text-[10px] text-[#94A3B8] font-bold tracking-widest uppercase">
              STUDIO &bull; PHASE P3
            </p>
          </div>
        </div>

        {/* User Role Status Pill */}
        <div className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              isSuperAdmin 
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30' 
                : isTeacher
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30'
            }`}>
              {isSuperAdmin ? <ShieldCheck size={14} /> : isTeacher ? <FolderKanban size={14} /> : <GraduationCap size={14} />}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'Guest User'}</p>
              <p className="text-[10px] text-[#64748B] font-semibold uppercase">{user?.role || 'NOT LOGGED IN'}</p>
            </div>
          </div>

          {user?.isVerified ? (
            <span title="Email Verified" className="text-[#34D399]"><CheckCircle2 size={16} /></span>
          ) : user ? (
            <span title="Email Unverified" className="text-[#F59E0B]"><AlertCircle size={16} /></span>
          ) : null}
        </div>

        {/* Navigation Links */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase px-3 mb-2">
            CORE NAVIGATION
          </p>

          <button
            onClick={() => setActiveRoute('landing')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeRoute === 'landing' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
            }`}
          >
            <LayoutDashboard size={16} />
            Platform Overview
          </button>

          {user && (
            <>
              {/* Learner Dashboard / Discover */}
              <button
                onClick={() => setActiveRoute('learner-dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'learner-dashboard' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <GraduationCap size={16} />
                Learner Arena
              </button>

              {/* Mistake Notebook (P3) */}
              <button
                onClick={() => setActiveRoute('mistake-notebook')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'mistake-notebook' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <BookMarked size={16} />
                Mistake Notebook
              </button>

              {/* Past Attempts History (P3) */}
              <button
                onClick={() => setActiveRoute('attempt-history')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'attempt-history' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <History size={16} />
                Attempt History
              </button>

              {/* Creator Studio & Quizzes (For Teachers / Admins) */}
              {isTeacher && (
                <>
                  <button
                    onClick={() => setActiveRoute('creator-dashboard')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'creator-dashboard' || activeRoute === 'quiz-studio' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <FolderKanban size={16} />
                    Teacher Studio
                  </button>

                  <button
                    onClick={() => setActiveRoute('question-bank')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'question-bank' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <Database size={16} />
                    Question Bank
                  </button>
                </>
              )}

              {/* Super Admin Console */}
              {isSuperAdmin && (
                <button
                  onClick={() => setActiveRoute('admin-dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeRoute === 'admin-dashboard' ? 'bg-[#132238] text-[#F59E0B] border border-[#F59E0B]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                  }`}
                >
                  <ShieldCheck size={16} className="text-[#F59E0B]" />
                  Admin Console
                </button>
              )}

              {/* User Profile */}
              <button
                onClick={() => setActiveRoute('profile')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'profile' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <User size={16} />
                My Profile
              </button>
            </>
          )}
        </div>

        {/* System Status Indicators */}
        <div className="space-y-1.5 pt-4 border-t border-[#1B2A44]">
          <p className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase px-3 mb-1">
            SECURITY & ROLES
          </p>
          <div className="px-3.5 py-1.5 text-xs text-[#94A3B8] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            RBAC Guard Active
          </div>
          <div className="px-3.5 py-1.5 text-xs text-[#94A3B8] flex items-center gap-2">
            <Clock size={14} className="text-[#06B6D4]" />
            Session TTL: 15 min JWT
          </div>
        </div>

      </div>

      {/* Bottom Auth Action Button */}
      <div className="p-4 border-t border-[#1B2A44] bg-[#0A101A]">
        {user ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-[#F43F5E] hover:bg-[#F43F5E]/10 border border-[#F43F5E]/20 transition-colors"
          >
            <LogOut size={15} />
            Log Out
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveRoute('login')}
              className="btn-secondary py-2 text-xs"
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveRoute('register')}
              className="btn-emerald-primary py-2 text-xs"
            >
              Register
            </button>
          </div>
        )}
      </div>

    </aside>
  );
}
