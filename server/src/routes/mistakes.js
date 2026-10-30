const express = require('express');
const { dbGet, dbRun, dbAll } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------
// 1. GET /api/v1/mistakes - List learner's logged mistakes
// -------------------------------------------------------------
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      subject = '',
      questionType = '',
      isResolved = '', // '0', '1', or empty for all
      search = ''
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    let whereClauses = [`user_id = ?`];
    const params = [userId];

    if (subject.trim()) {
      whereClauses.push(`subject = ?`);
      params.push(subject.trim());
    }

    if (questionType.trim()) {
      whereClauses.push(`question_type = ?`);
      params.push(questionType.trim());
    }

    if (isResolved !== '' && isResolved !== undefined) {
      whereClauses.push(`is_resolved = ?`);
      params.push(parseInt(isResolved) === 1 ? 1 : 0);
    }

    if (search.trim()) {
      whereClauses.push(`(question_text LIKE ? OR quiz_title LIKE ? OR explanation LIKE ?)`);
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

    const countRow = await dbGet(`SELECT COUNT(*) as total FROM mistake_notebook ${whereSQL}`, params);
    const total = countRow?.total || 0;

    const mistakes = await dbAll(
      `SELECT * FROM mistake_notebook 
       ${whereSQL} 
       ORDER BY is_resolved ASC, mistake_count DESC, created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        mistakes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. GET /api/v1/mistakes/stats - Mistake Notebook summary
// -------------------------------------------------------------
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const totalRow = await dbGet(`SELECT COUNT(*) as count FROM mistake_notebook WHERE user_id = ?`, [userId]);
    const unresolvedRow = await dbGet(`SELECT COUNT(*) as count FROM mistake_notebook WHERE user_id = ? AND is_resolved = 0`, [userId]);
    const resolvedRow = await dbGet(`SELECT COUNT(*) as count FROM mistake_notebook WHERE user_id = ? AND is_resolved = 1`, [userId]);

    const subjectBreakdown = await dbAll(
      `SELECT subject, COUNT(*) as count 
       FROM mistake_notebook 
       WHERE user_id = ? 
       GROUP BY subject 
       ORDER BY count DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        totalMistakes: totalRow?.count || 0,
        unresolvedCount: unresolvedRow?.count || 0,
        resolvedCount: resolvedRow?.count || 0,
        subjectBreakdown
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. PATCH /api/v1/mistakes/:id/resolve - Toggle resolution state
// -------------------------------------------------------------
router.patch('/:id/resolve', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { isResolved } = req.body;

    const mistake = await dbGet(`SELECT * FROM mistake_notebook WHERE id = ? AND user_id = ?`, [id, userId]);
    if (!mistake) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Mistake notebook item not found' }
      });
    }

    const newResolvedState = isResolved !== undefined
      ? (isResolved ? 1 : 0)
      : (mistake.is_resolved === 1 ? 0 : 1);

    await dbRun(
      `UPDATE mistake_notebook SET is_resolved = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newResolvedState, id]
    );

    res.json({
      success: true,
      data: {
        id,
        isResolved: newResolvedState === 1,
        message: newResolvedState === 1 ? 'Marked as resolved' : 'Marked as pending review'
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 4. DELETE /api/v1/mistakes/:id - Remove item from notebook
// -------------------------------------------------------------
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const mistake = await dbGet(`SELECT id FROM mistake_notebook WHERE id = ? AND user_id = ?`, [id, userId]);
    if (!mistake) {
      return res.status(404).json({
        success: false,
        error: { code: 'ERR_NOT_FOUND', message: 'Mistake notebook item not found' }
      });
    }

    await dbRun(`DELETE FROM mistake_notebook WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: { message: 'Item removed from Mistake Notebook' }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;