import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Shield, 
  Calendar, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Camera, 
  Upload, 
  Image as ImageIcon,
  GraduationCap,
  FolderKanban,
  Building2
} from 'lucide-react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
];

export default function ProfileView() {
  const { user, accessToken, setUser } = useAuth();
  
  const fileInputRef = useRef(null);
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [teacherId, setTeacherId] = useState(user?.teacherId || '');
  const [studentId, setStudentId] = useState(user?.studentId || '');
  
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

  const role = (user?.role || '').toUpperCase();
  const isTeacher = role === 'TEACHER' || role === 'CREATOR';
  const isStudent = role === 'STUDENT' || role === 'LEARNER';

  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
      if (user.teacherId) setTeacherId(user.teacherId);
      if (user.studentId) setStudentId(user.studentId);
    }
  }, [user]);

  // Handle local image file upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Image size should be less than 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (result) {
        setAvatarUrl(result);
        setProfileMsg({ type: 'info', text: 'Photo selected! Click "Save Profile Changes" below to apply.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setNameError('');
    setProfileMsg(null);

    if (!name.trim()) {
      setNameError('Full name is required.');
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
        body: JSON.stringify({ 
          name: name.trim(),
          avatarUrl: avatarUrl ? avatarUrl.trim() : null,
          teacherId: isTeacher ? (teacherId ? teacherId.trim() : null) : undefined,
          studentId: isStudent ? (studentId ? studentId.trim() : null) : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data.profile);
        setProfileMsg({ type: 'success', text: 'Profile information updated successfully!' });
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
      <div className="pb-4 border-b border-[#1E293B]">
        <h1 className="text-2xl font-black text-white tracking-wide">
          Account Profile &amp; Settings
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1 font-medium">
          Manage your personal details, profile photo, verified IDs, and credentials.
        </p>
      </div>

      {/* Account Overview Cards (Clean Glassmorphism) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B]">Assigned Role</p>
          <p className="text-lg font-extrabold text-white flex items-center gap-2">
            <Shield size={18} className="text-[#34D399]" />
            {user?.role}
          </p>
          <span className="text-[10px] text-[#94A3B8]">Strictly isolated by RBAC</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B]">Email Status</p>
          <p className="text-lg font-extrabold text-white flex items-center gap-2">
            <CheckCircle2 size={18} className={user?.isVerified ? "text-[#34D399]" : "text-[#F59E0B]"} />
            {user?.isVerified ? 'Verified' : 'Direct Login Active'}
          </p>
          <span className="text-[10px] text-[#94A3B8] truncate block">{user?.email}</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#64748B]">
            {isTeacher ? 'Faculty Identifier' : isStudent ? 'Student ID' : 'Affiliation'}
          </p>
          <p className="text-lg font-extrabold text-white flex items-center gap-2 font-mono">
            {isTeacher ? <FolderKanban size={18} className="text-[#A78BFA]" /> : <GraduationCap size={18} className="text-[#38BDF8]" />}
            {isTeacher ? (user?.teacherId || 'Not Set') : isStudent ? (user?.studentId || 'Not Set') : 'Platform Staff'}
          </p>
          <span className="text-[10px] text-[#94A3B8]">Institutional Record</span>
        </div>
      </div>

      {/* Profile Edit Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Personal Details & Avatar Form */}
        <div className="p-6 rounded-2xl bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-[#1E293B]">
            <User size={16} className="text-[#34D399]" />
            Personal Profile &amp; Photo
          </h3>

          {profileMsg && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
              profileMsg.type === 'success' 
                ? 'bg-[#10B981]/15 border-[#10B981]/30 text-[#34D399]' 
                : profileMsg.type === 'info'
                ? 'bg-[#38BDF8]/15 border-[#38BDF8]/30 text-[#38BDF8]'
                : 'bg-[#F43F5E]/15 border-[#F43F5E]/30 text-[#F43F5E]'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          {/* Profile Photo / Avatar Picker */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#94A3B8]">
              Profile Photo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#142036] border-2 border-[#243656] overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-xl text-[#38BDF8] bg-[#38BDF8]/15">
                    {name ? name[0].toUpperCase() : 'U'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-2 font-bold"
                >
                  <Upload size={13} />
                  <span>Upload Local Photo</span>
                </button>
                <p className="text-[10px] text-[#64748B]">PNG, JPG, or WebP up to 2MB</p>
              </div>
            </div>

            {/* Quick Avatar Presets */}
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Or Pick a Default Avatar:</p>
              <div className="flex items-center gap-2.5">
                {PRESET_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-all ${
                      avatarUrl === url ? 'border-[#34D399] scale-110 shadow-md shadow-[#34D399]/20' : 'border-[#1E293B] hover:border-[#38BDF8]'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="text-[10px] text-[#64748B] hover:text-[#F43F5E] ml-2 font-bold"
                  >
                    Clear Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            
            {/* Full Name */}
            <div>
              <label htmlFor="profile-name" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Full Display Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                className={`input-field text-xs py-2 w-full ${nameError ? 'border-[#F43F5E]' : ''}`}
                placeholder="Your full name"
              />
              {nameError && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={13} />
                  {nameError}
                </p>
              )}
            </div>

            {/* Teacher ID (Visible & Editable for Teachers) */}
            {isTeacher && (
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Teacher ID / Faculty ID
                </label>
                <input
                  type="text"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  placeholder="e.g. FAC-2024-019"
                  className="input-field text-xs py-2 w-full font-mono"
                />
                <p className="text-[10px] text-[#64748B] mt-0.5">Assigned institutional teacher identifier.</p>
              </div>
            )}

            {/* Student ID (Visible & Editable for Students) */}
            {isStudent && (
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Student ID
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU-2024-042"
                  className="input-field text-xs py-2 w-full font-mono"
                />
                <p className="text-[10px] text-[#64748B] mt-0.5">Your official institutional student ID.</p>
              </div>
            )}

            {/* Email (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="input-field text-xs py-2 w-full opacity-60 cursor-not-allowed bg-[#090F1A]"
              />
              <span className="text-[10px] text-[#64748B] mt-1 block">
                Contact administrator to modify primary email.
              </span>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="btn-emerald-primary text-xs py-2 px-5 font-bold gap-2 mt-2"
            >
              {profileLoading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="p-6 rounded-2xl bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-[#1E293B]">
            <Key size={16} className="text-[#38BDF8]" />
            Security &amp; Password
          </h3>

          {passwordMsg && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
              passwordMsg.type === 'success' 
                ? 'bg-[#10B981]/15 border-[#10B981]/30 text-[#34D399]' 
                : 'bg-[#F43F5E]/15 border-[#F43F5E]/30 text-[#F43F5E]'
            }`}>
              {passwordMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            
            {/* Current Password */}
            <div>
              <label htmlFor="current-password" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`input-field text-xs py-2 w-full ${passwordErrors.currentPassword ? 'border-[#F43F5E]' : ''}`}
                placeholder="Enter current password"
              />
              {passwordErrors.currentPassword && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={13} />
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`input-field text-xs py-2 w-full pr-10 ${passwordErrors.newPassword ? 'border-[#F43F5E]' : ''}`}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <PasswordStrengthMeter password={newPassword} />

              {passwordErrors.newPassword && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={13} />
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={newPasswordConfirmation}
                onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                className={`input-field text-xs py-2 w-full ${passwordErrors.newPasswordConfirmation ? 'border-[#F43F5E]' : ''}`}
                placeholder="Re-enter new password"
              />
              {passwordErrors.newPasswordConfirmation && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1">
                  <AlertCircle size={13} />
                  {passwordErrors.newPasswordConfirmation}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-secondary text-xs py-2 px-5 font-bold gap-2 mt-2"
            >
              {passwordLoading ? 'Updating Credentials...' : 'Update Password'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
