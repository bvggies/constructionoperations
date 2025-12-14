import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Layout } from '../components/Layout';
import { Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Attendance {
  id: number;
  user_id: number;
  site_id: number;
  attendance_date: string;
  clock_in?: string;
  clock_out?: string;
  hours_worked?: number;
  status: string;
  user_name?: string;
  site_name?: string;
}

export const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sitesRes = await api.get('/sites');
        setSites(sitesRes.data);
        if (sitesRes.data.length > 0) {
          const firstSiteId = sitesRes.data[0].id.toString();
          setSelectedSite(firstSiteId);
          // Fetch attendance for first site
          const attendanceRes = await api.get(`/attendance?site_id=${firstSiteId}`);
          setAttendance(attendanceRes.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setLoading(false);
      }
    };
    
    loadData();
    fetchTodayAttendance();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchAttendance();
    }
  }, [selectedSite]);


  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/attendance?site_id=${selectedSite}`);
      setAttendance(res.data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
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
      console.error('Failed to fetch today attendance:', error);
    }
  };

  const handleClockIn = async () => {
    try {
      await api.post('/attendance/clock-in', { site_id: selectedSite });
      fetchTodayAttendance();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      await api.post('/attendance/clock-out', { site_id: selectedSite });
      fetchTodayAttendance();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to clock out');
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
            <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
            <p className="text-gray-600 mt-1">Track worker attendance</p>
          </div>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="input w-auto"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>

        {user?.role === 'worker' && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Today's Attendance</h2>
            {todayAttendance ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm text-gray-600">Clock In</p>
                    <p className="text-lg font-semibold">
                      {todayAttendance.clock_in
                        ? new Date(todayAttendance.clock_in).toLocaleTimeString()
                        : 'Not clocked in'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Clock Out</p>
                    <p className="text-lg font-semibold">
                      {todayAttendance.clock_out
                        ? new Date(todayAttendance.clock_out).toLocaleTimeString()
                        : 'Not clocked out'}
                    </p>
                  </div>
                  {todayAttendance.hours_worked && (
                    <div>
                      <p className="text-sm text-gray-600">Hours Worked</p>
                      <p className="text-lg font-semibold">
                        {typeof todayAttendance.hours_worked === 'number' 
                          ? todayAttendance.hours_worked.toFixed(2) 
                          : Number(todayAttendance.hours_worked || 0).toFixed(2)} hrs
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex space-x-3">
                  {!todayAttendance.clock_in && (
                    <button onClick={handleClockIn} className="btn btn-primary">
                      <Clock size={18} className="inline mr-2" />
                      Clock In
                    </button>
                  )}
                  {todayAttendance.clock_in && !todayAttendance.clock_out && (
                    <button onClick={handleClockOut} className="btn btn-primary">
                      <Clock size={18} className="inline mr-2" />
                      Clock Out
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={handleClockIn} className="btn btn-primary">
                <Clock size={18} className="inline mr-2" />
                Clock In
              </button>
            )}
          </div>
        )}

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Attendance Records</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendance.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.attendance_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.user_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.hours_worked 
                        ? (typeof record.hours_worked === 'number' 
                            ? record.hours_worked.toFixed(2) 
                            : Number(record.hours_worked || 0).toFixed(2))
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          record.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

