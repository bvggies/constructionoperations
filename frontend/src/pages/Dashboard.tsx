import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import {
  FolderKanban,
  CheckSquare,
  Package,
  Wrench,
  Users,
  Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardData {
  overview: {
    activeProjects: number;
    pendingTasks: number;
    lowStockMaterials: number;
    equipmentIssues: number;
    presentToday: number;
  };
  recentActivities: any[];
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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

  const stats = [
    {
      name: 'Active Projects',
      value: data?.overview.activeProjects || 0,
      icon: FolderKanban,
      color: 'bg-blue-500',
      link: '/projects'
    },
    {
      name: 'Pending Tasks',
      value: data?.overview.pendingTasks || 0,
      icon: CheckSquare,
      color: 'bg-yellow-500',
      link: '/tasks'
    },
    {
      name: 'Low Stock Materials',
      value: data?.overview.lowStockMaterials || 0,
      icon: Package,
      color: 'bg-red-500',
      link: '/materials'
    },
    {
      name: 'Equipment Issues',
      value: data?.overview.equipmentIssues || 0,
      icon: Wrench,
      color: 'bg-orange-500',
      link: '/equipment'
    },
    {
      name: 'Present Today',
      value: data?.overview.presentToday || 0,
      icon: Users,
      color: 'bg-green-500',
      link: '/attendance'
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your construction operations</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.name}
                to={stat.link}
                className="card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Status Chart */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Task Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Pending', value: 12 },
                { name: 'In Progress', value: 8 },
                { name: 'Completed', value: 25 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Equipment Status */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Equipment Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Available', value: 15 },
                    { name: 'In Use', value: 8 },
                    { name: 'Maintenance', value: 3 },
                    { name: 'Broken', value: 2 }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0, 1, 2, 3].map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
          <div className="space-y-3">
            {data?.recentActivities && data.recentActivities.length > 0 ? (
              data.recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Clock size={20} className="text-gray-400 mt-1" />
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

