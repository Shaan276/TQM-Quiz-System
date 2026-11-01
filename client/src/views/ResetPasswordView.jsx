import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

export default function ResetPasswordView({ setActiveRoute }) {
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validate = () => {
    const errs = {};
    if (!token.trim()) {
      errs.token = 'Reset security token is required.';
    }
    if (!newPassword) {
      errs.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters long.';
    } else if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword)) {
      errs.newPassword = 'Password must include uppercase, lowercase, a number, and a special symbol.';
    }
    if (!newPasswordConfirmation) {
      errs.newPasswordConfirmation = 'Please confirm your new password.';
    } else if (newPassword !== newPasswordConfirmation) {
      errs.newPasswordConfirmation = 'Passwords do not match.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword, newPasswordConfirmation })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.data.message || 'Password reset successfully!');
      } else {
        setErrorMsg(data.error?.message || 'Password reset failed');
      }
    } catch {
      setErrorMsg('Network error: Unable to contact server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Set New Password
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Choose a strong password with at least 8 characters.
        </p>
      </div>

      {errorMsg && (
        <div className="dashboard-card p-3.5 border-l-4 border-l-[#F43F5E] flex items-center gap-2.5 text-xs text-[#F43F5E]">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg ? (
        <div className="dashboard-card p-6 border-l-4 border-l-[#10B981] space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-[#34D399] font-bold">
            <CheckCircle2 size={20} />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setActiveRoute('login')}
            className="btn-emerald-primary text-xs py-2.5 px-6 font-bold"
          >
            Sign In with New Password
          </button>
        </div>
      ) : (
        <div className="dashboard-card p-6 space-y-4">
          <form onSubmit={handleReset} noValidate className="space-y-4">
            <div>
              <label htmlFor="reset-token" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Reset Security Token
              </label>
              <input
                id="reset-token"
                name="token"
                type="text"
                placeholder="Enter or paste token from email"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (fieldErrors.token) setFieldErrors(prev => ({ ...prev, token: null }));
                }}
                className={`input-field font-mono text-xs ${fieldErrors.token ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
              />
              {fieldErrors.token && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.token}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reset-newPassword" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="reset-newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (fieldErrors.newPassword) setFieldErrors(prev => ({ ...prev, newPassword: null }));
                  }}
                  className={`input-field pr-10 ${fieldErrors.newPassword ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
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

              <PasswordStrengthMeter password={newPassword} />

              {fieldErrors.newPassword && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reset-confirmPassword" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Confirm New Password
              </label>
              <input
                id="reset-confirmPassword"
                name="newPasswordConfirmation"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={newPasswordConfirmation}
                onChange={(e) => {
                  setNewPasswordConfirmation(e.target.value);
                  if (fieldErrors.newPasswordConfirmation) setFieldErrors(prev => ({ ...prev, newPasswordConfirmation: null }));
                }}
                className={`input-field ${fieldErrors.newPasswordConfirmation ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
              />
              {fieldErrors.newPasswordConfirmation && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.newPasswordConfirmation}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-emerald-primary w-full text-xs py-2.5 font-bold"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#1B2A44] text-center text-xs text-[#94A3B8]">
            <button
              onClick={() => setActiveRoute('login')}
              className="text-[#34D399] font-semibold hover:underline"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
