import React from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
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
  Shield,
  Radio,
  BarChart3
} from 'lucide-react';

export default function Sidebar({ activeRoute, setActiveRoute }) {
  const { user, logout } = useAuth();

  const role = (user?.role || '').toUpperCase();
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isOrgAdmin = role === 'ORG_ADMIN';
  const isTeacher = role === 'TEACHER' || role === 'CREATOR';
  const isStudent = role === 'STUDENT' || role === 'LEARNER';

  const handleLogout = async () => {
    await logout();
    setActiveRoute('landing');
  };

  return (
    <aside className="w-64 bg-[#0B111D] border-r border-[#1B2A44] flex flex-col justify-between shrink-0 select-none h-screen sticky top-0 overflow-y-auto z-30">
      
      {/* Top Header & Brand */}
      <div className="p-5 space-y-5">
        
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
              RBAC &bull; MULTI-ROLE OS
            </p>
          </div>
        </div>

        {/* User Role Status Pill */}
        <div className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              isSuperAdmin 
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30' 
                : isOrgAdmin
                ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                : isTeacher
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30'
            }`}>
              {isSuperAdmin ? <ShieldCheck size={14} /> : isOrgAdmin ? <ShieldCheck size={14} /> : isTeacher ? <FolderKanban size={14} /> : <GraduationCap size={14} />}
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

        {/* Quick Notification & Status Strip */}
        {user && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0D1524] border border-[#1B2A44]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
              <span>Alerts & Activity</span>
            </div>
            <NotificationBell setActiveRoute={setActiveRoute} />
          </div>
        )}

        {/* Navigation Links Grouped Strictly by Role */}
        <div className="space-y-4">
          
          {/* Common Section: Core Platform */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase px-3 mb-1">
              PLATFORM
            </p>
            <button
              onClick={() => setActiveRoute('landing')}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeRoute === 'landing' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
              }`}
            >
              <LayoutDashboard size={15} />
              Overview & Architecture
            </button>
          </div>

          {user && (
            <>
              {/* Student Role Exclusive Navigation */}
              {(isStudent || isSuperAdmin) && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-[#34D399] uppercase px-3 mb-1 flex items-center gap-1.5">
                    <GraduationCap size={13} />
                    Learner Platform
                  </p>

                  <button
                    onClick={() => setActiveRoute('learner-dashboard')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'learner-dashboard' ? 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <GraduationCap size={15} />
                    Take & Discover Quizzes
                  </button>

                  <button
                    onClick={() => setActiveRoute('mistake-notebook')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'mistake-notebook' ? 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <BookMarked size={15} />
                    Mistake Notebook
                  </button>

                  <button
                    onClick={() => setActiveRoute('attempt-history')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'attempt-history' ? 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <History size={15} />
                    Past Attempts & Scores
                  </button>

                  <button
                    onClick={() => setActiveRoute('live-session')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'live-session' ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/50' : 'text-[#34D399] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <Radio size={15} className="animate-pulse" />
                    Join Live Game (PIN)
                  </button>
                </div>
              )}

              {/* Teacher Role Exclusive Navigation */}
              {(isTeacher || isSuperAdmin || isOrgAdmin) && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-[#A78BFA] uppercase px-3 mb-1 flex items-center gap-1.5">
                    <FolderKanban size={13} />
                    Teacher Studio
                  </p>

                  <button
                    onClick={() => setActiveRoute('creator-dashboard')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'creator-dashboard' || activeRoute === 'quiz-studio' ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <FolderKanban size={15} />
                    Quiz Studio & Builder
                  </button>

                  <button
                    onClick={() => setActiveRoute('teacher-insights')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'teacher-insights' ? 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <BarChart3 size={15} />
                    Assessment Insights
                  </button>

                  <button
                    onClick={() => setActiveRoute('question-bank')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'question-bank' ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <Database size={15} />
                    Question Bank
                  </button>
                </div>
              )}

              {/* Super Admin & Org Admin Navigation */}
              {(isSuperAdmin || isOrgAdmin) && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-[#FBBF24] uppercase px-3 mb-1 flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    System Administration
                  </p>

                  <button
                    onClick={() => setActiveRoute('admin-dashboard')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeRoute === 'admin-dashboard' ? 'bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/40' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                    }`}
                  >
                    <ShieldCheck size={15} className="text-[#FBBF24]" />
                    User Directory & Roles
                  </button>
                </div>
              )}

              {/* Common Section: User Account */}
              <div className="space-y-1 pt-1 border-t border-[#1B2A44]">
                <p className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase px-3 mb-1">
                  COMMON ACCOUNT
                </p>
                <button
                  onClick={() => setActiveRoute('profile')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeRoute === 'profile' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                  }`}
                >
                  <User size={15} />
                  Profile & Security
                </button>
              </div>
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
