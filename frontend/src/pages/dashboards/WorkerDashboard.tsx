import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Layout } from '../../components/Layout';
import {
  CheckSquare,
  Clock,
  MapPin,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const WorkerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any | null>(null);
  const [mySites, setMySites] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0
  });

  useEffect(() => {
    fetchMyTasks();
    fetchTodayAttendance();
    fetchMySites();
  }, []);

  const fetchMyTasks = async () => {
    try {
      const res = await api.get(`/tasks?assigned_to=${user?.id}`);
      setMyTasks(res.data);
      
      const stats = {
        pending: res.data.filter((t: any) => t.status === 'pending').length,
        inProgress: res.data.filter((t: any) => t.status === 'in_progress').length,
        completed: res.data.filter((t: any) => t.status === 'completed').length
      };
      setTaskStats(stats);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/attendance?attendance_date=${today}&user_id=${user?.id}`);
      if (res.data.length > 0) {
        setTodayAttendance(res.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  };

  const fetchMySites = async () => {
    try {
      const res = await api.get('/sites');
      // Filter sites where user is assigned
      const assignedSites = res.data.filter(() => {
        // This would need a proper API endpoint to check team membership
        return true; // Simplified for now
      });
      setMySites(assignedSites.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const handleClockIn = async (siteId: number) => {
    try {
      await api.post('/attendance/clock-in', { site_id: siteId });
      fetchTodayAttendance();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      const siteId = todayAttendance?.site_id;
      if (!siteId) return;
      await api.post('/attendance/clock-out', { site_id: siteId });
      fetchTodayAttendance();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to clock out');
    }
  };

  const handleTaskStatus = async (taskId: number, status: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status });
      fetchMyTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update task');
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

  const urgentTasks = myTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');
  const todayTasks = myTasks.filter(t => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    const today = new Date();
    return due.toDateString() === today.toDateString() && t.status !== 'completed';
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Worker Dashboard</h1>
            <p className="text-gray-600 mt-1">Your tasks and daily activities</p>
          </div>
          <Link to="/tasks" className="btn btn-primary flex items-center space-x-2">
            <CheckSquare size={20} />
            <span>View All Tasks</span>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-yellow-500 p-3 rounded-lg">
                <Clock size={24} className="text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Pending Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{taskStats.pending}</p>
          </div>
          <div className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-500 p-3 rounded-lg">
                <TrendingUp size={24} className="text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">In Progress</p>
            <p className="text-3xl font-bold text-gray-900">{taskStats.inProgress}</p>
          </div>
          <div className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-500 p-3 rounded-lg">
                <CheckCircle size={24} className="text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="text-3xl font-bold text-gray-900">{taskStats.completed}</p>
          </div>
          <div className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-red-500 p-3 rounded-lg">
                <AlertCircle size={24} className="text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Urgent Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{urgentTasks.length}</p>
          </div>
        </div>

        {/* Clock In/Out Card */}
        <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Today's Attendance</h2>
              {todayAttendance ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="text-sm opacity-90">Clock In</p>
                      <p className="text-lg font-semibold">
                        {todayAttendance.clock_in
                          ? new Date(todayAttendance.clock_in).toLocaleTimeString()
                          : 'Not clocked in'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Clock Out</p>
                      <p className="text-lg font-semibold">
                        {todayAttendance.clock_out
                          ? new Date(todayAttendance.clock_out).toLocaleTimeString()
                          : 'Not clocked out'}
                      </p>
                    </div>
                    {todayAttendance.hours_worked && (
                      <div>
                        <p className="text-sm opacity-90">Hours Worked</p>
                        <p className="text-lg font-semibold">
                          {todayAttendance.hours_worked.toFixed(2)} hrs
                        </p>
                      </div>
                    )}
                  </div>
                  {!todayAttendance.clock_out && (
                    <button
                      onClick={handleClockOut}
                      className="btn bg-white text-primary-600 hover:bg-gray-100 mt-4"
                    >
                      <Clock size={18} className="inline mr-2" />
                      Clock Out
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-lg mb-4">You haven't clocked in today</p>
                  {mySites.length > 0 && (
                    <div className="space-y-2">
                      {mySites.map((site) => (
                        <button
                          key={site.id}
                          onClick={() => handleClockIn(site.id)}
                          className="btn bg-white text-primary-600 hover:bg-gray-100 mr-2"
                        >
                          <Clock size={18} className="inline mr-2" />
                          Clock In - {site.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Clock size={64} className="opacity-20" />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Tasks */}
          <div className="lg:col-span-2 space-y-4">
            {/* Urgent Tasks */}
            {urgentTasks.length > 0 && (
              <div className="card border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center space-x-2">
                    <AlertCircle className="text-red-500" size={24} />
                    <span>Urgent Tasks</span>
                  </h2>
                </div>
                <div className="space-y-3">
                  {urgentTasks.map((task) => (
                    <div key={task.id} className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        <span className="badge bg-red-100 text-red-800">Urgent</span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          <p>Site: {task.site_name}</p>
                          {task.due_date && (
                            <p>Due: {new Date(task.due_date).toLocaleDateString()}</p>
                          )}
                        </div>
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleTaskStatus(task.id, 'in_progress')}
                            className="btn btn-primary text-sm"
                          >
                            Start Task
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleTaskStatus(task.id, 'completed')}
                            className="btn bg-green-600 text-white text-sm hover:bg-green-700"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Tasks */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center space-x-2">
                  <Calendar className="text-primary-600" size={24} />
                  <span>Today's Tasks</span>
                </h2>
              </div>
              <div className="space-y-3">
                {todayTasks.length > 0 ? (
                  todayTasks.map((task) => (
                    <div key={task.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        <span className={`badge ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">Site: {task.site_name}</p>
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleTaskStatus(task.id, 'in_progress')}
                            className="btn btn-primary text-sm"
                          >
                            Start
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleTaskStatus(task.id, 'completed')}
                            className="btn bg-green-600 text-white text-sm hover:bg-green-700"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No tasks due today</p>
                )}
              </div>
            </div>

            {/* All My Tasks */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">All My Tasks</h2>
                <Link to="/tasks" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {myTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600">{task.site_name}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`badge ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
                {myTasks.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No tasks assigned</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* My Sites */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">My Sites</h2>
                <MapPin className="text-primary-600" size={24} />
              </div>
              <div className="space-y-2">
                {mySites.length > 0 ? (
                  mySites.map((site) => (
                    <Link
                      key={site.id}
                      to="/sites"
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-600">{site.location || 'No location'}</p>
                    </Link>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No sites assigned</p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link to="/tasks" className="block w-full btn btn-primary text-center">
                  View All Tasks
                </Link>
                <Link to="/attendance" className="block w-full btn btn-secondary text-center">
                  View Attendance
                </Link>
                <Link to="/documents" className="block w-full btn btn-secondary text-center">
                  View Documents
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

