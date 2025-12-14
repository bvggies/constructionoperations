import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all projects
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, manager_id } = req.query;
    let query = `
      SELECT p.*, u.full_name as manager_name
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND p.status = $${paramCount++}`;
      params.push(status);
    }

    if (manager_id) {
      query += ` AND p.manager_id = $${paramCount++}`;
      params.push(manager_id);
    }

    // Workers can only see projects they're assigned to
    if (req.user!.role === 'worker') {
      query += ` AND EXISTS (
        SELECT 1 FROM sites s
        JOIN site_teams st ON s.id = st.site_id
        WHERE s.project_id = p.id AND st.worker_id = $${paramCount++}
      )`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, u.full_name as manager_name
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create project
router.post('/',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('location').optional().trim(),
    body('start_date').optional().isISO8601().withMessage('Invalid start date'),
    body('end_date').optional().isISO8601().withMessage('Invalid end date')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, location, start_date, end_date, status, manager_id } = req.body;

      const result = await pool.query(
        `INSERT INTO projects (name, description, location, start_date, end_date, status, manager_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          name,
          description || null,
          location || null,
          start_date || null,
          end_date || null,
          status || 'active',
          manager_id || (req.user!.role === 'manager' ? req.user!.id : null)
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update project
router.put('/:id',
  authenticate,
  authorize('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, location, start_date, end_date, status, manager_id } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }
      if (location !== undefined) {
        updates.push(`location = $${paramCount++}`);
        params.push(location);
      }
      if (start_date !== undefined) {
        updates.push(`start_date = $${paramCount++}`);
        params.push(start_date);
      }
      if (end_date !== undefined) {
        updates.push(`end_date = $${paramCount++}`);
        params.push(end_date);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }
      if (manager_id !== undefined) {
        updates.push(`manager_id = $${paramCount++}`);
        params.push(manager_id);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Update project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get sites for a project
router.get('/:id/sites', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*, u.full_name as supervisor_name
       FROM sites s
       LEFT JOIN users u ON s.supervisor_id = u.id
       WHERE s.project_id = $1
       ORDER BY s.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

