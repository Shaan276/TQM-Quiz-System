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
  },
  {
    version: 2,
    name: '002_quiz_studio_and_question_bank',
    up: async (db) => {
      // 1. Quizzes Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS quizzes (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'General',
          difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
          tags TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
          visibility TEXT NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
          cover_image_url TEXT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          published_version INTEGER NOT NULL DEFAULT 0,
          time_limit_sec INTEGER NOT NULL DEFAULT 0,
          passing_percentage INTEGER NOT NULL DEFAULT 60 CHECK (passing_percentage >= 0 AND passing_percentage <= 100),
          shuffle_questions INTEGER NOT NULL DEFAULT 0,
          shuffle_options INTEGER NOT NULL DEFAULT 0,
          negative_marking INTEGER NOT NULL DEFAULT 0,
          negative_marks_ratio REAL NOT NULL DEFAULT 0.25,
          show_explanations TEXT NOT NULL DEFAULT 'ALWAYS' CHECK (show_explanations IN ('ALWAYS', 'AFTER_SUBMIT', 'NEVER')),
          max_attempts INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 2. Quiz Versions (Snapshots on Publish for historical attempt preservation)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS quiz_versions (
          id TEXT PRIMARY KEY,
          quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          snapshot_data TEXT NOT NULL,
          published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          published_by TEXT NOT NULL REFERENCES users(id),
          UNIQUE(quiz_id, version)
        );
      `, [], db);

      // 3. Questions Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          question_text TEXT NOT NULL,
          question_type TEXT NOT NULL CHECK (question_type IN ('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL')),
          marks REAL NOT NULL DEFAULT 1.0 CHECK (marks > 0),
          time_limit_sec INTEGER NOT NULL DEFAULT 30,
          explanation TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          media_url TEXT NULL,
          settings TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 4. Question Options Table (MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS question_options (
          id TEXT PRIMARY KEY,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          option_key TEXT NOT NULL,
          option_text TEXT NOT NULL,
          is_correct INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
      `, [], db);

      // 5. Question Text/Numeric Answers Table (FILL_BLANK, SHORT_ANSWER, NUMERICAL)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS question_answers (
          id TEXT PRIMARY KEY,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          expected_answer TEXT NOT NULL,
          is_case_sensitive INTEGER NOT NULL DEFAULT 0,
          numeric_tolerance REAL NOT NULL DEFAULT 0.0
        );
      `, [], db);

      // 6. Question Bank Table (Reusable questions library)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS question_bank (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          question_text TEXT NOT NULL,
          question_type TEXT NOT NULL CHECK (question_type IN ('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL')),
          category TEXT NOT NULL DEFAULT 'General',
          difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
          tags TEXT NOT NULL DEFAULT '[]',
          marks REAL NOT NULL DEFAULT 1.0,
          explanation TEXT NOT NULL DEFAULT '',
          options_data TEXT NOT NULL DEFAULT '[]',
          settings TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // Indexes for fast lookups
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON quizzes(creator_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_questions_quiz_sort ON questions(quiz_id, sort_order ASC);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_options_question ON question_options(question_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_answers_question ON question_answers(question_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_question_bank_creator ON question_bank(creator_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_question_bank_type ON question_bank(question_type);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_quiz_versions_quiz ON quiz_versions(quiz_id, version);`, [], db);
    }
  },
  {
    version: 3,
    name: '003_quiz_attempts_scoring_and_mistakes',
    up: async (db) => {
      // 1. Safe Schema Migration for Users: Expand roles and normalize existing accounts
      await dbRun(`PRAGMA foreign_keys = OFF;`, [], db);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS users_v3 (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'TEACHER', 'ORG_ADMIN', 'SUPER_ADMIN', 'LEARNER', 'CREATOR', 'ADMIN')),
          organization_id TEXT NULL,
          is_verified INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // Copy users with normalized roles: LEARNER -> STUDENT, CREATOR -> TEACHER, ADMIN -> SUPER_ADMIN
      await dbRun(`
        INSERT INTO users_v3 (id, email, password_hash, name, role, is_verified, created_at, updated_at)
        SELECT id, email, password_hash, name,
          CASE 
            WHEN role = 'LEARNER' THEN 'STUDENT'
            WHEN role = 'CREATOR' THEN 'TEACHER'
            WHEN role = 'ADMIN' THEN 'SUPER_ADMIN'
            ELSE role
          END,
          is_verified, created_at, updated_at
        FROM users;
      `, [], db);

      await dbRun(`DROP TABLE users;`, [], db);
      await dbRun(`ALTER TABLE users_v3 RENAME TO users;`, [], db);
      await dbRun(`PRAGMA foreign_keys = ON;`, [], db);

      // Recreate user indexes
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);`, [], db);

      // 2. Table: quiz_attempts
      await dbRun(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          id TEXT PRIMARY KEY,
          quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          quiz_version INTEGER NOT NULL DEFAULT 1,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ABANDONED')),
          score REAL NOT NULL DEFAULT 0.0,
          max_score REAL NOT NULL DEFAULT 0.0,
          score_percentage REAL NOT NULL DEFAULT 0.0,
          is_passed INTEGER NOT NULL DEFAULT 0,
          total_questions INTEGER NOT NULL DEFAULT 0,
          correct_answers INTEGER NOT NULL DEFAULT 0,
          incorrect_answers INTEGER NOT NULL DEFAULT 0,
          unanswered_count INTEGER NOT NULL DEFAULT 0,
          time_limit_sec INTEGER NOT NULL DEFAULT 0,
          started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NULL,
          submitted_at DATETIME NULL,
          time_taken_sec INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT NULL UNIQUE
        );
      `, [], db);

      // 3. Table: attempt_answers
      await dbRun(`
        CREATE TABLE IF NOT EXISTS attempt_answers (
          id TEXT PRIMARY KEY,
          attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL,
          question_type TEXT NOT NULL,
          user_answer TEXT NOT NULL DEFAULT '',
          is_correct INTEGER NOT NULL DEFAULT 0,
          earned_score REAL NOT NULL DEFAULT 0.0,
          max_marks REAL NOT NULL DEFAULT 1.0,
          is_evaluated INTEGER NOT NULL DEFAULT 1,
          evaluation_notes TEXT DEFAULT '',
          saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(attempt_id, question_id)
        );
      `, [], db);

      // 4. Table: mistake_notebook
      await dbRun(`
        CREATE TABLE IF NOT EXISTS mistake_notebook (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
          quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL,
          quiz_title TEXT NOT NULL,
          question_text TEXT NOT NULL,
          question_type TEXT NOT NULL,
          subject TEXT NOT NULL DEFAULT 'General',
          user_answer TEXT NOT NULL DEFAULT '',
          correct_answer TEXT NOT NULL DEFAULT '',
          explanation TEXT NOT NULL DEFAULT '',
          is_resolved INTEGER NOT NULL DEFAULT 0,
          mistake_count INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reviewed_at DATETIME NULL,
          UNIQUE(user_id, question_id)
        );
      `, [], db);

      // Indexes for high performance
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id, status);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id, submitted_at DESC);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistake_notebook(user_id, is_resolved);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_mistakes_subject ON mistake_notebook(user_id, subject);`, [], db);
    }
  },
  {
    version: 4,
    name: '004_question_code_and_structured_ids',
    up: async (db) => {
      // 1. Add question_code to questions table if not exists
      const qCols = await dbAll(`PRAGMA table_info(questions);`, [], db);
      const hasQCode = qCols.some(c => c.name === 'question_code');
      if (!hasQCode) {
        await dbRun(`ALTER TABLE questions ADD COLUMN question_code TEXT NULL;`, [], db);
      }

      // 2. Add question_code to question_bank table if not exists
      const qbCols = await dbAll(`PRAGMA table_info(question_bank);`, [], db);
      const hasQbCode = qbCols.some(c => c.name === 'question_code');
      if (!hasQbCode) {
        await dbRun(`ALTER TABLE question_bank ADD COLUMN question_code TEXT NULL;`, [], db);
      }

      // 3. Index for question_code fast search
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_questions_code ON questions(question_code);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_question_bank_code ON question_bank(question_code);`, [], db);
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
      console.log(`[Migrations] Migration v${migration.version} applied successfully.`);
    }
  }
}

module.exports = {
  runMigrations,
  MIGRATIONS
};
