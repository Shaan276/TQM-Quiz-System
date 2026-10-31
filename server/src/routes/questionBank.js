const express = require('express');
const crypto = require('crypto');
const { dbRun, dbGet, dbAll } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { formatQuestionCode } = require('../utils/questionCode');

const router = express.Router();

function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

/**
 * GET /api/v1/question-bank
 * List questions in Question Bank with search & filters
 */
router.get('/', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      search = '',
      category = '',
      difficulty = '',
      type = '',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const params = [userId];
    let whereClauses = [`creator_id = ?`];

    if (search.trim()) {
      whereClauses.push(`(title LIKE ? OR question_text LIKE ? OR question_code LIKE ?)`);
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category) {
      whereClauses.push(`category = ?`);
      params.push(category);
    }

    if (difficulty) {
      whereClauses.push(`difficulty = ?`);
      params.push(difficulty);
    }

    if (type) {
      whereClauses.push(`question_type = ?`);
      params.push(type);
    }

    const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

    const countRow = await dbGet(`SELECT COUNT(*) as total FROM question_bank ${whereSQL}`, params);
    const total = countRow?.total || 0;

    const questions = await dbAll(
      `SELECT * FROM question_bank 
       ${whereSQL} 
       ORDER BY updated_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const formatted = questions.map(q => {
      let optionsData = [];
      let settings = {};
      let tags = [];
      try { optionsData = JSON.parse(q.options_data || '[]'); } catch (e) {}
      try { settings = JSON.parse(q.settings || '{}'); } catch (e) {}
      try { tags = JSON.parse(q.tags || '[]'); } catch (e) {}

      return {
        ...q,
        tags,
        options_data: optionsData,
        settings
      };
    });

    res.json({
      success: true,
      data: {
        questions: formatted,
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
 * POST /api/v1/question-bank
 * Create a new question directly into the Question Bank
 */
router.post('/', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      title = 'Question',
      question_text,
      question_type = 'MCQ_SINGLE',
      category = 'General',
      difficulty = 'MEDIUM',
      tags = [],
      marks = 1.0,
      explanation = '',
      options_data = [],
      settings = {},
      question_code = null
    } = req.body;

    if (!question_text || !question_text.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Question text is required.' }
      });
    }

    const finalCode = (question_code && question_code.trim())
      ? question_code.trim()
      : formatQuestionCode(category, question_type, difficulty, 1);

    // Check if duplicate question already exists in this category for this creator
    const existing = await dbGet(
      `SELECT * FROM question_bank WHERE creator_id = ? AND question_text = ? AND category = ?`,
      [userId, question_text.trim(), category]
    );

    if (existing) {
      await dbRun(
        `UPDATE question_bank SET
          title = ?, question_type = ?, difficulty = ?, marks = ?,
          explanation = ?, options_data = ?, settings = ?,
          question_code = COALESCE(?, question_code),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          title.trim() || existing.title,
          question_type,
          difficulty,
          parseFloat(marks) || 1.0,
          explanation || '',
          JSON.stringify(options_data || []),
          JSON.stringify(settings || {}),
          finalCode,
          existing.id
        ]
      );
      const updated = await dbGet(`SELECT * FROM question_bank WHERE id = ?`, [existing.id]);
      return res.json({
        success: true,
        data: { question: updated, updated: true }
      });
    }

    const id = generateUUID();
    await dbRun(
      `INSERT INTO question_bank (
        id, creator_id, title, question_text, question_type, category,
        difficulty, tags, marks, explanation, options_data, settings, question_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        title.trim() || 'Untitled Bank Question',
        question_text.trim(),
        question_type,
        category,
        difficulty,
        JSON.stringify(Array.isArray(tags) ? tags : []),
        parseFloat(marks) || 1.0,
        explanation || '',
        JSON.stringify(options_data || []),
        JSON.stringify(settings || {}),
        finalCode
      ]
    );

    const created = await dbGet(`SELECT * FROM question_bank WHERE id = ?`, [id]);

    res.status(201).json({
      success: true,
      data: { question: created }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/question-bank/from-quiz-question
 * Save an existing quiz question into the Question Bank
 */
router.post('/from-quiz-question', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { questionId, category = 'General', tags = [] } = req.body;

    const question = await dbGet(`SELECT * FROM questions WHERE id = ?`, [questionId]);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Quiz question not found.' }
      });
    }

    // Verify user owns the quiz
    const quiz = await dbGet(`SELECT creator_id FROM quizzes WHERE id = ?`, [question.quiz_id]);
    if (!quiz || (quiz.creator_id !== userId && req.user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Not authorized.' }
      });
    }

    let optionsData = [];
    if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(question.question_type)) {
      optionsData = await dbAll(
        `SELECT option_key, option_text, is_correct, sort_order 
         FROM question_options 
         WHERE question_id = ? 
         ORDER BY sort_order ASC`,
        [questionId]
      );
    } else {
      optionsData = await dbAll(
        `SELECT expected_answer, is_case_sensitive, numeric_tolerance 
         FROM question_answers 
         WHERE question_id = ?`,
        [questionId]
      );
    }

    const bankId = generateUUID();
    const finalCode = question.question_code || formatQuestionCode(category, question.question_type, 'MEDIUM', 1);

    await dbRun(
      `INSERT INTO question_bank (
        id, creator_id, title, question_text, question_type, category,
        difficulty, tags, marks, explanation, options_data, settings, question_code
      ) VALUES (?, ?, ?, ?, ?, ?, 'MEDIUM', ?, ?, ?, ?, ?, ?)`,
      [
        bankId,
        userId,
        question.question_text.slice(0, 40) + '...',
        question.question_text,
        question.question_type,
        category,
        JSON.stringify(tags),
        question.marks,
        question.explanation,
        JSON.stringify(optionsData),
        question.settings || '{}',
        finalCode
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        message: 'Question saved to Question Bank successfully.',
        bankId,
        question_code: finalCode
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/question-bank/:id/import-to-quiz
 * Import a Question Bank item into a target quiz as a new deep copy
 */
router.post('/:id/import-to-quiz', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetQuizId } = req.body;
    const userId = req.user.id;

    if (!targetQuizId) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Target quiz ID is required.' }
      });
    }

    // Verify target quiz ownership
    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [targetQuizId]);
    if (!quiz || (quiz.creator_id !== userId && req.user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Target quiz not accessible.' }
      });
    }

    // Fetch bank question
    const bankQ = await dbGet(`SELECT * FROM question_bank WHERE id = ? AND creator_id = ?`, [id, userId]);
    if (!bankQ) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Question not found in bank.' }
      });
    }

    // Get current max sort_order
    const sortRow = await dbGet(
      `SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM questions WHERE quiz_id = ?`,
      [targetQuizId]
    );
    const newSortOrder = (sortRow?.max_sort || 0) + 1;

    const newQuestionId = generateUUID();
    const finalCode = bankQ.question_code || formatQuestionCode(quiz.category, bankQ.question_type, quiz.difficulty || 'MEDIUM', newSortOrder);

    await dbRun(
      `INSERT INTO questions (
        id, quiz_id, question_text, question_type, marks,
        time_limit_sec, explanation, sort_order, settings, question_code
      ) VALUES (?, ?, ?, ?, ?, 30, ?, ?, ?, ?)`,
      [
        newQuestionId,
        targetQuizId,
        bankQ.question_text,
        bankQ.question_type,
        bankQ.marks,
        bankQ.explanation,
        newSortOrder,
        bankQ.settings || '{}',
        finalCode
      ]
    );

    // Parse options_data
    let optionsData = [];
    try {
      optionsData = JSON.parse(bankQ.options_data || '[]');
    } catch (e) {}

    if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(bankQ.question_type)) {
      for (let i = 0; i < optionsData.length; i++) {
        const opt = optionsData[i];
        await dbRun(
          `INSERT INTO question_options (
            id, question_id, option_key, option_text, is_correct, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            generateUUID(),
            newQuestionId,
            opt.option_key || String.fromCharCode(65 + i),
            opt.option_text || '',
            opt.is_correct ? 1 : 0,
            i
          ]
        );
      }
    } else {
      for (const ans of optionsData) {
        await dbRun(
          `INSERT INTO question_answers (
            id, question_id, expected_answer, is_case_sensitive, numeric_tolerance
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            generateUUID(),
            newQuestionId,
            ans.expected_answer || '',
            ans.is_case_sensitive ? 1 : 0,
            parseFloat(ans.numeric_tolerance) || 0.0
          ]
        );
      }
    }

    res.status(201).json({
      success: true,
      data: {
        message: 'Question imported successfully into quiz.',
        questionId: newQuestionId
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/question-bank/:id
 * Update question in bank
 */
router.put('/:id', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await dbGet(`SELECT * FROM question_bank WHERE id = ? AND creator_id = ?`, [id, userId]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Bank question not found.' }
      });
    }

    const {
      title,
      question_text,
      question_type,
      category,
      difficulty,
      tags,
      marks,
      explanation,
      options_data,
      settings,
      question_code
    } = req.body;

    await dbRun(
      `UPDATE question_bank SET
        title = ?, question_text = ?, question_type = ?, category = ?,
        difficulty = ?, tags = ?, marks = ?, explanation = ?,
        options_data = ?, settings = ?, question_code = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title !== undefined ? title : existing.title,
        question_text !== undefined ? question_text : existing.question_text,
        question_type !== undefined ? question_type : existing.question_type,
        category !== undefined ? category : existing.category,
        difficulty !== undefined ? difficulty : existing.difficulty,
        tags !== undefined ? JSON.stringify(tags) : existing.tags,
        marks !== undefined ? parseFloat(marks) : existing.marks,
        explanation !== undefined ? explanation : existing.explanation,
        options_data !== undefined ? JSON.stringify(options_data) : existing.options_data,
        settings !== undefined ? JSON.stringify(settings) : existing.settings,
        question_code !== undefined ? question_code : existing.question_code,
        id
      ]
    );

    const updated = await dbGet(`SELECT * FROM question_bank WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: { question: updated }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/question-bank/:id
 * Delete question from bank
 */
router.delete('/:id', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await dbGet(`SELECT * FROM question_bank WHERE id = ? AND creator_id = ?`, [id, userId]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Bank question not found.' }
      });
    }

    await dbRun(`DELETE FROM question_bank WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: { message: 'Question removed from Question Bank.' }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/question-bank/save-entire-quiz
 * Save all questions of a quiz into the Question Bank
 */
router.post('/save-entire-quiz', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { quizId, category } = req.body;

    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);
    if (!quiz || (quiz.creator_id !== userId && req.user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Quiz not accessible.' }
      });
    }

    const questions = await dbAll(`SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC`, [quizId]);
    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_EMPTY', message: 'No questions in this quiz to save.' }
      });
    }

    const targetCategory = category || quiz.category || 'General';
    let savedCount = 0;

    for (const q of questions) {
      let optionsData = [];
      if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type)) {
        optionsData = await dbAll(
          `SELECT option_key, option_text, is_correct, sort_order FROM question_options WHERE question_id = ? ORDER BY sort_order ASC`,
          [q.id]
        );
      } else {
        optionsData = await dbAll(
          `SELECT expected_answer, is_case_sensitive, numeric_tolerance FROM question_answers WHERE question_id = ?`,
          [q.id]
        );
      }

      const bankId = generateUUID();
      const finalCode = q.question_code || formatQuestionCode(targetCategory, q.question_type, quiz.difficulty || 'MEDIUM', savedCount + 1);
      await dbRun(
        `INSERT INTO question_bank (
          id, creator_id, title, question_text, question_type, category,
          difficulty, tags, marks, explanation, options_data, settings, question_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bankId,
          userId,
          q.question_text.slice(0, 45) + (q.question_text.length > 45 ? '...' : ''),
          q.question_text,
          q.question_type,
          targetCategory,
          quiz.difficulty || 'MEDIUM',
          quiz.tags || '[]',
          q.marks,
          q.explanation || '',
          JSON.stringify(optionsData || []),
          q.settings || '{}',
          finalCode
        ]
      );
      savedCount++;
    }

    res.status(201).json({
      success: true,
      data: {
        message: `Successfully saved ${savedCount} questions from "${quiz.title}" to Question Bank under subject "${targetCategory}".`,
        savedCount
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/question-bank/bulk-import-to-quiz
 * Import multiple bank questions into a target quiz
 */
router.post('/bulk-import-to-quiz', authenticateToken, requireRole('CREATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const { targetQuizId, questionIds } = req.body;
    const userId = req.user.id;

    if (!targetQuizId || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION', message: 'Target quiz ID and question IDs array required.' }
      });
    }

    // Verify quiz ownership
    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [targetQuizId]);
    if (!quiz || (quiz.creator_id !== userId && req.user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { code: 'ERR_FORBIDDEN', message: 'Target quiz not accessible.' }
      });
    }

    const sortRow = await dbGet(`SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM questions WHERE quiz_id = ?`, [targetQuizId]);
    let nextSort = (sortRow?.max_sort || 0) + 1;

    for (const bId of questionIds) {
      const bankQ = await dbGet(`SELECT * FROM question_bank WHERE id = ? AND creator_id = ?`, [bId, userId]);
      if (!bankQ) continue;

      const newQId = generateUUID();
      const finalCode = bankQ.question_code || formatQuestionCode(quiz.category, bankQ.question_type, quiz.difficulty || 'MEDIUM', nextSort);
      await dbRun(
        `INSERT INTO questions (
          id, quiz_id, question_text, question_type, marks,
          time_limit_sec, explanation, sort_order, settings, question_code
        ) VALUES (?, ?, ?, ?, ?, 30, ?, ?, ?, ?)`,
        [newQId, targetQuizId, bankQ.question_text, bankQ.question_type, bankQ.marks, bankQ.explanation, nextSort++, bankQ.settings || '{}', finalCode]
      );

      let optionsData = [];
      try { optionsData = JSON.parse(bankQ.options_data || '[]'); } catch (e) {}

      if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(bankQ.question_type)) {
        for (let i = 0; i < optionsData.length; i++) {
          const opt = optionsData[i];
          await dbRun(
            `INSERT INTO question_options (
              id, question_id, option_key, option_text, is_correct, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [generateUUID(), newQId, opt.option_key || String.fromCharCode(65 + i), opt.option_text || '', opt.is_correct ? 1 : 0, i]
          );
        }
      } else {
        for (const ans of optionsData) {
          await dbRun(
            `INSERT INTO question_answers (
              id, question_id, expected_answer, is_case_sensitive, numeric_tolerance
            ) VALUES (?, ?, ?, ?, ?)`,
            [generateUUID(), newQId, ans.expected_answer || '', ans.is_case_sensitive ? 1 : 0, parseFloat(ans.numeric_tolerance) || 0.0]
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: { message: `Successfully imported ${questionIds.length} question(s) into quiz.` }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
