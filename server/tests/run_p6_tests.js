process.env.NODE_ENV = 'test';
const assert = require('assert');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance } = require('../src/database');

async function runP6Tests() {
  console.log('\n🏛️ Starting Phase P6 Automated Test Suite (Institutional Structure & Scoped Assessments)...');

  // Set up in-memory SQLite database
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);

  await runMigrations(db);
  console.log('✓ Database schema migrations v1 through v7 applied.');

  const app = createApp(db);
  const server = http.createServer(app);

  const TEST_PORT = 5006;
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;

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
    return { status: res.status, ok: res.ok, data };
  }

  async function registerAndLogin(name, email, role = 'STUDENT') {
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password: 'Password123!',
        passwordConfirmation: 'Password123!'
      })
    });
    assert.strictEqual(regRes.status, 201, `Registration failed for ${email}`);
    const userId = regRes.data.data.user.id;

    if (role && role !== 'STUDENT') {
      await new Promise((resolve, reject) => {
        db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, userId], err => {
          if (err) reject(err); else resolve();
        });
      });
    }

    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Password123!' })
    });
    assert.strictEqual(loginRes.status, 200, `Login failed for ${email}`);

    return {
      userId,
      token: loginRes.data.data.accessToken
    };
  }

  try {
    let superAdminToken = '';
    let teacherToken = '';
    let teacherId = '';
    let unauthorizedTeacherToken = '';
    let student1Token = '';
    let student1Id = '';
    let student2Token = '';
    let student2Id = '';
    let student3Token = '';
    let student3Id = '';

    let orgId = '';
    let academicYearId = '';
    let deptId = '';
    let classId = '';
    let sectionAId = '';
    let sectionBId = '';
    let subjectId = '';
    let quizId = '';
    let assignmentId = '';
    let attemptId = '';
    let q1Id = '';
    let q1OptAId = '';

    // 1. Setup Accounts
    await test('Setup: Register Super Admin, Teachers, and Students', async () => {
      const sa = await registerAndLogin('Super Admin P6', 'sa_p6@institution.edu', 'SUPER_ADMIN');
      superAdminToken = sa.token;

      const t1 = await registerAndLogin('Prof. Miller', 'miller_p6@institution.edu', 'TEACHER');
      teacherToken = t1.token;
      teacherId = t1.userId;

      const t2 = await registerAndLogin('Prof. Davis', 'davis_p6@institution.edu', 'TEACHER');
      unauthorizedTeacherToken = t2.token;

      const s1 = await registerAndLogin('Student Alice', 'alice_p6@institution.edu', 'STUDENT');
      student1Token = s1.token;
      student1Id = s1.userId;

      const s2 = await registerAndLogin('Student Bob', 'bob_p6@institution.edu', 'STUDENT');
      student2Token = s2.token;
      student2Id = s2.userId;

      const s3 = await registerAndLogin('Student Charlie', 'charlie_p6@institution.edu', 'STUDENT');
      student3Token = s3.token;
      student3Id = s3.userId;

      assert.ok(superAdminToken);
      assert.ok(teacherToken);
      assert.ok(student1Token);
    });

    // 2. Organization & Academic Hierarchy Creation
    await test('Institution: Setup Organization, Academic Year, Dept, Class, Sections, and Subject', async () => {
      const structRes = await request('/institutions/structure', {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(structRes.status, 200);
      assert.strictEqual(structRes.data.success, true);
      orgId = structRes.data.data.organization.id;
      academicYearId = structRes.data.data.academicYears[0].id;

      // Create a custom Department
      const deptRes = await request('/institutions/departments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ name: 'Quality Engineering', code: 'QE', description: 'Quality & Process Dept' })
      });
      assert.strictEqual(deptRes.status, 201);
      deptId = deptRes.data.data.id;

      // Create Class
      const classRes = await request('/institutions/classes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ department_id: deptId, name: 'B.Tech QE', code: 'BT-QE' })
      });
      assert.strictEqual(classRes.status, 201);
      classId = classRes.data.data.id;

      // Create Section A and Section B
      const secARes = await request('/institutions/sections', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ class_id: classId, academic_year_id: academicYearId, name: 'Section A', capacity: 40 })
      });
      assert.strictEqual(secARes.status, 201);
      sectionAId = secARes.data.data.id;

      const secBRes = await request('/institutions/sections', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ class_id: classId, academic_year_id: academicYearId, name: 'Section B', capacity: 40 })
      });
      assert.strictEqual(secBRes.status, 201);
      sectionBId = secBRes.data.data.id;

      // Create Subject
      const subRes = await request('/institutions/subjects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ department_id: deptId, name: 'Total Quality Management', code: 'TQM-101' })
      });
      assert.strictEqual(subRes.status, 201);
      subjectId = subRes.data.data.id;
    });

    // 3. Student Enrollment & Section Cohorts
    await test('Enrollment: Enroll Students into Sections and verify active enrollment view', async () => {
      // Enroll Student 1 in Section A
      const e1 = await request('/institutions/students/enroll', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ user_id: student1Id, section_id: sectionAId, roll_number: 'QE-2026-001' })
      });
      assert.strictEqual(e1.status, 201);

      // Enroll Student 2 in Section A
      const e2 = await request('/institutions/students/enroll', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ user_id: student2Id, section_id: sectionAId, roll_number: 'QE-2026-002' })
      });
      assert.strictEqual(e2.status, 201);

      // Enroll Student 3 in Section B
      const e3 = await request('/institutions/students/enroll', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ user_id: student3Id, section_id: sectionBId, roll_number: 'QE-2026-003' })
      });
      assert.strictEqual(e3.status, 201);

      // Student 1 checks own enrollment
      const myEnrollRes = await request('/institutions/my-enrollment', {
        headers: { Authorization: `Bearer ${student1Token}` }
      });
      assert.strictEqual(myEnrollRes.status, 200);
      assert.strictEqual(myEnrollRes.data.data.enrollment.section_name, 'Section A');
      assert.strictEqual(myEnrollRes.data.data.enrollment.roll_number, 'QE-2026-001');
    });

    // 4. Teacher Teaching Allocation & Scope Authorization
    await test('Teaching Scope: Authorize Teacher to Section A and verify scope filtering', async () => {
      // Assign Prof. Miller to teach TQM-101 to Section A
      const assignRes = await request('/institutions/teachers/assign', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ teacher_id: teacherId, subject_id: subjectId, section_id: sectionAId })
      });
      assert.strictEqual(assignRes.status, 201);

      // Teacher checks assigned sections & subjects
      const myAssignRes = await request('/institutions/my-assignments', {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(myAssignRes.status, 200);
      const { sections, eligibleStudents } = myAssignRes.data.data;
      assert.strictEqual(sections.length, 1);
      assert.strictEqual(sections[0].id, sectionAId);

      // Eligible students should only be students in Section A (Alice & Bob, NOT Charlie)
      const studentIds = eligibleStudents.map(s => s.id);
      assert.ok(studentIds.includes(student1Id));
      assert.ok(studentIds.includes(student2Id));
      assert.ok(!studentIds.includes(student3Id), 'Student 3 from Section B should not be in Section A eligible list');
    });

    // 5. Quiz Creation by Teacher
    await test('Quiz: Teacher creates and publishes assessment quiz', async () => {
      const qRes = await request('/quizzes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({
          title: 'TQM Phase P6 Assessment',
          description: 'Institutional Quality Quiz',
          category: 'Operations',
          difficulty: 'MEDIUM',
          time_limit_minutes: 20,
          pass_percentage: 60,
          questions: [
            {
              question_text: 'What does PDCA stand for in Total Quality Management?',
              question_type: 'MCQ_SINGLE',
              marks: 10,
              time_limit_sec: 60,
              options: [
                { option_key: 'A', option_text: 'Plan Do Check Act', is_correct: 1 },
                { option_key: 'B', option_text: 'Produce Deliver Care Accept', is_correct: 0 }
              ]
            }
          ]
        })
      });
      assert.strictEqual(qRes.status, 201);
      quizId = qRes.data.data.quiz.id;

      // Publish quiz
      const pubRes = await request(`/quizzes/${quizId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(pubRes.status, 200);
    });

    // 6. Default Access Restriction (Student cannot see or take unassigned quiz)
    await test('Access Restriction: Institutional student cannot discover or attempt unassigned quiz', async () => {
      // Student 1 checks discover list
      const discRes = await request('/quizzes/discover', {
        headers: { Authorization: `Bearer ${student1Token}` }
      });
      assert.strictEqual(discRes.status, 200);
      const visibleQuizzes = discRes.data.data.quizzes || [];
      assert.ok(!visibleQuizzes.some(q => q.id === quizId), 'Quiz must NOT be discoverable by student before assignment');

      // Student 1 attempts to start unassigned quiz
      const startRes = await request('/attempts/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student1Token}` },
        body: JSON.stringify({ quiz_id: quizId })
      });
      assert.strictEqual(startRes.status, 403);
      assert.strictEqual(startRes.data.error.code, 'ERR_QUIZ_NOT_ASSIGNED');
    });

    // 7. Teacher Scope Enforcement (Unauthorized teacher cannot assign to Section A)
    await test('Scope Enforcement: Unauthorized teacher cannot assign to Section A', async () => {
      const failRes = await request('/assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${unauthorizedTeacherToken}` },
        body: JSON.stringify({
          quiz_id: quizId,
          title: 'Illegal Assignment Attempt',
          section_ids: [sectionAId]
        })
      });
      assert.strictEqual(failRes.status, 403);
      assert.ok(['ERR_UNAUTHORIZED_SECTION', 'ERR_FORBIDDEN_SECTION'].includes(failRes.data.error.code));
    });

    // 8. Scoped Assignment Creation with De-duplication
    await test('Scoped Assignment: Assign to Section A + explicitly select Student 1 (De-duplication Check)', async () => {
      const createRes = await request('/assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({
          quiz_id: quizId,
          title: 'TQM Section A Midterm',
          due_date: new Date(Date.now() + 86400000).toISOString(),
          max_attempts: 1,
          section_ids: [sectionAId],
          student_ids: [student1Id] // Student 1 is in Section A AND individually selected
        })
      });

      assert.strictEqual(createRes.status, 201);
      assert.strictEqual(createRes.data.success, true);
      assignmentId = createRes.data.data.id;
      assert.strictEqual(createRes.data.data.recipient_count, 2, 'Should deduplicate Student 1 and include Student 1 and 2 (total 2 unique recipients)');

      // Inspect recipients drilldown
      const recipRes = await request(`/assignments/${assignmentId}/recipients`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(recipRes.status, 200);
      assert.strictEqual(recipRes.data.data.recipients.length, 2);
    });

    // 9. Assigned Student Flow (Discover, Start, Submit)
    await test('Student Flow: Assigned student Alice accesses, starts, and submits assigned test', async () => {
      // Alice sees assigned test in /assignments/my-assigned
      const myAssignedRes = await request('/assignments/my-assigned', {
        headers: { Authorization: `Bearer ${student1Token}` }
      });
      assert.strictEqual(myAssignedRes.status, 200);
      assert.strictEqual(myAssignedRes.data.data.assignments.length, 1);
      assert.strictEqual(myAssignedRes.data.data.assignments[0].id, assignmentId);
      assert.strictEqual(myAssignedRes.data.data.assignments[0].status, 'ASSIGNED');

      // Alice now starts the quiz
      const startRes = await request('/attempts/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student1Token}` },
        body: JSON.stringify({ quiz_id: quizId, assignment_id: assignmentId })
      });
      assert.strictEqual(startRes.status, 201);
      attemptId = startRes.data.data.attemptId || startRes.data.data.attempt.id;

      // Alice submits the answer
      const questions = startRes.data.data.questions;
      q1Id = questions[0].id;
      const optA = questions[0].options.find(o => o.option_text === 'Plan Do Check Act');
      q1OptAId = optA.id;

      const submitRes = await request(`/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${student1Token}` },
        body: JSON.stringify({
          answers: [{ questionId: q1Id, answer: q1OptAId }]
        })
      });
      assert.strictEqual(submitRes.status, 200);
      assert.strictEqual(submitRes.data.data.score, 10);
      assert.strictEqual(submitRes.data.data.isPassed, true);

      // Verify assignment recipient status updated to SUBMITTED
      const recipRes = await request(`/assignments/${assignmentId}/recipients`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      const aliceRecip = recipRes.data.data.recipients.find(r => r.user_id === student1Id);
      assert.strictEqual(aliceRecip.status, 'SUBMITTED');
      assert.strictEqual(aliceRecip.score, 10);
    });

    // 10. Safe Student Transfer (Preserves Past Assignment Snapshot)
    await test('Section Transfer: Moving Alice to Section B preserves past Section A assignment snapshot', async () => {
      const transferRes = await request(`/institutions/students/${student1Id}/transfer`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ target_section_id: sectionBId })
      });
      assert.strictEqual(transferRes.status, 200);
      assert.strictEqual(transferRes.data.success, true);

      // Verify Alice's active enrollment is now Section B
      const myEnrollRes = await request('/institutions/my-enrollment', {
        headers: { Authorization: `Bearer ${student1Token}` }
      });
      assert.strictEqual(myEnrollRes.data.data.enrollment.section_name, 'Section B');

      // Crucial: The prior assignment's recipient snapshot MUST remain intact with Alice's score
      const recipRes = await request(`/assignments/${assignmentId}/recipients`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      const aliceInPast = recipRes.data.data.recipients.find(r => r.user_id === student1Id);
      assert.ok(aliceInPast, 'Alice must still be in past assignment snapshot');
      assert.strictEqual(aliceInPast.status, 'SUBMITTED');
      assert.strictEqual(aliceInPast.score, 10);
    });

    // 11. Unified Teacher Analytics for All Test Types
    await test('Unified Analytics: Teacher can access all test data (Live, Self-Paced, Assignments)', async () => {
      const analyticsRes = await request('/analytics/teacher/all-tests', {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      assert.strictEqual(analyticsRes.status, 200);
      assert.strictEqual(analyticsRes.data.success, true);

      const { summary, assignments, selfPacedAttempts, liveBattles } = analyticsRes.data.data;
      assert.ok(summary, 'Summary stats must exist');
      assert.strictEqual(assignments.length, 1);
      assert.strictEqual(assignments[0].id, assignmentId);
      assert.strictEqual(assignments[0].recipients.length, 2);
      assert.ok(Array.isArray(selfPacedAttempts));
      assert.ok(Array.isArray(liveBattles));
    });

  } finally {
    server.close();
  }

  console.log(`\nPhase P6 Test Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP6Tests().catch(err => {
    console.error('P6 Test Suite Fatal Error:', err);
    process.exit(1);
  });
}

module.exports = { runP6Tests };
