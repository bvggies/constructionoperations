import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get attendance records
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, site_id, attendance_date, start_date, end_date } = req.query;
    let query = `
      SELECT a.*, u.full_name as user_name, s.name as site_name
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN sites s ON a.site_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (user_id) {
      query += ` AND a.user_id = $${paramCount++}`;
      params.push(user_id);
    }

    if (site_id) {
      query += ` AND a.site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (attendance_date) {
      query += ` AND a.attendance_date = $${paramCount++}`;
      params.push(attendance_date);
    }

    if (start_date && end_date) {
      query += ` AND a.attendance_date BETWEEN $${paramCount++} AND $${paramCount++}`;
      params.push(start_date, end_date);
    }

    // Workers can only see their own attendance
    if (req.user!.role === 'worker') {
      query += ` AND a.user_id = $${paramCount++}`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY a.attendance_date DESC, a.clock_in DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clock in
router.post('/clock-in',
  authenticate,
  [
    body('site_id').isInt().withMessage('Site ID is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { site_id } = req.body;
      const today = new Date().toISOString().split('T')[0];

      // Check if already clocked in today
      const existing = await pool.query(
        'SELECT id, clock_in FROM attendance WHERE user_id = $1 AND site_id = $2 AND attendance_date = $3',
        [req.user!.id, site_id, today]
      );

      if (existing.rows.length > 0 && existing.rows[0].clock_in) {
        return res.status(400).json({ error: 'Already clocked in today' });
      }

      const clockInTime = new Date();

      if (existing.rows.length > 0) {
        // Update existing record
        const result = await pool.query(
          `UPDATE attendance 
           SET clock_in = $1, status = 'present', updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [clockInTime, existing.rows[0].id]
        );
        res.json(result.rows[0]);
      } else {
        // Create new record
        const result = await pool.query(
          `INSERT INTO attendance (user_id, site_id, attendance_date, clock_in, status, marked_by)
           VALUES ($1, $2, $3, $4, 'present', $5)
           RETURNING *`,
          [req.user!.id, site_id, today, clockInTime, req.user!.id]
        );
        res.status(201).json(result.rows[0]);
      }
    } catch (error: any) {
      console.error('Clock in error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Clock out
router.post('/clock-out',
  authenticate,
  [
    body('site_id').isInt().withMessage('Site ID is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { site_id } = req.body;
      const today = new Date().toISOString().split('T')[0];

      const existing = await pool.query(
        'SELECT id, clock_in, clock_out FROM attendance WHERE user_id = $1 AND site_id = $2 AND attendance_date = $3',
        [req.user!.id, site_id, today]
      );

      if (existing.rows.length === 0 || !existing.rows[0].clock_in) {
        return res.status(400).json({ error: 'Must clock in first' });
      }

      if (existing.rows[0].clock_out) {
        return res.status(400).json({ error: 'Already clocked out today' });
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(existing.rows[0].clock_in);
      const hoursWorked = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      const result = await pool.query(
        `UPDATE attendance 
         SET clock_out = $1, hours_worked = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [clockOutTime, hoursWorked, existing.rows[0].id]
      );

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Clock out error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Mark attendance (for supervisors/managers)
router.post('/mark',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('user_id').isInt().withMessage('User ID is required'),
    body('site_id').isInt().withMessage('Site ID is required'),
    body('attendance_date').isISO8601().withMessage('Attendance date is required'),
    body('status').isIn(['present', 'absent', 'late', 'half_day', 'leave']).withMessage('Invalid status')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { user_id, site_id, attendance_date, status, clock_in, clock_out, hours_worked, notes } = req.body;

      const result = await pool.query(
        `INSERT INTO attendance (user_id, site_id, attendance_date, status, clock_in, clock_out, hours_worked, notes, marked_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, attendance_date, site_id)
         DO UPDATE SET status = $4, clock_in = $5, clock_out = $6, hours_worked = $7, notes = $8, marked_by = $9, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [user_id, site_id, attendance_date, status, clock_in || null, clock_out || null, hours_worked || null, notes || null, req.user!.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Mark attendance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create leave request
router.post('/leave-requests',
  authenticate,
  [
    body('leave_type').isIn(['sick', 'vacation', 'personal', 'emergency']).withMessage('Invalid leave type'),
    body('start_date').isISO8601().withMessage('Start date is required'),
    body('end_date').isISO8601().withMessage('End date is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { leave_type, start_date, end_date, reason } = req.body;

      const result = await pool.query(
        `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.user!.id, leave_type, start_date, end_date, reason]
      );

      // Notify managers
      const managers = await pool.query(
        "SELECT id FROM users WHERE role IN ('admin', 'manager')"
      );

      for (const manager of managers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
           VALUES ($1, 'Leave Request', $2, 'attendance', $3, 'leave_request')`,
          [manager.id, `New leave request from ${req.user!.username}`, result.rows[0].id]
        );
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create leave request error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get leave requests
router.get('/leave-requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, user_id } = req.query;
    let query = `
      SELECT lr.*, u.full_name as user_name
      FROM leave_requests lr
      LEFT JOIN users u ON lr.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND lr.status = $${paramCount++}`;
      params.push(status);
    }

    if (user_id) {
      query += ` AND lr.user_id = $${paramCount++}`;
      params.push(user_id);
    }

    // Workers can only see their own requests
    if (req.user!.role === 'worker') {
      query += ` AND lr.user_id = $${paramCount++}`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY lr.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve/Reject leave request
router.patch('/leave-requests/:id',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;

      const result = await pool.query(
        `UPDATE leave_requests 
         SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [status, req.user!.id, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Leave request not found' });
      }

      // Notify requester
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
         VALUES ($1, 'Leave Request ${status}', $2, 'attendance', $3, 'leave_request')`,
        [result.rows[0].user_id, `Your leave request has been ${status}`, id]
      );

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Approve leave request error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

