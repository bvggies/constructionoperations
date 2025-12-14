import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get documents
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, project_id, category } = req.query;
    let query = `
      SELECT d.*, u.full_name as uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (site_id) {
      query += ` AND d.site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (project_id) {
      query += ` AND d.project_id = $${paramCount++}`;
      params.push(project_id);
    }

    if (category) {
      query += ` AND d.category = $${paramCount++}`;
      params.push(category);
    }

    query += ' ORDER BY d.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get document by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.*, u.full_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document
router.post('/upload',
  authenticate,
  upload.single('file'),
  [
    body('name').trim().notEmpty().withMessage('Document name is required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { name, description, category, site_id, project_id } = req.body;

      const result = await pool.query(
        `INSERT INTO documents (site_id, project_id, name, file_path, file_type, file_size, category, description, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          site_id || null,
          project_id || null,
          name,
          req.file.path,
          req.file.mimetype,
          req.file.size,
          category || null,
          description || null,
          req.user!.id
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Upload document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Download document
router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT file_path, name FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = result.rows[0].file_path;
    const fileName = result.rows[0].name;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, fileName);
  } catch (error: any) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document
router.delete('/:id',
  authenticate,
  authorize('admin', 'manager', 'supervisor'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const filePath = result.rows[0].file_path;

      // Delete file from filesystem
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await pool.query('DELETE FROM documents WHERE id = $1', [id]);

      res.json({ message: 'Document deleted successfully' });
    } catch (error: any) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

