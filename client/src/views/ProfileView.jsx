import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Calendar, Key, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

export default function ProfileView() {
  const { user, accessToken, setUser } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setNameError('');
    setProfileMsg(null);

    if (!name.trim()) {
      setNameError('Display name is required.');
      return;
    }

    setProfileLoading(true);

    try {
      const res = await fetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data.profile);
        setProfileMsg({ type: 'success', text: 'Display name updated successfully!' });
      } else {
        setProfileMsg({ type: 'error', text: data.error?.message || 'Update failed' });
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network communication failure' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    const errs = {};

    if (!currentPassword) {
      errs.currentPassword = 'Current password is required.';
    }
    if (!newPassword) {
      errs.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errs.newPassword = 'New password must be at least 8 characters long.';
    }
    if (!newPasswordConfirmation) {
      errs.newPasswordConfirmation = 'Please confirm your new password.';
    } else if (newPassword !== newPasswordConfirmation) {
      errs.newPasswordConfirmation = 'New passwords do not match.';
    }

    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/v1/users/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirmation })
      });
      const data = await res.json();

      if (data.success) {
        setPasswordMsg({ type: 'success', text: data.data.message });
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirmation('');
      } else {
        setPasswordMsg({ type: 'error', text: data.error?.message || 'Password update failed' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Network communication failure' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-[#1B2A44]">
        <h1 className="text-2xl font-bold text-white tracking-wide">
          Account Profile & Security
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1">
          Manage your personal details, role status, and password credentials.
        </p>
      </div>

      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B]">Assigned Role</p>
          <p className="text-lg font-extrabold text-white flex items-center gap-2">
            <Shield size={18} className="text-[#34D399]" />
            {user?.role}
          </p>
          <span className="text-[10px] text-[#94A3B8]">Strictly enforced on backend</span>
        </div>

        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B]">Email Status</p>
          <p className="text-lg font-extrabold text-white flex items-center gap-2">
            <CheckCircle2 size={18} className={user?.isVerified ? "text-[#34D399]" : "text-[#F59E0B]"} />
            {user?.isVerified ? 'Verified' : 'Pending Verification'}
          </p>
          <span className="text-[10px] text-[#94A3B8]">{user?.email}</span>
        </div>

        <div className="dashboard-card p-4 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B]">Member Since</p>
          <p className="text-lg font-extrabold text-white flex items-center gap-2">
            <Calendar size={18} className="text-[#06B6D4]" />
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
          </p>
          <span className="text-[10px] text-[#94A3B8]">Phase P1 &bull; Active Member</span>
        </div>
      </div>

      {/* Profile Edit Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Name Form */}
        <div className="dashboard-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User size={16} className="text-[#34D399]" />
            Personal Details
          </h3>

          {profileMsg && (
            <div className={`p-3 rounded-xl text-xs border ${
              profileMsg.type === 'success' ? 'bg-[#10B981]/10 text-[#34D399] border-[#10B981]/30' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'
            }`}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateName} noValidate className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Display Name
              </label>
              <input
                id="profile-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                className={`input-field ${nameError ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
              />
              {nameError && (
                <p className="text-xs text-[#F43F5E] mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {nameError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="profile-email" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Registered Email
              </label>
              <input
                id="profile-email"
                type="email"
                disabled
                autoComplete="email"
                value={user?.email || ''}
                className="input-field opacity-60 cursor-not-allowed"
              />
              <span className="text-[10px] text-[#64748B] mt-1 block">Email address cannot be changed directly in P1/P2.</span>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="btn-emerald-primary text-xs py-2.5 px-5 font-bold"
            >
              {profileLoading ? 'Saving...' : 'Update Name'}
            </button>
          </form>
        </div>

        {/* Password Form */}
        <div className="dashboard-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key size={16} className="text-[#F59E0B]" />
            Change Password
          </h3>

          {passwordMsg && (
            <div className={`p-3 rounded-xl text-xs border ${
              passwordMsg.type === 'success' ? 'bg-[#10B981]/10 text-[#34D399] border-[#10B981]/30' : 'bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30'
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} noValidate className="space-y-3">
            <div>
              <label htmlFor="change-currentPassword" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Current Password
              </label>
              <input
                id="change-currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (passwordErrors.currentPassword) setPasswordErrors(prev => ({ ...prev, currentPassword: null }));
                }}
                className={`input-field text-xs ${passwordErrors.currentPassword ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
              />
              {passwordErrors.currentPassword && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={12} className="shrink-0" />
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="change-newPassword" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                New Password (Min. 8 chars)
              </label>
              <div className="relative">
                <input
                  id="change-newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.newPassword) setPasswordErrors(prev => ({ ...prev, newPassword: null }));
                  }}
                  className={`input-field pr-10 text-xs ${passwordErrors.newPassword ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <PasswordStrengthMeter password={newPassword} />

              {passwordErrors.newPassword && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={12} className="shrink-0" />
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="change-confirmPassword" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Confirm New Password
              </label>
              <input
                id="change-confirmPassword"
                name="newPasswordConfirmation"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPasswordConfirmation}
                onChange={(e) => {
                  setNewPasswordConfirmation(e.target.value);
                  if (passwordErrors.newPasswordConfirmation) setPasswordErrors(prev => ({ ...prev, newPasswordConfirmation: null }));
                }}
                className={`input-field text-xs ${passwordErrors.newPasswordConfirmation ? 'border-[#F43F5E] focus:border-[#F43F5E]' : ''}`}
              />
              {passwordErrors.newPasswordConfirmation && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={12} className="shrink-0" />
                  {passwordErrors.newPasswordConfirmation}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-secondary text-xs py-2.5 px-5 font-bold"
            >
              {passwordLoading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
