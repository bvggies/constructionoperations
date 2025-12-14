import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all sites
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, status, supervisor_id } = req.query;
    let query = `
      SELECT s.*, p.name as project_name, u.full_name as supervisor_name
      FROM sites s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN users u ON s.supervisor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (project_id) {
      query += ` AND s.project_id = $${paramCount++}`;
      params.push(project_id);
    }

    if (status) {
      query += ` AND s.status = $${paramCount++}`;
      params.push(status);
    }

    if (supervisor_id) {
      query += ` AND s.supervisor_id = $${paramCount++}`;
      params.push(supervisor_id);
    }

    // Workers can only see sites they're assigned to
    if (req.user!.role === 'worker') {
      query += ` AND EXISTS (
        SELECT 1 FROM site_teams st WHERE st.site_id = s.id AND st.worker_id = $${paramCount++}
      )`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get site by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*, p.name as project_name, u.full_name as supervisor_name
       FROM sites s
       LEFT JOIN projects p ON s.project_id = p.id
       LEFT JOIN users u ON s.supervisor_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create site
router.post('/',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('project_id').isInt().withMessage('Project ID is required'),
    body('name').trim().notEmpty().withMessage('Site name is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { project_id, name, location, supervisor_id, status } = req.body;

      const result = await pool.query(
        `INSERT INTO sites (project_id, name, location, supervisor_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          project_id,
          name,
          location || null,
          supervisor_id || (req.user!.role === 'supervisor' ? req.user!.id : null),
          status || 'active'
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create site error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update site
router.put('/:id',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, location, supervisor_id, status } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (location !== undefined) {
        updates.push(`location = $${paramCount++}`);
        params.push(location);
      }
      if (supervisor_id !== undefined) {
        updates.push(`supervisor_id = $${paramCount++}`);
        params.push(supervisor_id);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE sites SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Site not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Update site error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Assign worker to site
router.post('/:id/assign-worker',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('worker_id').isInt().withMessage('Worker ID is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { worker_id } = req.body;

      const result = await pool.query(
        `INSERT INTO site_teams (site_id, worker_id)
         VALUES ($1, $2)
         ON CONFLICT (site_id, worker_id) DO NOTHING
         RETURNING *`,
        [id, worker_id]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Worker already assigned to this site' });
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Assign worker error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get site team members
router.get('/:id/team', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.phone, st.assigned_date
       FROM site_teams st
       JOIN users u ON st.worker_id = u.id
       WHERE st.site_id = $1
       ORDER BY st.assigned_date DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Get site team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove worker from site
router.delete('/:id/team/:worker_id',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, worker_id } = req.params;

      const result = await pool.query(
        'DELETE FROM site_teams WHERE site_id = $1 AND worker_id = $2 RETURNING *',
        [id, worker_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Worker not found in site team' });
      }

      res.json({ message: 'Worker removed from site' });
    } catch (error: any) {
      console.error('Remove worker error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

