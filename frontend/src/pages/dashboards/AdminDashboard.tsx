import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Layout } from '../../components/Layout';
import {
  FolderKanban,
  CheckSquare,
  Package,
  Wrench,
  Users,
  TrendingUp,
  Clock,
  Settings,
  BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardData {
  overview: {
    activeProjects: number;
    pendingTasks: number;
    lowStockMaterials: number;
    equipmentIssues: number;
    presentToday: number;
    totalUsers: number;
    totalSites: number;
  };
  recentActivities: any[];
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState<any[]>([]);
  const [equipmentStats, setEquipmentStats] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    fetchTaskStats();
    fetchEquipmentStats();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      const usersRes = await api.get('/users');
      const sitesRes = await api.get('/sites');
      
      setData({
        ...res.data,
        overview: {
          ...res.data.overview,
          totalUsers: usersRes.data.length,
          totalSites: sitesRes.data.length
        }
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskStats = async () => {
    try {
      const res = await api.get('/reports/tasks/progress');
      setTaskStats(res.data);
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
    }
  };

  const fetchEquipmentStats = async () => {
    try {
      const res = await api.get('/reports/equipment/status');
      setEquipmentStats(res.data);
    } catch (error) {
      console.error('Failed to fetch equipment stats:', error);
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

  const stats = [
    {
      name: 'Active Projects',
      value: data?.overview.activeProjects || 0,
      icon: FolderKanban,
      color: 'bg-blue-500',
      link: '/projects',
      change: '+12%'
    },
    {
      name: 'Total Users',
      value: data?.overview.totalUsers || 0,
      icon: Users,
      color: 'bg-purple-500',
      link: '/users',
      change: '+5%'
    },
    {
      name: 'Total Sites',
      value: data?.overview.totalSites || 0,
      icon: FolderKanban,
      color: 'bg-green-500',
      link: '/sites',
      change: '+8%'
    },
    {
      name: 'Pending Tasks',
      value: data?.overview.pendingTasks || 0,
      icon: CheckSquare,
      color: 'bg-yellow-500',
      link: '/tasks',
      change: '-3%'
    },
    {
      name: 'Low Stock Materials',
      value: data?.overview.lowStockMaterials || 0,
      icon: Package,
      color: 'bg-red-500',
      link: '/materials',
      change: '+2'
    },
    {
      name: 'Equipment Issues',
      value: data?.overview.equipmentIssues || 0,
      icon: Wrench,
      color: 'bg-orange-500',
      link: '/equipment',
      change: '-1'
    },
    {
      name: 'Present Today',
      value: data?.overview.presentToday || 0,
      icon: Clock,
      color: 'bg-indigo-500',
      link: '/attendance',
      change: '+15%'
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Complete system overview and management</p>
          </div>
          <Link to="/users" className="btn btn-primary flex items-center space-x-2">
            <Settings size={20} />
            <span>Manage System</span>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.name}
                to={stat.link}
                className="card hover:shadow-lg transition-all hover:scale-105"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  <span className={`text-sm font-semibold ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </Link>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Status Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Task Status Overview</h2>
              <BarChart3 className="text-primary-600" size={24} />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={taskStats.length > 0 ? taskStats : [
                { status: 'Pending', count: 0 },
                { status: 'In Progress', count: 0 },
                { status: 'Completed', count: 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Equipment Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Equipment Status</h2>
              <Wrench className="text-primary-600" size={24} />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={equipmentStats.length > 0 ? equipmentStats : [
                    { status: 'Available', count: 0 },
                    { status: 'In Use', count: 0 },
                    { status: 'Maintenance', count: 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.status}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {equipmentStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/users" className="card hover:shadow-lg transition-shadow border-l-4 border-purple-500">
            <div className="flex items-center space-x-3">
              <Users size={32} className="text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-900">User Management</h3>
                <p className="text-sm text-gray-600">Manage all users and roles</p>
              </div>
            </div>
          </Link>
          <Link to="/projects" className="card hover:shadow-lg transition-shadow border-l-4 border-blue-500">
            <div className="flex items-center space-x-3">
              <FolderKanban size={32} className="text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Projects</h3>
                <p className="text-sm text-gray-600">View and manage projects</p>
              </div>
            </div>
          </Link>
          <Link to="/reports" className="card hover:shadow-lg transition-shadow border-l-4 border-green-500">
            <div className="flex items-center space-x-3">
              <TrendingUp size={32} className="text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Reports</h3>
                <p className="text-sm text-gray-600">View detailed reports</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Activities */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Activities</h2>
            <Clock className="text-primary-600" size={24} />
          </div>
          <div className="space-y-3">
            {data?.recentActivities && data.recentActivities.length > 0 ? (
              data.recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {activity.site_name} • {activity.user_name} • {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No recent activities</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

