import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Layout } from '../../components/Layout';
import {
  CheckSquare,
  Users,
  Clock,
  MapPin,
  AlertCircle,
  TrendingUp,
  Package,
  Wrench
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';

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

export const SupervisorDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mySites, setMySites] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    fetchMySites();
    fetchMyTasks();
    fetchTeamAttendance();
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

  const fetchMySites = async () => {
    try {
      const res = await api.get(`/sites?supervisor_id=${user?.id}`);
      setMySites(res.data);
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const fetchMyTasks = async () => {
    try {
      const res = await api.get('/tasks?status=pending');
      setMyTasks(res.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const fetchTeamAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/attendance?attendance_date=${today}`);
      setTeamAttendance(res.data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
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
      name: 'My Sites',
      value: mySites.length,
      icon: MapPin,
      color: 'bg-blue-500',
      link: '/sites'
    },
    {
      name: 'Pending Tasks',
      value: data?.overview.pendingTasks || 0,
      icon: CheckSquare,
      color: 'bg-yellow-500',
      link: '/tasks'
    },
    {
      name: 'Team Present',
      value: teamAttendance.filter(a => a.status === 'present').length,
      icon: Users,
      color: 'bg-green-500',
      link: '/attendance'
    },
    {
      name: 'Low Stock Alerts',
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
    }
  ];

  const attendanceData = [
    { status: 'Present', count: teamAttendance.filter(a => a.status === 'present').length },
    { status: 'Absent', count: teamAttendance.filter(a => a.status === 'absent').length },
    { status: 'Late', count: teamAttendance.filter(a => a.status === 'late').length }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Supervisor Dashboard</h1>
            <p className="text-gray-600 mt-1">Site management and team oversight</p>
          </div>
          <Link to="/tasks" className="btn btn-primary flex items-center space-x-2">
            <CheckSquare size={20} />
            <span>Manage Tasks</span>
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Sites */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">My Sites</h2>
              <MapPin className="text-primary-600" size={24} />
            </div>
            <div className="space-y-3">
              {mySites.length > 0 ? (
                mySites.map((site) => (
                  <Link
                    key={site.id}
                    to={`/sites/${site.id}/team`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border-l-4 border-primary-500"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {site.project_name} • {site.location || 'No location'}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">
                          Status: <span className={`font-semibold ${site.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                            {site.status}
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className={`badge ${site.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {site.status}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No sites assigned</p>
              )}
            </div>
          </div>

          {/* Team Attendance */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Today's Attendance</h2>
              <Clock className="text-primary-600" size={24} />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Present:</span>
                <span className="font-semibold text-green-600">
                  {teamAttendance.filter(a => a.status === 'present').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Absent:</span>
                <span className="font-semibold text-red-600">
                  {teamAttendance.filter(a => a.status === 'absent').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks and Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Tasks */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Pending Tasks</h2>
              <AlertCircle className="text-yellow-500" size={24} />
            </div>
            <div className="space-y-3">
              {myTasks.length > 0 ? (
                myTasks.map((task) => (
                  <Link
                    key={task.id}
                    to="/tasks"
                    className="flex items-start justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors border-l-4 border-yellow-500"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Site: {task.site_name} • Assigned to: {task.assigned_to_name}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className={`badge ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {task.priority}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No pending tasks</p>
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Activities</h2>
              <TrendingUp className="text-primary-600" size={24} />
            </div>
            <div className="space-y-3">
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                data.recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
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
      </div>
    </Layout>
  );
};

