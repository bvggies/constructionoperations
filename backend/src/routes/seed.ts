import express, { Request, Response } from 'express';
import pool from '../config/database';
import { hashPassword } from '../utils/password';

const router = express.Router();

// Seed endpoint - should be protected in production
router.post('/seed', async (req: Request, res: Response) => {
  // Optional: Add authentication check
  const seedSecret = process.env.SEED_SECRET || 'change-this-secret';
  const providedSecret = req.headers.authorization?.replace('Bearer ', '');
  
  if (providedSecret !== seedSecret) {
    return res.status(401).json({ error: 'Unauthorized. Provide SEED_SECRET in Authorization header.' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Starting database seeding...');

    // Create Admin User
    const adminPassword = await hashPassword('admin123');
    const adminResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
       VALUES ('admin', 'admin@opstracker.com', $1, 'admin', 'Administrator', '+1234567890', true)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [adminPassword]
    );
    const adminId = adminResult.rows[0]?.id || (await client.query('SELECT id FROM users WHERE username = $1', ['admin'])).rows[0]?.id;

    // Create Manager
    const managerPassword = await hashPassword('manager123');
    const managerResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
       VALUES ('manager', 'manager@opstracker.com', $1, 'manager', 'John Manager', '+1234567891', true)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [managerPassword]
    );
    const managerId = managerResult.rows[0]?.id || (await client.query('SELECT id FROM users WHERE username = $1', ['manager'])).rows[0]?.id;

    // Create Supervisors
    const supervisorPassword = await hashPassword('supervisor123');
    const supervisor1Result = await client.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
       VALUES ('supervisor1', 'supervisor1@opstracker.com', $1, 'supervisor', 'Sarah Supervisor', '+1234567892', true)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [supervisorPassword]
    );
    const supervisor1Id = supervisor1Result.rows[0]?.id || (await client.query('SELECT id FROM users WHERE username = $1', ['supervisor1'])).rows[0]?.id;

    const supervisor2Result = await client.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
       VALUES ('supervisor2', 'supervisor2@opstracker.com', $1, 'supervisor', 'Mike Supervisor', '+1234567893', true)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [supervisorPassword]
    );
    const supervisor2Id = supervisor2Result.rows[0]?.id || (await client.query('SELECT id FROM users WHERE username = $1', ['supervisor2'])).rows[0]?.id;

    // Create Workers
    const workerPassword = await hashPassword('worker123');
    const workers = [
      { username: 'worker1', email: 'worker1@opstracker.com', name: 'Alex Worker', phone: '+1234567894' },
      { username: 'worker2', email: 'worker2@opstracker.com', name: 'Emma Worker', phone: '+1234567895' },
      { username: 'worker3', email: 'worker3@opstracker.com', name: 'David Worker', phone: '+1234567896' },
      { username: 'worker4', email: 'worker4@opstracker.com', name: 'Lisa Worker', phone: '+1234567897' },
      { username: 'worker5', email: 'worker5@opstracker.com', name: 'Tom Worker', phone: '+1234567898' }
    ];

    const workerIds: number[] = [];
    for (const worker of workers) {
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
         VALUES ($1, $2, $3, 'worker', $4, $5, true)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [worker.username, worker.email, workerPassword, worker.name, worker.phone]
      );
      if (result.rows[0]) {
        workerIds.push(result.rows[0].id);
      } else {
        const existing = await client.query('SELECT id FROM users WHERE username = $1', [worker.username]);
        if (existing.rows[0]) {
          workerIds.push(existing.rows[0].id);
        }
      }
    }

    // Create Projects
    const projects = [
      {
        name: 'Downtown Office Complex',
        description: 'Construction of a 10-story office building in downtown area',
        location: '123 Main Street, Downtown',
        start_date: '2024-01-15',
        end_date: '2025-06-30',
        status: 'active',
        manager_id: managerId
      },
      {
        name: 'Residential Apartment Complex',
        description: '5-story residential building with 50 units',
        location: '456 Oak Avenue, Suburb',
        start_date: '2024-03-01',
        end_date: '2025-12-31',
        status: 'active',
        manager_id: managerId
      },
      {
        name: 'Shopping Mall Renovation',
        description: 'Complete renovation of existing shopping mall',
        location: '789 Commerce Blvd, City Center',
        start_date: '2024-02-10',
        end_date: '2024-11-30',
        status: 'active',
        manager_id: managerId
      }
    ];

    const projectIds: number[] = [];
    for (const project of projects) {
      const result = await client.query(
        `INSERT INTO projects (name, description, location, start_date, end_date, status, manager_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [project.name, project.description, project.location, project.start_date, project.end_date, project.status, project.manager_id]
      );
      if (result.rows[0]) {
        projectIds.push(result.rows[0].id);
      } else {
        const existing = await client.query('SELECT id FROM projects WHERE name = $1', [project.name]);
        if (existing.rows[0]) {
          projectIds.push(existing.rows[0].id);
        }
      }
    }

    // Create Sites
    const sites = [
      {
        project_id: projectIds[0],
        name: 'Main Building Site',
        location: '123 Main Street, Downtown - North Wing',
        supervisor_id: supervisor1Id,
        status: 'active'
      },
      {
        project_id: projectIds[0],
        name: 'Parking Structure Site',
        location: '123 Main Street, Downtown - Parking Area',
        supervisor_id: supervisor1Id,
        status: 'active'
      },
      {
        project_id: projectIds[1],
        name: 'Building A Site',
        location: '456 Oak Avenue, Suburb - Building A',
        supervisor_id: supervisor2Id,
        status: 'active'
      },
      {
        project_id: projectIds[1],
        name: 'Building B Site',
        location: '456 Oak Avenue, Suburb - Building B',
        supervisor_id: supervisor2Id,
        status: 'active'
      },
      {
        project_id: projectIds[2],
        name: 'Interior Renovation Site',
        location: '789 Commerce Blvd, City Center - Interior',
        supervisor_id: supervisor1Id,
        status: 'active'
      }
    ];

    const siteIds: number[] = [];
    for (const site of sites) {
      const result = await client.query(
        `INSERT INTO sites (project_id, name, location, supervisor_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [site.project_id, site.name, site.location, site.supervisor_id, site.status]
      );
      if (result.rows[0]) {
        siteIds.push(result.rows[0].id);
      }
    }

    // Assign Workers to Sites
    const siteAssignments = [
      { site_id: siteIds[0], worker_ids: [workerIds[0], workerIds[1]] },
      { site_id: siteIds[1], worker_ids: [workerIds[2]] },
      { site_id: siteIds[2], worker_ids: [workerIds[1], workerIds[3]] },
      { site_id: siteIds[3], worker_ids: [workerIds[0], workerIds[4]] },
      { site_id: siteIds[4], worker_ids: [workerIds[2], workerIds[3], workerIds[4]] }
    ];

    for (const assignment of siteAssignments) {
      for (const workerId of assignment.worker_ids) {
        await client.query(
          `INSERT INTO site_teams (site_id, worker_id)
           VALUES ($1, $2)
           ON CONFLICT (site_id, worker_id) DO NOTHING`,
          [assignment.site_id, workerId]
        );
      }
    }

    // Create Materials
    const materials = [
      { name: 'Cement', description: 'Portland cement 50kg bags', unit: 'bags', category: 'Construction Materials' },
      { name: 'Steel Rebar', description: 'Steel reinforcement bars', unit: 'tons', category: 'Construction Materials' },
      { name: 'Concrete Blocks', description: 'Standard concrete blocks', unit: 'pieces', category: 'Construction Materials' },
      { name: 'Sand', description: 'Fine construction sand', unit: 'cubic meters', category: 'Construction Materials' },
      { name: 'Gravel', description: 'Coarse aggregate', unit: 'cubic meters', category: 'Construction Materials' },
      { name: 'Paint', description: 'Interior/exterior paint', unit: 'liters', category: 'Finishing Materials' },
      { name: 'Tiles', description: 'Ceramic floor tiles', unit: 'square meters', category: 'Finishing Materials' },
      { name: 'Electrical Wire', description: 'Copper electrical wire', unit: 'meters', category: 'Electrical' },
      { name: 'PVC Pipes', description: 'Plastic pipes for plumbing', unit: 'meters', category: 'Plumbing' },
      { name: 'Lumber', description: 'Construction lumber', unit: 'cubic meters', category: 'Construction Materials' }
    ];

    const materialIds: number[] = [];
    for (const material of materials) {
      const result = await client.query(
        `INSERT INTO materials (name, description, unit, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [material.name, material.description, material.unit, material.category]
      );
      if (result.rows[0]) {
        materialIds.push(result.rows[0].id);
      } else {
        const existing = await client.query('SELECT id FROM materials WHERE name = $1', [material.name]);
        if (existing.rows[0]) {
          materialIds.push(existing.rows[0].id);
        }
      }
    }

    // Create Material Inventory
    for (let i = 0; i < siteIds.length; i++) {
      const siteId = siteIds[i];
      for (let j = 0; j < materialIds.length; j++) {
        const materialId = materialIds[j];
        const quantity = Math.floor(Math.random() * 1000) + 100;
        const minThreshold = Math.floor(quantity * 0.2);
        
        await client.query(
          `INSERT INTO material_inventory (site_id, material_id, quantity, min_threshold)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (site_id, material_id) DO UPDATE SET quantity = $3, min_threshold = $4`,
          [siteId, materialId, quantity, minThreshold]
        );
      }
    }

    // Create Equipment
    const equipment = [
      { name: 'Excavator CAT 320', type: 'Heavy Machinery', model: 'CAT 320', serial_number: 'EXC-001', status: 'available' },
      { name: 'Bulldozer D6T', type: 'Heavy Machinery', model: 'D6T', serial_number: 'BDZ-001', status: 'in_use' },
      { name: 'Crane 50 Ton', type: 'Lifting Equipment', model: 'TC-50', serial_number: 'CRN-001', status: 'available' },
      { name: 'Concrete Mixer', type: 'Construction Equipment', model: 'CM-500', serial_number: 'CMX-001', status: 'available' },
      { name: 'Forklift 5 Ton', type: 'Material Handling', model: 'FL-5T', serial_number: 'FLT-001', status: 'in_use' },
      { name: 'Generator 100KW', type: 'Power Equipment', model: 'GEN-100', serial_number: 'GEN-001', status: 'available' },
      { name: 'Welding Machine', type: 'Tools', model: 'WM-300', serial_number: 'WLD-001', status: 'maintenance' },
      { name: 'Compactor', type: 'Construction Equipment', model: 'CP-200', serial_number: 'CMP-001', status: 'available' }
    ];

    const equipmentIds: number[] = [];
    for (const eq of equipment) {
      const result = await client.query(
        `INSERT INTO equipment (name, type, model, serial_number, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (serial_number) DO NOTHING
         RETURNING id`,
        [eq.name, eq.type, eq.model, eq.serial_number, eq.status]
      );
      if (result.rows[0]) {
        equipmentIds.push(result.rows[0].id);
      } else {
        const existing = await client.query('SELECT id FROM equipment WHERE serial_number = $1', [eq.serial_number]);
        if (existing.rows[0]) {
          equipmentIds.push(existing.rows[0].id);
        }
      }
    }

    // Create Tasks
    const tasks = [
      {
        site_id: siteIds[0],
        title: 'Foundation Excavation',
        description: 'Excavate foundation area for main building',
        assigned_to: workerIds[0],
        assigned_by: supervisor1Id,
        status: 'in_progress',
        priority: 'high',
        due_date: '2024-12-31'
      },
      {
        site_id: siteIds[0],
        title: 'Concrete Pouring',
        description: 'Pour concrete for foundation',
        assigned_to: workerIds[1],
        assigned_by: supervisor1Id,
        status: 'pending',
        priority: 'urgent',
        due_date: '2024-12-20'
      },
      {
        site_id: siteIds[1],
        title: 'Steel Frame Installation',
        description: 'Install steel frame structure',
        assigned_to: workerIds[2],
        assigned_by: supervisor1Id,
        status: 'pending',
        priority: 'high',
        due_date: '2024-12-25'
      },
      {
        site_id: siteIds[2],
        title: 'Wall Construction',
        description: 'Build walls for Building A',
        assigned_to: workerIds[1],
        assigned_by: supervisor2Id,
        status: 'in_progress',
        priority: 'medium',
        due_date: '2024-12-30'
      },
      {
        site_id: siteIds[2],
        title: 'Electrical Wiring',
        description: 'Install electrical wiring system',
        assigned_to: workerIds[3],
        assigned_by: supervisor2Id,
        status: 'pending',
        priority: 'medium',
        due_date: '2025-01-05'
      },
      {
        site_id: siteIds[3],
        title: 'Plumbing Installation',
        description: 'Install plumbing system',
        assigned_to: workerIds[0],
        assigned_by: supervisor2Id,
        status: 'pending',
        priority: 'high',
        due_date: '2025-01-10'
      },
      {
        site_id: siteIds[4],
        title: 'Interior Painting',
        description: 'Paint interior walls',
        assigned_to: workerIds[2],
        assigned_by: supervisor1Id,
        status: 'completed',
        priority: 'low',
        due_date: '2024-12-15'
      },
      {
        site_id: siteIds[4],
        title: 'Floor Tiling',
        description: 'Install floor tiles',
        assigned_to: workerIds[4],
        assigned_by: supervisor1Id,
        status: 'in_progress',
        priority: 'medium',
        due_date: '2024-12-28'
      }
    ];

    for (const task of tasks) {
      await client.query(
        `INSERT INTO tasks (site_id, title, description, assigned_to, assigned_by, status, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [task.site_id, task.title, task.description, task.assigned_to, task.assigned_by, task.status, task.priority, task.due_date]
      );
    }

    await client.query('COMMIT');
    
    res.json({
      message: 'Database seeded successfully!',
      credentials: {
        admin: { username: 'admin', password: 'admin123' },
        manager: { username: 'manager', password: 'manager123' },
        supervisor: { username: 'supervisor1', password: 'supervisor123' },
        worker: { username: 'worker1', password: 'worker123' }
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    res.status(500).json({ error: 'Failed to seed database', details: error.message });
  } finally {
    client.release();
  }
});

export default router;

