import React, { useState } from 'react';
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
  AlertCircle 
} from 'lucide-react';

export default function Sidebar({ activeRoute, setActiveRoute }) {
  const { user, logout } = useAuth();

  const isCreator = user?.role === 'CREATOR' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="w-64 bg-[#0B111D] border-r border-[#1B2A44] flex flex-col justify-between shrink-0 select-none min-h-screen">
      
      {/* Top Header & Brand */}
      <div className="p-5 space-y-6">
        
        {/* Brand Logo - Nutri-Track Health OS inspired */}
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
              FOUNDATION OS &bull; P1
            </p>
          </div>
        </div>

        {/* User Role Status Pill */}
        <div className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              isAdmin 
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30' 
                : isCreator
                ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                : 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30'
            }`}>
              {isAdmin ? <ShieldCheck size={14} /> : <GraduationCap size={14} />}
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
              {/* Learner Dashboard */}
              <button
                onClick={() => setActiveRoute('learner-dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'learner-dashboard' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <GraduationCap size={16} />
                Learner Dashboard
              </button>

              {/* Creator Studio Placeholder */}
              <button
                onClick={() => setActiveRoute('creator-dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'creator-dashboard' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <Zap size={16} />
                Creator Studio
                {!isCreator && <span className="ml-auto text-[9px] bg-[#1F304E] px-1.5 py-0.5 rounded text-[#64748B]">Locked</span>}
              </button>

              {/* User Profile */}
              <button
                onClick={() => setActiveRoute('profile')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeRoute === 'profile' ? 'bg-[#132238] text-[#34D399] border border-[#34D399]/30' : 'text-[#94A3B8] hover:text-white hover:bg-[#0E1626]'
                }`}
              >
                <User size={16} />
                My Profile Settings
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
            onClick={logout}
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
