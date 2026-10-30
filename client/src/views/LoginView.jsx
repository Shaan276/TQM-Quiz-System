import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginView({ setActiveRoute }) {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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

      {/* Error Banner */}
      {errorMsg && (
        <div className="dashboard-card p-3.5 border-l-4 border-l-[#F43F5E] flex items-center gap-2.5 text-xs text-[#F43F5E]">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="dashboard-card p-6 space-y-4">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#94A3B8]">Password</label>
              <button
                type="button"
                onClick={() => setActiveRoute('forgot-password')}
                className="text-[11px] text-[#34D399] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-emerald-primary w-full text-xs py-3 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="pt-3 border-t border-[#1B2A44] text-center text-xs text-[#94A3B8]">
          Don't have an account?{' '}
          <button
            onClick={() => setActiveRoute('register')}
            className="text-[#34D399] font-bold hover:underline"
          >
            Create one
          </button>
        </div>
      </div>

    </div>
  );
}
