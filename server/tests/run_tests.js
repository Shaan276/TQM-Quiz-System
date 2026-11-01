const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const emailService = require('../src/services/emailService');
const { getDatabase } = require('../src/database');

const BASE_URL = 'http://localhost:5001';
let server;

async function testSuite() {
  console.log('🚀 Running Phase P1 Automated Test Suite...');
  
  // Set test port
  process.env.PORT = '5001';
  process.env.DATABASE_PATH = './data/test_quiz_system.db';
  
  const app = createApp();
  await runMigrations();

  server = app.listen(5001);
  console.log('✓ Test server listening on port 5001');

  let passed = 0;
  let failed = 0;

  async function assert(desc, fn) {
    try {
      await fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}:`, err.message);
      failed++;
    }
  }

  const testUser = {
    name: 'Piyush Pilkhwal',
    email: `piyush_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    passwordConfirmation: 'SecurePassword123!'
  };

  let verificationToken = null;
  let accessToken = null;
  let refreshToken = null;

  // 1. Registration
  await assert('User registration with default role LEARNER', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-require-verification': 'true' },
      body: JSON.stringify(testUser)
    });
    const data = await res.json();
    if (res.status !== 201 || !data.success) throw new Error(data.error?.message || 'Failed');
    if (data.data.user.role !== 'LEARNER' && data.data.user.role !== 'STUDENT') throw new Error(`Role is ${data.data.user.role}, expected LEARNER or STUDENT`);
    if (data.data.user.isVerified !== false) throw new Error('New user should not be verified');

    const outbox = emailService.getSimulatedOutbox();
    const sent = outbox.find(e => e.to === testUser.email.toLowerCase());
    if (!sent) throw new Error('Verification email was not dispatched');
    const match = sent.text.match(/token=([a-f0-9]+)/);
    if (!match) throw new Error('Token missing in email text');
    verificationToken = match[1];
  });

  // 2. Duplicate Registration
  await assert('Duplicate email registration is rejected with 409', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const data = await res.json();
    if (res.status !== 409) throw new Error(`Status ${res.status}, expected 409`);
    if (data.error?.code !== 'ERR_DUPLICATE_EMAIL') throw new Error('Expected ERR_DUPLICATE_EMAIL');
  });

  // 3. Password Mismatch
  await assert('Mismatched password confirmation rejected with 400', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Student',
        email: 'another@example.com',
        password: 'Password123!',
        passwordConfirmation: 'WrongPassword'
      })
    });
    if (res.status !== 400) throw new Error(`Status ${res.status}, expected 400`);
  });

  // 4. Verify Email
  await assert('Email verification with valid token marks user verified', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.error?.message || 'Failed');
  });

  // 5. Reused Verification Token
  await assert('Reused verification token is rejected with 400', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken })
    });
    const data = await res.json();
    if (res.status !== 400 || data.error?.code !== 'ERR_TOKEN_ALREADY_USED') {
      throw new Error(`Expected ERR_TOKEN_ALREADY_USED, got ${data.error?.code}`);
    }
  });

  // 6. Valid Login
  await assert('Login with valid credentials returns access & refresh tokens', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.error?.message || 'Failed');
    if (!data.data.accessToken || !data.data.refreshToken) throw new Error('Missing token pair');
    if (data.data.user.isVerified !== true) throw new Error('Expected user to be verified');

    accessToken = data.data.accessToken;
    refreshToken = data.data.refreshToken;
  });

  // 7. Invalid Login
  await assert('Login with incorrect password rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'IncorrectPassword999!'
      })
    });
    if (res.status !== 401) throw new Error(`Status ${res.status}, expected 401`);
  });

  // 8. Refresh Token Rotation
  await assert('Refresh token rotation issues a new access token', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.error?.message || 'Failed');
    if (!data.data.accessToken || !data.data.refreshToken) throw new Error('Missing new token pair');
    accessToken = data.data.accessToken;
    refreshToken = data.data.refreshToken;
  });

  // 9. Profile Access
  await assert('Authenticated user profile can be retrieved', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/profile`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.error?.message || 'Failed');
    if (data.data.profile.name !== testUser.name) throw new Error('Name mismatch');
  });

  // 10. Profile Update
  await assert('User can update their display name', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name: 'Piyush P. (Updated Name)' })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.error?.message || 'Failed');
    if (data.data.profile.name !== 'Piyush P. (Updated Name)') throw new Error('Update did not persist');
  });

  // 11. Role-Based Access Control (RBAC)
  await assert('Learner is forbidden from Creator and Admin endpoints (403)', async () => {
    const creatorRes = await fetch(`${BASE_URL}/api/v1/users/creator-only`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (creatorRes.status !== 403) throw new Error(`Creator route status ${creatorRes.status}, expected 403`);

    const adminRes = await fetch(`${BASE_URL}/api/v1/users/admin-only`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (adminRes.status !== 403) throw new Error(`Admin route status ${adminRes.status}, expected 403`);
  });

  // 12. Password Change
  await assert('User can change password and old password is invalidated', async () => {
    const changeRes = await fetch(`${BASE_URL}/api/v1/users/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        currentPassword: testUser.password,
        newPassword: 'BrandNewPassword2026!',
        newPasswordConfirmation: 'BrandNewPassword2026!'
      })
    });
    const changeData = await changeRes.json();
    if (changeRes.status !== 200 || !changeData.success) throw new Error(changeData.error?.message || 'Failed');

    // Test old password fails
    const oldLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    if (oldLogin.status !== 401) throw new Error('Old password should be rejected');

    // Test new password succeeds
    const newLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'BrandNewPassword2026!' })
    });
    if (newLogin.status !== 200) throw new Error('New password failed to log in');
  });

  // 13. Forgot & Reset Password
  await assert('Forgot password flow dispatches reset email and updates password', async () => {
    emailService.clearSimulatedOutbox();
    const forgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    if (forgotRes.status !== 200) throw new Error('Forgot password request failed');

    const outbox = emailService.getSimulatedOutbox();
    const resetEmail = outbox.find(e => e.subject.includes('Reset your password'));
    if (!resetEmail) throw new Error('Password reset email not in outbox');

    const match = resetEmail.text.match(/token=([a-f0-9]+)/);
    if (!match) throw new Error('Token not found in reset email');
    const resetToken = match[1];

    const resetRes = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'ResetPasswordSuccess999!',
        newPasswordConfirmation: 'ResetPasswordSuccess999!'
      })
    });
    const resetData = await resetRes.json();
    if (resetRes.status !== 200 || !resetData.success) throw new Error(resetData.error?.message || 'Failed');

    // Verify login with reset password
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'ResetPasswordSuccess999!' })
    });
    if (loginRes.status !== 200) throw new Error('Login with reset password failed');
  });

  // 14. Unauthorized Request
  await assert('Accessing protected route without token returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/profile`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // Clean shutdown
  server.close();
  console.log(`\n=================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED (Total ${passed + failed})`);
  console.log(`=================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

testSuite().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
