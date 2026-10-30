import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPasswordView({ setActiveRoute }) {
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, newPasswordConfirmation })
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
            className="btn-emerald-primary text-xs py-2.5 px-6"
          >
            Sign In with New Password
          </button>
        </div>
      ) : (
        <div className="dashboard-card p-6 space-y-4">
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Reset Security Token</label>
              <input
                type="text"
                required
                placeholder="Enter or paste token from email"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input-field font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">New Password</label>
              <input
                type="password"
                required
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="Re-enter password"
                value={newPasswordConfirmation}
                onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-emerald-primary w-full text-xs py-3"
            >
              {loading ? 'Updating Password...' : 'Update Password & Invalidate Sessions'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
