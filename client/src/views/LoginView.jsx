import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginView({ setActiveRoute }) {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();

      if (data.success) {
        setSession(data.data.accessToken, data.data.refreshToken, data.data.user);
        if (data.data.user.role === 'CREATOR' || data.data.user.role === 'ADMIN') {
          setActiveRoute('creator-dashboard');
        } else {
          setActiveRoute('learner-dashboard');
        }
      } else {
        setErrorMsg(data.error?.message || 'Invalid email or password');
      }
    } catch (err) {
      setErrorMsg('Network error: Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Welcome Back
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Sign in to your Quiz System account
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="dashboard-card p-3.5 border-l-4 border-l-[#F43F5E] flex items-center gap-2.5 text-xs text-[#F43F5E]">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="dashboard-card p-6 space-y-4">
        <form onSubmit={handleLogin} noValidate className="space-y-4">
          
          {/* Email field with Google Credential Autofill Support */}
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
              className={`input-field ${fieldErrors.email ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
            />
            {fieldErrors.email && (
              <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
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
                className={`input-field pr-10 ${fieldErrors.password ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
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
              <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-emerald-primary w-full py-2.5 text-xs font-bold gap-2 mt-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </div>
            ) : (
              <>
                <LogIn size={15} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-[#1B2A44] text-center">
          <p className="text-xs text-[#94A3B8]">
            Don't have an account?{' '}
            <button
              onClick={() => setActiveRoute('register')}
              className="text-[#34D399] font-semibold hover:underline"
            >
              Register here
            </button>
          </p>
        </div>
      </div>

    </div>
  );
}
