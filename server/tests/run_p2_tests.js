const assert = require('assert');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance } = require('../src/database');

async function runP2Tests() {
  console.log('\n🚀 Starting Phase P2 Automated Test Suite (Quiz Studio & Question Bank)...');

  // Set up in-memory SQLite database
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);

  await runMigrations(db);
  console.log('✓ Database schema migrations v1 & v2 applied.');

  const app = createApp(db);
  const server = app.listen(5002);
  const BASE_URL = 'http://127.0.0.1:5002/api/v1';

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
    let creatorToken = '';
    let learnerToken = '';
    let testQuizId = '';
    let bankQuestionId = '';

    // Setup: Register Creator and Learner
    await test('Setup: Register Creator and Learner accounts', async () => {
      // 1. Creator Registration
      const cRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Teacher Jane',
          email: 'jane_creator@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!'
        })
      });
      assert.strictEqual(cRes.status, 201);

      // Login Creator
      const cLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jane_creator@example.com',
          password: 'Password123!'
        })
      });
      const cData = await cLogin.json();
      creatorToken = cData.data.accessToken;

      // Upgrade to CREATOR role
      const upRes = await fetch(`${BASE_URL}/users/upgrade-to-creator`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(upRes.status, 200);
      const upData = await upRes.json();
      creatorToken = upData.data.accessToken;

      // 2. Learner Registration
      const lRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Student Bob',
          email: 'bob_student@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!'
        })
      });
      assert.strictEqual(lRes.status, 201);

      const lLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bob_student@example.com',
          password: 'Password123!'
        })
      });
      const lData = await lLogin.json();
      learnerToken = lData.data.accessToken;
      assert.ok(creatorToken && learnerToken);
    });

    // Test 1: Role RBAC Guard on Quiz Creation
    await test('Learner is forbidden from creating a quiz (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${learnerToken}`
        },
        body: JSON.stringify({ title: 'Hacked Quiz' })
      });
      assert.strictEqual(res.status, 403);
    });

    // Test 2: Creator Creates a New Quiz
    await test('Creator can create a new quiz in DRAFT status', async () => {
      const res = await fetch(`${BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({
          title: 'Physics & Chemistry Mastery',
          description: 'Comprehensive science assessment',
          category: 'Science',
          difficulty: 'MEDIUM',
          tags: ['physics', 'chemistry', 'science'],
          timeLimitSec: 1200,
          passingPercentage: 70
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.quiz.status, 'DRAFT');
      assert.strictEqual(data.data.quiz.version, 1);
      testQuizId = data.data.quiz.id;
      assert.ok(testQuizId);
    });

    // Test 3: Autosave and Adding All 6 Question Types
    await test('Creator can autosave quiz with all 6 question types and settings', async () => {
      const questionsPayload = [
        // 1. Single Choice MCQ
        {
          question_text: 'What is the SI unit of electric current?',
          question_type: 'MCQ_SINGLE',
          marks: 2.0,
          time_limit_sec: 30,
          explanation: 'The SI unit of electric current is Ampere (A).',
          options: [
            { option_key: 'A', option_text: 'Volt', is_correct: false },
            { option_key: 'B', option_text: 'Ampere', is_correct: true },
            { option_key: 'C', option_text: 'Ohm', is_correct: false },
            { option_key: 'D', option_text: 'Watt', is_correct: false }
          ]
        },
        // 2. Multiple Select MCQ
        {
          question_text: 'Which of the following are noble gases? (Select all that apply)',
          question_type: 'MCQ_MULTI',
          marks: 3.0,
          time_limit_sec: 45,
          explanation: 'Helium and Argon are noble gases.',
          options: [
            { option_key: 'A', option_text: 'Helium', is_correct: true },
            { option_key: 'B', option_text: 'Nitrogen', is_correct: false },
            { option_key: 'C', option_text: 'Argon', is_correct: true },
            { option_key: 'D', option_text: 'Chlorine', is_correct: false }
          ]
        },
        // 3. True / False
        {
          question_text: 'Sound travels faster in water than in air.',
          question_type: 'TRUE_FALSE',
          marks: 1.0,
          time_limit_sec: 20,
          explanation: 'Sound travels roughly 4.3 times faster in water because water is denser and more elastic than air.',
          options: [
            { option_key: 'TRUE', option_text: 'True', is_correct: true },
            { option_key: 'FALSE', option_text: 'False', is_correct: false }
          ]
        },
        // 4. Fill in the Blanks
        {
          question_text: 'The chemical formula for water is ________.',
          question_type: 'FILL_BLANK',
          marks: 1.5,
          time_limit_sec: 25,
          explanation: 'Water consists of 2 hydrogen atoms and 1 oxygen atom (H2O).',
          answers: [
            { expected_answer: 'H2O', is_case_sensitive: false },
            { expected_answer: 'H 2 O', is_case_sensitive: false }
          ]
        },
        // 5. Short Answer
        {
          question_text: 'Name the process by which green plants synthesize food using sunlight.',
          question_type: 'SHORT_ANSWER',
          marks: 2.0,
          time_limit_sec: 35,
          explanation: 'Photosynthesis is the process used by plants to convert light energy into chemical energy.',
          answers: [
            { expected_answer: 'Photosynthesis', is_case_sensitive: false }
          ]
        },
        // 6. Numerical Answer with Tolerance
        {
          question_text: 'Calculate the acceleration due to gravity on Earth in m/s^2 (standard sea level value).',
          question_type: 'NUMERICAL',
          marks: 2.5,
          time_limit_sec: 40,
          explanation: 'Standard gravity is approximately 9.8 m/s^2 (or 9.81 m/s^2).',
          answers: [
            { expected_answer: '9.8', numeric_tolerance: 0.05 }
          ]
        }
      ];

      const res = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({
          title: 'Physics & Chemistry Mastery (Updated)',
          shuffleQuestions: true,
          shuffleOptions: true,
          negativeMarking: true,
          negativeMarksRatio: 0.25,
          showExplanations: 'AFTER_SUBMIT',
          questions: questionsPayload
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify fetched quiz has 6 questions properly saved
      const getRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      const getData = await getRes.json();
      assert.strictEqual(getData.data.quiz.questions.length, 6);
      assert.strictEqual(getData.data.quiz.shuffle_questions, 1);
      assert.strictEqual(getData.data.quiz.negative_marking, 1);
    });

    // Test 4: Poka-Yoke Validation - Empty Quiz Cannot Be Published
    await test('Validation prevents publishing empty quiz without questions', async () => {
      // Create empty quiz
      const emptyRes = await fetch(`${BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({ title: 'Empty Shell Quiz' })
      });
      const emptyData = await emptyRes.json();
      const emptyId = emptyData.data.quiz.id;

      const pubRes = await fetch(`${BASE_URL}/quizzes/${emptyId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(pubRes.status, 400);
      const pubData = await pubRes.json();
      assert.strictEqual(pubData.error.code, 'ERR_EMPTY_QUIZ');
    });

    // Test 5: Quiz Publishing and Version Snapshotting
    await test('Publishing quiz creates an immutable version snapshot in quiz_versions', async () => {
      const pubRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(pubRes.status, 200);
      const pubData = await pubRes.json();
      assert.strictEqual(pubData.data.status, 'PUBLISHED');
      assert.strictEqual(pubData.data.version, 2);

      // Query database directly to verify snapshot exists in quiz_versions
      const snapshotRow = await new Promise((resolve) => {
        db.get(
          `SELECT * FROM quiz_versions WHERE quiz_id = ? AND version = ?`,
          [testQuizId, 2],
          (err, row) => resolve(row)
        );
      });
      assert.ok(snapshotRow, 'Version 2 snapshot must exist');
      const parsedSnapshot = JSON.parse(snapshotRow.snapshot_data);
      assert.strictEqual(parsedSnapshot.questions.length, 6);
    });

    // Test 6: Historical Version Integrity on Quiz Edit
    await test('Editing quiz after publishing preserves previous version snapshot', async () => {
      // Edit title of the quiz
      const editRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({
          title: 'Physics & Chemistry Mastery (Post-Publication Draft Edition)'
        })
      });
      assert.strictEqual(editRes.status, 200);

      // Verify the snapshot in quiz_versions for version 2 still has the original title
      const snapshotRow = await new Promise((resolve) => {
        db.get(
          `SELECT * FROM quiz_versions WHERE quiz_id = ? AND version = ?`,
          [testQuizId, 2],
          (err, row) => resolve(row)
        );
      });
      const parsedSnapshot = JSON.parse(snapshotRow.snapshot_data);
      assert.strictEqual(parsedSnapshot.quiz.title, 'Physics & Chemistry Mastery (Updated)');
    });

    // Test 7: Unpublish Quiz
    await test('Unpublishing reverts quiz to DRAFT status', async () => {
      const unpubRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}/unpublish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(unpubRes.status, 200);
      const data = await unpubRes.json();
      assert.strictEqual(data.data.status, 'DRAFT');
    });

    // Test 8: Quiz Duplication
    await test('Duplicating quiz creates a deep copy with all questions and DRAFT status', async () => {
      const dupRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(dupRes.status, 201);
      const dupData = await dupRes.json();
      assert.ok(dupData.data.quiz.title.startsWith('Copy of'));
      assert.strictEqual(dupData.data.quiz.status, 'DRAFT');

      // Verify duplicate has all 6 questions
      const getDup = await fetch(`${BASE_URL}/quizzes/${dupData.data.quiz.id}`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      const getDupData = await getDup.json();
      assert.strictEqual(getDupData.data.quiz.questions.length, 6);
    });

    // Test 9: Question Bank Operations (Create, Filter, Save from Quiz, Import to Quiz)
    await test('Question Bank CRUD and import/export between quiz and bank', async () => {
      // 1. Create a bank question directly
      const createBankRes = await fetch(`${BASE_URL}/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({
          title: 'Speed of Light in Vacuum',
          question_text: 'What is the speed of light in vacuum?',
          question_type: 'MCQ_SINGLE',
          category: 'Physics',
          difficulty: 'MEDIUM',
          tags: ['relativity', 'optics'],
          marks: 2.0,
          explanation: 'c = 3 x 10^8 m/s',
          options_data: [
            { option_key: 'A', option_text: '3 x 10^8 m/s', is_correct: true },
            { option_key: 'B', option_text: '3 x 10^6 m/s', is_correct: false }
          ]
        })
      });
      assert.strictEqual(createBankRes.status, 201);
      const bankData = await createBankRes.json();
      bankQuestionId = bankData.data.question.id;

      // 2. List bank questions with category filter
      const listRes = await fetch(`${BASE_URL}/question-bank?category=Physics`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      const listData = await listRes.json();
      assert.strictEqual(listData.success, true);
      assert.ok(listData.data.questions.length >= 1);

      // 3. Save an existing question from our quiz to the bank
      const quizRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      const quizData = await quizRes.json();
      const firstQuizQ = quizData.data.quiz.questions[0];

      const saveToBankRes = await fetch(`${BASE_URL}/question-bank/from-quiz-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({
          questionId: firstQuizQ.id,
          category: 'Physics'
        })
      });
      assert.strictEqual(saveToBankRes.status, 201);

      // 4. Import the bank question into a target quiz
      const importRes = await fetch(`${BASE_URL}/question-bank/${bankQuestionId}/import-to-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creatorToken}`
        },
        body: JSON.stringify({ targetQuizId: testQuizId })
      });
      assert.strictEqual(importRes.status, 201);

      // Verify quiz now has 7 questions
      const verifyRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      const verifyData = await verifyRes.json();
      assert.strictEqual(verifyData.data.quiz.questions.length, 7);

      // 5. Delete question from bank
      const delBankRes = await fetch(`${BASE_URL}/question-bank/${bankQuestionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(delBankRes.status, 200);
    });

    // Test 10: Quiz Preview Mode
    await test('Quiz preview endpoint returns formatted data without altering quiz state', async () => {
      const prevRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}/preview`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(prevRes.status, 200);
      const prevData = await prevRes.json();
      assert.strictEqual(prevData.success, true);
      assert.strictEqual(prevData.data.quiz.totalQuestions, 7);
      assert.ok(prevData.data.quiz.totalMarks > 0);
    });

    // Test 11: Creator Dashboard Metrics
    await test('Creator dashboard metrics endpoint returns real aggregate statistics', async () => {
      const metricsRes = await fetch(`${BASE_URL}/quizzes/metrics/summary`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(metricsRes.status, 200);
      const mData = await metricsRes.json();
      assert.ok(mData.data.totalQuizzes >= 2);
      assert.ok(mData.data.totalQuestions >= 7);
      assert.ok(mData.data.recentQuizzes.length >= 2);
    });

    // Test 12: Delete Quiz
    await test('Creator can delete quiz', async () => {
      const delRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(delRes.status, 200);

      const getCheck = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
        headers: { 'Authorization': `Bearer ${creatorToken}` }
      });
      assert.strictEqual(getCheck.status, 404);
    });

  } finally {
    server.close();
  }

  console.log(`\n=================================================`);
  console.log(`P2 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED (Total ${passed + failed})`);
  console.log(`=================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP2Tests();
}

module.exports = { runP2Tests };
