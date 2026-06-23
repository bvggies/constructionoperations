import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Wrench, QrCode, Truck, Calendar, AlertTriangle, Package,
  ClipboardList, BarChart3, Search, Edit, Trash2, X, Upload, Bell,
  RefreshCw, Play, Square, Eye
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  type EquipmentItem, type SparePart, type WorkOrder, type BreakdownRecord,
  type UtilizationRecord, STATUS_OPTIONS, CONDITION_OPTIONS,
  getUploadUrl, getErrorMessage,
} from '../lib/equipmentTypes';

type Tab = 'registry' | 'tracking' | 'maintenance' | 'workorders' | 'spareparts' | 'breakdowns' | 'utilization';

const emptyEquipmentForm = {
  name: '', type: '', model_number: '', serial_number: '', manufacturer: '',
  purchase_date: '', warranty_info: '', condition: 'good', status: 'available',
  maintenance_interval_hours: '', maintenance_interval_miles: '', maintenance_interval_days: '',
  next_maintenance_date: '', current_site_id: '', current_project_id: '', assigned_operator_id: '',
};

export const Equipment = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const canOperate = canManage || user?.role === 'supervisor';

  const [tab, setTab] = useState<Tab>('registry');
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selected, setSelected] = useState<EquipmentItem | null>(null);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownRecord[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [utilization, setUtilization] = useState<UtilizationRecord[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const [form, setForm] = useState(emptyEquipmentForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);

  // Sub-modals
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showWorkOrder, setShowWorkOrder] = useState(false);
  const [showSparePart, setShowSparePart] = useState(false);
  const [transferForm, setTransferForm] = useState({ to_site_id: '', to_project_id: '', operator_id: '', notes: '' });
  const [maintForm, setMaintForm] = useState({ title: '', maintenance_type: 'preventive', scheduled_date: '', assigned_to: '', description: '' });
  const [breakdownForm, setBreakdownForm] = useState({ description: '', severity: 'medium', incident_type: 'breakdown', fault_code: '', location: '' });
  const [woForm, setWoForm] = useState({ equipment_id: '', title: '', description: '', work_order_type: 'maintenance', priority: 'medium', assigned_to: '', due_date: '' });
  const [spForm, setSpForm] = useState({ part_number: '', name: '', category: '', quantity: '0', min_threshold: '5', unit_cost: '', supplier: '' });
  const [editingSparePart, setEditingSparePart] = useState<SparePart | null>(null);

  const [allTransfers, setAllTransfers] = useState<any[]>([]);
  const [activeUsage, setActiveUsage] = useState<any[]>([]);
  const [spareConsumption, setSpareConsumption] = useState<any[]>([]);

  const [showUsageStart, setShowUsageStart] = useState(false);
  const [showUsageEnd, setShowUsageEnd] = useState(false);
  const [usageStartForm, setUsageStartForm] = useState({ site_id: '', project_id: '', operator_id: '', mileage_start: '', notes: '' });
  const [usageEndForm, setUsageEndForm] = useState({ usage_id: '', hours_used: '', mileage_end: '' });

  const [showCompleteMaint, setShowCompleteMaint] = useState(false);
  const [completingMaintId, setCompletingMaintId] = useState<number | null>(null);
  const [completeMaintForm, setCompleteMaintForm] = useState({ cost: '', notes: '', spare_parts: [] as { spare_part_id: number; quantity_used: string; part_name: string }[] });

  const [showCompleteWO, setShowCompleteWO] = useState(false);
  const [completingWO, setCompletingWO] = useState<WorkOrder | null>(null);
  const [woCompleteNotes, setWoCompleteNotes] = useState('');

  const [showMaintDetail, setShowMaintDetail] = useState(false);
  const [maintDetail, setMaintDetail] = useState<any>(null);

  const fetchEquipment = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/equipment?${params}`);
      setEquipment(res.data);
    } catch (e) { console.error(e); }
  }, [search, statusFilter]);

  const fetchSupporting = useCallback(async () => {
    const [s, p, u] = await Promise.all([
      api.get('/sites').catch(() => ({ data: [] })),
      api.get('/projects').catch(() => ({ data: [] })),
      api.get('/users').catch(() => ({ data: [] })),
    ]);
    setSites(s.data); setProjects(p.data); setUsers(u.data);
  }, []);

  useEffect(() => {
    Promise.all([fetchEquipment(), fetchSupporting()]).finally(() => setLoading(false));
  }, [fetchEquipment, fetchSupporting]);

  useEffect(() => {
    if (tab === 'tracking') {
      api.get('/equipment/transfers/all').then(r => setAllTransfers(r.data)).catch(console.error);
      api.get('/equipment/usage/active').then(r => setActiveUsage(r.data)).catch(console.error);
    }
    if (tab === 'spareparts') {
      api.get('/spare-parts').then(r => setSpareParts(r.data)).catch(console.error);
      api.get('/spare-parts/consumption').then(r => setSpareConsumption(r.data)).catch(console.error);
    }
    if (tab === 'workorders') api.get('/work-orders').then(r => setWorkOrders(r.data)).catch(console.error);
    if (tab === 'maintenance') api.get('/equipment/maintenance/all').then(r => setMaintenanceRecords(r.data)).catch(console.error);
    if (tab === 'breakdowns') api.get('/equipment/breakdowns/all').then(r => setBreakdowns(r.data)).catch(console.error);
    if (tab === 'utilization') api.get('/equipment/utilization/report').then(r => setUtilization(r.data)).catch(console.error);
  }, [tab]);

  const loadDetail = async (id: number) => {
    const res = await api.get(`/equipment/${id}`);
    setSelected(res.data);
    if (res.data.qr_code) {
      api.get(`/equipment/${id}/qr`).then(qr => setQrImage(qr.data.qr_image)).catch(() => setQrImage(null));
    }
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (imageFile) fd.append('image', imageFile);
    try {
      if (editing) {
        await api.put(`/equipment/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/equipment', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowForm(false); setEditing(null); setForm(emptyEquipmentForm); setImageFile(null);
      fetchEquipment();
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to save equipment')); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this equipment record?')) return;
    try {
      await api.delete(`/equipment/${id}`);
      if (selected?.id === id) setSelected(null);
      fetchEquipment();
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to delete')); }
  };

  const openEdit = (item: EquipmentItem) => {
    setEditing(item);
    setForm({
      name: item.name, type: item.type || '', model_number: item.model_number || item.model || '',
      serial_number: item.serial_number || '', manufacturer: item.manufacturer || '',
      purchase_date: item.purchase_date?.split('T')[0] || '', warranty_info: item.warranty_info || '',
      condition: item.condition || 'good', status: item.status,
      maintenance_interval_hours: item.maintenance_interval_hours?.toString() || '',
      maintenance_interval_miles: item.maintenance_interval_miles?.toString() || '',
      maintenance_interval_days: item.maintenance_interval_days?.toString() || '',
      next_maintenance_date: item.next_maintenance_date?.split('T')[0] || '',
      current_site_id: item.current_site_id?.toString() || '',
      current_project_id: item.current_project_id?.toString() || '',
      assigned_operator_id: item.assigned_operator_id?.toString() || '',
    });
    setShowForm(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.post(`/equipment/${selected.id}/transfer`, transferForm);
      setShowTransfer(false);
      loadDetail(selected.id);
      fetchEquipment();
    } catch (error: any) { alert(getErrorMessage(error, 'Transfer failed')); }
  };

  const handleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.post(`/equipment/${selected.id}/maintenance`, maintForm);
      setShowMaintenance(false);
      loadDetail(selected.id);
      api.get('/equipment/maintenance/all').then(r => setMaintenanceRecords(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to schedule maintenance')); }
  };

  const handleBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.post(`/equipment/${selected.id}/breakdown`, breakdownForm);
      setShowBreakdown(false);
      loadDetail(selected.id);
      fetchEquipment();
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to report incident')); }
  };

  const handleWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/work-orders', woForm);
      setShowWorkOrder(false);
      if (tab === 'workorders') api.get('/work-orders').then(r => setWorkOrders(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to create work order')); }
  };

  const handleSparePart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...spForm, quantity: parseFloat(spForm.quantity), min_threshold: parseFloat(spForm.min_threshold), unit_cost: spForm.unit_cost ? parseFloat(spForm.unit_cost) : null };
      if (editingSparePart) {
        await api.put(`/spare-parts/${editingSparePart.id}`, payload);
      } else {
        await api.post('/spare-parts', payload);
      }
      setShowSparePart(false);
      setEditingSparePart(null);
      setSpForm({ part_number: '', name: '', category: '', quantity: '0', min_threshold: '5', unit_cost: '', supplier: '' });
      api.get('/spare-parts').then(r => setSpareParts(r.data));
      api.get('/spare-parts/consumption').then(r => setSpareConsumption(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to save spare part')); }
  };

  const deleteSparePart = async (id: number) => {
    if (!confirm('Delete this spare part?')) return;
    try {
      await api.delete(`/spare-parts/${id}`);
      api.get('/spare-parts').then(r => setSpareParts(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to delete')); }
  };

  const openEditSparePart = (part: SparePart) => {
    setEditingSparePart(part);
    setSpForm({
      part_number: part.part_number, name: part.name, category: part.category || '',
      quantity: part.quantity.toString(), min_threshold: part.min_threshold.toString(),
      unit_cost: part.unit_cost?.toString() || '', supplier: part.supplier || '',
    });
    setShowSparePart(true);
  };

  const regenerateQr = async () => {
    if (!selected) return;
    try {
      await api.post(`/equipment/${selected.id}/regenerate-qr`);
      loadDetail(selected.id);
      alert('QR code regenerated');
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to regenerate QR')); }
  };

  const deleteDocument = async (docId: number) => {
    if (!confirm('Delete this document?') || !selected) return;
    try {
      await api.delete(`/equipment/documents/${docId}`);
      loadDetail(selected.id);
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to delete document')); }
  };

  const startUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.post(`/equipment/${selected.id}/usage`, {
        site_id: parseInt(usageStartForm.site_id),
        start_date: new Date().toISOString(),
        project_id: usageStartForm.project_id ? parseInt(usageStartForm.project_id) : undefined,
        operator_id: usageStartForm.operator_id ? parseInt(usageStartForm.operator_id) : undefined,
        mileage_start: usageStartForm.mileage_start ? parseFloat(usageStartForm.mileage_start) : undefined,
        notes: usageStartForm.notes || undefined,
      });
      setShowUsageStart(false);
      loadDetail(selected.id);
      fetchEquipment();
      api.get('/equipment/usage/active').then(r => setActiveUsage(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to start usage')); }
  };

  const endUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/equipment/usage/${usageEndForm.usage_id}/end`, {
        hours_used: parseFloat(usageEndForm.hours_used) || 0,
        mileage_end: usageEndForm.mileage_end ? parseFloat(usageEndForm.mileage_end) : undefined,
      });
      setShowUsageEnd(false);
      if (selected) loadDetail(selected.id);
      fetchEquipment();
      api.get('/equipment/usage/active').then(r => setActiveUsage(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to end usage')); }
  };

  const openCompleteMaintenance = (recordId: number) => {
    setCompletingMaintId(recordId);
    setCompleteMaintForm({ cost: '', notes: '', spare_parts: [] });
    if (spareParts.length === 0) api.get('/spare-parts').then(r => setSpareParts(r.data));
    setShowCompleteMaint(true);
  };

  const addSparePartToMaint = (partId: number, partName: string) => {
    setCompleteMaintForm(prev => ({
      ...prev,
      spare_parts: [...prev.spare_parts, { spare_part_id: partId, quantity_used: '1', part_name: partName }],
    }));
  };

  const submitCompleteMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingMaintId) return;
    try {
      await api.patch(`/equipment/maintenance/${completingMaintId}`, {
        status: 'completed',
        completed_date: new Date().toISOString().split('T')[0],
        cost: completeMaintForm.cost ? parseFloat(completeMaintForm.cost) : undefined,
        notes: completeMaintForm.notes || undefined,
        spare_parts: completeMaintForm.spare_parts.map(sp => ({
          spare_part_id: sp.spare_part_id,
          quantity_used: parseFloat(sp.quantity_used),
        })),
      });
      setShowCompleteMaint(false);
      if (selected) loadDetail(selected.id);
      api.get('/equipment/maintenance/all').then(r => setMaintenanceRecords(r.data));
      api.get('/spare-parts').then(r => setSpareParts(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to complete maintenance')); }
  };

  const viewMaintDetail = async (recordId: number) => {
    try {
      const res = await api.get(`/equipment/maintenance/${recordId}/detail`);
      setMaintDetail(res.data);
      setShowMaintDetail(true);
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to load details')); }
  };

  const openCompleteWorkOrder = (wo: WorkOrder) => {
    setCompletingWO(wo);
    setWoCompleteNotes('');
    setShowCompleteWO(true);
  };

  const submitCompleteWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingWO) return;
    try {
      await api.patch(`/work-orders/${completingWO.id}`, { status: 'completed', completion_notes: woCompleteNotes });
      setShowCompleteWO(false);
      api.get('/work-orders').then(r => setWorkOrders(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Failed to complete work order')); }
  };

  const getActiveUsageForSelected = () => {
    if (!selected) return null;
    const fromDetail = selected.usage?.find((u: any) => u.status === 'active' && !u.end_date);
    if (fromDetail) return fromDetail;
    return activeUsage.find((u: any) => u.equipment_id === selected.id);
  };

  const uploadDocument = async (file: File, category: string) => {
    if (!selected) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    fd.append('name', file.name);
    try {
      await api.post(`/equipment/${selected.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadDetail(selected.id);
    } catch (error: any) { alert(getErrorMessage(error, 'Upload failed')); }
  };

  const runAlerts = async () => {
    try {
      const res = await api.post('/equipment/alerts/check');
      alert(`Alerts processed: ${JSON.stringify(res.data.summary)}`);
    } catch (error: any) { alert(getErrorMessage(error, 'Alert check failed')); }
  };

  const completeMaintenance = (recordId: number) => openCompleteMaintenance(recordId);

  const updateWorkOrderStatus = async (id: number, status: string) => {
    if (status === 'completed') {
      const wo = workOrders.find(w => w.id === id);
      if (wo) { openCompleteWorkOrder(wo); return; }
    }
    try {
      await api.patch(`/work-orders/${id}`, { status });
      api.get('/work-orders').then(r => setWorkOrders(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Update failed')); }
  };

  const updateBreakdown = async (id: number, status: string, repair_progress: string) => {
    try {
      await api.patch(`/equipment/breakdowns/${id}`, { status, repair_progress });
      api.get('/equipment/breakdowns/all').then(r => setBreakdowns(r.data));
    } catch (error: any) { alert(getErrorMessage(error, 'Update failed')); }
  };

  const tabs: { id: Tab; label: string; icon: typeof Wrench }[] = [
    { id: 'registry', label: 'Registry', icon: Wrench },
    { id: 'tracking', label: 'Tracking', icon: Truck },
    { id: 'maintenance', label: 'Maintenance', icon: Calendar },
    { id: 'workorders', label: 'Work Orders', icon: ClipboardList },
    { id: 'spareparts', label: 'Spare Parts', icon: Package },
    { id: 'breakdowns', label: 'Incidents', icon: AlertTriangle },
    { id: 'utilization', label: 'Utilization', icon: BarChart3 },
  ];

  const statusColor = (s: string) => ({
    available: 'bg-green-100 text-green-800', in_use: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-yellow-100 text-yellow-800', broken: 'bg-red-100 text-red-800',
    retired: 'bg-gray-100 text-gray-800',
  }[s] || 'bg-gray-100 text-gray-800');

  if (loading) {
    return <Layout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Equipment Management</h1>
            <p className="text-gray-600 mt-1">Registration, tracking, maintenance, and utilization</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/equipment/scan" className="btn btn-secondary flex items-center space-x-2">
              <QrCode size={18} /><span>Scan QR</span>
            </Link>
            {canManage && (
              <button onClick={runAlerts} className="btn btn-secondary flex items-center space-x-2">
                <Bell size={18} /><span>Check Alerts</span>
              </button>
            )}
            {canManage && tab === 'registry' && (
              <button onClick={() => { setEditing(null); setForm(emptyEquipmentForm); setShowForm(true); }} className="btn btn-primary flex items-center space-x-2">
                <Plus size={18} /><span>Add Equipment</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-2">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon size={16} /><span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* REGISTRY TAB */}
        {tab === 'registry' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchEquipment()}
                    placeholder="Search by name, code, serial..." className="input pl-10" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-40">
                  <option value="">All Status</option>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={fetchEquipment} className="btn btn-secondary">Filter</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipment.map(item => (
                  <div key={item.id} onClick={() => loadDetail(item.id)}
                    className={`card cursor-pointer hover:shadow-lg transition-shadow ${selected?.id === item.id ? 'ring-2 ring-primary-500' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-gray-500 font-mono">{item.equipment_code || `ID-${item.id}`}</p>
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.type} · {item.manufacturer || 'N/A'}</p>
                      </div>
                      <span className={`badge ${statusColor(item.status)}`}>{item.status.replace('_', ' ')}</span>
                    </div>
                    {item.current_site_name && <p className="text-xs text-gray-500 mt-2">📍 {item.current_site_name}</p>}
                  </div>
                ))}
              </div>
              {equipment.length === 0 && <p className="text-center text-gray-500 py-8">No equipment found</p>}
            </div>

            {/* Detail panel */}
            <div className="card h-fit sticky top-4">
              {selected ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    {canManage && (
                      <div className="flex space-x-1">
                        <button onClick={() => openEdit(selected)} className="text-primary-600"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(selected.id)} className="text-red-600"><Trash2 size={18} /></button>
                      </div>
                    )}
                  </div>
                  {selected.image_path && <img src={getUploadUrl(selected.image_path)} alt="" className="w-full h-32 object-cover rounded-lg" />}
                  <div className="text-sm space-y-1">
                    <p><strong>Code:</strong> {selected.equipment_code}</p>
                    <p><strong>Serial:</strong> {selected.serial_number || '—'}</p>
                    <p><strong>Condition:</strong> {selected.condition}</p>
                    <p><strong>Warranty:</strong> {selected.warranty_info || '—'}</p>
                    <p><strong>Hours:</strong> {selected.total_usage_hours || 0}</p>
                    <p><strong>Mileage:</strong> {selected.mileage || 0}</p>
                  </div>
                  {qrImage && (
                    <div className="text-center border rounded-lg p-3">
                      <img src={qrImage} alt="QR Code" className="mx-auto w-32 h-32" />
                      <p className="text-xs text-gray-500 mt-1">Scan to access on mobile</p>
                      {canManage && (
                        <button onClick={regenerateQr} className="text-xs text-primary-600 mt-2 flex items-center justify-center w-full space-x-1">
                          <RefreshCw size={12} /><span>Regenerate QR</span>
                        </button>
                      )}
                    </div>
                  )}
                  {canOperate && (
                    <div className="flex flex-wrap gap-2">
                      {selected.status === 'available' && (
                        <button onClick={() => setShowUsageStart(true)} className="btn btn-primary text-xs flex items-center space-x-1">
                          <Play size={12} /><span>Start Usage</span>
                        </button>
                      )}
                      {getActiveUsageForSelected() && (
                        <button onClick={() => {
                          const active = getActiveUsageForSelected();
                          setUsageEndForm({ usage_id: active.id.toString(), hours_used: '', mileage_end: '' });
                          setShowUsageEnd(true);
                        }} className="btn btn-secondary text-xs flex items-center space-x-1">
                          <Square size={12} /><span>End Usage</span>
                        </button>
                      )}
                      <button onClick={() => setShowTransfer(true)} className="btn btn-secondary text-xs">Transfer</button>
                      <button onClick={() => setShowMaintenance(true)} className="btn btn-secondary text-xs">Schedule Maint.</button>
                      <button onClick={() => setShowBreakdown(true)} className="btn btn-secondary text-xs">Report Incident</button>
                      <label className="btn btn-secondary text-xs cursor-pointer">
                        <Upload size={14} className="inline mr-1" />Upload
                        <input type="file" className="hidden" onChange={e => e.target.files?.[0] && uploadDocument(e.target.files[0], 'document')} />
                      </label>
                    </div>
                  )}
                  {selected.documents && selected.documents.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-1">Documents</h4>
                      {selected.documents.map(d => (
                        <div key={d.id} className="flex justify-between items-center text-xs">
                          <a href={getUploadUrl(d.file_path)} target="_blank" rel="noreferrer" className="text-primary-600">{d.name}</a>
                          {canManage && (
                            <button onClick={() => deleteDocument(d.id)} className="text-red-500"><Trash2 size={12} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Select equipment to view details</p>
              )}
            </div>
          </div>
        )}

        {/* TRACKING TAB */}
        {tab === 'tracking' && (
          <div className="space-y-4">
            <p className="text-gray-600">Monitor equipment assignments, active usage, and transfer history</p>

            {activeUsage.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-3">Active Usage Sessions</h3>
                {activeUsage.map(u => (
                  <div key={u.id} className="flex justify-between items-center text-sm border-b py-2 last:border-0">
                    <div>
                      <strong>{u.equipment_name}</strong> ({u.equipment_code}) at {u.site_name || '—'}
                      <p className="text-xs text-gray-500">Operator: {u.operator_name} · Started: {new Date(u.start_date).toLocaleString()}</p>
                    </div>
                    {canOperate && (
                      <button onClick={() => {
                        setSelected(equipment.find(e => e.id === u.equipment_id) || null);
                        setUsageEndForm({ usage_id: u.id.toString(), hours_used: '', mileage_end: '' });
                        setShowUsageEnd(true);
                      }} className="btn btn-secondary text-xs">End Session</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto card !p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>{['Equipment', 'Status', 'Site', 'Project', 'Operator', 'Hours'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {equipment.map(eq => (
                    <tr key={eq.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => loadDetail(eq.id)}>
                      <td className="px-4 py-3"><div className="font-medium">{eq.name}</div><div className="text-xs text-gray-500">{eq.equipment_code}</div></td>
                      <td className="px-4 py-3"><span className={`badge ${statusColor(eq.status)}`}>{eq.status.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-sm">{eq.current_site_name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{eq.current_project_name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{eq.assigned_operator_name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{eq.total_usage_hours || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-3">Transfer History</h3>
              {allTransfers.length > 0 ? allTransfers.map(t => (
                <div key={t.id} className="text-sm border-b py-2 last:border-0">
                  <strong>{t.equipment_name}</strong> ({t.equipment_code}): {t.from_site_name || '—'} → {t.to_site_name || '—'}
                  <p className="text-xs text-gray-500">{new Date(t.transfer_date).toLocaleString()} · By {t.transferred_by_name}{t.notes && ` · ${t.notes}`}</p>
                </div>
              )) : <p className="text-gray-500 text-sm">No transfers recorded</p>}
            </div>
          </div>
        )}

        {/* MAINTENANCE TAB */}
        {tab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-600">Preventive and corrective maintenance scheduling</p>
              {canOperate && selected && (
                <button onClick={() => setShowMaintenance(true)} className="btn btn-primary text-sm">Schedule Maintenance</button>
              )}
            </div>
            <div className="space-y-3">
              {maintenanceRecords.map(m => (
                <div key={m.id} className="card flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{m.title}</h4>
                    <p className="text-sm text-gray-600">{m.equipment_name} ({m.equipment_code}) · {m.maintenance_type} · {m.status}</p>
                    <p className="text-xs text-gray-500">
                      Due: {m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : 'TBD'}
                      {m.assigned_to_name && ` · Technician: ${m.assigned_to_name}`}
                      {m.cost && ` · Cost: $${m.cost}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => viewMaintDetail(m.id)} className="btn btn-secondary text-xs flex items-center space-x-1">
                      <Eye size={12} /><span>Details</span>
                    </button>
                    {canOperate && !['completed', 'cancelled'].includes(m.status) && (
                      <button onClick={() => completeMaintenance(m.id)} className="btn btn-primary text-xs">Complete</button>
                    )}
                  </div>
                </div>
              ))}
              {maintenanceRecords.length === 0 && <p className="text-gray-500 text-center py-8">No maintenance records. Select equipment in Registry to schedule.</p>}
            </div>
          </div>
        )}

        {/* WORK ORDERS TAB */}
        {tab === 'workorders' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-600">Create and track maintenance work orders</p>
              {canOperate && (
                <button onClick={() => { setWoForm({ ...woForm, equipment_id: selected?.id?.toString() || '' }); setShowWorkOrder(true); }} className="btn btn-primary text-sm">New Work Order</button>
              )}
            </div>
            <div className="space-y-3">
              {workOrders.map(wo => (
                <div key={wo.id} className="card">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{wo.title}</h4>
                      <p className="text-sm text-gray-600">{wo.equipment_name} · {wo.work_order_type} · Priority: {wo.priority}</p>
                      <p className="text-xs text-gray-500">Assigned: {wo.assigned_to_name || 'Unassigned'} · Due: {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : '—'}</p>
                    </div>
                    <span className={`badge ${wo.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{wo.status}</span>
                  </div>
                  {canOperate && wo.status !== 'completed' && (
                    <div className="flex gap-2 mt-3">
                      {wo.status === 'open' && <button onClick={() => updateWorkOrderStatus(wo.id, 'in_progress')} className="btn btn-secondary text-xs">Start</button>}
                      <button onClick={() => updateWorkOrderStatus(wo.id, 'completed')} className="btn btn-primary text-xs">Complete</button>
                    </div>
                  )}
                </div>
              ))}
              {workOrders.length === 0 && <p className="text-gray-500 text-center py-8">No work orders</p>}
            </div>
          </div>
        )}

        {/* SPARE PARTS TAB */}
        {tab === 'spareparts' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-600">Spare parts inventory, consumption history, and reorder alerts</p>
              {canManage && (
                <button onClick={() => { setEditingSparePart(null); setSpForm({ part_number: '', name: '', category: '', quantity: '0', min_threshold: '5', unit_cost: '', supplier: '' }); setShowSparePart(true); }} className="btn btn-primary text-sm">Add Part</button>
              )}
            </div>
            <div className="overflow-x-auto card !p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>{['Part #', 'Name', 'Category', 'Stock', 'Min', 'Status', 'Supplier', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {spareParts.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-sm">{p.part_number}</td>
                      <td className="px-4 py-3 text-sm">{p.name}</td>
                      <td className="px-4 py-3 text-sm">{p.category || '—'}</td>
                      <td className="px-4 py-3 text-sm">{p.quantity}</td>
                      <td className="px-4 py-3 text-sm">{p.min_threshold}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${p.quantity <= p.min_threshold ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {p.quantity <= p.min_threshold ? 'Reorder' : 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{p.supplier || '—'}</td>
                      <td className="px-4 py-3">
                        {canManage && (
                          <div className="flex space-x-2">
                            <button onClick={() => openEditSparePart(p)} className="text-primary-600"><Edit size={16} /></button>
                            <button onClick={() => deleteSparePart(p.id)} className="text-red-600"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {spareConsumption.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-3">Consumption History</h3>
                {spareConsumption.map(c => (
                  <div key={c.id} className="text-sm border-b py-2 last:border-0">
                    <strong>{c.part_name}</strong> ({c.part_number}) — {c.quantity_used} used
                    <p className="text-xs text-gray-500">{c.equipment_name} · {c.maintenance_title} · {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BREAKDOWNS TAB */}
        {tab === 'breakdowns' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-600">Breakdown, fault, accident, and damage reports</p>
              {canOperate && selected && (
                <button onClick={() => setShowBreakdown(true)} className="btn btn-primary text-sm">Report Incident</button>
              )}
            </div>
            {breakdowns.map(bd => (
              <div key={bd.id} className="card">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-medium">{bd.equipment_name} ({bd.incident_type || 'breakdown'})</h4>
                    <p className="text-sm text-gray-600">{bd.description}</p>
                    <p className="text-xs text-gray-500">Severity: {bd.severity} · Reported by: {bd.reported_by_name}</p>
                    {bd.repair_progress && <p className="text-xs mt-1">Progress: {bd.repair_progress}</p>}
                  </div>
                  <span className={`badge ${bd.status === 'fixed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{bd.status}</span>
                </div>
                {canOperate && bd.status !== 'fixed' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateBreakdown(bd.id, 'in_repair', 'Repair in progress')} className="btn btn-secondary text-xs">In Repair</button>
                    <button onClick={() => updateBreakdown(bd.id, 'fixed', 'Repair completed')} className="btn btn-primary text-xs">Mark Fixed</button>
                  </div>
                )}
              </div>
            ))}
            {breakdowns.length === 0 && <p className="text-gray-500 text-center py-8">No incidents reported</p>}
          </div>
        )}

        {/* UTILIZATION TAB */}
        {tab === 'utilization' && (
          <div className="space-y-4">
            <p className="text-gray-600">Usage hours, idle equipment, and performance (last 30 days)</p>
            {utilization.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-4">30-Day Usage Hours by Equipment</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={utilization.slice(0, 10).map(u => ({ name: u.equipment_code || u.name.substring(0, 12), hours: Number(u.period_hours) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto card !p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>{['Equipment', 'Status', 'Total Hours', '30-Day Hours', 'Sessions', 'Mileage', 'Idle?'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {utilization.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-gray-500">{u.equipment_code}</div></td>
                      <td className="px-4 py-3"><span className={`badge ${statusColor(u.status)}`}>{u.status.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-sm">{Number(u.total_usage_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm">{Number(u.period_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm">{u.usage_sessions}</td>
                      <td className="px-4 py-3 text-sm">{Number(u.mileage).toFixed(0)}</td>
                      <td className="px-4 py-3">{u.potentially_idle ? <span className="badge bg-orange-100 text-orange-800">Idle</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Equipment Form Modal */}
      {showForm && (
        <Modal title={editing ? 'Edit Equipment' : 'Register Equipment'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <form onSubmit={handleSaveEquipment} className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
              <Field label="Category/Type *" value={form.type} onChange={v => setForm({ ...form, type: v })} required />
              <Field label="Manufacturer" value={form.manufacturer} onChange={v => setForm({ ...form, manufacturer: v })} />
              <Field label="Model Number" value={form.model_number} onChange={v => setForm({ ...form, model_number: v })} />
              <Field label="Serial Number" value={form.serial_number} onChange={v => setForm({ ...form, serial_number: v })} />
              <Field label="Purchase Date" value={form.purchase_date} onChange={v => setForm({ ...form, purchase_date: v })} type="date" />
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="input">
                  {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Info</label>
                <textarea value={form.warranty_info} onChange={e => setForm({ ...form, warranty_info: e.target.value })} className="input" rows={2} />
              </div>
              <Field label="Maint. Interval (hours)" value={form.maintenance_interval_hours} onChange={v => setForm({ ...form, maintenance_interval_hours: v })} type="number" />
              <Field label="Maint. Interval (miles)" value={form.maintenance_interval_miles} onChange={v => setForm({ ...form, maintenance_interval_miles: v })} type="number" />
              <Field label="Next Maintenance" value={form.next_maintenance_date} onChange={v => setForm({ ...form, next_maintenance_date: v })} type="date" />
              {!editing && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Image</label>
                  <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="input" />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Register'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transfer Modal */}
      {showTransfer && selected && (
        <Modal title={`Transfer — ${selected.name}`} onClose={() => setShowTransfer(false)}>
          <form onSubmit={handleTransfer} className="space-y-3">
            <SelectField label="To Site" value={transferForm.to_site_id} onChange={v => setTransferForm({ ...transferForm, to_site_id: v })}
              options={sites.map(s => ({ value: s.id, label: s.name }))} />
            <SelectField label="To Project" value={transferForm.to_project_id} onChange={v => setTransferForm({ ...transferForm, to_project_id: v })}
              options={projects.map(p => ({ value: p.id, label: p.name }))} />
            <SelectField label="Operator" value={transferForm.operator_id} onChange={v => setTransferForm({ ...transferForm, operator_id: v })}
              options={users.filter(u => ['worker', 'supervisor'].includes(u.role)).map(u => ({ value: u.id, label: u.full_name }))} />
            <Field label="Notes" value={transferForm.notes} onChange={v => setTransferForm({ ...transferForm, notes: v })} />
            <button type="submit" className="btn btn-primary w-full">Record Transfer</button>
          </form>
        </Modal>
      )}

      {/* Maintenance Modal */}
      {showMaintenance && selected && (
        <Modal title={`Schedule Maintenance — ${selected.name}`} onClose={() => setShowMaintenance(false)}>
          <form onSubmit={handleMaintenance} className="space-y-3">
            <Field label="Title *" value={maintForm.title} onChange={v => setMaintForm({ ...maintForm, title: v })} required />
            <SelectField label="Type" value={maintForm.maintenance_type} onChange={v => setMaintForm({ ...maintForm, maintenance_type: v })}
              options={[{ value: 'preventive', label: 'Preventive' }, { value: 'corrective', label: 'Corrective' }]} />
            <Field label="Scheduled Date" value={maintForm.scheduled_date} onChange={v => setMaintForm({ ...maintForm, scheduled_date: v })} type="date" />
            <SelectField label="Assign Technician" value={maintForm.assigned_to} onChange={v => setMaintForm({ ...maintForm, assigned_to: v })}
              options={users.map(u => ({ value: u.id, label: `${u.full_name} (${u.role})` }))} />
            <Field label="Description" value={maintForm.description} onChange={v => setMaintForm({ ...maintForm, description: v })} />
            <button type="submit" className="btn btn-primary w-full">Schedule</button>
          </form>
        </Modal>
      )}

      {/* Breakdown Modal */}
      {showBreakdown && selected && (
        <Modal title={`Report Incident — ${selected.name}`} onClose={() => setShowBreakdown(false)}>
          <form onSubmit={handleBreakdown} className="space-y-3">
            <SelectField label="Incident Type" value={breakdownForm.incident_type} onChange={v => setBreakdownForm({ ...breakdownForm, incident_type: v })}
              options={['breakdown', 'fault', 'accident', 'damage'].map(t => ({ value: t, label: t }))} />
            <Field label="Description *" value={breakdownForm.description} onChange={v => setBreakdownForm({ ...breakdownForm, description: v })} required />
            <SelectField label="Severity" value={breakdownForm.severity} onChange={v => setBreakdownForm({ ...breakdownForm, severity: v })}
              options={['low', 'medium', 'high', 'critical'].map(s => ({ value: s, label: s }))} />
            <Field label="Fault Code" value={breakdownForm.fault_code} onChange={v => setBreakdownForm({ ...breakdownForm, fault_code: v })} />
            <Field label="Location" value={breakdownForm.location} onChange={v => setBreakdownForm({ ...breakdownForm, location: v })} />
            <button type="submit" className="btn btn-primary w-full">Submit Report</button>
          </form>
        </Modal>
      )}

      {/* Work Order Modal */}
      {showWorkOrder && (
        <Modal title="Create Work Order" onClose={() => setShowWorkOrder(false)}>
          <form onSubmit={handleWorkOrder} className="space-y-3">
            <SelectField label="Equipment *" value={woForm.equipment_id} onChange={v => setWoForm({ ...woForm, equipment_id: v })}
              options={equipment.map(e => ({ value: e.id, label: `${e.name} (${e.equipment_code || e.id})` }))} />
            <Field label="Title *" value={woForm.title} onChange={v => setWoForm({ ...woForm, title: v })} required />
            <SelectField label="Type" value={woForm.work_order_type} onChange={v => setWoForm({ ...woForm, work_order_type: v })}
              options={['maintenance', 'repair', 'inspection'].map(t => ({ value: t, label: t }))} />
            <SelectField label="Priority" value={woForm.priority} onChange={v => setWoForm({ ...woForm, priority: v })}
              options={['low', 'medium', 'high', 'urgent'].map(p => ({ value: p, label: p }))} />
            <SelectField label="Assign To" value={woForm.assigned_to} onChange={v => setWoForm({ ...woForm, assigned_to: v })}
              options={users.map(u => ({ value: u.id, label: u.full_name }))} />
            <Field label="Due Date" value={woForm.due_date} onChange={v => setWoForm({ ...woForm, due_date: v })} type="date" />
            <Field label="Description" value={woForm.description} onChange={v => setWoForm({ ...woForm, description: v })} />
            <button type="submit" className="btn btn-primary w-full">Create Work Order</button>
          </form>
        </Modal>
      )}

      {/* Spare Part Modal */}
      {showSparePart && (
        <Modal title={editingSparePart ? 'Edit Spare Part' : 'Add Spare Part'} onClose={() => { setShowSparePart(false); setEditingSparePart(null); }}>
          <form onSubmit={handleSparePart} className="space-y-3">
            <Field label="Part Number *" value={spForm.part_number} onChange={v => setSpForm({ ...spForm, part_number: v })} required />
            <Field label="Name *" value={spForm.name} onChange={v => setSpForm({ ...spForm, name: v })} required />
            <Field label="Category" value={spForm.category} onChange={v => setSpForm({ ...spForm, category: v })} />
            <Field label="Quantity" value={spForm.quantity} onChange={v => setSpForm({ ...spForm, quantity: v })} type="number" />
            <Field label="Min Threshold" value={spForm.min_threshold} onChange={v => setSpForm({ ...spForm, min_threshold: v })} type="number" />
            <Field label="Unit Cost" value={spForm.unit_cost} onChange={v => setSpForm({ ...spForm, unit_cost: v })} type="number" />
            <Field label="Supplier" value={spForm.supplier} onChange={v => setSpForm({ ...spForm, supplier: v })} />
            <button type="submit" className="btn btn-primary w-full">{editingSparePart ? 'Update Part' : 'Add Part'}</button>
          </form>
        </Modal>
      )}

      {/* Start Usage Modal */}
      {showUsageStart && selected && (
        <Modal title={`Start Usage — ${selected.name}`} onClose={() => setShowUsageStart(false)}>
          <form onSubmit={startUsage} className="space-y-3">
            <SelectField label="Site *" value={usageStartForm.site_id} onChange={v => setUsageStartForm({ ...usageStartForm, site_id: v })}
              options={sites.map(s => ({ value: s.id, label: s.name }))} />
            <SelectField label="Project" value={usageStartForm.project_id} onChange={v => setUsageStartForm({ ...usageStartForm, project_id: v })}
              options={projects.map(p => ({ value: p.id, label: p.name }))} />
            <SelectField label="Operator" value={usageStartForm.operator_id} onChange={v => setUsageStartForm({ ...usageStartForm, operator_id: v })}
              options={users.filter(u => ['worker', 'supervisor'].includes(u.role)).map(u => ({ value: u.id, label: u.full_name }))} />
            <Field label="Starting Mileage" value={usageStartForm.mileage_start} onChange={v => setUsageStartForm({ ...usageStartForm, mileage_start: v })} type="number" />
            <Field label="Notes" value={usageStartForm.notes} onChange={v => setUsageStartForm({ ...usageStartForm, notes: v })} />
            <button type="submit" className="btn btn-primary w-full">Start Usage Session</button>
          </form>
        </Modal>
      )}

      {/* End Usage Modal */}
      {showUsageEnd && (
        <Modal title="End Usage Session" onClose={() => setShowUsageEnd(false)}>
          <form onSubmit={endUsage} className="space-y-3">
            <Field label="Hours Used *" value={usageEndForm.hours_used} onChange={v => setUsageEndForm({ ...usageEndForm, hours_used: v })} type="number" required />
            <Field label="Ending Mileage" value={usageEndForm.mileage_end} onChange={v => setUsageEndForm({ ...usageEndForm, mileage_end: v })} type="number" />
            <button type="submit" className="btn btn-primary w-full">End Session & Record Hours</button>
          </form>
        </Modal>
      )}

      {/* Complete Maintenance Modal */}
      {showCompleteMaint && (
        <Modal title="Complete Maintenance" onClose={() => setShowCompleteMaint(false)}>
          <form onSubmit={submitCompleteMaintenance} className="space-y-3">
            <Field label="Cost ($)" value={completeMaintForm.cost} onChange={v => setCompleteMaintForm({ ...completeMaintForm, cost: v })} type="number" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Completion Notes</label>
              <textarea value={completeMaintForm.notes} onChange={e => setCompleteMaintForm({ ...completeMaintForm, notes: e.target.value })} className="input" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Spare Parts Used</label>
              {completeMaintForm.spare_parts.map((sp, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <span className="input flex-1 bg-gray-50">{sp.part_name}</span>
                  <input type="number" value={sp.quantity_used} min="0.1" step="0.1"
                    onChange={e => {
                      const updated = [...completeMaintForm.spare_parts];
                      updated[idx].quantity_used = e.target.value;
                      setCompleteMaintForm({ ...completeMaintForm, spare_parts: updated });
                    }} className="input w-24" />
                </div>
              ))}
              <select onChange={e => { if (e.target.value) { const p = spareParts.find(sp => sp.id === parseInt(e.target.value)); if (p) addSparePartToMaint(p.id, p.name); e.target.value = ''; } }} className="input mt-1">
                <option value="">+ Add spare part...</option>
                {spareParts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.part_number}) — Stock: {p.quantity}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary w-full">Complete Maintenance</button>
          </form>
        </Modal>
      )}

      {/* Maintenance Detail Modal */}
      {showMaintDetail && maintDetail && (
        <Modal title={`Maintenance: ${maintDetail.title}`} onClose={() => setShowMaintDetail(false)}>
          <div className="space-y-2 text-sm">
            <p><strong>Equipment:</strong> {maintDetail.equipment_name} ({maintDetail.equipment_code})</p>
            <p><strong>Type:</strong> {maintDetail.maintenance_type} · <strong>Status:</strong> {maintDetail.status}</p>
            <p><strong>Scheduled:</strong> {maintDetail.scheduled_date ? new Date(maintDetail.scheduled_date).toLocaleDateString() : '—'}</p>
            <p><strong>Completed:</strong> {maintDetail.completed_date ? new Date(maintDetail.completed_date).toLocaleDateString() : '—'}</p>
            <p><strong>Technician:</strong> {maintDetail.assigned_to_name || '—'}</p>
            <p><strong>Cost:</strong> {maintDetail.cost ? `$${maintDetail.cost}` : '—'}</p>
            {maintDetail.description && <p><strong>Description:</strong> {maintDetail.description}</p>}
            {maintDetail.notes && <p><strong>Notes:</strong> {maintDetail.notes}</p>}
            {maintDetail.spare_parts_used?.length > 0 && (
              <div>
                <strong>Spare Parts Used:</strong>
                {maintDetail.spare_parts_used.map((sp: any) => (
                  <p key={sp.id} className="text-xs text-gray-600 ml-2">· {sp.part_name} ({sp.part_number}): {sp.quantity_used}</p>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Complete Work Order Modal */}
      {showCompleteWO && completingWO && (
        <Modal title={`Complete: ${completingWO.title}`} onClose={() => setShowCompleteWO(false)}>
          <form onSubmit={submitCompleteWorkOrder} className="space-y-3">
            <p className="text-sm text-gray-600">{completingWO.equipment_name} · {completingWO.work_order_type}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Completion Notes *</label>
              <textarea value={woCompleteNotes} onChange={e => setWoCompleteNotes(e.target.value)} className="input" rows={4} required
                placeholder="Describe work performed, parts replaced, test results..." />
            </div>
            <button type="submit" className="btn btn-primary w-full">Mark Complete</button>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="input" required={required} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string | number; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input">
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
