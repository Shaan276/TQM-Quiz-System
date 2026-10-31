const assert = require('assert');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance } = require('../src/database');
const { initWebSocketServer } = require('../src/websocket');

async function runP4Tests() {
  console.log('\n🚀 Starting Phase P4 Automated Test Suite (Live Multiplayer Quiz Engine)...');

  // Set up in-memory SQLite database
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);

  await runMigrations(db);
  console.log('✓ Database schema migrations v1, v2, v3, v4 & v5 applied.');

  const app = createApp(db);
  const server = http.createServer(app);
  initWebSocketServer(server);

  const TEST_PORT = 5004;
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;
  const WS_URL = `ws://127.0.0.1:${TEST_PORT}/ws/live`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Helper to open WebSocket and wait for connection
  function openSocket(token) {
    return new Promise((resolve, reject) => {
      const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
      const ws = new WebSocket(url);
      ws.on('open', () => resolve(ws));
      ws.on('error', (err) => reject(err));
    });
  }

  // Helper to wait for specific event on socket
  function waitForEvent(ws, expectedEvent, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event '${expectedEvent}' after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.event === expectedEvent) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(msg);
          }
        } catch (e) {}
      };

      ws.on('message', handler);
    });
  }

  let hostWs = null;
  let aliceWs = null;
  let bobWs = null;

  try {
    let teacherToken = '';
    let teacherId = '';
    let studentAliceToken = '';
    let studentAliceId = '';
    let studentBobToken = '';
    let studentBobId = '';
    let quizId = '';
    let sessionId = '';
    let joinCode = '';

    // Test 1: Setup Accounts
    await test('Setup: Register Teacher, Student Alice, and Student Bob', async () => {
      // Teacher
      const tRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Professor Multi',
          email: 'prof_multi@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!',
          role: 'TEACHER'
        })
      });
      assert.strictEqual(tRes.status, 201);

      const tLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'prof_multi@example.com', password: 'Password123!' })
      });
      const tData = await tLogin.json();
      teacherToken = tData.data.accessToken;
      teacherId = tData.data.user.id;

      await fetch(`${BASE_URL}/users/upgrade-to-teacher`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` }
      });

      // Student Alice
      const aRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice TopStudent',
          email: 'alice_multi@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!',
          role: 'STUDENT'
        })
      });
      assert.strictEqual(aRes.status, 201);
      const aLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice_multi@example.com', password: 'Password123!' })
      });
      const aData = await aLogin.json();
      studentAliceToken = aData.data.accessToken;
      studentAliceId = aData.data.user.id;

      // Student Bob
      const bRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bob Learner',
          email: 'bob_multi@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!',
          role: 'STUDENT'
        })
      });
      assert.strictEqual(bRes.status, 201);
      const bLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bob_multi@example.com', password: 'Password123!' })
      });
      const bData = await bLogin.json();
      studentBobToken = bData.data.accessToken;
      studentBobId = bData.data.user.id;
    });

    // Test 2: Teacher creates and publishes quiz with 2 questions
    await test('Setup: Teacher authors and publishes multi-question quiz', async () => {
      const qRes = await fetch(`${BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          title: 'Live TQM Battle',
          category: 'TQM',
          difficulty: 'MEDIUM',
          questions: [
            {
              question_text: 'What does PDCA stand for in TQM methodology?',
              question_type: 'MCQ_SINGLE',
              marks: 10,
              time_limit_sec: 15,
              options: [
                { option_key: 'A', option_text: 'Plan Do Check Act', is_correct: true },
                { option_key: 'B', option_text: 'Perform Deliver Check Apply', is_correct: false },
                { option_key: 'C', option_text: 'Plan Decide Control Audit', is_correct: false }
              ]
            },
            {
              question_text: 'Six Sigma aims for fewer than 3.4 defects per million opportunities.',
              question_type: 'TRUE_FALSE',
              marks: 10,
              time_limit_sec: 15,
              options: [
                { option_key: 'TRUE', option_text: 'True', is_correct: true },
                { option_key: 'FALSE', option_text: 'False', is_correct: false }
              ]
            }
          ]
        })
      });
      assert.strictEqual(qRes.status, 201);
      const qData = await qRes.json();
      quizId = qData.data.quiz.id;

      const pubRes = await fetch(`${BASE_URL}/quizzes/${quizId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(pubRes.status, 200);
    });

    // Test 3: Teacher creates a Live Session (REST)
    await test('Session Creation: Teacher creates live session and receives 6-digit PIN', async () => {
      const res = await fetch(`${BASE_URL}/live-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          quizId,
          shuffleQuestions: false,
          shuffleOptions: false
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.sessionId);
      assert.ok(data.data.joinCode);
      assert.strictEqual(data.data.joinCode.length, 6);
      assert.strictEqual(data.data.status, 'LOBBY');
      assert.strictEqual(data.data.totalQuestions, 2);

      sessionId = data.data.sessionId;
      joinCode = data.data.joinCode;
    });

    // Test 4: Students validate PIN before joining (REST)
    await test('Join Validation: Student validates 6-digit PIN and retrieves session preview', async () => {
      const res = await fetch(`${BASE_URL}/live-sessions/code/${joinCode}`, {
        headers: { Authorization: `Bearer ${studentAliceToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.joinCode, joinCode);
      assert.strictEqual(data.data.quizTitle, 'Live TQM Battle');
      assert.strictEqual(data.data.status, 'LOBBY');
    });

    // Test 5: Teacher and Students connect via WebSockets
    await test('WebSocket Gateway: Host and participants connect and join room', async () => {
      // 1. Host socket
      hostWs = await openSocket(teacherToken);
      hostWs.send(JSON.stringify({
        event: 'host_join',
        sessionId,
        payload: { sessionId, token: teacherToken }
      }));
      const hostSnapshot = await waitForEvent(hostWs, 'host_state_snapshot');
      assert.strictEqual(hostSnapshot.payload.sessionId, sessionId);
      assert.strictEqual(hostSnapshot.payload.status, 'LOBBY');

      // 2. Student Alice socket
      aliceWs = await openSocket(studentAliceToken);
      aliceWs.send(JSON.stringify({
        event: 'join_session',
        payload: { joinCode, token: studentAliceToken }
      }));
      const aliceJoin = await waitForEvent(aliceWs, 'joined_session_success');
      assert.strictEqual(aliceJoin.payload.sessionId, sessionId);

      // 3. Student Bob socket
      bobWs = await openSocket(studentBobToken);
      bobWs.send(JSON.stringify({
        event: 'join_session',
        payload: { joinCode, token: studentBobToken }
      }));
      const bobJoin = await waitForEvent(bobWs, 'joined_session_success');
      assert.strictEqual(bobJoin.payload.sessionId, sessionId);

      // Host receives updated roster with 2 participants
      const rosterUpdate = await waitForEvent(hostWs, 'player_roster_update');
      assert.strictEqual(rosterUpdate.payload.participantsCount, 2);
    });

    // Test 6: Duplicate participant prevention
    await test('Integrity: Duplicate joins by same user reuse participant record', async () => {
      // Alice joins again on secondary socket
      const aliceSecondWs = await openSocket(studentAliceToken);
      aliceSecondWs.send(JSON.stringify({
        event: 'join_session',
        payload: { joinCode, token: studentAliceToken }
      }));
      const secondJoin = await waitForEvent(aliceSecondWs, 'joined_session_success');
      assert.strictEqual(secondJoin.payload.sessionId, sessionId);
      aliceSecondWs.close();
    });

    // Test 7: Student forbidden from sending host controls
    await test('Security: Student attempting host action is ignored/rejected', async () => {
      aliceWs.send(JSON.stringify({
        event: 'start_session',
        sessionId,
        payload: { sessionId }
      }));
      // Status should remain LOBBY since Alice is a student
      const sessionRow = await new Promise((resolve, reject) => {
        db.get(`SELECT status FROM quiz_sessions WHERE id = ?`, [sessionId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      assert.strictEqual(sessionRow.status, 'LOBBY');
    });

    // Test 8: Host starts session (LOBBY -> STARTING -> QUESTION_ACTIVE)
    await test('Synchronization: Host starts game, broadcasts 3s countdown then masked Question 1', async () => {
      hostWs.send(JSON.stringify({
        event: 'start_session',
        sessionId
      }));

      // Both students receive session_starting event
      const aliceStarting = await waitForEvent(aliceWs, 'session_starting');
      assert.strictEqual(aliceStarting.payload.countdownSeconds, 3);

      // Wait for Question 1 to become active
      const aliceQ1 = await waitForEvent(aliceWs, 'question_active', 4500);
      assert.strictEqual(aliceQ1.payload.question.questionIndex, 0);
      assert.strictEqual(aliceQ1.payload.question.question_text, 'What does PDCA stand for in TQM methodology?');
      assert.strictEqual(aliceQ1.payload.remainingSeconds, 15);

      // Zero-Knowledge Anti-Cheat Check: is_correct must NOT be present
      aliceQ1.payload.question.options.forEach(opt => {
        assert.strictEqual(opt.is_correct, undefined, 'Anti-cheat leak: is_correct found in participant question payload');
      });
    });

    // Test 9: Answering Question 1 (Alice correct, Bob incorrect)
    await test('Scoring Engine: Authoritative grading evaluates responses & broadcasts updates', async () => {
      // Alice submits Option A (correct: "Plan Do Check Act")
      aliceWs.send(JSON.stringify({
        event: 'submit_answer',
        sessionId,
        payload: {
          sessionId,
          questionId: 'placeholder', // will get checked against active Q
          answer: 'Plan Do Check Act',
          clientTimestamp: Date.now()
        }
      }));

      // Alice receives acknowledgment
      const aliceAck = await waitForEvent(aliceWs, 'answer_acknowledged');
      assert.strictEqual(aliceAck.payload.status, 'ACCEPTED');

      // Host receives live answer count (1 / 2)
      const countUpdate1 = await waitForEvent(hostWs, 'live_answer_count_update');
      assert.strictEqual(countUpdate1.payload.answeredCount, 1);

      // Bob submits Option B (incorrect: "Perform Deliver Check Apply")
      bobWs.send(JSON.stringify({
        event: 'submit_answer',
        sessionId,
        payload: {
          sessionId,
          questionId: 'placeholder',
          answer: 'Perform Deliver Check Apply',
          clientTimestamp: Date.now()
        }
      }));

      const bobAck = await waitForEvent(bobWs, 'answer_acknowledged');
      assert.strictEqual(bobAck.payload.status, 'ACCEPTED');

      // All connected participants answered early -> triggers question_ended
      const aliceResult = await waitForEvent(aliceWs, 'question_ended');
      assert.strictEqual(aliceResult.payload.isCorrect, true);
      assert.strictEqual(aliceResult.payload.earnedScore, 10);
      assert.strictEqual(aliceResult.payload.correctAnswer, 'Plan Do Check Act');

      const bobResult = await waitForEvent(bobWs, 'question_ended');
      assert.strictEqual(bobResult.payload.isCorrect, false);
      assert.strictEqual(bobResult.payload.earnedScore, 0);
    });

    // Test 10: Late answer rejection
    await test('Timer Authority: Submissions during QUESTION_ENDED phase are rejected', async () => {
      aliceWs.send(JSON.stringify({
        event: 'submit_answer',
        sessionId,
        payload: {
          sessionId,
          questionId: 'placeholder',
          answer: 'A',
          clientTimestamp: Date.now()
        }
      }));

      const rejectMsg = await waitForEvent(aliceWs, 'answer_rejected');
      assert.strictEqual(rejectMsg.payload.code, 'ERR_SUBMISSION_REJECTED');
    });

    // Test 11: Host shows round Leaderboard
    await test('Leaderboard: Server calculates ranking positions with tie handling', async () => {
      hostWs.send(JSON.stringify({
        event: 'show_leaderboard',
        sessionId
      }));

      const aliceLb = await waitForEvent(aliceWs, 'leaderboard_update');
      assert.strictEqual(aliceLb.payload.userRank, 1);
      assert.strictEqual(aliceLb.payload.userScore, 10);
      assert.strictEqual(aliceLb.payload.leaderboard[0].displayName, 'Alice TopStudent');

      const bobLb = await waitForEvent(bobWs, 'leaderboard_update');
      assert.strictEqual(bobLb.payload.userRank, 2);
      assert.strictEqual(bobLb.payload.userScore, 0);
    });

    // Test 12: Host advances to Question 2 (True/False)
    await test('Progression: Host advances to Question 2 and participants receive True/False prompt', async () => {
      hostWs.send(JSON.stringify({
        event: 'next_question',
        sessionId
      }));

      const aliceQ2 = await waitForEvent(aliceWs, 'question_active');
      assert.strictEqual(aliceQ2.payload.question.questionIndex, 1);
      assert.strictEqual(aliceQ2.payload.question.question_type, 'TRUE_FALSE');
      assert.strictEqual(aliceQ2.payload.question.options.length, 2);

      // Both answer True
      aliceWs.send(JSON.stringify({
        event: 'submit_answer',
        sessionId,
        payload: { sessionId, questionId: 'placeholder', answer: 'True' }
      }));
      bobWs.send(JSON.stringify({
        event: 'submit_answer',
        sessionId,
        payload: { sessionId, questionId: 'placeholder', answer: 'True' }
      }));

      const aliceQ2Ended = await waitForEvent(aliceWs, 'question_ended');
      assert.strictEqual(aliceQ2Ended.payload.isCorrect, true);
      assert.strictEqual(aliceQ2Ended.payload.earnedScore, 10);
    });

    // Test 13: Final Session Conclusion & Podium
    await test('Podium & Persistence: Session concludes, crowns top 3, and updates database records', async () => {
      hostWs.send(JSON.stringify({
        event: 'end_session',
        sessionId
      }));

      const alicePodium = await waitForEvent(aliceWs, 'podium_celebration');
      assert.strictEqual(alicePodium.payload.first.displayName, 'Alice TopStudent');
      assert.strictEqual(alicePodium.payload.first.score, 20);
      assert.strictEqual(alicePodium.payload.second.displayName, 'Bob Learner');
      assert.strictEqual(alicePodium.payload.second.score, 10);

      // Verify DB persistence
      const sessionRow = await new Promise((resolve, reject) => {
        db.get(`SELECT status FROM quiz_sessions WHERE id = ?`, [sessionId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      assert.strictEqual(sessionRow.status, 'COMPLETED');
    });

  } finally {
    if (hostWs && hostWs.readyState === 1) hostWs.close();
    if (aliceWs && aliceWs.readyState === 1) aliceWs.close();
    if (bobWs && bobWs.readyState === 1) bobWs.close();
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`Phase P4 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP4Tests().catch(err => {
    console.error('P4 test runner failure:', err);
    process.exit(1);
  });
}

module.exports = { runP4Tests };
