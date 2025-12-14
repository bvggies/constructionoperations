import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Dashboard overview
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let projectsQuery = 'SELECT COUNT(*) as count FROM projects WHERE status = $1';
    let tasksQuery = 'SELECT COUNT(*) as count FROM tasks WHERE status = $1';
    let materialsQuery = '';
    let equipmentQuery = '';

    const params: any[] = ['active'];
    let paramCount = 2;

    // Role-based filtering
    if (role === 'worker') {
      tasksQuery += ` AND assigned_to = $${paramCount++}`;
      params.push(userId);
    } else if (role === 'supervisor') {
      tasksQuery += ` AND EXISTS (SELECT 1 FROM sites s WHERE s.id = tasks.site_id AND s.supervisor_id = $${paramCount++})`;
      params.push(userId);
    }

    const [projects, tasks, materials, equipment, attendance] = await Promise.all([
      pool.query(projectsQuery, ['active']),
      pool.query(tasksQuery, ['pending', ...params.slice(1)]),
      pool.query('SELECT COUNT(*) as count FROM material_inventory WHERE quantity <= min_threshold'),
      pool.query("SELECT COUNT(*) as count FROM equipment WHERE status IN ('maintenance', 'broken')"),
      pool.query(
        `SELECT COUNT(*) as count FROM attendance 
         WHERE attendance_date = CURRENT_DATE AND status = 'present'`
      )
    ]);

    // Get recent activities
    let activitiesQuery = `
      SELECT da.*, s.name as site_name, u.full_name as user_name
      FROM daily_activities da
      LEFT JOIN sites s ON da.site_id = s.id
      LEFT JOIN users u ON da.user_id = u.id
      WHERE da.activity_date = CURRENT_DATE
    `;

    if (role === 'worker') {
      activitiesQuery += ` AND da.user_id = $1`;
      const activities = await pool.query(activitiesQuery, [userId]);
      return res.json({
        overview: {
          activeProjects: parseInt(projects.rows[0].count),
          pendingTasks: parseInt(tasks.rows[0].count),
          lowStockMaterials: parseInt(materials.rows[0].count),
          equipmentIssues: parseInt(equipment.rows[0].count),
          presentToday: parseInt(attendance.rows[0].count)
        },
        recentActivities: activities.rows
      });
    }

    const activities = await pool.query(activitiesQuery + ' ORDER BY da.created_at DESC LIMIT 10');
    
    res.json({
      overview: {
        activeProjects: parseInt(projects.rows[0].count),
        pendingTasks: parseInt(tasks.rows[0].count),
        lowStockMaterials: parseInt(materials.rows[0].count),
        equipmentIssues: parseInt(equipment.rows[0].count),
        presentToday: parseInt(attendance.rows[0].count)
      },
      recentActivities: activities.rows
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Task progress report
router.get('/tasks/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, start_date, end_date } = req.query;
    let query = `
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_count
      FROM tasks
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (site_id) {
      query += ` AND site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (start_date && end_date) {
      query += ` AND created_at BETWEEN $${paramCount++} AND $${paramCount++}`;
      params.push(start_date, end_date);
    }

    query += ' GROUP BY status';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Task progress report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Material usage report
router.get('/materials/usage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, start_date, end_date } = req.query;
    let query = `
      SELECT 
        m.name,
        m.unit,
        SUM(CASE WHEN mt.transaction_type = 'delivery' THEN mt.quantity ELSE 0 END) as delivered,
        SUM(CASE WHEN mt.transaction_type = 'usage' THEN mt.quantity ELSE 0 END) as used,
        COALESCE(mi.quantity, 0) as current_stock
      FROM materials m
      LEFT JOIN material_transactions mt ON m.id = mt.material_id
      LEFT JOIN material_inventory mi ON m.id = mi.material_id AND mi.site_id = $1
      WHERE 1=1
    `;
    const params: any[] = [site_id];
    let paramCount = 2;

    if (start_date && end_date) {
      query += ` AND mt.created_at BETWEEN $${paramCount++} AND $${paramCount++}`;
      params.push(start_date, end_date);
    }

    query += ' GROUP BY m.id, m.name, m.unit, mi.quantity ORDER BY m.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Material usage report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Attendance report
router.get('/attendance/summary', authenticate, authorize('admin', 'manager', 'supervisor'), async (req: AuthRequest, res: Response) => {
  try {
    const { site_id, start_date, end_date } = req.query;
    let query = `
      SELECT 
        u.id,
        u.full_name,
        COUNT(*) FILTER (WHERE a.status = 'present') as present_days,
        COUNT(*) FILTER (WHERE a.status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE a.status = 'late') as late_days,
        SUM(a.hours_worked) as total_hours
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id
      WHERE u.role = 'worker'
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (site_id) {
      query += ` AND a.site_id = $${paramCount++}`;
      params.push(site_id);
    }

    if (start_date && end_date) {
      query += ` AND a.attendance_date BETWEEN $${paramCount++} AND $${paramCount++}`;
      params.push(start_date, end_date);
    }

    query += ' GROUP BY u.id, u.full_name ORDER BY u.full_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Attendance report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Equipment status report
router.get('/equipment/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM equipment
       GROUP BY status
       ORDER BY status`
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Equipment status report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

