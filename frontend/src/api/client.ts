import axios from 'axios';

let _token: string | null = null;

export function setToken(token: string | null) { _token = token; }
export function getToken() { return _token; }

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = client
            .post<{ data: { accessToken: string } }>('/auth/refresh', null)
            .then((r) => r.data.data.accessToken)
            .finally(() => { refreshing = null; });
        }
        const newToken = await refreshing;
        setToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        setToken(null);
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export default client;
