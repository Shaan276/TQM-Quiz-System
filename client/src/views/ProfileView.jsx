import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Calendar, Key, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfileView() {
  const { user, accessToken, setUser } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);

    try {
      const res = await fetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ name })
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
    setPasswordLoading(true);
    setPasswordMsg(null);

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
          <span className="text-[10px] text-[#94A3B8]">Phase P1 Initial Release</span>
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

          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Registered Email</label>
              <input
                type="text"
                disabled
                value={user?.email || ''}
                className="input-field opacity-60 cursor-not-allowed"
              />
              <span className="text-[10px] text-[#64748B] mt-1 block">Email address cannot be changed directly in P1.</span>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="btn-emerald-primary text-xs py-2.5 px-5"
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

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">New Password (Min. 8 chars)</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={newPasswordConfirmation}
                onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-secondary text-xs py-2.5 px-5"
            >
              {passwordLoading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
