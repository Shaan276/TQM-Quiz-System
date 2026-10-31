const express = require('express');
const crypto = require('crypto');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Helper: Resolve organization ID for current user
 */
async function getEffectiveOrgId(req) {
  if (req.user.organization_id) return req.user.organization_id;
  const user = await dbGet(`SELECT organization_id FROM users WHERE id = ?`, [req.user.id]);
  return user?.organization_id || 'demo-org-uuid';
}

// -------------------------------------------------------------
// GET /api/v1/institutions/my-enrollment (Student view)
// -------------------------------------------------------------
router.get('/my-enrollment', authenticateToken, async (req, res, next) => {
  try {
    const enrollment = await dbGet(`
      SELECT e.*, 
        o.name AS organization_name, o.code AS organization_code,
        ay.name AS academic_year_name,
        d.name AS department_name, d.code AS department_code,
        c.name AS class_name, c.code AS class_code,
        s.name AS section_name
      FROM student_enrollments e
      JOIN organizations o ON e.organization_id = o.id
      JOIN academic_years ay ON e.academic_year_id = ay.id
      JOIN departments d ON e.department_id = d.id
      JOIN classes c ON e.class_id = c.id
      JOIN sections s ON e.section_id = s.id
      WHERE e.user_id = ? AND e.status = 'ACTIVE'
    `, [req.user.id]);

    res.json({
      success: true,
      data: { enrollment: enrollment || null }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/v1/institutions/my-assignments (Teacher view)
// -------------------------------------------------------------
router.get('/my-assignments', authenticateToken, async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const isTeacher = req.user.role === 'TEACHER' || req.user.role === 'CREATOR';
    const isAdmin = req.user.role === 'ORG_ADMIN' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';

    const orgId = await getEffectiveOrgId(req);

    let allocations = [];
    if (isAdmin) {
      // Admins see all active allocations across org
      allocations = await dbAll(`
        SELECT ta.*, 
          u.name AS teacher_name, u.email AS teacher_email,
          d.name AS department_name, sub.name AS subject_name, sub.code AS subject_code,
          c.name AS class_name, s.name AS section_name, ay.name AS academic_year_name
        FROM teacher_assignments ta
        JOIN users u ON ta.teacher_id = u.id
        JOIN departments d ON ta.department_id = d.id
        JOIN subjects sub ON ta.subject_id = sub.id
        JOIN classes c ON ta.class_id = c.id
        JOIN sections s ON ta.section_id = s.id
        JOIN academic_years ay ON ta.academic_year_id = ay.id
        WHERE ta.organization_id = ? AND ta.is_active = 1
      `, [orgId]);
    } else {
      // Scoped teacher allocations
      allocations = await dbAll(`
        SELECT ta.*, 
          d.name AS department_name, sub.name AS subject_name, sub.code AS subject_code,
          c.name AS class_name, s.name AS section_name, ay.name AS academic_year_name
        FROM teacher_assignments ta
        JOIN departments d ON ta.department_id = d.id
        JOIN subjects sub ON ta.subject_id = sub.id
        JOIN classes c ON ta.class_id = c.id
        JOIN sections s ON ta.section_id = s.id
        JOIN academic_years ay ON ta.academic_year_id = ay.id
        WHERE ta.teacher_id = ? AND ta.is_active = 1
      `, [teacherId]);
    }

    // Extract unique sections and subjects taught
    const assignedSectionIds = [...new Set(allocations.map(a => a.section_id))];

    // Fetch eligible students in these sections
    let eligibleStudents = [];
    if (assignedSectionIds.length > 0) {
      const placeholders = assignedSectionIds.map(() => '?').join(',');
      eligibleStudents = await dbAll(`
        SELECT u.id, u.name, u.email, se.roll_number, se.section_id, s.name AS section_name, c.name AS class_name
        FROM student_enrollments se
        JOIN users u ON se.user_id = u.id
        JOIN sections s ON se.section_id = s.id
        JOIN classes c ON se.class_id = c.id
        WHERE se.section_id IN (${placeholders}) AND se.status = 'ACTIVE'
        ORDER BY s.name ASC, se.roll_number ASC, u.name ASC
      `, assignedSectionIds);
    }

    res.json({
      success: true,
      data: {
        allocations,
        sections: allocations.map(a => ({ id: a.section_id, name: a.section_name, class_name: a.class_name })),
        eligibleStudents,
        totalSections: assignedSectionIds.length,
        totalStudents: eligibleStudents.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/v1/institutions/structure (All hierarchy entities)
// -------------------------------------------------------------
router.get('/structure', authenticateToken, async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);

    const organization = await dbGet(`SELECT * FROM organizations WHERE id = ?`, [orgId]);
    const academicYears = await dbAll(`SELECT * FROM academic_years WHERE organization_id = ? AND is_archived = 0 ORDER BY is_current DESC, name DESC`, [orgId]);
    const departments = await dbAll(`SELECT * FROM departments WHERE organization_id = ? AND is_archived = 0 ORDER BY name ASC`, [orgId]);
    const classes = await dbAll(`SELECT * FROM classes WHERE organization_id = ? AND is_archived = 0 ORDER BY name ASC`, [orgId]);
    const sections = await dbAll(`
      SELECT s.*, c.department_id, c.name AS class_name 
      FROM sections s 
      JOIN classes c ON s.class_id = c.id 
      WHERE c.organization_id = ? AND s.is_archived = 0 
      ORDER BY s.name ASC
    `, [orgId]);
    const subjects = await dbAll(`SELECT * FROM subjects WHERE organization_id = ? AND is_archived = 0 ORDER BY name ASC`, [orgId]);

    res.json({
      success: true,
      data: {
        organization,
        academicYears,
        departments,
        classes,
        sections,
        subjects
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/institutions/departments (Create Dept)
// -------------------------------------------------------------
router.post('/departments', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);
    const { name, code, description = '' } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, error: { message: 'Name and code are required' } });
    }

    const existing = await dbGet(`SELECT id FROM departments WHERE organization_id = ? AND code = ?`, [orgId, code]);
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Department code already exists in this organization' } });
    }

    const id = generateUUID();
    await dbRun(`
      INSERT INTO departments (id, organization_id, name, code, description)
      VALUES (?, ?, ?, ?, ?)
    `, [id, orgId, name.trim(), code.trim().toUpperCase(), description.trim()]);

    const created = await dbGet(`SELECT * FROM departments WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: { ...created, department: created } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/institutions/classes (Create Class)
// -------------------------------------------------------------
router.post('/classes', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);
    const { department_id, name, code } = req.body;

    if (!department_id || !name || !code) {
      return res.status(400).json({ success: false, error: { message: 'Department, name and code are required' } });
    }

    const existing = await dbGet(`SELECT id FROM classes WHERE organization_id = ? AND department_id = ? AND code = ?`, [orgId, department_id, code]);
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Class code already exists in this department' } });
    }

    const id = generateUUID();
    await dbRun(`
      INSERT INTO classes (id, organization_id, department_id, name, code)
      VALUES (?, ?, ?, ?, ?)
    `, [id, orgId, department_id, name.trim(), code.trim().toUpperCase()]);

    const created = await dbGet(`SELECT * FROM classes WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: { ...created, class: created } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/institutions/sections (Create Section)
// -------------------------------------------------------------
router.post('/sections', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const { class_id, academic_year_id, name, capacity = 60 } = req.body;

    if (!class_id || !academic_year_id || !name) {
      return res.status(400).json({ success: false, error: { message: 'Class, academic year, and section name are required' } });
    }

    const existing = await dbGet(`SELECT id FROM sections WHERE class_id = ? AND academic_year_id = ? AND name = ?`, [class_id, academic_year_id, name]);
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Section already exists for this class and academic year' } });
    }

    const id = generateUUID();
    await dbRun(`
      INSERT INTO sections (id, class_id, academic_year_id, name, capacity)
      VALUES (?, ?, ?, ?, ?)
    `, [id, class_id, academic_year_id, name.trim(), capacity]);

    const created = await dbGet(`SELECT * FROM sections WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: { ...created, section: created } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/institutions/subjects (Create Subject)
// -------------------------------------------------------------
router.post('/subjects', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);
    const { name, code, department_id = null, description = '' } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, error: { message: 'Subject name and code are required' } });
    }

    const existing = await dbGet(`SELECT id FROM subjects WHERE organization_id = ? AND code = ?`, [orgId, code]);
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Subject code already exists in this organization' } });
    }

    const id = generateUUID();
    await dbRun(`
      INSERT INTO subjects (id, organization_id, department_id, name, code, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, orgId, department_id, name.trim(), code.trim().toUpperCase(), description.trim()]);

    const created = await dbGet(`SELECT * FROM subjects WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: { ...created, subject: created } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/institutions/students/enroll (Enroll Student)
// -------------------------------------------------------------
router.post('/students/enroll', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);
    let { user_id, academic_year_id, department_id, class_id, section_id, roll_number = null } = req.body;

    if (!user_id || !section_id) {
      return res.status(400).json({ success: false, error: { message: 'user_id and section_id are required' } });
    }

    if (!class_id || !department_id || !academic_year_id) {
      const sec = await dbGet(`
        SELECT s.id, s.academic_year_id, s.class_id, c.department_id 
        FROM sections s 
        JOIN classes c ON s.class_id = c.id 
        WHERE s.id = ?
      `, [section_id]);
      if (!sec) {
        return res.status(404).json({ success: false, error: { message: 'Section not found' } });
      }
      academic_year_id = academic_year_id || sec.academic_year_id;
      class_id = class_id || sec.class_id;
      department_id = department_id || sec.department_id;
    }

    // Check if user is a student
    const student = await dbGet(`SELECT id, role, organization_id FROM users WHERE id = ?`, [user_id]);
    if (!student) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    // Update user organization_id
    await dbRun(`UPDATE users SET organization_id = ? WHERE id = ?`, [orgId, user_id]);

    const existingEnroll = await dbGet(`SELECT id FROM student_enrollments WHERE user_id = ? AND academic_year_id = ?`, [user_id, academic_year_id]);
    if (existingEnroll) {
      // Update existing enrollment
      await dbRun(`
        UPDATE student_enrollments
        SET department_id = ?, class_id = ?, section_id = ?, roll_number = ?, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [department_id, class_id, section_id, roll_number, existingEnroll.id]);

      const updated = await dbGet(`SELECT * FROM student_enrollments WHERE id = ?`, [existingEnroll.id]);
      return res.json({ success: true, data: { enrollment: updated, action: 'UPDATED' } });
    }

    const id = generateUUID();
    await dbRun(`
      INSERT INTO student_enrollments (id, user_id, organization_id, academic_year_id, department_id, class_id, section_id, roll_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [id, user_id, orgId, academic_year_id, department_id, class_id, section_id, roll_number]);

    const created = await dbGet(`SELECT * FROM student_enrollments WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: { enrollment: created, action: 'CREATED' } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// PUT /api/v1/institutions/students/:userId/transfer (Transfer Section Safely)
// -------------------------------------------------------------
router.put('/students/:userId/transfer', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const target_section_id = req.body.target_section_id || req.body.targetSectionId;
    const target_class_id = req.body.target_class_id || req.body.targetClassId;

    if (!target_section_id) {
      return res.status(400).json({ success: false, error: { message: 'target_section_id is required' } });
    }

    const currentEnrollment = await dbGet(`SELECT * FROM student_enrollments WHERE user_id = ? AND status = 'ACTIVE'`, [userId]);
    if (!currentEnrollment) {
      return res.status(404).json({ success: false, error: { message: 'Active enrollment not found for student' } });
    }

    const targetSection = await dbGet(`SELECT * FROM sections WHERE id = ?`, [target_section_id]);
    if (!targetSection) {
      return res.status(404).json({ success: false, error: { message: 'Target section not found' } });
    }

    const newClassId = target_class_id || targetSection.class_id;

    // Update enrollment. Past assignments in `assignment_recipients` keep historical section_id snapshot untouched!
    await dbRun(`
      UPDATE student_enrollments
      SET section_id = ?, class_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [target_section_id, newClassId, currentEnrollment.id]);

    const updated = await dbGet(`SELECT * FROM student_enrollments WHERE id = ?`, [currentEnrollment.id]);
    res.json({
      success: true,
      data: {
        enrollment: updated,
        message: 'Student transferred successfully. Historical assignment snapshots preserved.'
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/institutions/teachers/assign (Allocate Teaching Assignment)
// -------------------------------------------------------------
router.post('/teachers/assign', authenticateToken, requireRole(['ORG_ADMIN', 'SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);
    let { teacher_id, academic_year_id, department_id, subject_id, class_id, section_id } = req.body;

    if (!teacher_id || !subject_id || !section_id) {
      return res.status(400).json({ success: false, error: { message: 'teacher_id, subject_id, and section_id are required' } });
    }

    if (!class_id || !department_id || !academic_year_id) {
      const sec = await dbGet(`
        SELECT s.id, s.academic_year_id, s.class_id, c.department_id 
        FROM sections s 
        JOIN classes c ON s.class_id = c.id 
        WHERE s.id = ?
      `, [section_id]);
      if (!sec) {
        return res.status(404).json({ success: false, error: { message: 'Section not found' } });
      }
      academic_year_id = academic_year_id || sec.academic_year_id;
      class_id = class_id || sec.class_id;
      department_id = department_id || sec.department_id;
    }

    // Ensure teacher belongs to this organization
    await dbRun(`UPDATE users SET organization_id = ? WHERE id = ?`, [orgId, teacher_id]);

    const existing = await dbGet(`
      SELECT id FROM teacher_assignments
      WHERE teacher_id = ? AND subject_id = ? AND section_id = ? AND academic_year_id = ?
    `, [teacher_id, subject_id, section_id, academic_year_id]);

    if (existing) {
      await dbRun(`UPDATE teacher_assignments SET is_active = 1 WHERE id = ?`, [existing.id]);
      const updated = await dbGet(`SELECT * FROM teacher_assignments WHERE id = ?`, [existing.id]);
      return res.json({ success: true, data: { allocation: updated } });
    }

    const id = generateUUID();
    await dbRun(`
      INSERT INTO teacher_assignments (id, teacher_id, organization_id, academic_year_id, department_id, subject_id, class_id, section_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, teacher_id, orgId, academic_year_id, department_id, subject_id, class_id, section_id]);

    const created = await dbGet(`SELECT * FROM teacher_assignments WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: { allocation: created } });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// GET /api/v1/institutions/students (Search & list students by filter)
// -------------------------------------------------------------
router.get('/students', authenticateToken, async (req, res, next) => {
  try {
    const orgId = await getEffectiveOrgId(req);
    const { department_id, class_id, section_id, search = '' } = req.query;

    let query = `
      SELECT u.id, u.name, u.email, se.roll_number, se.status AS enrollment_status,
        d.name AS department_name, c.name AS class_name, s.name AS section_name, s.id AS section_id
      FROM student_enrollments se
      JOIN users u ON se.user_id = u.id
      JOIN departments d ON se.department_id = d.id
      JOIN classes c ON se.class_id = c.id
      JOIN sections s ON se.section_id = s.id
      WHERE se.organization_id = ? AND se.status = 'ACTIVE'
    `;
    const params = [orgId];

    if (department_id) {
      query += ` AND se.department_id = ?`;
      params.push(department_id);
    }
    if (class_id) {
      query += ` AND se.class_id = ?`;
      params.push(class_id);
    }
    if (section_id) {
      query += ` AND se.section_id = ?`;
      params.push(section_id);
    }
    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR se.roll_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY s.name ASC, se.roll_number ASC, u.name ASC LIMIT 200`;

    const students = await dbAll(query, params);
    res.json({ success: true, data: { students } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
