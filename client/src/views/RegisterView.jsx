import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function RegisterView({ setActiveRoute }) {
  const { setSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, passwordConfirmation })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.data.message || 'Account created! Please check your email for the verification link.');
      } else {
        setErrorMsg(data.error?.message || 'Registration failed');
      }
    } catch (err) {
      setErrorMsg('Network error: Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Create an Account
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Join Quiz System as a Learner. Default role is strictly enforced.
        </p>
      </div>

      {/* Notification Banners */}
      {errorMsg && (
        <div className="dashboard-card p-3.5 border-l-4 border-l-[#F43F5E] flex items-center gap-2.5 text-xs text-[#F43F5E]">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="dashboard-card p-4 border-l-4 border-l-[#10B981] space-y-3">
          <div className="flex items-center gap-2.5 text-xs text-[#34D399]">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setActiveRoute('login')}
            className="btn-emerald-primary w-full text-xs py-2 gap-1.5"
          >
            Proceed to Login <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Form Card */}
      {!successMsg && (
        <div className="dashboard-card p-6 space-y-4">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Piyush Pilkhwal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

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
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Confirm Password</label>
              <input
                type="password"
                required
                placeholder="Re-enter password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-emerald-primary w-full text-xs py-3 mt-2"
            >
              {loading ? 'Creating Account...' : 'Register as Learner'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#1B2A44] text-center text-xs text-[#94A3B8]">
            Already have an account?{' '}
            <button
              onClick={() => setActiveRoute('login')}
              className="text-[#34D399] font-bold hover:underline"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
