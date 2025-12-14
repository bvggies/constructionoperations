import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { Plus, Edit, Trash2, Users, MapPin, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Site {
  id: number;
  project_id: number;
  name: string;
  location?: string;
  supervisor_id?: number;
  status: string;
  project_name?: string;
  supervisor_name?: string;
}

export const Sites = () => {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    location: '',
    supervisor_id: '',
    status: 'active'
  });

  useEffect(() => {
    fetchSites();
    fetchProjects();
    fetchSupervisors();
  }, []);

  const fetchSites = async () => {
    try {
      const res = await api.get('/sites');
      setSites(res.data);
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const res = await api.get('/users?role=supervisor');
      setSupervisors(res.data);
    } catch (error) {
      console.error('Failed to fetch supervisors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSite) {
        await api.put(`/sites/${editingSite.id}`, formData);
      } else {
        await api.post('/sites', formData);
      }
      setShowModal(false);
      setEditingSite(null);
      resetForm();
      fetchSites();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save site');
    }
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      project_id: site.project_id.toString(),
      name: site.name,
      location: site.location || '',
      supervisor_id: site.supervisor_id?.toString() || '',
      status: site.status
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      name: '',
      location: '',
      supervisor_id: '',
      status: 'active'
    });
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
            <h1 className="text-3xl font-bold text-gray-900">Sites</h1>
            <p className="text-gray-600 mt-1">Manage construction sites</p>
          </div>
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <button
              onClick={() => {
                setEditingSite(null);
                resetForm();
                setShowModal(true);
              }}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>New Site</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <div key={site.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{site.name}</h3>
                <span className={`badge ${site.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {site.status}
                </span>
              </div>
              {site.project_name && (
                <p className="text-sm text-gray-600 mb-2">Project: {site.project_name}</p>
              )}
              {site.location && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                  <MapPin size={16} />
                  <span>{site.location}</span>
                </div>
              )}
              {site.supervisor_name && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                  <User size={16} />
                  <span>{site.supervisor_name}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t">
                <Link
                  to={`/sites/${site.id}/team`}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center space-x-1"
                >
                  <Users size={16} />
                  <span>View Team</span>
                </Link>
                {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
                  <button
                    onClick={() => handleEdit(site)}
                    className="text-gray-600 hover:text-primary-600"
                  >
                    <Edit size={18} />
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
                <h2 className="text-2xl font-bold mb-4">
                  {editingSite ? 'Edit Site' : 'New Site'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project *
                    </label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Site Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supervisor
                    </label>
                    <select
                      value={formData.supervisor_id}
                      onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Select Supervisor</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingSite(null);
                        resetForm();
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingSite ? 'Update' : 'Create'}
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

