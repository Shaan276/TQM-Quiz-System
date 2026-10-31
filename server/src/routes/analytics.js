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

    // Live multiplayer sessions points & count
    const liveStats = await dbGet(
      `SELECT 
        COUNT(*) as live_sessions_played,
        COALESCE(SUM(score), 0) as live_points,
        COALESCE(SUM(correct_count), 0) as live_correct
       FROM session_participants 
       WHERE user_id = ?`,
      [userId]
    );

    // Self-paced attempts points
    const selfPacedRow = await dbGet(
      `SELECT COALESCE(SUM(score), 0) as total FROM quiz_attempts WHERE user_id = ? AND status = 'COMPLETED'`,
      [userId]
    );
    const selfPacedPoints = Math.round(Number(selfPacedRow?.total) || 0);
    const liveBattlePoints = Math.round(Number(liveStats?.live_points) || 0);
    const totalPoints = selfPacedPoints + liveBattlePoints;

    const totalCompleted = attemptsSummary?.completed_attempts || 0;
    const passedCount = attemptsSummary?.passed_attempts || 0;
    const passRate = totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0;
    const avgScore = attemptsSummary?.avg_score ? Math.round(attemptsSummary.avg_score * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        totalPoints,
        selfPacedPoints,
        liveBattlePoints,
        liveSessionsPlayed: liveStats?.live_sessions_played || 0,
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
// 2b. GET /api/v1/analytics/teacher/all-tests - Unified Live, Self-Paced & Assignment Assessment Data
// -------------------------------------------------------------
router.get('/teacher/all-tests', authenticateToken, requireRole('TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    // 1. Live Battles hosted by teacher
    const liveSessionsRaw = await dbAll(`
      SELECT 
        qs.id, qs.join_code, qs.status, qs.total_questions, qs.created_at, qs.ended_at,
        q.title AS quiz_title, q.category AS quiz_category,
        COUNT(sp.id) AS participant_count,
        AVG(sp.score) AS average_score,
        SUM(CASE WHEN sp.is_flagged = 1 THEN 1 ELSE 0 END) AS flagged_count
      FROM quiz_sessions qs
      JOIN quizzes q ON qs.quiz_id = q.id
      LEFT JOIN session_participants sp ON qs.id = sp.session_id
      ${isOrgAdmin ? '' : 'WHERE qs.host_id = ?'}
      GROUP BY qs.id
      ORDER BY qs.created_at DESC
      LIMIT 50
    `, isOrgAdmin ? [] : [userId]);

    // Attach participants drilldown for each live session
    const liveBattles = await Promise.all(liveSessionsRaw.map(async (sess) => {
      const participants = await dbAll(`
        SELECT sp.id, sp.user_id, sp.display_name, sp.score, sp.correct_count, sp.rank,
               sp.warning_count, sp.is_flagged, sp.flag_reason, u.email
        FROM session_participants sp
        LEFT JOIN users u ON sp.user_id = u.id
        WHERE sp.session_id = ?
        ORDER BY sp.score DESC, sp.correct_count DESC
      `, [sess.id]);

      const winner = participants.length > 0 ? participants[0].display_name : null;
      return {
        ...sess,
        winnerName: winner,
        participants
      };
    }));

    // 2. Self-Paced Attempts on teacher's quizzes
    const selfPacedAttempts = await dbAll(`
      SELECT 
        qa.id, qa.quiz_id, qa.quiz_version, qa.status, qa.score, qa.max_score,
        qa.score_percentage, qa.is_passed, qa.total_questions, qa.correct_answers,
        qa.warning_count, qa.is_flagged, qa.flag_reason, qa.started_at, qa.submitted_at,
        qa.time_taken_sec,
        q.title AS quiz_title, q.category AS quiz_category,
        u.name AS student_name, u.email AS student_email,
        se.roll_number, s.name AS section_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN users u ON qa.user_id = u.id
      LEFT JOIN student_enrollments se ON qa.user_id = se.user_id AND se.status = 'ACTIVE'
      LEFT JOIN sections s ON se.section_id = s.id
      ${isOrgAdmin ? "WHERE qa.status = 'COMPLETED'" : "WHERE q.creator_id = ? AND qa.status = 'COMPLETED'"}
      ORDER BY qa.submitted_at DESC
      LIMIT 100
    `, isOrgAdmin ? [] : [userId]);

    // 3. Scheduled Assignments authored by teacher
    const assignmentsRaw = await dbAll(`
      SELECT 
        a.id, a.title, a.instructions, a.scope_type, a.due_date, a.time_limit_sec,
        a.max_attempts, a.created_at, a.status,
        q.title AS quiz_title, q.category AS quiz_category,
        COUNT(ar.id) AS total_recipients,
        SUM(CASE WHEN ar.status = 'SUBMITTED' OR ar.status = 'LATE' THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN ar.status = 'STARTED' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN ar.status = 'ASSIGNED' THEN 1 ELSE 0 END) AS pending_count,
        AVG(CASE WHEN ar.score IS NOT NULL THEN ar.score ELSE NULL END) AS average_score
      FROM assignments a
      JOIN quizzes q ON a.quiz_id = q.id
      LEFT JOIN assignment_recipients ar ON a.id = ar.assignment_id
      ${isOrgAdmin ? '' : 'WHERE a.teacher_id = ?'}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `, isOrgAdmin ? [] : [userId]);

    // Attach student recipient breakdown for each assignment
    const scheduledAssignments = await Promise.all(assignmentsRaw.map(async (assign) => {
      const recipients = await dbAll(`
        SELECT 
          ar.id, ar.student_id, ar.status, ar.score, ar.is_passed, ar.submitted_at, ar.source,
          u.name AS student_name, u.email AS student_email,
          se.roll_number, s.name AS section_name,
          qa.warning_count, qa.is_flagged, qa.flag_reason
        FROM assignment_recipients ar
        JOIN users u ON ar.student_id = u.id
        LEFT JOIN student_enrollments se ON ar.student_id = se.user_id AND se.status = 'ACTIVE'
        LEFT JOIN sections s ON ar.section_id = s.id
        LEFT JOIN quiz_attempts qa ON ar.attempt_id = qa.id
        WHERE ar.assignment_id = ?
        ORDER BY s.name ASC, se.roll_number ASC, u.name ASC
      `, [assign.id]);

      return {
        ...assign,
        recipients
      };
    }));

    res.json({
      success: true,
      data: {
        liveBattles,
        selfPacedAttempts,
        scheduledAssignments,
        assignments: scheduledAssignments,
        summary: {
          totalLiveBattles: liveBattles.length,
          totalSelfPacedAttempts: selfPacedAttempts.length,
          totalAssignments: scheduledAssignments.length
        }
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