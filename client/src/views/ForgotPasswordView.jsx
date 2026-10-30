import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordView({ setActiveRoute }) {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    setFieldError('');

    if (!email.trim()) {
      setFieldError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      setStatusMsg(data.data?.message || 'If an account exists, a reset link has been dispatched.');
    } catch {
      setStatusMsg('Network error: Unable to contact server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Reset Your Password
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Enter your registered email and we'll dispatch a secure recovery link.
        </p>
      </div>

      {statusMsg && (
        <div className="dashboard-card p-4 border-l-4 border-l-[#10B981] flex items-center gap-2.5 text-xs text-[#34D399]">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="dashboard-card p-6 space-y-4">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Email Address
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email username"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldError) setFieldError('');
              }}
              className={`input-field ${fieldError ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
            />
            {fieldError && (
              <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" />
                {fieldError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-emerald-primary w-full text-xs py-2.5 font-bold"
          >
            {loading ? 'Dispatching Link...' : 'Send Password Reset Email'}
          </button>
        </form>

        <div className="pt-3 border-t border-[#1B2A44] text-center text-xs text-[#94A3B8]">
          Remember your password?{' '}
          <button
            onClick={() => setActiveRoute('login')}
            className="text-[#34D399] font-bold hover:underline"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
