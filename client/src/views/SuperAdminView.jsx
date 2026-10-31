import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  Users, 
  BookOpen, 
  Award, 
  Search, 
  Trash2, 
  UserCheck, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Building,
  GraduationCap,
  Layers,
  FolderPlus,
  ArrowRightLeft,
  Plus,
  X
} from 'lucide-react';

export default function SuperAdminView({ setActiveRoute }) {
  const { accessToken, user } = useAuth();
  const [adminTab, setAdminTab] = useState('users'); // 'users' | 'institution'
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [actionMessage, setActionMessage] = useState('');

  // Phase P6 Institutional State
  const [instStructure, setInstStructure] = useState({
    organization: null,
    academicYears: [],
    departments: [],
    classes: [],
    sections: [],
    subjects: []
  });
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [teacherAllocations, setTeacherAllocations] = useState([]);
  const [transferModalStudent, setTransferModalStudent] = useState(null);
  const [targetSectionId, setTargetSectionId] = useState('');

  // Quick entity creation modals
  const [showAddDept, setShowAddDept] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  const [showAddClass, setShowAddClass] = useState(false);
  const [classForm, setClassForm] = useState({ department_id: '', name: '', code: '' });

  const [showAddSection, setShowAddSection] = useState(false);
  const [sectionForm, setSectionForm] = useState({ class_id: '', academic_year_id: '', name: '', capacity: 60 });

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', department_id: '', description: '' });

  const fetchInstitutionData = async () => {
    try {
      const [sRes, stRes, tRes] = await Promise.all([
        fetch('/api/v1/institutions/structure', { headers: { 'Authorization': `Bearer ${accessToken}` } }),
        fetch('/api/v1/institutions/students', { headers: { 'Authorization': `Bearer ${accessToken}` } }),
        fetch('/api/v1/institutions/my-assignments', { headers: { 'Authorization': `Bearer ${accessToken}` } })
      ]);

      const [sData, stData, tData] = await Promise.all([sRes.json(), stRes.json(), tRes.json()]);

      if (sData.success) setInstStructure(sData.data);
      if (stData.success) setEnrolledStudents(stData.data.students || []);
      if (tData.success) setTeacherAllocations(tData.data.allocations || []);
    } catch (e) {
      console.error('Failed to load institution data', e);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch platform analytics
      const statsRes = await fetch('/api/v1/analytics/admin', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data);
      }

      // 2. Fetch users list
      let url = `/api/v1/users?page=${page}&limit=15&search=${encodeURIComponent(search)}`;
      if (roleFilter) url += `&role=${roleFilter}`;

      const usersRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.data.users || []);
        setPagination(usersData.data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load super admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchAdminData();
      fetchInstitutionData();
    }
  }, [accessToken, search, roleFilter, page]);

  const handleTransferStudent = async (e) => {
    e.preventDefault();
    if (!transferModalStudent || !targetSectionId) return;

    try {
      const res = await fetch(`/api/v1/institutions/students/${transferModalStudent.id}/transfer`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_section_id: targetSectionId })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Student ${transferModalStudent.name} transferred successfully.`);
        setTimeout(() => setActionMessage(''), 3500);
        setTransferModalStudent(null);
        setTargetSectionId('');
        fetchInstitutionData();
      } else {
        alert(data.error?.message || 'Error transferring student');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/institutions/departments', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddDept(false);
        setDeptForm({ name: '', code: '', description: '' });
        fetchInstitutionData();
      } else {
        alert(data.error?.message || 'Error creating department');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/institutions/classes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(classForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddClass(false);
        setClassForm({ department_id: '', name: '', code: '' });
        fetchInstitutionData();
      } else {
        alert(data.error?.message || 'Error creating class');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/institutions/sections', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddSection(false);
        setSectionForm({ class_id: '', academic_year_id: '', name: '', capacity: 60 });
        fetchInstitutionData();
      } else {
        alert(data.error?.message || 'Error creating section');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/institutions/subjects', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(subjectForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddSubject(false);
        setSubjectForm({ name: '', code: '', department_id: '', description: '' });
        fetchInstitutionData();
      } else {
        alert(data.error?.message || 'Error creating subject');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRole = async (userId, targetRole) => {
    try {
      const res = await fetch(`/api/v1/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: targetRole })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Role updated to ${targetRole} successfully.`);
        setTimeout(() => setActionMessage(''), 3500);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole } : u));
      } else {
        alert(data.error?.message || 'Error updating role');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to permanently delete user '${userEmail}'?`)) return;

    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`User '${userEmail}' deleted.`);
        setTimeout(() => setActionMessage(''), 3500);
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        alert(data.error?.message || 'Error deleting user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldCheck className="text-[#F59E0B]" size={26} />
            Superadmin Command Center
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Global administrative controls, role promotion, user management, and system metrics.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="btn-secondary text-xs py-2 px-3 gap-1.5 font-semibold"
        >
          <RefreshCw size={14} />
          Refresh Metrics
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          {actionMessage}
        </div>
      )}

      {/* Platform Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Total Accounts</p>
            <p className="text-2xl font-black text-white font-mono mt-1">{stats.users?.total || 0}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {stats.users?.students} Students &bull; {stats.users?.teachers} Teachers
            </p>
          </div>

          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Quizzes Published</p>
            <p className="text-2xl font-black text-[#34D399] font-mono mt-1">{stats.quizzes?.published || 0}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {stats.quizzes?.drafts} Drafts &bull; {stats.quizzes?.total} Total
            </p>
          </div>

          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Total Quiz Attempts</p>
            <p className="text-2xl font-black text-[#38BDF8] font-mono mt-1">{stats.attempts?.total || 0}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {stats.attempts?.completed} Completed
            </p>
          </div>

          <div className="dashboard-card p-4 border border-[#1B2A44]">
            <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider">Average Platform Score</p>
            <p className="text-2xl font-black text-[#F59E0B] font-mono mt-1">{stats.attempts?.averageScore || 0}%</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Across all self-paced sessions
            </p>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-[#1B2A44] gap-2 pt-2">
        <button
          onClick={() => setAdminTab('users')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            adminTab === 'users'
              ? 'border-[#38BDF8] text-[#38BDF8] bg-[#38BDF8]/10'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Users size={16} />
          User Accounts & Global Roles
        </button>
        <button
          onClick={() => setAdminTab('institution')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            adminTab === 'institution'
              ? 'border-[#F59E0B] text-[#F59E0B] bg-[#F59E0B]/10'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Building size={16} />
          Academic Hierarchy & Cohorts (P6)
        </button>
      </div>

      {adminTab === 'users' && (
        /* User Management Section */
        <div className="dashboard-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-[#38BDF8]" />
              User Directory & Access Control
            </h2>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-9 text-xs py-1.5 w-56"
                />
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="input-field text-xs py-1.5 px-3"
              >
                <option value="">All Roles</option>
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ORG_ADMIN">Org Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-xl border border-[#1B2A44]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B111D] text-[#94A3B8] font-mono uppercase text-[10px] tracking-wider border-b border-[#1B2A44]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B2A44] bg-[#0E1626]">
                {users.map(u => {
                  const isSelf = u.id === user?.id;

                  return (
                    <tr key={u.id} className="hover:bg-[#121D32] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[11px] text-[#64748B] font-mono">{u.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          className={`text-xs font-bold py-1 px-2.5 rounded-lg border bg-[#121D32] cursor-pointer ${
                            u.role === 'SUPER_ADMIN' || u.role === 'ADMIN'
                              ? 'text-[#F59E0B] border-[#F59E0B]/40'
                              : u.role === 'TEACHER' || u.role === 'CREATOR'
                              ? 'text-[#8B5CF6] border-[#8B5CF6]/40'
                              : 'text-[#34D399] border-[#34D399]/40'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="TEACHER">TEACHER</option>
                          <option value="ORG_ADMIN">ORG_ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        {u.is_verified ? (
                          <span className="text-[10px] font-bold text-[#34D399] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/30">
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-[#64748B] font-mono">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1.5 rounded-lg bg-[#121D32] hover:bg-[#F43F5E]/20 text-[#64748B] hover:text-[#F43F5E] transition-colors"
                            title="Delete user account"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-[#64748B] font-mono">
                Total {pagination.total} accounts
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-[#94A3B8] font-mono">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  disabled={page === pagination.totalPages}
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {adminTab === 'institution' && (
        <div className="space-y-6">
          {/* Institution Header Card */}
          <div className="dashboard-card p-6 border-l-4 border-l-[#F59E0B]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider text-[#F59E0B] uppercase bg-[#F59E0B]/10 px-2 py-0.5 rounded border border-[#F59E0B]/30">
                  Active Organization
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  {instStructure.organization?.name || 'Apex Institute of Technology & Management'}
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5 font-mono">
                  Code: <span className="text-[#38BDF8]">{instStructure.organization?.code || 'AITM-DELHI'}</span> &bull; Academic Year: <span className="text-[#34D399]">{instStructure.academicYears[0]?.name || '2025-2026'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddDept(true)}
                  className="btn-secondary text-xs py-1.5 px-3 gap-1 font-bold"
                >
                  <Plus size={14} /> Dept
                </button>
                <button
                  onClick={() => setShowAddClass(true)}
                  className="btn-secondary text-xs py-1.5 px-3 gap-1 font-bold"
                >
                  <Plus size={14} /> Class
                </button>
                <button
                  onClick={() => setShowAddSection(true)}
                  className="btn-secondary text-xs py-1.5 px-3 gap-1 font-bold"
                >
                  <Plus size={14} /> Section
                </button>
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="btn-secondary text-xs py-1.5 px-3 gap-1 font-bold"
                >
                  <Plus size={14} /> Subject
                </button>
              </div>
            </div>

            {/* Academic Structure Breakdown Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-[#0B111D] border border-[#1B2A44]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8] font-bold">Departments</span>
                  <FolderPlus size={16} className="text-[#38BDF8]" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {instStructure.departments.length}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1 truncate">
                  {instStructure.departments.map(d => d.code).join(', ') || 'None'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111D] border border-[#1B2A44]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8] font-bold">Classes / Grades</span>
                  <GraduationCap size={16} className="text-[#8B5CF6]" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {instStructure.classes.length}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1 truncate">
                  {instStructure.classes.map(c => c.code).join(', ') || 'None'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111D] border border-[#1B2A44]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8] font-bold">Sections</span>
                  <Layers size={16} className="text-[#34D399]" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {instStructure.sections.length}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1 truncate">
                  {instStructure.sections.map(s => s.name).join(', ') || 'None'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111D] border border-[#1B2A44]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8] font-bold">Curriculum Subjects</span>
                  <BookOpen size={16} className="text-[#F59E0B]" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {instStructure.subjects.length}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1 truncate">
                  {instStructure.subjects.map(s => s.code).join(', ') || 'None'}
                </div>
              </div>
            </div>
          </div>

          {/* Enrolled Students Cohort Management */}
          <div className="dashboard-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap size={18} className="text-[#34D399]" />
                  Enrolled Students & Cohort Allocations
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Manage student section allocations with immutable historical assignment snapshots.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#64748B] bg-[#121D32] px-3 py-1 rounded-full border border-[#1B2A44]">
                {enrolledStudents.length} Students Enrolled
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1B2A44]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B111D] text-[#94A3B8] font-mono uppercase text-[10px] tracking-wider border-b border-[#1B2A44]">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Department & Class</th>
                    <th className="py-3 px-4">Current Section</th>
                    <th className="py-3 px-4 text-right">Cohort Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B2A44] bg-[#0E1626]">
                  {enrolledStudents.map(st => (
                    <tr key={st.id} className="hover:bg-[#121D32] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{st.name}</div>
                        <div className="text-[11px] text-[#64748B] font-mono">{st.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#38BDF8]">
                        {st.roll_number || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{st.class_name || 'Class'}</div>
                        <div className="text-[11px] text-[#64748B]">{st.department_name || 'Dept'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-bold font-mono text-[#34D399] bg-[#10B981]/15 px-2.5 py-1 rounded-md border border-[#10B981]/30">
                          {st.section_name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setTransferModalStudent(st);
                            setTargetSectionId('');
                          }}
                          className="btn-secondary text-[11px] py-1 px-2.5 font-bold gap-1 inline-flex items-center text-[#F59E0B] hover:text-white"
                        >
                          <ArrowRightLeft size={12} /> Transfer Section
                        </button>
                      </td>
                    </tr>
                  ))}
                  {enrolledStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-[#64748B]">
                        No students enrolled in this organization yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teacher Teaching Allocations */}
          <div className="dashboard-card p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen size={18} className="text-[#8B5CF6]" />
              Authorized Teacher Allocations
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Teachers can only author and publish assessments to the sections and subjects assigned here.
            </p>

            <div className="overflow-x-auto rounded-xl border border-[#1B2A44]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B111D] text-[#94A3B8] font-mono uppercase text-[10px] tracking-wider border-b border-[#1B2A44]">
                  <tr>
                    <th className="py-3 px-4">Teacher</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Authorized Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B2A44] bg-[#0E1626]">
                  {teacherAllocations.map(al => (
                    <tr key={al.id} className="hover:bg-[#121D32] transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        {al.teacher_name}
                      </td>
                      <td className="py-3 px-4 text-[#94A3B8]">
                        {al.department_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#38BDF8]">{al.subject_name}</span>
                        <span className="text-[10px] text-[#64748B] ml-1 font-mono">({al.subject_code})</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#34D399]">
                        {al.section_name} ({al.class_name})
                      </td>
                    </tr>
                  ))}
                  {teacherAllocations.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-[#64748B]">
                        No teacher allocations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Section Modal */}
      {transferModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0E1626] border border-[#1B2A44] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-[#F59E0B]" />
                Transfer Student Section
              </h3>
              <button
                onClick={() => setTransferModalStudent(null)}
                className="text-[#64748B] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-[#0B111D] rounded-xl border border-[#1B2A44] text-xs space-y-1">
              <p className="text-white font-bold">{transferModalStudent.name}</p>
              <p className="text-[#64748B] font-mono">{transferModalStudent.email}</p>
              <p className="text-[#38BDF8] text-[11px] pt-1">
                Current Section: <span className="font-bold">{transferModalStudent.section_name}</span>
              </p>
            </div>

            <form onSubmit={handleTransferStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1.5 uppercase font-mono">
                  Select New Target Section
                </label>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  required
                  className="input-field text-xs py-2 w-full"
                >
                  <option value="">-- Choose New Section --</option>
                  {instStructure.sections
                    .filter(s => s.id !== transferModalStudent.section_id)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.class_name} - {s.academic_year_name})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8] text-[11px]">
                <p className="font-bold mb-0.5">Immutable Historical Snapshot:</p>
                <p>Transferring the student will associate them with the new section for future assessments. All historical assignments, test attempts, and scores in their prior section remain preserved.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalStudent(null)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!targetSectionId}
                  className="btn-primary text-xs py-2 px-5 font-bold disabled:opacity-50"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Department Modal */}
      {showAddDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1626] border border-[#1B2A44] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white">Create Department</h3>
              <button onClick={() => setShowAddDept(false)} className="text-[#64748B] hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Total Quality Management"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="e.g. TQM"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddDept(false)} className="btn-secondary text-xs py-2 px-4">Cancel</button>
                <button type="submit" className="btn-primary text-xs py-2 px-5 font-bold">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Class Modal */}
      {showAddClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1626] border border-[#1B2A44] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white">Create Class / Program</h3>
              <button onClick={() => setShowAddClass(false)} className="text-[#64748B] hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Department</label>
                <select
                  required
                  value={classForm.department_id}
                  onChange={e => setClassForm({ ...classForm, department_id: e.target.value })}
                  className="input-field text-xs py-2 w-full"
                >
                  <option value="">-- Select Department --</option>
                  {instStructure.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Class / Program Name</label>
                <input
                  type="text"
                  required
                  value={classForm.name}
                  onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="e.g. B.Tech Operations"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={classForm.code}
                  onChange={e => setClassForm({ ...classForm, code: e.target.value })}
                  placeholder="e.g. BTECH-OPS"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddClass(false)} className="btn-secondary text-xs py-2 px-4">Cancel</button>
                <button type="submit" className="btn-primary text-xs py-2 px-5 font-bold">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Section Modal */}
      {showAddSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1626] border border-[#1B2A44] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white">Create Section</h3>
              <button onClick={() => setShowAddSection(false)} className="text-[#64748B] hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSection} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Class / Program</label>
                <select
                  required
                  value={sectionForm.class_id}
                  onChange={e => setSectionForm({ ...sectionForm, class_id: e.target.value })}
                  className="input-field text-xs py-2 w-full"
                >
                  <option value="">-- Select Class --</option>
                  {instStructure.classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Academic Year</label>
                <select
                  required
                  value={sectionForm.academic_year_id}
                  onChange={e => setSectionForm({ ...sectionForm, academic_year_id: e.target.value })}
                  className="input-field text-xs py-2 w-full"
                >
                  <option value="">-- Select Academic Year --</option>
                  {instStructure.academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Section Name</label>
                <input
                  type="text"
                  required
                  value={sectionForm.name}
                  onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="e.g. Section C"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddSection(false)} className="btn-secondary text-xs py-2 px-4">Cancel</button>
                <button type="submit" className="btn-primary text-xs py-2 px-5 font-bold">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E1626] border border-[#1B2A44] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-base font-bold text-white">Create Subject</h3>
              <button onClick={() => setShowAddSubject(false)} className="text-[#64748B] hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Department</label>
                <select
                  required
                  value={subjectForm.department_id}
                  onChange={e => setSubjectForm({ ...subjectForm, department_id: e.target.value })}
                  className="input-field text-xs py-2 w-full"
                >
                  <option value="">-- Select Department --</option>
                  {instStructure.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="e.g. Six Sigma & Lean"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  value={subjectForm.code}
                  onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  placeholder="e.g. TQM-401"
                  className="input-field text-xs py-2 w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddSubject(false)} className="btn-secondary text-xs py-2 px-4">Cancel</button>
                <button type="submit" className="btn-primary text-xs py-2 px-5 font-bold">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}