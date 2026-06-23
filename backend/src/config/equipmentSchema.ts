import pool from './database';

export async function migrateEquipmentSchema() {
  const client = await pool.connect();
  try {
    // Extend equipment table
    await client.query(`
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS equipment_code VARCHAR(50) UNIQUE;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model_number VARCHAR(100);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS warranty_info TEXT;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'good'
        CHECK (condition IN ('excellent', 'good', 'fair', 'poor'));
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS qr_code VARCHAR(100) UNIQUE;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS current_project_id INTEGER REFERENCES projects(id);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS current_site_id INTEGER REFERENCES sites(id);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS assigned_operator_id INTEGER REFERENCES users(id);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS total_usage_hours DECIMAL(12,2) DEFAULT 0;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS mileage DECIMAL(12,2) DEFAULT 0;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_interval_hours DECIMAL(10,2);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_interval_miles DECIMAL(10,2);
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS hours_since_last_maintenance DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_transfers (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        from_site_id INTEGER REFERENCES sites(id),
        to_site_id INTEGER REFERENCES sites(id),
        from_project_id INTEGER REFERENCES projects(id),
        to_project_id INTEGER REFERENCES projects(id),
        operator_id INTEGER REFERENCES users(id),
        transferred_by INTEGER REFERENCES users(id),
        notes TEXT,
        transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_documents (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        category VARCHAR(50) DEFAULT 'document' CHECK (category IN ('image', 'document', 'manual', 'warranty')),
        uploaded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_maintenance_records (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        maintenance_type VARCHAR(50) NOT NULL CHECK (maintenance_type IN ('preventive', 'corrective')),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        scheduled_date DATE,
        completed_date DATE,
        status VARCHAR(50) DEFAULT 'scheduled'
          CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue')),
        assigned_to INTEGER REFERENCES users(id),
        operating_hours_at_service DECIMAL(10,2),
        mileage_at_service DECIMAL(10,2),
        cost DECIMAL(10,2),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY,
        part_number VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        unit VARCHAR(50) DEFAULT 'each',
        quantity DECIMAL(10,2) DEFAULT 0,
        min_threshold DECIMAL(10,2) DEFAULT 0,
        unit_cost DECIMAL(10,2),
        supplier VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_spare_parts_usage (
        id SERIAL PRIMARY KEY,
        maintenance_record_id INTEGER REFERENCES equipment_maintenance_records(id) ON DELETE CASCADE,
        work_order_id INTEGER,
        spare_part_id INTEGER REFERENCES spare_parts(id),
        quantity_used DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_work_orders (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        work_order_type VARCHAR(50) DEFAULT 'maintenance'
          CHECK (work_order_type IN ('maintenance', 'repair', 'inspection')),
        priority VARCHAR(50) DEFAULT 'medium'
          CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status VARCHAR(50) DEFAULT 'open'
          CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
        assigned_to INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        due_date DATE,
        completed_at TIMESTAMP,
        completion_notes TEXT,
        related_breakdown_id INTEGER REFERENCES equipment_breakdowns(id),
        related_maintenance_id INTEGER REFERENCES equipment_maintenance_records(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      ALTER TABLE equipment_breakdowns ADD COLUMN IF NOT EXISTS incident_type VARCHAR(50) DEFAULT 'breakdown'
        CHECK (incident_type IN ('breakdown', 'fault', 'accident', 'damage'));
      ALTER TABLE equipment_breakdowns ADD COLUMN IF NOT EXISTS fault_code VARCHAR(50);
      ALTER TABLE equipment_breakdowns ADD COLUMN IF NOT EXISTS repair_progress TEXT;
      ALTER TABLE equipment_breakdowns ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);

    await client.query(`
      ALTER TABLE equipment_usage ADD COLUMN IF NOT EXISTS hours_used DECIMAL(10,2);
      ALTER TABLE equipment_usage ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);
      ALTER TABLE equipment_usage ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES users(id);
      ALTER TABLE equipment_usage ADD COLUMN IF NOT EXISTS mileage_start DECIMAL(10,2);
      ALTER TABLE equipment_usage ADD COLUMN IF NOT EXISTS mileage_end DECIMAL(10,2);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_delivery_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'sms')),
        subject VARCHAR(255),
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
        related_type VARCHAR(50),
        related_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_equipment_code ON equipment(equipment_code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_equipment_qr ON equipment(qr_code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_equipment_transfers ON equipment_transfers(equipment_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON equipment_maintenance_records(equipment_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_status ON equipment_maintenance_records(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_work_orders_equipment ON equipment_work_orders(equipment_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_work_orders_status ON equipment_work_orders(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_spare_parts_number ON spare_parts(part_number)`);

    console.log('Equipment schema migrated successfully');
  } catch (error) {
    console.error('Equipment schema migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}
