import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { checkMaintenanceAlerts } from '../services/maintenanceAlerts';
import { sendNotification, notifyRoleUsers } from '../services/notificationService';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = 'uploads/equipment';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'eq-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

function generateEquipmentCode() {
  return `EQ-${Date.now().toString(36).toUpperCase()}`;
}

function generateQrToken() {
  return `qr_${crypto.randomBytes(16).toString('hex')}`;
}

const equipmentSelect = `
  SELECT e.*,
    p.name as current_project_name,
    s.name as current_site_name,
    u.full_name as assigned_operator_name
  FROM equipment e
  LEFT JOIN projects p ON e.current_project_id = p.id
  LEFT JOIN sites s ON e.current_site_id = s.id
  LEFT JOIN users u ON e.assigned_operator_id = u.id
`;

async function getEquipmentDetail(id: string | string[] | number) {
  const eqId = Array.isArray(id) ? id[0] : id;
  const result = await pool.query(`${equipmentSelect} WHERE e.id = $1`, [eqId]);
  return result.rows[0] || null;
}

// All transfers across fleet
router.get('/transfers/all', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT et.*, e.name as equipment_name, e.equipment_code,
        fs.name as from_site_name, ts.name as to_site_name,
        u.full_name as transferred_by_name, op.full_name as operator_name
      FROM equipment_transfers et
      JOIN equipment e ON et.equipment_id = e.id
      LEFT JOIN sites fs ON et.from_site_id = fs.id
      LEFT JOIN sites ts ON et.to_site_id = ts.id
      LEFT JOIN users u ON et.transferred_by = u.id
      LEFT JOIN users op ON et.operator_id = op.id
      ORDER BY et.transfer_date DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Active usage sessions
router.get('/usage/active', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT eu.*, e.name as equipment_name, e.equipment_code, s.name as site_name,
        u.full_name as operator_name
      FROM equipment_usage eu
      JOIN equipment e ON eu.equipment_id = e.id
      LEFT JOIN sites s ON eu.site_id = s.id
      LEFT JOIN users u ON COALESCE(eu.operator_id, eu.user_id) = u.id
      WHERE eu.status = 'active' AND eu.end_date IS NULL
      ORDER BY eu.start_date DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Maintenance record detail with spare parts used
router.get('/maintenance/:recordId/detail', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const record = await pool.query(`
      SELECT emr.*, e.name as equipment_name, e.equipment_code, u.full_name as assigned_to_name
      FROM equipment_maintenance_records emr
      JOIN equipment e ON emr.equipment_id = e.id
      LEFT JOIN users u ON emr.assigned_to = u.id
      WHERE emr.id = $1
    `, [req.params.recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const parts = await pool.query(`
      SELECT mspu.*, sp.part_number, sp.name as part_name
      FROM maintenance_spare_parts_usage mspu
      JOIN spare_parts sp ON mspu.spare_part_id = sp.id
      WHERE mspu.maintenance_record_id = $1
    `, [req.params.recordId]);

    res.json({ ...record.rows[0], spare_parts_used: parts.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cron-friendly alerts (no auth token — uses CRON_SECRET)
router.get('/alerts/cron', async (req, res: Response) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!secret || auth !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const summary = await checkMaintenanceAlerts();
    res.json({ ok: true, summary });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utilization report
router.get('/utilization/report', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.equipment_code, e.name, e.type, e.status,
        e.total_usage_hours, e.mileage,
        COALESCE(SUM(eu.hours_used), 0) as period_hours,
        COUNT(eu.id) as usage_sessions,
        CASE WHEN e.status = 'available' AND e.updated_at < NOW() - INTERVAL '7 days'
          THEN true ELSE false END as potentially_idle
      FROM equipment e
      LEFT JOIN equipment_usage eu ON eu.equipment_id = e.id
        AND eu.start_date >= NOW() - INTERVAL '30 days'
      WHERE e.status != 'retired'
      GROUP BY e.id
      ORDER BY e.total_usage_hours DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Utilization report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trigger maintenance alerts check
router.post('/alerts/check', authenticate, authorize('admin', 'manager'), async (_req, res: Response) => {
  try {
    const summary = await checkMaintenanceAlerts();
    res.json({ message: 'Alerts processed', summary });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All maintenance records
router.get('/maintenance/all', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT emr.*, e.name as equipment_name, e.equipment_code, u.full_name as assigned_to_name
      FROM equipment_maintenance_records emr
      JOIN equipment e ON emr.equipment_id = e.id
      LEFT JOIN users u ON emr.assigned_to = u.id
      ORDER BY emr.scheduled_date DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Scan QR code
router.get('/scan/:code', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`${equipmentSelect} WHERE e.qr_code = $1`, [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all breakdowns
router.get('/breakdowns/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, severity, incident_type } = req.query;
    let query = `
      SELECT eb.*, e.name as equipment_name, e.equipment_code, e.type as equipment_type,
        u.full_name as reported_by_name
      FROM equipment_breakdowns eb
      LEFT JOIN equipment e ON eb.equipment_id = e.id
      LEFT JOIN users u ON eb.reported_by = u.id WHERE 1=1
    `;
    const params: any[] = [];
    let n = 1;
    if (status) { query += ` AND eb.status = $${n++}`; params.push(status); }
    if (severity) { query += ` AND eb.severity = $${n++}`; params.push(severity); }
    if (incident_type) { query += ` AND eb.incident_type = $${n++}`; params.push(incident_type); }
    query += ' ORDER BY eb.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update breakdown
router.patch('/breakdowns/:id', authenticate, authorize('admin', 'manager', 'supervisor'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, repair_cost, notes, repair_progress } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let n = 1;
    if (status !== undefined) {
      updates.push(`status = $${n++}`); params.push(status);
      if (status === 'fixed') updates.push(`fixed_at = CURRENT_TIMESTAMP`);
    }
    if (repair_cost !== undefined) { updates.push(`repair_cost = $${n++}`); params.push(repair_cost); }
    if (notes !== undefined) { updates.push(`notes = $${n++}`); params.push(notes); }
    if (repair_progress !== undefined) { updates.push(`repair_progress = $${n++}`); params.push(repair_progress); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await pool.query(
      `UPDATE equipment_breakdowns SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`, params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Breakdown not found' });
    if (status === 'fixed') {
      const bd = result.rows[0];
      await pool.query('UPDATE equipment SET status = $1 WHERE id = $2', ['available', bd.equipment_id]);
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End equipment usage
router.patch('/usage/:id/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { hours_used, mileage_end } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const usageCheck = await client.query('SELECT * FROM equipment_usage WHERE id = $1', [id]);
      if (usageCheck.rows.length === 0) return res.status(404).json({ error: 'Usage record not found' });
      const usage = usageCheck.rows[0];
      const hours = hours_used || 0;
      const result = await client.query(
        `UPDATE equipment_usage SET end_date = CURRENT_TIMESTAMP, status = 'completed',
         hours_used = $1, mileage_end = $2 WHERE id = $3 RETURNING *`,
        [hours, mileage_end || null, id]
      );
      await client.query(
        `UPDATE equipment SET status = 'available', total_usage_hours = total_usage_hours + $1,
         hours_since_last_maintenance = hours_since_last_maintenance + $1,
         mileage = COALESCE($2, mileage), updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [hours, mileage_end, usage.equipment_id]
      );
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List all equipment
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, site_id, search } = req.query;
    let query = `${equipmentSelect} WHERE 1=1`;
    const params: any[] = [];
    let n = 1;
    if (status) { query += ` AND e.status = $${n++}`; params.push(status); }
    if (type) { query += ` AND e.type = $${n++}`; params.push(type); }
    if (site_id) { query += ` AND e.current_site_id = $${n++}`; params.push(site_id); }
    if (search) {
      query += ` AND (e.name ILIKE $${n} OR e.equipment_code ILIKE $${n} OR e.serial_number ILIKE $${n})`;
      params.push(`%${search}%`); n++;
    }
    query += ' ORDER BY e.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment
router.post('/',
  authenticate,
  authorize('admin', 'manager'),
  upload.single('image'),
  [
    body('name').trim().notEmpty().withMessage('Equipment name is required'),
    body('type').trim().notEmpty().withMessage('Equipment type is required'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        name, type, model, model_number, serial_number, manufacturer, purchase_date,
        warranty_info, condition, last_maintenance_date, next_maintenance_date,
        maintenance_interval_hours, maintenance_interval_miles, maintenance_interval_days,
        current_project_id, current_site_id, assigned_operator_id, equipment_code,
      } = req.body;

      const code = equipment_code || generateEquipmentCode();
      const qrCode = generateQrToken();
      const imagePath = req.file ? `/uploads/equipment/${req.file.filename}` : null;

      const result = await pool.query(
        `INSERT INTO equipment (
          name, type, model, model_number, serial_number, manufacturer, purchase_date,
          warranty_info, condition, equipment_code, qr_code, image_path,
          last_maintenance_date, next_maintenance_date,
          maintenance_interval_hours, maintenance_interval_miles, maintenance_interval_days,
          current_project_id, current_site_id, assigned_operator_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [
          name, type, model || model_number || null, model_number || model || null,
          serial_number || null, manufacturer || null, purchase_date || null,
          warranty_info || null, condition || 'good', code, qrCode, imagePath,
          last_maintenance_date || null, next_maintenance_date || null,
          maintenance_interval_hours || null, maintenance_interval_miles || null,
          maintenance_interval_days || null,
          current_project_id || null, current_site_id || null, assigned_operator_id || null,
        ]
      );
      res.status(201).json(await getEquipmentDetail(result.rows[0].id));
    } catch (error: any) {
      if (error.code === '23505') return res.status(400).json({ error: 'Equipment code or serial number already exists' });
      console.error('Create equipment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get equipment by ID with related data
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const equipment = await getEquipmentDetail(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

    const [transfers, maintenance, documents, usage, breakdowns, workOrders] = await Promise.all([
      pool.query(`SELECT et.*, fs.name as from_site_name, ts.name as to_site_name,
        u.full_name as transferred_by_name FROM equipment_transfers et
        LEFT JOIN sites fs ON et.from_site_id = fs.id LEFT JOIN sites ts ON et.to_site_id = ts.id
        LEFT JOIN users u ON et.transferred_by = u.id
        WHERE et.equipment_id = $1 ORDER BY et.transfer_date DESC LIMIT 20`, [req.params.id]),
      pool.query(`SELECT emr.*, u.full_name as assigned_to_name FROM equipment_maintenance_records emr
        LEFT JOIN users u ON emr.assigned_to = u.id WHERE emr.equipment_id = $1
        ORDER BY emr.scheduled_date DESC`, [req.params.id]),
      pool.query('SELECT * FROM equipment_documents WHERE equipment_id = $1 ORDER BY created_at DESC', [req.params.id]),
      pool.query(`SELECT eu.*, s.name as site_name, u.full_name as operator_name FROM equipment_usage eu
        LEFT JOIN sites s ON eu.site_id = s.id LEFT JOIN users u ON eu.user_id = u.id
        WHERE eu.equipment_id = $1 ORDER BY eu.start_date DESC LIMIT 20`, [req.params.id]),
      pool.query(`SELECT eb.*, u.full_name as reported_by_name FROM equipment_breakdowns eb
        LEFT JOIN users u ON eb.reported_by = u.id WHERE eb.equipment_id = $1
        ORDER BY eb.created_at DESC`, [req.params.id]),
      pool.query(`SELECT wo.*, u.full_name as assigned_to_name FROM equipment_work_orders wo
        LEFT JOIN users u ON wo.assigned_to = u.id WHERE wo.equipment_id = $1
        ORDER BY wo.created_at DESC`, [req.params.id]),
    ]);

    res.json({
      ...equipment,
      transfers: transfers.rows,
      maintenance: maintenance.rows,
      documents: documents.rows,
      usage: usage.rows,
      breakdowns: breakdowns.rows,
      work_orders: workOrders.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment
router.put('/:id', authenticate, authorize('admin', 'manager', 'supervisor'), upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const fields = [
      'name', 'type', 'model', 'model_number', 'serial_number', 'manufacturer',
      'purchase_date', 'warranty_info', 'condition', 'status',
      'last_maintenance_date', 'next_maintenance_date',
      'maintenance_interval_hours', 'maintenance_interval_miles', 'maintenance_interval_days',
      'current_project_id', 'current_site_id', 'assigned_operator_id', 'mileage', 'total_usage_hours',
    ];
    const updates: string[] = [];
    const params: any[] = [];
    let n = 1;
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${n++}`);
        params.push(req.body[field] === '' ? null : req.body[field]);
      }
    }
    if (req.file) {
      updates.push(`image_path = $${n++}`);
      params.push(`/uploads/equipment/${req.file.filename}`);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await pool.query(
      `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${n} RETURNING id`, params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
    res.json(await getEquipmentDetail(id));
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment
router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM equipment WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ message: 'Equipment deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// QR code image
router.get('/:id/qr', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT qr_code, equipment_code, name FROM equipment WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
    const eq = result.rows[0];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const scanUrl = `${frontendUrl}/equipment/scan/${eq.qr_code}`;
    const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 300, margin: 2 });
    res.json({ qr_code: eq.qr_code, scan_url: scanUrl, qr_image: qrDataUrl, equipment_code: eq.equipment_code, name: eq.name });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Regenerate QR
router.post('/:id/regenerate-qr', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const qrCode = generateQrToken();
    await pool.query('UPDATE equipment SET qr_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [qrCode, req.params.id]);
    res.json({ qr_code: qrCode });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document/image
router.post('/:id/documents', authenticate, authorize('admin', 'manager', 'supervisor'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const category = req.body.category || (req.file.mimetype.startsWith('image/') ? 'image' : 'document');
    const result = await pool.query(
      `INSERT INTO equipment_documents (equipment_id, name, file_path, file_type, file_size, category, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, req.body.name || req.file.originalname, `/uploads/equipment/${req.file.filename}`,
       req.file.mimetype, req.file.size, category, req.user!.id]
    );
    if (category === 'image') {
      await pool.query('UPDATE equipment SET image_path = $1 WHERE id = $2', [result.rows[0].file_path, req.params.id]);
    }
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document
router.delete('/documents/:docId', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM equipment_documents WHERE id = $1 RETURNING *', [req.params.docId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Transfer equipment
router.post('/:id/transfer',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('to_site_id').optional().isInt(),
    body('to_project_id').optional().isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { to_site_id, to_project_id, operator_id, notes } = req.body;
      const eq = await getEquipmentDetail(id);
      if (!eq) return res.status(404).json({ error: 'Equipment not found' });

      const result = await pool.query(
        `INSERT INTO equipment_transfers (equipment_id, from_site_id, to_site_id, from_project_id, to_project_id, operator_id, transferred_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [id, eq.current_site_id, to_site_id || null, eq.current_project_id, to_project_id || null,
         operator_id || null, req.user!.id, notes || null]
      );

      await pool.query(
        `UPDATE equipment SET current_site_id = $1, current_project_id = $2,
         assigned_operator_id = COALESCE($3, assigned_operator_id), updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [to_site_id || eq.current_site_id, to_project_id || eq.current_project_id, operator_id, id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get transfer history
router.get('/:id/transfers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT et.*, fs.name as from_site_name, ts.name as to_site_name, u.full_name as transferred_by_name
       FROM equipment_transfers et
       LEFT JOIN sites fs ON et.from_site_id = fs.id LEFT JOIN sites ts ON et.to_site_id = ts.id
       LEFT JOIN users u ON et.transferred_by = u.id
       WHERE et.equipment_id = $1 ORDER BY et.transfer_date DESC`, [req.params.id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Maintenance records
router.get('/:id/maintenance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT emr.*, u.full_name as assigned_to_name FROM equipment_maintenance_records emr
       LEFT JOIN users u ON emr.assigned_to = u.id WHERE emr.equipment_id = $1 ORDER BY emr.scheduled_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/maintenance',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  [
    body('title').trim().notEmpty(),
    body('maintenance_type').isIn(['preventive', 'corrective']),
    body('scheduled_date').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { title, maintenance_type, description, scheduled_date, assigned_to, operating_hours_at_service, mileage_at_service } = req.body;

      const result = await pool.query(
        `INSERT INTO equipment_maintenance_records (equipment_id, maintenance_type, title, description, scheduled_date, assigned_to, operating_hours_at_service, mileage_at_service, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.params.id, maintenance_type, title, description || null, scheduled_date || null,
         assigned_to || null, operating_hours_at_service || null, mileage_at_service || null, req.user!.id]
      );

      if (maintenance_type === 'preventive') {
        await pool.query('UPDATE equipment SET status = $1 WHERE id = $2 AND status = $3', ['maintenance', req.params.id, 'available']);
      }

      if (assigned_to) {
        await sendNotification({
          userId: assigned_to,
          title: 'Maintenance Assigned',
          message: `You have been assigned maintenance: ${title}`,
          type: 'equipment',
          relatedId: result.rows[0].id,
          relatedType: 'maintenance',
        });
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.patch('/maintenance/:recordId', authenticate, authorize('admin', 'manager', 'supervisor'), async (req: AuthRequest, res: Response) => {
  try {
    const { recordId } = req.params;
    const { status, completed_date, cost, notes, assigned_to, spare_parts } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updates: string[] = [];
      const params: any[] = [];
      let n = 1;
      if (status) { updates.push(`status = $${n++}`); params.push(status); }
      if (completed_date) { updates.push(`completed_date = $${n++}`); params.push(completed_date); }
      if (cost !== undefined) { updates.push(`cost = $${n++}`); params.push(cost); }
      if (notes !== undefined) { updates.push(`notes = $${n++}`); params.push(notes); }
      if (assigned_to !== undefined) { updates.push(`assigned_to = $${n++}`); params.push(assigned_to); }
      if (status === 'completed') updates.push('completed_date = COALESCE(completed_date, CURRENT_DATE)');
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(recordId);

      const result = await client.query(
        `UPDATE equipment_maintenance_records SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`, params
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
      const record = result.rows[0];

      if (spare_parts && Array.isArray(spare_parts)) {
        for (const sp of spare_parts) {
          await client.query(
            `INSERT INTO maintenance_spare_parts_usage (maintenance_record_id, spare_part_id, quantity_used)
             VALUES ($1, $2, $3)`, [recordId, sp.spare_part_id, sp.quantity_used]
          );
          await client.query(
            'UPDATE spare_parts SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [sp.quantity_used, sp.spare_part_id]
          );
        }
      }

      if (status === 'completed') {
        await client.query(
          `UPDATE equipment SET status = 'available', last_maintenance_date = CURRENT_DATE,
           hours_since_last_maintenance = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [record.equipment_id]
        );
      }

      await client.query('COMMIT');
      res.json(record);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record usage / assignment
router.post('/:id/usage',
  authenticate,
  [body('site_id').isInt(), body('start_date').isISO8601()],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { id } = req.params;
      const { site_id, start_date, notes, project_id, operator_id, mileage_start } = req.body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const eqCheck = await client.query('SELECT status FROM equipment WHERE id = $1', [id]);
        if (eqCheck.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
        if (!['available', 'in_use'].includes(eqCheck.rows[0].status)) {
          return res.status(400).json({ error: 'Equipment is not available for assignment' });
        }
        const result = await client.query(
          `INSERT INTO equipment_usage (equipment_id, site_id, user_id, start_date, notes, project_id, operator_id, mileage_start)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [id, site_id, req.user!.id, start_date, notes || null, project_id || null, operator_id || req.user!.id, mileage_start || null]
        );
        await client.query(
          `UPDATE equipment SET status = 'in_use', current_site_id = $1,
           current_project_id = COALESCE($2, current_project_id),
           assigned_operator_id = COALESCE($3, assigned_operator_id), updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [site_id, project_id, operator_id, id]
        );
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Report breakdown / incident
router.post('/:id/breakdown',
  authenticate,
  [
    body('description').trim().notEmpty(),
    body('severity').isIn(['low', 'medium', 'high', 'critical']),
    body('incident_type').optional().isIn(['breakdown', 'fault', 'accident', 'damage']),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { id } = req.params;
      const { description, severity, notes, incident_type, fault_code, location, repair_progress } = req.body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO equipment_breakdowns (equipment_id, reported_by, description, severity, notes, incident_type, fault_code, location, repair_progress)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [id, req.user!.id, description, severity, notes || null, incident_type || 'breakdown',
           fault_code || null, location || null, repair_progress || null]
        );
        await client.query('UPDATE equipment SET status = $1 WHERE id = $2', ['broken', id]);
        const eqResult = await client.query('SELECT name, equipment_code FROM equipment WHERE id = $1', [id]);
        const eqName = eqResult.rows[0]?.name || 'Equipment';
        await notifyRoleUsers(
          ['admin', 'manager'],
          `${incident_type || 'Breakdown'} Reported`,
          `${eqName}: ${description}`,
          'equipment',
          result.rows[0].id,
          'breakdown'
        );
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Quick status update (mobile QR scan flow)
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const valid = ['available', 'in_use', 'maintenance', 'broken', 'retired'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const result = await pool.query(
      'UPDATE equipment SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
    res.json(await getEquipmentDetail(req.params.id));
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
