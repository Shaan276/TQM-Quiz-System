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
  CheckCircle2
} from 'lucide-react';

export default function SuperAdminView({ setActiveRoute }) {
  const { accessToken, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [actionMessage, setActionMessage] = useState('');

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
    }
  }, [accessToken, search, roleFilter, page]);

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

      {/* User Management Section */}
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

    </div>
  );
}