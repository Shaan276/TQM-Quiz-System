process.env.NODE_ENV = 'test';
const assert = require('assert');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance, dbGet, dbRun, dbAll } = require('../src/database');

async function runP8Tests() {
  console.log('\n📊 Starting Phase P8 Automated Test Suite (Advanced Insights & Quiz Settings)...');

  // Set up in-memory SQLite database
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);

  await runMigrations(db);
  console.log('✓ Database schema migrations v1 through v9 applied.');

  const app = createApp(db);
  const server = http.createServer(app);

  const TEST_PORT = 5008;
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

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

  async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      data
    };
  }

  async function registerAndLogin(name, email, role = 'STUDENT') {
    const regRes = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password: 'Password123!',
        passwordConfirmation: 'Password123!',
        role
      })
    });
    assert.strictEqual(regRes.status, 201, `Registration failed: ${JSON.stringify(regRes.data)}`);
    const userId = regRes.data.data.user.id;

    await dbRun('UPDATE users SET is_verified = 1, role = ? WHERE id = ?', [role, userId], db);

    const loginRes = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Password123!' })
    });
    assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginRes.data)}`);

    return {
      userId,
      token: loginRes.data.data.accessToken
    };
  }

  try {
    let teacherToken = '';
    let student1Token = '';
    let student2Token = '';
    let student3Token = '';
    let testQuizId = '';
    let question1Id = '';
    let question2Id = '';
    let question3Id = '';
    let option1CorrectId = '';
    let option1DistractorAId = '';
    let option1DistractorBId = '';

    // 1. Setup Auth Users
    await test('1. Auth Setup: Register Teacher and Students', async () => {
      const teacher = await registerAndLogin('Prof. Gauss', 'teacher_p8@test.com', 'TEACHER');
      teacherToken = teacher.token;

      const s1 = await registerAndLogin('Alice Student', 'student1_p8@test.com', 'STUDENT');
      student1Token = s1.token;

      const s2 = await registerAndLogin('Bob Scholar', 'student2_p8@test.com', 'STUDENT');
      student2Token = s2.token;

      const s3 = await registerAndLogin('Charlie Cadre', 'student3_p8@test.com', 'STUDENT');
      student3Token = s3.token;

      assert.ok(teacherToken && student1Token && student2Token && student3Token);
    });

    // 2. Assessment Configuration & Version Snapshot Integrity
    await test('2. Quiz Settings & Snapshot: Create & configure quiz with shuffling and controls', async () => {
      const createRes = await request('/api/v1/quizzes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherToken}` },
        body: JSON.stringify({
          title: 'Advanced Thermodynamics & Quantum Mechanics',
          description: 'Comprehensive physics assessment with shuffling and strict grading policies',
          category: 'Physics',
          difficulty: 'HARD',
          timeLimitSec: 3600,
          passingPercentage: 65,
          shuffleQuestions: true,
          shuffleOptions: true,
          allowFlagging: true,
          allowBacktrack: true,
          showCorrectAnswers: true,
          negativeMarking: true,
          negativeMarksRatio: 0.25,
          questions: [
            {
              question_text: 'What is the absolute zero temperature in Kelvin?',
              question_type: 'MCQ_SINGLE',
              marks: 2.0,
              time_limit_sec: 60,
              explanation: 'Absolute zero corresponds to 0 K or -273.15 °C.',
              options: [
                { option_key: 'A', option_text: '0 K', is_correct: 1 },
                { option_key: 'B', option_text: '273.15 K', is_correct: 0 },
                { option_key: 'C', option_text: '-273.15 K', is_correct: 0 },
                { option_key: 'D', option_text: '100 K', is_correct: 0 }
              ]
            },
            {
              question_text: 'Which laws govern heat and work conversion?',
              question_type: 'MCQ_SINGLE',
              marks: 2.0,
              time_limit_sec: 60,
              explanation: 'The laws of thermodynamics describe physical quantities such as energy and entropy.',
              options: [
                { option_key: 'A', option_text: 'Laws of Thermodynamics', is_correct: 1 },
                { option_key: 'B', option_text: 'Newtonian Laws', is_correct: 0 },
                { option_key: 'C', option_text: 'Keplerian Orbits', is_correct: 0 }
              ]
            },
            {
              question_text: 'Energy can be created or destroyed in an isolated system.',
              question_type: 'TRUE_FALSE',
              marks: 1.0,
              time_limit_sec: 45,
              explanation: 'First law states that total energy of an isolated system is constant.',
              options: [
                { option_key: 'A', option_text: 'True', is_correct: 0 },
                { option_key: 'B', option_text: 'False', is_correct: 1 }
              ]
            }
          ]
        })
      });

      assert.strictEqual(createRes.status, 201);
      testQuizId = createRes.data.data.quiz.id;
      assert.strictEqual(createRes.data.data.quiz.shuffle_questions, 1);
      assert.strictEqual(createRes.data.data.quiz.shuffle_options, 1);
      assert.strictEqual(createRes.data.data.quiz.allow_flagging, 1);

      // Verify questions loaded
      const getQuiz = await request(`/api/v1/quizzes/${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      assert.strictEqual(getQuiz.data.data.quiz.questions.length, 3);
      question1Id = getQuiz.data.data.quiz.questions[0].id;
      question2Id = getQuiz.data.data.quiz.questions[1].id;
      question3Id = getQuiz.data.data.quiz.questions[2].id;

      const q1Opts = getQuiz.data.data.quiz.questions[0].options;
      option1CorrectId = q1Opts.find(o => o.is_correct === 1).id;
      option1DistractorAId = q1Opts.find(o => o.option_text === '273.15 K').id;
      option1DistractorBId = q1Opts.find(o => o.option_text === '-273.15 K').id;

      // Publish quiz to snapshot settings into quiz_versions
      const pubRes = await request(`/api/v1/quizzes/${testQuizId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      assert.strictEqual(pubRes.status, 200);

      // Check version snapshot in DB
      const versionRow = await dbGet(`SELECT snapshot_data FROM quiz_versions WHERE quiz_id = ?`, [testQuizId], db);
      assert.ok(versionRow, 'Version snapshot must exist');
      const snap = JSON.parse(versionRow.snapshot_data);
      assert.strictEqual(snap.quiz.shuffle_questions, 1);
      assert.strictEqual(snap.quiz.shuffle_options, 1);
      assert.strictEqual(snap.quiz.passing_percentage, 65);
    });

    // 3. Shuffling & Presentation Order Determinism
    let attempt1Id = '';
    let attempt1QuestionOrder = [];
    let attempt1OptionOrder = {};

    await test('3. Shuffling Presentation Order: Fisher-Yates order persisted in DB without answer corruption', async () => {
      const startRes = await request('/api/v1/attempts/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student1Token}` },
        body: JSON.stringify({ quizId: testQuizId })
      });

      assert.strictEqual(startRes.status, 201);
      attempt1Id = startRes.data.data.attemptId;
      assert.strictEqual(startRes.data.data.isResumed, false);

      const returnedQuestions = startRes.data.data.questions;
      assert.strictEqual(returnedQuestions.length, 3);
      attempt1QuestionOrder = returnedQuestions.map(q => q.id);

      // Verify presentation order persisted in quiz_attempts table
      const attRow = await dbGet(`SELECT displayed_question_order, displayed_option_order FROM quiz_attempts WHERE id = ?`, [attempt1Id], db);
      assert.ok(attRow.displayed_question_order, 'displayed_question_order must be saved');
      assert.ok(attRow.displayed_option_order, 'displayed_option_order must be saved');

      const savedQOrder = JSON.parse(attRow.displayed_question_order);
      assert.deepStrictEqual(savedQOrder, attempt1QuestionOrder);

      // Verify resumption retains the exact same question order
      const resumeRes = await request('/api/v1/attempts/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student1Token}` },
        body: JSON.stringify({ quizId: testQuizId })
      });
      assert.strictEqual(resumeRes.data.data.isResumed, true);
      const resumedQOrder = resumeRes.data.data.questions.map(q => q.id);
      assert.deepStrictEqual(resumedQOrder, attempt1QuestionOrder, 'Resumed question order must be 100% deterministic');

      // Verify GET /:id returns the exact same sequence
      const getAttRes = await request(`/api/v1/attempts/${attempt1Id}`, {
        headers: { 'Authorization': `Bearer ${student1Token}` }
      });
      const getAttOrder = getAttRes.data.data.questions.map(q => q.id);
      assert.deepStrictEqual(getAttOrder, attempt1QuestionOrder);
    });

    // 4. Question Flagging for Review
    await test('4. Question Flagging: Student toggles flag on questions and state persists', async () => {
      // Flag question 1
      const flagRes1 = await request(`/api/v1/attempts/${attempt1Id}/flag`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${student1Token}` },
        body: JSON.stringify({ questionId: question1Id, flagged: true })
      });
      assert.strictEqual(flagRes1.status, 200);
      assert.ok(flagRes1.data.data.flaggedQuestionIds.includes(question1Id));

      // Flag question 2
      const flagRes2 = await request(`/api/v1/attempts/${attempt1Id}/flag`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${student1Token}` },
        body: JSON.stringify({ questionId: question2Id, flagged: true })
      });
      assert.strictEqual(flagRes2.data.data.flaggedQuestionIds.length, 2);

      // Verify GET /:id returns flaggedQuestionIds
      const checkAtt = await request(`/api/v1/attempts/${attempt1Id}`, {
        headers: { 'Authorization': `Bearer ${student1Token}` }
      });
      assert.strictEqual(checkAtt.data.data.flaggedQuestionIds.length, 2);

      // Unflag question 1
      const unflagRes = await request(`/api/v1/attempts/${attempt1Id}/flag`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${student1Token}` },
        body: JSON.stringify({ questionId: question1Id, flagged: false })
      });
      assert.strictEqual(unflagRes.data.data.flaggedQuestionIds.length, 1);
      assert.strictEqual(unflagRes.data.data.flaggedQuestionIds[0], question2Id);
    });

    // 5. Submit Answers and Verify Shuffled Review Determinism
    await test('5. Answer Submission & Review: Authoritative grading with stable IDs and preserved presentation order', async () => {
      // Student 1 answers: Q1 correct, Q2 correct, Q3 correct (100% score)
      const submitRes = await request(`/api/v1/attempts/${attempt1Id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student1Token}` },
        body: JSON.stringify({
          answers: [
            { questionId: question1Id, answer: option1CorrectId },
            { questionId: question2Id, answer: (await dbGet(`SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1`, [question2Id], db)).id },
            { questionId: question3Id, answer: (await dbGet(`SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1`, [question3Id], db)).id }
          ]
        })
      });
      assert.strictEqual(submitRes.status, 200);
      assert.strictEqual(submitRes.data.data.status, 'COMPLETED');
      assert.strictEqual(submitRes.data.data.scorePercentage, 100);
      assert.strictEqual(submitRes.data.data.isPassed, true);

      // Review completed attempt
      const summaryRes = await request(`/api/v1/attempts/${attempt1Id}/summary`, {
        headers: { 'Authorization': `Bearer ${student1Token}` }
      });
      assert.strictEqual(summaryRes.status, 200);
      const reviewOrder = summaryRes.data.data.reviewQuestions.map(q => q.id);
      assert.deepStrictEqual(reviewOrder, attempt1QuestionOrder, 'Review order must match attempt presentation sequence');
    });

    // 6. Generate Attempts from Student 2 & 3 to populate distractor analysis
    await test('6. Attempt Population: Student 2 (chose distractor A) & Student 3 (chose distractor A & skipped Q3)', async () => {
      // Student 2 attempt
      const s2Start = await request('/api/v1/attempts/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student2Token}` },
        body: JSON.stringify({ quizId: testQuizId })
      });
      const s2AttId = s2Start.data.data.attemptId;

      await request(`/api/v1/attempts/${s2AttId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student2Token}` },
        body: JSON.stringify({
          answers: [
            { questionId: question1Id, answer: option1DistractorAId }, // Chose distractor A (273.15 K)
            { questionId: question2Id, answer: (await dbGet(`SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1`, [question2Id], db)).id }
            // Q3 left unanswered
          ]
        })
      });

      // Student 3 attempt
      const s3Start = await request('/api/v1/attempts/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student3Token}` },
        body: JSON.stringify({ quizId: testQuizId })
      });
      const s3AttId = s3Start.data.data.attemptId;

      await request(`/api/v1/attempts/${s3AttId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${student3Token}` },
        body: JSON.stringify({
          answers: [
            { questionId: question1Id, answer: option1DistractorAId } // Also chose distractor A
            // Q2 and Q3 skipped
          ]
        })
      });

      const count = await dbGet(`SELECT COUNT(*) as total FROM quiz_attempts WHERE quiz_id = ? AND status = 'COMPLETED'`, [testQuizId], db);
      assert.strictEqual(count.total, 3);
    });

    // 7. Question-Level Analysis (Core Feature)
    await test('7. Question-Level Analysis: Accuracy, Distractor distribution, and difficulty rating', async () => {
      const qAnalyticsRes = await request(`/api/v1/analytics/teacher/insights/questions?quizId=${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });

      assert.strictEqual(qAnalyticsRes.status, 200);
      assert.strictEqual(qAnalyticsRes.data.success, true);
      const questions = qAnalyticsRes.data.data.questions;
      assert.strictEqual(questions.length, 3);

      // Inspect Question 1 (1 student correct, 2 students chose distractor A)
      const q1 = questions.find(q => q.id === question1Id);
      assert.ok(q1, 'Question 1 must be present in analysis');
      assert.strictEqual(q1.attemptedCount, 3);
      assert.strictEqual(q1.correctCount, 1);
      assert.strictEqual(q1.incorrectCount, 2);
      assert.strictEqual(q1.accuracy, 33); // 1 / 3 = 33%
      assert.strictEqual(q1.realizedDifficulty, 'Hard'); // < 40% accuracy

      // Verify Option Distribution on Question 1
      assert.ok(Array.isArray(q1.optionDistribution));
      const distractorAOpt = q1.optionDistribution.find(o => o.id === option1DistractorAId);
      assert.strictEqual(distractorAOpt.count, 2);
      assert.strictEqual(distractorAOpt.percentage, 67);

      const correctOpt = q1.optionDistribution.find(o => o.id === option1CorrectId);
      assert.strictEqual(correctOpt.count, 1);
      assert.strictEqual(correctOpt.is_correct, true);

      // Verify Most Common Distractor detection
      assert.ok(q1.mostCommonDistractor, 'Most common distractor must be identified');
      assert.strictEqual(q1.mostCommonDistractor.id, option1DistractorAId);
      assert.strictEqual(q1.mostCommonDistractor.count, 2);

      // Inspect Question 3 (1 correct, 0 incorrect, 2 skipped)
      const q3 = questions.find(q => q.id === question3Id);
      assert.ok(q3);
      assert.strictEqual(q3.correctCount, 1);
      assert.strictEqual(q3.skippedCount, 2);

      // Verify Sorting by highest_accuracy
      const sortedRes = await request(`/api/v1/analytics/teacher/insights/questions?quizId=${testQuizId}&sortBy=highest_accuracy`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      const sortedQ = sortedRes.data.data.questions;
      assert.ok(sortedQ[0].accuracy >= sortedQ[sortedQ.length - 1].accuracy);
    });

    // 8. Teacher Overview Dashboard Analytics
    await test('8. Teacher Overview Analytics: Aggregated KPIs, Median Score, and Score Distribution', async () => {
      const overviewRes = await request('/api/v1/analytics/teacher/insights/overview', {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });

      assert.strictEqual(overviewRes.status, 200);
      assert.strictEqual(overviewRes.data.success, true);
      const data = overviewRes.data.data;

      assert.strictEqual(data.totalAssessments, 1);
      assert.strictEqual(data.totalAttempts, 3);
      assert.strictEqual(data.uniqueStudents, 3);
      assert.ok(data.averageScore > 0);
      assert.ok(data.medianScore > 0);
      assert.strictEqual(data.highestScore, 100);

      // Score distribution buckets
      assert.ok(data.scoreDistribution['81-100%'] >= 1); // Student 1 had 100%
      assert.ok(data.scoreDistribution['0-40%'] >= 1); // Student 3 had low score

      // Students needing practice list
      assert.ok(Array.isArray(data.studentsNeedingPractice));
      assert.ok(data.studentsNeedingPractice.length > 0);
    });

    // 9. Student Roster Performance & Mistake Tracking
    await test('9. Student Performance Roster: Individual mastery and mistake integration', async () => {
      const rosterRes = await request(`/api/v1/analytics/teacher/insights/students?quizId=${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });

      assert.strictEqual(rosterRes.status, 200);
      assert.strictEqual(rosterRes.data.success, true);
      const students = rosterRes.data.data.students;
      assert.strictEqual(students.length, 3);

      const alice = students.find(s => s.name === 'Alice Student');
      assert.ok(alice);
      assert.strictEqual(alice.averageScore, 100);
      assert.strictEqual(alice.completedAttempts, 1);

      const bob = students.find(s => s.name === 'Bob Scholar');
      assert.ok(bob);
      assert.ok(bob.unresolvedMistakes >= 1, 'Bob made mistake on Q1 and must have recorded mistake');
    });

    // 10. Section-Level Analytics
    await test('10. Section-Level Analytics: Cohort comparison endpoint succeeds', async () => {
      const secRes = await request('/api/v1/analytics/teacher/insights/sections', {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });

      assert.strictEqual(secRes.status, 200);
      assert.strictEqual(secRes.data.success, true);
      assert.ok(Array.isArray(secRes.data.data.sections));
    });

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`Phase P8 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP8Tests().catch(err => {
    console.error('Test runner encountered fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runP8Tests };
