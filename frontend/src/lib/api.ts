import axios from 'axios';

// Get API URL from environment or use default
// If VITE_API_URL is set, use it (should include /api)
// Otherwise, construct from backend URL or use localhost
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // Ensure it ends with /api
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }
  // Default to localhost for development
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration and log errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log API errors for debugging
    if (error.config) {
      console.error('API Error:', {
        url: error.config.url,
        baseURL: error.config.baseURL,
        method: error.config.method,
        status: error.response?.status,
        message: error.message
      });
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Log API URL on initialization
console.log('API Base URL:', API_URL);

export default api;

