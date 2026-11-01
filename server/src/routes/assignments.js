const express = require('express');
const crypto = require('crypto');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Helper: Resolve organization ID for user
 */
async function getEffectiveOrgId(req) {
  if (req.user.organization_id) return req.user.organization_id;
  const user = await dbGet(`SELECT organization_id FROM users WHERE id = ?`, [req.user.id]);
  return user?.organization_id || 'demo-org-uuid';
}

// -------------------------------------------------------------
// POST /api/v1/assignments - Create and publish scoped assignment
// -------------------------------------------------------------
router.post('/', authenticateToken, requireRole(['TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const isOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const orgId = await getEffectiveOrgId(req);

    const quizId = req.body.quizId || req.body.quiz_id;
    const title = req.body.title;
    const instructions = req.body.instructions || '';
    const scopeType = req.body.scopeType || req.body.scope_type || 'SECTION';
    const targetSections = req.body.targetSections || req.body.section_ids || req.body.target_sections || [];
    const targetStudents = req.body.targetStudents || req.body.student_ids || req.body.target_students || [];
    const dueDate = req.body.dueDate || req.body.due_date || null;
    const allowLate = req.body.allowLate ?? req.body.allow_late ?? false;
    const timeLimitSec = req.body.timeLimitSec ?? req.body.time_limit_sec ?? 0;
    const maxAttempts = req.body.maxAttempts ?? req.body.max_attempts ?? 1;

    // Security check: Teacher must be approved by Organization Admin
    if (!isOrgAdmin) {
      const teacherUser = await dbGet(`SELECT approval_status FROM users WHERE id = ?`, [teacherId]);
      if (teacherUser && teacherUser.approval_status === 'PENDING') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_TEACHER_PENDING_APPROVAL',
            message: 'Your teacher account is pending organization admin approval before you can create assignments.'
          }
        });
      }
    }

    if (!quizId || !title) {
      return res.status(400).json({
        success: false,
        error: { message: 'quizId and title are required' }
      });
    }

    // 1. Verify quiz exists and is published
    const quiz = await dbGet(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);
    if (!quiz) {
      return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    }
    if (quiz.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, error: { message: 'Quiz must be published before creating an assignment' } });
    }

    // 2. Validate teacher teaching scope (unless Org Admin)
    if (!isOrgAdmin && targetSections.length > 0) {
      const authorizedSections = await dbAll(`
        SELECT section_id FROM teacher_assignments 
        WHERE teacher_id = ? AND is_active = 1
      `, [teacherId]);
      const authSecIds = new Set(authorizedSections.map(a => a.section_id));

      const unauthorized = targetSections.filter(sid => !authSecIds.has(sid));
      if (unauthorized.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ERR_FORBIDDEN_SECTION',
            message: `You are not authorized to assign assessments to section(s): ${unauthorized.join(', ')}`
          }
        });
      }
    }

    // 3. Resolve eligible students & de-duplicate recipients
    const recipientMap = new Map(); // studentId -> { studentId, sectionId, source }

    // Resolve students from sections
    if (targetSections.length > 0) {
      const placeholders = targetSections.map(() => '?').join(',');
      const sectionStudents = await dbAll(`
        SELECT user_id, section_id FROM student_enrollments
        WHERE section_id IN (${placeholders}) AND status = 'ACTIVE'
      `, targetSections);

      for (const row of sectionStudents) {
        recipientMap.set(row.user_id, {
          studentId: row.user_id,
          sectionId: row.section_id,
          source: 'SECTION'
        });
      }
    }

    // Resolve individually targeted students
    if (targetStudents.length > 0) {
      const placeholders = targetStudents.map(() => '?').join(',');
      const indStudents = await dbAll(`
        SELECT u.id AS user_id, se.section_id
        FROM users u
        LEFT JOIN student_enrollments se ON u.id = se.user_id AND se.status = 'ACTIVE'
        WHERE u.id IN (${placeholders})
      `, targetStudents);

      for (const row of indStudents) {
        // If already added via section, keep section or update source
        if (!recipientMap.has(row.user_id)) {
          recipientMap.set(row.user_id, {
            studentId: row.user_id,
            sectionId: row.section_id || null,
            source: 'INDIVIDUAL'
          });
        }
      }
    }

    if (recipientMap.size === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No eligible recipients found for the selected scope.' }
      });
    }

    // 4. Create Assignment record
    const assignmentId = generateUUID();
    await dbRun(`
      INSERT INTO assignments (
        id, organization_id, quiz_id, quiz_version, teacher_id, title, instructions,
        scope_type, target_sections, target_students, due_date, allow_late,
        time_limit_sec, max_attempts, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
    `, [
      assignmentId,
      orgId,
      quizId,
      quiz.published_version || quiz.version || 1,
      teacherId,
      title.trim(),
      instructions.trim(),
      scopeType,
      JSON.stringify(targetSections),
      JSON.stringify(targetStudents),
      dueDate || null,
      allowLate ? 1 : 0,
      timeLimitSec || quiz.time_limit_sec || 0,
      maxAttempts || 1
    ]);

    // 5. Create explicit de-duplicated recipient snapshot
    for (const recip of recipientMap.values()) {
      const recipId = generateUUID();
      await dbRun(`
        INSERT INTO assignment_recipients (
          id, assignment_id, student_id, section_id, source, status
        ) VALUES (?, ?, ?, ?, ?, 'ASSIGNED')
      `, [recipId, assignmentId, recip.studentId, recip.sectionId, recip.source]);
    }

    // 6. Notify all assigned students
    try {
      const { notifyUsers } = require('../services/notificationService');
      const studentIds = Array.from(recipientMap.keys());
      if (studentIds.length > 0) {
        await notifyUsers(studentIds, {
          title: 'New Assessment Assigned',
          message: `You have been assigned: "${title.trim()}". Check your dashboard to take it.`,
          type: 'ACTION_REQUIRED',
          linkUrl: '/student/quizzes'
        });
      }
    } catch (notifErr) {
      console.error('[Assignments] Failed to notify students:', notifErr);
    }

    const createdAssignment = await dbGet(`SELECT * FROM assignments WHERE id = ?`, [assignmentId]);

    res.status(201).json({
      success: true,
      data: {
        ...createdAssignment,
        id: assignmentId,
        assignment: createdAssignment,
        totalRecipients: recipientMap.size,
        recipient_count: recipientMap.size,
        message: `Assignment published successfully to ${recipientMap.size} student(s).`
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/v1/assignments/my-assigned (Student view of assigned tests)
// -------------------------------------------------------------
router.get('/my-assigned', authenticateToken, async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const assigned = await dbAll(`
      SELECT 
        ar.id AS recipient_id,
        ar.assignment_id,
        ar.status AS recipient_status,
        ar.score,
        ar.is_passed,
        ar.submitted_at,
        ar.attempt_id,
        a.title AS assignment_title,
        a.instructions,
        a.due_date,
        a.allow_late,
        a.time_limit_sec,
        a.max_attempts,
        a.created_at AS assigned_at,
        q.id AS quiz_id,
        q.title AS quiz_title,
        q.description AS quiz_description,
        q.category AS quiz_category,
        q.difficulty AS quiz_difficulty,
        u.name AS teacher_name,
        qa.status AS attempt_status,
        qa.score_percentage,
        qa.warning_count,
        qa.is_flagged
      FROM assignment_recipients ar
      JOIN assignments a ON ar.assignment_id = a.id
      JOIN quizzes q ON a.quiz_id = q.id
      JOIN users u ON a.teacher_id = u.id
      LEFT JOIN quiz_attempts qa ON ar.attempt_id = qa.id
      WHERE ar.student_id = ? AND a.status = 'PUBLISHED'
      ORDER BY a.created_at DESC
    `, [studentId]);

    // Mark overdue if due date has passed and status is still ASSIGNED or STARTED
    const now = new Date();
    const enriched = assigned.map(item => {
      let currentStatus = item.recipient_status;
      if (item.due_date && new Date(item.due_date) < now && (currentStatus === 'ASSIGNED' || currentStatus === 'STARTED')) {
        currentStatus = 'OVERDUE';
      }
      return {
        ...item,
        id: item.assignment_id,
        status: currentStatus,
        isOverdue: item.due_date ? new Date(item.due_date) < now : false
      };
    });

    res.json({
      success: true,
      data: { assignments: enriched }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/v1/assignments/teacher (Teacher view of their assignments)
// -------------------------------------------------------------
router.get('/teacher', authenticateToken, requireRole(['TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const isOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const orgId = await getEffectiveOrgId(req);

    let query = `
      SELECT a.*, q.title AS quiz_title, q.category AS quiz_category,
        u.name AS teacher_name,
        COUNT(ar.id) AS total_recipients,
        SUM(CASE WHEN ar.status = 'SUBMITTED' OR ar.status = 'LATE' THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN ar.status = 'STARTED' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN ar.status = 'ASSIGNED' THEN 1 ELSE 0 END) AS pending_count,
        AVG(CASE WHEN ar.score IS NOT NULL THEN ar.score ELSE NULL END) AS average_score
      FROM assignments a
      JOIN quizzes q ON a.quiz_id = q.id
      JOIN users u ON a.teacher_id = u.id
      LEFT JOIN assignment_recipients ar ON a.id = ar.assignment_id
    `;
    const params = [];

    if (isOrgAdmin) {
      query += ` WHERE a.organization_id = ?`;
      params.push(orgId);
    } else {
      query += ` WHERE a.teacher_id = ?`;
      params.push(teacherId);
    }

    query += ` GROUP BY a.id ORDER BY a.created_at DESC`;

    const assignments = await dbAll(query, params);

    res.json({
      success: true,
      data: { assignments }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/v1/assignments/:id/recipients (Student-by-student drilldown)
// -------------------------------------------------------------
router.get('/:id/recipients', authenticateToken, requireRole(['TEACHER', 'CREATOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.id;
    const isOrgAdmin = ['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    const assignment = await dbGet(`SELECT * FROM assignments WHERE id = ?`, [id]);
    if (!assignment) {
      return res.status(404).json({ success: false, error: { message: 'Assignment not found' } });
    }

    if (!isOrgAdmin && assignment.teacher_id !== teacherId) {
      return res.status(403).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const recipients = await dbAll(`
      SELECT 
        ar.*,
        ar.student_id AS user_id,
        u.name AS student_name,
        u.email AS student_email,
        se.roll_number,
        s.name AS section_name,
        qa.score_percentage,
        qa.time_taken_sec,
        qa.warning_count,
        qa.is_flagged,
        qa.flag_reason
      FROM assignment_recipients ar
      JOIN users u ON ar.student_id = u.id
      LEFT JOIN student_enrollments se ON ar.student_id = se.user_id AND se.status = 'ACTIVE'
      LEFT JOIN sections s ON ar.section_id = s.id
      LEFT JOIN quiz_attempts qa ON ar.attempt_id = qa.id
      WHERE ar.assignment_id = ?
      ORDER BY s.name ASC, se.roll_number ASC, u.name ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        assignment,
        recipients,
        totalRecipients: recipients.length
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
