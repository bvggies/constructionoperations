import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { BarChart3, Download, Users, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Reports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState<any[]>([]);
  const [equipmentStats, setEquipmentStats] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [tasksRes, equipmentRes, attendanceRes] = await Promise.all([
        api.get(`/reports/tasks/progress?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`).catch(() => ({ data: [] })),
        api.get('/reports/equipment/status').catch(() => ({ data: [] })),
        user?.role === 'admin' || user?.role === 'manager' || user?.role === 'supervisor'
          ? api.get(`/reports/attendance/summary?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] })
      ]);

      // Transform task stats to match expected format
      const taskData = Array.isArray(tasksRes.data) ? tasksRes.data.map((item: any) => ({
        status: item.status === 'pending' ? 'Pending' : item.status === 'in_progress' ? 'In Progress' : item.status === 'completed' ? 'Completed' : item.status,
        count: parseInt(item.count) || 0
      })) : [];

      setTaskStats(taskData);
      setEquipmentStats(Array.isArray(equipmentRes.data) ? equipmentRes.data.map((item: any) => ({
        status: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown',
        count: parseInt(item.count) || 0
      })) : []);
      setAttendanceSummary(Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  const taskData = taskStats.length > 0 ? taskStats : [
    { status: 'Pending', count: 0 },
    { status: 'In Progress', count: 0 },
    { status: 'Completed', count: 0 }
  ];

  const equipmentData = equipmentStats.length > 0 ? equipmentStats : [
    { status: 'Available', count: 0 },
    { status: 'In Use', count: 0 },
    { status: 'Maintenance', count: 0 }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive insights and analytics</p>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="input w-auto"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="input w-auto"
            />
            <button className="btn btn-primary flex items-center space-x-2">
              <Download size={18} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Task Progress Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="text-blue-600" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Task Progress Overview</h2>
                <p className="text-sm text-gray-600">Task status distribution</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={taskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="status" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equipment Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Wrench className="text-purple-600" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Equipment Status</h2>
                  <p className="text-sm text-gray-600">Current equipment distribution</p>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={equipmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.status}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {equipmentData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Attendance Summary */}
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="text-green-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Attendance Summary</h2>
                    <p className="text-sm text-gray-600">Worker attendance overview</p>
                  </div>
                </div>
              </div>
              {attendanceSummary.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceSummary.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="full_name" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="present_days" fill="#10b981" radius={[8, 8, 0, 0]} name="Present Days" />
                    <Bar dataKey="absent_days" fill="#ef4444" radius={[8, 8, 0, 0]} name="Absent Days" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <p>No attendance data available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

