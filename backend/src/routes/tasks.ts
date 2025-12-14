import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all tasks
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, status, assigned_to, priority } = req.query;
    let query = `
      SELECT t.*, 
             s.name as site_name,
             u1.full_name as assigned_to_name,
             u2.full_name as assigned_by_name
      FROM tasks t
      LEFT JOIN sites s ON t.site_id = s.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (site_id) {
      query += ` AND t.site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (status) {
      query += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }

    if (assigned_to) {
      query += ` AND t.assigned_to = $${paramCount++}`;
      params.push(assigned_to);
    }

    if (priority) {
      query += ` AND t.priority = $${paramCount++}`;
      params.push(priority);
    }

    // Workers can only see tasks assigned to them
    if (req.user!.role === 'worker') {
      query += ` AND t.assigned_to = $${paramCount++}`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT t.*, 
              s.name as site_name,
              u1.full_name as assigned_to_name,
              u2.full_name as assigned_by_name
       FROM tasks t
       LEFT JOIN sites s ON t.site_id = s.id
       LEFT JOIN users u1 ON t.assigned_to = u1.id
       LEFT JOIN users u2 ON t.assigned_by = u2.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get task updates
    const updates = await pool.query(
      'SELECT tu.*, u.full_name as updated_by_name FROM task_updates tu LEFT JOIN users u ON tu.updated_by = u.id WHERE tu.task_id = $1 ORDER BY tu.created_at DESC',
      [id]
    );

    res.json({ ...result.rows[0], updates: updates.rows });
  } catch (error: any) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task
router.post('/',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('site_id').isInt().withMessage('Site ID is required'),
    body('title').trim().notEmpty().withMessage('Task title is required'),
    body('assigned_to').isInt().withMessage('Assigned to user ID is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { site_id, title, description, assigned_to, priority, due_date } = req.body;

      const result = await pool.query(
        `INSERT INTO tasks (site_id, title, description, assigned_to, assigned_by, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          site_id,
          title,
          description || null,
          assigned_to,
          req.user!.id,
          priority || 'medium',
          due_date || null
        ]
      );

      // Create notification for assigned user
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
         VALUES ($1, 'New Task Assigned', $2, 'task', $3, 'task')`,
        [assigned_to, `You have been assigned a new task: ${title}`, result.rows[0].id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update task
router.put('/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, status, priority, due_date, assigned_to } = req.body;

      // Check if user has permission
      const taskCheck = await pool.query('SELECT assigned_to, assigned_by FROM tasks WHERE id = $1', [id]);
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskCheck.rows[0];
      const canEdit = req.user!.role === 'admin' || 
                     req.user!.role === 'manager' || 
                     req.user!.role === 'supervisor' ||
                     task.assigned_to === req.user!.id;

      if (!canEdit) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
        if (status === 'completed') {
          updates.push(`completed_at = CURRENT_TIMESTAMP`);
        }
      }
      if (priority !== undefined) {
        updates.push(`priority = $${paramCount++}`);
        params.push(priority);
      }
      if (due_date !== undefined) {
        updates.push(`due_date = $${paramCount++}`);
        params.push(due_date);
      }
      if (assigned_to !== undefined && (req.user!.role === 'admin' || req.user!.role === 'manager' || req.user!.role === 'supervisor')) {
        updates.push(`assigned_to = $${paramCount++}`);
        params.push(assigned_to);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Add task update/progress
router.post('/:id/updates',
  authenticate,
  [
    body('progress_percentage').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
    body('notes').optional().trim()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { progress_percentage, notes } = req.body;

      // Verify task exists and user has permission
      const taskCheck = await pool.query('SELECT assigned_to FROM tasks WHERE id = $1', [id]);
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskCheck.rows[0];
      if (req.user!.role !== 'admin' && req.user!.role !== 'manager' && req.user!.role !== 'supervisor' && task.assigned_to !== req.user!.id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const result = await pool.query(
        `INSERT INTO task_updates (task_id, updated_by, progress_percentage, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, req.user!.id, progress_percentage, notes || null]
      );

      // Update task progress if 100%
      if (progress_percentage === 100) {
        await pool.query(
          'UPDATE tasks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', id]
        );
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Add task update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get daily activities
router.get('/activities/daily', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, activity_date } = req.query;
    let query = `
      SELECT da.*, s.name as site_name, u.full_name as user_name
      FROM daily_activities da
      LEFT JOIN sites s ON da.site_id = s.id
      LEFT JOIN users u ON da.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (site_id) {
      query += ` AND da.site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (activity_date) {
      query += ` AND da.activity_date = $${paramCount++}`;
      params.push(activity_date);
    } else {
      query += ` AND da.activity_date = CURRENT_DATE`;
    }

    // Workers can only see their own activities
    if (req.user!.role === 'worker') {
      query += ` AND da.user_id = $${paramCount++}`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY da.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get daily activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create daily activity
router.post('/activities',
  authenticate,
  [
    body('site_id').isInt().withMessage('Site ID is required'),
    body('description').trim().notEmpty().withMessage('Activity description is required'),
    body('activity_date').optional().isISO8601().withMessage('Invalid date')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { site_id, description, activity_date, hours_worked } = req.body;

      const result = await pool.query(
        `INSERT INTO daily_activities (site_id, user_id, activity_date, description, hours_worked)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          site_id,
          req.user!.id,
          activity_date || new Date().toISOString().split('T')[0],
          description,
          hours_worked || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create daily activity error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

