import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function VerifyEmailView({ setActiveRoute }) {
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: data.data?.message || 'Email verified successfully!' });
      } else {
        setStatus({ type: 'error', message: data.error?.message || 'Failed to verify email' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error: Failed to reach server' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Confirm Your Email
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Validate your address to activate full participant and assessment privileges.
        </p>
      </div>

      {status && (
        <div className={`dashboard-card p-4 border-l-4 ${
          status.type === 'success' ? 'border-l-[#10B981] text-[#34D399]' : 'border-l-[#F43F5E] text-[#F43F5E]'
        } flex items-center gap-2.5 text-xs`}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      {status?.type === 'success' ? (
        <div className="text-center">
          <button
            onClick={() => setActiveRoute('login')}
            className="btn-emerald-primary text-xs py-2.5 px-6 gap-2"
          >
            Sign In to Your Account <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="dashboard-card p-6 space-y-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Verification Token</label>
              <input
                type="text"
                required
                placeholder="Paste token received in email..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input-field font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-emerald-primary w-full text-xs py-3"
            >
              {loading ? 'Verifying...' : 'Verify Email Address'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#1B2A44] text-center text-xs text-[#94A3B8]">
            Need a new link?{' '}
            <button
              onClick={() => setActiveRoute('forgot-password')}
              className="text-[#34D399] font-bold hover:underline"
            >
              Request assistance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
