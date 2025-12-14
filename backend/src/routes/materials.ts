import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all materials
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM materials WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (category) {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get material inventory for a site
router.get('/inventory/:site_id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id } = req.params;

    const result = await pool.query(
      `SELECT mi.*, m.name as material_name, m.unit, m.category,
              CASE WHEN mi.quantity <= mi.min_threshold THEN true ELSE false END as low_stock
       FROM material_inventory mi
       JOIN materials m ON mi.material_id = m.id
       WHERE mi.site_id = $1
       ORDER BY m.name`,
      [site_id]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create material
router.post('/',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Material name is required'),
    body('unit').trim().notEmpty().withMessage('Unit is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, unit, category } = req.body;

      const result = await pool.query(
        `INSERT INTO materials (name, description, unit, category)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description || null, unit, category || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create material error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Record material transaction
router.post('/transactions',
  authenticate,
  [
    body('site_id').isInt().withMessage('Site ID is required'),
    body('material_id').isInt().withMessage('Material ID is required'),
    body('transaction_type').isIn(['delivery', 'usage', 'adjustment', 'return']).withMessage('Invalid transaction type'),
    body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be positive')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { site_id, material_id, transaction_type, quantity, unit_price, supplier, notes } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert transaction
        const transactionResult = await client.query(
          `INSERT INTO material_transactions (site_id, material_id, transaction_type, quantity, unit_price, supplier, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [site_id, material_id, transaction_type, quantity, unit_price || null, supplier || null, notes || null, req.user!.id]
        );

        // Update inventory
        const quantityChange = transaction_type === 'delivery' || transaction_type === 'return' 
          ? quantity 
          : -quantity;

        await client.query(
          `INSERT INTO material_inventory (site_id, material_id, quantity, min_threshold)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (site_id, material_id)
           DO UPDATE SET quantity = material_inventory.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
          [site_id, material_id, quantityChange]
        );

        // Check for low stock and create notification
        const inventoryCheck = await client.query(
          'SELECT quantity, min_threshold FROM material_inventory WHERE site_id = $1 AND material_id = $2',
          [site_id, material_id]
        );

        if (inventoryCheck.rows.length > 0) {
          const inv = inventoryCheck.rows[0];
          if (inv.quantity <= inv.min_threshold) {
            // Get site supervisor
            const siteResult = await client.query('SELECT supervisor_id FROM sites WHERE id = $1', [site_id]);
            if (siteResult.rows.length > 0 && siteResult.rows[0].supervisor_id) {
              const materialResult = await client.query('SELECT name FROM materials WHERE id = $1', [material_id]);
              await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
                 VALUES ($1, 'Low Stock Alert', $2, 'material', $3, 'material')`,
                [
                  siteResult.rows[0].supervisor_id,
                  `Material ${materialResult.rows[0].name} is running low (${inv.quantity} remaining)`,
                  material_id
                ]
              );
            }
          }
        }

        await client.query('COMMIT');
        res.status(201).json(transactionResult.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create material requisition
router.post('/requisitions',
  authenticate,
  [
    body('site_id').isInt().withMessage('Site ID is required'),
    body('material_id').isInt().withMessage('Material ID is required'),
    body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be positive')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { site_id, material_id, quantity, notes } = req.body;

      const result = await pool.query(
        `INSERT INTO material_requisitions (site_id, material_id, quantity, requested_by, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [site_id, material_id, quantity, req.user!.id, notes || null]
      );

      // Notify managers
      const managers = await pool.query(
        "SELECT id FROM users WHERE role IN ('admin', 'manager')"
      );

      const materialResult = await pool.query('SELECT name FROM materials WHERE id = $1', [material_id]);
      const materialName = materialResult.rows[0]?.name || 'Material';

      for (const manager of managers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
           VALUES ($1, 'Material Requisition Request', $2, 'material', $3, 'requisition')`,
          [manager.id, `New material requisition: ${quantity} ${materialName}`, result.rows[0].id]
        );
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create requisition error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Approve/Reject requisition
router.patch('/requisitions/:id/approve',
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
        `UPDATE material_requisitions 
         SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [status, req.user!.id, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Requisition not found' });
      }

      // Notify requester
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
         VALUES ($1, 'Requisition ${status}', $2, 'material', $3, 'requisition')`,
        [result.rows[0].requested_by, `Your material requisition has been ${status}`, id]
      );

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Approve requisition error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get requisitions
router.get('/requisitions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, status } = req.query;
    let query = `
      SELECT mr.*, 
             s.name as site_name,
             m.name as material_name,
             m.unit,
             u1.full_name as requested_by_name,
             u2.full_name as approved_by_name
      FROM material_requisitions mr
      LEFT JOIN sites s ON mr.site_id = s.id
      LEFT JOIN materials m ON mr.material_id = m.id
      LEFT JOIN users u1 ON mr.requested_by = u1.id
      LEFT JOIN users u2 ON mr.approved_by = u2.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (site_id) {
      query += ` AND mr.site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (status) {
      query += ` AND mr.status = $${paramCount++}`;
      params.push(status);
    }

    // Workers can only see their own requisitions
    if (req.user!.role === 'worker') {
      query += ` AND mr.requested_by = $${paramCount++}`;
      params.push(req.user!.id);
    }

    query += ' ORDER BY mr.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get requisitions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

