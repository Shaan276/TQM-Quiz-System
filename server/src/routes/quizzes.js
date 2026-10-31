const express = require('express');
const crypto = require('crypto');
const { dbRun, dbGet, dbAll } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { formatQuestionCode } = require('../utils/questionCode');

const router = express.Router();

// Helper to generate UUIDv4
function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

/**
 * GET /api/v1/quizzes/metrics/summary
 * Aggregate metrics for the Creator Dashboard
 */
router.get('/metrics/summary', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const totalRow = await dbGet(
      `SELECT COUNT(*) as count FROM quizzes WHERE creator_id = ? AND status != 'ARCHIVED'`,
      [userId]
    );
    const publishedRow = await dbGet(
      `SELECT COUNT(*) as count FROM quizzes WHERE creator_id = ? AND status = 'PUBLISHED'`,
      [userId]
    );
    const draftRow = await dbGet(
      `SELECT COUNT(*) as count FROM quizzes WHERE creator_id = ? AND status = 'DRAFT'`,
      [userId]
    );
    const bankRow = await dbGet(
      `SELECT COUNT(*) as count FROM question_bank WHERE creator_id = ?`,
      [userId]
    );
    const questionsRow = await dbGet(
      `SELECT COUNT(*) as count FROM questions q JOIN quizzes z ON q.quiz_id = z.id WHERE z.creator_id = ? AND z.status != 'ARCHIVED'`,
      [userId]
    );

    const recentQuizzes = await dbAll(
      `SELECT id, title, category, difficulty, status, version, updated_at 
       FROM quizzes 
       WHERE creator_id = ? AND status != 'ARCHIVED'
       ORDER BY updated_at DESC LIMIT 5`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        totalQuizzes: totalRow?.count || 0,
        publishedQuizzes: publishedRow?.count || 0,
        draftQuizzes: draftRow?.count || 0,
        totalQuestions: questionsRow?.count || 0,
        bankQuestionsCount: bankRow?.count || 0,
        recentQuizzes: recentQuizzes || []
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quizzes/subjects
 * Retrieve distinct subject names used by the creator and across published quizzes
 */
router.get('/subjects', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rows = await dbAll(
      `SELECT DISTINCT category FROM quizzes WHERE creator_id = ? AND category IS NOT NULL AND category != ''
       UNION
       SELECT DISTINCT category FROM question_bank WHERE creator_id = ? AND category IS NOT NULL AND category != ''
       UNION
       SELECT DISTINCT category FROM quizzes WHERE status = 'PUBLISHED' AND category IS NOT NULL AND category != ''`,
      [userId, userId]
    );

    const defaultSubjects = ['TQM (Total Quality Management)', 'Computer Science', 'Science', 'Mathematics', 'Engineering & Tech', 'General Knowledge'];
    const dbSubjects = rows.map(r => r.category).filter(Boolean);
    const combined = Array.from(new Set([...defaultSubjects, ...dbSubjects]));

    res.json({
      success: true,
      data: { subjects: combined }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quizzes/discover
 * Learner-facing quiz discovery endpoint for published, accessible quizzes.
 * Strips answers and explanations to prevent cheating.
 */
router.get('/discover', authenticateToken, async (req, res, next) => {
  try {
    const {
      search = '',
      category = '',
      difficulty = '',
      sort = 'newest',
      page = 1,
      limit = 12
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const params = [];
    let whereClauses = [`q.status = 'PUBLISHED'`, `q.visibility != 'PRIVATE'`];

    // Institutional access restriction: students in an organization only see quizzes assigned to them
    const isStudent = req.user.role === 'STUDENT' || req.user.role === 'LEARNER';
    let userOrgId = req.user.organization_id;
    if (!userOrgId) {
      const u = await dbGet(`SELECT organization_id FROM users WHERE id = ?`, [req.user.id]);
      userOrgId = u?.organization_id;
    }
    const hasEnrollment = await dbGet(`SELECT id FROM student_enrollments WHERE user_id = ? AND status = 'ACTIVE'`, [req.user.id]);
    if (isStudent && (userOrgId || hasEnrollment)) {
      whereClauses.push(`q.id IN (
        SELECT a.quiz_id FROM assignments a 
        JOIN assignment_recipients ar ON a.id = ar.assignment_id 
        WHERE ar.student_id = ? AND a.status = 'PUBLISHED'
      )`);
      params.push(req.user.id);
    }

    if (search.trim()) {
      whereClauses.push(`(q.title LIKE ? OR q.description LIKE ? OR u.name LIKE ?)`);
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category) {
      whereClauses.push(`q.category = ?`);
      params.push(category);
    }

    if (difficulty) {
      whereClauses.push(`q.difficulty = ?`);
      params.push(difficulty);
    }

    let orderBy = 'q.updated_at DESC';
    if (sort === 'oldest') orderBy = 'q.created_at ASC';
    if (sort === 'title_asc') orderBy = 'q.title COLLATE NOCASE ASC';
    if (sort === 'title_desc') orderBy = 'q.title COLLATE NOCASE DESC';
    if (sort === 'popular') orderBy = 'attempt_count DESC, q.updated_at DESC';

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await dbGet(
      `SELECT COUNT(*) as total 
       FROM quizzes q 
       JOIN users u ON q.creator_id = u.id 
       ${whereSQL}`, 
      params
    );
    const total = countRow?.total || 0;

    const quizzes = await dbAll(
      `SELECT 
        q.id,
        q.title,
        q.description,
        q.cover_image_url as cover_image,
        q.category,
        q.difficulty,
        q.time_limit_sec,
        q.passing_percentage as pass_percentage,
        q.shuffle_questions,
        q.shuffle_options,
        q.show_explanations,
        q.version,
        q.created_at,
        q.updated_at,
        u.name as creator_name,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COALESCE(SUM(marks), 0) FROM questions WHERE quiz_id = q.id) as total_marks,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND status = 'COMPLETED') as attempt_count
       FROM quizzes q
       JOIN users u ON q.creator_id = u.id
       ${whereSQL}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        quizzes,
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

/**
 * GET /api/v1/quizzes
 * List quizzes with search, filtering, and pagination
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      search = '',
      category = '',
      difficulty = '',
      status = '',
      sort = 'updated_desc',
      page = 1,
      limit = 10
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const params = [userId];
    let whereClauses = [`creator_id = ?`, `status != 'ARCHIVED'`];

    if (search.trim()) {
      whereClauses.push(`(title LIKE ? OR description LIKE ?)`);
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category) {
      whereClauses.push(`category = ?`);
      params.push(category);
    }

    if (difficulty) {
      whereClauses.push(`difficulty = ?`);
      params.push(difficulty);
    }

    if (status) {
      whereClauses.push(`status = ?`);
      params.push(status);
    }

    let orderBy = 'updated_at DESC';
    if (sort === 'created_desc') orderBy = 'created_at DESC';
    if (sort === 'created_asc') orderBy = 'created_at ASC';
    if (sort === 'title_asc') orderBy = 'title COLLATE NOCASE ASC';
    if (sort === 'title_desc') orderBy = 'title COLLATE NOCASE DESC';
    if (sort === 'updated_asc') orderBy = 'updated_at ASC';

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count query
    const countRow = await dbGet(`SELECT COUNT(*) as total FROM quizzes ${whereSQL}`, params);
    const total = countRow?.total || 0;

    // Data query with question counts and total marks
    const quizzes = await dbAll(
      `SELECT q.*, 
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
        (SELECT COALESCE(SUM(marks), 0) FROM questions WHERE quiz_id = q.id) as total_marks
       FROM quizzes q
       ${whereSQL}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        quizzes,
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

/**
 * POST /api/v1/quizzes
 * Create a new quiz header (default DRAFT)
 */
router.post('/', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      title = 'Untitled Quiz',
      description = '',
      category = 'General',
      difficulty = 'MEDIUM',
      tags = [],
      visibility = 'PUBLIC',
      timeLimitSec = 0,
      time_limit_sec = 0,
      passingPercentage = 60,
      pass_percentage = 60,
      showExplanations = 'AFTER_SUBMIT',
      show_explanations = 'AFTER_SUBMIT',
      shuffleQuestions = false,
      shuffle_questions = false,
      shuffleOptions = false,
      shuffle_options = false,
      negativeMarking = false,
      negative_marking = false,
      negativeMarksRatio = 0.25,
      negative_marks_ratio = 0.25,
      allowFlagging = true,
      allow_flagging = true,
      allowBacktrack = true,
      allow_backtrack = true,
      showCorrectAnswers = true,
      show_correct_answers = true,
      questions = null
    } = req.body;

    if (!title.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Quiz title cannot be empty.' }
      });
    }

    const quizId = generateUUID();
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    const effectiveTimeLimit = Math.max(0, parseInt(timeLimitSec || time_limit_sec) || 0);
    const effectivePassing = Math.min(100, Math.max(0, parseInt(passingPercentage || pass_percentage) || 60));
    const effectiveExplanations = ['ALWAYS', 'AFTER_SUBMIT', 'NEVER'].includes(showExplanations || show_explanations)
      ? (showExplanations || show_explanations)
      : 'AFTER_SUBMIT';

    await dbRun(
      `INSERT INTO quizzes (
        id, creator_id, title, description, category, difficulty, tags,
        status, visibility, time_limit_sec, passing_percentage, show_explanations,
        shuffle_questions, shuffle_options, negative_marking, negative_marks_ratio,
        allow_flagging, allow_backtrack, show_correct_answers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quizId,
        userId,
        title.trim(),
        description.trim(),
        category.trim() || 'General',
        ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
        tagsJson,
        visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
        effectiveTimeLimit,
        effectivePassing,
        effectiveExplanations,
        (shuffleQuestions || shuffle_questions) ? 1 : 0,
        (shuffleOptions || shuffle_options) ? 1 : 0,
        (negativeMarking || negative_marking) ? 1 : 0,
        parseFloat(negativeMarksRatio || negative_marks_ratio) || 0.25,
        (allowFlagging !== undefined ? allowFlagging : allow_flagging) ? 1 : 0,
        (allowBacktrack !== undefined ? allowBacktrack : allow_backtrack) ? 1 : 0,
        (showCorrectAnswers !== undefined ? showCorrectAnswers : show_correct_answers) ? 1 : 0
      ]
    );

    // If questions were provided in POST payload, insert them
    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qId = q.id || generateUUID();
        const qType = q.question_type || 'MCQ_SINGLE';
        const qMarks = Math.max(0.25, parseFloat(q.marks) || 1.0);
        const qTime = Math.max(5, parseInt(q.time_limit_sec) || 30);
        const qExplanation = q.explanation || '';
        const qSettings = JSON.stringify(q.settings || {});
        const qCode = q.question_code || formatQuestionCode(category, qType, difficulty, i + 1);

        await dbRun(
          `INSERT INTO questions (
            id, quiz_id, question_text, question_type, marks,
            time_limit_sec, explanation, sort_order, settings, question_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            qId, quizId, q.question_text || 'Untitled Question',
            qType, qMarks, qTime, qExplanation, i, qSettings, qCode
          ]
        );

        if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(qType) && Array.isArray(q.options)) {
          for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            const optId = opt.id || generateUUID();
            await dbRun(
              `INSERT INTO question_options (id, question_id, option_key, option_text, is_correct, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                optId, qId, opt.option_key || String.fromCharCode(65 + j),
                opt.option_text || '', opt.is_correct ? 1 : 0, j
              ]
            );
          }
        } else if (Array.isArray(q.answers)) {
          for (const ans of q.answers) {
            await dbRun(
              `INSERT INTO question_answers (id, question_id, expected_answer, is_case_sensitive, numeric_tolerance)
               VALUES (?, ?, ?, ?, ?)`,
              [
                generateUUID(), qId, ans.expected_answer || '',
                ans.is_case_sensitive ? 1 : 0, parseFloat(ans.numeric_tolerance) || 0.0
              ]
            );
          }
        }

        // Auto-sync question to question bank if requested
        if ((q.saveToBank === true || req.body.autoSaveQuestionsToBank === true) && q.question_text && q.question_text.trim()) {
          const bankQText = q.question_text.trim();
          const bankCat = (category || 'General').trim();
          const bankDiff = difficulty || 'MEDIUM';
          const payloadOptions = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(qType)
            ? (Array.isArray(q.options) ? q.options : [])
            : (Array.isArray(q.answers) ? q.answers : []);

          const existingBankQ = await dbGet(
            `SELECT id FROM question_bank WHERE creator_id = ? AND question_text = ? AND category = ?`,
            [userId, bankQText, bankCat]
          );

          if (!existingBankQ) {
            const bankId = generateUUID();
            await dbRun(
              `INSERT INTO question_bank (
                id, creator_id, title, question_text, question_type, category,
                difficulty, tags, marks, explanation, options_data, settings, question_code
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                bankId,
                userId,
                (qCode ? `[${qCode}] ` : '') + (q.title || bankQText.slice(0, 45) + (bankQText.length > 45 ? '...' : '')),
                bankQText,
                qType,
                bankCat,
                bankDiff,
                JSON.stringify([]),
                qMarks,
                qExplanation,
                JSON.stringify(payloadOptions),
                qSettings,
                qCode
              ]
            );
          } else {
            await dbRun(
              `UPDATE question_bank SET
                question_type = ?, marks = ?, explanation = ?, options_data = ?, settings = ?, question_code = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [
                qType,
                qMarks,
                qExplanation,
                JSON.stringify(payloadOptions),
                qSettings,
                qCode,
                existingBankQ.id
              ]
            );
          }
        }
      }
    }

    const created = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);

    res.status(201).json({
      success: true,
      data: { quiz: created }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quizzes/:id
 * Retrieve full quiz with questions, options, and answers
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz || quiz.status === 'ARCHIVED') {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found.' }
      });
    }

    // Access check: only creator or admin can view drafts; public published can be viewed by all
    if (quiz.creator_id !== userId && req.user.role !== 'ADMIN' && quiz.status !== 'PUBLISHED') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'You do not have permission to view this quiz.' }
      });
    }

    // Fetch questions
    const questions = await dbAll(
      `SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    // Fetch options & answers for each question
    const populatedQuestions = await Promise.all(
      questions.map(async (q) => {
        const options = await dbAll(
          `SELECT id, option_key, option_text, is_correct, sort_order 
           FROM question_options 
           WHERE question_id = ? 
           ORDER BY sort_order ASC`,
          [q.id]
        );

        const answers = await dbAll(
          `SELECT id, expected_answer, is_case_sensitive, numeric_tolerance 
           FROM question_answers 
           WHERE question_id = ?`,
          [q.id]
        );

        let parsedSettings = {};
        try {
          parsedSettings = JSON.parse(q.settings || '{}');
        } catch (e) {}

        const qCode = q.question_code || formatQuestionCode(quiz.category, q.question_type, quiz.difficulty, (q.sort_order || 0) + 1);

        return {
          ...q,
          question_code: qCode,
          settings: parsedSettings,
          options: options || [],
          answers: answers || []
        };
      })
    );

    let parsedTags = [];
    try {
      parsedTags = JSON.parse(quiz.tags || '[]');
    } catch (e) {}

    res.json({
      success: true,
      data: {
        quiz: {
          ...quiz,
          tags: parsedTags,
          questions: populatedQuestions
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/quizzes/:id
 * Autosave endpoint: updates metadata, settings, and questions atomically
 */
router.put('/:id', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!existing || existing.status === 'ARCHIVED') {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found.' }
      });
    }

    if (existing.creator_id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Not authorized to edit this quiz.' }
      });
    }

    const {
      title,
      description,
      category,
      difficulty,
      tags,
      visibility,
      timeLimitSec,
      passingPercentage,
      shuffleQuestions,
      shuffleOptions,
      negativeMarking,
      negativeMarksRatio,
      showExplanations,
      maxAttempts,
      allowFlagging,
      allow_flagging,
      allowBacktrack,
      allow_backtrack,
      showCorrectAnswers,
      show_correct_answers,
      questions = []
    } = req.body;

    // Update Quiz Header
    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedCat = category !== undefined ? category : existing.category;
    const updatedDiff = difficulty !== undefined ? difficulty : existing.difficulty;
    const updatedTags = tags !== undefined ? JSON.stringify(tags) : existing.tags;
    const updatedVis = visibility !== undefined ? visibility : existing.visibility;
    const updatedTimeLimit = timeLimitSec !== undefined ? parseInt(timeLimitSec) : existing.time_limit_sec;
    const updatedPass = passingPercentage !== undefined ? parseInt(passingPercentage) : existing.passing_percentage;
    const updatedShufQ = (shuffleQuestions !== undefined || req.body.shuffle_questions !== undefined)
      ? (shuffleQuestions || req.body.shuffle_questions ? 1 : 0)
      : existing.shuffle_questions;
    const updatedShufO = (shuffleOptions !== undefined || req.body.shuffle_options !== undefined)
      ? (shuffleOptions || req.body.shuffle_options ? 1 : 0)
      : existing.shuffle_options;
    const updatedNeg = (negativeMarking !== undefined || req.body.negative_marking !== undefined)
      ? (negativeMarking || req.body.negative_marking ? 1 : 0)
      : existing.negative_marking;
    const updatedNegRatio = (negativeMarksRatio !== undefined || req.body.negative_marks_ratio !== undefined)
      ? parseFloat(negativeMarksRatio || req.body.negative_marks_ratio)
      : existing.negative_marks_ratio;
    const updatedExp = showExplanations !== undefined ? showExplanations : existing.show_explanations;
    const updatedAttempts = maxAttempts !== undefined ? parseInt(maxAttempts) : existing.max_attempts;
    const updatedFlag = (allowFlagging !== undefined || allow_flagging !== undefined)
      ? (allowFlagging || allow_flagging ? 1 : 0)
      : (existing.allow_flagging !== undefined ? existing.allow_flagging : 1);
    const updatedBacktrack = (allowBacktrack !== undefined || allow_backtrack !== undefined)
      ? (allowBacktrack || allow_backtrack ? 1 : 0)
      : (existing.allow_backtrack !== undefined ? existing.allow_backtrack : 1);
    const updatedShowAnswers = (showCorrectAnswers !== undefined || show_correct_answers !== undefined)
      ? (showCorrectAnswers || show_correct_answers ? 1 : 0)
      : (existing.show_correct_answers !== undefined ? existing.show_correct_answers : 1);

    await dbRun(
      `UPDATE quizzes SET 
        title = ?, description = ?, category = ?, difficulty = ?, tags = ?,
        visibility = ?, time_limit_sec = ?, passing_percentage = ?,
        shuffle_questions = ?, shuffle_options = ?, negative_marking = ?,
        negative_marks_ratio = ?, show_explanations = ?, max_attempts = ?,
        allow_flagging = ?, allow_backtrack = ?, show_correct_answers = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updatedTitle, updatedDesc, updatedCat, updatedDiff, updatedTags,
        updatedVis, updatedTimeLimit, updatedPass, updatedShufQ, updatedShufO,
        updatedNeg, updatedNegRatio, updatedExp, updatedAttempts,
        updatedFlag, updatedBacktrack, updatedShowAnswers, id
      ]
    );

    // If questions are explicitly provided in payload, synchronize them atomically
    if (req.body.questions !== undefined && Array.isArray(req.body.questions)) {
      const questions = req.body.questions;
      // Delete existing questions & options (cascade deletes options and answers)
      await dbRun(`DELETE FROM questions WHERE quiz_id = ?`, [id]);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qId = q.id || generateUUID();
        const qType = q.question_type || 'MCQ_SINGLE';
        const qMarks = Math.max(0.25, parseFloat(q.marks) || 1.0);
        const qTime = Math.max(5, parseInt(q.time_limit_sec) || 30);
        const qExplanation = q.explanation || '';
        const qSettings = JSON.stringify(q.settings || {});

        const qCode = q.question_code || formatQuestionCode(updatedCat, qType, updatedDiff, i + 1);

        await dbRun(
          `INSERT INTO questions (
            id, quiz_id, question_text, question_type, marks,
            time_limit_sec, explanation, sort_order, settings, question_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            qId, id, q.question_text || 'Untitled Question',
            qType, qMarks, qTime, qExplanation, i, qSettings, qCode
          ]
        );

        // Options for MCQ / True-False
        if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(qType) && Array.isArray(q.options)) {
          for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            const optId = opt.id || generateUUID();
            await dbRun(
              `INSERT INTO question_options (
                id, question_id, option_key, option_text, is_correct, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                optId, qId, opt.option_key || String.fromCharCode(65 + j),
                opt.option_text || '', opt.is_correct ? 1 : 0, j
              ]
            );
          }
        }

        // Answers for Fill in Blank / Short Answer / Numerical
        if (['FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL'].includes(qType) && Array.isArray(q.answers)) {
          for (const ans of q.answers) {
            const ansId = ans.id || generateUUID();
            await dbRun(
              `INSERT INTO question_answers (
                id, question_id, expected_answer, is_case_sensitive, numeric_tolerance
              ) VALUES (?, ?, ?, ?, ?)`,
              [
                ansId, qId, String(ans.expected_answer || ''),
                ans.is_case_sensitive ? 1 : 0,
                parseFloat(ans.numeric_tolerance) || 0.0
              ]
            );
          }
        }

        // Auto-sync question to question bank if requested
        if ((q.saveToBank === true || req.body.autoSaveQuestionsToBank === true) && q.question_text && q.question_text.trim()) {
          const bankQText = q.question_text.trim();
          const bankCat = (updatedCat || existing.category || 'General').trim();
          const bankDiff = updatedDiff || existing.difficulty || 'MEDIUM';
          const payloadOptions = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(qType)
            ? (Array.isArray(q.options) ? q.options : [])
            : (Array.isArray(q.answers) ? q.answers : []);

          const existingBankQ = await dbGet(
            `SELECT id FROM question_bank WHERE creator_id = ? AND question_text = ? AND category = ?`,
            [userId, bankQText, bankCat]
          );

          if (!existingBankQ) {
            const bankId = generateUUID();
            await dbRun(
              `INSERT INTO question_bank (
                id, creator_id, title, question_text, question_type, category,
                difficulty, tags, marks, explanation, options_data, settings, question_code
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                bankId,
                userId,
                (qCode ? `[${qCode}] ` : '') + (q.title || bankQText.slice(0, 45) + (bankQText.length > 45 ? '...' : '')),
                bankQText,
                qType,
                bankCat,
                bankDiff,
                JSON.stringify([]),
                qMarks,
                qExplanation,
                JSON.stringify(payloadOptions),
                qSettings,
                qCode
              ]
            );
          } else {
            await dbRun(
              `UPDATE question_bank SET
                question_type = ?, marks = ?, explanation = ?, options_data = ?, settings = ?, question_code = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [
                qType,
                qMarks,
                qExplanation,
                JSON.stringify(payloadOptions),
                qSettings,
                qCode,
                existingBankQ.id
              ]
            );
          }
        }
      }
    }

    const updated = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: {
        quiz: updated,
        savedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quizzes/:id/publish
 * Validate and publish quiz; creates version snapshot
 */
router.post('/:id/publish', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz || quiz.status === 'ARCHIVED') {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found.' }
      });
    }

    if (quiz.creator_id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Not authorized to publish this quiz.' }
      });
    }

    // Poka-Yoke Quality Checks:
    const questions = await dbAll(
      `SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC`,
      [id]
    );

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ERR_EMPTY_QUIZ',
          message: 'Cannot publish a quiz with 0 questions. Please add at least one question.'
        }
      });
    }

    // Verify each question has at least one valid correct answer
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text || !q.question_text.trim()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ERR_INVALID_QUESTION_TEXT',
            message: `Question #${i + 1} has empty question text.`
          }
        });
      }

      if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type)) {
        const options = await dbAll(
          `SELECT * FROM question_options WHERE question_id = ?`,
          [q.id]
        );
        if (options.length < 2) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'ERR_INSUFFICIENT_OPTIONS',
              message: `Question #${i + 1} (${q.question_type}) must contain at least 2 answer options.`
            }
          });
        }
        const correctCount = options.filter(o => o.is_correct === 1).length;
        if (correctCount === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'ERR_NO_CORRECT_OPTION',
              message: `Question #${i + 1} does not have any marked correct answer.`
            }
          });
        }
        if (q.question_type === 'MCQ_SINGLE' && correctCount > 1) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'ERR_MULTIPLE_CORRECT_SINGLE',
              message: `Single-choice Question #${i + 1} must have exactly one correct answer.`
            }
          });
        }
      } else {
        const answers = await dbAll(
          `SELECT * FROM question_answers WHERE question_id = ?`,
          [q.id]
        );
        if (answers.length === 0 || !answers.some(a => a.expected_answer.trim().length > 0)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'ERR_MISSING_ANSWER',
              message: `Question #${i + 1} (${q.question_type}) requires at least one accepted answer.`
            }
          });
        }
      }
    }

    // Versioning snapshot:
    const newVersion = (quiz.version || 1) + 1;
    const fullQuizData = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    const fullQuestions = await dbAll(`SELECT * FROM questions WHERE quiz_id = ?`, [id]);
    const populated = await Promise.all(
      fullQuestions.map(async (q) => {
        const opts = await dbAll(`SELECT * FROM question_options WHERE question_id = ?`, [q.id]);
        const ans = await dbAll(`SELECT * FROM question_answers WHERE question_id = ?`, [q.id]);
        return { ...q, options: opts, answers: ans };
      })
    );

    const snapshot = JSON.stringify({
      quiz: fullQuizData,
      questions: populated,
      snapshotTimestamp: new Date().toISOString()
    });

    const versionId = generateUUID();
    await dbRun(
      `INSERT INTO quiz_versions (
        id, quiz_id, version, title, snapshot_data, published_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [versionId, id, newVersion, quiz.title, snapshot, userId]
    );

    await dbRun(
      `UPDATE quizzes SET 
        status = 'PUBLISHED', 
        version = ?, 
        published_version = ?, 
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newVersion, newVersion, id]
    );

    res.json({
      success: true,
      data: {
        message: 'Quiz successfully published!',
        version: newVersion,
        status: 'PUBLISHED'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quizzes/:id/unpublish
 * Revert quiz to DRAFT status
 */
router.post('/:id/unpublish', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found.' }
      });
    }

    if (quiz.creator_id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Not authorized.' }
      });
    }

    await dbRun(
      `UPDATE quizzes SET status = 'DRAFT', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        message: 'Quiz reverted to DRAFT status.',
        status: 'DRAFT'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quizzes/:id/duplicate
 * Deep copy quiz, questions, options, and answers
 */
router.post('/:id/duplicate', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const original = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!original || original.status === 'ARCHIVED') {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Original quiz not found.' }
      });
    }

    const newQuizId = generateUUID();
    const newTitle = `Copy of ${original.title}`;

    await dbRun(
      `INSERT INTO quizzes (
        id, creator_id, title, description, category, difficulty, tags,
        status, visibility, time_limit_sec, passing_percentage,
        shuffle_questions, shuffle_options, negative_marking,
        negative_marks_ratio, show_explanations, max_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newQuizId, userId, newTitle, original.description, original.category,
        original.difficulty, original.tags, original.visibility,
        original.time_limit_sec, original.passing_percentage,
        original.shuffle_questions, original.shuffle_options,
        original.negative_marking, original.negative_marks_ratio,
        original.show_explanations, original.max_attempts
      ]
    );

    // Deep copy questions
    const questions = await dbAll(`SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC`, [id]);
    for (const q of questions) {
      const newQId = generateUUID();
      await dbRun(
        `INSERT INTO questions (
          id, quiz_id, question_text, question_type, marks,
          time_limit_sec, explanation, sort_order, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newQId, newQuizId, q.question_text, q.question_type, q.marks, q.time_limit_sec, q.explanation, q.sort_order, q.settings]
      );

      // Copy options
      const options = await dbAll(`SELECT * FROM question_options WHERE question_id = ?`, [q.id]);
      for (const opt of options) {
        await dbRun(
          `INSERT INTO question_options (
            id, question_id, option_key, option_text, is_correct, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [generateUUID(), newQId, opt.option_key, opt.option_text, opt.is_correct, opt.sort_order]
        );
      }

      // Copy answers
      const answers = await dbAll(`SELECT * FROM question_answers WHERE question_id = ?`, [q.id]);
      for (const ans of answers) {
        await dbRun(
          `INSERT INTO question_answers (
            id, question_id, expected_answer, is_case_sensitive, numeric_tolerance
          ) VALUES (?, ?, ?, ?, ?)`,
          [generateUUID(), newQId, ans.expected_answer, ans.is_case_sensitive, ans.numeric_tolerance]
        );
      }
    }

    const duplicated = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [newQuizId]);

    res.status(201).json({
      success: true,
      data: {
        message: 'Quiz duplicated successfully.',
        quiz: duplicated
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/quizzes/:id
 * Delete quiz (or soft delete)
 */
router.delete('/:id', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found.' }
      });
    }

    if (quiz.creator_id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Not authorized to delete this quiz.' }
      });
    }

    await dbRun(`DELETE FROM quizzes WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: { message: 'Quiz deleted successfully.' }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quizzes/:id/preview
 * Preview mode: returns full questions for learner simulation without recording attempts
 */
router.get('/:id/preview', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    if (!quiz || quiz.status === 'ARCHIVED') {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz not found.' }
      });
    }

    const questions = await dbAll(
      `SELECT id, question_text, question_type, marks, time_limit_sec, explanation, sort_order, settings 
       FROM questions 
       WHERE quiz_id = ? 
       ORDER BY sort_order ASC`,
      [id]
    );

    const previewQuestions = await Promise.all(
      questions.map(async (q) => {
        const options = await dbAll(
          `SELECT id, option_key, option_text, is_correct, sort_order 
           FROM question_options 
           WHERE question_id = ? 
           ORDER BY sort_order ASC`,
          [q.id]
        );

        const answers = await dbAll(
          `SELECT id, expected_answer, is_case_sensitive, numeric_tolerance 
           FROM question_answers 
           WHERE question_id = ?`,
          [q.id]
        );

        let parsedSettings = {};
        try {
          parsedSettings = JSON.parse(q.settings || '{}');
        } catch (e) {}

        const qCode = q.question_code || formatQuestionCode(quiz.category, q.question_type, quiz.difficulty, (q.sort_order || 0) + 1);

        return {
          ...q,
          question_code: qCode,
          settings: parsedSettings,
          options: options || [],
          answers: answers || []
        };
      })
    );

    res.json({
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          category: quiz.category,
          difficulty: quiz.difficulty,
          timeLimitSec: quiz.time_limit_sec,
          passingPercentage: quiz.passing_percentage,
          shuffleQuestions: quiz.shuffle_questions,
          shuffleOptions: quiz.shuffle_options,
          negativeMarking: quiz.negative_marking,
          negativeMarksRatio: quiz.negative_marks_ratio,
          showExplanations: quiz.show_explanations,
          version: quiz.version,
          totalQuestions: previewQuestions.length,
          totalMarks: previewQuestions.reduce((acc, q) => acc + (q.marks || 1), 0),
          questions: previewQuestions
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quizzes/:id/import-from-quiz
 * Import whole quiz questions or selected questions into this quiz
 */
router.post('/:id/import-from-quiz', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id: targetQuizId } = req.params;
    const { sourceQuizId, questionIds } = req.body;
    const userId = req.user.id;

    // Validate target quiz ownership
    const target = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [targetQuizId]);
    if (!target || (target.creator_id !== userId && req.user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Target quiz not accessible.' }
      });
    }

    // Validate source quiz
    const source = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [sourceQuizId]);
    if (!source) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Source quiz not found.' }
      });
    }

    // Query questions to copy
    let questionsToCopy = [];
    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const placeholders = questionIds.map(() => '?').join(',');
      questionsToCopy = await dbAll(
        `SELECT * FROM questions WHERE quiz_id = ? AND id IN (${placeholders}) ORDER BY sort_order ASC`,
        [sourceQuizId, ...questionIds]
      );
    } else {
      // Whole quiz import!
      questionsToCopy = await dbAll(
        `SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC`,
        [sourceQuizId]
      );
    }

    const sortRow = await dbGet(
      `SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM questions WHERE quiz_id = ?`,
      [targetQuizId]
    );
    let nextSort = (sortRow?.max_sort || 0) + 1;

    for (const q of questionsToCopy) {
      const newQId = generateUUID();
      await dbRun(
        `INSERT INTO questions (
          id, quiz_id, question_text, question_type, marks,
          time_limit_sec, explanation, sort_order, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newQId, targetQuizId, q.question_text, q.question_type, q.marks, q.time_limit_sec, q.explanation, nextSort++, q.settings]
      );

      // Copy options
      const options = await dbAll(`SELECT * FROM question_options WHERE question_id = ?`, [q.id]);
      for (const opt of options) {
        await dbRun(
          `INSERT INTO question_options (
            id, question_id, option_key, option_text, is_correct, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [generateUUID(), newQId, opt.option_key, opt.option_text, opt.is_correct, opt.sort_order]
        );
      }

      // Copy answers
      const answers = await dbAll(`SELECT * FROM question_answers WHERE question_id = ?`, [q.id]);
      for (const ans of answers) {
        await dbRun(
          `INSERT INTO question_answers (
            id, question_id, expected_answer, is_case_sensitive, numeric_tolerance
          ) VALUES (?, ?, ?, ?, ?)`,
          [generateUUID(), newQId, ans.expected_answer, ans.is_case_sensitive, ans.numeric_tolerance]
        );
      }
    }

    res.status(201).json({
      success: true,
      data: {
        message: `Successfully imported ${questionsToCopy.length} question(s) from "${source.title}".`,
        importedCount: questionsToCopy.length
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
