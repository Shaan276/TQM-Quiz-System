import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogIn, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  GraduationCap, 
  FolderKanban, 
  ShieldCheck, 
  Building2, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react';

const ROLE_CONFIGS = {
  STUDENT: {
    key: 'STUDENT',
    title: 'Student / Learner',
    badge: 'Learner Arena',
    email: 'student@quizsystem.com',
    password: 'Password123!',
    icon: GraduationCap,
    color: '#10B981',
    bgColor: 'bg-[#10B981]/15',
    borderColor: 'border-[#10B981]',
    textColor: 'text-[#34D399]',
    primaryRoute: 'learner-dashboard',
    description: 'Attempt self-paced quizzes, review auto-graded score reports, and practice failed items in Mistake Notebook.',
    features: ['Take Published Assessments', 'Instant Server-Side Grading', 'Mistake Notebook Revision', 'Past Attempt History'],
    restricted: ['Quiz Studio Editor', 'Question Bank Management', 'Super Admin Console']
  },
  TEACHER: {
    key: 'TEACHER',
    title: 'Teacher / Instructor',
    badge: 'Creator Studio',
    email: 'teacher@quizsystem.com',
    password: 'Password123!',
    icon: FolderKanban,
    color: '#8B5CF6',
    bgColor: 'bg-[#8B5CF6]/15',
    borderColor: 'border-[#8B5CF6]',
    textColor: 'text-[#A78BFA]',
    primaryRoute: 'creator-dashboard',
    description: 'Design interactive quizzes with 6 question types, manage reusable Question Bank, and track learner performance.',
    features: ['Quiz Studio (6 Question Types)', 'Question Bank & Import/Export', 'Publishing & Version Snapshots', 'Student Attempt Tracking'],
    restricted: ['Super Admin User Directory', 'Platform Role Promotion']
  },
  SUPER_ADMIN: {
    key: 'SUPER_ADMIN',
    title: 'Super Admin',
    badge: 'Command Center',
    email: 'admin@quizsystem.com',
    password: 'Password123!',
    icon: ShieldCheck,
    color: '#F59E0B',
    bgColor: 'bg-[#F59E0B]/15',
    borderColor: 'border-[#F59E0B]',
    textColor: 'text-[#FBBF24]',
    primaryRoute: 'admin-dashboard',
    description: 'Full platform governance, user directory management, role promotions, and platform-wide attempt analytics.',
    features: ['Global User Management', 'Role Assignment & Promotion', 'Platform Performance Analytics', 'Full Administrative Visibility'],
    restricted: ['None (Universal Access)']
  },
  ORG_ADMIN: {
    key: 'ORG_ADMIN',
    title: 'Organization Admin',
    badge: 'Enterprise Hub',
    email: 'orgadmin@quizsystem.com',
    password: 'Password123!',
    icon: Building2,
    color: '#38BDF8',
    bgColor: 'bg-[#38BDF8]/15',
    borderColor: 'border-[#38BDF8]',
    textColor: 'text-[#38BDF8]',
    primaryRoute: 'admin-dashboard',
    description: 'Oversee organization curriculum, manage instructor groups, and inspect cohort test metrics.',
    features: ['Organization Account Overview', 'Curriculum Access Control', 'Teacher & Student Auditing', 'Audit Logs Access'],
    restricted: ['Global Platform Infrastructure Settings']
  }
};

export default function LoginView({ setActiveRoute }) {
  const { setSession } = useAuth();
  
  // Selected role tab for quick presets
  const [selectedRole, setSelectedRole] = useState('STUDENT');
  
  const [email, setEmail] = useState(ROLE_CONFIGS.STUDENT.email);
  const [password, setPassword] = useState(ROLE_CONFIGS.STUDENT.password);
  const [showPassword, setShowPassword] = useState(false);
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [quickLoadingRole, setQuickLoadingRole] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Switch active role tab & preset credentials
  const handleSelectRoleTab = (roleKey) => {
    setSelectedRole(roleKey);
    const config = ROLE_CONFIGS[roleKey];
    if (config) {
      setEmail(config.email);
      setPassword(config.password);
      setFieldErrors({});
      setErrorMsg('');
    }
  };

  const validate = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const executeLogin = async (targetEmail, targetPassword, overrideRoute = null) => {
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.trim(), password: targetPassword })
      });
      const data = await res.json();

      if (data.success) {
        setSession(data.data.accessToken, data.data.refreshToken, data.data.user);
        
        // Target landing page based on normalized role or override
        if (overrideRoute) {
          setActiveRoute(overrideRoute);
        } else {
          const userRole = (data.data.user.role || '').toUpperCase();
          if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'ORG_ADMIN') {
            setActiveRoute('admin-dashboard');
          } else if (userRole === 'TEACHER' || userRole === 'CREATOR') {
            setActiveRoute('creator-dashboard');
          } else {
            setActiveRoute('learner-dashboard');
          }
        }
      } else {
        setErrorMsg(data.error?.message || 'Invalid email or password');
      }
    } catch (err) {
      setErrorMsg('Network error: Failed to connect to server');
    } finally {
      setLoading(false);
      setQuickLoadingRole(null);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    await executeLogin(email, password);
  };

  // 1-Click Quick Login
  const handleQuickLogin = async (roleKey) => {
    const config = ROLE_CONFIGS[roleKey];
    if (!config) return;
    setQuickLoadingRole(roleKey);
    setSelectedRole(roleKey);
    setEmail(config.email);
    setPassword(config.password);
    await executeLogin(config.email, config.password, config.primaryRoute);
  };

  const activeRoleConfig = ROLE_CONFIGS[selectedRole] || ROLE_CONFIGS.STUDENT;
  const ActiveIcon = activeRoleConfig.icon;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121D32] border border-[#1F304E] text-xs font-mono text-[#34D399]">
          <Zap size={14} className="fill-current" />
          Role-Based Access Control Architecture
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-wide">
          Sign In to Quiz System
        </h1>
        <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
          Select your platform role below or use 1-click Quick Login to preview role-specific features.
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="dashboard-card p-4 border-l-4 border-l-[#F43F5E] flex items-center gap-3 text-xs text-[#F43F5E] max-w-2xl mx-auto animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Role Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.values(ROLE_CONFIGS).map(role => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.key;

          return (
            <button
              key={role.key}
              type="button"
              onClick={() => handleSelectRoleTab(role.key)}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 relative ${
                isSelected
                  ? `${role.bgColor} ${role.borderColor} shadow-lg shadow-${role.color}/10 scale-[1.02]`
                  : 'bg-[#0E1626] border-[#1B2A44] hover:bg-[#142036] hover:border-[#2C3F63] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  isSelected ? 'bg-white/10 text-white' : 'bg-[#121D32] text-[#94A3B8]'
                }`}>
                  <Icon size={18} />
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-white truncate">{role.title}</h3>
                <span className={`text-[10px] font-mono font-semibold ${role.textColor}`}>
                  {role.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Login Area (Split: Left Role Feature Matrix, Right Credentials Form) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Role Features & Quick 1-Click Action (5 Columns) */}
        <div className="md:col-span-5 space-y-4">
          
          <div className={`dashboard-card p-6 border ${activeRoleConfig.borderColor} space-y-4 relative overflow-hidden`}>
            
            {/* Role Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-[#1B2A44]">
              <div className={`w-10 h-10 rounded-xl ${activeRoleConfig.bgColor} flex items-center justify-center ${activeRoleConfig.textColor}`}>
                <ActiveIcon size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{activeRoleConfig.title}</h3>
                <p className="text-[10px] text-[#64748B] font-mono">Mapped Platform Privileges</p>
              </div>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              {activeRoleConfig.description}
            </p>

            {/* Allowed Features */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#34D399] block">
                Exclusive Features:
              </span>
              {activeRoleConfig.features.map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-[#94A3B8]">
                  <CheckCircle2 size={13} className="text-[#34D399] shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* Restricted Features */}
            {activeRoleConfig.restricted && activeRoleConfig.restricted[0] !== 'None (Universal Access)' && (
              <div className="space-y-1.5 pt-2 border-t border-[#1B2A44]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                  Hidden / Restricted by RBAC:
                </span>
                {activeRoleConfig.restricted.map(r => (
                  <div key={r} className="flex items-center gap-2 text-xs text-[#64748B]">
                    <Lock size={12} className="text-[#F43F5E] shrink-0" />
                    <span className="line-through decoration-[#F43F5E]/60">{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 1-Click Instant Login Button */}
            <div className="pt-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin(selectedRole)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                  selectedRole === 'STUDENT'
                    ? 'bg-[#10B981] hover:bg-[#059669] text-[#042F2E] shadow-[#10B981]/20'
                    : selectedRole === 'TEACHER'
                    ? 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[#8B5CF6]/20'
                    : selectedRole === 'SUPER_ADMIN'
                    ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#042F2E] shadow-[#F59E0B]/20'
                    : 'bg-[#38BDF8] hover:bg-[#0284C7] text-[#042F2E] shadow-[#38BDF8]/20'
                }`}
              >
                {quickLoadingRole === selectedRole ? (
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Signing in as {activeRoleConfig.title}...
                  </div>
                ) : (
                  <>
                    <Sparkles size={14} />
                    1-Click Login as {activeRoleConfig.title}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* Right Column: Standard Credentials Form (7 Columns) */}
        <div className="md:col-span-7">
          <div className="dashboard-card p-6 md:p-8 space-y-5 border border-[#1B2A44]">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <div>
                <h2 className="text-base font-bold text-white">Sign In with Credentials</h2>
                <p className="text-xs text-[#94A3B8]">
                  Enter your credentials or use the role preset above.
                </p>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${activeRoleConfig.bgColor} ${activeRoleConfig.textColor}`}>
                Preset: {selectedRole}
              </span>
            </div>

            <form onSubmit={handleManualSubmit} noValidate className="space-y-4">
              
              {/* Email field */}
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Email Address
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username email"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                  }}
                  className={`input-field text-xs ${fieldErrors.email ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={13} className="shrink-0" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-password" className="text-xs font-semibold text-[#94A3B8]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveRoute('forgot-password')}
                    className="text-[11px] text-[#34D399] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                    }}
                    className={`input-field pr-10 text-xs ${fieldErrors.password ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {fieldErrors.password && (
                  <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={13} className="shrink-0" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-emerald-primary w-full py-2.5 text-xs font-bold gap-2 mt-2 shadow-lg shadow-[#10B981]/15"
              >
                {loading && !quickLoadingRole ? (
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying Credentials...
                  </div>
                ) : (
                  <>
                    <LogIn size={15} />
                    Sign In to Selected Role
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-[#1B2A44] flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Don't have an account?</span>
              <button
                onClick={() => setActiveRoute('register')}
                className="text-[#34D399] font-bold hover:underline"
              >
                Create an Account &rarr;
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}