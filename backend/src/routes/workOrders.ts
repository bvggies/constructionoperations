import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { sendNotification } from '../services/notificationService';

const router = express.Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, equipment_id, assigned_to } = req.query;
    let query = `
      SELECT wo.*, e.name as equipment_name, e.equipment_code,
        u.full_name as assigned_to_name, c.full_name as created_by_name
      FROM equipment_work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN users c ON wo.created_by = c.id WHERE 1=1
    `;
    const params: any[] = [];
    let n = 1;
    if (status) { query += ` AND wo.status = $${n++}`; params.push(status); }
    if (equipment_id) { query += ` AND wo.equipment_id = $${n++}`; params.push(equipment_id); }
    if (assigned_to) { query += ` AND wo.assigned_to = $${n++}`; params.push(assigned_to); }
    if (req.user!.role === 'worker') {
      query += ` AND wo.assigned_to = $${n++}`; params.push(req.user!.id);
    }
    query += ' ORDER BY wo.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT wo.*, e.name as equipment_name, e.equipment_code,
        u.full_name as assigned_to_name, c.full_name as created_by_name
      FROM equipment_work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN users c ON wo.created_by = c.id WHERE wo.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Work order not found' });
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('equipment_id').isInt(),
    body('title').trim().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const {
        equipment_id, title, description, work_order_type, priority,
        assigned_to, due_date, related_breakdown_id, related_maintenance_id,
      } = req.body;

      const status = assigned_to ? 'assigned' : 'open';
      const result = await pool.query(
        `INSERT INTO equipment_work_orders (equipment_id, title, description, work_order_type, priority, status, assigned_to, created_by, due_date, related_breakdown_id, related_maintenance_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [equipment_id, title, description || null, work_order_type || 'maintenance', priority || 'medium',
         status, assigned_to || null, req.user!.id, due_date || null,
         related_breakdown_id || null, related_maintenance_id || null]
      );

      if (assigned_to) {
        await sendNotification({
          userId: assigned_to,
          title: 'Work Order Assigned',
          message: `Work order "${title}" has been assigned to you`,
          type: 'equipment',
          relatedId: result.rows[0].id,
          relatedType: 'work_order',
        });
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, assigned_to, completion_notes, priority, due_date } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let n = 1;

    if (status !== undefined) {
      updates.push(`status = $${n++}`); params.push(status);
      if (status === 'completed') updates.push('completed_at = CURRENT_TIMESTAMP');
    }
    if (assigned_to !== undefined) {
      updates.push(`status = 'assigned'`, `assigned_to = $${n++}`); params.push(assigned_to);
    }
    if (completion_notes !== undefined) { updates.push(`completion_notes = $${n++}`); params.push(completion_notes); }
    if (priority !== undefined) { updates.push(`priority = $${n++}`); params.push(priority); }
    if (due_date !== undefined) { updates.push(`due_date = $${n++}`); params.push(due_date); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE equipment_work_orders SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`, params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Work order not found' });

    const wo = result.rows[0];
    if (assigned_to) {
      await sendNotification({
        userId: assigned_to,
        title: 'Work Order Assigned',
        message: `Work order "${wo.title}" has been assigned to you`,
        type: 'equipment',
        relatedId: wo.id,
        relatedType: 'work_order',
      });
    }

    res.json(wo);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
