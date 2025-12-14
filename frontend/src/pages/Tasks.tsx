import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { Plus, Edit, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Task {
  id: number;
  site_id: number;
  title: string;
  description?: string;
  assigned_to: number;
  status: string;
  priority: string;
  due_date?: string;
  site_name?: string;
  assigned_to_name?: string;
}

export const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    site_id: '',
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchSites();
    fetchWorkers();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await api.get('/sites');
      setSites(res.data);
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/users?role=worker');
      setWorkers(res.data);
    } catch (error) {
      console.error('Failed to fetch workers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tasks', formData);
      setShowModal(false);
      resetForm();
      fetchTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create task');
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.put(`/tasks/${id}`, { status });
      fetchTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update task');
    }
  };

  const resetForm = () => {
    setFormData({
      site_id: '',
      title: '',
      description: '',
      assigned_to: '',
      priority: 'medium',
      due_date: ''
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="text-gray-600 mt-1">Manage and track tasks</p>
          </div>
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>New Task</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <div key={task.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                <div className="flex space-x-2">
                  <span className={`badge ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className={`badge ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </div>
              </div>
              {task.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
              )}
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {task.site_name && <p>Site: {task.site_name}</p>}
                {task.assigned_to_name && <p>Assigned to: {task.assigned_to_name}</p>}
                {task.due_date && (
                  <p>Due: {new Date(task.due_date).toLocaleDateString()}</p>
                )}
              </div>
              <div className="flex justify-end space-x-2 pt-4 border-t">
                {task.status !== 'completed' && (
                  <button
                    onClick={() => handleStatusUpdate(task.id, 'completed')}
                    className="btn btn-primary text-sm py-1 px-3"
                  >
                    <CheckCircle size={16} className="inline mr-1" />
                    Complete
                  </button>
                )}
                {task.status === 'pending' && (
                  <button
                    onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                    className="btn btn-secondary text-sm py-1 px-3"
                  >
                    <Clock size={16} className="inline mr-1" />
                    Start
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">New Task</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Site *
                    </label>
                    <select
                      value={formData.site_id}
                      onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Select Site</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign To *
                      </label>
                      <select
                        value={formData.assigned_to}
                        onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">Select Worker</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>{w.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="input"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

