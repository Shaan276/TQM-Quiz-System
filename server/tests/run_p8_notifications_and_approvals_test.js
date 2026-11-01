const assert = require('assert');
const { createApp } = require('../src/server');
const { initDatabase, dbRun, dbGet, dbAll } = require('../src/database');
const request = require('supertest');

async function runTest() {
  console.log('🚀 Running Notification and Approval Workflows E2E Test...');
  const app = createApp();

  // 1. Admin login
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@quizsystem.com', password: 'Password123!' });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.body.data.accessToken;

  // 2. Register new Teacher -> Should be PENDING approval
  const teacherEmail = `prof_${Date.now()}@university.edu`;
  const teacherReg = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Prof. Turing',
      email: teacherEmail,
      password: 'Password123!',
      passwordConfirmation: 'Password123!',
      role: 'TEACHER'
    });
  assert.strictEqual(teacherReg.status, 201, 'Teacher registration failed');
  const teacherId = teacherReg.body.data.user.id;

  // Verify teacher in DB is PENDING
  const teacherRow = await dbGet('SELECT approval_status, role FROM users WHERE id = ?', [teacherId]);
  assert.strictEqual(teacherRow.approval_status, 'PENDING', 'Teacher must be PENDING approval');

  // Verify Admin received notification about new teacher registration
  const adminNotifs = await request(app)
    .get('/api/v1/notifications')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(adminNotifs.status, 200);
  const teacherNotif = adminNotifs.body.data.notifications.find(n => n.title.includes('Teacher Approval Required'));
  assert(teacherNotif, 'Admin must receive notification when teacher registers');

  // 3. Mark admin notification as read
  const markRead = await request(app)
    .patch(`/api/v1/notifications/${teacherNotif.id}/read`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(markRead.status, 200);
  assert.strictEqual(markRead.body.data.is_read, 1);

  // 4. Admin lists pending teachers
  const pendingTeachersRes = await request(app)
    .get('/api/v1/institutions/teachers/pending')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(pendingTeachersRes.status, 200);
  const foundPending = pendingTeachersRes.body.data.teachers.some(t => t.id === teacherId);
  assert(foundPending, 'New teacher should appear in pending teachers list');

  // 5. Admin Approves Teacher
  const approveTeacherRes = await request(app)
    .post(`/api/v1/institutions/teachers/${teacherId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(approveTeacherRes.status, 200);
  assert.strictEqual(approveTeacherRes.body.data.teacher.approval_status, 'APPROVED');

  // Verify Teacher received approval notification
  const teacherNotifs = await dbAll('SELECT * FROM notifications WHERE user_id = ?', [teacherId]);
  assert(teacherNotifs.some(n => n.title === 'Teacher Account Approved'), 'Teacher should receive approval notification');

  // 6. Assign teacher to a section
  // Let's get an existing section and subject
  const section = await dbGet('SELECT id, class_id, academic_year_id FROM sections LIMIT 1');
  const subject = await dbGet('SELECT id FROM subjects LIMIT 1');
  assert(section && subject, 'Must have at least one section and subject in DB');

  const assignTeacherRes = await request(app)
    .post('/api/v1/institutions/teachers/assign')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      teacher_id: teacherId,
      subject_id: subject.id,
      section_id: section.id,
      academic_year_id: section.academic_year_id
    });
  assert.strictEqual(assignTeacherRes.status, 201);

  // 7. Student registers
  const studentEmail = `student_${Date.now()}@university.edu`;
  const studentReg = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Grace Hopper',
      email: studentEmail,
      password: 'Password123!',
      passwordConfirmation: 'Password123!',
      role: 'STUDENT'
    });
  assert.strictEqual(studentReg.status, 201);
  const studentId = studentReg.body.data.user.id;

  // Mark student verified for login
  await dbRun('UPDATE users SET is_verified = 1 WHERE id = ?', [studentId]);

  const studentLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: studentEmail, password: 'Password123!' });
  const studentToken = studentLogin.body.data.accessToken;

  // 8. Student requests enrollment in the section
  const reqEnrollRes = await request(app)
    .post('/api/v1/institutions/students/request-enrollment')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      section_id: section.id,
      roll_number: 'GH-101'
    });
  assert.strictEqual(reqEnrollRes.status, 201, 'Student enrollment request failed');
  const enrollmentId = reqEnrollRes.body.data.enrollment.id;
  assert.strictEqual(reqEnrollRes.body.data.enrollment.status, 'PENDING');

  // Verify Teacher of that section got notification
  const teacherNotifsAfterReq = await dbAll('SELECT * FROM notifications WHERE user_id = ?', [teacherId]);
  assert(teacherNotifsAfterReq.some(n => n.title === 'New Student Enrollment Request'), 'Teacher must receive student enrollment request notification');

  // 9. Teacher checks their pending student enrollments
  // First mark teacher verified to login
  await dbRun('UPDATE users SET is_verified = 1 WHERE id = ?', [teacherId]);
  const teacherLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: teacherEmail, password: 'Password123!' });
  const teacherToken = teacherLogin.body.data.accessToken;

  const pendingEnrollRes = await request(app)
    .get('/api/v1/institutions/enrollments/pending')
    .set('Authorization', `Bearer ${teacherToken}`);
  assert.strictEqual(pendingEnrollRes.status, 200);
  assert(pendingEnrollRes.body.data.pendingEnrollments.some(e => e.id === enrollmentId), 'Teacher should see student in pending enrollments list');

  // 10. Teacher Approves Student Enrollment
  const approveEnrollRes = await request(app)
    .post(`/api/v1/institutions/enrollments/${enrollmentId}/approve`)
    .set('Authorization', `Bearer ${teacherToken}`);
  assert.strictEqual(approveEnrollRes.status, 200);
  assert.strictEqual(approveEnrollRes.body.data.status, 'ACTIVE');

  // 11. Verify Student received approval notification
  const studentNotifs = await request(app)
    .get('/api/v1/notifications')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.strictEqual(studentNotifs.status, 200);
  assert(studentNotifs.body.data.notifications.some(n => n.title.includes('Enrollment Approved')), 'Student must receive approval notification');

  // 12. Student my-enrollment endpoint returns the active enrollment
  const myEnrollRes = await request(app)
    .get('/api/v1/institutions/my-enrollment')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.strictEqual(myEnrollRes.status, 200);
  assert.strictEqual(myEnrollRes.body.data.enrollment?.status, 'ACTIVE');
  assert.strictEqual(myEnrollRes.body.data.enrollment?.roll_number, 'GH-101');

  console.log('✅ ALL Notification & Security Approval Gate Tests Passed Cleanly!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
