const express = require('express');
const crypto = require('crypto');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

function generateUUID() {
  return crypto.randomUUID();
}

// -------------------------------------------------------------
// 1. POST /api/v1/challenges - Student submits question challenge
// -------------------------------------------------------------
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      quizId,
      questionId,
      attemptId = null,
      studentAnswer = '',
      officialAnswer = '',
      challengeReason,
      studentNote = ''
    } = req.body;

    if (!quizId || !questionId || !challengeReason) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'quizId, questionId, and challengeReason are required' }
      });
    }

    const quiz = await dbGet(`SELECT id, title, version, creator_id FROM quizzes WHERE id = ?`, [quizId]);
    if (!quiz) {
      return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    }

    // Check for existing pending challenge for this student & question
    const existing = await dbGet(
      `SELECT id FROM question_challenges WHERE quiz_id = ? AND question_id = ? AND student_id = ? AND status = 'PENDING'`,
      [quizId, questionId, userId]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'ERR_DUPLICATE_CHALLENGE', message: 'You already have a pending challenge for this question.' }
      });
    }

    const challengeId = generateUUID();
    await dbRun(
      `INSERT INTO question_challenges (
        id, quiz_id, quiz_version, question_id, student_id, attempt_id,
        student_answer, official_answer, challenge_reason, student_note, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        challengeId,
        quizId,
        quiz.version || 1,
        questionId,
        userId,
        attemptId,
        typeof studentAnswer === 'object' ? JSON.stringify(studentAnswer) : String(studentAnswer ?? ''),
        typeof officialAnswer === 'object' ? JSON.stringify(officialAnswer) : String(officialAnswer ?? ''),
        challengeReason,
        studentNote
      ]
    );

    // Notify teacher
    if (quiz.creator_id) {
      await createNotification({
        userId: quiz.creator_id,
        title: '⚠️ Question Challenge Received',
        message: `Student '${req.user.name}' submitted a challenge in '${quiz.title}'. Reason: ${challengeReason}`,
        type: 'ACTION_REQUIRED',
        linkUrl: '/creator-dashboard'
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        challengeId,
        message: 'Question challenge submitted successfully. Your instructor has been notified to review and update marks.'
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. GET /api/v1/challenges/my - Student's challenged questions
// -------------------------------------------------------------
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const challenges = await dbAll(
      `SELECT 
        c.*, 
        q.title as quiz_title,
        qu.question_text,
        qu.question_type,
        qu.marks as question_marks
       FROM question_challenges c
       JOIN quizzes q ON c.quiz_id = q.id
       LEFT JOIN questions qu ON c.question_id = qu.id
       WHERE c.student_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: { challenges }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. GET /api/v1/challenges/teacher - Challenges for teacher's authored quizzes
// -------------------------------------------------------------
router.get('/teacher', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || '').toUpperCase();
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'ORG_ADMIN';

    let sql = `
      SELECT 
        c.*,
        q.title as quiz_title,
        q.creator_id,
        u.name as student_name,
        u.email as student_email,
        qu.question_text,
        qu.question_type,
        qu.marks as question_marks
      FROM question_challenges c
      JOIN quizzes q ON c.quiz_id = q.id
      JOIN users u ON c.student_id = u.id
      LEFT JOIN questions qu ON c.question_id = qu.id
    `;

    const params = [];
    if (!isSuperAdmin) {
      sql += ` WHERE q.creator_id = ?`;
      params.push(userId);
    }
    sql += ` ORDER BY CASE WHEN c.status = 'PENDING' THEN 0 ELSE 1 END, c.created_at DESC`;

    const challenges = await dbAll(sql, params);

    return res.json({
      success: true,
      data: { challenges }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. POST /api/v1/challenges/:id/resolve - Teacher accepts/rejects challenge & regrades ALL
// -------------------------------------------------------------
router.post('/:id/resolve', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      action, // 'ACCEPT' | 'REJECT'
      teacherFeedback = '',
      newCorrectAnswer = null,
      awardAllStudents = true
    } = req.body;

    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, error: { message: "action must be 'ACCEPT' or 'REJECT'" } });
    }

    const challenge = await dbGet(`SELECT * FROM question_challenges WHERE id = ?`, [id]);
    if (!challenge) {
      return res.status(404).json({ success: false, error: { message: 'Challenge not found' } });
    }

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [challenge.quiz_id]);
    const question = await dbGet(`SELECT * FROM questions WHERE id = ?`, [challenge.question_id]);

    const isTeacher = quiz && (quiz.creator_id === req.user.id || ['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN'].includes(req.user.role));
    if (!isTeacher) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden: You cannot resolve this challenge' } });
    }

    if (action === 'REJECT') {
      await dbRun(
        `UPDATE question_challenges SET 
          status = 'REJECTED',
          teacher_feedback = ?,
          resolved_by = ?,
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [teacherFeedback, req.user.id, id]
      );

      // Notify the challenging student
      await createNotification({
        userId: challenge.student_id,
        title: 'Question Challenge Reviewed',
        message: `Your challenge for '${quiz?.title || 'Quiz'}' was reviewed. Instructor response: "${teacherFeedback || 'Original answer key retained.'}"`,
        type: 'INFO',
        linkUrl: '/mistake-notebook'
      });

      return res.json({
        success: true,
        data: {
          status: 'REJECTED',
          message: 'Challenge rejected. Student notified.'
        }
      });
    }

    // ACTION IS 'ACCEPT' -> UPDATE ANSWER KEY & REGRADE FOR ALL STUDENTS
    const cleanNewAnswer = newCorrectAnswer !== null && newCorrectAnswer !== undefined && String(newCorrectAnswer).trim() !== ''
      ? String(newCorrectAnswer).trim()
      : challenge.student_answer;

    // 1. If new answer key provided, update expected_answer in question_answers
    if (question && cleanNewAnswer) {
      if (['FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL'].includes(question.question_type)) {
        await dbRun(`UPDATE question_answers SET expected_answer = ? WHERE question_id = ?`, [cleanNewAnswer, question.id]);
      }
    }

    // 2. Regrade all completed attempts for this quiz
    const qMarks = question ? Number(question.marks) || 1 : 1;
    const completedAttempts = await dbAll(
      `SELECT id, user_id, score, max_score, score_percentage FROM quiz_attempts WHERE quiz_id = ? AND status = 'COMPLETED'`,
      [challenge.quiz_id]
    );

    let regradedCount = 0;
    const notifiedUserIds = new Set();

    for (const att of completedAttempts) {
      const ansRow = await dbGet(
        `SELECT id, user_answer, is_correct, earned_score FROM attempt_answers WHERE attempt_id = ? AND question_id = ?`,
        [att.id, challenge.question_id]
      );

      let shouldAward = false;

      if (awardAllStudents) {
        // Teacher chose to accept the question for everyone who answered, or if answer matches student's answer / new answer
        if (!ansRow || ansRow.is_correct === 0) {
          // If student answered something, or answered the challenged answer
          const rawAns = ansRow ? String(ansRow.user_answer || '').trim() : '';
          if (rawAns.length > 0 || att.user_id === challenge.student_id) {
            shouldAward = true;
          }
        }
      } else {
        // Only award challenging student
        if (att.user_id === challenge.student_id && (!ansRow || ansRow.is_correct === 0)) {
          shouldAward = true;
        }
      }

      if (shouldAward) {
        // Update attempt_answers
        if (ansRow) {
          await dbRun(
            `UPDATE attempt_answers SET 
              is_correct = 1, 
              earned_score = ?, 
              evaluation_notes = ? 
             WHERE id = ?`,
            [qMarks, 'Awarded full marks via accepted question challenge', ansRow.id]
          );
        } else {
          await dbRun(
            `INSERT INTO attempt_answers (id, attempt_id, question_id, question_type, user_answer, is_correct, earned_score, max_marks, is_evaluated, evaluation_notes)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, ?)`,
            [generateUUID(), att.id, challenge.question_id, question?.question_type || 'UNKNOWN', challenge.student_answer, qMarks, qMarks, 'Awarded full marks via accepted challenge']
          );
        }

        // Recalculate attempt score
        const scoreSumRow = await dbGet(
          `SELECT COALESCE(SUM(earned_score), 0) as total_earned, COALESCE(SUM(max_marks), 0) as total_max FROM attempt_answers WHERE attempt_id = ?`,
          [att.id]
        );

        const newScore = Number(scoreSumRow?.total_earned) || (att.score + qMarks);
        const maxScore = Number(scoreSumRow?.total_max) || att.max_score || 1;
        const newPercentage = maxScore > 0 ? Math.round((newScore / maxScore) * 10000) / 100 : 0;
        const passThreshold = quiz?.passing_percentage ?? 50;
        const newPassed = newPercentage >= passThreshold ? 1 : 0;

        await dbRun(
          `UPDATE quiz_attempts SET score = ?, score_percentage = ?, is_passed = ? WHERE id = ?`,
          [newScore, newPercentage, newPassed, att.id]
        );

        // Mark resolved in Mistake Notebook for this student
        await dbRun(
          `UPDATE mistake_notebook SET is_resolved = 1 WHERE user_id = ? AND question_id = ?`,
          [att.user_id, challenge.question_id]
        );

        regradedCount++;

        // Notify affected student
        if (!notifiedUserIds.has(att.user_id)) {
          notifiedUserIds.add(att.user_id);
          await createNotification({
            userId: att.user_id,
            title: '🎉 Marks Updated (Challenge Accepted)',
            message: `Instructor accepted a challenge for '${quiz?.title || 'Quiz'}'. Your score was updated to ${newScore}/${maxScore} (${newPercentage}%).`,
            type: 'SUCCESS',
            linkUrl: '/attempt-history'
          });
        }
      }
    }

    // 3. Mark challenge ACCEPTED
    await dbRun(
      `UPDATE question_challenges SET 
        status = 'ACCEPTED',
        teacher_feedback = ?,
        accepted_action = 'UPDATE_KEY_AND_REGRADE_ALL',
        new_correct_answer = ?,
        regraded_attempts_count = ?,
        resolved_by = ?,
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [teacherFeedback, cleanNewAnswer, regradedCount, req.user.id, id]
    );

    return res.json({
      success: true,
      data: {
        status: 'ACCEPTED',
        regradedAttemptsCount: regradedCount,
        notifiedStudentsCount: notifiedUserIds.size,
        message: `Challenge accepted! Correct answer updated and marks recalculated for all ${regradedCount} affected attempt(s).`
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
