const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance } = require('../src/database');

async function runP3Tests() {
  console.log('\n🚀 Starting Phase P3 Automated Test Suite (Self-Paced Attempts, Scoring & Mistake Notebook)...');

  // Set up in-memory SQLite database
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);

  await runMigrations(db);
  console.log('✓ Database schema migrations v1, v2 & v3 applied.');

  const app = createApp(db);
  const server = app.listen(5003);
  const BASE_URL = 'http://127.0.0.1:5003/api/v1';

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

  try {
    let teacherToken = '';
    let studentToken = '';
    let adminToken = '';
    let studentId = '';
    let teacherId = '';
    let quizId = '';
    let attemptId = '';
    let mistakeId = '';

    // Test 1: Setup Accounts (Teacher, Student, Admin)
    await test('Setup: Register Teacher, Student, and Super Admin accounts', async () => {
      // 1. Teacher
      const tRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Professor Smith',
          email: 'prof_smith@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!',
          role: 'TEACHER'
        })
      });
      assert.strictEqual(tRes.status, 201);

      const tLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'prof_smith@example.com', password: 'Password123!' })
      });
      const tData = await tLogin.json();
      teacherToken = tData.data.accessToken;
      teacherId = tData.data.user.id;

      // Upgrade to ensure role
      await fetch(`${BASE_URL}/users/upgrade-to-teacher`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` }
      });

      // 2. Student
      const sRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice Student',
          email: 'alice_learner@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!',
          role: 'STUDENT'
        })
      });
      assert.strictEqual(sRes.status, 201);

      const sLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice_learner@example.com', password: 'Password123!' })
      });
      const sData = await sLogin.json();
      studentToken = sData.data.accessToken;
      studentId = sData.data.user.id;

      // 3. Admin setup
      const aRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Super Admin',
          email: 'admin_master@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!'
        })
      });
      assert.strictEqual(aRes.status, 201);

      // Promote to SUPER_ADMIN directly in db for test
      await new Promise((resolve, reject) => {
        db.run(`UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'admin_master@example.com'`, err => {
          if (err) reject(err); else resolve();
        });
      });

      const aLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin_master@example.com', password: 'Password123!' })
      });
      const aData = await aLogin.json();
      adminToken = aData.data.accessToken;
      assert.ok(adminToken);
    });

    // Test 2: Role Authorization Guards
    await test('RBAC Guards: Student blocked from teacher endpoint; Super Admin allowed', async () => {
      // Student accessing creator-only endpoint
      const res1 = await fetch(`${BASE_URL}/users/creator-only`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(res1.status, 403);

      // Teacher accessing creator-only endpoint
      const res2 = await fetch(`${BASE_URL}/users/creator-only`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(res2.status, 200);

      // Super Admin accessing admin endpoint
      const res3 = await fetch(`${BASE_URL}/users/admin-only`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(res3.status, 200);
    });

    // Test 3: Super Admin User Management
    await test('Admin: Super Admin can list users and update user roles', async () => {
      const res = await fetch(`${BASE_URL}/users?limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.users.length >= 3);

      // Update role test
      const patchRes = await fetch(`${BASE_URL}/users/${studentId}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'STUDENT' })
      });
      assert.strictEqual(patchRes.status, 200);
    });

    // Test 4: Teacher creates comprehensive quiz with all 6 question types
    await test('Teacher: Create quiz with 6 question types and publish it', async () => {
      const quizPayload = {
        title: 'TQM Principles & Statistics Exam',
        description: 'Comprehensive test covering Quality Management, Pareto charts, and tolerance limits.',
        category: 'TQM (Total Quality Management)',
        difficulty: 'MEDIUM',
        timeLimitSec: 600, // 10 minutes
        passPercentage: 60,
        showExplanations: 'AFTER_SUBMIT',
        questions: [
          // 1. Single MCQ (2 marks)
          {
            question_text: 'Who introduced the 14 Points for Management in Quality Improvement?',
            question_type: 'MCQ_SINGLE',
            marks: 2,
            time_limit_sec: 60,
            explanation: 'W. Edwards Deming introduced the 14 Points for Management.',
            options: [
              { option_key: 'A', option_text: 'Joseph Juran', is_correct: 0 },
              { option_key: 'B', option_text: 'W. Edwards Deming', is_correct: 1 },
              { option_key: 'C', option_text: 'Kaoru Ishikawa', is_correct: 0 },
              { option_key: 'D', option_text: 'Philip Crosby', is_correct: 0 }
            ]
          },
          // 2. Multi MCQ (2 marks)
          {
            question_text: 'Which of the following are included in the 7 QC Tools? (Select all that apply)',
            question_type: 'MCQ_MULTI',
            marks: 2,
            time_limit_sec: 60,
            explanation: 'Pareto Charts and Fishbone Diagrams are classical 7 QC tools.',
            options: [
              { option_key: 'A', option_text: 'Pareto Chart', is_correct: 1 },
              { option_key: 'B', option_text: 'Cause and Effect (Fishbone) Diagram', is_correct: 1 },
              { option_key: 'C', option_text: 'Quantum Computing Simulators', is_correct: 0 }
            ]
          },
          // 3. True/False (1 mark)
          {
            question_text: 'Kaizen represents continuous incremental improvement.',
            question_type: 'TRUE_FALSE',
            marks: 1,
            time_limit_sec: 30,
            explanation: 'Kaizen is Japanese for change for the better or continuous improvement.',
            options: [
              { option_key: 'T', option_text: 'True', is_correct: 1 },
              { option_key: 'F', option_text: 'False', is_correct: 0 }
            ]
          },
          // 4. Fill in Blank (2 marks)
          {
            question_text: 'The 80/20 rule in quality control is officially known as the ______ Principle.',
            question_type: 'FILL_BLANK',
            marks: 2,
            time_limit_sec: 45,
            explanation: 'Vilfredo Pareto developed the Pareto Principle.',
            answers: [
              { expected_answer: 'Pareto', is_case_sensitive: 0 }
            ]
          },
          // 5. Short Answer (2 marks)
          {
            question_text: 'What does PDCA stand for in TQM cycles?',
            question_type: 'SHORT_ANSWER',
            marks: 2,
            time_limit_sec: 60,
            explanation: 'PDCA stands for Plan Do Check Act.',
            answers: [
              { expected_answer: 'Plan Do Check Act', is_case_sensitive: 0 }
            ]
          },
          // 6. Numerical (2 marks, tolerance 0.05)
          {
            question_text: 'If process mean is 10.0 and standard deviation is 0.5, what is the 3-sigma Upper Control Limit (UCL)?',
            question_type: 'NUMERICAL',
            marks: 2,
            time_limit_sec: 60,
            explanation: 'UCL = mean + 3 * sigma = 10.0 + 3 * 0.5 = 11.5',
            answers: [
              { expected_answer: '11.5', numeric_tolerance: 0.05 }
            ]
          }
        ]
      };

      const createRes = await fetch(`${BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teacherToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quizPayload)
      });
      assert.strictEqual(createRes.status, 201);
      const createJson = await createRes.json();
      quizId = createJson.data.quiz.id;
      assert.ok(quizId);

      // Publish quiz
      const pubRes = await fetch(`${BASE_URL}/quizzes/${quizId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(pubRes.status, 200);
    });

    // Test 5: Quiz Discovery
    await test('Discovery: Student discovers published quiz without answers or explanations leaking', async () => {
      const res = await fetch(`${BASE_URL}/quizzes/discover?category=TQM (Total Quality Management)`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const found = json.data.quizzes.find(q => q.id === quizId);
      assert.ok(found);
      assert.strictEqual(found.question_count, 6);
      assert.strictEqual(found.total_marks, 11);
      assert.strictEqual(found.creator_name, 'Professor Smith');
      // Verify no question answers or explanations leaked
      assert.strictEqual(found.questions, undefined);
    });

    // Test 6: Start Quiz Attempt & Masking
    let q1Id, q2Id, q3Id, q4Id, q5Id, q6Id;
    let q1OptBId, q2OptAId, q2OptCId;

    await test('Attempts: Student starts attempt with masked questions and authoritative timer', async () => {
      const res = await fetch(`${BASE_URL}/attempts/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quizId })
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      attemptId = json.data.attemptId;
      assert.ok(attemptId);
      assert.strictEqual(json.data.quiz.total_questions, 6);
      assert.strictEqual(json.data.quiz.max_score, 11);
      assert.ok(json.data.remainingSeconds > 590);

      const qs = json.data.questions;
      assert.strictEqual(qs.length, 6);

      // Verify that NO question leaked explanation or is_correct
      qs.forEach(q => {
        assert.strictEqual(q.explanation, undefined);
        if (q.options) {
          q.options.forEach(opt => {
            assert.strictEqual(opt.is_correct, undefined);
          });
        }
      });

      // Capture question IDs for answer submission
      const q1 = qs.find(q => q.question_type === 'MCQ_SINGLE');
      q1Id = q1.id;
      const optB = q1.options.find(o => o.option_key === 'B' || o.option_text.includes('Deming'));
      q1OptBId = optB.id;

      const q2 = qs.find(q => q.question_type === 'MCQ_MULTI');
      q2Id = q2.id;
      const optA = q2.options.find(o => o.option_key === 'A' || o.option_text.includes('Pareto'));
      const optC = q2.options.find(o => o.option_key === 'C' || o.option_text.includes('Quantum'));
      q2OptAId = optA.id;
      q2OptCId = optC.id;

      const q3 = qs.find(q => q.question_type === 'TRUE_FALSE');
      q3Id = q3.id;

      const q4 = qs.find(q => q.question_type === 'FILL_BLANK');
      q4Id = q4.id;

      const q5 = qs.find(q => q.question_type === 'SHORT_ANSWER');
      q5Id = q5.id;

      const q6 = qs.find(q => q.question_type === 'NUMERICAL');
      q6Id = q6.id;
    });

    // Test 7: Autosave answers
    await test('Attempts: Save intermediate answers via PUT /attempts/:id/answers', async () => {
      const saveRes = await fetch(`${BASE_URL}/attempts/${attemptId}/answers`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: [
            { questionId: q1Id, answer: q1OptBId },
            { questionId: q4Id, answer: 'pareto' }
          ]
        })
      });
      assert.strictEqual(saveRes.status, 200);

      // Check state
      const stateRes = await fetch(`${BASE_URL}/attempts/${attemptId}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(stateRes.status, 200);
      const stateJson = await stateRes.json();
      assert.strictEqual(stateJson.data.savedAnswers[q1Id], q1OptBId);
      assert.strictEqual(stateJson.data.savedAnswers[q4Id], 'pareto');
    });

    // Test 8: Authoritative Server-side Scoring Engine
    await test('Scoring Engine: Accurately evaluates all 6 types, penalties, and marks passed', async () => {
      // Alice answers:
      // Q1 (MCQ_SINGLE): Deming (Correct: +2 marks)
      // Q2 (MCQ_MULTI): Pareto (correct) + Quantum (incorrect) -> 1/2 correct = 1.0 - 0.25 penalty = 0.75 marks (is_correct = 0)
      // Q3 (TRUE_FALSE): True (Correct: +1 mark)
      // Q4 (FILL_BLANK): "  pareto  " (Correct case-insensitive: +2 marks)
      // Q5 (SHORT_ANSWER): "Plan Do Check Act" (Correct: +2 marks)
      // Q6 (NUMERICAL): "11.48" (Target 11.5, within ±0.05 tolerance: +2 marks)
      // Total earned: 2 + 0.75 + 1 + 2 + 2 + 2 = 9.75 out of 11 marks = 88.64% (Passed >= 60%)
      const submitRes = await fetch(`${BASE_URL}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: [
            { questionId: q1Id, answer: q1OptBId },
            { questionId: q2Id, answer: [q2OptAId, q2OptCId] },
            { questionId: q3Id, answer: 'True' },
            { questionId: q4Id, answer: '   pareto   ' },
            { questionId: q5Id, answer: 'Plan Do Check Act' },
            { questionId: q6Id, answer: '11.48' }
          ]
        })
      });

      assert.strictEqual(submitRes.status, 200);
      const json = await submitRes.json();
      assert.strictEqual(json.data.status, 'COMPLETED');
      assert.strictEqual(json.data.isPassed, true);
      assert.strictEqual(json.data.score, 9.75);
      assert.strictEqual(json.data.maxScore, 11);
      assert.strictEqual(json.data.scorePercentage, 88.64);
      assert.strictEqual(json.data.correctAnswers, 5);
      assert.strictEqual(json.data.incorrectAnswers, 1); // Q2 had error
    });

    // Test 9: Mistake Notebook Logging & Resolution
    await test('Mistake Notebook: Incorrect question (Q2) automatically logged and can be resolved', async () => {
      const res = await fetch(`${BASE_URL}/mistakes`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.mistakes.length, 1);

      const mistake = json.data.mistakes[0];
      mistakeId = mistake.id;
      assert.strictEqual(mistake.question_id, q2Id);
      assert.strictEqual(mistake.is_resolved, 0);
      assert.strictEqual(mistake.subject, 'TQM (Total Quality Management)');
      assert.ok(mistake.correct_answer.includes('Pareto'));

      // Check stats
      const statsRes = await fetch(`${BASE_URL}/mistakes/stats`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const statsJson = await statsRes.json();
      assert.strictEqual(statsJson.data.totalMistakes, 1);
      assert.strictEqual(statsJson.data.unresolvedCount, 1);

      // Toggle resolution
      const patchRes = await fetch(`${BASE_URL}/mistakes/${mistakeId}/resolve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isResolved: true })
      });
      assert.strictEqual(patchRes.status, 200);
      const patchJson = await patchRes.json();
      assert.strictEqual(patchJson.data.isResolved, true);
    });

    // Test 10: Result Summary & Review
    await test('Results: Student can view full result summary and review explanations', async () => {
      const res = await fetch(`${BASE_URL}/attempts/${attemptId}/summary`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.attempt.scorePercentage, 88.64);
      assert.strictEqual(json.data.reviewQuestions.length, 6);

      // Check that explanations are included since show_explanations was AFTER_SUBMIT
      const q1Review = json.data.reviewQuestions.find(q => q.id === q1Id);
      assert.strictEqual(q1Review.is_correct, true);
      assert.ok(q1Review.explanation.includes('Deming'));
    });

    // Test 11: Attempt History
    await test('History: Student can view their attempt history', async () => {
      const res = await fetch(`${BASE_URL}/attempts/history/my`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.attempts.length, 1);
      assert.strictEqual(json.data.attempts[0].quiz_title, 'TQM Principles & Statistics Exam');
    });

    // Test 12: Teacher Attempt Analytics & Breakdown
    await test('Teacher Analytics: Teacher sees student attempts on their authored quiz', async () => {
      const res = await fetch(`${BASE_URL}/attempts/quiz/${quizId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.attempts.length, 1);
      assert.strictEqual(json.data.attempts[0].student_name, 'Alice Student');
      assert.strictEqual(json.data.attempts[0].score, 9.75);

      // Teacher dashboard metrics
      const tMetrics = await fetch(`${BASE_URL}/analytics/teacher`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(tMetrics.status, 200);
      const tJson = await tMetrics.json();
      assert.strictEqual(tJson.data.totalAttempts, 1);
      assert.strictEqual(tJson.data.passRate, 100);
      assert.strictEqual(tJson.data.uniqueStudents, 1);
    });

    // Test 13: Student Analytics Dashboard
    await test('Student Analytics: Metrics reflect completed quizzes, pass rate, and mistake counters', async () => {
      const res = await fetch(`${BASE_URL}/analytics/student`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.completedAttempts, 1);
      assert.strictEqual(json.data.passRate, 100);
      assert.strictEqual(json.data.averageScore, 88.6);
      assert.strictEqual(json.data.mistakes.total, 1);
      assert.strictEqual(json.data.mistakes.resolved, 1); // was marked resolved in Test 9
    });

    // Test 14: Anti-Cheat Fullscreen & Tab Monitoring (1st = Warning, 2nd+ = Flagged)
    await test('Anti-Cheat: 1st violation issues Warning, 2nd violation Flags attempt and notifies Teacher', async () => {
      // 0. Start a fresh attempt to test in-progress anti-cheat monitoring
      const startRes = await fetch(`${BASE_URL}/attempts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ quizId })
      });
      assert.strictEqual(startRes.status, 201);
      const startData = await startRes.json();
      const testAttemptId = startData.data.attemptId;

      // 1. First violation (Warning)
      const v1Res = await fetch(`${BASE_URL}/attempts/${testAttemptId}/violation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ type: 'FULLSCREEN_EXIT', details: 'Exited fullscreen mode' })
      });
      assert.strictEqual(v1Res.status, 200);
      const v1 = await v1Res.json();
      assert.strictEqual(v1.success, true);
      assert.strictEqual(v1.action, 'WARNING');
      assert.strictEqual(v1.warningCount, 1);
      assert.strictEqual(v1.isFlagged, false);

      // 2. Second violation (Flag)
      const v2Res = await fetch(`${BASE_URL}/attempts/${testAttemptId}/violation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ type: 'TAB_SWITCH', details: 'User blurred tab window' })
      });
      assert.strictEqual(v2Res.status, 200);
      const v2 = await v2Res.json();
      assert.strictEqual(v2.success, true);
      assert.strictEqual(v2.action, 'FLAG');
      assert.strictEqual(v2.warningCount, 2);
      assert.strictEqual(v2.isFlagged, true);

      // 3. Submit attempt and verify summary returns warningCount and isFlagged
      await fetch(`${BASE_URL}/attempts/${testAttemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ answers: [] })
      });

      const sumRes = await fetch(`${BASE_URL}/attempts/${testAttemptId}/summary`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.strictEqual(sumRes.status, 200);
      const sumJson = await sumRes.json();
      assert.strictEqual(sumJson.data.attempt.warningCount, 2);
      assert.strictEqual(sumJson.data.attempt.isFlagged, true);

      // 4. Verify teacher attempts view reflects the flag and warning count
      const tViewRes = await fetch(`${BASE_URL}/attempts/quiz/${quizId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(tViewRes.status, 200);
      const tView = await tViewRes.json();
      const att = tView.data.attempts.find(a => a.id === testAttemptId);
      assert.ok(att, 'Attempt must exist in teacher view');
      assert.strictEqual(att.warning_count, 2);
      assert.strictEqual(Boolean(att.is_flagged), true);
    });

  } finally {
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`Phase P3 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP3Tests().catch(err => {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  });
}

module.exports = { runP3Tests };