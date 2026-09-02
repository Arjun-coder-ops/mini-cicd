import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
  const token = import.meta.env.VITE_API_AUTH_TOKEN;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export default api;
