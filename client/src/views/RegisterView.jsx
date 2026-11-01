import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, Building2, User, GraduationCap, ShieldAlert } from 'lucide-react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

export default function RegisterView({ setActiveRoute }) {
  // Mode: 'INDIVIDUAL' or 'INSTITUTIONAL'
  const [accountType, setAccountType] = useState('INDIVIDUAL');

  // Common Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Institutional Specific Fields
  const [instRole, setInstRole] = useState('STUDENT'); // 'STUDENT' or 'TEACHER'
  const [collegesList, setCollegesList] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [collegeStructure, setCollegeStructure] = useState({ departments: [], classes: [], sections: [] });
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [rollNumber, setRollNumber] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [registeredOrgName, setRegisteredOrgName] = useState('');

  // Fetch registered colleges when switching to Institutional
  useEffect(() => {
    async function loadColleges() {
      try {
        const res = await fetch('/api/v1/institutions/colleges');
        const data = await res.json();
        if (data.success && data.data?.colleges) {
          setCollegesList(data.data.colleges);
          if (data.data.colleges.length > 0 && !selectedCollegeId) {
            const firstId = data.data.colleges[0].id;
            setSelectedCollegeId(firstId);
            loadStructure(firstId);
          }
        }
      } catch (err) {
        console.error('Error fetching colleges:', err);
      }
    }
    if (accountType === 'INSTITUTIONAL') {
      loadColleges();
    }
  }, [accountType]);

  const loadStructure = async (collegeId) => {
    if (!collegeId) return;
    try {
      const res = await fetch(`/api/v1/institutions/colleges/${collegeId}/structure`);
      const data = await res.json();
      if (data.success && data.data) {
        setCollegeStructure(data.data);
      }
    } catch (err) {
      console.error('Error fetching structure:', err);
    }
  };

  const handleCollegeChange = (id) => {
    setSelectedCollegeId(id);
    setSelectedDeptId('');
    setSelectedClassId('');
    setSelectedSectionId('');
    loadStructure(id);
  };

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
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      errs.password = 'Password must include uppercase, lowercase, a number, and a special symbol.';
    }

    if (!passwordConfirmation) {
      errs.passwordConfirmation = 'Please confirm your password.';
    } else if (password !== passwordConfirmation) {
      errs.passwordConfirmation = 'Passwords do not match.';
    }

    if (accountType === 'INSTITUTIONAL') {
      if (!selectedCollegeId) {
        errs.college = 'Please select your College / University.';
      }
      if (instRole === 'STUDENT' && !selectedSectionId) {
        errs.section = 'Please select your Cohort Section.';
      }
      if (instRole === 'STUDENT' && !rollNumber.trim()) {
        errs.rollNumber = 'Student Roll Number / University ID is required.';
      }
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
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
        passwordConfirmation,
        accountType,
        role: accountType === 'INSTITUTIONAL' ? instRole : 'STUDENT',
        organizationId: accountType === 'INSTITUTIONAL' ? selectedCollegeId : null,
        sectionId: (accountType === 'INSTITUTIONAL' && instRole === 'STUDENT') ? selectedSectionId : null,
        rollNumber: (accountType === 'INSTITUTIONAL' && instRole === 'STUDENT') ? rollNumber.trim() : null
      };

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (accountType === 'INSTITUTIONAL') {
          const chosenCol = collegesList.find(c => c.id === selectedCollegeId);
          setRegisteredOrgName(chosenCol?.name || 'your institution');
          setSuccessMsg(
            'Institutional Account Created! Under institutional policy, your account is queued for administrator/teacher verification. Access will be granted once approved.'
          );
        } else {
          setSuccessMsg('Individual Account created successfully! You can now log in directly.');
        }
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
    <div className="max-w-xl mx-auto py-8 space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-wide">
          Create Your Qubix Account
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Choose how you will be using the Qubix Assessment Platform.
        </p>
      </div>

      {/* Account Type Selector Tabs */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#0D1524] border border-[#1E2D4A] rounded-2xl">
        <button
          type="button"
          onClick={() => { setAccountType('INDIVIDUAL'); setFieldErrors({}); }}
          className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            accountType === 'INDIVIDUAL'
              ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40 shadow-lg shadow-[#10B981]/10'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <User size={16} />
          <span>Individual Account</span>
        </button>

        <button
          type="button"
          onClick={() => { setAccountType('INSTITUTIONAL'); setFieldErrors({}); }}
          className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            accountType === 'INSTITUTIONAL'
              ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 shadow-lg shadow-[#38BDF8]/10'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <Building2 size={16} />
          <span>School / College Account</span>
        </button>
      </div>

      {/* Type Explainer Card */}
      <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
        accountType === 'INDIVIDUAL'
          ? 'bg-[#10B981]/5 border-[#10B981]/30 text-[#A7F3D0]'
          : 'bg-[#38BDF8]/5 border-[#38BDF8]/30 text-[#BAE6FD]'
      }`}>
        {accountType === 'INDIVIDUAL' ? (
          <>
            <CheckCircle2 size={18} className="text-[#34D399] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Self-Paced Individual Access</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Anyone can register freely! Immediate access to quizzes, study flashcards, and mistake notebook. Not bound to any college (you can affiliate later).
              </p>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert size={18} className="text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Institutional Security & Verification</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                For College Students & Teachers. For security reasons, institutional accounts require approval by your Organization Admin or Instructor before access is granted.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Notification Banners */}
      {errorMsg && (
        <div className="dashboard-card p-3.5 border-l-4 border-l-[#F43F5E] flex items-center gap-2.5 text-xs text-[#F43F5E]">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="dashboard-card p-5 border-l-4 border-l-[#10B981] space-y-4">
          <div className="flex items-start gap-3 text-xs text-[#34D399]">
            <CheckCircle2 size={22} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Account Registered</p>
              <p className="text-xs text-[#CBD5E1] mt-1">{successMsg}</p>
              {accountType === 'INSTITUTIONAL' && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#09111E] border border-[#1E2E4A] text-[11px] text-[#94A3B8]">
                  Registered Institution: <strong className="text-white">{registeredOrgName}</strong><br />
                  Status: <strong className="text-[#FBBF24]">PENDING APPROVAL</strong>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveRoute('login')}
            className="btn-emerald-primary w-full text-xs py-2.5 gap-1.5 font-bold"
          >
            Go to Login <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Form Card */}
      {!successMsg && (
        <div className="dashboard-card p-6 space-y-4">
          <form onSubmit={handleRegister} noValidate className="space-y-4">

            {/* Institutional Hierarchy Selectors */}
            {accountType === 'INSTITUTIONAL' && (
              <div className="p-4 rounded-xl bg-[#0B1322] border border-[#1E2D4A] space-y-3.5">
                <p className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} />
                  Institutional Affiliation Details
                </p>

                {/* Role in Institution */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Your Institutional Role *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInstRole('STUDENT')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                        instRole === 'STUDENT'
                          ? 'bg-[#10B981]/20 border-[#10B981] text-[#34D399]'
                          : 'bg-[#0E1626] border-[#1F2F4D] text-[#94A3B8]'
                      }`}
                    >
                      Student / Scholar
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstRole('TEACHER')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                        instRole === 'TEACHER'
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#A78BFA]'
                          : 'bg-[#0E1626] border-[#1F2F4D] text-[#94A3B8]'
                      }`}
                    >
                      Teacher / Faculty
                    </button>
                  </div>
                </div>

                {/* College Selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Select College / University *
                  </label>
                  <select
                    value={selectedCollegeId}
                    onChange={(e) => handleCollegeChange(e.target.value)}
                    className="input-field text-xs py-2 w-full"
                  >
                    <option value="">-- Choose Registered College --</option>
                    {collegesList.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name} ({col.code})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.college && (
                    <p className="text-xs text-[#F43F5E] mt-1">{fieldErrors.college}</p>
                  )}
                </div>

                {/* Department */}
                {selectedCollegeId && (
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Department / Program *
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => {
                        setSelectedDeptId(e.target.value);
                        setSelectedClassId('');
                        setSelectedSectionId('');
                      }}
                      className="input-field text-xs py-2 w-full"
                    >
                      <option value="">-- Choose Department (e.g. Computer Science) --</option>
                      {collegeStructure.departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* If Student: Class & Section */}
                {instRole === 'STUDENT' && selectedDeptId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                        Course / Year *
                      </label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => {
                          setSelectedClassId(e.target.value);
                          setSelectedSectionId('');
                        }}
                        className="input-field text-xs py-2 w-full"
                      >
                        <option value="">-- Choose Class --</option>
                        {collegeStructure.classes
                          .filter(c => c.department_id === selectedDeptId)
                          .map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} ({cls.code})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                        Section / Cohort *
                      </label>
                      <select
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                        className="input-field text-xs py-2 w-full"
                      >
                        <option value="">-- Choose Section --</option>
                        {collegeStructure.sections
                          .filter(s => s.class_id === selectedClassId)
                          .map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              Section {sec.name}
                            </option>
                          ))}
                      </select>
                      {fieldErrors.section && (
                        <p className="text-xs text-[#F43F5E] mt-1">{fieldErrors.section}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* If Student: Roll Number */}
                {instRole === 'STUDENT' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Student Roll Number / University ID *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2024-CSE-042"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="input-field text-xs py-2 w-full"
                    />
                    {fieldErrors.rollNumber && (
                      <p className="text-xs text-[#F43F5E] mt-1">{fieldErrors.rollNumber}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
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
                className={`input-field ${fieldErrors.name ? 'border-[#F43F5E]' : ''}`}
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
                {accountType === 'INSTITUTIONAL' ? 'Official / College Email Address' : 'Email Address'}
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="username email"
                autoCapitalize="none"
                placeholder={accountType === 'INSTITUTIONAL' ? 'student@university.edu' : 'name@example.com'}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                }}
                className={`input-field ${fieldErrors.email ? 'border-[#F43F5E]' : ''}`}
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
                  className={`input-field pr-10 ${fieldErrors.password ? 'border-[#F43F5E]' : ''}`}
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
                className={`input-field ${fieldErrors.passwordConfirmation ? 'border-[#F43F5E]' : ''}`}
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
                  Processing Registration...
                </div>
              ) : (
                <>
                  <UserPlus size={15} />
                  {accountType === 'INSTITUTIONAL' ? 'Submit for Institutional Verification' : 'Create Individual Account'}
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
