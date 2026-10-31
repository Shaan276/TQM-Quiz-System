const express = require('express');
const { dbGet, dbAll } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { liveSessionManager } = require('../services/liveSessionManager');

const router = express.Router();

// -------------------------------------------------------------
// 1. POST /api/v1/live-sessions - Host creates a live session
// -------------------------------------------------------------
router.post('/', authenticateToken, requireRole('TEACHER', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { quizId, shuffleQuestions, shuffleOptions, timeLimitOverride } = req.body;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_INVALID_REQUEST', message: 'quizId is required to host a session' }
      });
    }

    const sessionState = await liveSessionManager.createSession(quizId, req.user, {
      shuffleQuestions,
      shuffleOptions,
      timeLimitOverride
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: sessionState.id,
        joinCode: sessionState.joinCode,
        quizTitle: sessionState.quizTitle,
        quizCategory: sessionState.quizCategory,
        totalQuestions: sessionState.totalQuestions,
        status: sessionState.status,
        settings: sessionState.settings
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. GET /api/v1/live-sessions/my - Teacher's hosted sessions
// -------------------------------------------------------------
router.get('/my', authenticateToken, requireRole('TEACHER', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const sessions = await dbAll(
      `SELECT s.*, q.title as quiz_title, q.category as quiz_category,
        (SELECT COUNT(*) FROM session_participants WHERE session_id = s.id) as participant_count
       FROM quiz_sessions s
       JOIN quizzes q ON s.quiz_id = q.id
       WHERE s.host_id = ?
       ORDER BY s.created_at DESC LIMIT 50`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: { sessions }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. GET /api/v1/live-sessions/code/:joinCode - Validate PIN & Preview
// -------------------------------------------------------------
router.get('/code/:joinCode', authenticateToken, async (req, res, next) => {
  try {
    const joinCode = req.params.joinCode.trim();
    const session = liveSessionManager.getSessionByPIN(joinCode);

    if (!session) {
      // Check database if it finished
      const dbSession = await dbGet(
        `SELECT s.*, q.title as quiz_title, u.name as host_name 
         FROM quiz_sessions s 
         JOIN quizzes q ON s.quiz_id = q.id 
         JOIN users u ON s.host_id = u.id 
         WHERE s.join_code = ?`,
        [joinCode]
      );

      if (!dbSession) {
        return res.status(404).json({
          success: false,
          error: { code: 'ERR_SESSION_NOT_FOUND', message: 'No live session found with this code' }
        });
      }

      if (['COMPLETED', 'CANCELLED'].includes(dbSession.status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'ERR_SESSION_ENDED', message: `This session has already ${dbSession.status.toLowerCase()}` }
        });
      }
    }

    const participantsCount = session ? session.participants.size : 0;

    res.json({
      success: true,
      data: {
        sessionId: session ? session.id : null,
        joinCode,
        quizTitle: session ? session.quizTitle : 'Live Quiz',
        quizCategory: session ? session.quizCategory : 'General',
        hostName: session ? session.hostName : 'Host',
        status: session ? session.status : 'LOBBY',
        totalQuestions: session ? session.totalQuestions : 0,
        participantsCount
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. GET /api/v1/live-sessions/:id - Get session state
// -------------------------------------------------------------
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = liveSessionManager.getSession(id);

    if (session) {
      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          joinCode: session.joinCode,
          quizTitle: session.quizTitle,
          quizCategory: session.quizCategory,
          hostId: session.hostId,
          hostName: session.hostName,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: session.totalQuestions,
          participantsCount: session.participants.size
        }
      });
    }

    const dbSession = await dbGet(`SELECT * FROM quiz_sessions WHERE id = ?`, [id]);
    if (!dbSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Session not found' }
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: dbSession.id,
        joinCode: dbSession.join_code,
        hostId: dbSession.host_id,
        status: dbSession.status,
        currentQuestionIndex: dbSession.current_question_index,
        totalQuestions: dbSession.total_questions
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 5. GET /api/v1/live-sessions/:id/leaderboard - Session Leaderboard
// -------------------------------------------------------------
router.get('/:id/leaderboard', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = liveSessionManager.getSession(id);

    if (session) {
      const list = Array.from(session.participants.values()).map(p => ({
        id: p.id,
        userId: p.userId,
        displayName: p.displayName,
        score: p.score,
        correctCount: p.correctCount,
        rank: p.rank
      }));
      list.sort((a, b) => b.score - a.score);

      return res.json({
        success: true,
        data: { leaderboard: list }
      });
    }

    const participants = await dbAll(
      `SELECT id, user_id, display_name, score, correct_count, rank 
       FROM session_participants 
       WHERE session_id = ? 
       ORDER BY score DESC, rank ASC`,
      [id]
    );

    res.json({
      success: true,
      data: { leaderboard: participants }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 6. GET /api/v1/live-sessions/:id/results - Full results summary
// -------------------------------------------------------------
router.get('/:id/results', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const sessionRow = await dbGet(
      `SELECT s.*, q.title as quiz_title, u.name as host_name 
       FROM quiz_sessions s
       JOIN quizzes q ON s.quiz_id = q.id
       JOIN users u ON s.host_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (!sessionRow) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Session not found' }
      });
    }

    const participants = await dbAll(
      `SELECT id, user_id, display_name, score, correct_count, rank 
       FROM session_participants 
       WHERE session_id = ? 
       ORDER BY score DESC`,
      [id]
    );

    const answers = await dbAll(
      `SELECT a.*, p.display_name 
       FROM session_answers a 
       JOIN session_participants p ON a.participant_id = p.id 
       WHERE a.session_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        session: sessionRow,
        participants,
        answers,
        podium: {
          first: participants[0] || null,
          second: participants[1] || null,
          third: participants[2] || null
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
