import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthMeter, { calculatePasswordStrength } from '../components/PasswordStrengthMeter';

export default function RegisterView({ setActiveRoute }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = 'Full name is required.';
    }

    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    }

    if (!passwordConfirmation) {
      errs.passwordConfirmation = 'Please confirm your password.';
    } else if (password !== passwordConfirmation) {
      errs.passwordConfirmation = 'Passwords do not match.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          passwordConfirmation
        })
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
          <form onSubmit={handleRegister} noValidate className="space-y-4">
            
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Full Name
              </label>
              <input
                id="reg-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Piyush Pilkhwal"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                }}
                className={`input-field ${fieldErrors.name ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
              />
              {fieldErrors.name && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Email Address
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="username email"
                autoCapitalize="none"
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

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 chars with uppercase, number & symbol"
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

              {/* Password Strength Meter */}
              <PasswordStrengthMeter password={password} />

              {fieldErrors.password && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Password Confirmation */}
            <div>
              <label htmlFor="reg-passwordConfirmation" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Confirm Password
              </label>
              <input
                id="reg-passwordConfirmation"
                name="passwordConfirmation"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={passwordConfirmation}
                onChange={(e) => {
                  setPasswordConfirmation(e.target.value);
                  if (fieldErrors.passwordConfirmation) setFieldErrors(prev => ({ ...prev, passwordConfirmation: null }));
                }}
                className={`input-field ${fieldErrors.passwordConfirmation ? 'border-[#F43F5E] focus:border-[#F43F5E] focus:ring-[#F43F5E]/20' : ''}`}
              />
              {fieldErrors.passwordConfirmation && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.passwordConfirmation}
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
                  Creating Account...
                </div>
              ) : (
                <>
                  <UserPlus size={15} />
                  Complete Registration
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#1B2A44] text-center">
            <p className="text-xs text-[#94A3B8]">
              Already have an account?{' '}
              <button
                onClick={() => setActiveRoute('login')}
                className="text-[#34D399] font-semibold hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
