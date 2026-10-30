const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const request = require('supertest');
const sqlite3 = require('sqlite3');
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const emailService = require('../src/services/emailService');

describe('Phase P1 — Authentication & User Management Test Suite', () => {
  let app;
  let inMemoryDb;

  beforeAll(async () => {
    inMemoryDb = new sqlite3.Database(':memory:');
    inMemoryDb.run('PRAGMA foreign_keys = ON;');
    await runMigrations(inMemoryDb);
    app = createApp(inMemoryDb);
  });

  afterAll(async () => {
    await new Promise((resolve) => inMemoryDb.close(resolve));
  });

  const testUser = {
    name: 'Piyush Pilkhwal',
    email: 'piyush@example.com',
    password: 'SecurePassword123!',
    passwordConfirmation: 'SecurePassword123!'
  };

  let registeredUserId = null;
  let verificationToken = null;
  let accessToken = null;
  let refreshToken = null;

  // -------------------------------------------------------------
  // 1. Registration Tests
  // -------------------------------------------------------------
  it('should register a new user with default role LEARNER', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.role).toBe('LEARNER');
    expect(res.body.data.user.isVerified).toBe(false);

    registeredUserId = res.body.data.user.id;

    const outbox = emailService.getSimulatedOutbox();
    expect(outbox.length).toBeGreaterThan(0);
    const sentEmail = outbox.find((e) => e.to === testUser.email.toLowerCase());
    expect(sentEmail).toBeDefined();

    const tokenMatch = sentEmail.text.match(/token=([a-f0-9]+)/);
    expect(tokenMatch).not.toBeNull();
    verificationToken = tokenMatch[1];
  });

  it('should reject registration when email is a duplicate', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERR_DUPLICATE_EMAIL');
  });

  it('should reject registration when password confirmation does not match', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Student',
        email: 'test@student.com',
        password: 'Password123!',
        passwordConfirmation: 'MismatchedPassword'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('confirmation does not match');
  });

  it('should reject registration with passwords shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Student',
        email: 'short@student.com',
        password: '123',
        passwordConfirmation: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('at least 8 characters');
  });

  // -------------------------------------------------------------
  // 2. Email Verification Tests
  // -------------------------------------------------------------
  it('should verify email address successfully with valid token', async () => {
    expect(verificationToken).toBeTruthy();
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: verificationToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('verified successfully');
  });

  it('should reject an already used email verification token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: verificationToken });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERR_TOKEN_ALREADY_USED');
  });

  it('should reject an invalid or fabricated verification token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'fake_token_12345' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERR_INVALID_TOKEN');
  });

  // -------------------------------------------------------------
  // 3. Login & Authentication Tests
  // -------------------------------------------------------------
  it('should login with valid credentials and return JWT tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.isVerified).toBe(true);

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('should reject login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERR_INVALID_CREDENTIALS');
  });

  it('should reject login with non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'ghost@nonexistent.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERR_INVALID_CREDENTIALS');
  });

  // -------------------------------------------------------------
  // 4. Token Refresh Tests
  // -------------------------------------------------------------
  it('should issue a new access token when provided a valid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  // -------------------------------------------------------------
  // 5. User Profile & Password Change Tests
  // -------------------------------------------------------------
  it('should retrieve current user profile using access token', async () => {
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.name).toBe(testUser.name);
    expect(res.body.data.profile.email).toBe(testUser.email.toLowerCase());
  });

  it('should update user profile name', async () => {
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Piyush P. (Updated)' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.name).toBe('Piyush P. (Updated)');
  });

  it('should allow user to change their password and re-login with new password', async () => {
    const res = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: testUser.password,
        newPassword: 'BrandNewPassword2026!',
        newPasswordConfirmation: 'BrandNewPassword2026!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'BrandNewPassword2026!' });
    expect(newLogin.status).toBe(200);
    accessToken = newLogin.body.data.accessToken;
  });

  // -------------------------------------------------------------
  // 6. Role-Based Access Control (RBAC) Guard Tests
  // -------------------------------------------------------------
  it('should reject a LEARNER accessing CREATOR and ADMIN routes with 403 Forbidden', async () => {
    const creatorRes = await request(app)
      .get('/api/v1/users/creator-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(creatorRes.status).toBe(403);
    expect(creatorRes.body.error.code).toBe('ERR_FORBIDDEN');

    const adminRes = await request(app)
      .get('/api/v1/users/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error.code).toBe('ERR_FORBIDDEN');
  });

  // -------------------------------------------------------------
  // 7. Password Reset Request & Execution Tests
  // -------------------------------------------------------------
  it('should process forgot password and send reset email without user enumeration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: testUser.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const outbox = emailService.getSimulatedOutbox();
    const resetEmail = outbox.find((e) => e.subject.includes('Reset your password'));
    expect(resetEmail).toBeDefined();

    const tokenMatch = resetEmail.text.match(/token=([a-f0-9]+)/);
    const resetToken = tokenMatch[1];

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'FinalPasswordReset999!',
        newPasswordConfirmation: 'FinalPasswordReset999!'
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'FinalPasswordReset999!' });

    expect(loginRes.status).toBe(200);
  });
});
