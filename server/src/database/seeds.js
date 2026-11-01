const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { dbGet, dbRun, dbAll, getDatabase } = require('./index');

function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Ensures demo accounts for Student, Teacher, Super Admin, and Org Admin exist
 * along with rich sample assessments and mistake notebook data.
 */
async function seedDemoAccounts(customDb = null) {
  const db = customDb || getDatabase();

  const password = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const demoAccounts = [
    // Primary Qubix Platform Accounts
    {
      id: 'qubix-admin-uuid',
      email: 'admin@qubix.com',
      name: 'Piyush SuperAdmin',
      role: 'SUPER_ADMIN'
    },
    {
      id: 'qubix-orgadmin-uuid',
      email: 'orgadmin@qubix.com',
      name: 'Jordan Taylor',
      role: 'ORG_ADMIN'
    },
    {
      id: 'qubix-teacher1-uuid',
      email: 'teacher1@qubix.com',
      name: 'Prof. Sarah Jenkins',
      role: 'TEACHER'
    },
    {
      id: 'qubix-teacher2-uuid',
      email: 'teacher2@qubix.com',
      name: 'Prof. Alan Turing',
      role: 'TEACHER'
    },
    {
      id: 'qubix-student1-uuid',
      email: 'student1@qubix.com',
      name: 'Alex Rivera',
      role: 'STUDENT'
    },
    {
      id: 'qubix-student2-uuid',
      email: 'student2@qubix.com',
      name: 'Grace Hopper',
      role: 'STUDENT'
    },
    {
      id: 'qubix-student3-uuid',
      email: 'student3@qubix.com',
      name: 'Leonardo Euler',
      role: 'STUDENT'
    },
    // Compatibility aliases for automated test suites
    {
      id: 'demo-student-uuid',
      email: 'student@quizsystem.com',
      name: 'Alex Rivera',
      role: 'STUDENT'
    },
    {
      id: 'demo-teacher-uuid',
      email: 'teacher@quizsystem.com',
      name: 'Prof. Sarah Jenkins',
      role: 'TEACHER'
    },
    {
      id: 'demo-admin-uuid',
      email: 'admin@quizsystem.com',
      name: 'Piyush SuperAdmin',
      role: 'SUPER_ADMIN'
    },
    {
      id: 'demo-orgadmin-uuid',
      email: 'orgadmin@quizsystem.com',
      name: 'Jordan Taylor',
      role: 'ORG_ADMIN'
    }
  ];

  for (const acc of demoAccounts) {
    const existing = await dbGet(`SELECT id FROM users WHERE LOWER(email) = ?`, [acc.email], db);
    if (!existing) {
      await dbRun(
        `INSERT INTO users (id, email, password_hash, name, role, is_verified, approval_status, organization_id) VALUES (?, ?, ?, ?, ?, 1, 'APPROVED', 'demo-org-uuid')`,
        [acc.id, acc.email, passwordHash, acc.name, acc.role],
        db
      );
      console.log(`[Seeds] Created Qubix account: ${acc.email} (${acc.role})`);
    } else {
      // Ensure role is up-to-date, verified, and approved
      await dbRun(
        `UPDATE users SET role = ?, is_verified = 1, approval_status = 'APPROVED', organization_id = 'demo-org-uuid' WHERE LOWER(email) = ?`,
        [acc.role, acc.email],
        db
      );
    }
  }

  // Check if sample published quiz exists
  const existingQuiz = await dbGet(`SELECT id FROM quizzes WHERE title = 'TQM Quality Standards & Six Sigma'`, [], db);
  if (!existingQuiz) {
    const quizId = generateUUID();
    const teacher = await dbGet(`SELECT id FROM users WHERE email = 'teacher@quizsystem.com'`, [], db);
    const teacherId = teacher?.id || 'demo-teacher-uuid';

    await dbRun(
      `INSERT INTO quizzes (
        id, creator_id, title, description, category, difficulty, tags,
        status, visibility, time_limit_sec, passing_percentage, show_explanations, version, published_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', 'PUBLIC', 600, 60, 'AFTER_SUBMIT', 1, 1)`,
      [
        quizId,
        teacherId,
        'TQM Quality Standards & Six Sigma',
        'Official assessment covering Deming 14 points, Kaizen principles, Pareto 80/20 rule, and control limit calculations.',
        'TQM (Total Quality Management)',
        'MEDIUM',
        '["TQM", "Quality", "SixSigma"]'
      ],
      db
    );

    // Add 6 Questions
    const questionsData = [
      {
        text: 'Who developed the 14 Points for Management for Total Quality Management?',
        type: 'MCQ_SINGLE',
        marks: 2,
        explanation: 'W. Edwards Deming developed the 14 points for quality management.',
        options: [
          { key: 'A', text: 'Philip Crosby', isCorrect: 0 },
          { key: 'B', text: 'W. Edwards Deming', isCorrect: 1 },
          { key: 'C', text: 'Kaoru Ishikawa', isCorrect: 0 },
          { key: 'D', text: 'Joseph Juran', isCorrect: 0 }
        ]
      },
      {
        text: 'Which tools belong to the classical 7 QC Tools? (Select all that apply)',
        type: 'MCQ_MULTI',
        marks: 2,
        explanation: 'Pareto Charts, Fishbone Diagrams, and Check Sheets are part of the 7 QC tools.',
        options: [
          { key: 'A', text: 'Pareto Chart', isCorrect: 1 },
          { key: 'B', text: 'Fishbone (Ishikawa) Diagram', isCorrect: 1 },
          { key: 'C', text: 'Check Sheet', isCorrect: 1 },
          { key: 'D', text: 'Blockchain Ledger', isCorrect: 0 }
        ]
      },
      {
        text: 'In Lean and TQM, Kaizen refers to rapid discontinuous revolutionary change.',
        type: 'TRUE_FALSE',
        marks: 1,
        explanation: 'False. Kaizen means continuous incremental improvement, whereas Kaikaku represents radical transformation.',
        options: [
          { key: 'T', text: 'True', isCorrect: 0 },
          { key: 'F', text: 'False', isCorrect: 1 }
        ]
      },
      {
        text: 'The statistical 80/20 rule in defect analysis is named the ______ Principle.',
        type: 'FILL_BLANK',
        marks: 2,
        explanation: 'The Pareto Principle states that roughly 80% of consequences come from 20% of causes.',
        answer: 'Pareto'
      },
      {
        text: 'What does the abbreviation DMAIC stand for in Six Sigma methodologies?',
        type: 'SHORT_ANSWER',
        marks: 2,
        explanation: 'DMAIC stands for Define Measure Analyze Improve Control.',
        answer: 'Define Measure Analyze Improve Control'
      },
      {
        text: 'For a normal distribution with mean 50.0 and sigma 2.0, calculate the Upper Control Limit (UCL = mean + 3*sigma):',
        type: 'NUMERICAL',
        marks: 2,
        explanation: 'UCL = 50.0 + 3 * 2.0 = 56.0',
        answer: '56.0',
        tolerance: 0.1
      }
    ];

    const populatedForSnapshot = [];

    for (let i = 0; i < questionsData.length; i++) {
      const qd = questionsData[i];
      const qId = generateUUID();

      await dbRun(
        `INSERT INTO questions (
          id, quiz_id, question_text, question_type, marks, time_limit_sec, explanation, sort_order, settings
        ) VALUES (?, ?, ?, ?, ?, 60, ?, ?, '{}')`,
        [qId, quizId, qd.text, qd.type, qd.marks, qd.explanation, i],
        db
      );

      const currentQObj = {
        id: qId,
        question_text: qd.text,
        question_type: qd.type,
        marks: qd.marks,
        time_limit_sec: 60,
        explanation: qd.explanation,
        sort_order: i,
        options: [],
        answers: []
      };

      if (qd.options) {
        for (let j = 0; j < qd.options.length; j++) {
          const opt = qd.options[j];
          const optId = generateUUID();
          await dbRun(
            `INSERT INTO question_options (id, question_id, option_key, option_text, is_correct, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [optId, qId, opt.key, opt.text, opt.isCorrect, j],
            db
          );
          currentQObj.options.push({
            id: optId,
            option_key: opt.key,
            option_text: opt.text,
            is_correct: opt.isCorrect
          });
        }
      } else {
        await dbRun(
          `INSERT INTO question_answers (id, question_id, expected_answer, is_case_sensitive, numeric_tolerance)
           VALUES (?, ?, ?, 0, ?)`,
          [generateUUID(), qId, qd.answer, qd.tolerance || 0.0],
          db
        );
        currentQObj.answers.push({
          expected_answer: qd.answer,
          is_case_sensitive: 0,
          numeric_tolerance: qd.tolerance || 0.0
        });
      }

      populatedForSnapshot.push(currentQObj);
    }

    // Version snapshot
    const snapshot = JSON.stringify({
      quiz: { id: quizId, title: 'TQM Quality Standards & Six Sigma' },
      questions: populatedForSnapshot,
      snapshotTimestamp: new Date().toISOString()
    });

    await dbRun(
      `INSERT INTO quiz_versions (id, quiz_id, version, title, snapshot_data, published_by)
       VALUES (?, ?, 1, 'TQM Quality Standards & Six Sigma', ?, ?)`,
      [generateUUID(), quizId, snapshot, teacherId],
      db
    );

    // Seed student sample attempt & mistake
    const student = await dbGet(`SELECT id FROM users WHERE email = 'student@quizsystem.com'`, [], db);
    if (student) {
      const attemptId = generateUUID();
      await dbRun(
        `INSERT INTO quiz_attempts (
          id, quiz_id, quiz_version, user_id, status, score, max_score, score_percentage,
          is_passed, total_questions, correct_answers, incorrect_answers, unanswered_count,
          time_limit_sec, started_at, submitted_at, time_taken_sec
        ) VALUES (?, ?, 1, ?, 'COMPLETED', 9.0, 11.0, 81.82, 1, 6, 5, 1, 0, 600,
          DATETIME('now', '-2 hours'), DATETIME('now', '-1 hours'), 245)`,
        [attemptId, quizId, student.id],
        db
      );

      // Seed mistake notebook entry for question 3 (Kaizen)
      const q3 = populatedForSnapshot.find(q => q.question_type === 'TRUE_FALSE');
      if (q3) {
        await dbRun(
          `INSERT INTO mistake_notebook (
            id, user_id, attempt_id, quiz_id, question_id, quiz_title, question_text,
            question_type, subject, user_answer, correct_answer, explanation, is_resolved, mistake_count
          ) VALUES (?, ?, ?, ?, ?, 'TQM Quality Standards & Six Sigma', ?, 'TRUE_FALSE',
            'TQM (Total Quality Management)', 'True', 'False', ?, 0, 1)`,
          [
            generateUUID(),
            student.id,
            attemptId,
            quizId,
            q3.id,
            q3.question_text,
            q3.explanation
          ],
          db
        );
      }
    }

    console.log('[Seeds] Seeded sample published quiz and student attempt.');
  }

  // -------------------------------------------------------------
  // Seed Phase P6 Institutional Structure, Enrollments & Assignments
  // -------------------------------------------------------------
  const existingOrg = await dbGet(`SELECT id FROM organizations WHERE id = 'demo-org-uuid'`, [], db);
  if (!existingOrg) {
    // 1. Organization
    await dbRun(`
      INSERT INTO organizations (id, name, code, type, dept_term, class_term)
      VALUES ('demo-org-uuid', 'Apex Institute of Technology & Management', 'AITM-TECH', 'COLLEGE', 'Department', 'Program')
    `, [], db);
  }

  // Update demo accounts to have organization_id
  await dbRun(`UPDATE users SET organization_id = 'demo-org-uuid' WHERE id IN ('demo-student-uuid', 'demo-teacher-uuid', 'demo-orgadmin-uuid', 'qubix-student1-uuid', 'qubix-teacher1-uuid', 'qubix-orgadmin-uuid')`, [], db);

  const existingSec = await dbGet(`SELECT id FROM sections WHERE id = 'demo-sec-a'`, [], db);
  if (!existingSec) {
    // 2. Academic Year
    let ay = await dbGet(`SELECT id FROM academic_years WHERE organization_id = 'demo-org-uuid' LIMIT 1`, [], db);
    let ayId = ay ? ay.id : 'demo-ay-2025-2026';
    if (!ay) {
      await dbRun(`
        INSERT OR IGNORE INTO academic_years (id, organization_id, name, start_date, end_date, is_current)
        VALUES ('demo-ay-2025-2026', 'demo-org-uuid', '2025-2026', '2025-08-01', '2026-06-30', 1)
      `, [], db);
    }

    // 3. Departments
    await dbRun(`
      INSERT OR IGNORE INTO departments (id, organization_id, name, code, description)
      VALUES 
        ('demo-dept-tqm', 'demo-org-uuid', 'Total Quality & Operations', 'TQM-OPS', 'Industrial Engineering and Quality Assurance'),
        ('demo-dept-cse', 'demo-org-uuid', 'Computer Science & Engineering', 'CSE', 'Software Systems and Data Science')
    `, [], db);

    // 4. Classes (Programs)
    await dbRun(`
      INSERT OR IGNORE INTO classes (id, organization_id, department_id, name, code)
      VALUES 
        ('demo-class-btech', 'demo-org-uuid', 'demo-dept-tqm', 'B.Tech Operations & Quality', 'BTECH-OQ-Y3'),
        ('demo-class-mba', 'demo-org-uuid', 'demo-dept-tqm', 'MBA Quality Management', 'MBA-QM-Y1')
    `, [], db);

    // 5. Sections
    await dbRun(`
      INSERT OR IGNORE INTO sections (id, class_id, academic_year_id, name, capacity)
      VALUES 
        ('demo-sec-a', 'demo-class-btech', ?, 'Section A', 60),
        ('demo-sec-b', 'demo-class-btech', ?, 'Section B', 60)
    `, [ayId, ayId], db);

    // 6. Subjects
    await dbRun(`
      INSERT OR IGNORE INTO subjects (id, organization_id, department_id, name, code, description)
      VALUES 
        ('demo-sub-tqm', 'demo-org-uuid', 'demo-dept-tqm', 'Total Quality Management', 'TQM-301', 'Deming 14 principles, Kaizen, Six Sigma, Pareto charts'),
        ('demo-sub-sqc', 'demo-org-uuid', 'demo-dept-tqm', 'Statistical Quality Control', 'SQC-302', 'Control charts, acceptance sampling, process capability')
    `, [], db);

    // 7. Student Enrollment (Alex Rivera in Section A)
    await dbRun(`
      INSERT OR IGNORE INTO student_enrollments (id, user_id, organization_id, academic_year_id, department_id, class_id, section_id, roll_number, status)
      VALUES 
        ('demo-enroll-student', 'demo-student-uuid', 'demo-org-uuid', ?, 'demo-dept-tqm', 'demo-class-btech', 'demo-sec-a', '2410301049', 'ACTIVE'),
        ('qubix-enroll-student1', 'qubix-student1-uuid', 'demo-org-uuid', ?, 'demo-dept-tqm', 'demo-class-btech', 'demo-sec-a', 'QUB-2026-001', 'ACTIVE')
    `, [ayId, ayId], db);

    // 8. Teacher Allocation (Prof. Sarah Jenkins teaches TQM-301 to Section A)
    await dbRun(`
      INSERT OR IGNORE INTO teacher_assignments (id, teacher_id, organization_id, academic_year_id, department_id, subject_id, class_id, section_id, is_active)
      VALUES 
        ('demo-alloc-teacher', 'demo-teacher-uuid', 'demo-org-uuid', ?, 'demo-dept-tqm', 'demo-sub-tqm', 'demo-class-btech', 'demo-sec-a', 1),
        ('qubix-alloc-teacher1', 'qubix-teacher1-uuid', 'demo-org-uuid', ?, 'demo-dept-tqm', 'demo-sub-tqm', 'demo-class-btech', 'demo-sec-a', 1)
    `, [ayId, ayId], db);

    // 9. Initial Assignment for Alex Rivera & student1: Assign the sample TQM quiz to Section A
    const sampleQuiz = await dbGet(`SELECT id FROM quizzes WHERE title = 'TQM Quality Standards & Six Sigma'`, [], db);
    if (sampleQuiz) {
      const assignmentId = 'demo-assignment-tqm';
      await dbRun(`
        INSERT OR IGNORE INTO assignments (
          id, organization_id, quiz_id, quiz_version, teacher_id, title, instructions,
          scope_type, target_sections, target_students, due_date, time_limit_sec, max_attempts, status
        ) VALUES (
          ?, 'demo-org-uuid', ?, 1, 'qubix-teacher1-uuid', 'TQM Module 1 Midterm Assessment',
          'Please complete this comprehensive TQM evaluation within 10 minutes. Ensure full screen is maintained.',
          'SECTION', '["demo-sec-a"]', '[]', DATETIME('now', '+7 days'), 600, 2, 'PUBLISHED'
        )
      `, [assignmentId, sampleQuiz.id], db);

      // Snapshot recipients
      await dbRun(`
        INSERT OR IGNORE INTO assignment_recipients (
          id, assignment_id, student_id, section_id, source, status
        ) VALUES 
          ('demo-recip-student', ?, 'demo-student-uuid', 'demo-sec-a', 'SECTION', 'ASSIGNED'),
          ('qubix-recip-student1', ?, 'qubix-student1-uuid', 'demo-sec-a', 'SECTION', 'ASSIGNED')
      `, [assignmentId, assignmentId], db);
    }

    console.log('[Seeds] Seeded Phase P6 Institutional hierarchy, student enrollment, teacher allocation, and scoped assignment.');
  }
}

module.exports = {
  seedDemoAccounts
};