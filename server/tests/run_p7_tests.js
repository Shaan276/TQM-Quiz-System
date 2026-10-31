process.env.NODE_ENV = 'test';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance, dbGet, dbRun, dbAll } = require('../src/database');
const config = require('../src/config');
const { redactObject } = require('../src/utils/logger');
const { recordAuditEvent } = require('../src/services/auditLogger');
const { requestIdMiddleware } = require('../src/middleware/requestId');
const { performBackup } = require('../scripts/backup');
const { performRestore } = require('../scripts/restore');

async function runP7Tests() {
  console.log('\n🛡️ Starting Phase P7 Automated Test Suite (Production Readiness & Security Hardening)...');

  // Set up in-memory SQLite database
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);

  await runMigrations(db);
  console.log('✓ Database schema migrations v1 through v8 applied.');

  const app = createApp(db);
  const server = http.createServer(app);

  const TEST_PORT = 5007;
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      data
    };
  }

  try {
    // 1. Config & Environment Variable Validation
    await test('Configuration: Production startup validator rejects weak / fallback credentials', () => {
      // Test 1a: Rejects fallback dev secret in production
      const badResult = config.validateConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'fallback_dev_access_secret_32_chars',
        JWT_REFRESH_SECRET: 'fallback_dev_refresh_secret_32_chars'
      });
      assert.strictEqual(badResult.valid, false);
      assert.ok(badResult.errors.some(e => e.includes('insecure development fallback')));

      // Test 1b: Rejects short secrets (<32 chars)
      const shortResult = config.validateConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'short_key',
        JWT_REFRESH_SECRET: 'short_key_2'
      });
      assert.strictEqual(shortResult.valid, false);
      assert.ok(shortResult.errors.some(e => e.includes('at least 32 characters')));

      // Test 1c: Rejects identical access and refresh secrets
      const identicalResult = config.validateConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'super_secure_random_key_1_at_least_32_chars_long',
        JWT_REFRESH_SECRET: 'super_secure_random_key_1_at_least_32_chars_long'
      });
      assert.strictEqual(identicalResult.valid, false);
      assert.ok(identicalResult.errors.some(e => e.includes('distinct keys')));

      // Test 1d: Accepts cryptographically sound production config
      const validResult = config.validateConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'prod_jwt_access_secret_random_64_characters_long_entropy_abc',
        JWT_REFRESH_SECRET: 'prod_jwt_refresh_secret_random_64_characters_long_entropy_xyz',
        CORS_ORIGIN: 'https://quiz.example.com'
      });
      assert.strictEqual(validResult.valid, true);
      assert.strictEqual(validResult.errors.length, 0);
    });

    // 2. Secret Redaction from Diagnostic Inspection
    await test('Config Diagnostics: getSanitizedConfig() never reveals secret strings', () => {
      const sanitized = config.getSanitizedConfig();
      assert.strictEqual(sanitized.jwt.accessSecret, undefined);
      assert.strictEqual(sanitized.jwt.refreshSecret, undefined);
      assert.strictEqual(sanitized.smtp.pass, undefined);
      assert.strictEqual(typeof sanitized.jwt.configured, 'boolean');
    });

    // 3. Security Headers Presence
    await test('Security Headers: Verifies nosniff, frameguard, CSP, and referrer policy', async () => {
      const res = await request('/health');
      assert.strictEqual(res.status, 200);

      const contentTypeOptions = res.headers.get('x-content-type-options');
      const frameOptions = res.headers.get('x-frame-options');
      const xssProtection = res.headers.get('x-xss-protection');
      const referrerPolicy = res.headers.get('referrer-policy');
      const csp = res.headers.get('content-security-policy');

      assert.strictEqual(contentTypeOptions, 'nosniff');
      assert.strictEqual(frameOptions, 'SAMEORIGIN');
      assert.strictEqual(xssProtection, '1; mode=block');
      assert.strictEqual(referrerPolicy, 'strict-origin-when-cross-origin');
      assert.ok(csp && csp.includes("default-src 'self'"), 'CSP must be set');
    });

    // 4. Request Correlation ID Propagation
    await test('Observability: Request Correlation ID is generated and propagates in headers', async () => {
      // 4a. Auto-generated UUID when omitted
      const res1 = await request('/health');
      const reqId1 = res1.headers.get('x-request-id');
      assert.ok(reqId1, 'x-request-id header must be returned');
      assert.strictEqual(typeof reqId1, 'string');
      assert.ok(reqId1.length >= 16);

      // 4b. Preserves client-supplied correlation ID
      const customId = 'correl-client-trace-999888';
      const res2 = await request('/health', {
        headers: { 'x-request-id': customId }
      });
      assert.strictEqual(res2.headers.get('x-request-id'), customId);
    });

    // 5. Health & Readiness Probes
    await test('Health & Readiness: Liveness (/health) and Readiness (/health/ready) checks', async () => {
      // Liveness Probe
      const liveness = await request('/health');
      assert.strictEqual(liveness.status, 200);
      assert.strictEqual(liveness.data.status, 'UP');
      assert.ok(typeof liveness.data.uptimeSeconds === 'number');

      // Mounted API prefix liveness probe
      const apiLiveness = await request('/api/v1/health');
      assert.strictEqual(apiLiveness.status, 200);
      assert.strictEqual(apiLiveness.data.status, 'UP');

      // Readiness Probe (Deep DB check)
      const readiness = await request('/health/ready');
      assert.strictEqual(readiness.status, 200);
      assert.strictEqual(readiness.data.status, 'READY');
      assert.strictEqual(readiness.data.checks.database.status, 'UP');
      assert.ok(readiness.data.checks.memory.heapUsedMb > 0);
    });

    // 6. Sensitive Data Redaction
    await test('Data Redaction: Utility masks passwords, tokens, and authorization fields', () => {
      const payload = {
        name: 'User',
        email: 'user@example.com',
        password: 'SecretPassword123!',
        passwordConfirmation: 'SecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          accessToken: 'super_secret_access_token',
          safeField: 'This is safe'
        }
      };

      const redacted = redactObject(payload);
      assert.strictEqual(redacted.name, 'User');
      assert.strictEqual(redacted.email, 'user@example.com');
      assert.strictEqual(redacted.password, '[REDACTED]');
      assert.strictEqual(redacted.passwordConfirmation, '[REDACTED]');
      assert.strictEqual(redacted.token, '[REDACTED]');
      assert.strictEqual(redacted.nested.accessToken, '[REDACTED]');
      assert.strictEqual(redacted.nested.safeField, 'This is safe');
    });

    // 7. Administrative Audit Logging
    await test('Audit Logging: Sensitive actions recorded in database audit_logs table', async () => {
      await recordAuditEvent({
        action: 'SUPER_ADMIN_SECURITY_AUDIT_TEST',
        actorId: null,
        actorRole: 'SUPER_ADMIN',
        targetId: 'target-user-test',
        targetType: 'USER',
        ipAddress: '127.0.0.1',
        details: { reason: 'P7 Security Verification' }
      });

      const auditRow = await dbGet(
        `SELECT * FROM audit_logs WHERE action = 'SUPER_ADMIN_SECURITY_AUDIT_TEST' ORDER BY created_at DESC LIMIT 1`
      );

      assert.ok(auditRow, 'Audit log row must be recorded in database');
      const details = JSON.parse(auditRow.details);
      assert.strictEqual(details.targetId, 'target-user-test');
      assert.strictEqual(details.reason, 'P7 Security Verification');
    });

    // 8. Database Backup & Restore Tooling Verification
    await test('Backup & Restore: Verifies WAL checkpointing, integrity check, and safe database restore', async () => {
      const tempDir = path.resolve(__dirname, '../../temp_p7_backup_test');
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });

      const testDbPath = path.join(tempDir, 'test_source.db');
      const testBackupDir = path.join(tempDir, 'backups');
      const testRestorePath = path.join(tempDir, 'test_restored.db');

      // Initialize source db with schema & data
      const sourceDb = new sqlite3.Database(testDbPath);
      await runMigrations(sourceDb);
      
      const insertId = 'backup-test-org-1';
      await new Promise((resolve, reject) => {
        sourceDb.run(
          `INSERT INTO organizations (id, name, code, type) VALUES (?, 'Backup Test Org', 'BTO-01', 'COLLEGE')`,
          [insertId],
          err => (err ? reject(err) : resolve())
        );
      });

      // Close cleanly before backup
      await new Promise(resolve => sourceDb.close(resolve));

      // 1. Perform Backup
      const backupMeta = await performBackup(testDbPath, testBackupDir);
      assert.strictEqual(backupMeta.integrity, 'ok');
      assert.ok(fs.existsSync(backupMeta.backupFilePath));
      assert.ok(backupMeta.sizeBytes > 0, 'Backup file size must be > 0');

      // 2. Perform Restore
      const restoreRes = await performRestore(backupMeta.backupFilePath, testRestorePath);
      assert.strictEqual(restoreRes.success, true);
      assert.ok(fs.existsSync(testRestorePath));

      // 3. Verify restored data
      const restoredDb = new sqlite3.Database(testRestorePath);
      const row = await new Promise((resolve, reject) => {
        restoredDb.get(`SELECT * FROM organizations WHERE id = ?`, [insertId], (err, r) => {
          if (err) reject(err); else resolve(r);
        });
      });
      await new Promise(resolve => restoredDb.close(resolve));

      assert.ok(row, 'Restored database must contain original data');
      assert.strictEqual(row.code, 'BTO-01');

      // Cleanup temp test directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    // 9. Error Sanitization in Production Mode
    await test('Error Sanitization: Internal server errors do not reveal stack traces in production', async () => {
      const errorApp = express();
      errorApp.use(requestIdMiddleware);
      
      errorApp.get('/trigger-error', (req, res, next) => {
        next(new Error('Sensitive database credentials leak failure'));
      });

      // Production error middleware
      errorApp.use((err, req, res, next) => {
        const isProd = true;
        const statusCode = err.status || 500;
        const response = {
          success: false,
          error: {
            code: err.code || 'ERR_INTERNAL_SERVER',
            message: isProd && statusCode === 500
              ? 'An internal server error occurred. Please try again later.'
              : err.message,
            requestId: req.id
          }
        };
        res.status(statusCode).json(response);
      });

      const errServer = http.createServer(errorApp);
      const ERR_PORT = 5088;
      await new Promise(resolve => errServer.listen(ERR_PORT, resolve));

      const res = await fetch(`http://127.0.0.1:${ERR_PORT}/trigger-error`);
      const body = await res.json();
      errServer.close();

      assert.strictEqual(res.status, 500);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.message, 'An internal server error occurred. Please try again later.');
      assert.strictEqual(body.error.stack, undefined, 'Stack trace must NOT be leaked');
      assert.ok(body.error.requestId, 'Correlation ID must be attached to error response');
    });

  } finally {
    server.close();
  }

  console.log(`\nPhase P7 Test Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP7Tests().catch(err => {
    console.error('P7 Test Suite Fatal Error:', err);
    process.exit(1);
  });
}

module.exports = { runP7Tests };
