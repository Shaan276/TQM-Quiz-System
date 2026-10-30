const { dbRun, dbGet, dbAll, getDatabase } = require('./index');

const MIGRATIONS = [
  {
    version: 1,
    name: '001_initial_auth_and_users',
    up: async (db) => {
      // 1. Users Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'LEARNER' CHECK (role IN ('CREATOR', 'LEARNER', 'ADMIN')),
          is_verified INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 2. Email Verification Tokens Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 3. Password Reset Tokens Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 4. Refresh Tokens Table (Session Invalidation)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          revoked_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 5. Audit Log Table (TQM & Security Traceability)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          details TEXT NOT NULL,
          ip_address TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // Indexes for high performance
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_verification_tokens(user_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`, [], db);
    }
  }
];

async function runMigrations(customDb = null) {
  const db = customDb || getDatabase();

  // Create schema_migrations tracker
  await dbRun(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `, [], db);

  for (const migration of MIGRATIONS) {
    const existing = await dbGet(`SELECT version FROM schema_migrations WHERE version = ?`, [migration.version], db);
    if (!existing) {
      console.log(`[Migrations] Applying migration v${migration.version}: ${migration.name}...`);
      await migration.up(db);
      await dbRun(
        `INSERT INTO schema_migrations (version, name) VALUES (?, ?)`,
        [migration.version, migration.name],
        db
      );
      console.log(`[Migrations] Applied migration v${migration.version} successfully.`);
    }
  }
}

module.exports = {
  runMigrations,
  MIGRATIONS
};
