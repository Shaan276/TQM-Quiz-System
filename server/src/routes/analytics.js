const express = require('express');
const { dbGet, dbAll } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { formatCorrectAnswer } = require('../services/scoringEngine');

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

// -------------------------------------------------------------
// 4. GET /api/v1/analytics/teacher/insights/overview - Multi-level Teacher Overview
// -------------------------------------------------------------
router.get('/teacher/insights/overview', authenticateToken, requireRole('TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isSuperOrOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const { quizId, sectionId, startDate, endDate, studentId } = req.query;

    // 1. Determine scoped quizzes
    let teacherQuizzes = [];
    if (isSuperOrOrgAdmin) {
      teacherQuizzes = await dbAll(`SELECT id, title, category, passing_percentage FROM quizzes WHERE status != 'ARCHIVED' ORDER BY title ASC`);
    } else {
      teacherQuizzes = await dbAll(`
        SELECT DISTINCT q.id, q.title, q.category, q.passing_percentage
        FROM quizzes q
        LEFT JOIN assignments a ON q.id = a.quiz_id AND a.teacher_id = ?
        WHERE (q.creator_id = ? OR a.id IS NOT NULL) AND q.status != 'ARCHIVED'
        ORDER BY q.title ASC
      `, [userId, userId]);
    }

    const quizIds = teacherQuizzes.map(q => q.id);
    if (quizIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalAssessments: 0,
          totalAttempts: 0,
          uniqueStudents: 0,
          averageScore: 0,
          medianScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passRate: 0,
          completionRate: 100,
          averageTimeSec: 0,
          totalQuestionsAnswered: 0,
          overallAccuracy: 0,
          studentsNeedingPractice: [],
          scoreDistribution: { '0-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 },
          filterOptions: { quizzes: [], sections: [], departments: [] }
        }
      });
    }

    // 2. Build attempt query filters
    const whereClauses = [];
    const params = [];

    if (quizId) {
      whereClauses.push('qa.quiz_id = ?');
      params.push(quizId);
    } else {
      const placeholders = quizIds.map(() => '?').join(',');
      whereClauses.push(`qa.quiz_id IN (${placeholders})`);
      params.push(...quizIds);
    }

    if (studentId) {
      whereClauses.push('qa.user_id = ?');
      params.push(studentId);
    }

    if (startDate) {
      whereClauses.push('qa.started_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('qa.started_at <= ?');
      params.push(endDate);
    }

    // Optional section filter
    let sectionJoin = '';
    if (sectionId) {
      sectionJoin = `JOIN student_enrollments se ON qa.user_id = se.user_id AND se.section_id = ? AND se.status = 'ACTIVE'`;
      params.unshift(sectionId);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch attempts
    const attempts = await dbAll(`
      SELECT 
        qa.id, qa.user_id, qa.status, qa.score, qa.max_score, qa.score_percentage, 
        qa.is_passed, qa.total_questions, qa.correct_answers, qa.incorrect_answers,
        qa.time_taken_sec, qa.started_at, qa.submitted_at,
        u.name as student_name, u.email as student_email
      FROM quiz_attempts qa
      JOIN users u ON qa.user_id = u.id
      ${sectionJoin}
      ${whereSQL}
    `, params);

    const completedAttempts = attempts.filter(a => a.status === 'COMPLETED');
    const totalAttempts = completedAttempts.length;
    const startedAttempts = attempts.length;
    const uniqueStudentsSet = new Set(completedAttempts.map(a => a.user_id));

    // Calculate score metrics
    const scores = completedAttempts.map(a => Number(a.score_percentage) || 0).sort((a, b) => a - b);
    const sumScore = scores.reduce((sum, s) => sum + s, 0);
    const avgScore = totalAttempts > 0 ? Math.round((sumScore / totalAttempts) * 10) / 10 : 0;
    
    let medianScore = 0;
    if (totalAttempts > 0) {
      const mid = Math.floor(scores.length / 2);
      medianScore = scores.length % 2 !== 0 ? scores[mid] : Math.round(((scores[mid - 1] + scores[mid]) / 2) * 10) / 10;
    }

    const highestScore = totalAttempts > 0 ? scores[scores.length - 1] : 0;
    const lowestScore = totalAttempts > 0 ? scores[0] : 0;

    const passedCount = completedAttempts.filter(a => a.is_passed === 1).length;
    const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;
    const completionRate = startedAttempts > 0 ? Math.round((totalAttempts / startedAttempts) * 100) : 100;

    const totalTimeSec = completedAttempts.reduce((sum, a) => sum + (Number(a.time_taken_sec) || 0), 0);
    const averageTimeSec = totalAttempts > 0 ? Math.round(totalTimeSec / totalAttempts) : 0;

    const totalCorrect = completedAttempts.reduce((sum, a) => sum + (Number(a.correct_answers) || 0), 0);
    const totalIncorrect = completedAttempts.reduce((sum, a) => sum + (Number(a.incorrect_answers) || 0), 0);
    const totalQuestionsAnswered = totalCorrect + totalIncorrect;
    const overallAccuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;

    // Score distribution buckets
    const scoreDistribution = { '0-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 };
    scores.forEach(s => {
      if (s <= 40) scoreDistribution['0-40%']++;
      else if (s <= 60) scoreDistribution['41-60%']++;
      else if (s <= 80) scoreDistribution['61-80%']++;
      else scoreDistribution['81-100%']++;
    });

    // Students needing additional practice (avg score < 60% or pass rate < 50%)
    const studentMap = {};
    completedAttempts.forEach(a => {
      if (!studentMap[a.user_id]) {
        studentMap[a.user_id] = {
          studentId: a.user_id,
          name: a.student_name,
          email: a.student_email,
          attempts: 0,
          totalScore: 0,
          passed: 0
        };
      }
      studentMap[a.user_id].attempts++;
      studentMap[a.user_id].totalScore += a.score_percentage;
      if (a.is_passed === 1) studentMap[a.user_id].passed++;
    });

    const studentsNeedingPractice = Object.values(studentMap)
      .map(s => ({
        ...s,
        avgScore: Math.round((s.totalScore / s.attempts) * 10) / 10,
        passRate: Math.round((s.passed / s.attempts) * 100)
      }))
      .filter(s => s.avgScore < 60 || s.passRate < 50)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 10);

    // Fetch filter options (sections & departments)
    let sections = [];
    let departments = [];
    if (isSuperOrOrgAdmin) {
      sections = await dbAll(`SELECT id, name, class_id FROM sections WHERE is_active = 1 ORDER BY name ASC`);
      departments = await dbAll(`SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name ASC`);
    } else {
      sections = await dbAll(`
        SELECT s.id, s.name, s.class_id
        FROM teacher_assignments ta
        JOIN sections s ON ta.section_id = s.id
        WHERE ta.teacher_id = ? AND ta.is_active = 1
        ORDER BY s.name ASC
      `, [userId]);
      departments = await dbAll(`
        SELECT DISTINCT d.id, d.name
        FROM teacher_assignments ta
        JOIN sections s ON ta.section_id = s.id
        JOIN classes c ON s.class_id = c.id
        JOIN departments d ON c.department_id = d.id
        WHERE ta.teacher_id = ? AND ta.is_active = 1
        ORDER BY d.name ASC
      `, [userId]);
    }

    res.json({
      success: true,
      data: {
        totalAssessments: teacherQuizzes.length,
        totalAttempts,
        uniqueStudents: uniqueStudentsSet.size,
        averageScore: avgScore,
        medianScore,
        highestScore,
        lowestScore,
        passRate,
        completionRate,
        averageTimeSec,
        totalQuestionsAnswered,
        overallAccuracy,
        studentsNeedingPractice,
        scoreDistribution,
        filterOptions: {
          quizzes: teacherQuizzes,
          sections,
          departments
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 5. GET /api/v1/analytics/teacher/insights/questions - Question-Level Deep Dive
// -------------------------------------------------------------
router.get('/teacher/insights/questions', authenticateToken, requireRole('TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isSuperOrOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const { quizId, sortBy = 'lowest_accuracy', difficulty, type } = req.query;

    // 1. Get authorized quiz IDs
    let teacherQuizzes = [];
    if (isSuperOrOrgAdmin) {
      teacherQuizzes = await dbAll(`SELECT id, title FROM quizzes WHERE status != 'ARCHIVED'`);
    } else {
      teacherQuizzes = await dbAll(`
        SELECT DISTINCT q.id, q.title
        FROM quizzes q
        LEFT JOIN assignments a ON q.id = a.quiz_id AND a.teacher_id = ?
        WHERE (q.creator_id = ? OR a.id IS NOT NULL) AND q.status != 'ARCHIVED'
      `, [userId, userId]);
    }

    const quizIds = teacherQuizzes.map(q => q.id);
    if (quizIds.length === 0) {
      return res.json({ success: true, data: { questions: [], totalQuestions: 0 } });
    }

    let targetQuizIds = quizIds;
    if (quizId) {
      if (!quizIds.includes(quizId) && !isSuperOrOrgAdmin) {
        return res.status(403).json({ success: false, error: { code: 'ERR_FORBIDDEN', message: 'Unauthorized access to this quiz' } });
      }
      targetQuizIds = [quizId];
    }

    // 2. Fetch questions
    const qPlaceholders = targetQuizIds.map(() => '?').join(',');
    const qParams = [...targetQuizIds];
    let typeClause = '';
    if (type) {
      typeClause = 'AND q.question_type = ?';
      qParams.push(type);
    }

    const rawQuestions = await dbAll(`
      SELECT 
        q.id, q.quiz_id, q.question_text, q.question_type, q.marks,
        q.time_limit_sec, q.explanation, q.sort_order, q.created_at,
        qz.title as quiz_title, qz.category as quiz_category
      FROM questions q
      JOIN quizzes qz ON q.quiz_id = qz.id
      WHERE q.quiz_id IN (${qPlaceholders}) ${typeClause}
      ORDER BY q.quiz_id ASC, q.sort_order ASC
    `, qParams);

    // 3. For each question, calculate attempt counts, option distributions, accuracy
    const questionsAnalysis = await Promise.all(rawQuestions.map(async (q) => {
      const options = await dbAll(`
        SELECT id, option_key, option_text, is_correct, sort_order 
        FROM question_options 
        WHERE question_id = ? 
        ORDER BY sort_order ASC
      `, [q.id]);

      const answers = await dbAll(`
        SELECT expected_answer, is_case_sensitive, numeric_tolerance 
        FROM question_answers 
        WHERE question_id = ?
      `, [q.id]);

      const attemptAnswers = await dbAll(`
        SELECT aa.user_answer, aa.is_correct, aa.earned_score
        FROM attempt_answers aa
        JOIN quiz_attempts qa ON aa.attempt_id = qa.id
        WHERE aa.question_id = ? AND qa.status = 'COMPLETED'
      `, [q.id]);

      const quizAttemptsCount = await dbGet(`
        SELECT COUNT(*) as total FROM quiz_attempts WHERE quiz_id = ? AND status = 'COMPLETED'
      `, [q.quiz_id]);
      const totalQuizAttempts = quizAttemptsCount?.total || 0;

      let correctCount = 0;
      let incorrectCount = 0;
      let skippedCount = 0;
      let attemptedCount = 0;

      const optionCounts = {};
      options.forEach(o => { optionCounts[o.id] = 0; });

      attemptAnswers.forEach(ans => {
        const rawAns = ans.user_answer !== undefined && ans.user_answer !== null ? String(ans.user_answer).trim() : '';
        if (!rawAns) {
          skippedCount++;
        } else {
          attemptedCount++;
          if (ans.is_correct === 1) {
            correctCount++;
          } else {
            incorrectCount++;
          }

          let selectedIds = [];
          if (rawAns.startsWith('[') && rawAns.endsWith(']')) {
            try { selectedIds = JSON.parse(rawAns); } catch (e) { selectedIds = [rawAns]; }
          } else {
            selectedIds = [rawAns];
          }

          selectedIds.forEach(id => {
            if (optionCounts[id] !== undefined) {
              optionCounts[id]++;
            }
          });
        }
      });

      const missingFromAnswers = Math.max(0, totalQuizAttempts - attemptAnswers.length);
      skippedCount += missingFromAnswers;

      const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
      
      let realizedDifficulty = 'Medium';
      if (attemptedCount > 0) {
        if (accuracy >= 75) realizedDifficulty = 'Easy';
        else if (accuracy >= 40) realizedDifficulty = 'Medium';
        else realizedDifficulty = 'Hard';
      }

      const optionDistribution = options.map(o => ({
        id: o.id,
        option_key: o.option_key,
        option_text: o.option_text,
        is_correct: o.is_correct === 1,
        count: optionCounts[o.id] || 0,
        percentage: attemptedCount > 0 ? Math.round(((optionCounts[o.id] || 0) / attemptedCount) * 100) : 0
      }));

      let mostCommonDistractor = null;
      const incorrectDistractors = optionDistribution.filter(o => !o.is_correct && o.count > 0);
      if (incorrectDistractors.length > 0) {
        incorrectDistractors.sort((a, b) => b.count - a.count);
        mostCommonDistractor = incorrectDistractors[0];
      }

      const qObj = { ...q, options, answers };
      const correctAnswerText = formatCorrectAnswer(qObj);

      return {
        id: q.id,
        quizId: q.quiz_id,
        quizTitle: q.quiz_title,
        quizCategory: q.quiz_category,
        questionText: q.question_text,
        questionType: q.question_type,
        marks: q.marks,
        explanation: q.explanation || '',
        totalAttempts: attemptedCount,
        attemptedCount,
        correctCount,
        incorrectCount,
        skippedCount,
        accuracy,
        realizedDifficulty,
        optionDistribution,
        mostCommonDistractor,
        correctAnswerText
      };
    }));

    let filteredQuestions = questionsAnalysis;
    if (difficulty) {
      filteredQuestions = filteredQuestions.filter(q => q.realizedDifficulty.toLowerCase() === difficulty.toLowerCase());
    }

    if (sortBy === 'lowest_accuracy') {
      filteredQuestions.sort((a, b) => a.accuracy - b.accuracy);
    } else if (sortBy === 'highest_accuracy') {
      filteredQuestions.sort((a, b) => b.accuracy - a.accuracy);
    } else if (sortBy === 'most_incorrect') {
      filteredQuestions.sort((a, b) => b.incorrectCount - a.incorrectCount);
    } else if (sortBy === 'most_skipped') {
      filteredQuestions.sort((a, b) => b.skippedCount - a.skippedCount);
    }

    res.json({
      success: true,
      data: {
        questions: filteredQuestions,
        totalQuestions: filteredQuestions.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 6. GET /api/v1/analytics/teacher/insights/students - Student Roster Performance
// -------------------------------------------------------------
router.get('/teacher/insights/students', authenticateToken, requireRole('TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isSuperOrOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const { quizId, sectionId, search } = req.query;

    let teacherQuizzes = [];
    if (isSuperOrOrgAdmin) {
      teacherQuizzes = await dbAll(`SELECT id FROM quizzes WHERE status != 'ARCHIVED'`);
    } else {
      teacherQuizzes = await dbAll(`
        SELECT DISTINCT q.id
        FROM quizzes q
        LEFT JOIN assignments a ON q.id = a.quiz_id AND a.teacher_id = ?
        WHERE (q.creator_id = ? OR a.id IS NOT NULL) AND q.status != 'ARCHIVED'
      `, [userId, userId]);
    }

    const quizIds = teacherQuizzes.map(q => q.id);
    if (quizIds.length === 0) {
      return res.json({ success: true, data: { students: [], total: 0 } });
    }

    let targetQuizIds = quizIds;
    if (quizId && quizIds.includes(quizId)) {
      targetQuizIds = [quizId];
    }

    const qPlaceholders = targetQuizIds.map(() => '?').join(',');
    const params = [...targetQuizIds];

    let sectionClause = '';
    if (sectionId) {
      sectionClause = 'AND se.section_id = ?';
      params.push(sectionId);
    }

    let searchClause = '';
    if (search && search.trim()) {
      searchClause = 'AND (u.name LIKE ? OR u.email LIKE ? OR se.roll_number LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    const students = await dbAll(`
      SELECT 
        u.id as student_id, u.name as student_name, u.email as student_email,
        se.roll_number, s.name as section_name, c.name as class_name,
        COUNT(qa.id) as total_attempts,
        SUM(CASE WHEN qa.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_attempts,
        AVG(CASE WHEN qa.status = 'COMPLETED' THEN qa.score_percentage ELSE NULL END) as avg_score,
        MAX(CASE WHEN qa.status = 'COMPLETED' THEN qa.score_percentage ELSE NULL END) as high_score,
        SUM(CASE WHEN qa.status = 'COMPLETED' AND qa.is_passed = 1 THEN 1 ELSE 0 END) as passed_attempts,
        SUM(qa.correct_answers) as total_correct,
        SUM(qa.total_questions) as total_questions,
        MAX(qa.submitted_at) as last_attempt_date
      FROM users u
      JOIN quiz_attempts qa ON u.id = qa.user_id
      LEFT JOIN student_enrollments se ON u.id = se.user_id AND se.status = 'ACTIVE'
      LEFT JOIN sections s ON se.section_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE qa.quiz_id IN (${qPlaceholders}) ${sectionClause} ${searchClause}
      GROUP BY u.id
      ORDER BY avg_score ASC, total_attempts DESC
    `, params);

    const enriched = await Promise.all(students.map(async (st) => {
      const mistakeRow = await dbGet(`
        SELECT COUNT(*) as unresolved_count 
        FROM mistake_notebook 
        WHERE user_id = ? AND is_resolved = 0
      `, [st.student_id]);

      const totalCorrect = Number(st.total_correct) || 0;
      const totalQ = Number(st.total_questions) || 0;
      const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
      const completed = Number(st.completed_attempts) || 0;
      const total = Number(st.total_attempts) || 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;
      const passRate = completed > 0 ? Math.round(((Number(st.passed_attempts) || 0) / completed) * 100) : 0;

      return {
        id: st.student_id,
        name: st.student_name,
        email: st.student_email,
        rollNumber: st.roll_number || 'N/A',
        sectionName: st.section_name || 'Unassigned',
        className: st.class_name || 'N/A',
        totalAttempts: total,
        completedAttempts: completed,
        averageScore: st.avg_score ? Math.round(st.avg_score * 10) / 10 : 0,
        highScore: st.high_score ? Math.round(st.high_score * 10) / 10 : 0,
        accuracy,
        passRate,
        completionRate,
        unresolvedMistakes: mistakeRow?.unresolved_count || 0,
        lastAttemptDate: st.last_attempt_date
      };
    }));

    res.json({
      success: true,
      data: {
        students: enriched,
        total: enriched.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 7. GET /api/v1/analytics/teacher/insights/sections - Section Performance Comparison
// -------------------------------------------------------------
router.get('/teacher/insights/sections', authenticateToken, requireRole('TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isSuperOrOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    let sections = [];
    if (isSuperOrOrgAdmin) {
      sections = await dbAll(`
        SELECT s.id, s.name as section_name, c.name as class_name, d.name as department_name
        FROM sections s
        JOIN classes c ON s.class_id = c.id
        JOIN departments d ON c.department_id = d.id
        WHERE s.is_active = 1
        ORDER BY d.name ASC, c.name ASC, s.name ASC
      `);
    } else {
      sections = await dbAll(`
        SELECT DISTINCT s.id, s.name as section_name, c.name as class_name, d.name as department_name
        FROM teacher_assignments ta
        JOIN sections s ON ta.section_id = s.id
        JOIN classes c ON s.class_id = c.id
        JOIN departments d ON c.department_id = d.id
        WHERE ta.teacher_id = ? AND ta.is_active = 1
        ORDER BY d.name ASC, c.name ASC, s.name ASC
      `, [userId]);
    }

    const sectionMetrics = await Promise.all(sections.map(async (sec) => {
      const enrollRow = await dbGet(`
        SELECT COUNT(*) as student_count 
        FROM student_enrollments 
        WHERE section_id = ? AND status = 'ACTIVE'
      `, [sec.id]);

      const assignRow = await dbGet(`
        SELECT 
          COUNT(ar.id) as assigned_count,
          SUM(CASE WHEN ar.status = 'STARTED' THEN 1 ELSE 0 END) as started_count,
          SUM(CASE WHEN ar.status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted_count,
          SUM(CASE WHEN ar.status = 'LATE' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN ar.status = 'OVERDUE' THEN 1 ELSE 0 END) as overdue_count,
          AVG(ar.score) as avg_score,
          SUM(CASE WHEN ar.is_passed = 1 THEN 1 ELSE 0 END) as passed_count
        FROM assignment_recipients ar
        WHERE ar.section_id = ?
      `, [sec.id]);

      const assignedCount = assignRow?.assigned_count || 0;
      const submittedCount = (assignRow?.submitted_count || 0) + (assignRow?.late_count || 0);
      const passedCount = assignRow?.passed_count || 0;
      const passRate = submittedCount > 0 ? Math.round((passedCount / submittedCount) * 100) : 0;
      const avgScore = assignRow?.avg_score ? Math.round(assignRow.avg_score * 10) / 10 : 0;

      return {
        sectionId: sec.id,
        sectionName: sec.section_name,
        className: sec.class_name,
        departmentName: sec.department_name,
        enrolledStudents: enrollRow?.student_count || 0,
        totalAssigned: assignedCount,
        startedCount: assignRow?.started_count || 0,
        submittedCount,
        lateCount: assignRow?.late_count || 0,
        overdueCount: assignRow?.overdue_count || 0,
        averageScore: avgScore,
        passRate
      };
    }));

    res.json({
      success: true,
      data: {
        sections: sectionMetrics,
        total: sectionMetrics.length
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;