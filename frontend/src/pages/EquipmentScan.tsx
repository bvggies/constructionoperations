import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { getUploadUrl, getErrorMessage, STATUS_OPTIONS, type EquipmentItem } from '../lib/equipmentTypes';
import { QrCode, ArrowLeft, Wrench, Camera, CameraOff } from 'lucide-react';

function extractQrCode(text: string): string {
  if (text.includes('/equipment/scan/')) {
    return text.split('/equipment/scan/').pop()?.split(/[?#]/)[0] || text;
  }
  return text.trim();
}

export const EquipmentScan = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<EquipmentItem | null>(null);
  const [loading, setLoading] = useState(!!code);
  const [manualCode, setManualCode] = useState(code || '');
  const [newStatus, setNewStatus] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (code) loadEquipment(code);
  }, [code]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const loadEquipment = async (qrCode: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/equipment/scan/${qrCode}`);
      setEquipment(res.data);
      setNewStatus(res.data.status);
    } catch {
      setEquipment(null);
      alert('Equipment not found for this QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const c = manualCode.trim();
    if (c) {
      navigate(`/equipment/scan/${c}`);
      loadEquipment(c);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    scannedRef.current = false;
    try {
      const scanner = new Html5Qrcode('qr-camera-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          const qr = extractQrCode(decodedText);
          setManualCode(qr);
          navigate(`/equipment/scan/${qr}`);
          loadEquipment(qr);
          stopCamera();
        },
        () => {}
      );
      setCameraOn(true);
    } catch {
      setCameraError('Camera access denied or unavailable. Use manual entry instead.');
      setCameraOn(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setCameraOn(false);
  };

  const updateStatus = async () => {
    if (!equipment || !newStatus) return;
    try {
      const res = await api.patch(`/equipment/${equipment.id}/status`, { status: newStatus });
      setEquipment(res.data);
      alert('Status updated successfully');
    } catch (error: any) {
      alert(getErrorMessage(error, 'Failed to update status'));
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <Link to="/equipment" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <QrCode size={28} />
              <span>Scan Equipment</span>
            </h1>
            <p className="text-gray-600 text-sm">Scan QR code with camera or enter manually</p>
          </div>
        </div>

        <div className="card space-y-4">
          {!cameraOn ? (
            <button onClick={startCamera} className="btn btn-primary w-full flex items-center justify-center space-x-2">
              <Camera size={20} />
              <span>Start Camera Scanner</span>
            </button>
          ) : (
            <button onClick={stopCamera} className="btn btn-secondary w-full flex items-center justify-center space-x-2">
              <CameraOff size={20} />
              <span>Stop Camera</span>
            </button>
          )}
          {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
          <div id="qr-camera-reader" className={cameraOn ? '' : 'hidden'} />

          <form onSubmit={handleLookup} className="flex space-x-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter QR code manually..."
              className="input flex-1"
            />
            <button type="submit" className="btn btn-primary">Lookup</button>
          </form>
        </div>

        {equipment && (
          <div className="card space-y-4">
            {equipment.image_path && (
              <img src={getUploadUrl(equipment.image_path)} alt={equipment.name} className="w-full h-48 object-cover rounded-lg" />
            )}
            <div>
              <h2 className="text-xl font-bold">{equipment.name}</h2>
              <p className="text-gray-600">{equipment.equipment_code} · {equipment.type}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Manufacturer:</span> {equipment.manufacturer || '—'}</div>
              <div><span className="text-gray-500">Model:</span> {equipment.model_number || equipment.model || '—'}</div>
              <div><span className="text-gray-500">Serial:</span> {equipment.serial_number || '—'}</div>
              <div><span className="text-gray-500">Condition:</span> {equipment.condition || '—'}</div>
              <div><span className="text-gray-500">Site:</span> {equipment.current_site_name || '—'}</div>
              <div><span className="text-gray-500">Operator:</span> {equipment.assigned_operator_name || '—'}</div>
              <div><span className="text-gray-500">Usage Hours:</span> {equipment.total_usage_hours || 0}</div>
              <div><span className="text-gray-500">Next Maintenance:</span> {equipment.next_maintenance_date ? new Date(equipment.next_maintenance_date).toLocaleDateString() : '—'}</div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Wrench size={16} className="inline mr-1" />
                Update Status
              </label>
              <div className="flex space-x-2">
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input flex-1">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button onClick={updateStatus} className="btn btn-primary">Update</button>
              </div>
            </div>

            <Link to="/equipment" className="btn btn-secondary w-full text-center block">
              View Full Equipment Module
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};
