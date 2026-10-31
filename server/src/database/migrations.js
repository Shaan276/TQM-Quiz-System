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
  },
  {
    version: 5,
    name: '005_live_multiplayer_sessions',
    up: async (db) => {
      // 1. Live Quiz Sessions Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS quiz_sessions (
          id TEXT PRIMARY KEY,
          quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          quiz_version INTEGER NOT NULL DEFAULT 1,
          host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          join_code TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY', 'STARTING', 'QUESTION_ACTIVE', 'QUESTION_ENDED', 'LEADERBOARD', 'PAUSED', 'COMPLETED', 'CANCELLED')),
          current_question_index INTEGER NOT NULL DEFAULT 0,
          total_questions INTEGER NOT NULL DEFAULT 0,
          question_start_time DATETIME NULL,
          question_end_time DATETIME NULL,
          settings TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ended_at DATETIME NULL
        );
      `, [], db);

      // 2. Session Participants Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS session_participants (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL,
          score REAL NOT NULL DEFAULT 0.0,
          correct_count INTEGER NOT NULL DEFAULT 0,
          rank INTEGER NOT NULL DEFAULT 0,
          is_connected INTEGER NOT NULL DEFAULT 1,
          joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, user_id)
        );
      `, [], db);

      // 3. Session Answers Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS session_answers (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
          participant_id TEXT NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
          question_id TEXT NOT NULL,
          question_index INTEGER NOT NULL DEFAULT 0,
          user_answer TEXT NOT NULL,
          is_correct INTEGER NOT NULL DEFAULT 0,
          earned_score REAL NOT NULL DEFAULT 0.0,
          time_taken_ms INTEGER NOT NULL DEFAULT 0,
          submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, participant_id, question_id)
        );
      `, [], db);

      // Indexes for rapid live querying and high concurrency
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_sessions_host ON quiz_sessions(host_id, status);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_sessions_code ON quiz_sessions(join_code);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON quiz_sessions(status);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants(session_id, score DESC);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_participants_user ON session_participants(user_id);`, [], db);
      await dbRun(`CREATE INDEX IF NOT EXISTS idx_session_answers_lookup ON session_answers(session_id, question_id);`, [], db);
    }
  },
  {
    version: 6,
    name: '006_fullscreen_anti_cheat_monitoring',
    up: async (db) => {
      // 1. Add columns to quiz_attempts
      const attCols = await dbAll(`PRAGMA table_info(quiz_attempts);`, [], db);
      if (!attCols.some(c => c.name === 'warning_count')) {
        await dbRun(`ALTER TABLE quiz_attempts ADD COLUMN warning_count INTEGER NOT NULL DEFAULT 0;`, [], db);
      }
      if (!attCols.some(c => c.name === 'is_flagged')) {
        await dbRun(`ALTER TABLE quiz_attempts ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0;`, [], db);
      }
      if (!attCols.some(c => c.name === 'flag_reason')) {
        await dbRun(`ALTER TABLE quiz_attempts ADD COLUMN flag_reason TEXT NULL;`, [], db);
      }
      if (!attCols.some(c => c.name === 'violations_log')) {
        await dbRun(`ALTER TABLE quiz_attempts ADD COLUMN violations_log TEXT NOT NULL DEFAULT '[]';`, [], db);
      }

      // 2. Add columns to session_participants
      const partCols = await dbAll(`PRAGMA table_info(session_participants);`, [], db);
      if (!partCols.some(c => c.name === 'warning_count')) {
        await dbRun(`ALTER TABLE session_participants ADD COLUMN warning_count INTEGER NOT NULL DEFAULT 0;`, [], db);
      }
      if (!partCols.some(c => c.name === 'is_flagged')) {
        await dbRun(`ALTER TABLE session_participants ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0;`, [], db);
      }
      if (!partCols.some(c => c.name === 'flag_reason')) {
        await dbRun(`ALTER TABLE session_participants ADD COLUMN flag_reason TEXT NULL;`, [], db);
      }
      if (!partCols.some(c => c.name === 'violations_log')) {
        await dbRun(`ALTER TABLE session_participants ADD COLUMN violations_log TEXT NOT NULL DEFAULT '[]';`, [], db);
      }
    }
  },
  {
    version: 7,
    name: '007_institutional_structure_and_scoped_assignments',
    up: async (db) => {
      // 1. Organizations
      await dbRun(`
        CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL DEFAULT 'COLLEGE' CHECK (type IN ('SCHOOL', 'COLLEGE', 'UNIVERSITY', 'TRAINING_INSTITUTE', 'ENTERPRISE')),
          dept_term TEXT NOT NULL DEFAULT 'Department',
          class_term TEXT NOT NULL DEFAULT 'Class',
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 2. Academic Years / Sessions
      await dbRun(`
        CREATE TABLE IF NOT EXISTS academic_years (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          start_date DATE NULL,
          end_date DATE NULL,
          is_current INTEGER NOT NULL DEFAULT 1,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(organization_id, name)
        );
      `, [], db);

      // 3. Departments / Programs
      await dbRun(`
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          code TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(organization_id, code)
        );
      `, [], db);

      // 4. Classes / Grades
      await dbRun(`
        CREATE TABLE IF NOT EXISTS classes (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          code TEXT NOT NULL,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(organization_id, department_id, code)
        );
      `, [], db);

      // 5. Sections
      await dbRun(`
        CREATE TABLE IF NOT EXISTS sections (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          capacity INTEGER NOT NULL DEFAULT 60,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(class_id, academic_year_id, name)
        );
      `, [], db);

      // 6. Subjects
      await dbRun(`
        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          department_id TEXT NULL REFERENCES departments(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          code TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(organization_id, code)
        );
      `, [], db);

      // 7. Student Enrollments
      await dbRun(`
        CREATE TABLE IF NOT EXISTS student_enrollments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
          department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
          roll_number TEXT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'ARCHIVED')),
          enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, academic_year_id)
        );
      `, [], db);

      // 8. Teacher Allocations (Teaching assignments)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS teacher_assignments (
          id TEXT PRIMARY KEY,
          teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
          department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
          subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(teacher_id, subject_id, section_id, academic_year_id)
        );
      `, [], db);

      // 9. Assignments
      await dbRun(`
        CREATE TABLE IF NOT EXISTS assignments (
          id TEXT PRIMARY KEY,
          organization_id TEXT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          quiz_version INTEGER NOT NULL DEFAULT 1,
          teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          instructions TEXT NOT NULL DEFAULT '',
          scope_type TEXT NOT NULL DEFAULT 'SECTION' CHECK(scope_type IN ('INDIVIDUAL', 'SECTION', 'MULTI_SECTION', 'COMBINED')),
          target_sections TEXT NOT NULL DEFAULT '[]',
          target_students TEXT NOT NULL DEFAULT '[]',
          start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME NULL,
          allow_late INTEGER NOT NULL DEFAULT 0,
          time_limit_sec INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'CLOSED')),
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `, [], db);

      // 10. Assignment Recipients Snapshot
      await dbRun(`
        CREATE TABLE IF NOT EXISTS assignment_recipients (
          id TEXT PRIMARY KEY,
          assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          section_id TEXT NULL REFERENCES sections(id) ON DELETE SET NULL,
          source TEXT NOT NULL DEFAULT 'SECTION' CHECK(source IN ('SECTION', 'INDIVIDUAL')),
          status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED', 'STARTED', 'SUBMITTED', 'LATE', 'OVERDUE')),
          attempt_id TEXT NULL REFERENCES quiz_attempts(id) ON DELETE SET NULL,
          score REAL NULL,
          is_passed INTEGER NULL,
          submitted_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(assignment_id, student_id)
        );
      `, [], db);

      // 11. Add assignment_id and recipient_id to quiz_attempts if not present
      const attCols = await dbAll('PRAGMA table_info(quiz_attempts);', [], db);
      if (!attCols.some(c => c.name === 'assignment_id')) {
        await dbRun('ALTER TABLE quiz_attempts ADD COLUMN assignment_id TEXT NULL REFERENCES assignments(id) ON DELETE SET NULL;', [], db);
      }
      if (!attCols.some(c => c.name === 'recipient_id')) {
        await dbRun('ALTER TABLE quiz_attempts ADD COLUMN recipient_id TEXT NULL REFERENCES assignment_recipients(id) ON DELETE SET NULL;', [], db);
      }

      // Indexes for fast lookup
      await dbRun('CREATE INDEX IF NOT EXISTS idx_depts_org ON departments(organization_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_classes_dept ON classes(organization_id, department_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_sections_class ON sections(class_id, academic_year_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_subjects_org ON subjects(organization_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_enroll_user ON student_enrollments(user_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_enroll_sec ON student_enrollments(section_id, status);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_teach_alloc ON teacher_assignments(teacher_id, is_active);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_teach_sec ON teacher_assignments(section_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id, status);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_assignments_quiz ON assignments(quiz_id);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_assign_recip_student ON assignment_recipients(student_id, status);', [], db);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_assign_recip_assign ON assignment_recipients(assignment_id, status);', [], db);

      // Default base organization and academic year
      await dbRun(`
        INSERT OR IGNORE INTO organizations (id, name, code, type) 
        VALUES ('demo-org-uuid', 'Apex Institute of Technology & Management', 'AITM-DELHI', 'COLLEGE');
      `, [], db);

      await dbRun(`
        INSERT OR IGNORE INTO academic_years (id, organization_id, name, start_date, end_date, is_current) 
        VALUES ('demo-ay-2025-2026', 'demo-org-uuid', '2025-2026', '2025-08-01', '2026-06-30', 1);
      `, [], db);
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
