import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Building2, 
  User, 
  GraduationCap, 
  ShieldAlert,
  Search,
  FolderKanban
} from 'lucide-react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import SearchableSelect from '../components/SearchableSelect';

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
  const [collegeSearch, setCollegeSearch] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');

  const [collegeStructure, setCollegeStructure] = useState({ departments: [], classes: [], sections: [] });
  const [deptSearch, setDeptSearch] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  
  // Role Identifiers
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');

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
    if (fieldErrors.college) setFieldErrors(prev => ({ ...prev, college: null }));
    if (id) {
      loadStructure(id);
    } else {
      setCollegeStructure({ departments: [], classes: [], sections: [] });
    }
  };

  const collegeOptions = collegesList.map(col => ({
    value: col.id,
    label: `${col.name} (${col.code})`,
    sublabel: col.website || ''
  }));

  const departmentOptions = (collegeStructure.departments || []).map(dept => ({
    value: dept.id,
    label: `${dept.name} (${dept.code})`
  }));

  const classOptions = [
    { value: '', label: '-- All Classes / Years --' },
    ...(collegeStructure.classes || [])
      .filter(c => c.department_id === selectedDeptId)
      .map(cls => ({
        value: cls.id,
        label: `${cls.name} (${cls.code})`
      }))
  ];

  const sectionOptions = (collegeStructure.sections || [])
    .filter(s => !selectedClassId || s.class_id === selectedClassId)
    .map(sec => ({
      value: sec.id,
      label: `Section ${sec.name}`
    }));

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
        errs.college = 'Please select your College / University from the list.';
      }
      if (!selectedDeptId) {
        errs.department = 'Please select your Department / Program.';
      }

      if (instRole === 'STUDENT') {
        if (!selectedSectionId) {
          errs.section = 'Please select your Cohort Section.';
        }
        if (!studentId.trim()) {
          errs.studentId = 'Student ID is required.';
        }
      }

      if (instRole === 'TEACHER') {
        if (!teacherId.trim()) {
          errs.teacherId = 'Teacher ID / Faculty ID is required.';
        }
      }
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setErrorMsg('Please complete all highlighted mandatory fields before submitting.');
      return false;
    }
    return true;
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
        studentId: (accountType === 'INSTITUTIONAL' && instRole === 'STUDENT') ? studentId.trim() : null,
        teacherId: (accountType === 'INSTITUTIONAL' && instRole === 'TEACHER') ? teacherId.trim() : null
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
        <h2 className="text-2xl font-black text-white tracking-wide">
          Create Your Qubix Account
        </h2>
        <p className="text-xs text-[#94A3B8]">
          Choose between Individual self-paced access or an official Institutional profile.
        </p>
      </div>

      {/* Account Type Selector Tabs (Glassmorphism) */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md rounded-2xl shadow-sm">
        <button
          type="button"
          onClick={() => { setAccountType('INDIVIDUAL'); setFieldErrors({}); setErrorMsg(''); }}
          className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            accountType === 'INDIVIDUAL'
              ? 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40 shadow-sm'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <User size={16} />
          <span>Individual Account</span>
        </button>

        <button
          type="button"
          onClick={() => { setAccountType('INSTITUTIONAL'); setFieldErrors({}); setErrorMsg(''); }}
          className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            accountType === 'INSTITUTIONAL'
              ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 shadow-sm'
              : 'text-[#94A3B8] hover:text-white'
          }`}
        >
          <Building2 size={16} />
          <span>School / College Account</span>
        </button>
      </div>

      {/* Type Explainer Card */}
      <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 backdrop-blur-md ${
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
                Immediate access to quizzes, study flashcards, and personal mistake revision. Free and open to everyone.
              </p>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert size={18} className="text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Institutional Security Verification</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                For College Students &amp; Faculty. To ensure academic integrity, institutional accounts require verification by your college administrator or teacher before access.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-[#F43F5E]/10 border border-[#F43F5E]/40 flex items-center gap-3 text-xs text-[#F43F5E] animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="p-5 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/40 space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3 text-xs text-[#34D399]">
            <CheckCircle2 size={22} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Account Registered</p>
              <p className="text-xs text-[#CBD5E1] mt-1">{successMsg}</p>
              {accountType === 'INSTITUTIONAL' && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#09111E] border border-[#1E2E4A] text-[11px] text-[#94A3B8]">
                  Registered Institution: <strong className="text-white">{registeredOrgName}</strong><br />
                  Approval Gate: <strong className="text-[#FBBF24]">PENDING REVIEW</strong>
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
        <div className="p-6 md:p-8 rounded-2xl bg-[#0D1524]/80 border border-white/[0.08] backdrop-blur-md shadow-sm space-y-5">
          <form onSubmit={handleRegister} noValidate className="space-y-4">

            {/* Institutional Hierarchy Selectors */}
            {accountType === 'INSTITUTIONAL' && (
              <div className="p-4 rounded-xl bg-[#090F1A] border border-[#1F2F4D] space-y-4">
                <p className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-[#1A2740]">
                  <Building2 size={14} />
                  Institutional Affiliation Details
                </p>

                {/* Role in Institution */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Your Institutional Role *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setInstRole('STUDENT'); setFieldErrors({}); }}
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
                      onClick={() => { setInstRole('TEACHER'); setFieldErrors({}); }}
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

                {/* 1. College / University Searchable Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#94A3B8]">
                    1. Select College / University *
                  </label>
                  <SearchableSelect
                    options={collegeOptions}
                    value={selectedCollegeId}
                    onChange={handleCollegeChange}
                    placeholder="-- Select College / University --"
                    searchPlaceholder="Search university by name or code..."
                    error={fieldErrors.college}
                  />
                </div>

                {/* 2. Department / Program (ONLY shown when university is selected) */}
                {selectedCollegeId ? (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="block text-xs font-semibold text-[#94A3B8]">
                      2. Department / Program *
                    </label>
                    <SearchableSelect
                      options={departmentOptions}
                      value={selectedDeptId}
                      onChange={(deptId) => {
                        setSelectedDeptId(deptId);
                        setSelectedClassId('');
                        setSelectedSectionId('');
                        if (fieldErrors.department) setFieldErrors(prev => ({ ...prev, department: null }));
                      }}
                      placeholder="-- Select Department --"
                      searchPlaceholder="Search department by name or code..."
                      error={fieldErrors.department}
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#0B1322] border border-[#1A2740] text-[11px] text-[#64748B] flex items-center gap-2">
                    <AlertCircle size={14} className="text-[#38BDF8]" />
                    <span>Select a College / University above to view available departments.</span>
                  </div>
                )}

                {/* If Student: Class & Section */}
                {instRole === 'STUDENT' && selectedDeptId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                        3. Course / Year
                      </label>
                      <SearchableSelect
                        options={classOptions}
                        value={selectedClassId}
                        onChange={(clsId) => {
                          setSelectedClassId(clsId);
                          setSelectedSectionId('');
                        }}
                        placeholder="-- All Classes / Years --"
                        searchPlaceholder="Search course / class..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                        4. Section / Cohort *
                      </label>
                      <SearchableSelect
                        options={sectionOptions}
                        value={selectedSectionId}
                        onChange={(secId) => {
                          setSelectedSectionId(secId);
                          if (fieldErrors.section) setFieldErrors(prev => ({ ...prev, section: null }));
                        }}
                        placeholder="-- Select Section --"
                        searchPlaceholder="Search section..."
                        error={fieldErrors.section}
                      />
                    </div>
                  </div>
                )}

                {/* If Student: Student ID */}
                {instRole === 'STUDENT' && (
                  <div className="animate-in fade-in">
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Student ID *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STU-2024-042"
                      value={studentId}
                      onChange={(e) => {
                        setStudentId(e.target.value);
                        if (fieldErrors.studentId) setFieldErrors(prev => ({ ...prev, studentId: null }));
                      }}
                      className={`input-field text-xs py-2 w-full font-mono ${fieldErrors.studentId ? 'border-[#F43F5E]' : ''}`}
                    />
                    {fieldErrors.studentId && (
                      <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold">
                        <AlertCircle size={13} className="shrink-0" />
                        {fieldErrors.studentId}
                      </p>
                    )}
                  </div>
                )}

                {/* If Teacher: Teacher ID */}
                {instRole === 'TEACHER' && (
                  <div className="animate-in fade-in">
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Teacher ID / Faculty ID *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. FAC-2024-019"
                      value={teacherId}
                      onChange={(e) => {
                        setTeacherId(e.target.value);
                        if (fieldErrors.teacherId) setFieldErrors(prev => ({ ...prev, teacherId: null }));
                      }}
                      className={`input-field text-xs py-2 w-full font-mono ${fieldErrors.teacherId ? 'border-[#F43F5E]' : ''}`}
                    />
                    {fieldErrors.teacherId && (
                      <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold">
                        <AlertCircle size={13} className="shrink-0" />
                        {fieldErrors.teacherId}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Full Name *
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
                className={`input-field text-xs py-2 w-full ${fieldErrors.name ? 'border-[#F43F5E]' : ''}`}
              />
              {fieldErrors.name && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                {accountType === 'INSTITUTIONAL' ? 'Official / College Email Address *' : 'Email Address *'}
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
                className={`input-field text-xs py-2 w-full ${fieldErrors.email ? 'border-[#F43F5E]' : ''}`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Password *
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
                  className={`input-field pr-10 text-xs py-2 w-full ${fieldErrors.password ? 'border-[#F43F5E]' : ''}`}
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
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Password Confirmation */}
            <div>
              <label htmlFor="reg-passwordConfirmation" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Confirm Password *
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
                className={`input-field text-xs py-2 w-full ${fieldErrors.passwordConfirmation ? 'border-[#F43F5E]' : ''}`}
              />
              {fieldErrors.passwordConfirmation && (
                <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle size={13} className="shrink-0" />
                  {fieldErrors.passwordConfirmation}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-emerald-primary w-full py-2.5 text-xs font-bold gap-2 mt-2 shadow-lg shadow-[#10B981]/15"
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

          <div className="pt-3 border-t border-[#1E2A44] text-center">
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
