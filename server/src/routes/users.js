const express = require('express');
const bcrypt = require('bcryptjs');
const { dbGet, dbRun, dbAll } = require('../database');
const { authenticateToken, requireRole, signAccessToken, signRefreshToken, normalizeRole } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------
// 1. Get Current User Profile (GET /api/v1/users/profile)
// -------------------------------------------------------------
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const user = await dbGet(
      `SELECT id, email, name, role, is_verified, approval_status, organization_id, avatar_url, teacher_id, student_id, created_at, updated_at FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_USER_NOT_FOUND', message: 'User profile not found' }
      });
    }

    return res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatar_url || null,
          teacherId: user.teacher_id || null,
          studentId: user.student_id || null,
          isVerified: user.is_verified === 1,
          approvalStatus: user.approval_status || 'APPROVED',
          organizationId: user.organization_id || null,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. Update Current User Profile (PUT /api/v1/users/profile)
// -------------------------------------------------------------
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { name, avatarUrl, teacherId, studentId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Name cannot be blank' }
      });
    }

    const cleanName = name.trim();
    const cleanAvatar = avatarUrl !== undefined ? avatarUrl : null;
    const cleanTeacherId = teacherId !== undefined ? (teacherId ? teacherId.trim() : null) : null;
    const cleanStudentId = studentId !== undefined ? (studentId ? studentId.trim() : null) : null;

    // Fetch existing profile to retain values if not provided
    const existing = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    const finalAvatar = cleanAvatar !== null ? cleanAvatar : existing.avatar_url;
    const finalTeacherId = cleanTeacherId !== null ? cleanTeacherId : existing.teacher_id;
    const finalStudentId = cleanStudentId !== null ? cleanStudentId : existing.student_id;

    await dbRun(
      `UPDATE users SET name = ?, avatar_url = ?, teacher_id = ?, student_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [cleanName, finalAvatar, finalTeacherId, finalStudentId, req.user.id]
    );

    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'PROFILE_UPDATED', ?)`,
      [req.user.id, `User updated profile information`]
    );

    const updated = await dbGet(
      `SELECT id, email, name, role, is_verified, approval_status, organization_id, avatar_url, teacher_id, student_id, created_at, updated_at FROM users WHERE id = ?`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: {
        profile: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          avatarUrl: updated.avatar_url || null,
          teacherId: updated.teacher_id || null,
          studentId: updated.student_id || null,
          isVerified: updated.is_verified === 1,
          approvalStatus: updated.approval_status || 'APPROVED',
          organizationId: updated.organization_id || null,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        },
        message: 'Profile updated successfully'
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. Change Password (PUT /api/v1/users/change-password)
// -------------------------------------------------------------
router.put('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirmation } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Current and new password are required' }
      });
    }

    const isStrong = newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword);

    if (!isStrong) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'ERR_VALIDATION', 
          message: 'New password must be at least 8 characters long and contain uppercase, lowercase, number, and a special symbol.' 
        }
      });
    }

    if (newPassword !== newPasswordConfirmation) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'New password confirmation does not match' }
      });
    }

    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_USER_NOT_FOUND', message: 'User not found' }
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_INVALID_PASSWORD', message: 'Current password entered is incorrect' }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await dbRun(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newHash, req.user.id]
    );

    // Invalidate other active refresh sessions upon password change
    await dbRun(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [req.user.id]
    );

    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'PASSWORD_CHANGED', 'User changed their account password')`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: { message: 'Password changed successfully. Please log in with your new credentials on other devices.' }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. Role Verification & Upgrade Endpoints
// -------------------------------------------------------------
router.post('/upgrade-to-teacher', authenticateToken, async (req, res, next) => {
  try {
    await dbRun(`UPDATE users SET role = 'TEACHER', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.user.id]);
    const updated = await dbGet(`SELECT id, email, name, role, is_verified, created_at, updated_at FROM users WHERE id = ?`, [req.user.id]);
    
    const newAccessToken = signAccessToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      name: updated.name
    });
    const newRefreshToken = signRefreshToken({
      id: updated.id,
      email: updated.email
    });

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        profile: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          isVerified: updated.is_verified === 1,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        },
        message: 'Role upgraded to TEACHER successfully! You now have full access to Quiz Studio and Question Bank.'
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/upgrade-to-creator', authenticateToken, async (req, res, next) => {
  try {
    await dbRun(`UPDATE users SET role = 'TEACHER', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.user.id]);
    const updated = await dbGet(`SELECT id, email, name, role, is_verified, created_at, updated_at FROM users WHERE id = ?`, [req.user.id]);
    
    const newAccessToken = signAccessToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      name: updated.name
    });
    const newRefreshToken = signRefreshToken({
      id: updated.id,
      email: updated.email
    });

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        profile: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          isVerified: updated.is_verified === 1,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        },
        message: 'Role upgraded to TEACHER successfully! You now have full access to Quiz Studio and Question Bank.'
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/creator-only', authenticateToken, requireRole('CREATOR', 'TEACHER', 'SUPER_ADMIN'), (req, res) => {
  res.json({
    success: true,
    data: { message: `Welcome to Creator Studio, ${req.user.name}! Your role is ${req.user.role}.` }
  });
});

router.get('/admin-only', authenticateToken, requireRole('ADMIN', 'SUPER_ADMIN'), (req, res) => {
  res.json({
    success: true,
    data: { message: `Welcome to Superadmin Command Center, ${req.user.name}!` }
  });
});

// -------------------------------------------------------------
// 5. Super Admin / Org Admin User Management Endpoints
// -------------------------------------------------------------
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'ORG_ADMIN'), async (req, res, next) => {
  try {
    const { search = '', role = '', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const params = [];
    let whereClauses = [];

    if (search.trim()) {
      whereClauses.push(`(name LIKE ? OR email LIKE ?)`);
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (role.trim()) {
      whereClauses.push(`role = ?`);
      params.push(normalizeRole(role.trim()));
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = await dbGet(`SELECT COUNT(*) as total FROM users ${whereSQL}`, params);
    const total = countRow?.total || 0;

    const users = await dbAll(
      `SELECT id, email, name, role, is_verified, created_at, updated_at 
       FROM users 
       ${whereSQL} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/role', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Target role is required' }
      });
    }

    const validRoles = ['STUDENT', 'TEACHER', 'ORG_ADMIN', 'SUPER_ADMIN'];
    const normalized = normalizeRole(role);
    if (!validRoles.includes(normalized)) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_INVALID_ROLE', message: `Invalid role. Allowed: ${validRoles.join(', ')}` }
      });
    }

    const targetUser = await dbGet(`SELECT id, email, role FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'User not found' }
      });
    }

    await dbRun(`UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [normalized, id]);
    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'ROLE_UPDATED', ?)`,
      [req.user.id, `Changed role of user ${targetUser.email} from ${targetUser.role} to ${normalized}`]
    );

    res.json({
      success: true,
      data: {
        message: `Role of user ${targetUser.email} updated to ${normalized}`,
        role: normalized
      }
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Cannot delete your own administrative account' }
      });
    }

    const targetUser = await dbGet(`SELECT id, email FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'User not found' }
      });
    }

    await dbRun(`DELETE FROM users WHERE id = ?`, [id]);
    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'USER_DELETED', ?)`,
      [req.user.id, `Super admin deleted user ${targetUser.email}`]
    );

    res.json({
      success: true,
      data: { message: `User ${targetUser.email} successfully deleted.` }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
