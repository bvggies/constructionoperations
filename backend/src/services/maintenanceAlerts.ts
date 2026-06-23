import pool from '../config/database';
import { sendNotification, notifyRoleUsers } from './notificationService';

export async function checkMaintenanceAlerts() {
  const today = new Date();
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // Mark overdue scheduled maintenance
  await pool.query(`
    UPDATE equipment_maintenance_records
    SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'scheduled' AND scheduled_date < CURRENT_DATE
  `);

  // Upcoming maintenance (next 3 days)
  const upcoming = await pool.query(`
    SELECT emr.*, e.name as equipment_name, e.equipment_code
    FROM equipment_maintenance_records emr
    JOIN equipment e ON emr.equipment_id = e.id
    WHERE emr.status = 'scheduled'
      AND emr.scheduled_date BETWEEN CURRENT_DATE AND $1
  `, [threeDaysFromNow.toISOString().split('T')[0]]);

  for (const record of upcoming.rows) {
    const msg = `Upcoming ${record.maintenance_type} maintenance for ${record.equipment_name} (${record.equipment_code || 'N/A'}) on ${record.scheduled_date}`;
    if (record.assigned_to) {
      await sendNotification({
        userId: record.assigned_to,
        title: 'Upcoming Maintenance',
        message: msg,
        type: 'equipment',
        relatedId: record.id,
        relatedType: 'maintenance',
      });
    } else {
      await notifyRoleUsers(['admin', 'manager'], 'Upcoming Maintenance', msg, 'equipment', record.id, 'maintenance');
    }
  }

  // Overdue maintenance
  const overdue = await pool.query(`
    SELECT emr.*, e.name as equipment_name, e.equipment_code
    FROM equipment_maintenance_records emr
    JOIN equipment e ON emr.equipment_id = e.id
    WHERE emr.status = 'overdue'
  `);

  for (const record of overdue.rows) {
    const msg = `OVERDUE maintenance for ${record.equipment_name} (${record.equipment_code || 'N/A'}) was due ${record.scheduled_date}`;
    if (record.assigned_to) {
      await sendNotification({
        userId: record.assigned_to,
        title: 'Overdue Maintenance',
        message: msg,
        type: 'equipment',
        relatedId: record.id,
        relatedType: 'maintenance',
      });
    }
    await notifyRoleUsers(['admin', 'manager'], 'Overdue Maintenance', msg, 'equipment', record.id, 'maintenance');
  }

  // Equipment-level next_maintenance_date alerts
  const equipmentDue = await pool.query(`
    SELECT * FROM equipment
    WHERE next_maintenance_date IS NOT NULL
      AND next_maintenance_date <= $1
      AND status != 'retired'
  `, [threeDaysFromNow.toISOString().split('T')[0]]);

  for (const eq of equipmentDue.rows) {
    const isOverdue = new Date(eq.next_maintenance_date) < today;
    await notifyRoleUsers(
      ['admin', 'manager'],
      isOverdue ? 'Equipment Maintenance Overdue' : 'Equipment Maintenance Due Soon',
      `${eq.name} (${eq.equipment_code || eq.id}) maintenance ${isOverdue ? 'is overdue' : 'due'} on ${eq.next_maintenance_date}`,
      'equipment',
      eq.id,
      'equipment'
    );
  }

  // Hours/mileage based alerts
  const hoursBased = await pool.query(`
    SELECT * FROM equipment
    WHERE maintenance_interval_hours IS NOT NULL
      AND hours_since_last_maintenance >= maintenance_interval_hours
      AND status != 'retired'
  `);

  for (const eq of hoursBased.rows) {
    await notifyRoleUsers(
      ['admin', 'manager'],
      'Maintenance Required (Operating Hours)',
      `${eq.name} has reached ${eq.hours_since_last_maintenance} operating hours (interval: ${eq.maintenance_interval_hours} hrs)`,
      'equipment',
      eq.id,
      'equipment'
    );
  }

  const mileageBased = await pool.query(`
    SELECT * FROM equipment
    WHERE maintenance_interval_miles IS NOT NULL
      AND mileage >= maintenance_interval_miles
      AND status != 'retired'
  `);

  for (const eq of mileageBased.rows) {
    await notifyRoleUsers(
      ['admin', 'manager'],
      'Maintenance Required (Mileage)',
      `${eq.name} has reached ${eq.mileage} miles (interval: ${eq.maintenance_interval_miles} mi)`,
      'equipment',
      eq.id,
      'equipment'
    );
  }

  // Spare parts reorder alerts
  const lowStock = await pool.query(`
    SELECT * FROM spare_parts WHERE quantity <= min_threshold
  `);

  for (const part of lowStock.rows) {
    await notifyRoleUsers(
      ['admin', 'manager'],
      'Spare Parts Reorder Alert',
      `${part.name} (${part.part_number}) stock is low: ${part.quantity} remaining (min: ${part.min_threshold})`,
      'equipment',
      part.id,
      'spare_part'
    );
  }

  return {
    upcoming: upcoming.rows.length,
    overdue: overdue.rows.length,
    lowStock: lowStock.rows.length,
  };
}
