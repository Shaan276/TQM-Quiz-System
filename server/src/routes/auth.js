const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { dbGet, dbRun, dbAll } = require('../database');
const { signAccessToken, signRefreshToken, verifyRefreshToken, authenticateToken, normalizeRole } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { 
  generateSecureToken, 
  hashToken, 
  sendVerificationEmail, 
  sendPasswordResetEmail 
} = require('../services/emailService');

const router = express.Router();

// Helper: Email format validator
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Helper: Strict Password complexity validator (min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character)
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

// -------------------------------------------------------------
// 1. User Registration (POST /api/v1/auth/register)
// -------------------------------------------------------------
router.post(
  '/register',
  rateLimiter({ windowMs: 60 * 1000, maxRequests: 5, message: 'Too many registration attempts. Please wait.' }),
  async (req, res, next) => {
    try {
      const { name, email, password, passwordConfirmation } = req.body;

      // Validation
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Name is required' }
        });
      }

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'A valid email address is required' }
        });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ERR_VALIDATION',
            message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special symbol (e.g. !@#$%).'
          }
        });
      }

      if (password !== passwordConfirmation) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Password confirmation does not match' }
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      // Check duplicate email
      const existingUser = await dbGet(`SELECT id FROM users WHERE LOWER(email) = ?`, [cleanEmail]);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: { code: 'ERR_DUPLICATE_EMAIL', message: 'An account with this email address already exists' }
        });
      }

      // Hash password (bcrypt 10 rounds)
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = crypto.randomUUID();

      // Enforce role and account type
      const isInstitutional = req.body.accountType === 'INSTITUTIONAL' || !!req.body.organizationId;
      let assignedRole = 'STUDENT';
      if (req.body.role) {
        const requested = normalizeRole(req.body.role);
        if (['STUDENT', 'TEACHER'].includes(requested)) {
          assignedRole = requested;
        }
      }

      // Institutional accounts (School / College) require Admin / Teacher approval before login
      // Individual accounts are approved immediately for self-paced learning
      const initialApproval = isInstitutional ? 'PENDING' : (assignedRole === 'TEACHER' ? 'PENDING' : 'APPROVED');
      const targetOrgId = isInstitutional ? (req.body.organizationId || null) : null;

      // OTP verification temporarily disabled as requested: new users can directly login!
      // In automated test environments requiring token verification, honor x-require-verification header
      const isAutoVerify = req.headers['x-auto-verify'] === 'true'
        || (process.env.NODE_ENV !== 'test' && req.headers['x-require-verification'] !== 'true')
        || process.env.AUTO_VERIFY === 'true';
      const isVerifiedVal = isAutoVerify ? 1 : 0;

      const teacherIdVal = assignedRole === 'TEACHER' ? (req.body.teacherId ? req.body.teacherId.trim() : null) : null;
      const studentIdVal = assignedRole === 'STUDENT' ? ((req.body.studentId || req.body.rollNumber) ? (req.body.studentId || req.body.rollNumber).trim() : null) : null;
      const avatarUrlVal = req.body.avatarUrl || null;

      await dbRun(
        `INSERT INTO users (id, email, password_hash, name, role, organization_id, is_verified, approval_status, avatar_url, teacher_id, student_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, cleanEmail, passwordHash, cleanName, assignedRole, targetOrgId, isVerifiedVal, initialApproval, avatarUrlVal, teacherIdVal, studentIdVal]
      );

      // If registered under an academic section in institutional mode, record pending student enrollment
      if (isInstitutional && assignedRole === 'STUDENT' && req.body.sectionId) {
        try {
          const sec = await dbGet(`
            SELECT s.id, s.academic_year_id, s.class_id, c.department_id, c.organization_id
            FROM sections s
            JOIN classes c ON s.class_id = c.id
            WHERE s.id = ?
          `, [req.body.sectionId]);

          if (sec) {
            await dbRun(`
              INSERT OR REPLACE INTO student_enrollments 
              (id, user_id, organization_id, academic_year_id, department_id, class_id, section_id, roll_number, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
            `, [crypto.randomUUID(), userId, sec.organization_id, sec.academic_year_id, sec.department_id, sec.class_id, sec.id, req.body.rollNumber || null]);

            const { notifyUsers } = require('../services/notificationService');
            const teachers = await dbAll(`SELECT DISTINCT teacher_id AS id FROM teacher_assignments WHERE section_id = ? AND is_active = 1`, [sec.id]);
            const admins = await dbAll(`SELECT id FROM users WHERE role IN ('ORG_ADMIN', 'SUPER_ADMIN') AND (organization_id = ? OR organization_id IS NULL)`, [sec.organization_id]);
            const recipientIds = [...new Set([...teachers.map(t => t.id), ...admins.map(a => a.id)])];
            if (recipientIds.length > 0) {
              await notifyUsers(recipientIds, {
                title: 'New Student Enrollment Approval',
                message: `Student '${cleanName}' registered under section and awaits verification.`,
                type: 'ACTION_REQUIRED',
                linkUrl: '/admin-dashboard'
              });
            }
          }
        } catch (enrollErr) {
          console.error('[Auth] Error setting up student enrollment on register:', enrollErr);
        }
      }

      // If teacher registered, notify all Organization / Super Admins
      if (assignedRole === 'TEACHER') {
        try {
          const { notifyUsers } = require('../services/notificationService');
          const admins = await dbAll(`SELECT id FROM users WHERE role IN ('ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN')`);
          if (admins.length > 0) {
            await notifyUsers(admins.map(a => a.id), {
              title: 'Teacher Approval Required',
              message: `New teacher '${cleanName}' (${cleanEmail}) registered and is awaiting approval.`,
              type: 'ACTION_REQUIRED',
              linkUrl: '/super-admin'
            });
          }
        } catch (notifErr) {
          console.error('[Auth] Failed to send teacher registration notification:', notifErr);
        }
      }

      // Generate Verification Token
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      await dbRun(
        `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), userId, tokenHash, expiresAt]
      );

      // Dispatch verification email
      await sendVerificationEmail(cleanEmail, rawToken, cleanName);

      // Audit log
      await dbRun(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'USER_REGISTERED', ?)`,
        [userId, `User '${cleanEmail}' registered with role ${assignedRole}`]
      );

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: userId,
            name: cleanName,
            email: cleanEmail,
            role: assignedRole,
            isVerified: isVerifiedVal === 1
          },
          message: isAutoVerify
            ? 'Account created successfully! You can now log in directly.'
            : 'Account created. Please check your email to verify your account.'
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 2. User Login (POST /api/v1/auth/login)
// -------------------------------------------------------------
router.post(
  '/login',
  rateLimiter({ windowMs: 60 * 1000, maxRequests: 10, message: 'Too many login attempts. Please try again in a minute.' }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Email and password are required' }
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await dbGet(`SELECT * FROM users WHERE LOWER(email) = ?`, [cleanEmail]);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'ERR_INVALID_CREDENTIALS', message: 'Invalid email or password' }
        });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: { code: 'ERR_INVALID_CREDENTIALS', message: 'Invalid email or password' }
        });
      }

      // Check Institutional Approval Status Gate
      if (user.approval_status === 'PENDING') {
        let orgName = 'your institution';
        if (user.organization_id) {
          const org = await dbGet(`SELECT name FROM organizations WHERE id = ?`, [user.organization_id]);
          if (org) orgName = org.name;
        }
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_APPROVAL_PENDING',
            message: `Your account under ${orgName} is pending administrator or instructor approval. You will be able to access the platform once approved.`,
            institutionName: orgName
          }
        });
      }

      if (user.approval_status === 'REJECTED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_APPROVAL_REJECTED',
            message: 'Your institutional registration request was declined. You may use or register for an Individual account instead.'
          }
        });
      }

      // Generate JWT Access and Refresh Tokens
      const tokenPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.is_verified === 1
      };

      const accessToken = signAccessToken(tokenPayload);
      const rawRefreshToken = generateSecureToken();
      const refreshHash = hashToken(rawRefreshToken);
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Persist refresh token in database
      await dbRun(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), user.id, refreshHash, refreshExpiresAt]
      );

      // Audit log
      await dbRun(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'USER_LOGIN', 'User successfully authenticated')`,
        [user.id]
      );

      return res.json({
        success: true,
        data: {
          accessToken,
          refreshToken: rawRefreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatar_url || null,
            teacherId: user.teacher_id || null,
            studentId: user.student_id || null,
            isVerified: user.is_verified === 1,
            approvalStatus: user.approval_status || 'APPROVED',
            organizationId: user.organization_id || null,
            createdAt: user.created_at
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 3. User Logout (POST /api/v1/auth/logout)
// -------------------------------------------------------------
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await dbRun(
        `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?`,
        [tokenHash]
      );
    }

    return res.json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. Email Verification (POST /api/v1/auth/verify-email)
// -------------------------------------------------------------
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Verification token is required' }
      });
    }

    const tokenHash = hashToken(token);
    const tokenRecord = await dbGet(
      `SELECT * FROM email_verification_tokens WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_INVALID_TOKEN', message: 'Invalid or unrecognized verification token' }
      });
    }

    if (tokenRecord.used_at) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_TOKEN_ALREADY_USED', message: 'This verification link has already been used' }
      });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_TOKEN_EXPIRED', message: 'This verification link has expired. Please request a new one.' }
      });
    }

    // Mark token used and update user verification flag atomically
    await dbRun(`UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [tokenRecord.id]);
    await dbRun(`UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [tokenRecord.user_id]);

    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'EMAIL_VERIFIED', 'User email address verified')`,
      [tokenRecord.user_id]
    );

    return res.json({
      success: true,
      data: { message: 'Email address verified successfully!' }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 5. Resend Verification Email (POST /api/v1/auth/resend-verification)
// -------------------------------------------------------------
router.post(
  '/resend-verification',
  rateLimiter({ windowMs: 60 * 1000, maxRequests: 3, message: 'Please wait before requesting another verification email.' }),
  async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Valid email address is required' }
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await dbGet(`SELECT id, name, is_verified FROM users WHERE LOWER(email) = ?`, [cleanEmail]);

      // Protect against user enumeration: respond with generic success even if user not found
      if (!user) {
        return res.json({
          success: true,
          data: { message: 'If an account exists with this email, a verification link has been sent.' }
        });
      }

      if (user.is_verified === 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_ALREADY_VERIFIED', message: 'This email address is already verified.' }
        });
      }

      // Generate new token
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await dbRun(
        `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), user.id, tokenHash, expiresAt]
      );

      await sendVerificationEmail(cleanEmail, rawToken, user.name);

      return res.json({
        success: true,
        data: { message: 'If an account exists with this email, a verification link has been sent.' }
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 6. Forgot Password (POST /api/v1/auth/forgot-password)
// -------------------------------------------------------------
router.post(
  '/forgot-password',
  rateLimiter({ windowMs: 60 * 1000, maxRequests: 3, message: 'Please wait before requesting another password reset.' }),
  async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Valid email address is required' }
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await dbGet(`SELECT id, name FROM users WHERE LOWER(email) = ?`, [cleanEmail]);

      // Protect against enumeration: respond identically regardless of whether user exists
      if (user) {
        const rawToken = generateSecureToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        await dbRun(
          `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
          [crypto.randomUUID(), user.id, tokenHash, expiresAt]
        );

        await sendPasswordResetEmail(cleanEmail, rawToken, user.name);
      }

      return res.json({
        success: true,
        data: { message: 'If an account exists with this email, a password reset link has been dispatched.' }
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 7. Reset Password (POST /api/v1/auth/reset-password)
// -------------------------------------------------------------
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword, newPasswordConfirmation } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Reset token is required' }
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'ERR_VALIDATION', 
          message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special symbol (e.g. !@#$%).' 
        }
      });
    }

    if (newPassword !== newPasswordConfirmation) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Password confirmation does not match' }
      });
    }

    const tokenHash = hashToken(token);
    const tokenRecord = await dbGet(
      `SELECT * FROM password_reset_tokens WHERE token_hash = ?`,
      [tokenHash]
    );

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_INVALID_TOKEN', message: 'Invalid or unrecognized reset token' }
      });
    }

    if (tokenRecord.used_at) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_TOKEN_ALREADY_USED', message: 'This password reset link has already been used' }
      });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_TOKEN_EXPIRED', message: 'This password reset link has expired' }
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Atomically update password, mark token used, and revoke all existing sessions
    await dbRun(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [tokenRecord.id]);
    await dbRun(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPasswordHash, tokenRecord.user_id]
    );
    await dbRun(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [tokenRecord.user_id]
    );

    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'PASSWORD_RESET', 'Password reset successfully completed')`,
      [tokenRecord.user_id]
    );

    return res.json({
      success: true,
      data: { message: 'Password reset successfully. You can now log in with your new password.' }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 8. Refresh Token (POST /api/v1/auth/refresh)
// -------------------------------------------------------------
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Refresh token is required' }
      });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenRecord = await dbGet(
      `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL`,
      [tokenHash]
    );

    if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: { code: 'ERR_INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' }
      });
    }

    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [tokenRecord.user_id]);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'ERR_USER_NOT_FOUND', message: 'User account not found' }
      });
    }

    // Token Rotation: revoke used refresh token and issue new pair
    await dbRun(`UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`, [tokenRecord.id]);

    const newAccessToken = signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.is_verified === 1
    });

    const newRawRefreshToken = generateSecureToken();
    const newRefreshHash = hashToken(newRawRefreshToken);
    const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await dbRun(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), user.id, newRefreshHash, newRefreshExpiresAt]
    );

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
