import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { Plus, FileText, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Document {
  id: number;
  name: string;
  file_type: string;
  file_size: number;
  category?: string;
  created_at: string;
  uploaded_by_name?: string;
}

export const Documents = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: number, name: string) => {
    try {
      const res = await api.get(`/documents/${id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Failed to download document');
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
            <p className="text-gray-600 mt-1">Manage project documents</p>
          </div>
          <button className="btn btn-primary flex items-center space-x-2">
            <Plus size={20} />
            <span>Upload Document</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-3 mb-3">
                <FileText size={32} className="text-primary-600" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{doc.name}</h3>
                  {doc.category && (
                    <p className="text-sm text-gray-600">{doc.category}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>Type: {doc.file_type}</p>
                <p>Size: {(doc.file_size / 1024).toFixed(2)} KB</p>
                {doc.uploaded_by_name && <p>Uploaded by: {doc.uploaded_by_name}</p>}
                <p>Date: {new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex space-x-2 pt-4 border-t">
                <button
                  onClick={() => handleDownload(doc.id, doc.name)}
                  className="btn btn-secondary flex-1 flex items-center justify-center space-x-2"
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>
                {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
                  <button className="btn btn-danger">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

