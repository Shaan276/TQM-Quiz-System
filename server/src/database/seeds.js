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
        `INSERT INTO users (id, email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, ?, 1)`,
        [acc.id, acc.email, passwordHash, acc.name, acc.role],
        db
      );
      console.log(`[Seeds] Created demo account: ${acc.email} (${acc.role})`);
    } else {
      // Ensure role is up-to-date and verified
      await dbRun(
        `UPDATE users SET role = ?, is_verified = 1 WHERE LOWER(email) = ?`,
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
}

module.exports = {
  seedDemoAccounts
};