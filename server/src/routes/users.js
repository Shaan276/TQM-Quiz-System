const express = require('express');
const bcrypt = require('bcryptjs');
const { dbGet, dbRun } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------
// 1. Get Current User Profile (GET /api/v1/users/profile)
// -------------------------------------------------------------
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const user = await dbGet(
      `SELECT id, email, name, role, is_verified, created_at, updated_at FROM users WHERE id = ?`,
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
          isVerified: user.is_verified === 1,
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
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Name cannot be blank' }
      });
    }

    const cleanName = name.trim();

    await dbRun(
      `UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [cleanName, req.user.id]
    );

    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'PROFILE_UPDATED', ?)`,
      [req.user.id, `User updated profile name to '${cleanName}'`]
    );

    const updated = await dbGet(
      `SELECT id, email, name, role, is_verified, created_at, updated_at FROM users WHERE id = ?`,
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
          isVerified: updated.is_verified === 1,
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

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'New password must be at least 8 characters long' }
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
// 4. Role Verification Canary Endpoints (Testing RBAC Guards)
// -------------------------------------------------------------
router.get('/creator-only', authenticateToken, requireRole('CREATOR', 'ADMIN'), (req, res) => {
  res.json({
    success: true,
    data: { message: `Welcome to Creator Studio, ${req.user.name}! Your role is ${req.user.role}.` }
  });
});

router.get('/admin-only', authenticateToken, requireRole('ADMIN'), (req, res) => {
  res.json({
    success: true,
    data: { message: `Welcome to Superadmin Command Center, ${req.user.name}!` }
  });
});

module.exports = router;
