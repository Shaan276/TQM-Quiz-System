const crypto = require('crypto');
const { dbGet, dbRun, dbAll } = require('../database');
const { evaluateQuestionAnswer, formatCorrectAnswer, formatUserAnswer } = require('./scoringEngine');

function generateUUID() {
  return crypto.randomUUID();
}

// In-Memory store for high-speed synchronization
// sessionId -> SessionState
const activeSessions = new Map();
// pin -> sessionId
const pinToSessionId = new Map();
// socket -> socketMeta { userId, role, name, sessionId, isHost }
const socketRegistry = new Map();

/**
 * Extract 3-letter uppercase initials from teacher's name.
 * Examples:
 * - "Anuja Mishra" -> "AJM"
 * - "Vandana Bisht" -> "VDB"
 * - "Vandana Mishra" -> "VDM"
 * - "Anand Pratap Lal" / "A P L" -> "APL"
 */
function getTeacherInitials(teacherName) {
  if (!teacherName || typeof teacherName !== 'string') return 'TQM';
  let cleaned = teacherName.trim();
  // Strip common titles / honorifics (Prof, Dr, Mr, Mrs, Ms)
  cleaned = cleaned.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.|prof|dr|mr|mrs|ms)\s+/i, '');
  cleaned = cleaned.replace(/[^a-zA-Z\s]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TQM';

  // 3 or more words (e.g. "Anand Pratap Lal" -> "APL")
  if (parts.length >= 3) {
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
  }

  // 2 words (e.g. "Anuja Mishra" -> "AJM", "Vandana Bisht" -> "VDB")
  if (parts.length === 2) {
    const w1 = parts[0];
    const w2 = parts[1];
    const firstChar = w1[0].toUpperCase();
    const lastChar = w2[0].toUpperCase();

    let midChar = '';
    const w1Lower = w1.toLowerCase();
    if (w1Lower === 'anuja') {
      midChar = 'J';
    } else if (w1Lower === 'vandana') {
      midChar = 'D';
    } else if (w1.length >= 4 && /[a-zA-Z]/.test(w1[3])) {
      // 4th character matches "Anuja" (idx 3 = j) and "Vandana" (idx 3 = d)
      midChar = w1[3].toUpperCase();
    } else if (w1.length === 3) {
      midChar = w1[1].toUpperCase();
    } else {
      const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
      const consonants = w1.slice(1).split('').filter(c => !vowels.has(c.toLowerCase()));
      midChar = (consonants[0] || w1[1] || 'X').toUpperCase();
    }
    return (firstChar + midChar + lastChar).toUpperCase();
  }

  // Single word name (e.g. "Anuja")
  const w = parts[0];
  if (w.length >= 4) {
    const mid = w.toLowerCase() === 'anuja' ? 'J' : (w.toLowerCase() === 'vandana' ? 'D' : w[3]);
    return (w[0] + mid + w[w.length - 1]).toUpperCase();
  } else if (w.length === 3) {
    return w.toUpperCase();
  }
  return (w + 'XX').slice(0, 3).toUpperCase();
}

/**
 * Generate a unique session Join Code with Teacher's Initials.
 * Structure: [3 LETTERS][2 DIGITS][1 LETTER][2 DIGITS]
 * Examples: AJM63B17, VDM91A63, VDB17T48, APL64O97
 */
async function generateUniquePIN(teacherName) {
  const prefix = getTeacherInitials(teacherName);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  for (let attempt = 0; attempt < 50; attempt++) {
    const d1 = crypto.randomInt(10, 100);
    const letter = letters[crypto.randomInt(0, letters.length)];
    const d2 = crypto.randomInt(10, 100);
    const pin = `${prefix}${d1}${letter}${d2}`;

    if (!pinToSessionId.has(pin)) {
      // Check database to ensure not already assigned to active session
      const existing = await dbGet(
        `SELECT id FROM quiz_sessions WHERE UPPER(join_code) = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
        [pin]
      );
      if (!existing) {
        return pin;
      }
    }
  }

  // Fallback
  return `${prefix}${crypto.randomInt(10, 99)}A${crypto.randomInt(10, 99)}`;
}

/**
 * Helper to mask a question for participants (zero-knowledge anti-cheat)
 */
function maskQuestionForParticipants(q, questionIndex, totalQuestions, timeLimitSec) {
  const masked = {
    questionIndex,
    totalQuestions,
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    marks: Number(q.marks) || 1.0,
    time_limit_sec: timeLimitSec,
    media_url: q.media_url || null
  };

  if (['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(q.question_type) && Array.isArray(q.options)) {
    masked.options = q.options.map(opt => ({
      id: opt.id,
      option_key: opt.option_key,
      option_text: opt.option_text,
      sort_order: opt.sort_order
    }));
  }

  // Answers and explanations are completely scrubbed
  return masked;
}

/**
 * Helper to retrieve snapshot or active questions for a quiz version
 */
async function getQuizVersionQuestions(quizId, version) {
  // Check snapshot
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
      console.error('[LiveSession] Error parsing snapshot data:', e);
    }
  }

  // Fallback to active DB
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

/**
 * Calculate current leaderboard for a session
 */
function calculateLeaderboard(session) {
  const list = Array.from(session.participants.values()).map(p => ({
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    score: Math.round(p.score * 100) / 100,
    correctCount: p.correctCount,
    totalAnswered: p.totalAnswered || 0,
    totalTimeMs: p.totalTimeMs || 0,
    isConnected: p.isConnected
  }));

  // Sort descending by score, tie-break by lower total response time
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalTimeMs - b.totalTimeMs;
  });

  // Assign ranks
  let currentRank = 1;
  list.forEach((item, idx) => {
    if (idx > 0 && item.score === list[idx - 1].score && item.totalTimeMs === list[idx - 1].totalTimeMs) {
      item.rank = list[idx - 1].rank;
    } else {
      item.rank = currentRank;
    }
    currentRank++;
  });

  // Update participant objects
  list.forEach(item => {
    const p = session.participants.get(item.userId);
    if (p) {
      p.rank = item.rank;
    }
  });

  return list;
}

/**
 * Broadcast an event to all connected sockets in a session
 */
function broadcast(session, event, payload) {
  const message = JSON.stringify({
    event,
    sessionId: session.id,
    timestamp: Date.now(),
    payload
  });

  const allSockets = new Set([...session.hostSockets, ...session.participantSockets]);
  for (const ws of allSockets) {
    if (ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('[LiveSession] Failed to send WS frame:', err);
      }
    }
  }
}

/**
 * Broadcast an event specifically to the Host socket(s)
 */
function broadcastHost(session, event, payload) {
  const message = JSON.stringify({
    event,
    sessionId: session.id,
    timestamp: Date.now(),
    payload
  });

  for (const ws of session.hostSockets) {
    if (ws.readyState === 1) {
      try {
        ws.send(message);
      } catch (err) {}
    }
  }
}

/**
 * Send an event to a single WebSocket client
 */
function sendToSocket(ws, event, payload, sessionId = null) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      event,
      sessionId,
      timestamp: Date.now(),
      payload
    }));
  }
}

// ---------------------------------------------------------------------------
// LIVE SESSION ENGINE API
// ---------------------------------------------------------------------------

class LiveSessionManager {
  /**
   * Create a new Live Session
   */
  async createSession(quizId, hostUser, options = {}) {
    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);
    if (!quiz) {
      throw new Error('Quiz not found');
    }

    if (quiz.status !== 'PUBLISHED') {
      throw new Error('Only published quizzes can be hosted in live sessions');
    }

    const version = quiz.published_version || quiz.version || 1;
    const { questions } = await getQuizVersionQuestions(quizId, version);

    if (!questions || questions.length === 0) {
      throw new Error('This quiz has no questions');
    }

    const joinCode = await generateUniquePIN(hostUser?.name || 'Teacher');
    const sessionId = generateUUID();

    const sessionSettings = {
      shuffleQuestions: Boolean(options.shuffleQuestions ?? quiz.shuffle_questions),
      shuffleOptions: Boolean(options.shuffleOptions ?? quiz.shuffle_options),
      timeLimitOverride: options.timeLimitOverride ? Number(options.timeLimitOverride) : null,
      showLeaderboardAfterEach: Boolean(options.showLeaderboardAfterEach ?? true)
    };

    let sessionQuestions = [...questions];
    if (sessionSettings.shuffleQuestions) {
      sessionQuestions.sort(() => Math.random() - 0.5);
    }
    if (sessionSettings.shuffleOptions) {
      sessionQuestions = sessionQuestions.map(q => {
        if (Array.isArray(q.options)) {
          return { ...q, options: [...q.options].sort(() => Math.random() - 0.5) };
        }
        return q;
      });
    }

    await dbRun(
      `INSERT INTO quiz_sessions (
        id, quiz_id, quiz_version, host_id, join_code, status, 
        current_question_index, total_questions, settings
      ) VALUES (?, ?, ?, ?, ?, 'LOBBY', 0, ?, ?)`,
      [
        sessionId,
        quizId,
        version,
        hostUser.id,
        joinCode,
        sessionQuestions.length,
        JSON.stringify(sessionSettings)
      ]
    );

    const sessionState = {
      id: sessionId,
      quizId,
      quizVersion: version,
      quizTitle: quiz.title,
      quizCategory: quiz.category,
      hostId: hostUser.id,
      hostName: hostUser.name,
      joinCode,
      status: 'LOBBY',
      currentQuestionIndex: 0,
      totalQuestions: sessionQuestions.length,
      questions: sessionQuestions,
      settings: sessionSettings,
      participants: new Map(), // userId -> participant
      answersByQuestion: new Map(), // qId -> Map(userId -> answerData)
      timer: null,
      serverStartTime: null,
      serverEndTime: null,
      remainingSeconds: 0,
      pausedRemainingMs: 0,
      hostSockets: new Set(),
      participantSockets: new Set()
    };

    activeSessions.set(sessionId, sessionState);
    pinToSessionId.set(joinCode.toUpperCase(), sessionId);

    console.log(`[LiveSession] Session created: ${sessionId} (PIN: ${joinCode}) by ${hostUser.name}`);
    return sessionState;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return activeSessions.get(sessionId) || null;
  }

  /**
   * Get session by Join Code (Case-insensitive)
   */
  getSessionByPIN(pin) {
    if (!pin || typeof pin !== 'string') return null;
    const cleanPin = pin.trim().toUpperCase();
    const id = pinToSessionId.get(cleanPin);
    if (!id) return null;
    return activeSessions.get(id) || null;
  }

  /**
   * Register host WebSocket connection
   */
  registerHostSocket(sessionId, hostUser, ws) {
    const session = activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Live session not found or expired');
    }

    if (session.hostId !== hostUser.id && hostUser.role !== 'SUPER_ADMIN') {
      throw new Error('Unauthorized host control for this session');
    }

    session.hostSockets.add(ws);
    socketRegistry.set(ws, {
      userId: hostUser.id,
      role: hostUser.role,
      name: hostUser.name,
      sessionId,
      isHost: true
    });

    console.log(`[LiveSession] Host socket connected for session ${session.joinCode}`);

    // Send complete current session snapshot to host
    this.sendFullStateToHost(session, ws);
  }

  /**
   * Register participant WebSocket connection
   */
  async joinParticipantSocket(joinCode, user, ws) {
    const session = this.getSessionByPIN(joinCode);
    if (!session) {
      throw new Error('Invalid or expired session PIN');
    }

    if (['COMPLETED', 'CANCELLED'].includes(session.status)) {
      throw new Error(`This session has already ${session.status.toLowerCase()}`);
    }

    let participant = session.participants.get(user.id);

    if (!participant) {
      // Create new participant in DB and in memory
      const participantId = generateUUID();
      await dbRun(
        `INSERT INTO session_participants (
          id, session_id, user_id, display_name, score, correct_count, rank, is_connected
        ) VALUES (?, ?, ?, ?, 0.0, 0, 0, 1)`,
        [participantId, session.id, user.id, user.name]
      );

      participant = {
        id: participantId,
        userId: user.id,
        displayName: user.name,
        score: 0.0,
        correctCount: 0,
        rank: 0,
        totalAnswered: 0,
        totalTimeMs: 0,
        isConnected: true,
        sockets: new Set()
      };
      session.participants.set(user.id, participant);
    } else {
      participant.isConnected = true;
      await dbRun(
        `UPDATE session_participants SET is_connected = 1, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [participant.id]
      );
    }

    participant.sockets.add(ws);
    session.participantSockets.add(ws);

    socketRegistry.set(ws, {
      userId: user.id,
      role: user.role,
      name: user.name,
      sessionId: session.id,
      isHost: false
    });

    console.log(`[LiveSession] Student ${user.name} joined session ${session.joinCode} (Participants: ${session.participants.size})`);

    // Acknowledge to student
    sendToSocket(ws, 'joined_session_success', {
      sessionId: session.id,
      joinCode: session.joinCode,
      quizTitle: session.quizTitle,
      quizCategory: session.quizCategory,
      hostName: session.hostName,
      status: session.status,
      participantId: participant.id,
      totalQuestions: session.totalQuestions,
      currentQuestionIndex: session.currentQuestionIndex
    }, session.id);

    // Broadcast updated player roster to host
    this.broadcastRosterUpdate(session);

    // Broadcast active player count to all
    broadcast(session, 'session_state_change', {
      status: session.status,
      activeParticipantsCount: session.participants.size
    });

    // If session is already in progress, synchronize current question or state to reconnecting student
    if (session.status === 'QUESTION_ACTIVE') {
      this.syncActiveQuestionToParticipant(session, user.id, ws);
    } else if (session.status === 'QUESTION_ENDED') {
      this.syncQuestionEndedToParticipant(session, user.id, ws);
    } else if (session.status === 'LEADERBOARD') {
      const leaderboard = calculateLeaderboard(session);
      const userRank = participant.rank;
      sendToSocket(ws, 'leaderboard_update', {
        leaderboard: leaderboard.slice(0, 10),
        userRank,
        userScore: participant.score
      }, session.id);
    }
  }

  /**
   * Broadcast participant roster update to host
   */
  broadcastRosterUpdate(session) {
    const roster = Array.from(session.participants.values()).map(p => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      score: p.score,
      isConnected: p.isConnected
    }));

    broadcastHost(session, 'player_roster_update', {
      participantsCount: roster.length,
      participants: roster
    });
  }

  /**
   * Synchronize active question state to a specific participant
   */
  syncActiveQuestionToParticipant(session, userId, ws) {
    const currentQ = session.questions[session.currentQuestionIndex];
    if (!currentQ) return;

    const timeLimitSec = session.settings.timeLimitOverride || currentQ.time_limit_sec || 30;
    const now = Date.now();
    const remainingMs = Math.max(0, (session.serverEndTime || now) - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    const masked = maskQuestionForParticipants(
      currentQ,
      session.currentQuestionIndex,
      session.totalQuestions,
      timeLimitSec
    );

    // Check if participant has already answered this question
    const answersMap = session.answersByQuestion.get(currentQ.id);
    const existingAnswer = answersMap ? answersMap.get(userId) : null;

    sendToSocket(ws, 'question_active', {
      question: masked,
      serverStartTime: session.serverStartTime,
      serverEndTime: session.serverEndTime,
      remainingSeconds,
      alreadyAnswered: Boolean(existingAnswer),
      userAnswer: existingAnswer ? existingAnswer.userAnswerDisplay : null
    }, session.id);
  }

  /**
   * Synchronize question ended state to a specific participant
   */
  syncQuestionEndedToParticipant(session, userId, ws) {
    const currentQ = session.questions[session.currentQuestionIndex];
    if (!currentQ) return;

    const answersMap = session.answersByQuestion.get(currentQ.id) || new Map();
    const userAns = answersMap.get(userId);

    sendToSocket(ws, 'question_ended', {
      questionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      correctAnswer: formatCorrectAnswer(currentQ),
      explanation: currentQ.explanation || '',
      userAnswer: userAns ? userAns.userAnswerDisplay : '(Unanswered)',
      isCorrect: userAns ? userAns.isCorrect === 1 : false,
      earnedScore: userAns ? userAns.earnedScore : 0
    }, session.id);
  }

  /**
   * Send full state snapshot to Host
   */
  sendFullStateToHost(session, ws) {
    const currentQ = session.questions[session.currentQuestionIndex];
    const answersMap = currentQ ? (session.answersByQuestion.get(currentQ.id) || new Map()) : new Map();

    const now = Date.now();
    const remainingMs = session.serverEndTime ? Math.max(0, session.serverEndTime - now) : 0;

    sendToSocket(ws, 'host_state_snapshot', {
      sessionId: session.id,
      joinCode: session.joinCode,
      quizTitle: session.quizTitle,
      quizCategory: session.quizCategory,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      currentQuestion: currentQ || null,
      answeredCount: answersMap.size,
      totalParticipants: session.participants.size,
      participants: Array.from(session.participants.values()).map(p => ({
        id: p.id,
        userId: p.userId,
        displayName: p.displayName,
        score: p.score,
        correctCount: p.correctCount,
        isConnected: p.isConnected
      })),
      remainingSeconds: Math.ceil(remainingMs / 1000),
      isPaused: session.status === 'PAUSED',
      leaderboard: calculateLeaderboard(session).slice(0, 10)
    }, session.id);
  }

  /**
   * Start Session (Host control: LOBBY -> STARTING -> QUESTION_ACTIVE)
   */
  async startSession(sessionId, hostUserId) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.hostId !== hostUserId) throw new Error('Unauthorized');

    if (session.status !== 'LOBBY') {
      throw new Error(`Cannot start session in state ${session.status}`);
    }

    session.status = 'STARTING';
    await dbRun(`UPDATE quiz_sessions SET status = 'STARTING' WHERE id = ?`, [sessionId]);

    broadcast(session, 'session_starting', {
      countdownSeconds: 3,
      totalQuestions: session.totalQuestions
    });

    // 3-second starting countdown before first question
    setTimeout(() => {
      if (session.status === 'STARTING') {
        this.activateQuestion(session, 0);
      }
    }, 3000);

    return { success: true };
  }

  /**
   * Activate a specific question
   */
  async activateQuestion(session, questionIndex) {
    if (questionIndex >= session.totalQuestions) {
      await this.endSession(session.id, session.hostId);
      return;
    }

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    session.status = 'QUESTION_ACTIVE';
    session.currentQuestionIndex = questionIndex;

    const currentQ = session.questions[questionIndex];
    const timeLimitSec = session.settings.timeLimitOverride || currentQ.time_limit_sec || 30;

    const startTime = Date.now();
    const endTime = startTime + (timeLimitSec * 1000);

    session.serverStartTime = startTime;
    session.serverEndTime = endTime;
    session.remainingSeconds = timeLimitSec;

    // Initialize answer bucket for this question
    if (!session.answersByQuestion.has(currentQ.id)) {
      session.answersByQuestion.set(currentQ.id, new Map());
    }

    await dbRun(
      `UPDATE quiz_sessions SET 
        status = 'QUESTION_ACTIVE', 
        current_question_index = ?, 
        question_start_time = ?, 
        question_end_time = ? 
       WHERE id = ?`,
      [questionIndex, new Date(startTime).toISOString(), new Date(endTime).toISOString(), session.id]
    );

    // 1. Broadcast masked question to participants
    const maskedQuestion = maskQuestionForParticipants(
      currentQ,
      questionIndex,
      session.totalQuestions,
      timeLimitSec
    );

    for (const ws of session.participantSockets) {
      if (ws.readyState === 1) {
        sendToSocket(ws, 'question_active', {
          question: maskedQuestion,
          serverStartTime: startTime,
          serverEndTime: endTime,
          remainingSeconds: timeLimitSec,
          alreadyAnswered: false
        }, session.id);
      }
    }

    // 2. Broadcast question with full details & answer key to host
    for (const ws of session.hostSockets) {
      if (ws.readyState === 1) {
        sendToSocket(ws, 'host_question_active', {
          questionIndex,
          totalQuestions: session.totalQuestions,
          question: currentQ,
          timeLimitSec,
          serverStartTime: startTime,
          serverEndTime: endTime,
          answeredCount: 0,
          totalParticipants: session.participants.size
        }, session.id);
      }
    }

    // Authoritative Server Timer: Auto-expire question when timeLimitSec ends
    session.timer = setTimeout(() => {
      if (session.status === 'QUESTION_ACTIVE' && session.currentQuestionIndex === questionIndex) {
        this.endQuestion(session.id);
      }
    }, timeLimitSec * 1000);

    console.log(`[LiveSession ${session.joinCode}] Q${questionIndex + 1}/${session.totalQuestions} active (${timeLimitSec}s)`);
  }

  /**
   * Submit participant answer for currently active question
   */
  async submitAnswer(sessionId, userId, questionId, rawAnswer, clientTimestamp) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Live session not found');

    if (session.status !== 'QUESTION_ACTIVE') {
      throw new Error('Answers are not currently accepted for this question');
    }

    const currentQ = session.questions[session.currentQuestionIndex];
    if (!currentQ) {
      throw new Error('No active question in this session');
    }
    if (questionId && questionId !== 'placeholder' && currentQ.id !== questionId) {
      throw new Error('Mismatched active question');
    }

    // Authoritative Server Deadline Check (+ 1500ms network latency buffer)
    const now = Date.now();
    const GRACE_BUFFER_MS = 1500;
    if (now > (session.serverEndTime + GRACE_BUFFER_MS)) {
      throw new Error('Question time limit has expired');
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw new Error('Participant not registered in this session');
    }

    const answersMap = session.answersByQuestion.get(currentQ.id);
    if (answersMap && answersMap.has(userId)) {
      throw new Error('Duplicate submission: you have already answered this question');
    }

    // Authoritatively evaluate with scoring engine
    const evalResult = evaluateQuestionAnswer(currentQ, rawAnswer);
    const timeTakenMs = Math.max(0, now - (session.serverStartTime || now));

    // Persist in DB
    const answerId = generateUUID();
    await dbRun(
      `INSERT INTO session_answers (
        id, session_id, participant_id, question_id, question_index, 
        user_answer, is_correct, earned_score, time_taken_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        answerId,
        sessionId,
        participant.id,
        currentQ.id,
        session.currentQuestionIndex,
        evalResult.userAnswerDisplay,
        evalResult.isCorrect,
        evalResult.earnedScore,
        timeTakenMs
      ]
    );

    // Update in-memory participant stats
    participant.score += evalResult.earnedScore;
    participant.score = Math.round(participant.score * 100) / 100;
    if (evalResult.isCorrect === 1) {
      participant.correctCount += 1;
    }
    participant.totalAnswered = (participant.totalAnswered || 0) + 1;
    participant.totalTimeMs = (participant.totalTimeMs || 0) + timeTakenMs;

    // Update DB participant score
    await dbRun(
      `UPDATE session_participants SET 
        score = ?, 
        correct_count = ?, 
        last_seen_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [participant.score, participant.correctCount, participant.id]
    );

    // Record answer in session state
    answersMap.set(userId, {
      answerId,
      rawAnswer,
      userAnswerDisplay: evalResult.userAnswerDisplay,
      isCorrect: evalResult.isCorrect,
      earnedScore: evalResult.earnedScore,
      timeTakenMs,
      submittedAt: now
    });

    console.log(`[LiveSession ${session.joinCode}] Answer from ${participant.displayName}: Score +${evalResult.earnedScore}`);

    // Acknowledge submission to student socket
    for (const ws of participant.sockets) {
      sendToSocket(ws, 'answer_acknowledged', {
        questionId: currentQ.id,
        status: 'ACCEPTED',
        userAnswer: evalResult.userAnswerDisplay,
        submittedAt: now
      }, sessionId);
    }

    // Update live answer count on host screen
    broadcastHost(session, 'live_answer_count_update', {
      questionId: currentQ.id,
      answeredCount: answersMap.size,
      totalParticipants: session.participants.size
    });

    // If 100% of connected participants have answered, trigger early end
    if (answersMap.size >= session.participants.size && session.participants.size > 0) {
      console.log(`[LiveSession ${session.joinCode}] All participants answered early.`);
      if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
      }
      setTimeout(() => {
        if (session.status === 'QUESTION_ACTIVE') {
          this.endQuestion(session.id);
        }
      }, 500);
    }

    return { success: true, earnedScore: evalResult.earnedScore };
  }

  /**
   * End Question (Auto timer or host action)
   */
  async endQuestion(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    session.status = 'QUESTION_ENDED';
    await dbRun(`UPDATE quiz_sessions SET status = 'QUESTION_ENDED' WHERE id = ?`, [sessionId]);

    const currentQ = session.questions[session.currentQuestionIndex];
    const answersMap = session.answersByQuestion.get(currentQ.id) || new Map();
    const correctAnswer = formatCorrectAnswer(currentQ);

    // Calculate choice distribution for host screen
    const distribution = {};
    if (currentQ.options && Array.isArray(currentQ.options)) {
      currentQ.options.forEach(opt => {
        distribution[opt.option_key || opt.option_text] = 0;
      });
      for (const ans of answersMap.values()) {
        const key = ans.userAnswerDisplay;
        distribution[key] = (distribution[key] || 0) + 1;
      }
    }

    // 1. Send individual result to each participant socket
    for (const p of session.participants.values()) {
      const userAns = answersMap.get(p.userId);
      const isCorrect = userAns ? userAns.isCorrect === 1 : false;
      const earnedScore = userAns ? userAns.earnedScore : 0;

      for (const ws of p.sockets) {
        sendToSocket(ws, 'question_ended', {
          questionIndex: session.currentQuestionIndex,
          totalQuestions: session.totalQuestions,
          correctAnswer,
          explanation: currentQ.explanation || '',
          userAnswer: userAns ? userAns.userAnswerDisplay : '(Unanswered)',
          isCorrect,
          earnedScore,
          currentTotalScore: p.score
        }, sessionId);
      }
    }

    // 2. Send distribution breakdown and summary to host
    broadcastHost(session, 'host_question_ended', {
      questionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      correctAnswer,
      explanation: currentQ.explanation || '',
      distribution,
      totalAnswered: answersMap.size,
      totalParticipants: session.participants.size
    });

    console.log(`[LiveSession ${session.joinCode}] Question ${session.currentQuestionIndex + 1} ended.`);
  }

  /**
   * Show Leaderboard (Host control: QUESTION_ENDED -> LEADERBOARD)
   */
  async showLeaderboard(sessionId, hostUserId) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.hostId !== hostUserId) throw new Error('Unauthorized');

    session.status = 'LEADERBOARD';
    await dbRun(`UPDATE quiz_sessions SET status = 'LEADERBOARD' WHERE id = ?`, [sessionId]);

    const leaderboard = calculateLeaderboard(session);

    // Update ranks in DB
    for (const item of leaderboard) {
      await dbRun(
        `UPDATE session_participants SET rank = ? WHERE id = ?`,
        [item.rank, item.id]
      );
    }

    // Broadcast leaderboard to all
    for (const p of session.participants.values()) {
      for (const ws of p.sockets) {
        sendToSocket(ws, 'leaderboard_update', {
          leaderboard: leaderboard.slice(0, 10),
          userRank: p.rank,
          userScore: p.score
        }, sessionId);
      }
    }

    broadcastHost(session, 'host_leaderboard_update', {
      leaderboard: leaderboard.slice(0, 15),
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      hasNextQuestion: (session.currentQuestionIndex + 1) < session.totalQuestions
    });

    return { success: true, leaderboard };
  }

  /**
   * Advance to Next Question (Host control)
   */
  async nextQuestion(sessionId, hostUserId) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.hostId !== hostUserId) throw new Error('Unauthorized');

    // Force progression: safely cancel any active timer
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.totalQuestions) {
      return this.endSession(sessionId, hostUserId);
    }

    await this.activateQuestion(session, nextIndex);
    return { success: true, nextIndex };
  }

  /**
   * Pause Session (Host control)
   */
  pauseSession(sessionId, hostUserId) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.hostId !== hostUserId) throw new Error('Unauthorized');

    if (session.status !== 'QUESTION_ACTIVE') {
      throw new Error('Can only pause an active question');
    }

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    const now = Date.now();
    session.pausedRemainingMs = Math.max(0, (session.serverEndTime || now) - now);
    session.status = 'PAUSED';

    broadcast(session, 'session_paused', {
      remainingSeconds: Math.ceil(session.pausedRemainingMs / 1000)
    });

    return { success: true };
  }

  /**
   * Resume Session (Host control)
   */
  resumeSession(sessionId, hostUserId) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.hostId !== hostUserId) throw new Error('Unauthorized');

    if (session.status !== 'PAUSED') {
      throw new Error('Session is not paused');
    }

    const now = Date.now();
    const remainingMs = session.pausedRemainingMs || 5000;
    session.serverStartTime = now;
    session.serverEndTime = now + remainingMs;
    session.status = 'QUESTION_ACTIVE';

    session.timer = setTimeout(() => {
      if (session.status === 'QUESTION_ACTIVE') {
        this.endQuestion(session.id);
      }
    }, remainingMs);

    broadcast(session, 'session_resumed', {
      serverStartTime: session.serverStartTime,
      serverEndTime: session.serverEndTime,
      remainingSeconds: Math.ceil(remainingMs / 1000)
    });

    return { success: true };
  }

  /**
   * End Session & Compute Final Podium Celebration
   */
  async endSession(sessionId, hostUserId) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.hostId !== hostUserId && hostUserId !== 'SYSTEM') throw new Error('Unauthorized');

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    session.status = 'COMPLETED';
    await dbRun(
      `UPDATE quiz_sessions SET status = 'COMPLETED', ended_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [sessionId]
    );

    const fullLeaderboard = calculateLeaderboard(session);
    const podium = {
      first: fullLeaderboard[0] || null,
      second: fullLeaderboard[1] || null,
      third: fullLeaderboard[2] || null,
      totalParticipants: fullLeaderboard.length,
      fullLeaderboard
    };

    // Update final ranks in DB
    for (const item of fullLeaderboard) {
      await dbRun(
        `UPDATE session_participants SET rank = ? WHERE id = ?`,
        [item.rank, item.id]
      );
    }

    broadcast(session, 'podium_celebration', podium);

    // Free PIN for reuse
    pinToSessionId.delete(session.joinCode);

    console.log(`[LiveSession ${session.joinCode}] Session completed! Winner: ${podium.first?.displayName || 'None'}`);
    return podium;
  }

  /**
   * Handle WebSocket Disconnect
   */
  handleDisconnect(ws) {
    const meta = socketRegistry.get(ws);
    if (!meta) return;

    socketRegistry.delete(ws);
    const session = activeSessions.get(meta.sessionId);
    if (!session) return;

    if (meta.isHost) {
      session.hostSockets.delete(ws);
      console.log(`[LiveSession ${session.joinCode}] Host socket disconnected.`);
    } else {
      session.participantSockets.delete(ws);
      const participant = session.participants.get(meta.userId);
      if (participant) {
        participant.sockets.delete(ws);
        if (participant.sockets.size === 0) {
          participant.isConnected = false;
          dbRun(
            `UPDATE session_participants SET is_connected = 0, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [participant.id]
          ).catch(() => {});
        }
      }
      this.broadcastRosterUpdate(session);
    }
  }

  /**
   * Clean up and remove an active session from memory
   */
  removeSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
      }
      pinToSessionId.delete(session.joinCode);
      activeSessions.delete(sessionId);
    }
  }
}

const liveSessionManager = new LiveSessionManager();
module.exports = {
  liveSessionManager,
  socketRegistry,
  getTeacherInitials,
  generateUniquePIN
};
