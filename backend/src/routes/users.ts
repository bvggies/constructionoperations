import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all users
router.get('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, search } = req.query;
    let query = 'SELECT id, username, email, role, full_name, phone, is_active, created_at FROM users WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (role) {
      query += ` AND role = $${paramCount++}`;
      params.push(role);
    }

    if (search) {
      query += ` AND (username ILIKE $${paramCount} OR full_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin/manager
    if (req.user!.role !== 'admin' && req.user!.role !== 'manager' && parseInt(id) !== req.user!.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      'SELECT id, username, email, role, full_name, phone, is_active, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user
router.post('/',
  authenticate,
  authorize('admin'),
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'manager', 'supervisor', 'worker']).withMessage('Invalid role'),
    body('full_name').trim().notEmpty().withMessage('Full name is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role, full_name, phone } = req.body;

      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      const passwordHash = await hashPassword(password);

      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, email, role, full_name, phone, is_active, created_at`,
        [username, email, passwordHash, role, full_name, phone || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update user
router.put('/:id',
  authenticate,
  authorize('admin'),
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('role').optional().isIn(['admin', 'manager', 'supervisor', 'worker']).withMessage('Invalid role')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { email, role, full_name, phone, is_active } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        params.push(email);
      }
      if (role !== undefined) {
        updates.push(`role = $${paramCount++}`);
        params.push(role);
      }
      if (full_name !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        params.push(full_name);
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramCount++}`);
        params.push(phone);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        params.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING id, username, email, role, full_name, phone, is_active, created_at, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Deactivate user
router.patch('/:id/deactivate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
       RETURNING id, username, email, role, full_name, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

