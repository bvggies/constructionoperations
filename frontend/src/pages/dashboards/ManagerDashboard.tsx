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
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

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

export const ManagerDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [materialRequisitions, setMaterialRequisitions] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    fetchProjects();
    fetchPendingRequisitions();
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

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects?status=active');
      setProjects(res.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchPendingRequisitions = async () => {
    try {
      const res = await api.get('/materials/requisitions?status=pending');
      setMaterialRequisitions(res.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch requisitions:', error);
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
      name: 'Pending Approvals',
      value: materialRequisitions.length,
      icon: Package,
      color: 'bg-orange-500',
      link: '/materials'
    },
    {
      name: 'Equipment Issues',
      value: data?.overview.equipmentIssues || 0,
      icon: Wrench,
      color: 'bg-red-500',
      link: '/equipment'
    },
    {
      name: 'Workforce Today',
      value: data?.overview.presentToday || 0,
      icon: Users,
      color: 'bg-green-500',
      link: '/attendance'
    }
  ];

  const weeklyData = [
    { day: 'Mon', tasks: 12, completed: 8 },
    { day: 'Tue', tasks: 15, completed: 12 },
    { day: 'Wed', tasks: 18, completed: 15 },
    { day: 'Thu', tasks: 14, completed: 11 },
    { day: 'Fri', tasks: 16, completed: 14 },
    { day: 'Sat', tasks: 10, completed: 8 },
    { day: 'Sun', tasks: 8, completed: 6 }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
            <p className="text-gray-600 mt-1">Project oversight and resource management</p>
          </div>
          <Link to="/projects" className="btn btn-primary flex items-center space-x-2">
            <TrendingUp size={20} />
            <span>View Reports</span>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                </div>
                <p className="text-sm text-gray-600 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </Link>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Progress */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Weekly Task Progress</h2>
              <BarChart3 className="text-primary-600" size={24} />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="tasks" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                <Area type="monotone" dataKey="completed" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Project Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Active Projects</h2>
              <FolderKanban className="text-primary-600" size={24} />
            </div>
            <div className="space-y-3">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-600">{project.location || 'No location'}</p>
                    </div>
                    <span className={`badge ${project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {project.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No active projects</p>
              )}
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Requisitions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Pending Material Requisitions</h2>
              <AlertTriangle className="text-orange-500" size={24} />
            </div>
            <div className="space-y-3">
              {materialRequisitions.length > 0 ? (
                materialRequisitions.map((req) => (
                  <Link
                    key={req.id}
                    to="/materials"
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors border-l-4 border-orange-500"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{req.material_name}</h3>
                      <p className="text-sm text-gray-600">
                        Quantity: {req.quantity} {req.unit} • Site: {req.site_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested by: {req.requested_by_name}
                      </p>
                    </div>
                    <span className="badge bg-orange-100 text-orange-800">Pending</span>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No pending requisitions</p>
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Activities</h2>
              <Clock className="text-primary-600" size={24} />
            </div>
            <div className="space-y-3">
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                data.recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.site_name} • {new Date(activity.created_at).toLocaleString()}
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
      </div>
    </Layout>
  );
};

