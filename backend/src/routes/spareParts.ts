import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { notifyRoleUsers } from '../services/notificationService';

const router = express.Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, low_stock } = req.query;
    let query = 'SELECT * FROM spare_parts WHERE 1=1';
    const params: any[] = [];
    let n = 1;
    if (category) { query += ` AND category = $${n++}`; params.push(category); }
    if (low_stock === 'true') query += ' AND quantity <= min_threshold';
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/consumption', authenticate, async (_req, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT mspu.*, sp.part_number, sp.name as part_name,
        emr.title as maintenance_title, e.name as equipment_name, e.equipment_code
      FROM maintenance_spare_parts_usage mspu
      JOIN spare_parts sp ON mspu.spare_part_id = sp.id
      LEFT JOIN equipment_maintenance_records emr ON mspu.maintenance_record_id = emr.id
      LEFT JOIN equipment e ON emr.equipment_id = e.id
      ORDER BY mspu.created_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/low-stock', authenticate, async (_req, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM spare_parts WHERE quantity <= min_threshold ORDER BY quantity ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('part_number').trim().notEmpty(),
    body('name').trim().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { part_number, name, description, category, unit, quantity, min_threshold, unit_cost, supplier } = req.body;
      const result = await pool.query(
        `INSERT INTO spare_parts (part_number, name, description, category, unit, quantity, min_threshold, unit_cost, supplier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [part_number, name, description || null, category || null, unit || 'each',
         quantity || 0, min_threshold || 0, unit_cost || null, supplier || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') return res.status(400).json({ error: 'Part number already exists' });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.put('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const fields = ['name', 'description', 'category', 'unit', 'quantity', 'min_threshold', 'unit_cost', 'supplier'];
    const updates: string[] = [];
    const params: any[] = [];
    let n = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${n++}`); params.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE spare_parts SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`, params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Spare part not found' });

    const part = result.rows[0];
    if (part.quantity <= part.min_threshold) {
      await notifyRoleUsers(['admin', 'manager'], 'Spare Parts Reorder Alert',
        `${part.name} (${part.part_number}) stock is low: ${part.quantity} remaining`, 'equipment', part.id, 'spare_part');
    }
    res.json(part);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM spare_parts WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Spare part not found' });
    res.json({ message: 'Spare part deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
