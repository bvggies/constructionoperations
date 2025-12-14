import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all equipment
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, type } = req.query;
    let query = 'SELECT * FROM equipment WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (type) {
      query += ` AND type = $${paramCount++}`;
      params.push(type);
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get equipment by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM equipment WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment
router.post('/',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Equipment name is required'),
    body('type').trim().notEmpty().withMessage('Equipment type is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, type, model, serial_number, purchase_date, last_maintenance_date, next_maintenance_date } = req.body;

      const result = await pool.query(
        `INSERT INTO equipment (name, type, model, serial_number, purchase_date, last_maintenance_date, next_maintenance_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          name,
          type,
          model || null,
          serial_number || null,
          purchase_date || null,
          last_maintenance_date || null,
          next_maintenance_date || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create equipment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update equipment
router.put('/:id',
  authenticate,
  authorize('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, type, model, serial_number, status, last_maintenance_date, next_maintenance_date } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (type !== undefined) {
        updates.push(`type = $${paramCount++}`);
        params.push(type);
      }
      if (model !== undefined) {
        updates.push(`model = $${paramCount++}`);
        params.push(model);
      }
      if (serial_number !== undefined) {
        updates.push(`serial_number = $${paramCount++}`);
        params.push(serial_number);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }
      if (last_maintenance_date !== undefined) {
        updates.push(`last_maintenance_date = $${paramCount++}`);
        params.push(last_maintenance_date);
      }
      if (next_maintenance_date !== undefined) {
        updates.push(`next_maintenance_date = $${paramCount++}`);
        params.push(next_maintenance_date);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Update equipment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Record equipment usage
router.post('/:id/usage',
  authenticate,
  [
    body('site_id').isInt().withMessage('Site ID is required'),
    body('start_date').isISO8601().withMessage('Start date is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { site_id, start_date, notes } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if equipment is available
        const equipmentCheck = await client.query('SELECT status FROM equipment WHERE id = $1', [id]);
        if (equipmentCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Equipment not found' });
        }

        if (equipmentCheck.rows[0].status !== 'available') {
          return res.status(400).json({ error: 'Equipment is not available' });
        }

        // Create usage record
        const result = await client.query(
          `INSERT INTO equipment_usage (equipment_id, site_id, user_id, start_date, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [id, site_id, req.user!.id, start_date, notes || null]
        );

        // Update equipment status
        await client.query('UPDATE equipment SET status = $1 WHERE id = $2', ['in_use', id]);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Record equipment usage error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// End equipment usage
router.patch('/usage/:id/end',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const usageCheck = await client.query('SELECT equipment_id FROM equipment_usage WHERE id = $1', [id]);
        if (usageCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Usage record not found' });
        }

        const equipmentId = usageCheck.rows[0].equipment_id;

        // End usage
        const result = await client.query(
          `UPDATE equipment_usage 
           SET end_date = CURRENT_TIMESTAMP, status = 'completed'
           WHERE id = $1
           RETURNING *`,
          [id]
        );

        // Update equipment status
        await client.query('UPDATE equipment SET status = $1 WHERE id = $2', ['available', equipmentId]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('End equipment usage error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Report equipment breakdown
router.post('/:id/breakdown',
  authenticate,
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { description, severity, notes } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create breakdown record
        const result = await client.query(
          `INSERT INTO equipment_breakdowns (equipment_id, reported_by, description, severity, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [id, req.user!.id, description, severity, notes || null]
        );

        // Update equipment status
        await client.query('UPDATE equipment SET status = $1 WHERE id = $2', ['broken', id]);

        // Notify managers
        const managers = await pool.query(
          "SELECT id FROM users WHERE role IN ('admin', 'manager')"
        );

        const equipmentResult = await client.query('SELECT name FROM equipment WHERE id = $1', [id]);
        const equipmentName = equipmentResult.rows[0]?.name || 'Equipment';

        for (const manager of managers.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
             VALUES ($1, 'Equipment Breakdown', $2, 'equipment', $3, 'breakdown')`,
            [manager.id, `${equipmentName} has broken down: ${description}`, result.rows[0].id]
          );
        }

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Report breakdown error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get breakdowns
router.get('/breakdowns/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, severity } = req.query;
    let query = `
      SELECT eb.*, e.name as equipment_name, e.type as equipment_type, u.full_name as reported_by_name
      FROM equipment_breakdowns eb
      LEFT JOIN equipment e ON eb.equipment_id = e.id
      LEFT JOIN users u ON eb.reported_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND eb.status = $${paramCount++}`;
      params.push(status);
    }

    if (severity) {
      query += ` AND eb.severity = $${paramCount++}`;
      params.push(severity);
    }

    query += ' ORDER BY eb.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get breakdowns error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update breakdown status
router.patch('/breakdowns/:id',
  authenticate,
  authorize('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, repair_cost, notes } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
        if (status === 'fixed') {
          updates.push(`fixed_at = CURRENT_TIMESTAMP`);
        }
      }
      if (repair_cost !== undefined) {
        updates.push(`repair_cost = $${paramCount++}`);
        params.push(repair_cost);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${paramCount++}`);
        params.push(notes);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE equipment_breakdowns SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Breakdown not found' });
      }

      // If fixed, update equipment status
      if (status === 'fixed') {
        const breakdown = await pool.query('SELECT equipment_id FROM equipment_breakdowns WHERE id = $1', [id]);
        if (breakdown.rows.length > 0) {
          await pool.query('UPDATE equipment SET status = $1 WHERE id = $2', ['available', breakdown.rows[0].equipment_id]);
        }
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Update breakdown error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

