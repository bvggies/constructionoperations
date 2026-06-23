export interface EquipmentItem {
  id: number;
  equipment_code?: string;
  name: string;
  type: string;
  model?: string;
  model_number?: string;
  serial_number?: string;
  manufacturer?: string;
  purchase_date?: string;
  warranty_info?: string;
  condition?: string;
  status: string;
  qr_code?: string;
  image_path?: string;
  current_project_id?: number;
  current_site_id?: number;
  assigned_operator_id?: number;
  current_project_name?: string;
  current_site_name?: string;
  assigned_operator_name?: string;
  total_usage_hours?: number;
  mileage?: number;
  maintenance_interval_hours?: number;
  maintenance_interval_miles?: number;
  maintenance_interval_days?: number;
  hours_since_last_maintenance?: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  transfers?: TransferRecord[];
  maintenance?: MaintenanceRecord[];
  documents?: EquipmentDocument[];
  usage?: UsageRecord[];
  breakdowns?: BreakdownRecord[];
  work_orders?: WorkOrder[];
}

export interface TransferRecord {
  id: number;
  from_site_name?: string;
  to_site_name?: string;
  transferred_by_name?: string;
  transfer_date: string;
  notes?: string;
}

export interface MaintenanceRecord {
  id: number;
  maintenance_type: string;
  title: string;
  description?: string;
  scheduled_date?: string;
  completed_date?: string;
  status: string;
  assigned_to?: number;
  assigned_to_name?: string;
  cost?: number;
  notes?: string;
}

export interface EquipmentDocument {
  id: number;
  name: string;
  file_path: string;
  file_type?: string;
  category: string;
  created_at: string;
}

export interface UsageRecord {
  id: number;
  site_name?: string;
  operator_name?: string;
  start_date: string;
  end_date?: string;
  hours_used?: number;
  status: string;
}

export interface BreakdownRecord {
  id: number;
  equipment_id: number;
  equipment_name?: string;
  equipment_code?: string;
  description: string;
  severity: string;
  incident_type?: string;
  fault_code?: string;
  repair_progress?: string;
  status: string;
  reported_by_name?: string;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  equipment_id: number;
  equipment_name?: string;
  equipment_code?: string;
  title: string;
  description?: string;
  work_order_type: string;
  priority: string;
  status: string;
  assigned_to?: number;
  assigned_to_name?: string;
  due_date?: string;
  completion_notes?: string;
}

export interface SparePart {
  id: number;
  part_number: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  quantity: number;
  min_threshold: number;
  unit_cost?: number;
  supplier?: string;
}

export interface UtilizationRecord {
  id: number;
  equipment_code?: string;
  name: string;
  type?: string;
  status: string;
  total_usage_hours: number;
  mileage: number;
  period_hours: number;
  usage_sessions: number;
  potentially_idle: boolean;
}

export const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'broken', label: 'Broken' },
  { value: 'retired', label: 'Retired' },
];

export const CONDITION_OPTIONS = ['excellent', 'good', 'fair', 'poor'];

export function getUploadUrl(filePath: string) {
  if (filePath.startsWith('http')) return filePath;
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const base = envUrl.replace(/\/api$/, '');
  return `${base}${filePath}`;
}

export function getErrorMessage(error: any, fallback: string) {
  const data = error.response?.data;
  if (data?.error) return data.error;
  if (data?.errors?.length) return data.errors.map((e: { msg: string }) => e.msg).join(', ');
  return fallback;
}
