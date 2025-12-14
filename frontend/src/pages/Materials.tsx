import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { Plus, Package, AlertTriangle, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MaterialInventory {
  id: number;
  site_id: number;
  material_id: number;
  quantity: number;
  min_threshold: number;
  material_name: string;
  unit: string;
  low_stock: boolean;
}

export const Materials = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<MaterialInventory[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchInventory();
    }
  }, [selectedSite]);

  const fetchSites = async () => {
    try {
      const res = await api.get('/sites');
      setSites(res.data);
      if (res.data.length > 0) {
        setSelectedSite(res.data[0].id.toString());
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/materials/inventory/${selectedSite}`);
      setInventory(res.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedSite) {
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
            <h1 className="text-3xl font-bold text-gray-900">Materials</h1>
            <p className="text-gray-600 mt-1">Track material inventory</p>
          </div>
          <div className="flex space-x-3">
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="input w-auto"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <button className="btn btn-primary flex items-center space-x-2">
              <Plus size={20} />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventory.map((item) => (
            <div
              key={item.id}
              className={`card ${item.low_stock ? 'border-l-4 border-red-500' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <Package size={24} className="text-primary-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{item.material_name}</h3>
                </div>
                {item.low_stock && (
                  <AlertTriangle size={20} className="text-red-500" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-semibold">{item.quantity} {item.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Min Threshold:</span>
                  <span className="font-semibold">{item.min_threshold} {item.unit}</span>
                </div>
                {item.low_stock && (
                  <div className="mt-3 p-2 bg-red-50 rounded text-red-700 text-sm">
                    Low stock alert!
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

