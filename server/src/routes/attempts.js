const express = require('express');
const crypto = require('crypto');
const { dbGet, dbRun, dbAll } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { evaluateQuestionAnswer, formatCorrectAnswer, formatUserAnswer } = require('../services/scoringEngine');

const router = express.Router();

function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Sanitizes questions for taking so no answers or explanations leak to client.
 */
function maskQuestionsForAttempt(questions) {
  return questions.map(q => {
    const masked = {
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      marks: q.marks,
      time_limit_sec: q.time_limit_sec,
      sort_order: q.sort_order,
      media_url: q.media_url || null,
      settings: q.settings || {}
    };

    // Include option choices WITHOUT is_correct
    if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type) && Array.isArray(q.options)) {
      masked.options = q.options.map(opt => ({
        id: opt.id,
        option_key: opt.option_key,
        option_text: opt.option_text,
        sort_order: opt.sort_order
      }));
    }

    // Do NOT include expected_answer or numeric_tolerance or explanation
    return masked;
  });
}

/**
 * Helper to retrieve snapshot or active questions for a quiz
 */
async function getQuizVersionQuestions(quizId, version) {
  // Try to find snapshot in quiz_versions
  const versionRow = await dbGet(
    `SELECT snapshot_data FROM quiz_versions WHERE quiz_id = ? AND version = ?`,
    [quizId, version]
  );

  if (versionRow && versionRow.snapshot_data) {
    try {
      const parsed = JSON.parse(versionRow.snapshot_data);
      if (parsed && Array.isArray(parsed.questions)) {
        return { quiz: parsed.quiz, questions: parsed.questions };
      }
    } catch (e) {
      console.error('[Attempts] Failed to parse snapshot_data:', e);
    }
  }

  // Fallback to active questions from database
  const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);
  const questions = await dbAll(
    `SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC`,
    [quizId]
  );

  const populated = [];
  for (const q of questions) {
    let options = [];
    let answers = [];

    if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type)) {
      options = await dbAll(
        `SELECT id, option_key, option_text, is_correct, sort_order FROM question_options WHERE question_id = ? ORDER BY sort_order ASC`,
        [q.id]
      );
    } else {
      answers = await dbAll(
        `SELECT expected_answer, is_case_sensitive, numeric_tolerance FROM question_answers WHERE question_id = ?`,
        [q.id]
      );
    }

    populated.push({
      ...q,
      options,
      answers,
      settings: typeof q.settings === 'string' ? JSON.parse(q.settings || '{}') : q.settings
    });
  }

  return { quiz, questions: populated };
}

// -------------------------------------------------------------
// 1. POST /api/v1/attempts/start - Start a new quiz attempt
// -------------------------------------------------------------
router.post('/start', authenticateToken, async (req, res, next) => {
  try {
    const quizId = req.body.quizId || req.body.quiz_id;
    const assignmentId = req.body.assignmentId || req.body.assignment_id || null;
    const userId = req.user.id;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'quizId is required to start an attempt' }
      });
    }

    // 1. Fetch published quiz
    const quiz = await dbGet(
      `SELECT q.*, u.name as creator_name 
       FROM quizzes q 
       JOIN users u ON q.creator_id = u.id 
       WHERE q.id = ?`,
      [quizId]
    );

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_QUIZ_NOT_FOUND', message: 'Quiz does not exist' }
      });
    }

    if (quiz.status !== 'PUBLISHED') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_QUIZ_NOT_PUBLISHED', message: 'This quiz is not currently published for taking' }
      });
    }

    // 2. Check for an existing in-progress attempt to resume
    const existingAttempt = await dbGet(
      `SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1`,
      [quizId, userId]
    );

    if (existingAttempt) {
      // Check if it expired
      if (existingAttempt.expires_at && new Date() > new Date(existingAttempt.expires_at)) {
        await dbRun(`UPDATE quiz_attempts SET status = 'EXPIRED' WHERE id = ?`, [existingAttempt.id]);
      } else {
        // Return existing in-progress attempt
        const { questions } = await getQuizVersionQuestions(quizId, existingAttempt.quiz_version);
        const savedAnswers = await dbAll(
          `SELECT question_id, user_answer FROM attempt_answers WHERE attempt_id = ?`,
          [existingAttempt.id]
        );

        const answersMap = {};
        savedAnswers.forEach(a => {
          answersMap[a.question_id] = a.user_answer;
        });

        const remainingSeconds = existingAttempt.expires_at
          ? Math.max(0, Math.round((new Date(existingAttempt.expires_at) - new Date()) / 1000))
          : null;

        return res.json({
          success: true,
          data: {
            isResumed: true,
            attemptId: existingAttempt.id,
            attempt: { id: existingAttempt.id },
            quiz: {
              id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              category: quiz.category,
              difficulty: quiz.difficulty,
              time_limit_sec: quiz.time_limit_sec,
              pass_percentage: quiz.passing_percentage ?? quiz.pass_percentage ?? 60,
              total_questions: existingAttempt.total_questions,
              max_score: existingAttempt.max_score
            },
            questions: maskQuestionsForAttempt(questions),
            savedAnswers: answersMap,
            startedAt: existingAttempt.started_at,
            expiresAt: existingAttempt.expires_at,
            remainingSeconds
          }
        });
      }
    }

    // 3. Check max attempts if configured
    if (quiz.max_attempts && quiz.max_attempts > 0) {
      const attemptsCountRow = await dbGet(
        `SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'COMPLETED'`,
        [quizId, userId]
      );
      if (attemptsCountRow && attemptsCountRow.count >= quiz.max_attempts) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_MAX_ATTEMPTS_EXCEEDED',
            message: `You have reached the maximum allowed attempts (${quiz.max_attempts}) for this quiz.`
          }
        });
      }
    }

    // 4. Load quiz questions snapshot
    // Phase P6: Institutional Scoped Access Enforcement
    let assignmentRecip = null;
    const isStudent = req.user.role === 'STUDENT' || req.user.role === 'LEARNER';
    let userOrgId = req.user.organization_id;
    if (!userOrgId) {
      const u = await dbGet(`SELECT organization_id FROM users WHERE id = ?`, [userId]);
      userOrgId = u?.organization_id;
    }
    const hasEnrollment = await dbGet(`SELECT id FROM student_enrollments WHERE user_id = ? AND status = 'ACTIVE'`, [userId]);
    if (isStudent && (userOrgId || hasEnrollment)) {
      assignmentRecip = await dbGet(`
        SELECT ar.*, a.id as assignment_id, a.due_date, a.allow_late, a.time_limit_sec as assign_time_limit, a.max_attempts as assign_max_attempts
        FROM assignment_recipients ar
        JOIN assignments a ON ar.assignment_id = a.id
        WHERE ar.student_id = ? AND a.quiz_id = ? AND a.status = 'PUBLISHED'
        ORDER BY a.created_at DESC LIMIT 1
      `, [userId, quizId]);

      if (!assignmentRecip) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_QUIZ_NOT_ASSIGNED',
            message: 'Access Denied: You cannot attempt this quiz until an instructor assigns it to you or your section.'
          }
        });
      }

      if (assignmentRecip.due_date && new Date(assignmentRecip.due_date) < new Date() && !assignmentRecip.allow_late) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ERR_ASSIGNMENT_OVERDUE',
            message: 'This assignment deadline has passed and late submissions are not allowed.'
          }
        });
      }

      if (assignmentRecip.assign_max_attempts > 0) {
        const attemptsCountRow = await dbGet(
          `SELECT COUNT(*) as count FROM quiz_attempts WHERE assignment_id = ? AND user_id = ? AND status = 'COMPLETED'`,
          [assignmentRecip.assignment_id, userId]
        );
        if (attemptsCountRow && attemptsCountRow.count >= assignmentRecip.assign_max_attempts) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ERR_MAX_ATTEMPTS_EXCEEDED',
              message: `You have reached the maximum allowed attempts (${assignmentRecip.assign_max_attempts}) for this assignment.`
            }
          });
        }
      }
    }
    const currentVersion = quiz.published_version || quiz.version || 1;
    const { questions } = await getQuizVersionQuestions(quizId, currentVersion);

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_EMPTY_QUIZ', message: 'This quiz has no questions available for taking' }
      });
    }

    // Compute total marks and time limit
    const totalQuestions = questions.length;
    const maxScore = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
    const quizTimeLimit = Number(quiz.time_limit_sec) || 0;

    const startedAt = new Date();
    let expiresAt = null;
    let remainingSeconds = null;

    if (quizTimeLimit > 0) {
      expiresAt = new Date(startedAt.getTime() + quizTimeLimit * 1000);
      remainingSeconds = quizTimeLimit;
    }

    const attemptId = generateUUID();

    await dbRun(
      `INSERT INTO quiz_attempts (
        id, quiz_id, quiz_version, user_id, status, score, max_score, 
        total_questions, time_limit_sec, started_at, expires_at,
        assignment_id, recipient_id
      ) VALUES (?, ?, ?, ?, 'IN_PROGRESS', 0.0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        quizId,
        currentVersion,
        userId,
        maxScore,
        totalQuestions,
        quizTimeLimit,
        startedAt.toISOString(),
        expiresAt ? expiresAt.toISOString() : null,
        assignmentRecip?.assignment_id || null,
        assignmentRecip?.id || null
      ]
    );

    if (assignmentRecip) {
      await dbRun(
        `UPDATE assignment_recipients SET status = 'STARTED', attempt_id = ? WHERE id = ? AND status = 'ASSIGNED'`,
        [attemptId, assignmentRecip.id]
      );
    }

    // Shuffle questions if quiz settings dictate
    let orderedQuestions = [...questions];
    if (quiz.shuffle_questions) {
      orderedQuestions = orderedQuestions.sort(() => Math.random() - 0.5);
    }

    // Shuffle options if quiz settings dictate
    if (quiz.shuffle_options) {
      orderedQuestions = orderedQuestions.map(q => {
        if (Array.isArray(q.options)) {
          return { ...q, options: [...q.options].sort(() => Math.random() - 0.5) };
        }
        return q;
      });
    }

    res.status(201).json({
      success: true,
      data: {
        isResumed: false,
        attemptId,
        attempt: { id: attemptId },
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          category: quiz.category,
          difficulty: quiz.difficulty,
          time_limit_sec: quizTimeLimit,
          pass_percentage: quiz.passing_percentage ?? quiz.pass_percentage ?? 60,
          total_questions: totalQuestions,
          max_score: maxScore
        },
        questions: maskQuestionsForAttempt(orderedQuestions),
        savedAnswers: {},
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        remainingSeconds
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. GET /api/v1/attempts/history/my - Learner's historical attempts (STATIC ROUTE MUST PRECEDE /:id)
// -------------------------------------------------------------
router.get('/history/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = '' } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let whereClauses = [`a.user_id = ?`];
    const params = [userId];

    if (status) {
      whereClauses.push(`a.status = ?`);
      params.push(status);
    }

    const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

    const countRow = await dbGet(`SELECT COUNT(*) as total FROM quiz_attempts a ${whereSQL}`, params);
    const total = countRow?.total || 0;

    const attempts = await dbAll(
      `SELECT 
        a.id,
        a.quiz_id,
        a.quiz_version,
        a.status,
        a.score,
        a.max_score,
        a.score_percentage,
        a.is_passed,
        a.total_questions,
        a.correct_answers,
        a.incorrect_answers,
        a.time_taken_sec,
        a.started_at,
        a.submitted_at,
        a.warning_count,
        a.is_flagged,
        a.flag_reason,
        q.title as quiz_title,
        q.category as quiz_category,
        q.difficulty as quiz_difficulty,
        q.cover_image_url as quiz_cover_image
       FROM quiz_attempts a
       JOIN quizzes q ON a.quiz_id = q.id
       ${whereSQL}
       ORDER BY a.started_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        attempts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2b. GET /api/v1/attempts/quiz/:quizId - Teacher attempt breakdown (STATIC ROUTE MUST PRECEDE /:id)
// -------------------------------------------------------------
router.get('/quiz/:quizId', authenticateToken, requireRole('TEACHER', 'CREATOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const quiz = await dbGet(`SELECT id, title, creator_id FROM quizzes WHERE id = ?`, [quizId]);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found' }
      });
    }

    // Verify creator ownership (or super admin)
    if (quiz.creator_id !== req.user.id && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'You can only view attempts for quizzes you authored' }
      });
    }

    const countRow = await dbGet(
      `SELECT COUNT(*) as total FROM quiz_attempts WHERE quiz_id = ? AND status = 'COMPLETED'`,
      [quizId]
    );
    const total = countRow?.total || 0;

    const attempts = await dbAll(
      `SELECT 
        a.id,
        a.user_id,
        u.name as student_name,
        u.email as student_email,
        a.score,
        a.max_score,
        a.score_percentage,
        a.is_passed,
        a.total_questions,
        a.correct_answers,
        a.incorrect_answers,
        a.time_taken_sec,
        a.started_at,
        a.submitted_at,
        a.warning_count,
        a.is_flagged,
        a.flag_reason
       FROM quiz_attempts a
       JOIN users u ON a.user_id = u.id
       WHERE a.quiz_id = ? AND a.status = 'COMPLETED'
       ORDER BY a.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [quizId, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        quiz: { id: quiz.id, title: quiz.title },
        attempts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. GET /api/v1/attempts/:id - Get in-progress attempt state
// -------------------------------------------------------------
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const attempt = await dbGet(`SELECT * FROM quiz_attempts WHERE id = ?`, [id]);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Attempt not found' }
      });
    }

    // Verify ownership
    if (attempt.user_id !== userId && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Unauthorized to access this quiz attempt' }
      });
    }

    // Check expiration if IN_PROGRESS
    if (attempt.status === 'IN_PROGRESS' && attempt.expires_at) {
      if (new Date() > new Date(attempt.expires_at)) {
        await dbRun(`UPDATE quiz_attempts SET status = 'EXPIRED' WHERE id = ?`, [id]);
        attempt.status = 'EXPIRED';
      }
    }

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [attempt.quiz_id]);
    const { questions } = await getQuizVersionQuestions(attempt.quiz_id, attempt.quiz_version);
    const savedAnswers = await dbAll(
      `SELECT question_id, user_answer FROM attempt_answers WHERE attempt_id = ?`,
      [id]
    );

    const answersMap = {};
    savedAnswers.forEach(a => {
      answersMap[a.question_id] = a.user_answer;
    });

    const remainingSeconds = attempt.expires_at && attempt.status === 'IN_PROGRESS'
      ? Math.max(0, Math.round((new Date(attempt.expires_at) - new Date()) / 1000))
      : 0;

    res.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          quizId: attempt.quiz_id,
          status: attempt.status,
          startedAt: attempt.started_at,
          expiresAt: attempt.expires_at,
          submittedAt: attempt.submitted_at,
          score: attempt.score,
          maxScore: attempt.max_score,
          scorePercentage: attempt.score_percentage,
          isPassed: attempt.is_passed === 1,
          totalQuestions: attempt.total_questions,
          correctAnswers: attempt.correct_answers,
          incorrectAnswers: attempt.incorrect_answers,
          remainingSeconds,
          warningCount: attempt.warning_count || 0,
          isFlagged: attempt.is_flagged === 1,
          flagReason: attempt.flag_reason || ''
        },
        quiz: {
          id: quiz?.id,
          title: quiz?.title,
          description: quiz?.description,
          category: quiz?.category,
          difficulty: quiz?.difficulty,
          time_limit_sec: attempt.time_limit_sec,
          pass_percentage: quiz?.passing_percentage ?? quiz?.pass_percentage ?? 60
        },
        questions: maskQuestionsForAttempt(questions),
        savedAnswers: answersMap
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/attempts/:id/violation - Record fullscreen exit or tab switch violation
// -------------------------------------------------------------
router.post('/:id/violation', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { type = 'TAB_SWITCH', details = '' } = req.body;

    const attempt = await dbGet(`SELECT * FROM quiz_attempts WHERE id = ?`, [id]);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Attempt not found' }
      });
    }

    if (attempt.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Unauthorized' }
      });
    }

    // Only process violations while in progress
    if (attempt.status !== 'IN_PROGRESS') {
      return res.json({
        success: true,
        data: {
          warningCount: attempt.warning_count || 0,
          isFlagged: attempt.is_flagged === 1,
          status: 'IGNORED_NOT_ACTIVE'
        }
      });
    }

    const currentWarnings = attempt.warning_count || 0;
    const newWarnings = currentWarnings + 1;
    let isFlagged = attempt.is_flagged === 1;
    let flagReason = attempt.flag_reason || '';

    // First violation = WARNING (warningCount = 1, isFlagged = false)
    // Second or subsequent violation = FLAGGED (warningCount >= 2, isFlagged = true)
    if (newWarnings >= 2) {
      isFlagged = true;
      flagReason = `Multiple test window violations (${type}: tab switch / fullscreen exit)`;
    }

    let violations = [];
    try {
      violations = JSON.parse(attempt.violations_log || '[]');
    } catch (e) {
      violations = [];
    }
    violations.push({
      type,
      details,
      timestamp: new Date().toISOString(),
      action: newWarnings >= 2 ? 'FLAG' : 'WARNING'
    });

    await dbRun(
      `UPDATE quiz_attempts 
       SET warning_count = ?, is_flagged = ?, flag_reason = ?, violations_log = ?
       WHERE id = ?`,
      [newWarnings, isFlagged ? 1 : 0, flagReason, JSON.stringify(violations), id]
    );

    res.json({
      success: true,
      action: newWarnings >= 2 ? 'FLAG' : 'WARNING',
      warningCount: newWarnings,
      isFlagged,
      flagReason,
      data: {
        warningCount: newWarnings,
        isFlagged,
        flagReason,
        action: newWarnings >= 2 ? 'FLAG' : 'WARNING',
        message: newWarnings === 1
          ? 'Warning: Fullscreen exit or tab switch detected. Next infraction will be flagged.'
          : 'Flagged: Multiple violations recorded. Your teacher has been notified.'
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. PUT /api/v1/attempts/:id/answers - Autosave user answers
// -------------------------------------------------------------
router.put('/:id/answers', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { answers } = req.body; // Can be array [{ questionId, answer }] or { questionId, answer }

    const attempt = await dbGet(`SELECT * FROM quiz_attempts WHERE id = ?`, [id]);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Attempt not found' }
      });
    }

    if (attempt.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Unauthorized to modify this attempt' }
      });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ERR_ATTEMPT_NOT_ACTIVE',
          message: `Cannot save answers. Attempt status is already ${attempt.status}`
        }
      });
    }

    // Check expiration
    if (attempt.expires_at && new Date() > new Date(attempt.expires_at)) {
      await dbRun(`UPDATE quiz_attempts SET status = 'EXPIRED' WHERE id = ?`, [id]);
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_ATTEMPT_EXPIRED', message: 'Time limit for this quiz has expired.' }
      });
    }

    const answersList = Array.isArray(answers) ? answers : [answers];

    for (const item of answersList) {
      if (!item || !item.questionId) continue;
      const questionId = item.questionId;
      const serializedAnswer = typeof item.answer === 'object'
        ? JSON.stringify(item.answer)
        : String(item.answer ?? '');

      // Upsert answer
      const existing = await dbGet(
        `SELECT id FROM attempt_answers WHERE attempt_id = ? AND question_id = ?`,
        [id, questionId]
      );

      if (existing) {
        await dbRun(
          `UPDATE attempt_answers SET user_answer = ?, saved_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [serializedAnswer, existing.id]
        );
      } else {
        await dbRun(
          `INSERT INTO attempt_answers (id, attempt_id, question_id, question_type, user_answer)
           VALUES (?, ?, ?, 'UNKNOWN', ?)`,
          [generateUUID(), id, questionId, serializedAnswer]
        );
      }
    }

    res.json({
      success: true,
      data: { message: 'Answers saved successfully', savedAt: new Date().toISOString() }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. POST /api/v1/attempts/:id/submit - Authoritative Backend Scoring
// -------------------------------------------------------------
router.post('/:id/submit', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { answers, idempotencyKey } = req.body;

    const attempt = await dbGet(`SELECT * FROM quiz_attempts WHERE id = ?`, [id]);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Attempt not found' }
      });
    }

    if (attempt.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Unauthorized' }
      });
    }

    // Idempotency check: If already completed and matching idempotencyKey or already submitted
    if (attempt.status === 'COMPLETED') {
      return res.json({
        success: true,
        data: {
          message: 'Quiz attempt already completed',
          alreadyCompleted: true,
          score: attempt.score,
          maxScore: attempt.max_score,
          scorePercentage: attempt.score_percentage,
          isPassed: attempt.is_passed === 1
        }
      });
    }

    // If answers provided in submission payload, persist them first
    if (Array.isArray(answers)) {
      for (const item of answers) {
        if (!item || !item.questionId) continue;
        const serialized = typeof item.answer === 'object'
          ? JSON.stringify(item.answer)
          : String(item.answer ?? '');

        const existing = await dbGet(
          `SELECT id FROM attempt_answers WHERE attempt_id = ? AND question_id = ?`,
          [id, item.questionId]
        );
        if (existing) {
          await dbRun(`UPDATE attempt_answers SET user_answer = ? WHERE id = ?`, [serialized, existing.id]);
        } else {
          await dbRun(
            `INSERT INTO attempt_answers (id, attempt_id, question_id, question_type, user_answer) VALUES (?, ?, ?, 'UNKNOWN', ?)`,
            [generateUUID(), id, item.questionId, serialized]
          );
        }
      }
    }

    // Fetch snapshot questions and quiz details
    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [attempt.quiz_id]);
    const { questions } = await getQuizVersionQuestions(attempt.quiz_id, attempt.quiz_version);

    // Fetch all saved user answers
    const userAnswers = await dbAll(`SELECT * FROM attempt_answers WHERE attempt_id = ?`, [id]);
    const answerMap = {};
    userAnswers.forEach(a => {
      answerMap[a.question_id] = a;
    });

    let totalEarnedScore = 0;
    let totalMaxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const evaluatedDetails = [];
    const mistakesToRecord = [];

    // Evaluate each question authoritatively using shared scoring engine
    for (const q of questions) {
      const qMarks = Number(q.marks) || 1;
      totalMaxScore += qMarks;

      const userAnsObj = answerMap[q.id];
      const rawUserAns = userAnsObj ? userAnsObj.user_answer : '';
      const hasAnswer = rawUserAns !== undefined && rawUserAns !== null && String(rawUserAns).trim() !== '';

      const evalResult = evaluateQuestionAnswer(q, rawUserAns);
      const isCorrect = evalResult.isCorrect;
      const earnedScore = evalResult.earnedScore;
      const notes = evalResult.notes;
      const correctAnswerDisplay = evalResult.correctAnswerDisplay;
      const displayUserAnswer = evalResult.userAnswerDisplay;

      if (!hasAnswer) {
        unansweredCount++;
      } else {
        if (isCorrect === 1) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }

      totalEarnedScore += earnedScore;

      // Update attempt_answers record
      if (userAnsObj) {
        await dbRun(
          `UPDATE attempt_answers SET 
            question_type = ?, 
            is_correct = ?, 
            earned_score = ?, 
            max_marks = ?, 
            is_evaluated = 1, 
            evaluation_notes = ?
           WHERE id = ?`,
          [q.question_type, isCorrect, earnedScore, qMarks, notes, userAnsObj.id]
        );
      } else {
        await dbRun(
          `INSERT INTO attempt_answers (
            id, attempt_id, question_id, question_type, user_answer, is_correct, earned_score, max_marks, is_evaluated, evaluation_notes
          ) VALUES (?, ?, ?, ?, '', ?, ?, ?, 1, ?)`,
          [generateUUID(), id, q.id, q.question_type, isCorrect, earnedScore, qMarks, notes]
        );
      }

      // If answered incorrectly, record in Mistake Notebook
      if (isCorrect === 0 && hasAnswer) {
        mistakesToRecord.push({
          userId,
          attemptId: id,
          quizId: attempt.quiz_id,
          questionId: q.id,
          quizTitle: quiz?.title || 'Quiz',
          questionText: q.question_text,
          questionType: q.question_type,
          subject: quiz?.category || 'General',
          userAnswer: displayUserAnswer,
          correctAnswer: correctAnswerDisplay,
          explanation: q.explanation || ''
        });
      }

      evaluatedDetails.push({
        questionId: q.id,
        isCorrect,
        earnedScore,
        maxMarks: qMarks
      });
    }

    // Calculate percentage and pass status
    const scorePercentage = totalMaxScore > 0
      ? Math.round((totalEarnedScore / totalMaxScore) * 10000) / 100
      : 0;
    const passThreshold = quiz?.passing_percentage ?? quiz?.pass_percentage ?? 50;
    const isPassed = scorePercentage >= passThreshold ? 1 : 0;

    const submittedAt = new Date();
    const startedAt = new Date(attempt.started_at);
    const timeTakenSec = Math.max(0, Math.round((submittedAt - startedAt) / 1000));

    // Update quiz_attempts to COMPLETED
    await dbRun(
      `UPDATE quiz_attempts SET 
        status = 'COMPLETED',
        score = ?,
        max_score = ?,
        score_percentage = ?,
        is_passed = ?,
        correct_answers = ?,
        incorrect_answers = ?,
        unanswered_count = ?,
        submitted_at = ?,
        time_taken_sec = ?,
        idempotency_key = ?
       WHERE id = ?`,
      [
        totalEarnedScore,
        totalMaxScore,
        scorePercentage,
        isPassed,
        correctCount,
        incorrectCount,
        unansweredCount,
        submittedAt.toISOString(),
        timeTakenSec,
        idempotencyKey || generateUUID(),
        id
      ]
    );

    // Save mistakes to Mistake Notebook
    for (const m of mistakesToRecord) {
      const existingMistake = await dbGet(
        `SELECT id, mistake_count FROM mistake_notebook WHERE user_id = ? AND question_id = ?`,
        [m.userId, m.questionId]
      );

      if (existingMistake) {
        await dbRun(
          `UPDATE mistake_notebook SET 
            attempt_id = ?, 
            user_answer = ?, 
            correct_answer = ?, 
            explanation = ?, 
            is_resolved = 0, 
            mistake_count = mistake_count + 1,
            reviewed_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [m.attemptId, m.userAnswer, m.correctAnswer, m.explanation, existingMistake.id]
        );
      } else {
        await dbRun(
          `INSERT INTO mistake_notebook (
            id, user_id, attempt_id, quiz_id, question_id, quiz_title, 
            question_text, question_type, subject, user_answer, correct_answer, explanation
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateUUID(),
            m.userId,
            m.attemptId,
            m.quizId,
            m.questionId,
            m.quizTitle,
            m.questionText,
            m.questionType,
            m.subject,
            m.userAnswer,
            m.correctAnswer,
            m.explanation
          ]
        );
      }
    }

    // Update Assignment Recipient status if this attempt was part of an assignment
    if (attempt.recipient_id || attempt.assignment_id) {
      const recipId = attempt.recipient_id;
      let assignment = null;
      if (attempt.assignment_id) {
        assignment = await dbGet(`SELECT due_date, allow_late FROM assignments WHERE id = ?`, [attempt.assignment_id]);
      }
      const isLate = assignment?.due_date && new Date(assignment.due_date) < submittedAt;

      if (recipId) {
        await dbRun(`
          UPDATE assignment_recipients
          SET status = ?, score = ?, is_passed = ?, submitted_at = ?, attempt_id = ?
          WHERE id = ?
        `, [isLate ? 'LATE' : 'SUBMITTED', totalEarnedScore, isPassed, submittedAt.toISOString(), id, recipId]);
      } else if (attempt.assignment_id) {
        await dbRun(`
          UPDATE assignment_recipients
          SET status = ?, score = ?, is_passed = ?, submitted_at = ?, attempt_id = ?
          WHERE assignment_id = ? AND student_id = ?
        `, [isLate ? 'LATE' : 'SUBMITTED', totalEarnedScore, isPassed, submittedAt.toISOString(), id, attempt.assignment_id, userId]);
      }
    }

    res.json({
      success: true,
      data: {
        attemptId: id,
        quizId: attempt.quiz_id,
        status: 'COMPLETED',
        score: totalEarnedScore,
        maxScore: totalMaxScore,
        scorePercentage,
        isPassed: isPassed === 1,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        unansweredCount,
        timeTakenSec,
        submittedAt: submittedAt.toISOString(),
        showExplanations: quiz?.show_explanations || 'AFTER_SUBMIT',
        warningCount: attempt.warning_count || 0,
        isFlagged: attempt.is_flagged === 1,
        flagReason: attempt.flag_reason || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 5. GET /api/v1/attempts/:id/summary - Result breakdown & review
// -------------------------------------------------------------
router.get('/:id/summary', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const attempt = await dbGet(`SELECT * FROM quiz_attempts WHERE id = ?`, [id]);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Attempt not found' }
      });
    }

    // Verify access
    if (attempt.user_id !== userId && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEACHER') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Unauthorized access to this result summary' }
      });
    }

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [attempt.quiz_id]);
    const { questions } = await getQuizVersionQuestions(attempt.quiz_id, attempt.quiz_version);
    const answers = await dbAll(`SELECT * FROM attempt_answers WHERE attempt_id = ?`, [id]);
    const answerMap = {};
    answers.forEach(a => {
      answerMap[a.question_id] = a;
    });

    const showExplanations = quiz?.show_explanations || 'AFTER_SUBMIT';
    const canSeeExplanations = showExplanations === 'ALWAYS' || showExplanations === 'AFTER_SUBMIT';

    const reviewQuestions = questions.map(q => {
      const userAns = answerMap[q.id];
      const isCorrect = userAns ? userAns.is_correct === 1 : false;
      const earnedScore = userAns ? userAns.earned_score : 0;
      const rawUserAns = userAns ? userAns.user_answer : '';

      const reviewItem = {
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        marks: q.marks,
        earned_score: earnedScore,
        is_correct: isCorrect,
        user_answer: rawUserAns,
        unanswered: !rawUserAns
      };

      if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type)) {
        reviewItem.options = (q.options || []).map(opt => ({
          id: opt.id,
          option_key: opt.option_key,
          option_text: opt.option_text,
          is_correct: canSeeExplanations ? opt.is_correct : undefined
        }));
      }

      if (canSeeExplanations) {
        reviewItem.explanation = q.explanation || '';
        reviewItem.correct_answer = formatCorrectAnswer(q);
      }

      return reviewItem;
    });

    res.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          quizId: attempt.quiz_id,
          status: attempt.status,
          score: attempt.score,
          maxScore: attempt.max_score,
          scorePercentage: attempt.score_percentage,
          isPassed: attempt.is_passed === 1,
          totalQuestions: attempt.total_questions,
          correctAnswers: attempt.correct_answers,
          incorrectAnswers: attempt.incorrect_answers,
          unansweredCount: attempt.unanswered_count,
          timeTakenSec: attempt.time_taken_sec,
          startedAt: attempt.started_at,
          submittedAt: attempt.submitted_at,
          warningCount: attempt.warning_count || 0,
          isFlagged: attempt.is_flagged === 1,
          flagReason: attempt.flag_reason || ''
        },
        quiz: {
          id: quiz?.id,
          title: quiz?.title,
          description: quiz?.description,
          category: quiz?.category,
          difficulty: quiz?.difficulty,
          pass_percentage: quiz?.passing_percentage ?? quiz?.pass_percentage ?? 60,
          show_explanations: showExplanations
        },
        reviewQuestions
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;