import axios from 'axios';
import { Notify } from 'quasar';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('tv_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    const st = e.response?.status;
    if (st === 401 && !e.config.url.includes('/auth/login')) {
      localStorage.removeItem('tv_token');
      localStorage.removeItem('tv_user');
      window.location.href = '/login';
    } else {
      let m = e.response?.data?.message;
      if (Array.isArray(m)) m = m.join('. ');
      Notify.create({ type: 'negative', message: m || 'No se pudo conectar con el servidor' });
    }
    return Promise.reject(e);
  },
);
export default api;
