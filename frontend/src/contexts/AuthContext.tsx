import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../lib/api';
import { getStoredUser, getStoredToken, setAuth, clearAuth } from '../lib/auth';
import type { User } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      // Verify token by fetching user
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          clearAuth();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      const { user, token } = res.data;
      setAuth(user, token);
      setUser(user);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response) {
        // Server responded with error
        throw new Error(error.response.data?.error || 'Login failed');
      } else if (error.request) {
        // Request made but no response
        throw new Error('Unable to connect to server. Please check your API URL configuration.');
      } else {
        // Something else happened
        throw new Error(error.message || 'Login failed');
      }
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

