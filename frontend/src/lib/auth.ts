export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'supervisor' | 'worker';
  full_name: string;
  phone?: string;
}

export const getStoredUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const getStoredToken = (): string | null => {
  return localStorage.getItem('token');
};

export const setAuth = (user: User, token: string) => {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
};

export const clearAuth = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
};

export const isAuthenticated = (): boolean => {
  return !!getStoredToken();
};

export const hasRole = (roles: string[]): boolean => {
  const user = getStoredUser();
  return user ? roles.includes(user.role) : false;
};

