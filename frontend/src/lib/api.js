import axios from 'axios';

const baseURL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.port === '5173')
  ? ''
  : (import.meta.env.VITE_API_URL || '');
const api = axios.create({ baseURL });

api.defaults.withCredentials = true;

function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const c of cookies) {
    const [k, ...rest] = c.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie('csrfToken');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    if (response?.status === 401 && !config.__retry) {
      config.__retry = true;
      try {
        await axios.post((import.meta.env.VITE_API_URL ) + '/auth/refresh', null, { withCredentials: true });
        return api(config);
      } catch (e) {
        // Let caller handle (likely redirect to login)
        throw error;
      }
    }
    throw error;
  }
);

export default api;
