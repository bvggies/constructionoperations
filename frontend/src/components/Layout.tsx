import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  MapPin,
  CheckSquare,
  Package,
  Wrench,
  Clock,
  FileText,
  Bell,
  Menu,
  X,
  LogOut,
  Settings
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    switch (user?.role) {
      case 'admin':
        return '/dashboard/admin';
      case 'manager':
        return '/dashboard/manager';
      case 'supervisor':
        return '/dashboard/supervisor';
      case 'worker':
        return '/dashboard/worker';
      default:
        return '/dashboard';
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: getDashboardPath(), roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: FolderKanban, label: 'Projects', path: '/projects', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: MapPin, label: 'Sites', path: '/sites', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: Package, label: 'Materials', path: '/materials', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: Wrench, label: 'Equipment', path: '/equipment', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: Clock, label: 'Attendance', path: '/attendance', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: FileText, label: 'Documents', path: '/documents', roles: ['admin', 'manager', 'supervisor', 'worker'] },
    { icon: Users, label: 'Users', path: '/users', roles: ['admin', 'manager'] },
  ].filter(item => !item.roles || item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-primary-600">OpsTracker</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <div className="flex-1" />
            <Link
              to="/notifications"
              className="relative p-2 text-gray-500 hover:text-gray-700"
            >
              <Bell size={24} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

