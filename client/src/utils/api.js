import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api' });

let isRefreshing = false;
let failedQueue = [];
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getAccessToken = () => accessToken;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) { prom.reject(error); }
    else { 
      prom.config.headers['Authorization'] = `Bearer ${token}`;
      prom.resolve(api(prom.config));
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('/api/auth/refresh');
        const newToken = res.data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err);
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          toast.error('Session expired. Please login again.');
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
