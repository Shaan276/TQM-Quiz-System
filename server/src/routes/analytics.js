const express = require('express');
const { dbGet, dbAll } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------
// 1. GET /api/v1/analytics/student - Student learning analytics
// -------------------------------------------------------------
router.get('/student', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Overall attempt statistics
    const attemptsSummary = await dbGet(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_attempts,
        AVG(CASE WHEN status = 'COMPLETED' THEN score_percentage ELSE NULL END) as avg_score,
        SUM(time_taken_sec) as total_time_sec,
        SUM(correct_answers) as total_correct,
        SUM(incorrect_answers) as total_incorrect
       FROM quiz_attempts 
       WHERE user_id = ?`,
      [userId]
    );

    // Mistakes stats
    const mistakesSummary = await dbGet(
      `SELECT 
        COUNT(*) as total_mistakes,
        SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) as unresolved_mistakes,
        SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as resolved_mistakes
       FROM mistake_notebook 
       WHERE user_id = ?`,
      [userId]
    );

    // Recent attempts (last 5)
    const recentAttempts = await dbAll(
      `SELECT 
        a.id, a.quiz_id, a.score, a.max_score, a.score_percentage, 
        a.is_passed, a.time_taken_sec, a.submitted_at,
        q.title as quiz_title, q.category as subject
       FROM quiz_attempts a
       JOIN quizzes q ON a.quiz_id = q.id
       WHERE a.user_id = ? AND a.status = 'COMPLETED'
       ORDER BY a.submitted_at DESC
       LIMIT 5`,
      [userId]
    );

    const totalCompleted = attemptsSummary?.completed_attempts || 0;
    const passedCount = attemptsSummary?.passed_attempts || 0;
    const passRate = totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0;
    const avgScore = attemptsSummary?.avg_score ? Math.round(attemptsSummary.avg_score * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        totalAttempts: attemptsSummary?.total_attempts || 0,
        completedAttempts: totalCompleted,
        passedAttempts: passedCount,
        passRate,
        averageScore: avgScore,
        totalTimeTakenSec: attemptsSummary?.total_time_sec || 0,
        totalCorrectAnswers: attemptsSummary?.total_correct || 0,
        totalIncorrectAnswers: attemptsSummary?.total_incorrect || 0,
        mistakes: {
          total: mistakesSummary?.total_mistakes || 0,
          unresolved: mistakesSummary?.unresolved_mistakes || 0,
          resolved: mistakesSummary?.resolved_mistakes || 0
        },
        recentAttempts
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. GET /api/v1/analytics/teacher - Teacher assessment analytics
// -------------------------------------------------------------
router.get('/teacher', authenticateToken, requireRole('TEACHER', 'CREATOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Quizzes authored
    const quizCountRow = await dbGet(
      `SELECT 
        COUNT(*) as total_quizzes,
        SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as published_quizzes
       FROM quizzes 
       WHERE creator_id = ?`,
      [userId]
    );

    // Total attempts across authored quizzes
    const attemptsRow = await dbGet(
      `SELECT 
        COUNT(a.id) as total_attempts,
        SUM(CASE WHEN a.is_passed = 1 THEN 1 ELSE 0 END) as passed_attempts,
        AVG(a.score_percentage) as avg_score,
        COUNT(DISTINCT a.user_id) as unique_students
       FROM quiz_attempts a
       JOIN quizzes q ON a.quiz_id = q.id
       WHERE q.creator_id = ? AND a.status = 'COMPLETED'`,
      [userId]
    );

    // Performance by quiz
    const quizPerformance = await dbAll(
      `SELECT 
        q.id, q.title, q.category, q.passing_percentage as pass_percentage,
        COUNT(a.id) as attempts_count,
        AVG(a.score_percentage) as avg_score,
        SUM(CASE WHEN a.is_passed = 1 THEN 1 ELSE 0 END) as pass_count
       FROM quizzes q
       LEFT JOIN quiz_attempts a ON q.id = a.quiz_id AND a.status = 'COMPLETED'
       WHERE q.creator_id = ?
       GROUP BY q.id
       ORDER BY attempts_count DESC
       LIMIT 10`,
      [userId]
    );

    // Most failed questions in teacher's quizzes
    const hardestQuestions = await dbAll(
      `SELECT 
        m.question_id, m.question_text, m.quiz_title,
        COUNT(m.id) as failure_count
       FROM mistake_notebook m
       JOIN quizzes q ON m.quiz_id = q.id
       WHERE q.creator_id = ?
       GROUP BY m.question_id
       ORDER BY failure_count DESC
       LIMIT 5`,
      [userId]
    );

    const totalAttempts = attemptsRow?.total_attempts || 0;
    const passedAttempts = attemptsRow?.passed_attempts || 0;
    const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
    const avgScore = attemptsRow?.avg_score ? Math.round(attemptsRow.avg_score * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        totalQuizzes: quizCountRow?.total_quizzes || 0,
        publishedQuizzes: quizCountRow?.published_quizzes || 0,
        totalAttempts,
        uniqueStudents: attemptsRow?.unique_students || 0,
        passRate,
        averageScore: avgScore,
        quizPerformance,
        hardestQuestions
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. GET /api/v1/analytics/admin - Super admin platform analytics
// -------------------------------------------------------------
router.get('/admin', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const usersCount = await dbGet(
      `SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role IN ('STUDENT', 'LEARNER') THEN 1 ELSE 0 END) as students,
        SUM(CASE WHEN role IN ('TEACHER', 'CREATOR') THEN 1 ELSE 0 END) as teachers,
        SUM(CASE WHEN role IN ('SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN') THEN 1 ELSE 0 END) as admins
       FROM users`
    );

    const quizzesCount = await dbGet(
      `SELECT 
        COUNT(*) as total_quizzes,
        SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as drafts
       FROM quizzes`
    );

    const attemptsCount = await dbGet(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        AVG(CASE WHEN status = 'COMPLETED' THEN score_percentage ELSE NULL END) as avg_score
       FROM quiz_attempts`
    );

    res.json({
      success: true,
      data: {
        users: {
          total: usersCount?.total_users || 0,
          students: usersCount?.students || 0,
          teachers: usersCount?.teachers || 0,
          admins: usersCount?.admins || 0
        },
        quizzes: {
          total: quizzesCount?.total_quizzes || 0,
          published: quizzesCount?.published || 0,
          drafts: quizzesCount?.drafts || 0
        },
        attempts: {
          total: attemptsCount?.total_attempts || 0,
          completed: attemptsCount?.completed || 0,
          averageScore: attemptsCount?.avg_score ? Math.round(attemptsCount.avg_score * 10) / 10 : 0
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;